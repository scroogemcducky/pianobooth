export const black_color = "rgb(90, 20, 45)"
// export const white_color = "rgb(230, 70, 90)"
export const white_color = "rgb(240, 19, 71)"
const offset = 7*2.55

export const white_width = 2.55
export const black_width = 1.8 

const C_Sharp_offset = - white_width/2
const D_Sharp_offset = white_width/2
const F_Sharp_offset = white_width/2
const G_Sharp_offset = white_width/2
const A_Sharp_offset = white_width/2

export const factor = 1
export const speed = 1
export const keysOffset = 0

export const note_positions = {
  "24": [3.006 - 3 * offset-white_width, 0, 0],                        // C                 
  "25": [3.006 - 3 * offset+C_Sharp_offset, 0, 0],                     // C_Sharp      
  "26": [3.006 - 3*offset, 0, 0],                                      // D
  "27": [3.006 - 3*offset + D_Sharp_offset, 0, 0],                     // D_Sharp
  "28": [3.006 - 3*offset + white_width, 0, 0],                        // E
  "29": [3.006 - 3*offset + 2 * white_width, 0, 0],                    // F  
  "30": [3.006 - 3*offset + 2 * white_width + F_Sharp_offset, 0, 0],   // F_Sharp 
  "31": [3.006 - 3*offset + 3 * white_width, 0, 0],                    // G
  "32": [3.006 - 3*offset + 3 * white_width + G_Sharp_offset, 0, 0],   // G_Sharp 
  "33": [3.006 - 3*offset + 4 * white_width, 0, 0],                    // A 
  "34": [3.006 - 3*offset + 4 * white_width + A_Sharp_offset, 0, 0],   // A_Sharp
  "35": [3.006 - 3*offset + 5 * white_width, 0, 0],                    // B

  "36": [ 3.006 - 2*offset-white_width, 0, 0],
  "37": [ 3.006 - 2*offset + C_Sharp_offset, 0, 0], 
  "38": [ 3.006 - 2*offset, 0, 0],  
  "39": [ 3.006 - 2*offset + D_Sharp_offset, 0, 0],  
  "40": [ 3.006 - 2*offset + white_width, 0, 0], 
  "41": [ 3.006 - 2*offset + 2 * white_width, 0, 0], 
  "42": [ 3.006 - 2*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "43": [ 3.006 - 2*offset + 3 * white_width, 0, 0],
  "44": [ 3.006 - 2*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "45": [ 3.006 - 2*offset + 4 * white_width, 0, 0],    
  "46": [ 3.006 - 2*offset + 4 * white_width + A_Sharp_offset, 0, 0],
  "47": [ 3.006 - 2*offset + 5 * white_width, 0, 0],  

  "48": [ 3.006 - 1*offset-white_width, 0, 0],
  "49": [ 3.006 - 1*offset + C_Sharp_offset, 0, 0], 
  "50": [ 3.006 - 1*offset, 0, 0],  
  "51": [ 3.006 - 1*offset + D_Sharp_offset, 0, 0],  
  "52": [ 3.006 - 1*offset + white_width, 0, 0], 
  "53": [ 3.006 - 1*offset + 2 * white_width, 0, 0], 
  "54": [ 3.006 - 1*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "55": [ 3.006 - 1*offset + 3 * white_width, 0, 0],
  "56": [ 3.006 - 1*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "57": [ 3.006 - 1*offset + 4 * white_width, 0, 0],    
  "58": [ 3.006 - 1*offset + 4 * white_width + A_Sharp_offset, 0, 0],
  "59": [ 3.006 - 1*offset + 5 * white_width, 0, 0],  

  "60": [ 3.006 - 0*offset-white_width, 0, 0],
  "61": [ 3.006 - 0*offset + C_Sharp_offset, 0, 0], 
  "62": [ 3.006 - 0*offset, 0, 0],  
  "63": [ 3.006 - 0*offset + D_Sharp_offset, 0, 0],  
  "64": [ 3.006 - 0*offset + white_width, 0, 0], 
  "65": [ 3.006 - 0*offset + 2 * white_width, 0, 0], 
  "66": [ 3.006 - 0*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "67": [ 3.006 - 0*offset + 3 * white_width, 0, 0],
  "68": [ 3.006 - 0*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "69": [ 3.006 - 0*offset + 4 * white_width, 0, 0],    
  "70": [ 3.006 - 0*offset + 4 * white_width + A_Sharp_offset, 0, 0],
  "71": [ 3.006 - 0*offset + 5 * white_width, 0, 0], 

  "72": [3.006 + 1*offset-white_width, 0, 0],
  "73": [3.006 + 1*offset + C_Sharp_offset, 0, 0], 
  "74": [3.006 + 1*offset, 0, 0],  
  "75": [3.006 + 1*offset + D_Sharp_offset, 0, 0],  
  "76": [3.006 + 1*offset + white_width, 0, 0], 
  "77": [3.006 + 1*offset + 2 * white_width, 0, 0], 
  "78": [3.006 + 1*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "79": [3.006 + 1*offset + 3 * white_width, 0, 0],
  "80": [3.006 + 1*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "81": [3.006 + 1*offset + 4 * white_width, 0, 0],    
  "82": [3.006 + 1*offset + 4 * white_width + A_Sharp_offset, 0, 0],
  "83": [3.006 + 1*offset + 5 * white_width, 0, 0],
  
  "84": [ 3.006 + 2*offset-white_width, 0, 0],
  "85": [ 3.006 + 2*offset + C_Sharp_offset, 0, 0], 
  "86": [ 3.006 + 2*offset, 0, 0],  
  "87": [ 3.006 + 2*offset + D_Sharp_offset, 0, 0],  
  "88": [ 3.006 + 2*offset + white_width, 0, 0], 
  "89": [ 3.006 + 2*offset + 2 * white_width, 0, 0], 
  "90": [ 3.006 + 2*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "91": [ 3.006 + 2*offset + 3 * white_width, 0, 0],
  "92": [ 3.006 + 2*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "93": [ 3.006 + 2*offset + 4 * white_width, 0, 0],    
  "94": [ 3.006 + 2*offset + 4 * white_width + A_Sharp_offset, 0, 0],
  "95": [ 3.006 + 2*offset + 5 * white_width, 0, 0], 

  "96": [0.006 + 3*offset-white_width, 0, 0],
  "97": [0.006 + 3*offset + C_Sharp_offset, 0, 0], 
  "98": [0.006 + 3*offset, 0, 0],  
  "99": [0.006 + 3*offset + D_Sharp_offset, 0, 0],  
  "100": [3.006 + 3*offset + white_width, 0, 0], 
  "101": [3.006 + 3*offset + 2 * white_width, 0, 0], 
  "102": [3.006 + 3*offset + 2 * white_width + F_Sharp_offset, 0, 0],
  "103": [3.006 + 3*offset + 3 * white_width, 0, 0],
  "104": [3.006 + 3*offset + 3 * white_width + G_Sharp_offset, 0, 0],
  "105": [3.006 + 3*offset + 4 * white_width, 0, 0],    
  "106": [3.006 + 3*offset + 4 * white_width + A_Sharp_offset],
  "107": [3.006 + 3*offset + 5 * white_width, 0, 0], 
}


export const white_size_vector = {y: 15.367410659790039, x: 2.268760919570923, z: 2.4666976928710938}
export const black_size_vector = {y: 10.125563621520996, x: 1.9746508598327637, z: 1.9570356607437134}
  


// export const positions = {
//     "24": [ 0-3*offset, 0, 0 ],
//     "25": [ 1.703-3*offset, 0, 0 ],
//     "26": [ 3.006-3*offset, 0, 0 ],
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
//     "38": [ 3.006-2*offset, 0, 0 ],
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
//     "50": [0, 0.556, 3.006-1*offset],
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
//     "74": [0, 0.556, 3.006+offset],
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
//     "86": [0, 0.556, 3.006+2*offset],
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
//     "98": [0, 0.556, 3.006+3*offset],
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
//     "26": [ 3.006-3*offset, 0, 0 ],
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
//     "38": [0, 0.556, 3.006 -2*offset],
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
//     "50": [0, 0.556, 3.006-1*offset],
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
//     "74": [0, 0.556, 3.006+offset],
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
//     "86": [0, 0.556, 3.006+2*offset],
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
//     "98": [0, 0.556, 3.006+3*offset],
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