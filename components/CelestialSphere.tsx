"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";

// =================================
//  1. The Shader Component
// =================================

interface CelestialSphereProps {
  hue?: number;
  speed?: number;
  zoom?: number;
  particleSize?: number;
  className?: string;
  rotationValue?: any;
}

export const CelestialSphere: React.FC<CelestialSphereProps> = ({
  hue = 200.0,
  speed = 0.3,
  zoom = 1.5,
  particleSize = 3.0,
  className = "",
  rotationValue,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;
    let scene: THREE.Scene, 
        camera: THREE.OrthographicCamera, 
        renderer: THREE.WebGLRenderer, 
        material: THREE.ShaderMaterial, 
        mesh: THREE.Mesh;
    let animationFrameId: number;

    // --- Shaders ---
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_hue;
      uniform float u_zoom;
      uniform float u_particle_size;
      uniform float u_rotation;

      // HSL to RGB conversion
      vec3 hsl2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      // 2D Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      // 2D Noise function
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
      }

      // Fractional Brownian Motion
      float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(st);
          st *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
        uv *= u_zoom;

        // Apply carousel rotation parallax to nebula coordinates
        uv.x += u_rotation * 0.0035;

        // Time-varying noise for nebula clouds
        float f = fbm(uv + vec2(u_time * 0.1, u_time * 0.05));
        float t = fbm(uv + f + vec2(u_time * 0.05, u_time * 0.02));
        
        // Final color calculation
        float nebula = pow(t, 2.0);
        vec3 color = hsl2rgb(vec3(u_hue / 360.0 + nebula * 0.12, 0.84, 0.48));
        color *= nebula * 2.5;

        // Starfield with slow parallax, gentle continuous drift, and time-based twinkling
        vec2 star_uv = vUv;
        star_uv.x += u_rotation * 0.0006 + u_time * 0.003;
        star_uv.y += u_time * 0.005;
        float star_val = random(star_uv * 500.0);
        if (star_val > 0.998) {
            float twinkle = 0.3 + 0.7 * sin(u_time * 8.0 + star_val * 1000.0);
            float star_brightness = ((star_val - 0.998) / 0.002) * twinkle;
            color += vec3(star_brightness * u_particle_size);
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // --- Scene Initialization ---
    const init = () => {
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      currentMount.appendChild(renderer.domElement);

      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          u_time: { value: 0.0 },
          u_resolution: { value: new THREE.Vector2() },
          u_hue: { value: hue },
          u_zoom: { value: zoom },
          u_particle_size: { value: particleSize },
          u_rotation: { value: 0.0 },
        },
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      addEventListeners();
      resize();
      animate();
    };

    // --- Animation Loop ---
    const animate = () => {
      material.uniforms.u_time.value += 0.005 * speed;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    // --- Event Handlers ---
    const resize = () => {
      const { clientWidth, clientHeight } = currentMount;
      renderer.setSize(clientWidth, clientHeight);
      material.uniforms.u_resolution.value.set(clientWidth, clientHeight);
      camera.updateProjectionMatrix();
    };

    const addEventListeners = () => {
      window.addEventListener("resize", resize);
    };

    const removeEventListeners = () => {
      window.removeEventListener("resize", resize);
    };

    init();

    // Sync rotation from Framer Motion Value directly
    let unsubscribe: (() => void) | undefined;
    if (rotationValue) {
      unsubscribe = rotationValue.on("change", (latest: number) => {
        if (material && material.uniforms.u_rotation) {
          material.uniforms.u_rotation.value = latest;
        }
      });
      material.uniforms.u_rotation.value = rotationValue.get();
    }

    // --- Cleanup ---
    return () => {
      removeEventListeners();
      cancelAnimationFrame(animationFrameId);
      if (unsubscribe) unsubscribe();
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [hue, speed, zoom, particleSize, rotationValue]);

  return <div ref={mountRef} className={className || "w-full h-full"} />;
};

export default CelestialSphere;
