import { CreateMidiNoteEventsArray, getEmptyNoteEvent } from "./smallFunctions";

const convertToNoteEventsJSON = (file, microsecondsPerQuarter, staticMidiFileData) => {
    let tickTime = microsecondsPerQuarter / staticMidiFileData.division;
    let pianoKeys = CreateMidiNoteEventsArray(88, 21);
    let sustainOn = false;
    let waitingQueue = [];
    let finalNotes = [];

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

    let timePassed = 0;
    file.tracks.forEach(track => {
        track.forEach(event => {
            timePassed += event.delta * tickTime;
            processEvent(event, timePassed);
        });
    });


    return finalNotes.sort((a, b) => a.Delta - b.Delta);
};

export default convertToNoteEventsJSON;

