import { mdiDeskLampOn, mdiDeskLamp } from '@mdi/js'; 
import Icon from '@mdi/react';
import { useHydrated } from "~/hooks/useHydrated";

const LightsButton = ({ lights, onClick }: { lights: boolean; onClick: () => void }) => {
  const isHydrated = useHydrated();

  return (
    <button
      tabIndex={-1}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 30,
        right: 30,
        zIndex: 1000,
        background: 'none',
        border: 'none',
        outline: '0',
        cursor: 'pointer',
        fontSize: '24px',
        color: 'white',
      }}
    >
      {isHydrated && (
        <Icon 
          path={lights ? mdiDeskLampOn : mdiDeskLamp}
          size={1}
          color="white"
          style={{ transform: 'scale(-1, 1)' }}
        />
      )}
    </button>
  );
};

export default LightsButton;