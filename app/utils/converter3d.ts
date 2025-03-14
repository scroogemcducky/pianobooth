
// function convert3DTo2D(position, canvasWidth, canvasHeight) {
//   // Field of view in radians (default R3F camera uses 75 degrees)
//   const fov = 75 * (Math.PI / 180);
  
//   // Extract coordinates
//   const [x, y, z] = position;
  
//   // Calculate projection
//   const scale = 1 / Math.tan(fov / 2);
//   const projection = scale / z;
  
//   // Convert to screen space
//   const screenX = (x * projection * canvasWidth) + (canvasWidth / 2);
//   const screenY = (-y * projection * canvasHeight) + (canvasHeight / 2);
  
//   return {
//     x: screenX,
//     y: screenY,
//   };
// }

// export default convert3DTo2D;