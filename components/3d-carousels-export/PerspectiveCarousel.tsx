"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import LivingNebulaShader from "./LivingNebulaShader";
import "./carousel-styles.css";

export interface CarouselItem {
  type?: "video" | "image";
  src: string;
  title: string;
  className?: string;
  rotate?: number;
  alt?: string;
}

interface PerspectiveCarouselProps {
  items?: CarouselItem[];
  radius?: number; // Distance from center. Defaults to 784 (desktop) / 480 (mobile)
  scrollLinked?: boolean; // Spin on page scroll
  scrollSectionHeight?: string; // height of scroll track, e.g. "400vh", "500vh"
  autoPlay?: boolean; // Spin automatically (used when scrollLinked is false)
  autoPlaySpeed?: number; // Speed of autoPlay in degrees per frame
  interactive?: boolean; // Allow touch/mouse drag to spin (used when scrollLinked is false)
  useShaderBackground?: boolean; // Toggle WebGL shader background
  onItemClick?: (item: CarouselItem) => void;
}

const defaultCarouselItems: CarouselItem[] = [
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831287?background=1&autoplay=1&loop=1&muted=1",
    title: "PROJECT 01",
    className: "media-card-video-landscape"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831230?background=1&autoplay=1&loop=1&muted=1",
    title: "PROJECT 02",
    className: "media-card-video-landscape",
    rotate: 270
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831232?background=1&autoplay=1&loop=1&muted=1",
    title: "PROJECT 03",
    className: "media-card-video-landscape",
    rotate: 270
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831233?background=1&autoplay=1&loop=1&muted=1",
    title: "PROJECT 04",
    className: "media-card-video-portrait"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831231?background=1&autoplay=1&loop=1&muted=1",
    title: "PROJECT 05",
    className: "media-card-video-landscape"
  }
];

export const PerspectiveCarousel = ({
  items = defaultCarouselItems,
  radius,
  scrollLinked = true,
  scrollSectionHeight = "400vh",
  autoPlay = true,
  autoPlaySpeed = 0.15,
  interactive = true,
  useShaderBackground = true,
  onItemClick
}: PerspectiveCarouselProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeModalItem, setActiveModalItem] = useState<CarouselItem | null>(null);

  // Monitor viewport size for responsive radius settings
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeRadius = radius || (isMobile ? 480 : 784);

  // 1. Scroll-linked Motion Values
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const scrollRotation = useTransform(scrollYProgress, [0, 1], [0, -360]);
  const scrollTiltZ = useTransform(scrollYProgress, [0, 0.5, 1], [-1, 1, -1]);
  const scrollZ = useTransform(scrollYProgress, [0, 0.5, 1], [300, 500, 300]);

  // 2. Free-spinning (Autoplay/Drag) Motion Values
  const rotationMV = useMotionValue(0);
  const freeTiltZ = useMotionValue(0);
  const freeZ = useMotionValue(300);

  // Springs for smoothing
  const rotationSpring = useSpring(scrollLinked ? scrollRotation : rotationMV, {
    stiffness: 30,
    damping: 20,
    mass: 1
  });

  const tiltZSpring = useSpring(scrollLinked ? scrollTiltZ : freeTiltZ, {
    stiffness: 40,
    damping: 25
  });

  const zSpring = useSpring(scrollLinked ? scrollZ : freeZ, {
    stiffness: 30,
    damping: 20
  });

  // Autoplay loop when not scrollLinked
  useEffect(() => {
    if (scrollLinked || !autoPlay) return;

    let rafId: number;
    const run = () => {
      rotationMV.set(rotationMV.get() - autoPlaySpeed);
      rafId = requestAnimationFrame(run);
    };
    rafId = requestAnimationFrame(run);

    return () => cancelAnimationFrame(rafId);
  }, [scrollLinked, autoPlay, autoPlaySpeed]);

  // Interactive Dragging when not scrollLinked
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startRotation = useRef(0);
  const dragMoved = useRef(false);

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (scrollLinked || !interactive) return;
    isDragging.current = true;
    dragMoved.current = false;
    startX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
    startRotation.current = rotationMV.get();
  };

  useEffect(() => {
    if (scrollLinked || !interactive) return;

    const onDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const deltaX = startX.current - clientX;
      
      if (Math.abs(deltaX) > 4) {
        dragMoved.current = true;
      }
      // Map pixel delta to rotation angle
      const sensitivity = 0.35;
      rotationMV.set(startRotation.current - deltaX * sensitivity);
    };

    const onDragEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("touchmove", onDragMove);
    window.addEventListener("touchend", onDragEnd);

    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", onDragEnd);
    };
  }, [scrollLinked, interactive]);

  // Parallax rotation for shader background
  const bgConeAngle = useTransform(rotationSpring, (v) => v * -0.4);

  const handleCardClick = (item: CarouselItem) => {
    if (!scrollLinked && dragMoved.current) return; // ignore click if dragged
    if (onItemClick) {
      onItemClick(item);
    } else {
      setActiveModalItem(item);
    }
  };

  const handleCloseModal = () => {
    setActiveModalItem(null);
  };

  // Listen to Escape key to close modal
  useEffect(() => {
    if (!activeModalItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModalItem]);

  const renderContent = () => {
    return (
      <div className="media-carousel-sticky">
        {/* WebGL background layer */}
        {useShaderBackground && (
          <div aria-hidden="true" className="carousel-bg-layer">
            <LivingNebulaShader
              className="carousel-webgl-bg"
              rotationValue={rotationSpring}
            />
          </div>
        )}

        {/* Brutalist chrome overlays */}
        <div aria-hidden="true" className="carousel-chrome">
          <div className="carousel-chrome-bar carousel-chrome-bar-top" />
          <div className="carousel-chrome-bar carousel-chrome-bar-bottom" />
          <div className="carousel-reg carousel-reg-tl"><span>+</span></div>
          <div className="carousel-reg carousel-reg-tr"><span>+</span></div>
          <div className="carousel-reg carousel-reg-bl"><span>+</span></div>
          <div className="carousel-reg carousel-reg-br"><span>+</span></div>
          <div className="carousel-side-label">PERSPECTIVE ORBIT — 3D</div>
          <div className="carousel-barcode">
            {[6,3,5,2,7,4,3,6,2,5,4,7,3,6,2,4,5,3,7,4,6,2,5,3].map((h, i) => (
              <div key={i} className="barcode-bar" style={{ height: `${h * 3}px`, background: i % 5 === 0 ? "#FC5050" : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
        </div>

        {/* Ghost background watermark */}
        <motion.div
          aria-hidden="true"
          className="carousel-watermark"
          style={{ rotate: bgConeAngle }}
        >
          3D ORBIT
        </motion.div>

        {/* 3D Viewport wrapper */}
        <motion.div 
          className="media-carousel-perspective" 
          aria-hidden="true"
          style={{ perspective: "1500px", perspectiveOrigin: "50% 50%" }}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <motion.div
            className="media-carousel-track"
            style={{ 
              rotateY: rotationSpring,
              rotateX: -2, // slightly tilted for visual interest
              rotateZ: tiltZSpring,
              z: zSpring,
              transformStyle: "preserve-3d",
            }}
          >
            {items.map((item, index) => {
              const total = items.length;
              const angle = (index / total) * 360;
              
              return (
                <motion.div
                  key={`${item.title}-${index}`}
                  className="media-carousel-card-wrapper"
                  style={{
                    rotateY: angle,
                    transformStyle: "preserve-3d"
                  }}
                >
                  <motion.figure
                    className={`media-carousel-card ${item.className || "media-card-medium"}`}
                    onClick={() => handleCardClick(item)}
                    style={{
                      z: -activeRadius,
                      x: "-50%",
                      y: "-50%",
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <div className="media-carousel-frame">
                      {item.type === "video" ? (
                        <iframe
                          src={item.src}
                          className={item.rotate ? `rotate-video-${item.rotate}` : ""}
                          style={item.rotate ? { border: "none", pointerEvents: "none" } : { width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
                          allow="autoplay; fullscreen"
                          title={item.title}
                        />
                      ) : (
                        <img src={item.src} alt={item.alt || item.title} loading="lazy" />
                      )}
                    </div>
                    <figcaption>{item.title}</figcaption>
                  </motion.figure>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        <div className="media-carousel-footer">
          <span>{scrollLinked ? "SCROLL TO ORBIT" : "DRAG TO SPIN"}</span>
          <span>3D SCENE MERRY-GO-ROUND</span>
        </div>

        {/* Premium Brutalist Media Modal */}
        {activeModalItem && (
          <div 
            className="media-modal-overlay" 
            onClick={handleCloseModal}
            aria-modal="true"
            role="dialog"
          >
            <div 
              className="media-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="media-modal-close" 
                onClick={handleCloseModal}
              >
                CLOSE [X]
              </button>
              <div className={activeModalItem.className?.includes("landscape") ? "media-modal-player-landscape" : "media-modal-player-portrait"}>
                <iframe
                  src={activeModalItem.src.replace("background=1", "").replace("muted=1", "").replace("&&", "&").replace("?&", "?")}
                  className={activeModalItem.rotate ? `rotate-video-${activeModalItem.rotate}` : ""}
                  style={activeModalItem.rotate ? { border: "none" } : { width: "100%", height: "100%", border: "none" }}
                  allow="autoplay; fullscreen"
                  title={activeModalItem.title}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (scrollLinked) {
    return (
      <section
        className="media-carousel-section"
        ref={containerRef}
        style={{ height: scrollSectionHeight }}
      >
        {renderContent()}
      </section>
    );
  } else {
    return (
      <div 
        ref={containerRef}
        style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}
      >
        {renderContent()}
      </div>
    );
  }
};
