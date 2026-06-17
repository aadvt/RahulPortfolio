"use client";

import React, { useRef, useMemo, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Subtle animated ambient particles floating around the room model
 * for depth and streetwear-forward atmosphere.
 */
function FloatingParticles({ count = 120 }) {
  const meshRef = useRef();

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      speeds.push({
        x: (Math.random() - 0.5) * 0.002,
        y: (Math.random() - 0.5) * 0.003,
        z: (Math.random() - 0.5) * 0.002,
      });
    }
    return { positions, speeds };
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;
    const posAttr = meshRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      posAttr.array[i * 3] += particles.speeds[i].x;
      posAttr.array[i * 3 + 1] += particles.speeds[i].y;
      posAttr.array[i * 3 + 2] += particles.speeds[i].z;

      if (Math.abs(posAttr.array[i * 3]) > 4) particles.speeds[i].x *= -1;
      if (Math.abs(posAttr.array[i * 3 + 1]) > 3) particles.speeds[i].y *= -1;
      if (Math.abs(posAttr.array[i * 3 + 2]) > 4) particles.speeds[i].z *= -1;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={particles.positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#ffffff"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Loading indicator displayed while the GLB model streams in.
 */
function RoomLoader() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
        pointerEvents: "none",
        backgroundColor: "#050505",
      }}
    >
      <div className="splat-loader">
        <div className="splat-loader-ring" />
        <span className="splat-loader-text">Loading 3D Room…</span>
      </div>
    </div>
  );
}

/**
 * Scene tracker component running inside Canvas to read camera and control states.
 * Writes directly to the DOM for buttery 60fps tracking performance.
 */
function SceneTracker({ controlsRef, cameraPosRef, cameraTargetRef }) {
  useFrame(({ camera }) => {
    if (camera) {
      cameraPosRef.current = [camera.position.x, camera.position.y, camera.position.z];
      const camPosEl = document.getElementById("hud-cam-pos");
      if (camPosEl) {
        camPosEl.innerText = `[${camera.position.x.toFixed(3)}, ${camera.position.y.toFixed(3)}, ${camera.position.z.toFixed(3)}]`;
      }
    }
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      cameraTargetRef.current = [target.x, target.y, target.z];
      const camTargetEl = document.getElementById("hud-cam-target");
      if (camTargetEl) {
        camTargetEl.innerText = `[${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}]`;
      }
    }
  });

  return null;
}

/**
 * Inner component to load the GLB and trigger the onLoad event
 */
function RoomModel({ url, position, rotation, scale, onLoad }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    if (scene) {
      // Traverse the scene to enable shadow casting/receiving
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Optimize materials for standard web renderer
          if (child.material) {
            child.material.roughness = Math.max(child.material.roughness, 0.4);
            child.material.metalness = Math.min(child.material.metalness, 0.8);
          }
        }
      });
      onLoad();
    }
  }, [scene, onLoad]);

  return <primitive object={scene} position={position} rotation={rotation} scale={scale} />;
}

export default function Room3DScene({ className }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Model Placement States (Initial adjusted values to keep it nicely centered)
  const [modelPos, setModelPos] = useState([0, -1.5, 0]);
  const [modelRot, setModelRot] = useState([0, -45, 0]); // in degrees
  const [modelScale, setModelScale] = useState(0.85);

  // Model Placement Input Buffers
  const [posInputs, setPosInputs] = useState(["0", "-1.5", "0"]);
  const [rotInputs, setRotInputs] = useState(["0", "-45", "0"]);
  const [scaleInput, setScaleInput] = useState("0.85");

  // Movable Lighting States
  const [dirLightIntensity, setDirLightIntensity] = useState(5.00);
  
  const [redLightPos, setRedLightPos] = useState([-1.5, -0.4, -0.1]);
  const [redLightIntensity, setRedLightIntensity] = useState(5.50);
  const [redLightPosInputs, setRedLightPosInputs] = useState(["-1.5", "-0.4", "-0.1"]);

  const [cyanLightPos, setCyanLightPos] = useState([-0.6, -0.6, 1.6]);
  const [cyanLightIntensity, setCyanLightIntensity] = useState(10.00);
  const [cyanLightPosInputs, setCyanLightPosInputs] = useState(["-0.6", "-0.6", "1.6"]);

  // Helper States
  const [showHelpers, setShowHelpers] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed for a clean look
  const [copyStatus, setCopyStatus] = useState("Copy Coordinates");

  // Refs for tracking camera coordinates
  const controlsRef = useRef();
  const cameraPosRef = useRef([-3.388, -0.368, 3.299]);
  const cameraTargetRef = useRef([0, 0, 0]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update handlers (Model Position & Rotation)
  const handlePosChange = (index, valueString) => {
    setPosInputs(prev => {
      const next = [...prev];
      next[index] = valueString;
      return next;
    });
    const parsed = parseFloat(valueString);
    if (!isNaN(parsed)) {
      setModelPos(prev => {
        const next = [...prev];
        next[index] = parsed;
        return next;
      });
    }
  };

  const handlePosSliderChange = (index, numVal) => {
    setModelPos(prev => {
      const next = [...prev];
      next[index] = numVal;
      return next;
    });
    setPosInputs(prev => {
      const next = [...prev];
      next[index] = numVal.toString();
      return next;
    });
  };

  const handleRotChange = (index, valueString) => {
    setRotInputs(prev => {
      const next = [...prev];
      next[index] = valueString;
      return next;
    });
    const parsed = parseFloat(valueString);
    if (!isNaN(parsed)) {
      setModelRot(prev => {
        const next = [...prev];
        next[index] = parsed;
        return next;
      });
    }
  };

  const handleRotSliderChange = (index, numVal) => {
    setModelRot(prev => {
      const next = [...prev];
      next[index] = numVal;
      return next;
    });
    setRotInputs(prev => {
      const next = [...prev];
      next[index] = numVal.toString();
      return next;
    });
  };

  const handleScaleChange = (valueString) => {
    setScaleInput(valueString);
    const parsed = parseFloat(valueString);
    if (!isNaN(parsed) && parsed > 0) {
      setModelScale(parsed);
    }
  };

  const handleScaleSliderChange = (numVal) => {
    setModelScale(numVal);
    setScaleInput(numVal.toString());
  };

  // Update handlers (Red Light Position)
  const handleRedLightPosChange = (index, valueString) => {
    setRedLightPosInputs(prev => {
      const next = [...prev];
      next[index] = valueString;
      return next;
    });
    const parsed = parseFloat(valueString);
    if (!isNaN(parsed)) {
      setRedLightPos(prev => {
        const next = [...prev];
        next[index] = parsed;
        return next;
      });
    }
  };

  const handleRedLightPosSliderChange = (index, numVal) => {
    setRedLightPos(prev => {
      const next = [...prev];
      next[index] = numVal;
      return next;
    });
    setRedLightPosInputs(prev => {
      const next = [...prev];
      next[index] = numVal.toString();
      return next;
    });
  };

  // Update handlers (Cyan Light Position)
  const handleCyanLightPosChange = (index, valueString) => {
    setCyanLightPosInputs(prev => {
      const next = [...prev];
      next[index] = valueString;
      return next;
    });
    const parsed = parseFloat(valueString);
    if (!isNaN(parsed)) {
      setCyanLightPos(prev => {
        const next = [...prev];
        next[index] = parsed;
        return next;
      });
    }
  };

  const handleCyanLightPosSliderChange = (index, numVal) => {
    setCyanLightPos(prev => {
      const next = [...prev];
      next[index] = numVal;
      return next;
    });
    setCyanLightPosInputs(prev => {
      const next = [...prev];
      next[index] = numVal.toString();
      return next;
    });
  };

  const handleReset = () => {
    setModelPos([0, -1.5, 0]);
    setModelRot([0, -45, 0]);
    setModelScale(0.85);
    setPosInputs(["0", "-1.5", "0"]);
    setRotInputs(["0", "-45", "0"]);
    setScaleInput("0.85");
    
    setDirLightIntensity(5.00);

    setRedLightPos([-1.5, -0.4, -0.1]);
    setRedLightIntensity(5.50);
    setRedLightPosInputs(["-1.5", "-0.4", "-0.1"]);

    setCyanLightPos([-0.6, -0.6, 1.6]);
    setCyanLightIntensity(10.00);
    setCyanLightPosInputs(["-0.6", "-0.6", "1.6"]);

    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const copyCoordinates = () => {
    const formatted = `// FINAL ROOM MODEL CONFIGURATION
cameraPosition: [${cameraPosRef.current.map(n => Number(n.toFixed(3))).join(", ")}],
cameraTarget: [${cameraTargetRef.current.map(n => Number(n.toFixed(3))).join(", ")}],
modelPosition: [${modelPos.map(n => Number(n.toFixed(3))).join(", ")}],
modelRotation: [${modelRot.map(n => Number(n.toFixed(3))).join(", ")}], // degrees
modelScale: ${Number(modelScale).toFixed(3)},
dirLightIntensity: ${Number(dirLightIntensity).toFixed(2)},
redLightPosition: [${redLightPos.map(n => Number(n.toFixed(3))).join(", ")}],
redLightIntensity: ${Number(redLightIntensity).toFixed(2)},
cyanLightPosition: [${cyanLightPos.map(n => Number(n.toFixed(3))).join(", ")}],
cyanLightIntensity: ${Number(cyanLightIntensity).toFixed(2)}`;

    navigator.clipboard.writeText(formatted).then(() => {
      setCopyStatus("Copied! ✅");
      setTimeout(() => setCopyStatus("Copy Coordinates"), 2000);
    }).catch(err => {
      console.error("Failed to copy coordinates: ", err);
      alert("Clipboard copy blocked. Here are your coordinates:\n\n" + formatted);
    });
  };

  // Styles for the glassmorphic HUD
  const panelStyle = {
    position: "absolute",
    top: "20px",
    right: "20px",
    width: isMobile ? "calc(100% - 40px)" : "340px",
    maxHeight: "85vh",
    overflowY: "auto",
    backgroundColor: "rgba(10, 10, 15, 0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "20px",
    color: "#eaeaea",
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
    fontSize: "13px",
    zIndex: 99999,
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
    display: isCollapsed ? "none" : "flex",
    flexDirection: "column",
    gap: "16px",
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  };

  const minButtonStyle = {
    position: "absolute",
    top: "20px",
    right: "20px",
    backgroundColor: "rgba(10, 10, 15, 0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "30px",
    padding: "10px 18px",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "12px",
    cursor: "pointer",
    zIndex: 99999,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
    display: isCollapsed ? "flex" : "none",
    alignItems: "center",
    gap: "6px",
  };

  const titleStyle = {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    paddingBottom: "8px",
  };

  const sectionStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const sectionTitleStyle = {
    margin: "0 0 4px 0",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#E3142A",
    letterSpacing: "0.5px",
  };

  const controlRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const labelStyle = {
    width: "20px",
    fontWeight: "bold",
    color: "rgba(255, 255, 255, 0.4)",
    fontFamily: "monospace",
  };

  const sliderStyle = {
    flex: 1,
    accentColor: "#E3142A",
    cursor: "pointer",
    height: "6px",
    borderRadius: "3px",
  };

  const numberInputStyle = {
    width: "65px",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "4px",
    color: "#ffffff",
    padding: "4px 6px",
    textAlign: "right",
    fontSize: "12px",
    fontFamily: "monospace",
    outline: "none",
  };

  const hudBoxStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: "10px",
    borderRadius: "6px",
    fontFamily: "monospace",
    fontSize: "11.5px",
    lineHeight: "1.5",
    border: "1px solid rgba(255, 255, 255, 0.03)",
  };

  const actionButtonStyle = {
    width: "100%",
    padding: "10px",
    backgroundColor: "#E3142A",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    transition: "background-color 0.2s ease, transform 0.1s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 12px rgba(227, 20, 42, 0.25)",
  };

  const secondaryButtonStyle = {
    flex: 1,
    padding: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "12px",
    transition: "background-color 0.2s ease",
  };

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {!isLoaded && <RoomLoader />}

      {/* Collapse button when HUD is closed */}
      <button style={minButtonStyle} onClick={() => setIsCollapsed(false)}>
        🔧 Adjust Room & Lights
      </button>

      {/* Main HUD Panel */}
      <div className="splat-debug-hud" style={panelStyle}>
        <div style={titleStyle}>
          <span>Room & Lights</span>
          <button
            onClick={() => setIsCollapsed(true)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* 1. Model Position */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Model Position</h4>
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis} style={controlRowStyle}>
              <span style={labelStyle}>{axis}</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.05"
                value={modelPos[i]}
                onChange={(e) => handlePosSliderChange(i, parseFloat(e.target.value))}
                style={sliderStyle}
              />
              <input
                type="text"
                value={posInputs[i]}
                onChange={(e) => handlePosChange(i, e.target.value)}
                style={numberInputStyle}
              />
            </div>
          ))}
        </div>

        {/* 2. Model Rotation & Scale */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Model Rotation & Scale</h4>
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis} style={controlRowStyle}>
              <span style={labelStyle}>{axis}</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={modelRot[i]}
                onChange={(e) => handleRotSliderChange(i, parseFloat(e.target.value))}
                style={sliderStyle}
              />
              <input
                type="text"
                value={rotInputs[i]}
                onChange={(e) => handleRotChange(i, e.target.value)}
                style={numberInputStyle}
              />
            </div>
          ))}
          <div style={controlRowStyle}>
            <span style={{ ...labelStyle, width: "35px" }}>Scale</span>
            <input
              type="range"
              min="0.05"
              max="5.0"
              step="0.01"
              value={modelScale}
              onChange={(e) => handleScaleSliderChange(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <input
              type="text"
              value={scaleInput}
              onChange={(e) => handleScaleChange(e.target.value)}
              style={numberInputStyle}
            />
          </div>
        </div>

        {/* 3. Red Point Light Control */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Red Point Light</h4>
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={`red-light-${axis}`} style={controlRowStyle}>
              <span style={labelStyle}>{axis}</span>
              <input
                type="range"
                min="-30"
                max="30"
                step="0.1"
                value={redLightPos[i]}
                onChange={(e) => handleRedLightPosSliderChange(i, parseFloat(e.target.value))}
                style={sliderStyle}
              />
              <input
                type="text"
                value={redLightPosInputs[i]}
                onChange={(e) => handleRedLightPosChange(i, e.target.value)}
                style={numberInputStyle}
              />
            </div>
          ))}
          <div style={controlRowStyle}>
            <span style={{ ...labelStyle, width: "35px" }}>Inten.</span>
            <input
              type="range"
              min="0.0"
              max="10.0"
              step="0.1"
              value={redLightIntensity}
              onChange={(e) => setRedLightIntensity(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <input
              type="text"
              value={redLightIntensity.toString()}
              readOnly
              style={numberInputStyle}
            />
          </div>
        </div>

        {/* 4. Cyan Point Light Control */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Cyan Point Light</h4>
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={`cyan-light-${axis}`} style={controlRowStyle}>
              <span style={labelStyle}>{axis}</span>
              <input
                type="range"
                min="-30"
                max="30"
                step="0.1"
                value={cyanLightPos[i]}
                onChange={(e) => handleCyanLightPosSliderChange(i, parseFloat(e.target.value))}
                style={sliderStyle}
              />
              <input
                type="text"
                value={cyanLightPosInputs[i]}
                onChange={(e) => handleCyanLightPosChange(i, e.target.value)}
                style={numberInputStyle}
              />
            </div>
          ))}
          <div style={controlRowStyle}>
            <span style={{ ...labelStyle, width: "35px" }}>Inten.</span>
            <input
              type="range"
              min="0.0"
              max="10.0"
              step="0.1"
              value={cyanLightIntensity}
              onChange={(e) => setCyanLightIntensity(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <input
              type="text"
              value={cyanLightIntensity.toString()}
              readOnly
              style={numberInputStyle}
            />
          </div>
        </div>

        {/* 5. Directional Light Intensity */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Ambient / Sun Light</h4>
          <div style={controlRowStyle}>
            <span style={{ ...labelStyle, width: "35px" }}>Sun</span>
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.1"
              value={dirLightIntensity}
              onChange={(e) => setDirLightIntensity(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <input
              type="text"
              value={dirLightIntensity.toString()}
              readOnly
              style={numberInputStyle}
            />
          </div>
        </div>

        {/* 6. Live Camera Info */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Live Camera</h4>
          <div style={hudBoxStyle}>
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Cam Pos: </span>
              <span id="hud-cam-pos">Updating...</span>
            </div>
            <div>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Target:  </span>
              <span id="hud-cam-target">Updating...</span>
            </div>
          </div>
        </div>

        {/* 7. Utility Settings */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Options</h4>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={showHelpers}
              onChange={(e) => setShowHelpers(e.target.checked)}
              style={{ accentColor: "#E3142A", width: "14px", height: "14px" }}
            />
            <span>Show Grid & Axes Helpers</span>
          </label>
        </div>

        {/* 8. Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          <button style={actionButtonStyle} onClick={copyCoordinates}>
            📋 {copyStatus}
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={secondaryButtonStyle} onClick={handleReset}>
              🔄 Reset Config
            </button>
          </div>
        </div>
      </div>

      <Canvas
        camera={{ position: [-3.388, -0.368, 3.299], fov: 50 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ pointerEvents: "auto" }}
      >
        <color attach="background" args={["#050505"]} />

        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 12, 8]} intensity={dirLightIntensity} color="#ffffff" castShadow />
        <pointLight position={redLightPos} intensity={redLightIntensity} color="#E3142A" distance={0} castShadow />
        <pointLight position={cyanLightPos} intensity={cyanLightIntensity} color="#00ffff" distance={0} castShadow />

        {/* Helpers for coordinate alignment */}
        {showHelpers && (
          <>
            <gridHelper args={[30, 30, "#E3142A", "#444444"]} position={[0, -1, 0]} />
            <axesHelper args={[5]} />
            {/* Visual indicator for Red light */}
            <mesh position={redLightPos}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#E3142A" toneMapped={false} />
            </mesh>
            {/* Visual indicator for Cyan light */}
            <mesh position={cyanLightPos}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#00ffff" toneMapped={false} />
            </mesh>
          </>
        )}

        {/* Orbit Controls */}
        <OrbitControls ref={controlsRef} makeDefault />

        {/* The 3D Room GLB Model */}
        <Suspense fallback={null}>
          <RoomModel
            url="/images/rahul_room.glb"
            position={modelPos}
            rotation={[
              (modelRot[0] * Math.PI) / 180,
              (modelRot[1] * Math.PI) / 180,
              (modelRot[2] * Math.PI) / 180,
            ]}
            scale={modelScale}
            onLoad={() => setIsLoaded(true)}
          />
        </Suspense>

        <FloatingParticles count={isMobile ? 60 : 120} />

        {/* Frame loop-based coordinate tracker */}
        <SceneTracker
          controlsRef={controlsRef}
          cameraPosRef={cameraPosRef}
          cameraTargetRef={cameraTargetRef}
        />
      </Canvas>
    </div>
  );
}

// Preload the GLB model for faster entry
useGLTF.preload("/images/rahul_room.glb");
