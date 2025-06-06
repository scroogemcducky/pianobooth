import { CreateMidiNoteEventsArray, getEmptyNoteEvent } from "./smallFunctions";

const convertToNoteEventsJSON = (file, microsecondsPerQuarter, staticMidiFileData) => {
    let tickTime = microsecondsPerQuarter / staticMidiFileData.division;
    let pianoKeys = CreateMidiNoteEventsArray(88, 21);
    let sustainOn = false;
    let waitingQueue = [];
    let finalNotes = [];
    let noteOnCount = 0;
    let noteOffCount = 0;
    let sustainEvents = 0;
    let trackNoteCounts = [];

    const processEvent = (event, timePassed) => {
        if ('setTempo' in event) {
            microsecondsPerQuarter = event.setTempo.microsecondsPerQuarter;
            tickTime = microsecondsPerQuarter / staticMidiFileData.division;
        } else if ('noteOn' in event) {
            // In MIDI, a noteOn with velocity 0 is equivalent to a noteOff
            if (event.noteOn.velocity === 0) {
                // Handle it as a noteOff event
                const noteNumber = event.noteOn.noteNumber - 21;
                // Check range to avoid out of bounds error
                if (noteNumber < 0 || noteNumber >= pianoKeys.length) {
                    return;
                }
                const note = pianoKeys[noteNumber];
                note.Duration = Math.floor(timePassed - note.Delta);

                if (!sustainOn) {
                    note.SoundDuration = note.Duration;
                    if (note.Velocity && note.Delta >= 0) {
                        // Create a copy of the note instead of using the reference
                        finalNotes.push({...note});
                    }
                } else {
                    // Create a copy of the note instead of using the reference
                    waitingQueue.push({...note});
                }
                pianoKeys[noteNumber] = getEmptyNoteEvent(noteNumber + 21);
                noteOffCount++;
                return;
            }
            
            const noteNumber = event.noteOn.noteNumber - 21;
            // Check range to avoid out of bounds error
            if (noteNumber < 0 || noteNumber >= pianoKeys.length) {
                return;
            }
            pianoKeys[noteNumber].Delta = Math.floor(timePassed);
            pianoKeys[noteNumber].Velocity = event.noteOn.velocity;
            noteOnCount++;
        } else if ('noteOff' in event) {
            const noteNumber = event.noteOff.noteNumber - 21;
            // Check range to avoid out of bounds error
            if (noteNumber < 0 || noteNumber >= pianoKeys.length) {
                return;
            }
            const note = pianoKeys[noteNumber];
            note.Duration = Math.floor(timePassed - note.Delta);

            if (!sustainOn) {
                note.SoundDuration = note.Duration;
                if (note.Velocity && note.Delta >= 0) {
                    // Create a copy of the note instead of using the reference
                    finalNotes.push({...note});
                }
            } else {
                // Create a copy of the note instead of using the reference
                waitingQueue.push({...note});
            }
            pianoKeys[noteNumber] = getEmptyNoteEvent(noteNumber + 21);
            noteOffCount++;
        } else if ('controlChange' in event && event.controlChange.type === 64) {
            const wasSustainOn = sustainOn;
            sustainOn = event.controlChange.value > 63;
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
    
    if (file.format === 0) {
        // Format 0: single track containing all channels
        let timePassed = 0;
        file.tracks[0].forEach(event => {
            timePassed += event.delta * tickTime;
            processEvent(event, timePassed);
        });
        trackNoteCounts.push(finalNotes.length);
    } else {
        // Format 1: multiple tracks to be played simultaneously
        // console.log("Format 1/2 MIDI file: processing all tracks simultaneously");
        let timePassed = 0;
        file.tracks.forEach((track) => {
            let trackNoteCount = 0;
            timePassed = 0;
            track.forEach(event => {
                timePassed += event.delta * tickTime;
                let notesBefore = finalNotes.length;
                processEvent(event, timePassed);
                if (finalNotes.length > notesBefore) {
                    trackNoteCount += (finalNotes.length - notesBefore);
                }
            });
            trackNoteCounts.push(trackNoteCount);
        });
    }


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

