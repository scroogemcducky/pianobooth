import type { Midi, Track } from '@tonejs/midi';

// `Note` and `ControlChange` are not re-exported from the package root, so derive
// them from `Track` rather than deep-importing into the package's dist/ folder.
type ToneNote = Track['notes'][number];
type ToneControlChange = Track['controlChanges'][number][number];

export type NoteEvent = {
    NoteNumber: number;
    Delta: number; // microseconds from start
    Duration: number; // microseconds (key-down duration)
    SoundDuration?: number; // microseconds (optional longer sounding duration)
    Velocity: number;
};

// Lowest and highest MIDI note numbers on a standard 88-key piano (A0 to C8)
const LOWEST_PIANO_NOTE = 21;
const PIANO_KEY_COUNT = 88;

const getEmptyNoteEvent = (noteNumber: number): NoteEvent => ({
    NoteNumber: noteNumber,
    Velocity: -1,
    Duration: -1,
    SoundDuration: -1,
    Delta: -1,
});

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

const convertToNoteEventsJSON = (midi: Midi, _microsecondsPerQuarter: number, _staticMidiFileData: unknown) => {
    let sustainOn = false;
    let waitingQueue: NoteEvent[] = [];
    const finalNotes: NoteEvent[] = [];

    // Process sustain pedal events
    const processSustainPedal = (controlChange: ToneControlChange, timePassed: number) => {
        if (controlChange.number === 64) { // Sustain pedal
            const wasSustainOn = sustainOn;
            sustainOn = controlChange.value > 63;
            
            if (wasSustainOn && !sustainOn) {
                waitingQueue.forEach(note => {
                    note.SoundDuration = Math.floor(timePassed - note.Delta);
                    if (note.Velocity && note.Delta >= 0) {
                        finalNotes.push(note);
                    }
                });
                waitingQueue = [];
            }
        }
    };

    // Process note events
    const processNote = (note: ToneNote, startTime: number, endTime: number) => {
        const keyIndex = note.midi - LOWEST_PIANO_NOTE;
        // Ignore notes outside the piano's range
        if (keyIndex < 0 || keyIndex >= PIANO_KEY_COUNT) {
            return;
        }

        const noteEvent = getEmptyNoteEvent(note.midi);
        noteEvent.Delta = Math.floor(startTime * 1000000); // Convert to microseconds
        noteEvent.Duration = Math.floor((endTime - startTime) * 1000000); // Convert to microseconds
        noteEvent.Velocity = Math.floor(note.velocity * 127); // Convert from 0-1 to 0-127

        if (!sustainOn) {
            noteEvent.SoundDuration = noteEvent.Duration;
            if (noteEvent.Velocity && noteEvent.Delta >= 0) {
                finalNotes.push({...noteEvent});
            }
        } else {
            waitingQueue.push({...noteEvent});
        }
    };
    
    // Process all tracks in the MIDI file
    midi.tracks.forEach((track: Track) => {
        // Process notes in this track
        track.notes.forEach((note: ToneNote) => {
            processNote(note, note.time, note.time + note.duration);
        });

        // Process control changes (sustain pedal) in this track
        if (track.controlChanges) {
            // Sustain pedal is typically CC 64
            if (track.controlChanges[64]) {
                track.controlChanges[64].forEach((cc: ToneControlChange) => {
                    processSustainPedal(cc, cc.time * 1000000);
                });
            }
        }
    });


    const sortedNotes = finalNotes.sort((a, b) => a.Delta - b.Delta);
    if (sortedNotes.length > 0) {
        const minDelta = sortedNotes[0].Delta;
        sortedNotes.forEach(note => {
            note.Delta -= minDelta;
        });
    }

    // Learning-mode normalization: prevent overlapping same-pitch notes from conflicting in the player.
    return normalizeOverlappingNotes(sortedNotes as NoteEvent[]);
};

export default convertToNoteEventsJSON;
