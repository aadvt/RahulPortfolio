"use client"

import { GrainGradient } from "@paper-design/shaders-react"

export default function GradientBackground() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100vw',
      height: '100%',
      zIndex: -1,
      backgroundColor: 'black',
      pointerEvents: 'none'
    }}>
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(0, 0%, 0%)"
        softness={0.76}
        intensity={0.45}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={1}
        colors={["hsl(193, 85%, 66%)", "hsl(196, 100%, 83%)", "hsl(195, 100%, 50%)"]}
      />
    </div>
  )
}
