export type MidiValidationResult =
  | { isValid: true; error: null }
  | { isValid: false; error: string }

const validMidiExtensions = ['.mid', '.midi', '.kar']

export function validateMidiFile(file: File | null | undefined): MidiValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file provided' }
  }

  if (typeof File !== 'undefined' && !(file instanceof File)) {
    return { isValid: false, error: 'Invalid file object' }
  }

  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  const isValidExtension = validMidiExtensions.includes(extension)

  if (!isValidExtension) {
    return {
      isValid: false,
      error: `Invalid file extension. Expected: ${validMidiExtensions.join(', ')}`,
    }
  }

  return { isValid: true, error: null }
}
