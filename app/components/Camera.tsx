import { useThree } from '@react-three/fiber';
import { Euler } from 'three';
import { useEffect } from 'react';

function SetupCamera() {
    const { camera } = useThree();
    useEffect(() => {
      // Euler angles (x, y, z) in radians. Example: new Euler(0, Math.PI / 4, 0) for 45 degrees rotation around Y axis
      camera.rotation.copy(new Euler(-Math.PI/2 , 0, -Math.PI/2));
      camera.position.set(0, 10, 10)
      camera.updateProjectionMatrix(); // Important after changing camera properties

    }, [camera]);
    return null;
  }

  export default SetupCamera