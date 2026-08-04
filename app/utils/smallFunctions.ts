export type NoteEvent = {
    NoteNumber: number;
    Velocity: number;
    Duration: number;
    SoundDuration: number;
    Delta: number;
}

const getEmptyNoteEvent = (noteNumber: number): NoteEvent => {
    return{
        NoteNumber: noteNumber,
        Velocity: -1,
        Duration: -1,
        SoundDuration: -1,
        Delta: -1
    }
}

const CreateEmptyArray = (Keys: number, startNumber: number): NoteEvent[] =>{
    const Keys_Array: NoteEvent[] = [];
    for(let x = startNumber; x < Keys + startNumber; x++){
        Keys_Array.push(getEmptyNoteEvent(x));
    }
    return Keys_Array;
}

const checkExtension = (file: File | null | undefined, extension: string): boolean =>{
    if(file){
        const ext = file.name.split('.').pop();
        if(ext?.toLowerCase() === extension.replace('.','').toLowerCase()){
            return true;
        }
    }
    return false;
}

const ReadFromLocalStorageBase64 = (storageName: string): ArrayBuffer =>{
        const base64 = localStorage.getItem(storageName);
        const base64Parts = base64?.split(',');
        const Content = base64Parts !== undefined ? base64Parts[1] : null;
        if(Content){
            const binary_string = window.atob(Content);
            const bytes = new Uint8Array(binary_string.length);
            for(let x = 0; x < binary_string.length; x++){
                bytes[x] = binary_string.charCodeAt(x);
            }
            return bytes.buffer;
        }
        return new ArrayBuffer(1);
}

const SaveAsBase64 = (element: unknown, storageName: string, json: boolean): Promise<boolean> => {
        if(json){
            return new Promise(resolve =>{
                localStorage.setItem(storageName, JSON.stringify(element));
                resolve(true);
            })
        } else {
            return new Promise(resolve =>{
                const file = element as Blob
                const reader = new FileReader()
                reader.onload = function(base64: ProgressEvent<FileReader>) {
                    if(typeof base64.target?.result == 'string')
                        localStorage.setItem(storageName, base64.target?.result);
                    resolve(true);
                }
                reader.readAsDataURL(file);
            })
    }
}

export {CreateEmptyArray as CreateMidiNoteEventsArray};
export {getEmptyNoteEvent};
export {checkExtension};
export {ReadFromLocalStorageBase64, SaveAsBase64}
