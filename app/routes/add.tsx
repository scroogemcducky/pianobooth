// import { useState } from 'react';
// import { validateMidiFile } from './_index';

// interface SongRow {
//   id: string;
//   artist: string;
//   song: string;
//   data: string;
// }

// const SaveAsBase64 = (file: File): Promise<{ data: string; type: string }> => {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = function(event) {
//       if (typeof event.target?.result === 'string') {
//         resolve({
//           data: event.target.result,
//           type: file.type
//         });
//       } else {
//         reject(new Error('Failed to convert file to base64'));
//       }
//     };
//     reader.onerror = function(error) {
//       reject(error);
//     };
//     reader.readAsDataURL(file);
//   });
// };

// export default function Editor() {
//   const [rows, setRows] = useState<SongRow[]>([
//     { id: '1', artist: '', song: '', data: '' }
//   ]);

//   const handleArtistChange = (id: string, value: string) => {
//     setRows(rows.map(row => 
//       row.id === id ? { ...row, artist: value } : row
//     ));
//   };

//   const handleSongChange = (id: string, value: string) => {
//     setRows(rows.map(row => 
//       row.id === id ? { ...row, song: value } : row
//     ));
//   };

//   const handleFileChange = async (id: string, file: File) => {
//     const { isValid, error } = validateMidiFile(file);
    
//     if (!isValid) {
//       alert(error || 'Invalid MIDI file');
//       return;
//     }

//     try {
//       const result = await SaveAsBase64(file);
//       setRows(rows.map(row =>
//         row.id === id ? { ...row, data: result.data } : row
//       ));
//     } catch (error) {
//       alert('Error processing the MIDI file. Please try again.');
//     }
//   };

//   const addRow = () => {
//     setRows([...rows, {
//       id: String(rows.length + 1),
//       artist: '',
//       song: '',
//       data: ''
//     }]);
//   };

//   const downloadCSV = () => {
//     const csvContent = [
//       ['Artist', 'Song', 'Data'],
//       ...rows.map(row => [row.artist, row.song, row.data])
//     ].map(row => row.join('\t')).join('\n');

//     const blob = new Blob([csvContent], { type: 'text/csv' });
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = 'song_data.csv';
//     a.click();
//     window.URL.revokeObjectURL(url);
//   };

//   return (
//     <div className="p-4">
//       <h1 className="text-2xl font-bold mb-4">MIDI Data Editor</h1>
      
//       <div className="space-y-4">
//         {rows.map(row => (
//           <div key={row.id} className="flex gap-4 items-center">
//             <input
//               type="text"
//               value={row.artist}
//               onChange={(e) => handleArtistChange(row.id, e.target.value)}
//               placeholder="Artist"
//               className="border p-2 rounded"
//             />
//             <input
//               type="text"
//               value={row.song}
//               onChange={(e) => handleSongChange(row.id, e.target.value)}
//               placeholder="Song"
//               className="border p-2 rounded"
//             />
//             <div className="relative">
//               <input
//                 type="file"
//                 accept=".midi,.mid,.kar"
//                 onChange={(e) => {
//                   const file = e.target.files?.[0];
//                   if (file) handleFileChange(row.id, file);
//                 }}
//                 className="border p-2 rounded"
//               />
//             </div>
//             <div className="w-32 truncate">
//               {row.data ? '✓ Data loaded' : 'No data'}
//             </div>
//           </div>
//         ))}
//       </div>

//       <div className="mt-4 space-x-4">
//         <button
//           onClick={addRow}
//           className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
//         >
//           Add Row
//         </button>
//         <button
//           onClick={downloadCSV}
//           className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
//         >
//           Download CSV
//         </button>
//       </div>
//     </div>
//   );
// }
