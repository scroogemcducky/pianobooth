import usePlayStore from '../store/playStore'
import { IoMdPlay, IoMdPause, } from 'react-icons/io';


const PlayPauseButton = () => {
  const playing = usePlayStore((state) => state.playing);
    return (<button
      tabIndex="-1"
      onClick={() => usePlayStore.getState().setPlaying(!playing)}
      style={{
        position: 'absolute',
        top: 30,
        left: 30,
        zIndex: 1000,
        background: 'none',
        border: 'none',
        outline: '0',
        cursor: 'pointer',
        fontSize: '24px',
        color: 'white',
      }}
    >
      {playing ? <IoMdPause /> : <IoMdPlay />}
    </button>)
}
 
  export default PlayPauseButton