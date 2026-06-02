"use client";

import React, { useEffect, useRef } from 'react';

// --- VERTEX SHADER ---
const vertexShaderSource = `#version 300 es
precision highp float;
in vec4 position;
void main() {
  gl_Position = position;
}`;

// --- FRAGMENT SHADER ---
// A fluid, premium domain-warped smoke shader.
// Reacts to time, mouse (swirl + ripple), and u_rotation (parallax horizontal translation and subtle twist).
const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 O;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color;
uniform vec2 u_mouse;
uniform float u_velocity;
uniform float u_rotation;

#define FC gl_FragCoord.xy
#define R u_resolution
#define T (u_time + 660.0)

float rnd(vec2 p) {
  p = fract(p * vec2(12.9898, 78.233));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(rnd(i), rnd(i + vec2(1.0, 0.0)), u.x),
    mix(rnd(i + vec2(0.0, 1.0)), rnd(i + 1.0), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float t = 0.0;
  float a = 1.0;
  for(int i = 0; i < 5; i++) {
    t += a * noise(p);
    p = mat2(1.0, -1.2, 0.2, 1.2) * p * 2.0;
    a *= 0.5;
  }
  return t;
}

void main() {
  // Normal coordinate space
  vec2 uv = (FC - 0.5 * R) / R.y;
  vec3 col = vec3(1.0);

  // Smooth mouse coordinates mapping (in isotropic/unscaled screen space)
  vec2 m = u_mouse;
  
  // Custom Fluid Oil-Paint-in-Water Warp calculated in isotropic space
  vec2 diff = uv - m;
  float d = length(diff);
  
  // Swirl shear force rotation driven strictly by velocity
  float swirl = u_velocity * 4.0 * exp(-d * 10.0);
  float c = cos(swirl);
  float s = sin(swirl);
  mat2 rot = mat2(c, -s, s, c);
  
  // Apply swirl rotation and velocity-responsive micro-ripple in isotropic space
  uv = m + rot * diff;
  
  float ripple = sin(d * 42.0 - u_time * 8.0) * (u_velocity * 0.16) * exp(-d * 10.0);
  uv += (diff / (d + 0.0001)) * ripple;

  // --- CAROUSEL ROTATION REACTIVITY ---
  // Translate coordinate space horizontally (cylindrical wrap) based on u_rotation
  float rotOffset = u_rotation * 0.0035; 
  uv.x += rotOffset;
  
  // Subtle twist/skew rotation based on u_rotation
  float twistAngle = u_rotation * 0.0008;
  float tc = cos(twistAngle);
  float ts = sin(twistAngle);
  mat2 twistRot = mat2(tc, -ts, ts, tc);
  uv = twistRot * uv;

  // Post-interaction offset and stretch for noise texture lookup
  uv.x += 0.25;
  uv *= vec2(2.0, 1.0);

  // Sweep the background smoke organically
  float n = fbm(uv * 0.28 - vec2(T * 0.035, T * 0.015));
  n = noise(uv * 1.8 + n * 2.0);

  // Subtraction scaling (* 0.76) preserves rich midtones and keeps the smoke vibrant
  col.r -= fbm(uv + vec2(T * 0.02, T * 0.045) + n) * 0.76;
  col.g -= fbm(uv * 1.003 + vec2(T * 0.02, T * 0.045) + n + 0.003) * 0.76;
  col.b -= fbm(uv * 1.006 + vec2(T * 0.02, T * 0.045) + n + 0.006) * 0.76;

  col = mix(col, u_color, dot(col, vec3(0.21, 0.71, 0.07)));

  col = mix(vec3(0.04), col, min(u_time * 0.15, 1.0));
  col = clamp(col, 0.04, 1.0);
  
  O = vec4(col, 1.0);
}`;

// --- GL RENDERER WORKER CLASS ---
class GLRenderer {
  constructor(canvas, vertexSrc, fragmentSrc) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.buffer = null;
    
    // Uniform states
    this.color = [0.988, 0.314, 0.314]; // Default red #FC5050
    this.rotation = 0.0;
    this.time = 0.0;
    
    // Mouse states (smoothed)
    this.mouse = [0.0, 0.0];
    this.targetMouse = [0.0, 0.0];
    this.velocity = 0.0;
    this.targetVelocity = 0.0;

    if (this.gl) {
      this.setup(vertexSrc, fragmentSrc);
      this.init();
    }
  }

  updateColor(rgb) {
    this.color = rgb;
  }

  updateRotation(val) {
    this.rotation = val;
  }

  updateMouse(x, y, speed) {
    this.targetMouse[0] = x;
    this.targetMouse[1] = y;
    // Increase target velocity based on mouse speed, cap at 1.8
    this.targetVelocity = Math.min(1.8, this.targetVelocity + speed * 5.0);
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2.0); // Cap DPR at 2 for performance
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  compile(shader, source) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    }
  }

  setup(vertexSrc, fragmentSrc) {
    const gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    this.program = gl.createProgram();
    
    this.compile(this.vs, vertexSrc);
    this.compile(this.fs, fragmentSrc);
    
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(this.program));
    }
  }

  init() {
    const gl = this.gl;
    const vertices = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    const position = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    
    // Bind uniform locations
    Object.assign(this.program, {
      u_resolution: gl.getUniformLocation(this.program, "u_resolution"),
      u_time: gl.getUniformLocation(this.program, "u_time"),
      u_color: gl.getUniformLocation(this.program, "u_color"),
      u_mouse: gl.getUniformLocation(this.program, "u_mouse"),
      u_velocity: gl.getUniformLocation(this.program, "u_velocity"),
      u_rotation: gl.getUniformLocation(this.program, "u_rotation")
    });
  }

  render(timestamp = 0) {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program || !gl.isProgram(program)) return;

    // Smooth mouse coordinates (lerp)
    this.mouse[0] += (this.targetMouse[0] - this.mouse[0]) * 0.06;
    this.mouse[1] += (this.targetMouse[1] - this.mouse[1]) * 0.06;

    // Lerp velocity & exponential decay
    this.velocity += (this.targetVelocity - this.velocity) * 0.08;
    this.targetVelocity *= 0.93;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    
    gl.uniform2f(program.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(program.u_time, timestamp * 1e-3);
    gl.uniform3fv(program.u_color, this.color);
    gl.uniform2f(program.u_mouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(program.u_velocity, this.velocity);
    gl.uniform1f(program.u_rotation, this.rotation);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    const gl = this.gl;
    const program = this.program;
    if (!gl) return;
    if (this.vs) { gl.detachShader(program, this.vs); gl.deleteShader(this.vs); }
    if (this.fs) { gl.detachShader(program, this.fs); gl.deleteShader(this.fs); }
    if (this.buffer) { gl.deleteBuffer(this.buffer); }
    if (program) gl.deleteProgram(program);
  }
}

// Convert HEX color to normalized RGB float array
const hexToRgb = (hex) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
};

export default function CarouselShaderBackground({ className, rotationValue, smokeColor = "#FC5050" }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  // Initialize WebGL background
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const renderer = new GLRenderer(canvas, vertexShaderSource, fragmentShaderSource);
    rendererRef.current = renderer;
    
    // Set initial size
    renderer.resize();
    
    // Set initial color
    const rgb = hexToRgb(smokeColor);
    if (rgb) renderer.updateColor(rgb);

    const handleResize = () => {
      if (rendererRef.current) {
        rendererRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    
    const handleMouseMove = (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Map coordinates to -0.5 to 0.5 range, corrected for screen aspect
      const mx = (x - rect.width * 0.5) / rect.height;
      const my = -(y - rect.height * 0.5) / rect.height;
      
      // Calculate mouse speed for wave velocity influence
      const dx = mx - renderer.targetMouse[0];
      const dy = my - renderer.targetMouse[1];
      const speed = Math.sqrt(dx * dx + dy * dy);
      
      renderer.updateMouse(mx, my, speed);
    };
    window.addEventListener('mousemove', handleMouseMove);

    let frameId;
    const tick = (now) => {
      renderer.render(now);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Sync color changes dynamically
  useEffect(() => {
    const rgb = hexToRgb(smokeColor);
    if (rendererRef.current && rgb) {
      rendererRef.current.updateColor(rgb);
    }
  }, [smokeColor]);

  // Sync rotation from Framer Motion Value directly on the GPU loop (bypasses React renders)
  useEffect(() => {
    if (!rotationValue) return;
    
    const unsubscribe = rotationValue.on("change", (latest) => {
      if (rendererRef.current) {
        rendererRef.current.updateRotation(latest);
      }
    });
    
    // Pass the initial value
    if (rendererRef.current) {
      rendererRef.current.updateRotation(rotationValue.get());
    }

    return () => unsubscribe();
  }, [rotationValue]);

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: "100%", 
          height: "100%", 
          display: "block",
          position: "absolute",
          top: 0,
          left: 0
        }} 
      />
    </div>
  );
}
