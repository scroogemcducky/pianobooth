// MIDI Worker - handles heavy parsing off main thread
// For now, this is a placeholder. Web Workers with ES modules are complex in this setup.
// We'll implement this as a future optimization when the module loading is sorted out.

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  if (type === 'PARSE_MIDI') {
    // For now, send back to main thread - this is a future optimization
    self.postMessage({
      type: 'PARSE_FALLBACK',
      data: data
    });
  }
};