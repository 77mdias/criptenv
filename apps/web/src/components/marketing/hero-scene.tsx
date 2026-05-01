"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useTheme } from "@/hooks/use-theme"

const nodePositions: [number, number, number][] = [
  [-2.2, 0.9, 0],
  [-1.6, -0.9, 0.15],
  [0, 1.25, -0.2],
  [1.6, -0.7, 0.1],
  [2.2, 0.75, -0.1],
]

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

function Connector({
  from,
  to,
  opacity = 0.18,
  color,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  opacity?: number
  color: string
}) {
  const midpoint = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to])
  const length = useMemo(() => from.distanceTo(to), [from, to])
  const quaternion = useMemo(() => {
    const direction = to.clone().sub(from).normalize()
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    )
  }, [from, to])

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.01, 0.01, length, 10]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  )
}

function SecretNode({
  position,
  index,
  reducedMotion,
  theme,
}: {
  position: [number, number, number]
  index: number
  reducedMotion: boolean
  theme: "light" | "dark"
}) {
  const ref = useRef<THREE.Mesh>(null)
  const base = useMemo(() => new THREE.Vector3(...position), [position])

  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return
    const t = state.clock.elapsedTime + index * 0.75
    const targetY = base.y + Math.sin(t) * 0.08
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, targetY, delta * 3)
    ref.current.rotation.x += delta * 0.35
    ref.current.rotation.y += delta * 0.24
  })

  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.13, 0]} />
      <meshStandardMaterial
        color={theme === "dark" ? "#e8e6e3" : "#262626"}
        emissive={theme === "dark" ? "#ffffff" : "#111111"}
        emissiveIntensity={theme === "dark" ? 0.18 : 0.08}
        roughness={0.34}
        metalness={theme === "dark" ? 0.18 : 0.1}
      />
    </mesh>
  )
}

function VaultCore({
  reducedMotion,
  theme,
}: {
  reducedMotion: boolean
  theme: "light" | "dark"
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return
    groupRef.current.rotation.y += delta * 0.18
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.7) * 0.05
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[0.58, 1]} />
        <meshStandardMaterial
          color={theme === "dark" ? "#f5f5f5" : "#303030"}
          emissive={theme === "dark" ? "#ffffff" : "#111111"}
          emissiveIntensity={theme === "dark" ? 0.08 : 0.02}
          roughness={0.42}
          metalness={theme === "dark" ? 0.24 : 0.12}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh scale={1.35}>
        <torusGeometry args={[0.58, 0.008, 10, 80]} />
        <meshBasicMaterial
          color={theme === "dark" ? "#e8e6e3" : "#1f1f1f"}
          transparent
          opacity={theme === "dark" ? 0.32 : 0.24}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.5}>
        <torusGeometry args={[0.58, 0.006, 10, 80]} />
        <meshBasicMaterial
          color={theme === "dark" ? "#e8e6e3" : "#262626"}
          transparent
          opacity={theme === "dark" ? 0.18 : 0.14}
        />
      </mesh>
    </group>
  )
}

function SecretGraph({
  reducedMotion,
  theme,
}: {
  reducedMotion: boolean
  theme: "light" | "dark"
}) {
  const groupRef = useRef<THREE.Group>(null)
  const positions = useMemo(
    () => nodePositions.map((position) => new THREE.Vector3(...position)),
    [],
  )
  const center = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return
    const targetRotation = Math.sin(state.clock.elapsedTime * 0.28) * 0.08
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotation,
      delta * 1.4,
    )
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={theme === "dark" ? 1.15 : 1.4} />
      <pointLight
        position={[0, 0, 3]}
        intensity={theme === "dark" ? 4 : 3}
        color="#ffffff"
      />
      <pointLight
        position={[-3, 2, 2]}
        intensity={theme === "dark" ? 1.5 : 1.2}
        color={theme === "dark" ? "#a3a3a3" : "#737373"}
      />

      <VaultCore reducedMotion={reducedMotion} theme={theme} />

      {positions.map((position, index) => (
        <Connector
          key={`connector-${index}`}
          from={position}
          to={center}
          opacity={index === 2 ? 0.28 : 0.16}
          color={theme === "dark" ? "#e8e6e3" : "#2a2a2a"}
        />
      ))}

      {nodePositions.map((position, index) => (
        <SecretNode
          key={`node-${index}`}
          position={position}
          index={index}
          reducedMotion={reducedMotion}
          theme={theme}
        />
      ))}
    </group>
  )
}

function HeroScene() {
  const reducedMotion = usePrefersReducedMotion()
  const { resolvedTheme } = useTheme()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-8%] inset-y-[-5%] overflow-visible"
    >
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        fallback={
          <div className="h-full w-full bg-[radial-gradient(circle_at_center,var(--glow-soft),transparent_58%)]" />
        }
      >
        <SecretGraph reducedMotion={reducedMotion} theme={resolvedTheme} />
      </Canvas>
    </div>
  )
}

export { HeroScene }
