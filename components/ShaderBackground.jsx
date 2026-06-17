"use client";

import React, { useEffect, useRef } from 'react';

// --- FRAGMENT SHADER (desktop — 5 FBM octaves, full swirl/ripple) ---
const fragmentShaderDesktop = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;
uniform vec2 u_mouse;
uniform float u_velocity;

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);

  vec2 m = u_mouse;
  vec2 diff = uv - m;
  float d = length(diff);

  float swirl = u_velocity * 4.0 * exp(-d * 10.0);
  float c = cos(swirl);
  float s = sin(swirl);
  mat2 rot = mat2(c, -s, s, c);
  uv = m + rot * diff;

  float ripple = sin(d * 42.0 - time * 8.0) * (u_velocity * 0.16) * exp(-d * 10.0);
  uv += (diff / (d + 0.0001)) * ripple;

  uv.x+=.25;
  uv*=vec2(2,1);

  float n=fbm(uv*.28-vec2(T*.035, T*.015));
  n=noise(uv*1.8+n*2.);

  col.r-=fbm(uv+vec2(T*.02, T*.045)+n)*0.76;
  col.g-=fbm(uv*1.003+vec2(T*.02, T*.045)+n+.003)*0.76;
  col.b-=fbm(uv*1.006+vec2(T*.02, T*.045)+n+.006)*0.76;

  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));
  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`;

// --- FRAGMENT SHADER (mobile — 3 FBM octaves, no swirl/ripple, no mouse) ---
const fragmentShaderMobile = `#version 300 es
precision mediump float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;
uniform vec2 u_mouse;
uniform float u_velocity;

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<3;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);

  uv.x+=.25;
  uv*=vec2(2,1);

  float n=fbm(uv*.28-vec2(T*.035, T*.015));
  n=noise(uv*1.8+n*2.);

  col.r-=fbm(uv+vec2(T*.02, T*.045)+n)*0.76;
  col.g-=fbm(uv*1.003+vec2(T*.02, T*.045)+n+.003)*0.76;
  col.b-=fbm(uv*1.006+vec2(T*.02, T*.045)+n+.006)*0.76;

  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));
  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`;

// --- RENDERER CLASS ---
class Renderer {
  constructor(canvas, fragmentSource, isMobile) {
    this.vertexSrc = "#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}";
    this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
    
    this.canvas = canvas;
    this.isMobile = isMobile;
    this.gl = canvas.getContext("webgl2", { powerPreference: isMobile ? "low-power" : "default" });
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.buffer = null;
    this.color = [0.5, 0.5, 0.5];
    
    this.mouse = [0.0, 0.0];
    this.targetMouse = [0.0, 0.0];
    this.velocity = 0.0;
    this.targetVelocity = 0.0;

    // Frame throttling for mobile (target 30fps)
    this._lastFrameTime = 0;
    this._frameInterval = isMobile ? 1000 / 30 : 0; // 0 = unlimited

    this.setup(fragmentSource);
    this.init();
  }
  
  updateColor(newColor) {
    this.color = newColor;
  }

  updateMouse(x, y, speed) {
    if (this.isMobile) return; // No mouse on touch
    this.targetMouse[0] = x;
    this.targetMouse[1] = y;
    this.targetVelocity = Math.min(1.5, this.targetVelocity + speed * 6.0);
  }

  updateScale() {
    if (!this.gl) return;
    const dpr = this.isMobile ? 0.75 : Math.min(1.5, window.devicePixelRatio || 1);
    const { innerWidth: width, innerHeight: height } = window;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  compile(shader, source) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`Shader compilation error: ${gl.getShaderInfoLog(shader)}`);
    }
  }

  reset() {
    const { gl, program, vs, fs } = this;
    if (!gl || !program) return;
    if (vs) { gl.detachShader(program, vs); gl.deleteShader(vs); }
    if (fs) { gl.detachShader(program, fs); gl.deleteShader(fs); }
    gl.deleteProgram(program);
    this.program = null;
  }

  setup(fragmentSource) {
    const gl = this.gl;
    if (!gl) return;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!this.vs || !this.fs || !program) return;
    this.compile(this.vs, this.vertexSrc);
    this.compile(this.fs, fragmentSource);
    this.program = program;
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error(`Program linking error: ${gl.getProgramInfoLog(this.program)}`);
    }
  }

  init() {
    const { gl, program } = this;
    if (!gl || !program) return;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    Object.assign(program, {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      u_color: gl.getUniformLocation(program, "u_color"),
      u_mouse: gl.getUniformLocation(program, "u_mouse"),
      u_velocity: gl.getUniformLocation(program, "u_velocity"),
    });
  }

  render(now = 0) {
    // Throttle: skip frames on mobile to stay at ~30fps
    if (this._frameInterval > 0) {
      if (now - this._lastFrameTime < this._frameInterval) return;
    }
    this._lastFrameTime = now;

    const { gl, program, buffer, canvas } = this;
    if (!gl || !program || !gl.isProgram(program)) return;
    
    // Only lerp mouse on desktop
    if (!this.isMobile) {
      this.mouse[0] += (this.targetMouse[0] - this.mouse[0]) * 0.08;
      this.mouse[1] += (this.targetMouse[1] - this.mouse[1]) * 0.08;
      this.velocity += (this.targetVelocity - this.velocity) * 0.1;
      this.targetVelocity *= 0.92;
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(program.resolution, canvas.width, canvas.height);
    gl.uniform1f(program.time, now * 1e-3);
    gl.uniform3fv(program.u_color, this.color);
    gl.uniform2f(program.u_mouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(program.u_velocity, this.velocity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// --- UTILITY FUNCTION ---
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
      : null;
};

// --- REACT COMPONENT ---
export default function ShaderBackground({ className, smokeColor = "#E3142A" }) {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const isMobile = window.innerWidth <= 768;
        const shader = isMobile ? fragmentShaderMobile : fragmentShaderDesktop;
        const renderer = new Renderer(canvas, shader, isMobile);
        rendererRef.current = renderer;
        
        const handleResize = () => renderer.updateScale();
        handleResize();
        window.addEventListener('resize', handleResize);
        
        // Only attach mouse listener on non-touch devices
        let handleMouseMove = null;
        if (!isMobile) {
            handleMouseMove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const mx = (x - rect.width * 0.5) / rect.height;
                const my = -(y - rect.height * 0.5) / rect.height;
                const dx = mx - renderer.targetMouse[0];
                const dy = my - renderer.targetMouse[1];
                const speed = Math.sqrt(dx * dx + dy * dy);
                renderer.updateMouse(mx, my, speed);
            };
            window.addEventListener('mousemove', handleMouseMove);
        }
        
        let animationFrameId;
        const loop = (now) => {
            renderer.render(now);
            animationFrameId = requestAnimationFrame(loop);
        };
        loop(0);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (handleMouseMove) window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
            renderer.reset(); 
        };
    }, []);
    
    useEffect(() => {
        const renderer = rendererRef.current;
        if (renderer) {
            const rgbColor = hexToRgb(smokeColor);
            if (rgbColor) {
                renderer.updateColor(rgbColor);
            }
        }
    }, [smokeColor]);

    return (
        <div className={className} style={{ width: "100%", height: "100%" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
    );
}
