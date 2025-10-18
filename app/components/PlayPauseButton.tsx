import usePlayStore from '../store/playStore'
import { IoMdPlay, IoMdPause } from 'react-icons/io'
import React from 'react'

type Props = {
  style?: React.CSSProperties
  className?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

const PlayPauseButton = ({ style, className, onClick }: Props) => {
  const playing = usePlayStore((state) => state.playing)
  const defaultStyle: React.CSSProperties = {
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
  }

  return (
    <button
      tabIndex={-1}
      aria-label={playing ? 'Pause music' : 'Play music'}
      onClick={(e) => {
        if (onClick) {
          onClick(e)
        } else {
          usePlayStore.getState().setPlaying(!playing)
        }
      }}
      className={className}
      style={style ?? defaultStyle}
    >
      {playing ? <IoMdPause /> : <IoMdPlay />}
    </button>
  )
}

export default PlayPauseButton
