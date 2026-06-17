"use client";

import React, { useRef, useMemo, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Stars, Cloud, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from "three";

// Pre-created geometry for massive instancing performance
const GlobalBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

function CustomCity() {
  const { scene } = useGLTF("/models/city.glb");
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);
  return <primitive object={scene} />;
}

function AAAGreebleCity() {
  const { coreMatrices, greebleMatrices, neonMatrices, neonColors } = useMemo(() => {
    const cores = [];
    const greebles = [];
    const neons = [];
    const colors = [];
    
    const dummy = new THREE.Object3D();
    const cDummy = new THREE.Color();
    const palette = ["#00ffff", "#ff00ff", "#ffaa00", "#39ff14", "#ff0033", "#ffffff"];

    // Seeded RNG
    let seed = 1234.5;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const instancesCount = 150; 
    const radius = 140;
    
    // Helper to generate a solid block and optionally greeble it
    const addBlock = (x, y, z, w, h, d, skipGreebles = false) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      cores.push(dummy.matrix.clone());

      if (skipGreebles) return;

      const neonBaseColor = palette[Math.floor(rnd() * palette.length)];
      
      const floorHeight = 1.5 + rnd() * 1.5;
      const floors = Math.floor(h / floorHeight);
      
      // We only greeble if the block is wide enough
      if (w > 2 && d > 2) {
        const colsX = Math.floor(w / (1.5 + rnd()));
        const colsZ = Math.floor(d / (1.5 + rnd()));

        for(let f=0; f<floors; f++) {
           const fy = y - h/2 + (f + 0.5) * floorHeight;
           
           // Front & Back (Z)
           for(let c=0; c<colsX; c++) {
              if (rnd() > 0.8) continue; // Gap
              const cx = x - w/2 + (c + 0.5) * (w / colsX);
              const isNeon = rnd() > 0.95;
              const gw = (w / colsX) * 0.8;
              const gh = floorHeight * 0.8;
              
              // Front
              dummy.position.set(cx, fy, z + d/2 + 0.2);
              dummy.scale.set(gw, gh, 0.4);
              dummy.updateMatrix();
              if (isNeon) { 
                neons.push(dummy.matrix.clone()); 
                cDummy.set(neonBaseColor).multiplyScalar(2.0); // Multiply for intense bloom
                colors.push(cDummy.r, cDummy.g, cDummy.b); 
              } else greebles.push(dummy.matrix.clone());

              // Back
              dummy.position.set(cx, fy, z - d/2 - 0.2);
              dummy.updateMatrix();
              if (isNeon) { 
                neons.push(dummy.matrix.clone()); 
                cDummy.set(neonBaseColor).multiplyScalar(2.0); 
                colors.push(cDummy.r, cDummy.g, cDummy.b); 
              } else greebles.push(dummy.matrix.clone());
           }

           // Left & Right (X)
           for(let c=0; c<colsZ; c++) {
              if (rnd() > 0.8) continue;
              const cz = z - d/2 + (c + 0.5) * (d / colsZ);
              const isNeon = rnd() > 0.95;
              const gw = (d / colsZ) * 0.8;
              const gh = floorHeight * 0.8;
              
              // Right
              dummy.position.set(x + w/2 + 0.2, fy, cz);
              dummy.scale.set(0.4, gh, gw);
              dummy.updateMatrix();
              if (isNeon) { 
                neons.push(dummy.matrix.clone()); 
                cDummy.set(neonBaseColor).multiplyScalar(2.0); 
                colors.push(cDummy.r, cDummy.g, cDummy.b); 
              } else greebles.push(dummy.matrix.clone());

              // Left
              dummy.position.set(x - w/2 - 0.2, fy, cz);
              dummy.updateMatrix();
              if (isNeon) { 
                neons.push(dummy.matrix.clone()); 
                cDummy.set(neonBaseColor).multiplyScalar(2.0); 
                colors.push(cDummy.r, cDummy.g, cDummy.b); 
              } else greebles.push(dummy.matrix.clone());
           }
        }
      }

      // Add Industrial Pipes / Vents
      const numPipes = Math.floor(rnd() * 3);
      for(let p=0; p<numPipes; p++) {
         const isX = rnd() > 0.5;
         const sign = rnd() > 0.5 ? 1 : -1;
         const pRad = 0.5 + rnd() * 1.5;
         if (isX) {
            dummy.position.set(x + sign * (w/2 + pRad/2), y, z + (rnd()-0.5)*d);
            dummy.scale.set(pRad, h * 0.95, pRad);
         } else {
            dummy.position.set(x + (rnd()-0.5)*w, y, z + sign * (d/2 + pRad/2));
            dummy.scale.set(pRad, h * 0.95, pRad);
         }
         dummy.updateMatrix();
         greebles.push(dummy.matrix.clone());
      }
    };

    for (let i = 0; i < instancesCount; i++) {
      const x = (rnd() - 0.5) * radius * 2;
      const z = (rnd() - 0.5) * radius * 2 - 10;
      // Keep center open, but allow background building(s) in the middle distance
      if (Math.abs(x) < 55) {
        if (z < 30 || z > 70 || Math.abs(x) > 15) continue;
      }

      const archetype = Math.floor(rnd() * 5);
      const w = 8 + rnd() * 12;
      const d = 8 + rnd() * 12;
      const h = 50 + rnd() * 120;
      const yBase = h/2;

      if (archetype === 0) {
        // Brutalist Monolith
        addBlock(x, h*0.2, z, w*1.5, h*0.4, d*1.5);
        addBlock(x, h*0.6, z, w*1.2, h*0.4, d*1.2);
        addBlock(x, h*0.9, z, w, h*0.2, d);
      } else if (archetype === 1) {
        // Cyber-Needle
        addBlock(x, yBase, z, w*0.4, h, d*0.4);
        addBlock(x, h*0.6, z, w*0.8, h*0.05, d*0.8);
        addBlock(x, h + 15, z, 1, 30, 1, true); // Spire
      } else if (archetype === 2) {
        // Nexus Twins
        const gap = w * 0.8;
        addBlock(x - gap, yBase, z, w*0.6, h, d*0.6);
        addBlock(x + gap, yBase, z, w*0.6, h, d*0.6);
        addBlock(x, h*0.4, z, gap*2, h*0.05, d*0.4, true); // Bridge
        addBlock(x, h*0.8, z, gap*2, h*0.05, d*0.4, true); // Bridge
      } else if (archetype === 3) {
        // Arcology Stack
        let curY = 0;
        for(let s=0; s<6; s++) {
          const sh = h * (0.1 + rnd()*0.1);
          const sw = w * (0.5 + rnd()*0.8);
          const sd = d * (0.5 + rnd()*0.8);
          addBlock(x + (rnd()-0.5)*w*0.5, curY + sh/2, z + (rnd()-0.5)*d*0.5, sw, sh, sd);
          curY += sh;
        }
      } else {
        // Mega-Corp
        addBlock(x, yBase, z, w, h, d);
        addBlock(x, h*0.7, z + d/2 + 1, w*1.2, h*0.3, 2);
      }
    }

    return { 
      coreMatrices: new Float32Array(cores.flatMap(m => Array.from(m.elements))), 
      greebleMatrices: new Float32Array(greebles.flatMap(m => Array.from(m.elements))), 
      neonMatrices: new Float32Array(neons.flatMap(m => Array.from(m.elements))), 
      neonColors: new Float32Array(colors) 
    };
  }, []);

  const neonRef = useRef();

  useEffect(() => {
    if (neonRef.current) {
      neonRef.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(neonColors, 3));
    }
  }, [neonColors]);

  return (
    <group rotation={[Math.PI, 0, 0]} position={[0, 90, -75]} scale={[0.5, 0.5, 0.5]}>
      {/* MASSIVE CORE STRUCTURES */}
      <instancedMesh args={[GlobalBoxGeometry, null, coreMatrices.length / 16]} castShadow receiveShadow>
        <instancedBufferAttribute attach="instanceMatrix" args={[coreMatrices, 16]} />
        <meshStandardMaterial color="#08080a" roughness={0.7} metalness={0.6} />
      </instancedMesh>

      {/* TENS OF THOUSANDS OF GREEBLES (WINDOWS, PIPES, LEDGES) */}
      <instancedMesh args={[GlobalBoxGeometry, null, greebleMatrices.length / 16]} castShadow receiveShadow>
        <instancedBufferAttribute attach="instanceMatrix" args={[greebleMatrices, 16]} />
        <meshStandardMaterial color="#050505" roughness={0.4} metalness={0.9} />
      </instancedMesh>

      {/* NEON GLOWING SIGNS & STRIPS */}
      <instancedMesh ref={neonRef} args={[GlobalBoxGeometry, null, neonMatrices.length / 16]}>
        <instancedBufferAttribute attach="instanceMatrix" args={[neonMatrices, 16]} />
        <meshBasicMaterial toneMapped={false} vertexColors />
      </instancedMesh>
    </group>
  );
}

// --- VOLUMETRIC CYBER TRAFFIC ---
function CyberTraffic() {
  const count = 200;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cars = useMemo(() => {
    return Array.from({ length: count }, () => {
      const c = new THREE.Color(Math.random() > 0.5 ? "#00ffff" : (Math.random() > 0.5 ? "#ff00ff" : "#ffaa00"));
      c.multiplyScalar(2.5); // Boost for Bloom
      return {
        x: (Math.random() - 0.5) * 60,
        y: 10 + Math.random() * 40,
        z: (Math.random() - 0.5) * 100,
        speed: (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 100),
        color: c
      };
    });
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      cars.forEach((car, i) => meshRef.current.setColorAt(i, car.color));
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [cars]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      cars.forEach((car, i) => {
        car.z += car.speed * delta;
        if (car.z > 50) car.z = -50;
        if (car.z < -50) car.z = 50;

        dummy.position.set(car.x, car.y + 40, car.z - 10);
        dummy.scale.set(0.1, 0.1, Math.abs(car.speed) * 0.15); 
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[GlobalBoxGeometry, null, count]}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// --- HOLOGRAPHIC PROJECTIONS ---
function Holograms() {
  const ringRef = useRef();
  const geoRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.sin(t * 0.2) * 0.2 + Math.PI / 2;
      ringRef.current.rotation.z = t * 0.3;
    }
    if (geoRef.current) {
      geoRef.current.rotation.y = -t * 0.5;
      geoRef.current.rotation.x = Math.sin(t) * 0.2;
    }
  });

  return (
    <group position={[0, 75, -45]} scale={[0.5, 0.5, 0.5]}>
      <mesh ref={ringRef} position={[0, -10, -20]}>
        <torusGeometry args={[30, 0.1, 16, 100]} />
        <meshBasicMaterial color={[0, 2, 2]} transparent opacity={0.3} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={geoRef} position={[-15, 0, -15]}>
        <icosahedronGeometry args={[5, 1]} />
        <meshBasicMaterial color={[2, 0, 2]} transparent opacity={0.15} wireframe blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// --- CHARACTER & BILLBOARD ---
function NeonBillboard() {
  return (
    <group position={[25, 65, -55]} rotation={[0, -0.3, 0]} scale={[0.8, 0.8, 0.8]}>
      <mesh>
        <planeGeometry args={[6, 20]} />
        <meshBasicMaterial color={[2, 0, 0.5]} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0, 0.1]}
        rotation={[0, 0, Math.PI / 2]}
        fontSize={2.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        characters="RAHUL®"
      >
        RAHUL®
      </Text>
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[6.2, 20.2]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function FallingCharacter() {
  const group = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = 8 + Math.sin(t * 2) * 0.5;
      group.current.rotation.z = Math.sin(t * 1.5) * 0.05;
      group.current.rotation.x = Math.sin(t * 1.2) * 0.05 - Math.PI / 2 + 0.2; 
    }
  });

  return (
    <group ref={group} position={[0, 8, 5]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.2, 1.8, 0.8]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color="#E3142A" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.3, 0.45]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[-1.2, 0.5, 0.2]} rotation={[0, 0, Math.PI / 3]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 1.8]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
      <mesh position={[1.2, 0.5, 0.2]} rotation={[0, 0, -Math.PI / 3]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 1.8]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
      <group position={[-0.4, -1, 0]}>
        <mesh position={[0, -0.6, 0]} rotation={[0.2, 0, 0.2]} castShadow>
          <cylinderGeometry args={[0.25, 0.2, 1.4]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.1, -1.4, 0.2]}>
          <boxGeometry args={[0.4, 0.3, 0.7]} />
          <meshStandardMaterial color="#E3142A" />
        </mesh>
      </group>
      <group position={[0.4, -1, 0]}>
        <mesh position={[0, -0.8, -0.2]} rotation={[-0.1, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.25, 0.2, 1.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.1, -1.8, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.7]} />
          <meshStandardMaterial color="#E3142A" />
        </mesh>
      </group>
    </group>
  );
}

// --- ATMOSPHERICS & CAMERA ---
function ScrollReactiveSky() {
  const skyRef = useRef();
  const lastScroll = useRef(0);
  const speed = useRef(0);
  const scrollY = useRef(0);

  const skyShader = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSpeed: { value: 0 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform float uSpeed;
      varying vec3 vWorldPosition;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 4; ++i) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float phi = atan(dir.z, dir.x);
        float theta = acos(dir.y);
        vec2 uv = vec2(phi / (2.0 * 3.141592), theta / 3.141592);

        // Nebula Clouds
        vec2 nebulaUv = uv * 3.0;
        nebulaUv.y -= uTime * 0.02 - uScroll * 0.01;
        float n = fbm(nebulaUv + fbm(nebulaUv + uTime * 0.05));
        
        vec3 nebulaColor1 = vec3(0.01, 0.005, 0.03); // Dark space violet
        vec3 nebulaColor2 = vec3(0.08, 0.01, 0.12);  // Rich purple nebula
        vec3 nebulaColor3 = vec3(0.04, 0.02, 0.08);  // Deep blue glow
        
        vec3 nebula = mix(nebulaColor1, nebulaColor2, n);
        nebula += nebulaColor3 * fbm(nebulaUv * 2.0 - uTime * 0.03) * 0.5;

        // Reactive Starfield
        vec3 stars = vec3(0.0);

        // Layer 1: Distant Stars
        vec2 starUv1 = uv * 60.0;
        starUv1.y -= uScroll * 0.03 + uTime * 0.08;
        
        float stretch1 = 1.0 + uSpeed * 4.0;
        vec2 gridId1 = floor(starUv1);
        vec2 gridUv1 = fract(starUv1) - 0.5;
        gridUv1.y /= stretch1;

        float starHash1 = hash(gridId1);
        if (starHash1 > 0.96) {
          float size = 0.06 * (1.0 + sin(uTime * 2.0 + starHash1 * 10.0) * 0.3);
          float dist = length(gridUv1);
          float glow = smoothstep(size, 0.0, dist);
          stars += vec3(glow) * vec3(0.7, 0.85, 1.0);
        }

        // Layer 2: Close Stars (stretches more, faster parallax)
        vec2 starUv2 = uv * 30.0;
        starUv2.y -= uScroll * 0.08 + uTime * 0.2;
        
        float stretch2 = 1.0 + uSpeed * 12.0;
        vec2 gridId2 = floor(starUv2);
        vec2 gridUv2 = fract(starUv2) - 0.5;
        gridUv2.y /= stretch2;

        float starHash2 = hash(gridId2);
        if (starHash2 > 0.975) {
          float size = 0.10 * (1.0 + sin(uTime * 3.0 + starHash2 * 10.0) * 0.5);
          float dist = length(gridUv2);
          float glow = smoothstep(size, 0.0, dist);
          stars += vec3(glow) * vec3(1.0, 0.5, 0.75) * 1.5; // Neon pink stars
        }

        vec3 spaceColor = vec3(0.002, 0.001, 0.005);
        vec3 finalColor = spaceColor + nebula * 1.2 + stars;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  }), []);

  useFrame((state, delta) => {
    const currentScroll = typeof window !== "undefined" ? window.scrollY : 0;
    const deltaScroll = currentScroll - lastScroll.current;
    lastScroll.current = currentScroll;

    // Smooth scroll speed calculation
    speed.current = THREE.MathUtils.lerp(speed.current, Math.abs(deltaScroll) * 0.15, 0.1);
    
    // Animate overall scroll-based position offset (simulating character descent)
    scrollY.current += deltaScroll;

    if (skyRef.current) {
      skyRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
      skyRef.current.material.uniforms.uScroll.value = scrollY.current;
      skyRef.current.material.uniforms.uSpeed.value = speed.current;
    }
  });

  return (
    <mesh ref={skyRef} scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={skyShader} attach="material" />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 10, 20));
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame(() => {
    target.current.x = mouse.current.x * 5;
    target.current.y = mouse.current.y * 5 + 10; 

    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const scrollEffect = scrollY * 0.02;

    target.current.z = 25 - scrollEffect * 4;
    
    camera.position.lerp(target.current, 0.05);
    camera.lookAt(0, 15, -10); 
  });

  return null;
}

export default function InvertedCityBackground({ className }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: -1 }}>

      <Canvas
        camera={{ position: [0, 10, 25], fov: 60 }}
        dpr={isMobile ? 1 : [1, 2]} 
        gl={{ antialias: !isMobile, alpha: false, powerPreference: "high-performance" }}
        shadows
      >
        <color attach="background" args={["#010103"]} />
        <fog attach="fog" args={["#010103", 50, 450]} />
        
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 30, 10]} intensity={1.5} color="#ffffff" castShadow />
        <pointLight position={[0, -5, -5]} intensity={5} color="#E3142A" distance={50} castShadow />

        <ScrollReactiveSky />
        <group 
          rotation={[3.1416, 2.5482, 0.0000]} 
          position={[280, 159, -102]} 
          scale={[1, 1, 1]}
        >
          <Suspense fallback={null}>
            <CustomCity />
          </Suspense>
        </group>
        {/* <CyberTraffic /> */}
        {/* <Holograms /> */}
        {/* <NeonBillboard /> */}
        <FallingCharacter />
        <CameraRig />

        <EffectComposer multisampling={isMobile ? 0 : 4}>
          <Bloom luminanceThreshold={0.9} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/city.glb");
