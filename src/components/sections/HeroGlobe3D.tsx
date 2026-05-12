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

interface Route {
  name: string;
  curve: THREE.QuadraticBezierCurve3;
}

const ROUTES: Route[] = DESTINATIONS.filter((d) => d.name !== 'Hong Kong').map(
  (d) => {
    const start = new THREE.Vector3(...HONG_KONG_POSITION);
    const end = new THREE.Vector3(...d.position);
    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(2.5);
    return { name: d.name, curve: new THREE.QuadraticBezierCurve3(start, mid, end) };
  },
);

// Routes that get an animated cargo plane (subset to keep the scene readable).
const PLANE_ROUTE_INDICES = [0, 2, 3];

function Globe() {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0025;
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

      {/* Soft inner solid for depth */}
      <mesh>
        <sphereGeometry args={[1.72, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.02} />
      </mesh>

      {/* Destination markers */}
      {DESTINATIONS.map((d) => (
        <Dot key={d.name} position={d.position} color={d.color} />
      ))}

      {/* Dashed flight paths */}
      {ROUTES.map((r, i) => (
        <DashedArc key={`arc-${i}`} curve={r.curve} />
      ))}

      {/* Cargo planes flying along selected routes (ping-pong) */}
      {PLANE_ROUTE_INDICES.map((idx, i) => (
        <AnimatedPlane
          key={`plane-${idx}`}
          curve={ROUTES[idx].curve}
          duration={9 + i * 2.5}
          phase={i * 3.7}
        />
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

function DashedArc({ curve }: { curve: THREE.QuadraticBezierCurve3 }) {
  const line = useMemo(() => {
    const points = curve.getPoints(60);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: '#a3e635',
      dashSize: 0.06,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.75,
    });
    const ln = new THREE.Line(geometry, material);
    // Required for LineDashedMaterial to render gaps correctly.
    ln.computeLineDistances();
    return ln;
  }, [curve]);
  return <primitive object={line} />;
}

function CargoPlane() {
  // Forward direction in local space: -Z
  return (
    <group>
      {/* Fuselage (white body) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.16, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Nose cone — lime */}
      <mesh position={[0, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.022, 0.05, 10]} />
        <meshBasicMaterial color="#a3e635" />
      </mesh>
      {/* Main wings */}
      <mesh>
        <boxGeometry args={[0.22, 0.005, 0.05]} />
        <meshBasicMaterial color="#a3e635" />
      </mesh>
      {/* Vertical tail fin */}
      <mesh position={[0, 0.035, 0.07]}>
        <boxGeometry args={[0.005, 0.05, 0.04]} />
        <meshBasicMaterial color="#a3e635" />
      </mesh>
      {/* Horizontal stabilizer */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.07, 0.005, 0.03]} />
        <meshBasicMaterial color="#a3e635" />
      </mesh>
      {/* Engine pods under wings */}
      <mesh position={[0.08, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.08, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

function AnimatedPlane({
  curve,
  duration,
  phase,
}: {
  curve: THREE.QuadraticBezierCurve3;
  duration: number;
  phase: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const forward = useMemo(() => new THREE.Vector3(0, 0, -1), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!ref.current) return;
    // Ping-pong t in [0, 1] over a 2x duration cycle so the plane flies
    // HK -> destination -> HK seamlessly without teleport.
    const u = ((state.clock.elapsedTime + phase) / duration) % 2;
    const t = u < 1 ? u : 2 - u;

    const pos = curve.getPointAt(t);
    tangent.copy(curve.getTangentAt(t)).normalize();
    // Invert tangent on the return leg so the nose follows travel direction.
    if (u >= 1) tangent.multiplyScalar(-1);

    ref.current.position.copy(pos);
    quat.setFromUnitVectors(forward, tangent);
    ref.current.quaternion.copy(quat);
  });

  return (
    <group ref={ref}>
      <CargoPlane />
    </group>
  );
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

      {/* Soft lime glow behind the globe */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.15),transparent_60%)]"
      />
    </div>
  );
}
