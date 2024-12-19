import { mdiCog, mdiClose, mdiDeskLampOn, mdiDeskLamp } from '@mdi/js'; 
import Icon from '@mdi/react';
import { useState, useEffect, useRef } from "react";
import { useHydrated } from "remix-utils/use-hydrated";

const SettingsButton = ({ onClick ,  lightsClick}: { onClick: () => void }) => {
  const isHydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);


  const handleToggle = () => {
    if (event?.target?.closest('.settings-menu')) {
      return;
    }
    setIsOpen(!isOpen);
    // onClick();
  };

  const toggleLights = () => {
    lightsClick();
    // Add any additional logic needed when toggling lights
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <button
      ref={buttonRef}
      tabIndex={-1}
      onClick={handleToggle}
      className="absolute top-8 right-8 z-50 bg-transparent border-none outline-none cursor-pointer text-white text-2xl"
    >
      {isHydrated && (
        <Icon 
          path={isOpen ? mdiClose : mdiCog}
          size={1}
          color="white"
        />
      )}
      {isOpen && (
        <div className="settings-menu">
          <ul>
            <li
              className="border-b border-white py-2 flex justify-center items-center"
            >
              <Icon 
                // path={lights ? mdiDeskLampOn : mdiDeskLamp}
                path ={mdiDeskLampOn}
                size={1}
                color="white"
                onClick={toggleLights}
                style={{ transform: 'scale(-1, 1)' }}
                className="cursor-pointer"
              />
            </li>
            <li
              className="border-b border-white py-2"
            >
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={selectedSpeed}
                onChange={(e) => setSelectedSpeed(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </li>
            {/* Add more options as needed */}
          </ul>
        </div>
      )}
    </button>
  );
};

export default SettingsButton;