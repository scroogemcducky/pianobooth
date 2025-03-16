export const black_color = "rgb(90, 20, 45)"
export const white_color = "rgb(240, 19, 71)" // "rgb(230, 70, 90)"
const offset = 7*2.55
export const white_width = 2.55
export const black_width = 1.8 
export const factor = 1
export const speed = 1
export const keysOffset = 0

// NOTE: The keyboard is now scaled using a dynamic scaling factor in Keys.jsx
// calculated as: Math.min(0.8, viewport.width / (6 * offset) * 0.9)
// This ensures the keyboard fits on different screen sizes with a more aggressive scaling

export const white_key_dimensions = {y: 15.367410659790039, x: 2.268760919570923, z: 2.4666976928710938}
export const black_key_dimensions = {y: 10.125563621520996, x: 1.9746508598327637, z: 1.9570356607437134}

const position = -0.116 // default position of C key Blender 

const sharp_offset = white_width/2

export const note_positions = {
  "24": [ -3 * offset + position, 0, 0],                                      // C
  "25": [ -3 * offset + position + sharp_offset, 0, 0],                       // C Sharp
  "26": [ -3 * offset + position + white_width, 0, 0],                        // D
  "27": [ -3 * offset + position + white_width + sharp_offset, 0, 0],         // D Sharp
  "28": [ -3 * offset + position + 2 * white_width, 0, 0],                    // E
  "29": [ -3 * offset + position + 3 * white_width, 0, 0],                    // F
  "30": [ -3 * offset + position + 3 * white_width + sharp_offset, 0, 0],     // F Sharp
  "31": [ -3 * offset + position + 4 * white_width, 0, 0],                    // G
  "32": [ -3 * offset + position + 4 * white_width + sharp_offset, 0, 0],     // G Sharp
  "33": [ -3 * offset + position + 5 * white_width, 0, 0],                    // A
  "34": [ -3 * offset + position + 5 * white_width + sharp_offset, 0, 0],     // A Sharp
  "35": [ -3 * offset + position + 6 * white_width, 0, 0],                    // B

  "36": [ -2 * offset + position, 0, 0],                                      // C
  "37": [ -2 * offset + position + sharp_offset, 0, 0],                       // C Sharp
  "38": [ -2 * offset + position + white_width, 0, 0],                        // D
  "39": [ -2 * offset + position + white_width + sharp_offset, 0, 0],         // D Sharp
  "40": [ -2 * offset + position + 2 * white_width, 0, 0],                    // E
  "41": [ -2 * offset + position + 3 * white_width, 0, 0],                    // F
  "42": [ -2 * offset + position + 3 * white_width + sharp_offset, 0, 0],     // F Sharp
  "43": [ -2 * offset + position + 4 * white_width, 0, 0],                    // G
  "44": [ -2 * offset + position + 4 * white_width + sharp_offset, 0, 0],     // G Sharp
  "45": [ -2 * offset + position + 5 * white_width, 0, 0],                    // A
  "46": [ -2 * offset + position + 5 * white_width + sharp_offset, 0, 0],     // A Sharp
  "47": [ -2 * offset + position + 6 * white_width, 0, 0],                    // B 

  "48": [ -offset + position, 0, 0],                                          // C
  "49": [ -offset + position + sharp_offset, 0, 0],                           // C Sharp
  "50": [ -offset + position + white_width, 0, 0],                            // D
  "51": [ -offset + position + white_width + sharp_offset, 0, 0],             // D Sharp
  "52": [ -offset + position + 2 * white_width, 0, 0],                        // E
  "53": [ -offset + position + 3 * white_width, 0, 0],                        // F
  "54": [ -offset + position + 3 * white_width + sharp_offset, 0, 0],         // F Sharp
  "55": [ -offset + position + 4 * white_width, 0, 0],                        // G
  "56": [ -offset + position + 4 * white_width + sharp_offset, 0, 0],         // G Sharp
  "57": [ -offset + position + 5 * white_width, 0, 0],                        // A
  "58": [ -offset + position + 5 * white_width + sharp_offset, 0, 0],         // A Sharp
  "59": [ -offset + position + 6 * white_width, 0, 0],                        // B

  "60": [ position, 0, 0],                                                    // C
  "61": [ position + sharp_offset, 0, 0],                                     // C Sharp
  "62": [ position + white_width, 0, 0],                                      // D
  "63": [ position + white_width + sharp_offset, 0, 0],                       // D Sharp
  "64": [ position + 2 * white_width, 0, 0],                                  // E
  "65": [ position + 3 * white_width, 0, 0],                                  // F
  "66": [ position + 3 * white_width + sharp_offset, 0, 0],                   // F Sharp
  "67": [ position + 4 * white_width, 0, 0],                                  // G
  "68": [ position + 4 * white_width + sharp_offset, 0, 0],                   // G Sharp
  "69": [ position + 5 * white_width, 0, 0],                                  // A
  "70": [ position + 5 * white_width + sharp_offset, 0, 0],                   // A Sharp
  "71": [ position + 6 * white_width, 0, 0],                                  // B

  "72": [ offset + position, 0, 0],                                           // C
  "73": [ offset + position + sharp_offset, 0, 0],                            // C Sharp
  "74": [ offset + position + white_width, 0, 0],                             // D
  "75": [ offset + position + white_width + sharp_offset, 0, 0],              // D Sharp
  "76": [ offset + position + 2 * white_width, 0, 0],                         // E
  "77": [ offset + position + 3 * white_width, 0, 0],                         // F
  "78": [ offset + position + 3 * white_width + sharp_offset, 0, 0],          // F Sharp
  "79": [ offset + position + 4 * white_width, 0, 0],                         // G
  "80": [ offset + position + 4 * white_width + sharp_offset, 0, 0],          // G Sharp
  "81": [ offset + position + 5 * white_width, 0, 0],                         // A
  "82": [ offset + position + 5 * white_width + sharp_offset, 0, 0],          // A Sharp
  "83": [ offset + position + 6 * white_width, 0, 0],                         // B

  "84": [ 2 * offset + position, 0, 0],                                       // C
  "85": [ 2 * offset + position + sharp_offset, 0, 0],                        // C Sharp
  "86": [ 2 * offset + position + white_width, 0, 0],                         // D
  "87": [ 2 * offset + position + white_width + sharp_offset, 0, 0],          // D Sharp
  "88": [ 2 * offset + position + 2 * white_width, 0, 0],                     // E
  "89": [ 2 * offset + position + 3 * white_width, 0, 0],                     // F
  "90": [ 2 * offset + position + 3 * white_width + sharp_offset, 0, 0],      // F Sharp
  "91": [ 2 * offset + position + 4 * white_width, 0, 0],                     // G
  "92": [ 2 * offset + position + 4 * white_width + sharp_offset, 0, 0],      // G Sharp
  "93": [ 2 * offset + position + 5 * white_width, 0, 0],                     // A
  "94": [ 2 * offset + position + 5 * white_width + sharp_offset, 0, 0],      // A Sharp
  "95": [ 2 * offset + position + 6 * white_width, 0, 0],                     // B

  "96":  [ 3 * offset + position, 0, 0],                                      // C
  "97":  [ 3 * offset + position + sharp_offset, 0, 0],                       // C Sharp
  "98":  [ 3 * offset + position + white_width, 0, 0],                        // D
  "99":  [ 3 * offset + position + white_width + sharp_offset, 0, 0],         // D Sharp
  "100": [ 3 * offset + position + 2 * white_width, 0, 0],                    // E
  "101": [ 3 * offset + position + 3 * white_width, 0, 0],                    // F
  "102": [ 3 * offset + position + 3 * white_width + sharp_offset, 0, 0],     // F Sharp
  "103": [ 3 * offset + position + 4 * white_width, 0, 0],                    // G
  "104": [ 3 * offset + position + 4 * white_width + sharp_offset, 0, 0],     // G Sharp
  "105": [ 3 * offset + position + 5 * white_width, 0, 0],                    // A
  "106": [ 3 * offset + position + 5 * white_width + sharp_offset, 0, 0],     // A Sharp
  "107": [ 3 * offset + position + 6 * white_width, 0, 0],                    // B
}





  
