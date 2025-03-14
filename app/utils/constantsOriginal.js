// export const black_color = "rgb(90, 20, 45)"
// // export const white_color = "rgb(230, 70, 90)"
// export const white_color = "rgb(240, 19, 71)"
// const offset = 7*2.55

// export const white_width = 2.55
// export const black_width = 1.8 

// const C_Sharp_offset = - white_width/2
// const D_Sharp_offset = white_width/2
// const F_Sharp_offset = white_width/2
// const G_Sharp_offset = white_width/2
// const A_Sharp_offset = white_width/2

// export const factor = 4
// export const speed = 0.75

// export const note_positions = {
//   "24": [0, 0, 3.006 - 3 * offset-white_width],                        // C                 
//   "25": [0, 0, 3.006 - 3 * offset+C_Sharp_offset],                     // C_Sharp      
//   "26": [0, 0, 3.006 - 3*offset],                                      // D
//   "27": [0, 0, 3.006 - 3*offset + D_Sharp_offset],                     // D_Sharp
//   "28": [0, 0, 3.006 - 3*offset + white_width],                        // E
//   "29": [0, 0, 3.006 - 3*offset + 2 * white_width],                    // F  
//   "30": [0, 0, 3.006 - 3*offset + 2 * white_width + F_Sharp_offset],   // F_Sharp 
//   "31": [0, 0, 3.006 - 3*offset + 3 * white_width],                    // G
//   "32": [0, 0, 3.006 - 3*offset + 3 * white_width + G_Sharp_offset],   // G_Sharp 
//   "33": [0, 0, 3.006 - 3*offset + 4 * white_width],                    // A 
//   "34": [0, 0, 3.006 - 3*offset + 4 * white_width + A_Sharp_offset],   // A_Sharp
//   "35": [0, 0, 3.006 - 3*offset + 5 * white_width],                    // B

//   "36": [0, 0, 3.006 - 2*offset-white_width],
//   "37": [0, 0, 3.006 - 2*offset + C_Sharp_offset], 
//   "38": [0, 0, 3.006 - 2*offset],  
//   "39": [0, 0, 3.006 - 2*offset + D_Sharp_offset],  
//   "40": [0, 0, 3.006 - 2*offset + white_width], 
//   "41": [0, 0, 3.006 - 2*offset + 2 * white_width], 
//   "42": [0, 0, 3.006 - 2*offset + 2 * white_width + F_Sharp_offset],
//   "43": [0, 0, 3.006 - 2*offset + 3 * white_width],
//   "44": [0, 0, 3.006 - 2*offset + 3 * white_width + G_Sharp_offset],
//   "45": [0, 0, 3.006 - 2*offset + 4 * white_width],    
//   "46": [0, 0, 3.006 - 2*offset + 4 * white_width + A_Sharp_offset],
//   "47": [0, 0, 3.006 - 2*offset + 5 * white_width],  

//   "48": [0, 0, 3.006 - 1*offset-white_width],
//   "49": [0, 0, 3.006 - 1*offset + C_Sharp_offset], 
//   "50": [0, 0, 3.006 - 1*offset],  
//   "51": [0, 0, 3.006 - 1*offset + D_Sharp_offset],  
//   "52": [0, 0, 3.006 - 1*offset + white_width], 
//   "53": [0, 0, 3.006 - 1*offset + 2 * white_width], 
//   "54": [0, 0, 3.006 - 1*offset + 2 * white_width + F_Sharp_offset],
//   "55": [0, 0, 3.006 - 1*offset + 3 * white_width],
//   "56": [0, 0, 3.006 - 1*offset + 3 * white_width + G_Sharp_offset],
//   "57": [0, 0, 3.006 - 1*offset + 4 * white_width],    
//   "58": [0, 0, 3.006 - 1*offset + 4 * white_width + A_Sharp_offset],
//   "59": [0, 0, 3.006 - 1*offset + 5 * white_width],  

//   "60": [0, 0, 3.006 - 0*offset-white_width],
//   "61": [0, 0, 3.006 - 0*offset + C_Sharp_offset], 
//   "62": [0, 0, 3.006 - 0*offset],  
//   "63": [0, 0, 3.006 - 0*offset + D_Sharp_offset],  
//   "64": [0, 0, 3.006 - 0*offset + white_width], 
//   "65": [0, 0, 3.006 - 0*offset + 2 * white_width], 
//   "66": [0, 0, 3.006 - 0*offset + 2 * white_width + F_Sharp_offset],
//   "67": [0, 0, 3.006 - 0*offset + 3 * white_width],
//   "68": [0, 0, 3.006 - 0*offset + 3 * white_width + G_Sharp_offset],
//   "69": [0, 0, 3.006 - 0*offset + 4 * white_width],    
//   "70": [0, 0, 3.006 - 0*offset + 4 * white_width + A_Sharp_offset],
//   "71": [0, 0, 3.006 - 0*offset + 5 * white_width], 

//   "72": [0, 0, 3.006 + 1*offset-white_width],
//   "73": [0, 0, 3.006 + 1*offset + C_Sharp_offset], 
//   "74": [0, 0, 3.006 + 1*offset],  
//   "75": [0, 0, 3.006 + 1*offset + D_Sharp_offset],  
//   "76": [0, 0, 3.006 + 1*offset + white_width], 
//   "77": [0, 0, 3.006 + 1*offset + 2 * white_width], 
//   "78": [0, 0, 3.006 + 1*offset + 2 * white_width + F_Sharp_offset],
//   "79": [0, 0, 3.006 + 1*offset + 3 * white_width],
//   "80": [0, 0, 3.006 + 1*offset + 3 * white_width + G_Sharp_offset],
//   "81": [0, 0, 3.006 + 1*offset + 4 * white_width],    
//   "82": [0, 0, 3.006 + 1*offset + 4 * white_width + A_Sharp_offset],
//   "83": [0, 0, 3.006 + 1*offset + 5 * white_width],
  
//   "84": [0, 0, 3.006 + 2*offset-white_width],
//   "85": [0, 0, 3.006 + 2*offset + C_Sharp_offset], 
//   "86": [0, 0, 3.006 + 2*offset],  
//   "87": [0, 0, 3.006 + 2*offset + D_Sharp_offset],  
//   "88": [0, 0, 3.006 + 2*offset + white_width], 
//   "89": [0, 0, 3.006 + 2*offset + 2 * white_width], 
//   "90": [0, 0, 3.006 + 2*offset + 2 * white_width + F_Sharp_offset],
//   "91": [0, 0, 3.006 + 2*offset + 3 * white_width],
//   "92": [0, 0, 3.006 + 2*offset + 3 * white_width + G_Sharp_offset],
//   "93": [0, 0, 3.006 + 2*offset + 4 * white_width],    
//   "94": [0, 0, 3.006 + 2*offset + 4 * white_width + A_Sharp_offset],
//   "95": [0, 0, 3.006 + 2*offset + 5 * white_width], 

//   "96": [0, 0, 3.006 + 3*offset-white_width],
//   "97": [0, 0, 3.006 + 3*offset + C_Sharp_offset], 
//   "98": [0, 0, 3.006 + 3*offset],  
//   "99": [0, 0, 3.006 + 3*offset + D_Sharp_offset],  
//   "100": [0, 0, 3.006 + 3*offset + white_width], 
//   "101": [0, 0, 3.006 + 3*offset + 2 * white_width], 
//   "102": [0, 0, 3.006 + 3*offset + 2 * white_width + F_Sharp_offset],
//   "103": [0, 0, 3.006 + 3*offset + 3 * white_width],
//   "104": [0, 0, 3.006 + 3*offset + 3 * white_width + G_Sharp_offset],
//   "105": [0, 0, 3.006 + 3*offset + 4 * white_width],    
//   "106": [0, 0, 3.006 + 3*offset + 4 * white_width + A_Sharp_offset],
//   "107": [0, 0, 3.006 + 3*offset + 5 * white_width], 

// }

// // const C_pos = [0, 0.556, 0]
// // const C_sharp_pos = [0, -0.052, 1.703]
// // const D_pos = [0, 0.556, 3.006]
// // const D_sharp_pos = [0, -0.052, 4.325]
// // const E_pos = [0, 0.568, 5.5920]
// // const F_pos = [0, 0.556, 7.666]
// // const F_sharp_pos = [0, -0.052, 9.386]
// // const G_pos = [0, 0.568, 10.65]
// // const G_sharp_pos = [0, -0.052, 11.915]
// // const A_pos = [0, 0.56, 13.182]
// // const A_sharp_pos = [0, -0.052, 14.449]
// // const B_pos = [0, 0.56, 15.754 ]

// export const white_size_vector = {x: 15.367410659790039, y: 2.268760919570923, z: 2.4666976928710938}
// export const black_size_vector = {x: 10.125563621520996, y: 1.9746508598327637, z: 1.9570356607437134}
  

// export const positions = {
//     "24": [0, 0.56, 0-3*offset ],
//     "25": [0, -0.052, 1.703-3*offset ],
//     "26": [0, 0.55, 3.006-3*offset ],
//     "27": [0, -0.052, 4.325-3*offset ],
//     "28": [0, 0.56, 5.5920-3*offset ],
//     "29": [0, 0.56, 7.666-3*offset ],
//     "30": [0, -0.052, 9.386-3*offset ],
//     "31": [0, 0.56, 10.65-3*offset ],
//     "32": [0, -0.052, 11.915-3*offset ],
//     "33": [0, 0.56, 13.182-3*offset ],
//     "34": [0, -0.052, 14.449-3*offset ],
//     "35": [0, 0.56, 15.754-3*offset ],
  
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
  
//     "60": [0, 0.556, 0],
//     "61": [0, -0.052, 1.703],
//     "62": [0, 0.556, 3.006],
//     "63": [0, -0.052, 4.325],
//     "64": [0, 0.568, 5.5920],
//     "65": [0, 0.556, 7.666],
//     "66": [0, -0.052, 9.386],
//     "67": [0, 0.568, 10.65],
//     "68": [0, -0.052, 11.915],
//     "69": [0, 0.56, 13.182],
//     "70": [0, -0.052, 14.449],
//     "71":  [0, 0.56, 15.754],
  
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