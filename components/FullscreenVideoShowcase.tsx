"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export interface VideoShowcaseItem {
  type?: "video" | "image";
  src: string;
  title: string;
  className?: string;
  rotate?: number;
  alt?: string;
  poster?: string;
}

interface FullscreenVideoShowcaseProps {
  items: VideoShowcaseItem[];
  lenisRef: React.RefObject<any>;
  onItemClick?: (item: VideoShowcaseItem) => void;
}

// ─── Wipe Slide ───────────────────────────────────────────────────────────────
// Replicates letitrippictures.com:
//  [Clipper] height 0→100vh  (overflow-hidden, anchored bottom)
//    └─ [Inner] translateY 100vh→0  (counter-move so video stays fixed)
//         └─ [Video]
// Result: video is revealed from below by an expanding clip window — pure wipe.

function WipeSlide({
  item,
  index,
  totalItems,
  scrollYProgress,
  activeIndex,
  onItemClick,
}: {
  item: VideoShowcaseItem;
  index: number;
  totalItems: number;
  scrollYProgress: any;
  activeIndex: number;
  onItemClick?: (item: VideoShowcaseItem) => void;
}) {
  const totalSlots = Math.max(totalItems - 1, 1);
  const wipeStart = (index - 1) / totalSlots;
  const wipeEnd   = index / totalSlots;

  const clipHeightRaw = useTransform(
    scrollYProgress,
    [Math.max(0, wipeStart), wipeEnd],
    ["0vh", "100vh"]
  );
  const innerYRaw = useTransform(
    scrollYProgress,
    [Math.max(0, wipeStart), wipeEnd],
    ["100vh", "0vh"]
  );

  const clipHeight = useSpring(clipHeightRaw, { stiffness: 90, damping: 22, mass: 0.6 });
  const innerY     = useSpring(innerYRaw,     { stiffness: 90, damping: 22, mass: 0.6 });

  // Slides 1+: title fades in as wipe completes
  const titleOpacity = useTransform(
    scrollYProgress,
    [Math.max(0, wipeStart + (wipeEnd - wipeStart) * 0.6), wipeEnd],
    [0, 1]
  );
  const titleY = useTransform(
    scrollYProgress,
    [Math.max(0, wipeStart + (wipeEnd - wipeStart) * 0.6), wipeEnd],
    ["24px", "0px"]
  );

  // Slide 0: title starts visible, fades out as slide 1 wipes over it
  const slide0TitleOpacity = useTransform(scrollYProgress, [0, 1 / totalSlots], [1, 0]);
  const slide0TitleY       = useTransform(scrollYProgress, [0, 1 / totalSlots], ["0px", "-20px"]);

  const isActiveOrAdjacent = Math.abs(activeIndex - index) <= 1;

  const getThumbnailSrc = (slideItem: VideoShowcaseItem, idx: number) => {
    if (slideItem.poster) return slideItem.poster;
    return `/images/reel/reel-${(idx % 6) + 1}.png`;
  };

  // ── Slide 0: always full-height, no clipping ─────────────────────────────
  if (index === 0) {
    return (
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        onClick={() => onItemClick && onItemClick(item)}
      >
        <div className="fvs-video-wrapper">
          {item.type === "video" ? (
            <iframe
              src={item.src}
              className={item.rotate ? `rotate-video-${item.rotate}` : ""}
              style={item.rotate ? { border: "none" } : { width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen"
              title={item.title}
              tabIndex={-1}
            />
          ) : (
            <img src={getThumbnailSrc(item, index)} alt={item.alt || item.title} className="fvs-image-fallback" />
          )}
          <div className="fvs-dark-overlay" />
        </div>

        <motion.div
          style={{ opacity: slide0TitleOpacity, y: slide0TitleY, position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}
          className="fvs-content-layer"
        >
          <h2 className="fvs-title">{item.title}</h2>
        </motion.div>
      </div>
    );
  }

  // ── Slides 1+: clipped wipe reveal ───────────────────────────────────────
  return (
    <motion.div
      style={{ height: clipHeight, position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden", zIndex: index + 1 }}
      onClick={() => onItemClick && onItemClick(item)}
    >
      <motion.div
        style={{ y: innerY, position: "absolute", bottom: 0, left: 0, right: 0, height: "100vh" }}
      >
        <div className="fvs-video-wrapper">
          {isActiveOrAdjacent && (
            item.type === "video" ? (
              <iframe
                src={item.src}
                className={item.rotate ? `rotate-video-${item.rotate}` : ""}
                style={item.rotate ? { border: "none" } : { width: "100%", height: "100%", border: "none" }}
                allow="autoplay; fullscreen"
                title={item.title}
                tabIndex={-1}
              />
            ) : (
              <img src={getThumbnailSrc(item, index)} alt={item.alt || item.title} className="fvs-image-fallback" />
            )
          )}
          <div className="fvs-dark-overlay" />
        </div>

        <motion.div
          style={{ opacity: titleOpacity, y: titleY, position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}
          className="fvs-content-layer"
        >
          <h2 className="fvs-title">{item.title}</h2>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FullscreenVideoShowcase({
  items = [],
  lenisRef,
  onItemClick,
}: FullscreenVideoShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Stable refs — read inside effects with [] deps (no stale closures)
  const activeIndexRef  = useRef(0);
  const isSnappingRef   = useRef(false);
  const itemsRef        = useRef(items);
  const lenisStableRef  = useRef(lenisRef);

  // Keep refs current on every render
  itemsRef.current      = items;
  lenisStableRef.current = lenisRef;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // ── Track active slide index ──────────────────────────────────────────────
  useEffect(() => {
    return scrollYProgress.on("change", (latest: number) => {
      const n = itemsRef.current.length;
      const totalSlots = Math.max(n - 1, 1);
      const index = Math.max(0, Math.min(Math.round(latest * totalSlots), n - 1));
      activeIndexRef.current = index;
      setActiveIndex(index);
    });
  }, [scrollYProgress]);

  // ── Stable scrollToSlide stored in a ref ─────────────────────────────────
  const scrollToSlideRef = useRef((index: number, duration = 0.9) => {
    const lenis     = lenisStableRef.current?.current;
    const container = containerRef.current;
    if (!lenis || !container) return;

    const n          = itemsRef.current.length;
    const clamped    = Math.max(0, Math.min(index, n - 1));
    const rect       = container.getBoundingClientRect();
    const scrollTop  = window.scrollY + rect.top;
    const totalSlots = Math.max(n - 1, 1);
    const target     = scrollTop + (clamped / totalSlots) * (rect.height - window.innerHeight);
    lenis.scrollTo(target, { duration });
  });

  // ── Wheel intercept: snap immediately on scroll intent ────────────────────
  useEffect(() => {
    const COOLDOWN = 750;

    const onWheel = (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.top > 2 || rect.bottom < window.innerHeight - 2) return;
      if (Math.abs(e.deltaY) < 5) return;

      e.preventDefault();
      e.stopPropagation();

      if (isSnappingRef.current) return;

      const n       = itemsRef.current.length;
      const dir     = e.deltaY > 0 ? 1 : -1;
      const nextIdx = activeIndexRef.current + dir;
      if (nextIdx < 0 || nextIdx >= n) return;

      isSnappingRef.current = true;
      scrollToSlideRef.current(nextIdx);
      setTimeout(() => { isSnappingRef.current = false; }, COOLDOWN);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // ── Touch swipe snap ──────────────────────────────────────────────────────
  useEffect(() => {
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 40;
    const COOLDOWN = 750;

    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };

    const onTouchEnd = (e: TouchEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.top > 2 || rect.bottom < window.innerHeight - 2) return;

      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) < SWIPE_THRESHOLD || isSnappingRef.current) return;

      const n       = itemsRef.current.length;
      const dir     = deltaY > 0 ? 1 : -1;
      const nextIdx = activeIndexRef.current + dir;
      if (nextIdx < 0 || nextIdx >= n) return;

      isSnappingRef.current = true;
      scrollToSlideRef.current(nextIdx);
      setTimeout(() => { isSnappingRef.current = false; }, COOLDOWN);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // ── Fallback: re-snap if stranded between slides after scroll stops ───────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const snap = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isSnappingRef.current) return;
        const container = containerRef.current;
        const lenis     = lenisStableRef.current?.current;
        if (!container || !lenis) return;

        const rect = container.getBoundingClientRect();
        if (rect.top > 2 || rect.bottom < window.innerHeight - 2) return;

        const n          = itemsRef.current.length;
        const totalSlots = Math.max(n - 1, 1);
        const scrollTop  = window.scrollY + rect.top;
        const idx        = activeIndexRef.current;
        const target     = scrollTop + (idx / totalSlots) * (rect.height - window.innerHeight);

        if (Math.abs(window.scrollY - target) > 30) {
          lenis.scrollTo(target, { duration: 0.8 });
        }
      }, 120);
    };

    window.addEventListener("scroll", snap, { passive: true });
    return () => {
      window.removeEventListener("scroll", snap);
      clearTimeout(timer);
    };
  }, []);

  const handleNavClick = (index: number) => scrollToSlideRef.current(index, 1.2);

  const getThumbnailSrc = (item: VideoShowcaseItem, index: number) => {
    if (item.poster) return item.poster;
    return `/images/reel/reel-${(index % 6) + 1}.png`;
  };

  if (!items || items.length === 0) return null;

  return (
    <section
      ref={containerRef}
      id="media-carousel"
      className="fvs-section"
      style={{ height: `${items.length * 100}vh` }}
    >
      <div
        className="fvs-sticky"
        tabIndex={-1}
        style={{ outline: "none", overflow: "hidden" }}
      >
        <div className="fvs-grain-overlay" aria-hidden="true" />

        <div className="fvs-viewport">
          {items.map((item, idx) => (
            <WipeSlide
              key={idx}
              item={item}
              index={idx}
              totalItems={items.length}
              scrollYProgress={scrollYProgress}
              activeIndex={activeIndex}
              onItemClick={onItemClick}
            />
          ))}
        </div>

        {/* Vertical glass nav pill */}
        <div className="fvs-nav-wrapper">
          <div className="fvs-nav-container">
            {items.map((item, idx) => {
              const numStr   = String(idx + 1).padStart(2, "0");
              const isActive = idx === activeIndex;
              const thumbUrl = getThumbnailSrc(item, idx);
              return (
                <button
                  key={idx}
                  onClick={() => handleNavClick(idx)}
                  className={`fvs-nav-btn ${isActive ? "active" : ""}`}
                  aria-label={`Go to slide ${numStr}`}
                >
                  <span className="fvs-nav-number">{numStr}</span>
                  <div className="fvs-nav-tooltip">
                    <img src={thumbUrl} alt={item.title} className="fvs-nav-tooltip-thumb" />
                    <span className="fvs-nav-tooltip-text">{item.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="fvs-footer-info">
          <span className="fvs-footer-left">SCROLL TO NAVIGATE</span>
          <span className="fvs-footer-right">
            FEATURED STORIES — {String(activeIndex + 1).padStart(2, "0")}/
            {String(items.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}
