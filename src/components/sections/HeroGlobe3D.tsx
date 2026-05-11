'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function sphericalToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number,
): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = -radius * Math.cos(lat) * Math.sin(lon);
  return [x, y, z];
}

const HONG_KONG_POSITION: [number, number, number] = sphericalToCartesian(
  22.3,
  114.2,
  1.85,
);

const DESTINATIONS: {
  name: string;
  position: [number, number, number];
  color: string;
}[] = [
  { name: 'Libreville', position: sphericalToCartesian(0.4, 9.4, 1.85), color: '#a3e635' },
  { name: 'Lagos', position: sphericalToCartesian(6.5, 3.4, 1.85), color: '#a3e635' },
  { name: 'Abidjan', position: sphericalToCartesian(5.3, -4.0, 1.85), color: '#a3e635' },
  { name: 'Paris', position: sphericalToCartesian(48.8, 2.3, 1.85), color: '#a3e635' },
  { name: 'Dakar', position: sphericalToCartesian(14.7, -17.4, 1.85), color: '#a3e635' },
  { name: 'Hong Kong', position: HONG_KONG_POSITION, color: '#ffffff' },
];

function Globe() {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0035;
      groupRef.current.rotation.x = Math.sin(Date.now() * 0.0002) * 0.15;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= 0.001;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main wireframe sphere — slate */}
      <mesh>
        <sphereGeometry args={[1.8, 36, 36]} />
        <meshBasicMaterial color="#0f172a" wireframe transparent opacity={0.18} />
      </mesh>

      {/* Inner lime sphere — accent */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[1.78, 12, 12]} />
        <meshBasicMaterial color="#a3e635" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Solid inner sphere for depth */}
      <mesh>
        <sphereGeometry args={[1.72, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.02} />
      </mesh>

      {/* Destination dots */}
      {DESTINATIONS.map((d, i) => (
        <Dot key={d.name + i} position={d.position} color={d.color} />
      ))}

      {/* Arcs connecting Hong Kong → destinations */}
      {DESTINATIONS.filter((d) => d.name !== 'Hong Kong').map((d, i) => (
        <Arc key={`arc-${i}`} from={HONG_KONG_POSITION} to={d.position} />
      ))}
    </group>
  );
}

function Dot({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function Arc({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const line = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(2.5);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(40);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: '#a3e635',
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geometry, material);
  }, [from, to]);

  return <primitive object={line} />;
}

export default function HeroGlobe3D() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.8} />
        <Globe />
      </Canvas>

      {/* Soft glow behind globe */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.15),transparent_60%)]"
      />
    </div>
  );
}
