import RecorderView from '../components/recording/RecorderView'
import { DESKTOP_RECORDING_PRESET } from '../utils/recordingPresets'

// Thin route wrapper. The recorder lives in components/recording/RecorderView so
// both /record and /record_mobile can render it with their own preset - route
// default exports cannot receive props.
export default function RecordRoute() {
  return <RecorderView recordingPreset={DESKTOP_RECORDING_PRESET} />
}
