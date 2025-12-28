#!/usr/bin/env python3
"""
Generate audio from MIDI files using FluidSynth.

This script converts MIDI files to WAV audio, which is much faster than
browser-based audio synthesis for long pieces.

Usage:
    uv run scripts/generate_audio.py input.mid output.wav
    uv run scripts/generate_audio.py input.mid output.wav --delay 3.5

Requirements:
    - FluidSynth must be installed: brew install fluid-synth
    - FluidR3_GM.sf2 soundfont in soundfonts/ directory (same as browser uses)
"""

import argparse
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

# Salamander C5 Light - High quality piano soundfont (lighter version)
SOUNDFONT_DIR = Path(__file__).parent.parent / "soundfonts"
SOUNDFONT_PATH = SOUNDFONT_DIR / "SALC5-Light-SF-v2_7" / "SalC5Light2.sf2"


def check_fluidsynth() -> bool:
    """Check if FluidSynth is installed."""
    return shutil.which("fluidsynth") is not None


def find_soundfont() -> Path | None:
    """Find the Salamander C5 Light soundfont."""
    if SOUNDFONT_PATH.exists():
        return SOUNDFONT_PATH

    print(f"Error: Soundfont not found at {SOUNDFONT_PATH}", file=sys.stderr)
    return None


def prepend_silence_to_wav(input_path: str, output_path: str, silence_seconds: float, sample_rate: int = 44100) -> bool:
    """Prepend silence to a WAV file."""
    try:
        with open(input_path, 'rb') as f:
            # Read WAV header
            riff = f.read(4)
            if riff != b'RIFF':
                print(f"Error: Not a valid WAV file", file=sys.stderr)
                return False

            file_size = struct.unpack('<I', f.read(4))[0]
            wave = f.read(4)
            if wave != b'WAVE':
                print(f"Error: Not a valid WAV file", file=sys.stderr)
                return False

            # Find fmt chunk
            while True:
                chunk_id = f.read(4)
                if not chunk_id:
                    print(f"Error: fmt chunk not found", file=sys.stderr)
                    return False
                chunk_size = struct.unpack('<I', f.read(4))[0]
                if chunk_id == b'fmt ':
                    fmt_data = f.read(chunk_size)
                    audio_format, num_channels, wav_sample_rate, byte_rate, block_align, bits_per_sample = struct.unpack('<HHIIHH', fmt_data[:16])
                    break
                else:
                    f.read(chunk_size)

            # Find data chunk
            while True:
                chunk_id = f.read(4)
                if not chunk_id:
                    print(f"Error: data chunk not found", file=sys.stderr)
                    return False
                chunk_size = struct.unpack('<I', f.read(4))[0]
                if chunk_id == b'data':
                    audio_data = f.read(chunk_size)
                    break
                else:
                    f.read(chunk_size)

        # Calculate silence samples
        silence_samples = int(silence_seconds * wav_sample_rate)
        bytes_per_sample = bits_per_sample // 8
        silence_bytes = silence_samples * num_channels * bytes_per_sample
        silence_data = b'\x00' * silence_bytes

        # Write new WAV with silence prepended
        new_data_size = len(silence_data) + len(audio_data)
        new_file_size = 36 + new_data_size  # 36 = header size before data chunk

        with open(output_path, 'wb') as f:
            f.write(b'RIFF')
            f.write(struct.pack('<I', new_file_size))
            f.write(b'WAVE')
            f.write(b'fmt ')
            f.write(struct.pack('<I', 16))  # fmt chunk size
            f.write(struct.pack('<HHIIHH', audio_format, num_channels, wav_sample_rate, byte_rate, block_align, bits_per_sample))
            f.write(b'data')
            f.write(struct.pack('<I', new_data_size))
            f.write(silence_data)
            f.write(audio_data)

        return True
    except Exception as e:
        print(f"Error prepending silence: {e}", file=sys.stderr)
        return False


def generate_audio(
    midi_path: str,
    output_path: str,
    soundfont_path: Path,
    sample_rate: int = 44100,
    gain: float = 1.0,
    delay_seconds: float = 0.0,
) -> bool:
    """Generate audio from MIDI using FluidSynth, with optional silence prepended."""

    # If delay is needed, generate to temp file first
    if delay_seconds > 0:
        temp_output = output_path + ".tmp.wav"
    else:
        temp_output = output_path

    cmd = [
        "fluidsynth",
        "-ni",  # No interactive mode
        "-g", str(gain),  # Gain
        "-r", str(sample_rate),  # Sample rate
        "-F", temp_output,  # Output file
        str(soundfont_path),  # Soundfont
        midi_path,  # MIDI file
    ]

    print(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            print(f"FluidSynth error: {result.stderr}", file=sys.stderr)
            return False

        # Check output file exists
        if not Path(temp_output).exists():
            print(f"Error: Output file not created", file=sys.stderr)
            return False

        size_kb = Path(temp_output).stat().st_size / 1024
        print(f"Generated audio: {size_kb:.1f} KB")

        # Prepend silence if delay is specified
        if delay_seconds > 0:
            print(f"Prepending {delay_seconds:.2f}s silence for video sync...")
            if not prepend_silence_to_wav(temp_output, output_path, delay_seconds, sample_rate):
                return False
            # Clean up temp file
            Path(temp_output).unlink()
            final_size_kb = Path(output_path).stat().st_size / 1024
            print(f"Final audio with silence: {final_size_kb:.1f} KB")

        return True

    except subprocess.TimeoutExpired:
        print("Error: FluidSynth timed out after 5 minutes", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error running FluidSynth: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate audio from MIDI files using FluidSynth"
    )
    parser.add_argument("midi_file", help="Input MIDI file path")
    parser.add_argument("output_file", help="Output WAV file path")
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=0.0,
        help="Seconds of silence to prepend (for video sync)"
    )
    parser.add_argument(
        "--sample-rate", "-r",
        type=int,
        default=44100,
        help="Sample rate (default: 44100)"
    )
    parser.add_argument(
        "--gain", "-g",
        type=float,
        default=1.0,
        help="Audio gain (default: 1.0)"
    )

    args = parser.parse_args()

    # Check FluidSynth
    if not check_fluidsynth():
        print("Error: FluidSynth is not installed.", file=sys.stderr)
        print("Install with: brew install fluid-synth", file=sys.stderr)
        sys.exit(1)

    # Check MIDI file
    if not Path(args.midi_file).exists():
        print(f"Error: MIDI file not found: {args.midi_file}", file=sys.stderr)
        sys.exit(1)

    # Find soundfont
    soundfont = find_soundfont()
    if not soundfont:
        sys.exit(1)

    print(f"Using soundfont: {soundfont}")

    # Generate audio
    success = generate_audio(
        args.midi_file,
        args.output_file,
        soundfont,
        args.sample_rate,
        args.gain,
        args.delay,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
