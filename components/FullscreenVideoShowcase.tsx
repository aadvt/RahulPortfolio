"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, AnimatePresence, useInView } from "framer-motion";

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

// ─── Fade Slide (Video/Image Layer) ──────────────────────────────────────────
interface FadeSlideProps {
  item: VideoShowcaseItem;
  index: number;
  totalItems: number;
  scrollYProgress: any;
  activeIndex: number;
  isInView: boolean;
  isMuted: boolean;
  vimeoLoaded: boolean;
  onItemClick?: (item: VideoShowcaseItem) => void;
}

function FadeSlide({
  item,
  index,
  totalItems,
  scrollYProgress,
  activeIndex,
  isInView,
  isMuted,
  vimeoLoaded,
  onItemClick,
}: FadeSlideProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const getThumbnailSrc = (slideItem: VideoShowcaseItem, idx: number) => {
    if (slideItem.poster) return slideItem.poster;
    return `/images/reel/reel-${(idx % 6) + 1}.png`;
  };

  // Instantiates the Vimeo Player exactly once on mount, cleans up on unmount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && typeof window !== "undefined" && (window as any).Vimeo) {
      if (!playerRef.current) {
        try {
          const player = new (window as any).Vimeo.Player(iframe);
          playerRef.current = player;
          
          player.ready().then(() => {
            player.setMuted(true);
            player.setVolume(0);
            setPlayerReady(true);
          }).catch((err) => {
            console.error("Vimeo player ready promise rejected:", err);
          });
        } catch (e) {
          console.error("Vimeo player instantiation error:", e);
        }
      }
    }
    
    return () => {
      if (playerRef.current) {
        playerRef.current = null;
        setPlayerReady(false);
      }
    };
  }, [vimeoLoaded]);

  // Synchronize playback and volume states on state changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady) return;

    player.ready().then(() => {
      const isActive = activeIndex === index;
      const isClose = Math.abs(activeIndex - index) <= 1;

      // Sync mute and volume
      if (!isInView || isMuted || !isActive) {
        player.setMuted(true);
        player.setVolume(0);
      } else {
        player.setMuted(false);
        player.setVolume(1);
      }

      // Sync play/pause based on proximity and section visibility
      if (isInView && isClose) {
        player.play().catch(() => {});
      } else {
        player.pause().catch(() => {});
      }
    });
  }, [activeIndex, isInView, isMuted, index, playerReady]);

  const isActive = activeIndex === index;
  const isNeighbor = Math.abs(activeIndex - index) <= 1;
  const isVisible = isActive || isNeighbor;
  // Ensure the active slide always has the highest stack index to prevent slide 2 overlapping slide 1
  const zIndex = isActive ? 10 : (isNeighbor ? 5 : 1);

  return (
    <motion.div
      className="fvs-slide"
      animate={{
        opacity: isActive ? 1 : 0,
      }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        display: isVisible ? "block" : "none",
        zIndex: zIndex,
        pointerEvents: isActive ? "auto" : "none"
      }}
    >
      <div 
        className="fvs-video-wrapper" 
        onClick={() => onItemClick && onItemClick(item)}
        style={{ cursor: "pointer" }}
      >
        {item.type === "video" ? (
          <iframe
            ref={iframeRef}
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
    </motion.div>
  );
}

// ─── Fade Text (Scrolling Title Layer) ───────────────────────────────────────
interface FadeTextProps {
  title: string;
  index: number;
  totalItems: number;
  scrollYProgress: any;
}

function FadeText({ title, index, totalItems, scrollYProgress }: FadeTextProps) {
  const totalSlots = Math.max(totalItems - 1, 1);
  
  const points: number[] = [];
  const opacityValues: number[] = [];
  const scaleValues: number[] = [];

  if (index > 0) {
    points.push((index - 0.45) / totalSlots);
    opacityValues.push(0);
    scaleValues.push(0.92);
  }
  
  points.push(index / totalSlots);
  opacityValues.push(1);
  scaleValues.push(1.0);
  
  if (index < totalItems - 1) {
    points.push((index + 0.45) / totalSlots);
    opacityValues.push(0);
    scaleValues.push(0.92);
  }

  const titleOpacity = useTransform(scrollYProgress, points, opacityValues);
  const titleScale = useTransform(scrollYProgress, points, scaleValues);

  return (
    <div className="fvs-text-slide">
      <motion.h2 
        className="fvs-title" 
        style={{ opacity: titleOpacity, scale: titleScale }}
      >
        {title}
      </motion.h2>
    </div>
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
  const [isMuted, setIsMuted] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [vimeoLoaded, setVimeoLoaded] = useState(false);

  // Track if showcase container is in viewport to prevent early playback
  const isInView = useInView(containerRef, { margin: "-5% 0px -5% 0px" });

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

  const totalSlots = Math.max(items.length - 1, 1);

  // ── Vimeo SDK Loading Check ──────────────────────────────────────────────
  useEffect(() => {
    if ((window as any).Vimeo) {
      setVimeoLoaded(true);
      return;
    }
    const checkVimeo = setInterval(() => {
      if ((window as any).Vimeo) {
        setVimeoLoaded(true);
        clearInterval(checkVimeo);
      }
    }, 100);
    return () => clearInterval(checkVimeo);
  }, []);

  // ── Sliding Highlight Position for Side Nav ──────────────────────────────
  const rawHighlightY = useTransform(scrollYProgress, [0, 1], [0, totalSlots * 48]);
  const highlightY = useSpring(rawHighlightY, { stiffness: 120, damping: 24, mass: 0.5 });

  // ── Title Y Translation (Vertical Scrolling Text Container) ──────────────
  const textY = useTransform(
    scrollYProgress,
    [0, 1],
    ["0vh", `-${totalSlots * 100}vh`]
  );

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
  const scrollToSlideRef = useRef((index: number, duration = 0.55) => {
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

  // ── Navigation Click Handlers ─────────────────────────────────────────────
  const handleNavClick = (index: number) => scrollToSlideRef.current(index, 0.55);

  const handleHomeClick = () => {
    const lenis = lenisRef?.current;
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.5 });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleMenuLinkClick = (targetId: string) => {
    setIsMenuOpen(false);
    setTimeout(() => {
      const lenis = lenisRef?.current;
      if (targetId === "home") {
        if (lenis) lenis.scrollTo(0, { duration: 1.5 });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.getElementById(targetId);
        if (el) {
          if (lenis) lenis.scrollTo(el, { duration: 1.5 });
          else el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }, 400);
  };

  // ── Wheel intercept: snap immediately on scroll intent ────────────────────
  useEffect(() => {
    const COOLDOWN = 600; // Lock input until snapping animation completes

    const onWheel = (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Check if the container is currently active and stuck in view (permissive check)
      const isSticky = rect.top <= 50 && rect.bottom >= window.innerHeight - 50;
      if (!isSticky) return;

      const n = itemsRef.current.length;
      const dir = e.deltaY > 0 ? 1 : -1;
      
      // Determine if we should allow native scroll exit:
      const isExitingUp = activeIndexRef.current === 0 && dir === -1;
      const isExitingDown = activeIndexRef.current === n - 1 && dir === 1;

      if (isExitingUp || isExitingDown) {
        return; // Allow native scroll to pass through
      }

      // Inside boundaries: strictly lock scroll and trigger snap transition
      e.preventDefault();
      e.stopPropagation();

      if (isSnappingRef.current) return;
      if (Math.abs(e.deltaY) < 5) return;

      const nextIdx = activeIndexRef.current + dir;
      isSnappingRef.current = true;
      scrollToSlideRef.current(nextIdx);
      setTimeout(() => { isSnappingRef.current = false; }, COOLDOWN);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // ── Touch swipe snap ──────────────────────────────────────────────────────
  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    if (isMobile) return;

    let touchStartY = 0;
    const SWIPE_THRESHOLD = 20; // More sensitive swipe on mobile
    const COOLDOWN = 600;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isSnappingRef.current) {
        if (e.cancelable) e.preventDefault();
        return; // Lock scrolling completely during transition
      }

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Permissive sticky check to handle address bar hiding/showing
      const isSticky = rect.top <= 50 && rect.bottom >= window.innerHeight - 50;
      if (!isSticky) return;

      const deltaY = touchStartY - e.touches[0].clientY;
      const n = itemsRef.current.length;
      const dir = deltaY > 0 ? 1 : -1;

      const isExitingUp = activeIndexRef.current === 0 && dir === -1;
      const isExitingDown = activeIndexRef.current === n - 1 && dir === 1;

      if (isExitingUp || isExitingDown) {
        return;
      }

      if (e.cancelable) e.preventDefault();

      if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
        const nextIdx = activeIndexRef.current + dir;
        isSnappingRef.current = true;
        scrollToSlideRef.current(nextIdx);
        touchStartY = e.touches[0].clientY;
        setTimeout(() => {
          isSnappingRef.current = false;
        }, COOLDOWN);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
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
          lenis.scrollTo(target, { duration: 0.55 });
        }
      }, 120);
    };

    window.addEventListener("scroll", snap, { passive: true });
    return () => {
      window.removeEventListener("scroll", snap);
      clearTimeout(timer);
    };
  }, []);

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

        {/* Floating Top-Corner Header Controls */}
        <div className="fvs-header-controls">
          <div className="fvs-header-left">
            <button 
              onClick={handleHomeClick} 
              className="fvs-header-btn circular-btn"
              aria-label="Scroll to Home"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </button>
          </div>
          
          <div className="fvs-header-right">
            <button 
              onClick={toggleMute} 
              className="fvs-header-btn circular-btn"
              aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </button>
            
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="fvs-header-btn pill-btn menu-btn"
              aria-label="Open Navigation Menu"
            >
              MENU
            </button>
          </div>
        </div>

        {/* Video Slides Viewport (Crossfading Absolute Layers) */}
        <div className="fvs-viewport">
          {items.map((item, idx) => (
            <FadeSlide
              key={idx}
              item={item}
              index={idx}
              totalItems={items.length}
              scrollYProgress={scrollYProgress}
              activeIndex={activeIndex}
              isInView={isInView}
              isMuted={isMuted}
              vimeoLoaded={vimeoLoaded}
              onItemClick={onItemClick}
            />
          ))}
        </div>

        {/* Vertical Scrolling Titles Stack */}
        <motion.div
          className="fvs-text-scroll-container"
          style={{ y: textY }}
        >
          {items.map((item, idx) => (
            <FadeText
              key={idx}
              title={item.title}
              index={idx}
              totalItems={items.length}
              scrollYProgress={scrollYProgress}
            />
          ))}
        </motion.div>

        {/* Side Numbers Navigation Progress indicator */}
        <div className="fvs-indicator-pill">
          <div className="fvs-indicator-numbers">
            <motion.div 
              className="fvs-indicator-highlight"
              style={{ y: highlightY }}
            />
            {items.map((_, idx) => {
              const numStr = String(idx + 1).padStart(2, "0");
              const isActive = idx === activeIndex;
              return (
                <div 
                  key={idx} 
                  className="fvs-indicator-num-wrapper"
                  onClick={() => handleNavClick(idx)}
                >
                  <span className={`fvs-indicator-num ${isActive ? "active" : ""}`}>
                    {numStr}
                  </span>
                </div>
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

      {/* Fullscreen Navigation Modal Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            className="fvs-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <button 
              className="fvs-menu-close-btn"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className="fvs-menu-container">
              <motion.div 
                className="fvs-menu-link" 
                onClick={() => handleMenuLinkClick("home")}
                whileHover={{ scale: 1.05 }}
              >
                HOME
              </motion.div>
              <motion.div 
                className="fvs-menu-link" 
                onClick={() => handleMenuLinkClick("services")}
                whileHover={{ scale: 1.05 }}
              >
                SERVICES
              </motion.div>
              <motion.div 
                className="fvs-menu-link" 
                onClick={() => handleMenuLinkClick("media-carousel")}
                whileHover={{ scale: 1.05 }}
              >
                SHOWCASE
              </motion.div>
              <motion.div 
                className="fvs-menu-link" 
                onClick={() => handleMenuLinkClick("contact")}
                whileHover={{ scale: 1.05 }}
              >
                CONTACT
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
