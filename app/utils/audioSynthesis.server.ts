// app/utils/audioSynthesis.server.ts

// Audio synthesis utilities for server-side MIDI to audio conversion

interface MidiNote {
    Delta: number;
    Duration: number;
    NoteNumber: number;
    Velocity: number;
    SoundDuration: number;
  }
  
  // MIDI note number to frequency conversion
  function midiNoteToFrequency(noteNumber: number): number {
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
  }
  
  // Generate a piano-like waveform using additive synthesis
  function generatePianoWave(frequency: number, sampleRate: number, duration: number): Float32Array {
    const numSamples = Math.floor(duration * sampleRate);
    const samples = new Float32Array(numSamples);
    
    // More realistic piano harmonics with frequency-dependent amplitudes
    const harmonics = [
      { mult: 1.0, amp: 1.0 },      // Fundamental
      { mult: 2.0, amp: 0.6 },      // Second harmonic (stronger)
      { mult: 3.0, amp: 0.4 },      // Third harmonic
      { mult: 4.0, amp: 0.25 },     // Fourth harmonic
      { mult: 5.0, amp: 0.15 },     // Fifth harmonic
      { mult: 6.0, amp: 0.1 },      // Sixth harmonic
      { mult: 7.0, amp: 0.07 },     // Seventh harmonic
      { mult: 8.0, amp: 0.05 },     // Eighth harmonic
    ];
    
    // Frequency-dependent brightness (higher notes have fewer harmonics)
    const brightnessReduction = Math.min(1, 880 / frequency);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      // More realistic ADSR envelope for piano
      const attackTime = 0.005;   // 5ms very fast attack
      const decayTime = 0.2;      // 200ms decay
      const sustainLevel = 0.4;   // 40% sustain
      const releaseTime = Math.min(3.0, duration * 0.7); // Adaptive release
      
      let envelope = 1;
      if (t < attackTime) {
        // Sharp attack with slight overshoot
        envelope = (t / attackTime) * 1.1;
      } else if (t < attackTime + decayTime) {
        // Exponential decay
        const decayProgress = (t - attackTime) / decayTime;
        envelope = 1.1 - (1.1 - sustainLevel) * (1 - Math.exp(-3 * decayProgress));
      } else if (t < duration - releaseTime) {
        // Gradual sustain decay
        const sustainProgress = (t - attackTime - decayTime) / (duration - releaseTime - attackTime - decayTime);
        envelope = sustainLevel * (1 - sustainProgress * 0.3);
      } else {
        // Exponential release
        const releaseProgress = (duration - t) / releaseTime;
        envelope = (sustainLevel * 0.7) * Math.exp(-2 * (1 - releaseProgress));
      }
      
      // Generate harmonics with slight detuning for realism
      for (const harmonic of harmonics) {
        const harmonicFreq = frequency * harmonic.mult;
        const harmonicAmp = harmonic.amp * brightnessReduction * (harmonic.mult > 4 ? Math.pow(0.8, harmonic.mult - 4) : 1);
        
        // Add slight detuning and phase variation
        const detuning = 1 + (Math.sin(t * 0.5 + harmonic.mult) * 0.001);
        const phase = harmonic.mult * 0.1;
        
        sample += harmonicAmp * Math.sin(2 * Math.PI * harmonicFreq * detuning * t + phase);
      }
      
      // Add subtle noise for more realistic texture
      const noise = (Math.random() - 0.5) * 0.005 * envelope;
      
      samples[i] = (sample + noise) * envelope * 0.08; // Slightly louder output
    }
    
    return samples;
  }
  
  // Mix multiple audio channels
  function mixAudioChannels(channels: Float32Array[]): Float32Array {
    if (channels.length === 0) return new Float32Array(0);
    
    const maxLength = Math.max(...channels.map(ch => ch.length));
    const mixed = new Float32Array(maxLength);
    
    for (let i = 0; i < maxLength; i++) {
      let sum = 0;
      for (const channel of channels) {
        if (i < channel.length) {
          sum += channel[i];
        }
      }
      mixed[i] = Math.max(-1, Math.min(1, sum)); // Clamp to prevent clipping
    }
    
    return mixed;
  }
  
  // Convert Float32Array to WAV file buffer
  function createWavBuffer(audioData: Float32Array, sampleRate: number): Buffer {
    const length = audioData.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert to 16-bit PCM
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(44 + i * 2, sample * 0x7FFF, true);
    }
    
    return Buffer.from(arrayBuffer);
  }
  
  // Main function to synthesize audio from MIDI notes
  export function synthesizeAudioFromMIDI(midiNotes: MidiNote[], sampleRate: number = 44100): Buffer {
    console.log(`Synthesizing audio for ${midiNotes.length} notes at ${sampleRate}Hz`);
    
    // Add 1 second delay to match visual timing (notes take 1 second to fall)
    const VISUAL_DELAY_MS = 1000;
    
    // Calculate total duration
    const totalDurationMs = Math.max(...midiNotes.map(note => 
      parseInt(note.Delta / 1000) + (note.Duration / 1000000 * 1000)
    )) + VISUAL_DELAY_MS + 2000; // Add visual delay + 2 seconds padding
    
    const totalDurationSec = totalDurationMs / 1000;
    console.log(`Total audio duration: ${totalDurationSec.toFixed(2)} seconds (including ${VISUAL_DELAY_MS}ms visual delay)`);
    
    // Generate audio for each note
    const noteChannels: Float32Array[] = [];
    
    for (const note of midiNotes) {
      const frequency = midiNoteToFrequency(note.NoteNumber);
      const startTime = (parseInt(note.Delta / 1000) + VISUAL_DELAY_MS) / 1000; // Convert to seconds with delay
      const duration = (note.Duration / 1000000); // Convert to seconds
      const velocity = note.Velocity / 127; // Normalize velocity
      
      // Generate the note
      const noteAudio = generatePianoWave(frequency, sampleRate, duration);
      
      // Apply velocity
      for (let i = 0; i < noteAudio.length; i++) {
        noteAudio[i] *= velocity;
      }
      
      // Create a channel for this note positioned in time
      const channelLength = Math.floor(totalDurationSec * sampleRate);
      const channel = new Float32Array(channelLength);
      const startSample = Math.floor(startTime * sampleRate);
      
      // Copy note audio into the channel at the correct time
      for (let i = 0; i < noteAudio.length && startSample + i < channelLength; i++) {
        channel[startSample + i] = noteAudio[i];
      }
      
      noteChannels.push(channel);
    }
    
    console.log(`Generated ${noteChannels.length} note channels`);
    
    // Mix all notes together
    const mixedAudio = mixAudioChannels(noteChannels);
    
    // Convert to WAV buffer
    const wavBuffer = createWavBuffer(mixedAudio, sampleRate);
    console.log(`Generated WAV file: ${wavBuffer.length} bytes`);
    
    return wavBuffer;
  }