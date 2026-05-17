"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec3 u_resolution;
    uniform vec3 u_color;
    uniform float u_color_opacity;
    uniform vec3 u_bg_color;
    uniform float u_bg_opacity;
    uniform sampler2D u_overlay;
    uniform vec3 u_overlay_color;
    uniform float u_shadow_strength;
    uniform float u_border_width;
    

    float patternThreshold(vec2 fragCoord, float gray) {
      float scale = 4.0;
      
      int x = int(mod(floor(fragCoord.x / scale), 4.0));
      int y = int(mod(floor(fragCoord.y / scale), 4.0));
      int idx = x + y * 4;
      float bayer[16];
      bayer[0]=0.0; bayer[1]=8.0; bayer[2]=2.0; bayer[3]=10.0;
      bayer[4]=12.0; bayer[5]=4.0; bayer[6]=14.0; bayer[7]=6.0;
      bayer[8]=3.0; bayer[9]=11.0; bayer[10]=1.0; bayer[11]=9.0;
      bayer[12]=15.0; bayer[13]=7.0; bayer[14]=13.0; bayer[15]=5.0;
      return step(bayer[idx] / 16.0, gray);
    }

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float val = 0.0;
      float amp = 0.5;
      float freq = 1.0;
      for (int i = 0; i < 5; i++) {
        val += amp * noise(p * freq);
        freq *= 2.0;
        amp *= 0.5;
        p += vec2(1.7, 9.2);
      }
      return val;
    }

    void mainImage(out vec4 col, in vec2 pc) {
      float time = u_time * 0.40;
      vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
      vec2 uv = pc / u_resolution.xy * aspect;
      float ns = 3.0;
      float wi = 4.0;

      vec2 q = vec2(
        fbm(uv * ns + vec2(0.0, 0.0) + time * 0.3),
        fbm(uv * ns + vec2(5.2, 1.3) - time * 0.2)
      );
      vec2 r = vec2(
        fbm(uv * ns + wi * q + vec2(1.7, 9.2) + time * 0.15),
        fbm(uv * ns + wi * q + vec2(8.3, 2.8) - time * 0.25)
      );
      float f = fbm(uv * ns + wi * r);

      float ridges = abs(sin(f * 12.0 + time));
      ridges = pow(ridges, 0.6);
      float veins = length(q - r) * 1.8;
      veins = smoothstep(0.0, 1.5, veins);
      float pattern = mix(ridges, veins, 0.4 + 0.2 * sin(time * 0.7));
      pattern = pow(pattern, 1.2);
      pattern = smoothstep(0.1, 0.95, pattern);
      col = vec4(vec3(pattern), 1.0);
    }

    vec2 overlayUV(vec2 uv, float ar) {
      vec2 o = uv;
      if (ar > 1.0) { o.x = 0.5 + (uv.x - 0.5) * ar; }
      else { o.y = 0.5 + (uv.y - 0.5) / ar; }
      return o;
    }

    float sampleMask(vec2 oUv) {
      if (oUv.x < 0.02 || oUv.x > 0.98 || oUv.y < 0.02 || oUv.y > 0.98) return 0.0;
      vec4 s = texture2D(u_overlay, oUv);
      return dot(s.rgb, vec3(0.299, 0.587, 0.114)) * s.a;
    }

    float blurShadow(vec2 oUv) {
      float sum = 0.0;
      for (int x = -5; x <= 5; x++) {
        for (int y = -5; y <= 5; y++) {
          vec2 off = vec2(float(x) * 0.004, float(y) * 0.004);
          off.x += 0.008;
          off.y += 0.012;
          sum += step(0.01, sampleMask(oUv + off));
        }
      }
      return sum / 121.0;
    }

    void main() {
      vec2 fragCoord = vUv * u_resolution.xy;
      float screenAR = u_resolution.x / u_resolution.y;
      vec2 oUv = overlayUV(vUv, screenAR);
      float mask = smoothstep(0.01, 0.05, sampleMask(oUv));
      float shadow = blurShadow(oUv);
      float shadowOnly = clamp(shadow - mask, 0.0, 1.0);

      vec4 baseRaw;
      mainImage(baseRaw, fragCoord);
      float baseGray = dot(baseRaw.rgb, vec3(0.299, 0.587, 0.114));
      float baseBw = patternThreshold(fragCoord, baseGray);
      vec3 baseCol = mix(u_bg_color, u_color, baseBw);

      vec3 shadowed = baseCol * mix(1.0, 0.3, shadowOnly * u_shadow_strength);

      vec2 innerOffset = vec2(347.0, 521.0);
      vec4 innerRaw;
      mainImage(innerRaw, fragCoord + innerOffset);
      float innerGray = dot(innerRaw.rgb, vec3(0.299, 0.587, 0.114));
      float innerBw = patternThreshold(fragCoord, innerGray);
      vec3 innerCol = mix(u_bg_color, u_color, innerBw);

      float bRadius = u_border_width * 0.004;
      float edgeMask = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 off = vec2(float(x), float(y)) * bRadius;
          edgeMask += step(0.01, sampleMask(oUv + off));
        }
      }
      edgeMask = edgeMask / 25.0;
      float edge = mask - edgeMask;
      float edgeOuter = edgeMask - mask;
      float edgeGlow = max(abs(edge), abs(edgeOuter));
      edgeGlow = smoothstep(0.0, 0.3, edgeGlow);

      vec3 innerLit = innerCol + 0.06;

      vec3 result = mix(shadowed, innerLit, mask);
      result = mix(result, u_color * 1.4 + 0.1, edgeGlow * u_border_width * 0.5);
      vec4 col = vec4(result, 1.0);
      
      gl_FragColor = col;
    }
  `;

function ShaderPlane() {
  const meshRef = useRef(null);
  const { size } = useThree();
  const uniforms = useMemo(() => ({
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector3(1, 1, 1) },
    u_color: { value: new THREE.Color("#FC5050") },
    u_color_opacity: { value: 1.00 },
    u_bg_color: { value: new THREE.Color("#000000") },
    u_bg_opacity: { value: 1.00 },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    mat.uniforms.u_time.value = state.clock.elapsedTime * 0.5;
    mat.uniforms.u_resolution.value.set(size.width, size.height, 1.0);
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function ShaderBackground({ className }) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas>
        <ShaderPlane />
      </Canvas>
    </div>
  );
}
