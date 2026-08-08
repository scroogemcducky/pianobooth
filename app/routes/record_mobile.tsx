import RecorderView from '../components/recording/RecorderView'
import { MOBILE_RECORDING_PRESET } from '../utils/recordingPresets'

// Thin route wrapper. Renders at the same 1920x1080 as /record; the mobile render
// script crops the result to portrait afterwards. The differences that matter
// here are all in MOBILE_RECORDING_PRESET.
export default function RecordMobileRoute() {
  return <RecorderView recordingPreset={MOBILE_RECORDING_PRESET} />
}
