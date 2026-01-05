import React, { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

type SelectiveBloomProps = {
  bloomLayer?: number
  strength?: number
  radius?: number
  threshold?: number
  targetLuminance?: number
}

export default function SelectiveBloom({
  bloomLayer = 1,
  strength = 1.6,
  radius = 0.6,
  threshold = 0,
  targetLuminance = 1.0,
}: SelectiveBloomProps) {
  const { gl, scene, camera, size } = useThree()

  const { bloomComposer, finalComposer, bloomPass, finalPass } = useMemo(() => {
    const renderScene = new RenderPass(scene, camera)

    const rtParams: THREE.WebGLRenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    }

    const bloomComposer = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, rtParams))
    bloomComposer.renderToScreen = false
    bloomComposer.addPass(renderScene)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold)
    bloomComposer.addPass(bloomPass)

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 bloom = texture2D(bloomTexture, vUv);
            gl_FragColor = base + bloom;
          }
        `,
      }),
      'baseTexture',
    )
    finalPass.needsSwap = true

    const finalComposer = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, rtParams))
    finalComposer.addPass(renderScene)
    finalComposer.addPass(finalPass)

    return { bloomComposer, finalComposer, bloomPass, finalPass }
  }, [gl, scene, camera, strength, radius, threshold])

  useEffect(() => {
    bloomComposer.setSize(size.width, size.height)
    finalComposer.setSize(size.width, size.height)
    bloomPass.setSize(size.width, size.height)
  }, [bloomComposer, finalComposer, bloomPass, size.width, size.height])

  useEffect(() => {
    bloomPass.strength = strength
    bloomPass.radius = radius
    bloomPass.threshold = threshold
    finalPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture
  }, [bloomComposer, bloomPass, finalPass, strength, radius, threshold])

  const bloomLayers = useMemo(() => {
    const l = new THREE.Layers()
    l.set(bloomLayer)
    return l
  }, [bloomLayer])

  const occlusionMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) })
    m.depthWrite = true
    m.depthTest = true
    m.colorWrite = false
    m.side = THREE.DoubleSide
    return m
  }, [])

  const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

  const scaleColorToLuminance = (color: THREE.Color | undefined, target: number) => {
    if (!color) return
    const lum = luminance(color.r, color.g, color.b)
    if (!Number.isFinite(lum) || lum <= 1e-6) return
    color.multiplyScalar(target / lum)
  }

  const scaleVectorToLuminance = (vec: THREE.Vector3 | undefined, target: number) => {
    if (!vec) return
    const lum = luminance(vec.x, vec.y, vec.z)
    if (!Number.isFinite(lum) || lum <= 1e-6) return
    vec.multiplyScalar(target / lum)
  }

  useFrame(() => {
    const prevAutoClear = gl.autoClear

    gl.autoClear = false
    gl.clear()

    const swapped = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>()
    const originals = new Map<
      THREE.Material,
      { color?: THREE.Color; emissive?: THREE.Color; uBlackKeyColor?: THREE.Vector3; uWhiteKeyColor?: THREE.Vector3 }
    >()

    scene.traverse((obj) => {
      const isMesh = (obj as any).isMesh
      if (!isMesh) return

      // For bloom pass: keep bloom-layer objects as-is (but boosted); render everything else as depth-only occluders
      if (!obj.layers.test(bloomLayers)) {
        const matAny = (obj as any).material as THREE.Material | THREE.Material[] | undefined
        if (matAny) swapped.set(obj, matAny)
        ;(obj as any).material = occlusionMaterial
        return
      }

      const matAny = (obj as any).material as THREE.Material | THREE.Material[] | undefined
      if (!matAny) return

      const materials = Array.isArray(matAny) ? matAny : [matAny]
      for (const material of materials) {
        const m = material as any
        if (!m) continue

        if (!originals.has(material)) {
          originals.set(material, {
            color: m.color?.clone?.(),
            emissive: m.emissive?.clone?.(),
            uBlackKeyColor: m.uniforms?.uBlackKeyColor?.value?.clone?.(),
            uWhiteKeyColor: m.uniforms?.uWhiteKeyColor?.value?.clone?.(),
          })
        }

        scaleColorToLuminance(m.color, targetLuminance)
        scaleColorToLuminance(m.emissive, targetLuminance)
        scaleVectorToLuminance(m.uniforms?.uBlackKeyColor?.value, targetLuminance)
        scaleVectorToLuminance(m.uniforms?.uWhiteKeyColor?.value, targetLuminance)
      }
    })

    bloomComposer.render()

    for (const [obj, matAny] of swapped.entries()) {
      ;(obj as any).material = matAny
    }

    for (const [material, saved] of originals.entries()) {
      if (!saved) continue
      const m = material as any
      if (saved.color && m.color?.copy) m.color.copy(saved.color)
      if (saved.emissive && m.emissive?.copy) m.emissive.copy(saved.emissive)
      if (saved.uBlackKeyColor && m.uniforms?.uBlackKeyColor?.value?.copy) m.uniforms.uBlackKeyColor.value.copy(saved.uBlackKeyColor)
      if (saved.uWhiteKeyColor && m.uniforms?.uWhiteKeyColor?.value?.copy) m.uniforms.uWhiteKeyColor.value.copy(saved.uWhiteKeyColor)
    }

    finalComposer.render()

    gl.autoClear = prevAutoClear
  }, 1)

  return null
}
