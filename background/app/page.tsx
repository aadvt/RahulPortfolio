import OilShader from "@/components/oil-shader"

export default function Page() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-black">
      <OilShader />

      {/* tiny floating label, top-left */}
      <div className="pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 mix-blend-difference">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
        <span>Viscous</span>
      </div>

      {/* hint, bottom-center */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/50 mix-blend-difference">
        drag to disturb the surface
      </div>

      {/* tiny credit, bottom-right */}
      <div className="pointer-events-none absolute bottom-6 right-5 z-10 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 mix-blend-difference">
        webgl · fluid sim
      </div>
    </main>
  )
}
