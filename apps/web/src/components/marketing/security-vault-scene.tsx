"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const accentColors = ["#9cff4a", "#7dd3fc", "#f0abfc", "#facc15"]

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return prefersReducedMotion
}

function VaultCore({
  activeIndex,
  reducedMotion,
}: {
  activeIndex: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const accent = accentColors[activeIndex] ?? accentColors[0]

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return
    const pulse = Math.sin(state.clock.elapsedTime * 1.8) * 0.08
    groupRef.current.rotation.y += delta * (0.16 + activeIndex * 0.04)
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      (activeIndex - 1.5) * 0.08,
      delta * 2,
    )
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1.08 + pulse)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <dodecahedronGeometry args={[0.68, 0]} />
        <meshStandardMaterial
          color="#f4f2ee"
          emissive={accent}
          emissiveIntensity={0.18}
          metalness={0.34}
          roughness={0.28}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.84, 0.012, 12, 96]} />
        <meshBasicMaterial color={accent} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} scale={1.22}>
        <torusGeometry args={[0.84, 0.008, 12, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[0.3, 0.2, 0.4]} scale={1.44}>
        <torusGeometry args={[0.84, 0.006, 12, 96]} />
        <meshBasicMaterial color={accent} transparent opacity={0.26} />
      </mesh>
    </group>
  )
}

function ParticleField({
  activeIndex,
  reducedMotion,
}: {
  activeIndex: number
  reducedMotion: boolean
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const accent = accentColors[activeIndex] ?? accentColors[0]
  const positions = useMemo(() => {
    const vertices: number[] = []
    for (let index = 0; index < 90; index += 1) {
      const angle = (index / 90) * Math.PI * 2
      const radius = 1.8 + (index % 7) * 0.18
      vertices.push(
        Math.cos(angle) * radius,
        Math.sin(index * 1.9) * 0.6,
        Math.sin(angle) * radius * 0.28,
      )
    }
    return new Float32Array(vertices)
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current || reducedMotion) return
    pointsRef.current.rotation.y += delta * 0.045
    pointsRef.current.rotation.z += delta * 0.018
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={accent}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </points>
  )
}

function FlowLines({ activeIndex }: { activeIndex: number }) {
  const accent = accentColors[activeIndex] ?? accentColors[0]
  const lines = useMemo(
    () => [
      [[-2.2, -0.72, 0], [-0.78, -0.16, 0]],
      [[0.78, 0.16, 0], [2.2, 0.72, 0]],
      [[-1.8, 0.86, -0.1], [-0.44, 0.36, 0]],
      [[0.44, -0.36, 0], [1.8, -0.86, -0.1]],
    ] as const,
    [],
  )

  return (
    <group>
      {lines.map(([start, end], index) => {
        const from = new THREE.Vector3(...start)
        const to = new THREE.Vector3(...end)
        const midpoint = from.clone().add(to).multiplyScalar(0.5)
        const length = from.distanceTo(to)
        const direction = to.clone().sub(from).normalize()
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        )

        return (
          <mesh key={`${start.join("-")}-${index}`} position={midpoint} quaternion={quaternion}>
            <cylinderGeometry args={[0.006, 0.006, length, 8]} />
            <meshBasicMaterial color={index <= activeIndex ? accent : "#ffffff"} transparent opacity={index <= activeIndex ? 0.42 : 0.12} />
          </mesh>
        )
      })}
    </group>
  )
}

function VaultSceneContent({
  activeIndex,
  reducedMotion,
}: {
  activeIndex: number
  reducedMotion: boolean
}) {
  return (
    <group>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 3.4]} intensity={4.2} color="#ffffff" />
      <pointLight position={[-2.4, 1.8, 2.6]} intensity={1.8} color={accentColors[activeIndex]} />
      <ParticleField activeIndex={activeIndex} reducedMotion={reducedMotion} />
      <FlowLines activeIndex={activeIndex} />
      <VaultCore activeIndex={activeIndex} reducedMotion={reducedMotion} />
    </group>
  )
}

export function SecurityVaultScene({ activeIndex }: { activeIndex: number }) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 4.8], fov: 44 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        fallback={<div className="h-full w-full bg-[radial-gradient(circle_at_center,var(--glow-soft),transparent_62%)]" />}
      >
        <VaultSceneContent activeIndex={activeIndex} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
