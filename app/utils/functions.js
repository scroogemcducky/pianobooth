


export function calculateHeight(dur, distance) {
    return distance*dur/1000000
  }
  
export function isBlack(numba) {
    return (numba % 12 === 1 || numba % 12 === 3 || numba % 12 === 6 || numba % 12 === 8 || numba % 12 === 10)
  }
  
export function scalingFactor(width, keyboardWidth, options = {}){
  const fillRatio = options.fillRatio ?? 0.9
  const maxScale = options.maxScale ?? 1.1
  const multiplier = options.multiplier ?? 1
  const raw = (width / keyboardWidth) * fillRatio * multiplier
  return Math.min(maxScale, raw);
}
export function groupByDelta(arr) {
    const grouped = new Map();
    arr.forEach(item => {
      const deltaKey = item.delta; 
      if (!grouped.has(deltaKey)) {
        grouped.set(deltaKey, []); 
      }
        grouped.get(deltaKey).push({
            noteNumber: item.noteNumber,
            duration: item.duration
        });

        // grouped.get(deltaKey).push(item); 
    });
  
  
    const result = [];
    grouped.forEach((value, key) => {
      let groupObject = {};
      groupObject[key] = value;
      result.push(groupObject);
    });
    return result;
  }
  
