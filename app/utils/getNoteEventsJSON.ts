import { CreateMidiNoteEventsArray, getEmptyNoteEvent } from "./smallFunctions";

const convertToNoteEventsJSON = (file, microsecondsPerQuarter, staticMidiFileData) => {
    console.log("Starting note events conversion with file:", file);
    console.log("microsecondsPerQuarter:", microsecondsPerQuarter, "division:", staticMidiFileData.division);
    let tickTime = microsecondsPerQuarter / staticMidiFileData.division;
    console.log("Calculated tickTime:", tickTime);
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
            const noteNumber = event.noteOn.noteNumber - 21;
            pianoKeys[noteNumber].Delta = Math.floor(timePassed);
            pianoKeys[noteNumber].Velocity = event.noteOn.velocity;
        } else if ('noteOff' in event) {
            const noteNumber = event.noteOff.noteNumber - 21;
            const note = pianoKeys[noteNumber];
            note.Duration = Math.floor(timePassed - note.Delta);

            if ( !sustainOn ) {
                note.SoundDuration = note.Duration;
                if (note.Velocity && note.Delta >= 0) {
                    finalNotes.push(note);
                }
            } else {
                waitingQueue.push(note);
            }
            pianoKeys[noteNumber] = getEmptyNoteEvent(noteNumber + 21);
        } else if ('controlChange' in event && event.controlChange.type === 64) {
            sustainOn = event.controlChange.value > 63;
            if (!sustainOn) {
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

    console.log("Processing MIDI format", file.format, "file with", file.tracks.length, "tracks");
    
    if (file.format === 0) {
        // Format 0: single track containing all channels
        console.log("Format 0 MIDI file: processing single track");
        let timePassed = 0;
        file.tracks[0].forEach(event => {
            timePassed += event.delta * tickTime;
            processEvent(event, timePassed);
        });
        trackNoteCounts.push(finalNotes.length);
        console.log("Track 0 produced", finalNotes.length, "notes");
    } else {
        // Format 1: multiple tracks to be played simultaneously
        console.log("Format 1/2 MIDI file: processing all tracks simultaneously");
        let timePassed = 0;
        file.tracks.forEach((track, trackIndex) => {
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
            console.log("Track", trackIndex, "produced approximately", trackNoteCount, "notes");
        });
    }


    // return finalNotes.sort((a, b) => a.Delta - b.Delta);
    const sortedNotes = finalNotes.sort((a, b) => a.Delta - b.Delta);
    if (sortedNotes.length > 0) {
        const minDelta = sortedNotes[0].Delta;
        sortedNotes.forEach(note => {
            note.Delta -= minDelta;
        });
    }

    console.log("Track note counts:", trackNoteCounts);
    console.log("Total notes after processing:", sortedNotes.length);
    
    if (sortedNotes.length === 0) {
        console.warn("WARNING: No notes were extracted from the MIDI file!");
    }

    return sortedNotes;
};

export default convertToNoteEventsJSON;

