
import { IoMdPlay, IoMdPause, } from 'react-icons/io';

const PlayPauseButton = ({ playing, onClick }) => (
    <button
      tabIndex="-1"
      onClick={onClick}
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
    </button>
  );
  
  export default PlayPauseButton