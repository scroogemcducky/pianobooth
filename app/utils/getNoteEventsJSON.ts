import { CreateMidiNoteEventsArray, getEmptyNoteEvent } from "./smallFunctions";

type NoteEvent = {
    NoteNumber: number;
    Delta: number; // microseconds from start
    Duration: number; // microseconds (key-down duration)
    SoundDuration?: number; // microseconds (optional longer sounding duration)
    Velocity?: number;
};

const normalizeOverlappingNotes = (
    notes: NoteEvent[],
    options?: { sameStartEpsilonUs?: number; overlapGapUs?: number }
): NoteEvent[] => {
    const sameStartEpsilonUs = options?.sameStartEpsilonUs ?? 2000; // 2ms
    const overlapGapUs = options?.overlapGapUs ?? 100000; // 100ms
    const minSeparationUs = 100000; // 100ms visible delineation between repeated pitches when possible

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

const convertToNoteEventsJSON = (midi: any, microsecondsPerQuarter: number, staticMidiFileData: any) => {
    let tickTime = microsecondsPerQuarter / staticMidiFileData.division;
    let pianoKeys = CreateMidiNoteEventsArray(88, 21);
    let sustainOn = false;
    let waitingQueue: any[] = [];
    let finalNotes: any[] = [];
    let noteOnCount = 0;
    let noteOffCount = 0;
    let sustainEvents = 0;
    let trackNoteCounts: number[] = [];

    // Process tempo changes
    const processTempoChange = (tempo: any, timePassed: number) => {
        microsecondsPerQuarter = tempo.microsecondsPerQuarter;
        tickTime = microsecondsPerQuarter / staticMidiFileData.division;
    };

    // Process sustain pedal events
    const processSustainPedal = (controlChange: any, timePassed: number) => {
        if (controlChange.number === 64) { // Sustain pedal
            const wasSustainOn = sustainOn;
            sustainOn = controlChange.value > 63;
            sustainEvents++;
            
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
    const processNote = (note: any, startTime: number, endTime: number) => {
        const noteNumber = note.midi - 21;
        // Check range to avoid out of bounds error
        if (noteNumber < 0 || noteNumber >= pianoKeys.length) {
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
        
        noteOnCount++;
        noteOffCount++;
    };
    
    // Process all tracks in the MIDI file
    midi.tracks.forEach((track: any, trackIndex: number) => {
        let trackNoteCount = 0;
        const notesBefore = finalNotes.length;
        
        // Process notes in this track
        track.notes.forEach((note: any) => {
            processNote(note, note.time, note.time + note.duration);
        });
        
        // Process tempo changes in this track
        if (track.tempos) {
            track.tempos.forEach((tempo: any) => {
                processTempoChange(tempo, tempo.time * 1000000);
            });
        }
        
        // Process control changes (sustain pedal) in this track
        if (track.controlChanges) {
            // Sustain pedal is typically CC 64
            if (track.controlChanges[64]) {
                track.controlChanges[64].forEach((cc: any) => {
                    processSustainPedal(cc, cc.time * 1000000);
                });
            }
        }
        
        trackNoteCount = finalNotes.length - notesBefore;
        trackNoteCounts.push(trackNoteCount);
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
