import { mdiCog, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useHydrated } from "~/hooks/useHydrated";
import usePlayStore from '../store/playStore';

export type PieceLicense = {
  name?: string
  url?: string
  text?: string
  attribution?: string
}

type SettingsButtonProps = {
  license?: PieceLicense
  onClick?: () => void
}

// Playback speed and licence only. Particle tuning lives on /particleExplorer,
// a dev-only route, so this menu is identical in development and production.
const SettingsButton = ({ license, onClick }: SettingsButtonProps) => {
  const isHydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const speed = usePlayStore(state => state.speed);
  const setSpeed = usePlayStore(state => state.setSpeed);
  const timelineVisible = usePlayStore(state => state.timelineVisible);
  const setTimelineVisible = usePlayStore(state => state.setTimelineVisible);

  // Rendered through a portal and positioned against the button, so the menu is
  // never clipped by the bounded, overflow-hidden player container on song pages.
  const updateMenuPosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 8, left: rect.right })
  }

  const handleToggle = (evt?: ReactMouseEvent) => {
    if (evt?.target instanceof HTMLElement && evt.target.closest('.settings-menu')) {
      return
    }
    setIsOpen((prev) => !prev)
    onClick?.()
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideButton = buttonRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)
      if (!insideButton && !insideMenu) setIsOpen(false)
    };
    const handleScrollOrResize = () => {
      if (isOpen) updateMenuPosition()
    };

    if (isOpen) {
      updateMenuPosition()
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener('resize', handleScrollOrResize)
      window.addEventListener('scroll', handleScrollOrResize, true)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    };
  }, [isOpen]);

  return (
    <button
      ref={buttonRef}
      tabIndex={-1}
      aria-label="Settings menu"
      aria-expanded={isOpen}
      onClick={handleToggle}
      className="absolute top-8 right-8 z-50 bg-transparent border-none outline-none cursor-pointer text-white text-2xl"
    >
      {isHydrated && (
        <Icon path={isOpen ? mdiClose : mdiCog} size={1} color="white" />
      )}
      {isOpen && isHydrated && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="settings-menu bg-black/90 text-white rounded-lg shadow-2xl p-4 backdrop-blur-md border border-white/20"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: Math.max(8, menuPos.left - 280),
              width: 280,
              maxHeight: '70vh',
              overflowY: 'auto',
              zIndex: 2000,
            }}
          >
            <div className="text-left">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide mb-2">
                <span>Playback Speed</span>
                <span className="text-[10px] opacity-80">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={speed}
                aria-label="Playback speed"
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/20 pt-3 text-left">
              <span className="text-xs uppercase tracking-wide">Controls</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={timelineVisible}
                  onChange={(event) => setTimelineVisible(event.target.checked)}
                  className="accent-white h-4 w-4"
                />
                <span>{timelineVisible ? 'On' : 'Off'}</span>
              </label>
            </div>

            {license && (
              <div className="mt-4 border-t border-white/20 pt-3 text-left">
                <button
                  type="button"
                  onClick={() => setLicenseOpen((open) => !open)}
                  className="flex w-full items-center gap-2 text-xs uppercase tracking-wide text-white/70 hover:text-white transition"
                >
                  <span>License</span>
                  <span className="text-sm font-semibold">{licenseOpen ? '−' : '+'}</span>
                </button>
                {licenseOpen && (
                  <div className="mt-2 space-y-1">
                    {license.name && <div className="text-sm font-medium">{license.name}</div>}
                    {license.attribution && <div className="text-xs opacity-90">{license.attribution}</div>}
                    {license.url && (
                      <a
                        className="block text-xs text-blue-300 underline break-all"
                        href={license.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {license.url}
                      </a>
                    )}
                    {license.text && (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-snug max-h-48 overflow-auto opacity-80">
                        {license.text}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </button>
  );
};

export default SettingsButton;
