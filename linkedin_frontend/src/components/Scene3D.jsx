import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Icosahedron, Torus, Octahedron, Sphere } from '@react-three/drei'
import * as THREE from 'three'

// One floating wireframe shape
function FloatingShape({ position, geometry, color, speed = 1, distort = 0.3, scale = 1 }) {
  const mesh = useRef()
  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.x = state.clock.elapsedTime * 0.12 * speed
    mesh.current.rotation.y = state.clock.elapsedTime * 0.18 * speed
  })

  return (
    <Float speed={speed * 1.5} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={mesh} position={position} scale={scale}>
        {geometry}
        <meshStandardMaterial
          color={color}
          wireframe
          transparent
          opacity={0.18}
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>
    </Float>
  )
}

// Large ambient blob
function AmbientBlob({ position, color }) {
  const mesh = useRef()
  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.x = state.clock.elapsedTime * 0.05
    mesh.current.rotation.z = state.clock.elapsedTime * 0.07
  })
  return (
    <Float speed={0.5} floatIntensity={0.4}>
      <mesh ref={mesh} position={position}>
        <sphereGeometry args={[2.4, 32, 32]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.06}
          distort={0.5}
          speed={1.5}
          roughness={0}
        />
      </mesh>
    </Float>
  )
}

// Mouse-reactive camera rig
function CameraRig() {
  const { camera, gl } = useThree()
  const mouse = useRef({ x: 0, y: 0 })

  useMemo(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    camera.position.x += (mouse.current.x * 0.8 - camera.position.x) * 0.04
    camera.position.y += (-mouse.current.y * 0.6 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Scene3D() {
  return (
    <div id="three-canvas">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <CameraRig />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} color="#6c63ff" intensity={2} />
        <pointLight position={[-10, -5, -10]} color="#2dd4bf" intensity={1} />

        {/* Ambient blobs (large, blurry) */}
        <AmbientBlob position={[-4, 2, -3]} color="#6c63ff" />
        <AmbientBlob position={[4, -2, -4]} color="#2dd4bf" />

        {/* Wireframe geometries scattered around */}
        <FloatingShape position={[-5, 3, -2]}  scale={1.1} speed={0.7} color="#6c63ff" geometry={<icosahedronGeometry args={[1, 1]} />} />
        <FloatingShape position={[5, -2, -3]}  scale={0.9} speed={1.1} color="#a78bfa" geometry={<octahedronGeometry args={[1, 0]} />} />
        <FloatingShape position={[3, 3.5, -4]} scale={0.7} speed={0.9} color="#2dd4bf" geometry={<torusGeometry args={[1, 0.35, 8, 16]} />} />
        <FloatingShape position={[-4, -3, -2]} scale={0.8} speed={1.3} color="#818cf8" geometry={<icosahedronGeometry args={[1, 0]} />} />
        <FloatingShape position={[0, -4, -3]}  scale={0.6} speed={0.6} color="#6c63ff" geometry={<octahedronGeometry args={[1, 1]} />} />
        <FloatingShape position={[-2, 1, -6]}  scale={1.4} speed={0.5} color="#a78bfa" geometry={<torusGeometry args={[1.2, 0.3, 6, 12]} />} />
        <FloatingShape position={[6, 1, -5]}   scale={1.0} speed={0.8} color="#2dd4bf" geometry={<icosahedronGeometry args={[1, 1]} />} />

        {/* Fog for depth */}
        <fog attach="fog" args={['#050508', 10, 25]} />
      </Canvas>
    </div>
  )
}
