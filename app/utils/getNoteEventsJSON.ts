import { CreateMidiNoteEventsArray, getEmptyNoteEvent } from "./smallFunctions";

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

    return sortedNotes;
};

export default convertToNoteEventsJSON;

