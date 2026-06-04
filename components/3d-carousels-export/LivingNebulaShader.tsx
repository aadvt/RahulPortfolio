"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MotionValue } from 'framer-motion';

interface LivingNebulaShaderProps {
  rotationValue?: MotionValue<number> | any;
  className?: string;
}

const LivingNebulaShader: React.FC<LivingNebulaShaderProps> = ({ rotationValue, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1) Renderer, Scene, Camera, Clock
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock = new THREE.Clock();

    // 2) Shaders
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float u_rotation;

      float random(vec2 st) {
        return fract(
          sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123
        );
      }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(random(i), random(i + vec2(1.0, 0.0)), u.x),
          mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // Normalize to −1..1 on the shorter side
        vec2 uv    = (gl_FragCoord.xy - 0.5 * iResolution.xy)
                     / iResolution.y;

        // Apply scroll-linked parallax to background nebula coordinates
        uv.x += u_rotation * 0.0035;

        float t    = iTime * 0.1;

        // Rotate flow
        float angle = t * 0.3;
        mat2 rot = mat2(
          cos(angle), -sin(angle),
          sin(angle),  cos(angle)
        );
        vec2 p = rot * uv;

        // Two-layered cloud patterns
        float c1 = fbm(p * 2.0 + vec2(t, -t));
        float c2 = fbm(p * 4.0 - vec2(-t, t));

        // Black and red colors matching the 1st section background (#E3142A)
        vec3 deepSpace  = vec3(0.02, 0.0, 0.0);       // Very dark charcoal-black
        vec3 gasColor1  = vec3(0.89, 0.078, 0.165);   // Exact #E3142A Red
        vec3 gasColor2  = vec3(0.50, 0.020, 0.050);   // Deeper crimson red for dimensional shading
        vec3 color      = deepSpace;

        color = mix(color, gasColor1, smoothstep(0.52, 0.72, c1) * 0.85);
        color = mix(color, gasColor2, smoothstep(0.60, 0.80, c2) * 0.40);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // 3) Build Mesh
    const uniforms = {
      iTime:       { value: 0 },
      iResolution: { value: new THREE.Vector2() },
      u_rotation:  { value: 0 }
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    const mesh     = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    // 4) Resize Handler
    const onResize = () => {
      const width  = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      uniforms.iResolution.value.set(width, height);
    };
    window.addEventListener('resize', onResize);
    onResize();

    // 6) Animation Loop
    renderer.setAnimationLoop(() => {
      uniforms.iTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    });

    // 7) Scroll Parallax subscription
    let unsubscribe: (() => void) | undefined;
    if (rotationValue) {
      unsubscribe = rotationValue.on("change", (latest: number) => {
        uniforms.u_rotation.value = latest;
      });
      uniforms.u_rotation.value = rotationValue.get();
    }

    // 8) Cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.setAnimationLoop(null);
      if (unsubscribe) unsubscribe();

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
    };
  }, [rotationValue]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        zIndex:        -1,
        pointerEvents: 'none'
      }}
      aria-label="Living Nebula animated background"
    />
  );
};

export default LivingNebulaShader;
