import type { Midi, Track } from '@tonejs/midi';

// `Note` is not re-exported from the package root, so derive it from `Track`
// rather than deep-importing into the package's dist/ folder.
type ToneNote = Track['notes'][number];

export type NoteEvent = {
    NoteNumber: number;
    Delta: number; // microseconds from start
    Duration: number; // microseconds (key-down duration)
    SoundDuration?: number; // microseconds (optional longer sounding duration)
    Velocity: number;
};

// Lowest MIDI note on a standard 88-key piano (A0); the range runs to C8.
const LOWEST_PIANO_NOTE = 21;
const PIANO_KEY_COUNT = 88;
// MIDI data bytes are 7-bit, so velocity tops out at 127.
const MAX_MIDI_VELOCITY = 127;
const MICROSECONDS_PER_SECOND = 1000000;

const normalizeOverlappingNotes = (
    notes: NoteEvent[],
    options?: { sameStartEpsilonUs?: number; overlapGapUs?: number }
): NoteEvent[] => {
    const sameStartEpsilonUs = options?.sameStartEpsilonUs ?? 2000; // 2ms
    const overlapGapUs = options?.overlapGapUs ?? 100000; // 100ms
    const minSeparationUs = 50000; // 50ms visible delineation between repeated pitches when possible

    const byPitch = new Map<number, NoteEvent[]>();
    for (const note of notes) {
        if (!byPitch.has(note.NoteNumber)) byPitch.set(note.NoteNumber, []);
        byPitch.get(note.NoteNumber)!.push(note);
    }

    const normalized: NoteEvent[] = [];

    for (const [, pitchNotes] of byPitch) {
        pitchNotes.sort((a, b) => (a.Delta - b.Delta) || (a.Duration - b.Duration));

        // 1) Deduplicate same-start notes (common in multi-track MIDIs)
        const deduped: NoteEvent[] = [];
        for (let i = 0; i < pitchNotes.length; ) {
            const start = pitchNotes[i].Delta;
            let maxEnd = start + pitchNotes[i].Duration;
            let maxSoundEnd = start + (pitchNotes[i].SoundDuration ?? pitchNotes[i].Duration);
            let maxVelocity = typeof pitchNotes[i].Velocity === 'number' ? pitchNotes[i].Velocity : undefined;

            let j = i + 1;
            while (j < pitchNotes.length && Math.abs(pitchNotes[j].Delta - start) <= sameStartEpsilonUs) {
                const candidateStart = pitchNotes[j].Delta;
                maxEnd = Math.max(maxEnd, candidateStart + pitchNotes[j].Duration);
                maxSoundEnd = Math.max(maxSoundEnd, candidateStart + (pitchNotes[j].SoundDuration ?? pitchNotes[j].Duration));
                const velocity = pitchNotes[j].Velocity;
                if (typeof velocity === 'number') {
                    maxVelocity = typeof maxVelocity === 'number' ? Math.max(maxVelocity, velocity) : velocity;
                }
                j++;
            }

            const base: NoteEvent = { ...pitchNotes[i] };
            base.Delta = start;
            base.Duration = Math.max(0, maxEnd - start);
            if (typeof base.SoundDuration === 'number') {
                base.SoundDuration = Math.max(base.Duration, maxSoundEnd - start);
            }
            if (typeof maxVelocity === 'number') base.Velocity = maxVelocity;

            if (base.Duration > 0) deduped.push(base);
            i = j;
        }

        // 2) Enforce no overlaps by truncating the earlier note to (next.start - gap) when possible
        const noOverlap: NoteEvent[] = [];
        for (const note of deduped) {
            const prev = noOverlap.length ? noOverlap[noOverlap.length - 1] : null;
            if (prev) {
                const prevStart = prev.Delta;
                const prevEnd = prev.Delta + prev.Duration;
                const nextStart = note.Delta;

                if (prevEnd > nextStart) {
                    const originalPrevDuration = prev.Duration;
                    let targetEnd = nextStart - overlapGapUs;
                    if (targetEnd <= prevStart) targetEnd = nextStart;
                    const newDuration = targetEnd - prevStart;

                    if (newDuration <= 0) {
                        // Prefer dropping the earlier note if it cannot be truncated to a positive duration.
                        noOverlap.pop();
                    } else {
                        prev.Duration = newDuration;
                        // Keep SoundDuration aligned when it matches Duration (no sustain case).
                        if (typeof prev.SoundDuration === 'number') {
                            if (prev.SoundDuration === originalPrevDuration) prev.SoundDuration = newDuration;
                            else if (prev.SoundDuration < newDuration) prev.SoundDuration = newDuration;
                        }
                    }
                } else {
                    // If notes touch (or are very close), create a small gap so repeated presses are visually distinct.
                    const gapUs = nextStart - prevEnd;
                    if (gapUs >= 0 && gapUs < minSeparationUs) {
                        const originalPrevDuration = prev.Duration;
                        const targetEnd = nextStart - minSeparationUs;
                        const newDuration = targetEnd - prevStart;
                        if (newDuration > 0) {
                            prev.Duration = newDuration;
                            if (typeof prev.SoundDuration === 'number') {
                                if (prev.SoundDuration === originalPrevDuration) prev.SoundDuration = newDuration;
                                else if (prev.SoundDuration < newDuration) prev.SoundDuration = newDuration;
                            }
                        }
                    }
                }
            }
            noOverlap.push(note);
        }

        normalized.push(...noOverlap);
    }

    normalized.sort((a, b) => a.Delta - b.Delta);
    return normalized;
};

// Sustain (CC64) is intentionally ignored: Duration drives the visual falling
// blocks, and pedal-extended notes would overlap. Audio is rendered separately by
// FluidSynth from the source .mid, which applies the pedal itself.
const convertToNoteEventsJSON = (midi: Midi) => {
    const finalNotes: NoteEvent[] = [];

    // Note timings come from Tone.js, which has already applied the file's tempo map.
    const processNote = (note: ToneNote) => {
        const keyIndex = note.midi - LOWEST_PIANO_NOTE;
        // Ignore notes outside the piano's range
        if (keyIndex < 0 || keyIndex >= PIANO_KEY_COUNT) {
            return;
        }

        // Key order matches the previously generated JSON so regenerating the
        // catalog produces byte-identical files.
        const duration = Math.floor(note.duration * MICROSECONDS_PER_SECOND);
        finalNotes.push({
            NoteNumber: note.midi,
            Velocity: Math.floor(note.velocity * MAX_MIDI_VELOCITY),
            Duration: duration,
            SoundDuration: duration,
            Delta: Math.floor(note.time * MICROSECONDS_PER_SECOND),
        });
    };

    for (const track of midi.tracks) {
        track.notes.forEach(processNote);
    }

    const sortedNotes = finalNotes.sort((a, b) => a.Delta - b.Delta);
    if (sortedNotes.length > 0) {
        const minDelta = sortedNotes[0].Delta;
        sortedNotes.forEach(note => {
            note.Delta -= minDelta;
        });
    }

    // Learning-mode normalization: prevent overlapping same-pitch notes from conflicting in the player.
    return normalizeOverlappingNotes(sortedNotes);
};

export default convertToNoteEventsJSON;
