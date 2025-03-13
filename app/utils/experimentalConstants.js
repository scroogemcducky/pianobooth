export const black_color = "rgb(90, 20, 45)"
// export const white_color = "rgb(230, 70, 90)"
export const white_color = "rgb(240, 19, 71)"
const offset = 7*2.55

export const white_width = 2.55
export const black_width = 1.8 


const sharp_offset = white_width/2


export const factor = 1
export const speed = 1
export const keysOffset = 0
const position = -0.116 // default position of C key Blender 

export const note_positions = {
  "24": [ -3 * offset + position, 0, 0],                                      // C
  "25": [ -3 * offset + position + sharp_offset, 0, 0],                     // C Sharp
  "26": [ -3 * offset + position + white_width, 0, 0],                        // D
  "27": [ -3 * offset + position + white_width + sharp_offset, 0, 0],       // D Sharp
  "28": [ -3 * offset + position + 2 * white_width, 0, 0],                    // E
  "29": [ -3 * offset + position + 3 * white_width, 0, 0],                    // F
  "30": [ -3 * offset + position + 3 * white_width + sharp_offset, 0, 0],   // F Sharp
  "31": [ -3 * offset + position + 4 * white_width, 0, 0],                    // G
  "32": [ -3 * offset + position + 4 * white_width + sharp_offset, 0, 0],   // G Sharp
  "33": [ -3 * offset + position + 5 * white_width, 0, 0],                    // A
  "34": [ -3 * offset + position + 5 * white_width + sharp_offset, 0, 0],   // A Sharp
  "35": [ -3 * offset + position + 6 * white_width, 0, 0],                    // B

  "36": [ -2 * offset + position, 0, 0],                                      // C
  "37": [ -2 * offset + position + sharp_offset, 0, 0],                     // C Sharp
  "38": [ -2 * offset + position + white_width, 0, 0],                        // D
  "39": [ -2 * offset + position + white_width + sharp_offset, 0, 0],       // D Sharp
  "40": [ -2 * offset + position + 2 * white_width, 0, 0],                    // E
  "41": [ -2 * offset + position + 3 * white_width, 0, 0],                    // F
  "42": [ -2 * offset + position + 3 * white_width + sharp_offset, 0, 0],   // F Sharp
  "43": [ -2 * offset + position + 4 * white_width, 0, 0],                    // G
  "44": [ -2 * offset + position + 4 * white_width + sharp_offset, 0, 0],   // G Sharp
  "45": [ -2 * offset + position + 5 * white_width, 0, 0],                    // A
  "46": [ -2 * offset + position + 5 * white_width + sharp_offset, 0, 0],   // A Sharp
  "47": [ -2 * offset + position + 6 * white_width, 0, 0],                    // B 

  "48": [ -offset + position, 0, 0],                                    // C
  "49": [ -offset + position + sharp_offset, 0, 0],                   // C Sharp
  "50": [ -offset + position + white_width, 0, 0],                      // D
  "51": [ -offset + position + white_width + sharp_offset, 0, 0],     // D Sharp
  "52": [ -offset + position + 2 * white_width, 0, 0],                  // E
  "53": [ -offset + position + 3 * white_width, 0, 0],                  // F
  "54": [ -offset + position + 3 * white_width + sharp_offset, 0, 0], // F Sharp
  "55": [ -offset + position + 4 * white_width, 0, 0],                  // G
  "56": [ -offset + position + 4 * white_width + sharp_offset, 0, 0], // G Sharp
  "57": [ -offset + position + 5 * white_width, 0, 0],                  // A
  "58": [ -offset + position + 5 * white_width + sharp_offset, 0, 0], // A Sharp
  "59": [ -offset + position + 6 * white_width, 0, 0],                  // B

  "60": [ position, 0, 0],                                              // C
  "61": [ position + sharp_offset, 0, 0],                             // C Sharp
  "62": [ position + white_width, 0, 0],                                // D
  "63": [ position + white_width + sharp_offset, 0, 0],               // D Sharp
  "64": [ position + 2 * white_width, 0, 0],                            // E
  "65": [ position + 3 * white_width, 0, 0],                            // F
  "66": [ position + 3 * white_width + sharp_offset, 0, 0],           // F Sharp
  "67": [ position + 4 * white_width, 0, 0],                            // G
  "68": [ position + 4 * white_width + sharp_offset, 0, 0],           // G Sharp
  "69": [ position + 5 * white_width, 0, 0],                            // A
  "70": [ position + 5 * white_width + sharp_offset, 0, 0],           // A Sharp
  "71": [ position + 6 * white_width, 0, 0],                            // B

  "72": [ offset + position, 0, 0],                                    // C
  "73": [ offset + position + sharp_offset, 0, 0],                   // C Sharp
  "74": [ offset + position + white_width, 0, 0],                      // D
  "75": [ offset + position + white_width + sharp_offset, 0, 0],     // D Sharp
  "76": [ offset + position + 2 * white_width, 0, 0],                  // E
  "77": [ offset + position + 3 * white_width, 0, 0],                  // F
  "78": [ offset + position + 3 * white_width + sharp_offset, 0, 0], // F Sharp
  "79": [ offset + position + 4 * white_width, 0, 0],                  // G
  "80": [ offset + position + 4 * white_width + sharp_offset, 0, 0], // G Sharp
  "81": [ offset + position + 5 * white_width, 0, 0],                  // A
  "82": [ offset + position + 5 * white_width + sharp_offset, 0, 0], // A Sharp
  "83": [ offset + position + 6 * white_width, 0, 0],                  // B

  "84": [ 2 * offset + position, 0, 0],                                    // C
  "85": [ 2 * offset + position + sharp_offset, 0, 0],                   // C Sharp
  "86": [ 2 * offset + position + white_width, 0, 0],                      // D
  "87": [ 2 * offset + position + white_width + sharp_offset, 0, 0],     // D Sharp
  "88": [ 2 * offset + position + 2 * white_width, 0, 0],                  // E
  "89": [ 2 * offset + position + 3 * white_width, 0, 0],                  // F
  "90": [ 2 * offset + position + 3 * white_width + sharp_offset, 0, 0], // F Sharp
  "91": [ 2 * offset + position + 4 * white_width, 0, 0],                  // G
  "92": [ 2 * offset + position + 4 * white_width + sharp_offset, 0, 0], // G Sharp
  "93": [ 2 * offset + position + 5 * white_width, 0, 0],                  // A
  "94": [ 2 * offset + position + 5 * white_width + sharp_offset, 0, 0], // A Sharp
  "95": [ 2 * offset + position + 6 * white_width, 0, 0],                  // B

  "96":  [ 3 * offset + position, 0, 0],                                    // C
  "97":  [ 3 * offset + position + sharp_offset, 0, 0],                   // C Sharp
  "98":  [ 3 * offset + position + white_width, 0, 0],                      // D
  "99":  [ 3 * offset + position + white_width + sharp_offset, 0, 0],     // D Sharp
  "100": [ 3 * offset + position + 2 * white_width, 0, 0],                  // E
  "101": [ 3 * offset + position + 3 * white_width, 0, 0],                  // F
  "102": [ 3 * offset + position + 3 * white_width + sharp_offset, 0, 0], // F Sharp
  "103": [ 3 * offset + position + 4 * white_width, 0, 0],                  // G
  "104": [ 3 * offset + position + 4 * white_width + sharp_offset, 0, 0], // G Sharp
  "105": [ 3 * offset + position + 5 * white_width, 0, 0],                  // A
  "106": [ 3 * offset + position + 5 * white_width + sharp_offset, 0, 0], // A Sharp
  "107": [ 3 * offset + position + 6 * white_width, 0, 0],                  // B
}


// export const note_positions = {
//   "24": [position - 3 * offset-white_width, 0, 0],                        // C                 
//   "25": [position - 3 * offset+sharp_offset, 0, 0],                     // C_Sharp      
//   "26": [position - 3*offset, 0, 0],                                      // D
//   "27": [position - 3*offset + sharp_offset, 0, 0],                     // D_Sharp
//   "28": [position - 3*offset + white_width, 0, 0],                        // E
//   "29": [position - 3*offset + 2 * white_width, 0, 0],                    // F  
//   "30": [position - 3*offset + 2 * white_width + sharp_offset, 0, 0],   // F_Sharp 
//   "31": [position - 3*offset + 3 * white_width, 0, 0],                    // G
//   "32": [position - 3*offset + 3 * white_width + sharp_offset, 0, 0],   // G_Sharp 
//   "33": [position - 3*offset + 4 * white_width, 0, 0],                    // A 
//   "34": [position - 3*offset + 4 * white_width + sharp_offset, 0, 0],   // A_Sharp
//   "35": [position - 3*offset + 5 * white_width, 0, 0],                    // B

//   "36": [ position - 2*offset-white_width, 0, 0],
//   "37": [ position - 2*offset + sharp_offset, 0, 0], 
//   "38": [ position - 2*offset, 0, 0],  
//   "39": [ position - 2*offset + sharp_offset, 0, 0],  
//   "40": [ position - 2*offset + white_width, 0, 0], 
//   "41": [ position - 2*offset + 2 * white_width, 0, 0], 
//   "42": [ position - 2*offset + 2 * white_width + sharp_offset, 0, 0],
//   "43": [ position - 2*offset + 3 * white_width, 0, 0],
//   "44": [ position - 2*offset + 3 * white_width + sharp_offset, 0, 0],
//   "45": [ position - 2*offset + 4 * white_width, 0, 0],    
//   "46": [ position - 2*offset + 4 * white_width + sharp_offset, 0, 0],
//   "47": [ position - 2*offset + 5 * white_width, 0, 0],  

//   "48": [ position - 1*offset-white_width, 0, 0],
//   "49": [ position - 1*offset + sharp_offset, 0, 0], 
//   "50": [ position - 1*offset, 0, 0],  
//   "51": [ position - 1*offset + sharp_offset, 0, 0],  
//   "52": [ position - 1*offset + white_width, 0, 0], 
//   "53": [ position - 1*offset + 2 * white_width, 0, 0], 
//   "54": [ position - 1*offset + 2 * white_width + sharp_offset, 0, 0],
//   "55": [ position - 1*offset + 3 * white_width, 0, 0],
//   "56": [ position - 1*offset + 3 * white_width + sharp_offset, 0, 0],
//   "57": [ position - 1*offset + 4 * white_width, 0, 0],    
//   "58": [ position - 1*offset + 4 * white_width + sharp_offset, 0, 0],
//   "59": [ position - 1*offset + 5 * white_width, 0, 0],  

//   "60": [ position - 0*offset-white_width, 0, 0],
//   "61": [ position - 0*offset + sharp_offset, 0, 0], 
//   "62": [ position - 0*offset, 0, 0],  
//   "63": [ position - 0*offset + sharp_offset, 0, 0],  
//   "64": [ position - 0*offset + white_width, 0, 0], 
//   "65": [ position - 0*offset + 2 * white_width, 0, 0], 
//   "66": [ position - 0*offset + 2 * white_width + sharp_offset, 0, 0],
//   "67": [ position - 0*offset + 3 * white_width, 0, 0],
//   "68": [ position - 0*offset + 3 * white_width + sharp_offset, 0, 0],
//   "69": [ position - 0*offset + 4 * white_width, 0, 0],    
//   "70": [ position - 0*offset + 4 * white_width + sharp_offset, 0, 0],
//   "71": [ position - 0*offset + 5 * white_width, 0, 0], 

//   "72": [position + 1*offset-white_width, 0, 0],
//   "73": [position + 1*offset + sharp_offset, 0, 0], 
//   "74": [position + 1*offset, 0, 0],  
//   "75": [position + 1*offset + sharp_offset, 0, 0],  
//   "76": [position + 1*offset + white_width, 0, 0], 
//   "77": [position + 1*offset + 2 * white_width, 0, 0], 
//   "78": [position + 1*offset + 2 * white_width + sharp_offset, 0, 0],
//   "79": [position + 1*offset + 3 * white_width, 0, 0],
//   "80": [position + 1*offset + 3 * white_width + sharp_offset, 0, 0],
//   "81": [position + 1*offset + 4 * white_width, 0, 0],    
//   "82": [position + 1*offset + 4 * white_width + sharp_offset, 0, 0],
//   "83": [position + 1*offset + 5 * white_width, 0, 0],
  
//   "84": [ position + 2*offset-white_width, 0, 0],
//   "85": [ position + 2*offset + sharp_offset, 0, 0], 
//   "86": [ position + 2*offset, 0, 0],  
//   "87": [ position + 2*offset + sharp_offset, 0, 0],  
//   "88": [ position + 2*offset + white_width, 0, 0], 
//   "89": [ position + 2*offset + 2 * white_width, 0, 0], 
//   "90": [ position + 2*offset + 2 * white_width + sharp_offset, 0, 0],
//   "91": [ position + 2*offset + 3 * white_width, 0, 0],
//   "92": [ position + 2*offset + 3 * white_width + sharp_offset, 0, 0],
//   "93": [ position + 2*offset + 4 * white_width, 0, 0],    
//   "94": [ position + 2*offset + 4 * white_width + sharp_offset, 0, 0],
//   "95": [ position + 2*offset + 5 * white_width, 0, 0], 

//   "96": [0.006 + 3*offset-white_width, 0, 0],
//   "97": [0.006 + 3*offset + sharp_offset, 0, 0], 
//   "98": [0.006 + 3*offset, 0, 0],  
//   "99": [0.006 + 3*offset + sharp_offset, 0, 0],  
//   "100": [position + 3*offset + white_width, 0, 0], 
//   "101": [position + 3*offset + 2 * white_width, 0, 0], 
//   "102": [position + 3*offset + 2 * white_width + sharp_offset, 0, 0],
//   "103": [position + 3*offset + 3 * white_width, 0, 0],
//   "104": [position + 3*offset + 3 * white_width + sharp_offset, 0, 0],
//   "105": [position + 3*offset + 4 * white_width, 0, 0],    
//   "106": [position + 3*offset + 4 * white_width + sharp_offset],
//   "107": [position + 3*offset + 5 * white_width, 0, 0], 
// }


export const white_size_vector = {y: 15.367410659790039, x: 2.268760919570923, z: 2.4666976928710938}
export const black_size_vector = {y: 10.125563621520996, x: 1.9746508598327637, z: 1.9570356607437134}
  


// export const positions = {
//     "24": [ 0-3*offset, 0, 0 ],
//     "25": [ 1.703-3*offset, 0, 0 ],
//     "26": [ position-3*offset, 0, 0 ],
//     "27": [ 4.325-3*offset, 0, 0 ],
//     "28": [ 5.5920-3*offset, 0, 0 ],
//     "29": [ 7.666-3*offset, 0, 0 ],
//     "30": [ 9.386-3*offset, 0, 0 ],
//     "31": [ 10.65-3*offset, 0, 0 ],
//     "32": [ 11.915-3*offset, 0, 0 ],
//     "33": [ 13.182-3*offset, 0, 0 ],
//     "34": [ 14.449-3*offset, 0, 0 ],
//     "35": [ 15.754-3*offset, 0, 0 ],
  
//     "36":  [ 0-2*offset, 0, 0 ],
//     "37": [ 1.703-2*offset, 0, 0 ],
//     "38": [ position-2*offset, 0, 0 ],
//     "39": [ 4.325-2*offset, 0, 0 ],
//     "40": [ 5.5920-2*offset, 0, 0 ],
//     "41": [ 7.666-2*offset, 0, 0 ],
//     "42": [ 9.386-2*offset, 0, 0 ],
//     "43": [ 10.65-2*offset, 0, 0 ],
//     "44": [ 11.915-2*offset, 0, 0 ],
//     "45": [ 13.182-2*offset, 0, 0 ],
//     "46": [ 14.449-2*offset, 0, 0 ],
//     "47": [ 15.754-2*offset, 0, 0 ],
  
//     "48":  [ 0-offset, 0, 0 ],
//     "49": [ 1.703-offset, 0, 0 ],
//     "50": [0, 0.556, position-1*offset],
//     "51": [0, -0.052, 4.325-1*offset],
//     "52": [0, 0.568, 5.5920-1*offset],
//     "53": [0, 0.556, 7.666-1*offset],
//     "54": [0, -0.052, 9.386-1*offset],
//     "55": [0, 0.568, 10.65-1*offset],
//     "56": [0, -0.052, 11.915-1*offset],
//     "57": [0, 0.56, 13.182-1*offset],
//     "58": [0, -0.052, 14.449-1*offset],
//     "59":  [0, 0.56, 15.754-1*offset],
  
//     "60": [-0.116, 8.147, -1.695],
//     "61": [1.133, 8.094, 1.922],
//     "62": [2.434, 8.152, -1.683],
//     "63": [3.755, 8.094, 1.922],
//     "64": [4.984, 8.152, -1.683],
//     "65": [7.534, 8.152, -1.683],
//     "66": [8.816, 8.094, 1.922],
//     "67": [10.084, 8.15, -1.692],
//     "68": [11.345, 8.094, 1.922],
//     "69": [12.634, 8.152, -1.683],
//     "70": [13.879, 8.094, 1.922],
//     "71":  [15.184, 8.152, -1.683],
  
//     "72": [0, 0.556, 0+offset],
//     "73": [0, -0.052, 1.703+offset],
//     "74": [0, 0.556, position+offset],
//     "75": [0, -0.052, 4.325+offset],
//     "76": [0, 0.568, 5.5920+offset],
//     "77": [0, 0.556, 7.666+offset],
//     "78": [0, -0.052, 9.386+offset],
//     "79": [0, 0.568, 10.65+offset],
//     "80": [0, -0.052, 11.915+offset],
//     "81": [0, 0.56, 13.182+offset],
//     "82": [0, -0.052, 14.449+offset],
//     "83":  [0, 0.56, 15.754+offset],
  
//     "84": [0, 0.556, 0+2*offset],
//     "85": [0, -0.052, 1.703+2*offset],
//     "86": [0, 0.556, position+2*offset],
//     "87": [0, -0.052, 4.325+2*offset],
//     "88": [0, 0.568, 5.5920+2*offset],
//     "89": [0, 0.556, 7.666+2*offset],
//     "90": [0, -0.052, 9.386+2*offset],
//     "91": [0, 0.568, 10.65+2*offset],
//     "92": [0, -0.052, 11.915+2*offset],
//     "93": [0, 0.56, 13.182+2*offset],
//     "94": [0, -0.052, 14.449+2*offset],
//     "95":  [0, 0.56, 15.754+2*offset],
  
//     "96": [0, 0.556, 0+3*offset],
//     "97": [0, -0.052, 1.703+3*offset],
//     "98": [0, 0.556, position+3*offset],
//     "99": [0, -0.052, 4.325+3*offset],
//     "100": [0, 0.568, 5.5920+3*offset],
//     "101": [0, 0.556, 7.666+3*offset],
//     "102": [0, -0.052, 9.386+3*offset],
//     "103": [0, 0.568, 10.65+3*offset],
//     "104": [0, -0.052, 11.915+3*offset],
//     "105": [0, 0.56, 13.182+3*offset],
//     "106": [0, -0.052, 14.449+3*offset],
//     "107":  [0, 0.56, 15.754+3*offset]
//   }




// export const positions = {
//     "24": [ 0-3*offset, 0, 0 ],
//     "25": [ 1.703-3*offset, 0, 0 ],
//     "26": [ position-3*offset, 0, 0 ],
//     "27": [ 4.325-3*offset, 0, 0 ],
//     "28": [ 5.5920-3*offset, 0, 0 ],
//     "29": [ 7.666-3*offset, 0, 0 ],
//     "30": [ 9.386-3*offset, 0, 0 ],
//     "31": [ 10.65-3*offset, 0, 0 ],
//     "32": [ 11.915-3*offset, 0, 0 ],
//     "33": [ 13.182-3*offset, 0, 0 ],
//     "34": [ 14.449-3*offset, 0, 0 ],
//     "35": [ 15.754-3*offset, 0, 0 ],
  
//     "36": [0, 0.556, 0 -2*offset],
//     "37": [0, -0.052, 1.703 -2*offset],
//     "38": [0, 0.556, position -2*offset],
//     "39": [0, -0.052, 4.325 -2*offset],
//     "40": [0, 0.568, 5.5920 -2*offset],
//     "41": [0, 0.556, 7.666 -2*offset],
//     "42": [0, -0.052, 9.386 -2*offset],
//     "43": [0, 0.568, 10.65 -2*offset],
//     "44": [0, -0.052, 11.915 -2*offset],
//     "45": [0, 0.56, 13.182 -2*offset],
//     "46": [0, -0.052, 14.449 -2*offset],
//     "47":  [0, 0.56, 15.754 -2*offset],
  
//     "48":[0, 0.556, 0-1*offset] ,
//     "49": [0, -0.052, 1.703-1*offset],
//     "50": [0, 0.556, position-1*offset],
//     "51": [0, -0.052, 4.325-1*offset],
//     "52": [0, 0.568, 5.5920-1*offset],
//     "53": [0, 0.556, 7.666-1*offset],
//     "54": [0, -0.052, 9.386-1*offset],
//     "55": [0, 0.568, 10.65-1*offset],
//     "56": [0, -0.052, 11.915-1*offset],
//     "57": [0, 0.56, 13.182-1*offset],
//     "58": [0, -0.052, 14.449-1*offset],
//     "59":  [0, 0.56, 15.754-1*offset],
  
//     "60": [-0.116, 8.147, -1.695],
//     "61": [1.133, 8.094, 1.922],
//     "62": [2.434, 8.152, -1.683],
//     "63": [3.755, 8.094, 1.922],
//     "64": [4.984, 8.152, -1.683],
//     "65": [7.534, 8.152, -1.683],
//     "66": [8.816, 8.094, 1.922],
//     "67": [10.084, 8.15, -1.692],
//     "68": [11.345, 8.094, 1.922],
//     "69": [12.634, 8.152, -1.683],
//     "70": [13.879, 8.094, 1.922],
//     "71":  [15.184, 8.152, -1.683],
  
//     "72": [0, 0.556, 0+offset],
//     "73": [0, -0.052, 1.703+offset],
//     "74": [0, 0.556, position+offset],
//     "75": [0, -0.052, 4.325+offset],
//     "76": [0, 0.568, 5.5920+offset],
//     "77": [0, 0.556, 7.666+offset],
//     "78": [0, -0.052, 9.386+offset],
//     "79": [0, 0.568, 10.65+offset],
//     "80": [0, -0.052, 11.915+offset],
//     "81": [0, 0.56, 13.182+offset],
//     "82": [0, -0.052, 14.449+offset],
//     "83":  [0, 0.56, 15.754+offset],
  
//     "84": [0, 0.556, 0+2*offset],
//     "85": [0, -0.052, 1.703+2*offset],
//     "86": [0, 0.556, position+2*offset],
//     "87": [0, -0.052, 4.325+2*offset],
//     "88": [0, 0.568, 5.5920+2*offset],
//     "89": [0, 0.556, 7.666+2*offset],
//     "90": [0, -0.052, 9.386+2*offset],
//     "91": [0, 0.568, 10.65+2*offset],
//     "92": [0, -0.052, 11.915+2*offset],
//     "93": [0, 0.56, 13.182+2*offset],
//     "94": [0, -0.052, 14.449+2*offset],
//     "95":  [0, 0.56, 15.754+2*offset],
  
//     "96": [0, 0.556, 0+3*offset],
//     "97": [0, -0.052, 1.703+3*offset],
//     "98": [0, 0.556, position+3*offset],
//     "99": [0, -0.052, 4.325+3*offset],
//     "100": [0, 0.568, 5.5920+3*offset],
//     "101": [0, 0.556, 7.666+3*offset],
//     "102": [0, -0.052, 9.386+3*offset],
//     "103": [0, 0.568, 10.65+3*offset],
//     "104": [0, -0.052, 11.915+3*offset],
//     "105": [0, 0.56, 13.182+3*offset],
//     "106": [0, -0.052, 14.449+3*offset],
//     "107":  [0, 0.56, 15.754+3*offset]
//   }