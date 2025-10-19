import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@mdi/react'
import { mdiCog, mdiClose } from '@mdi/js'
import { useHydrated } from 'remix-utils/use-hydrated'
import usePlayStore from '../store/playStore'

type Props = {
  className?: string
  style?: React.CSSProperties
}

// Embedded-only settings control that opens upward in a fixed overlay without affecting layout
const EmbeddedSettingsButton = ({ className, style }: Props) => {
  const isHydrated = useHydrated()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const speed = usePlayStore((state) => state.speed)
  const setSpeed = usePlayStore((state) => state.setSpeed)

  const updateMenuPosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.top, left: rect.right })
  }

  const handleToggle = (evt?: any) => {
    if (evt?.target?.closest?.('.settings-menu')) return
    setIsOpen((prev) => !prev)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideButton = buttonRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)
      if (!insideButton && !insideMenu) {
        setIsOpen(false)
      }
    }
    const handleScrollOrResize = () => {
      if (isOpen) updateMenuPosition()
    }
    if (isOpen) {
      updateMenuPosition()
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('resize', handleScrollOrResize)
      window.addEventListener('scroll', handleScrollOrResize, true)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen])

  return (
    <button
      ref={buttonRef}
      tabIndex={-1}
      aria-label="Settings menu"
      aria-expanded={isOpen}
      onClick={handleToggle}
      className={className ?? 'z-50 bg-transparent border-none outline-none cursor-pointer text-white text-2xl'}
      style={style}
    >
      {isHydrated && (
        <Icon path={isOpen ? mdiClose : mdiCog} size={1} color="white" />
      )}
      {isOpen && isHydrated && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="settings-menu"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: Math.max(8, menuPos.left - 260),
              transform: 'translateY(-8px) translateY(-100%)',
              width: 260,
              background: 'black',
              color: 'white',
              border: '1px solid white',
              borderRadius: 8,
              padding: '8px 12px',
              zIndex: 2000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li className="border-b border-white py-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={speed}
                  aria-label="Playback speed"
                  onChange={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
                  className="w-full accent-white"
                />
              </li>
            </ul>
          </div>,
          document.body
        )}
    </button>
  )
}

export default EmbeddedSettingsButton

