import React from 'react';
import { ShaderMaterial, Color, BoxGeometry } from 'three';

function RedBox() {
  const geometry = new BoxGeometry(5, 5, 1);

  const material = new ShaderMaterial({
    uniforms: {
      color: { value: new Color(0xff0000) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec2 vUv;
      
      void main() {
        vec3 finalColor = color;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[-50, 0, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

export default function ShaderBlocks() {
  return (
    <>
      <RedBox />
    </>
  );
}