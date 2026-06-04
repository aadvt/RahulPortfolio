"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, AnimatePresence } from "framer-motion";

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

export default function FullscreenVideoShowcase({
  items,
  lenisRef,
  onItemClick
}: FullscreenVideoShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Monitor resize to reactively toggle iframe vs static poster rendering
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Monitor scroll progress of the fullscreen section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      // Divide the scroll space into equal segments per item
      const index = Math.min(
        Math.floor(latest * items.length),
        items.length - 1
      );
      setActiveIndex(index);
    });
  }, [scrollYProgress, items.length]);

  // Focus lock mechanism: When the active index changes, programmatically focus
  // the sticky container with preventScroll: true. This keeps the focus within
  // the active viewport element and prevents the browser from shifting focus
  // to the body element (which would scroll the page back to the top when an iframe unmounts).
  useEffect(() => {
    if (stickyRef.current) {
      stickyRef.current.focus({ preventScroll: true });
    }
  }, [activeIndex]);

  const handleNavClick = (index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const sectionHeight = rect.height;

    // Land in the middle of the segment's scroll range for safety
    const targetScroll =
      scrollTop +
      ((index + 0.5) / items.length) * (sectionHeight - window.innerHeight);

    if (lenisRef?.current) {
      lenisRef.current.scrollTo(targetScroll, { duration: 1.2 });
    } else {
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  };

  // Helper to fetch fallback thumbnail image for hover
  const getThumbnailSrc = (item: VideoShowcaseItem, index: number) => {
    // If there is an explicit poster, use it
    if (item.poster) return item.poster;
    // Map to local mock reel screenshots or generic images
    return `/images/reel/reel-${(index % 6) + 1}.png`;
  };

  const currentItem = items[activeIndex];

  const slideVariants = {
    enter: {
      opacity: 0,
      scale: 1.06
    },
    center: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.9,
        ease: [0.16, 1, 0.3, 1]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.94,
      transition: {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <section
      ref={containerRef}
      id="media-carousel"
      className="fvs-section"
      style={{ height: `${items.length * 100}vh` }}
    >
      <div
        ref={stickyRef}
        className="fvs-sticky"
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        {/* Film grain photocopy overlay */}
        <div className="fvs-grain-overlay" aria-hidden="true" />

        {/* Slides rendering area */}
        <div className="fvs-viewport">
          <AnimatePresence mode="wait">
            {currentItem && (
              <motion.div
                key={activeIndex}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="fvs-slide-container"
                onClick={() => onItemClick && onItemClick(currentItem)}
              >
                <div className="fvs-video-wrapper">
                  {currentItem.type === "video" && !isMobile ? (
                    <iframe
                      src={currentItem.src}
                      className={currentItem.rotate ? `rotate-video-${currentItem.rotate}` : ""}
                      style={currentItem.rotate ? { border: "none" } : { width: "100%", height: "100%", border: "none" }}
                      allow="autoplay; fullscreen"
                      title={currentItem.title}
                      tabIndex={-1}
                    />
                  ) : (
                    <img
                      src={getThumbnailSrc(currentItem, activeIndex)}
                      alt={currentItem.alt || currentItem.title}
                      className="fvs-image-fallback"
                    />
                  )}

                  {/* Play icon overlay on mobile for interactive clarity */}
                  {isMobile && currentItem.type === "video" && (
                    <div className="fvs-play-btn-overlay">
                      <div className="fvs-play-btn-circle">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffffff" style={{ marginLeft: "2px" }}>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Subtle dark overlay for text readability */}
                  <div className="fvs-dark-overlay" />
                </div>

                {/* Animated typography overlay */}
                <div className="fvs-content-layer">
                  <motion.h2
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    className="fvs-title"
                  >
                    {currentItem.title}
                  </motion.h2>
                  <p className="fvs-scroll-hint">CLICK TO PLAY FULL VIDEO</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating vertical glass navigation pill */}
        <div className="fvs-nav-wrapper">
          <div className="fvs-nav-container">
            {items.map((item, idx) => {
              const numStr = String(idx + 1).padStart(2, "0");
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
                  
                  {/* Hover preview tooltip */}
                  <div className="fvs-nav-tooltip">
                    <img
                      src={thumbUrl}
                      alt={item.title}
                      className="fvs-nav-tooltip-thumb"
                    />
                    <span className="fvs-nav-tooltip-text">{item.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom indicators */}
        <div className="fvs-footer-info">
          <span className="fvs-footer-left">SCROLL TO NAVIGATE</span>
          <span className="fvs-footer-right">FEATURED STORIES — {String(activeIndex + 1).padStart(2, "0")}/{String(items.length).padStart(2, "0")}</span>
        </div>
      </div>
    </section>
  );
}
