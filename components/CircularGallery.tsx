"use client";

import React, { useEffect, useRef, useState } from "react";

// Local cn helper
const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export interface GalleryItem {
  type?: "video" | "image";
  src: string;
  title: string;
  rotate?: number;
  alt?: string;
  className?: string;
}

interface CircularGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: GalleryItem[];
  bend?: number;
  scrollSpeed?: number;
  scrollEase?: number;
  autoPlaySpeed?: number;
  onItemClick?: (item: GalleryItem) => void;
}

const lerp = (p1: number, p2: number, t: number) => {
  return p1 + (p2 - p1) * t;
};

const getAspectType = (item: GalleryItem) => {
  const isRotated = item.rotate === 270 || item.rotate === 90;
  if (isRotated) {
    return "portrait";
  }
  if (item.className?.includes("portrait")) {
    return "portrait";
  }
  return "landscape";
};

export const CircularGallery = ({
  items,
  bend = 3,
  scrollSpeed = 1.5,
  scrollEase = 0.08,
  autoPlaySpeed = 0.3,
  className,
  onItemClick,
  ...props
}: CircularGalleryProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardElements = useRef<(HTMLDivElement | null)[]>([]);

  const defaultItems: GalleryItem[] = [
    {
      type: "video",
      src: "https://player.vimeo.com/video/1197831287?background=1&autoplay=1&loop=1&muted=1",
      title: "PROJECT 01",
      className: "media-card-video-landscape",
    },
    {
      type: "video",
      src: "https://player.vimeo.com/video/1197831230?background=1&autoplay=1&loop=1&muted=1",
      title: "PROJECT 02",
      className: "media-card-video-landscape",
      rotate: 270,
    },
    {
      type: "video",
      src: "https://player.vimeo.com/video/1197831232?background=1&autoplay=1&loop=1&muted=1",
      title: "PROJECT 03",
      className: "media-card-video-landscape",
      rotate: 270,
    },
    {
      type: "video",
      src: "https://player.vimeo.com/video/1197831233?background=1&autoplay=1&loop=1&muted=1",
      title: "PROJECT 04",
      className: "media-card-video-portrait",
    },
    {
      type: "video",
      src: "https://player.vimeo.com/video/1197831231?background=1&autoplay=1&loop=1&muted=1",
      title: "PROJECT 05",
      className: "media-card-video-landscape",
    },
  ];

  const galleryItems = items && items.length > 0 ? items : defaultItems;
  const doubleItems = [...galleryItems, ...galleryItems];

  const [isMobile, setIsMobile] = useState(false);
  const scroll = useRef({ current: 0, target: 0, last: 0, ease: scrollEase });
  const isDown = useRef(false);
  const startX = useRef(0);
  const dragMoved = useRef(false);
  const extras = useRef<number[]>([]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    extras.current = doubleItems.map(() => 0);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [doubleItems]);

  useEffect(() => {
    // Spacing between cards (padding) in pixels
    const padding = isMobile ? 20 : 40;

    // Calculate card width and position layout parameters in JS
    let currentX = 0;
    const cardsData = doubleItems.map((item) => {
      const height = isMobile ? window.innerHeight * 0.26 : window.innerHeight * 0.38;
      const aspect = getAspectType(item) === "portrait" ? 0.5625 : 1.7778;
      const width = height * aspect;
      const initialX = currentX;
      currentX += width + padding;
      return { width, initialX };
    });
    const widthTotal = currentX;

    // Re-verify extras array length
    if (extras.current.length !== doubleItems.length) {
      extras.current = doubleItems.map(() => 0);
    }

    let rafId: number;

    const update = () => {
      // Gentle autoplay drift when not dragging
      if (!isDown.current) {
        scroll.current.target += autoPlaySpeed;
      }

      // Smooth scroll interpolation
      scroll.current.current = lerp(
        scroll.current.current,
        scroll.current.target,
        scroll.current.ease,
      );

      const speed = scroll.current.current - scroll.current.last;

      const containerWidth = containerRef.current?.clientWidth || 800;
      const H = containerWidth / 2;

      cardElements.current.forEach((el, index) => {
        if (!el) return;

        const width = cardsData[index].width;
        const initialX = cardsData[index].initialX;

        // X coordinate relative to scroll position and infinite loop wraps
        let x = initialX + width / 2 - scroll.current.current - extras.current[index];

        // Loop bounds wrapping logic (direction independent)
        const cardOffset = width / 2;
        if (x + cardOffset < -H - padding) {
          extras.current[index] -= widthTotal;
          x += widthTotal;
        } else if (x - cardOffset > H + padding) {
          extras.current[index] += widthTotal;
          x -= widthTotal;
        }

        // Curvature math
        const B_abs = Math.abs(bend);
        const R = (H * H + B_abs * B_abs) / (2 * B_abs);
        const effectiveX = Math.min(Math.abs(x), H);
        const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);

        let y = 0;
        let rotateZ = 0;
        if (bend > 0) {
          y = -arc;
          rotateZ = -Math.sign(x) * Math.asin(effectiveX / R);
        } else {
          y = arc;
          rotateZ = Math.sign(x) * Math.asin(effectiveX / R);
        }

        // Apply skew to simulate wind distortion from velocity
        const velocitySkew = Math.min(Math.max(speed * 0.15, -12), 12);

        // Apply transform
        el.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0px) rotateZ(${rotateZ}rad) skewX(${velocitySkew}deg)`;
      });

      scroll.current.last = scroll.current.current;
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isMobile, doubleItems, bend, autoPlaySpeed]);

  // Mouse & Touch events
  const onTouchDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDown.current = true;
    dragMoved.current = false;
    scroll.current.position = scroll.current.current;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDown.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const deltaX = startX.current - clientX;
      
      if (Math.abs(deltaX) > 4) {
        dragMoved.current = true;
      }
      
      const distance = deltaX * scrollSpeed;
      scroll.current.target = (scroll.current.position || 0) + distance;
    };

    const handleUp = () => {
      isDown.current = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [scrollSpeed]);

  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY || (e as any).wheelDelta || e.detail;
    scroll.current.target += delta * 0.4 * scrollSpeed;
  };

  const handleCardClick = (item: GalleryItem) => {
    if (dragMoved.current) return; // Prevent clicks while dragging
    if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "circular-gallery-section select-none",
        className
      )}
      onMouseDown={onTouchDown}
      onTouchStart={onTouchDown}
      onWheel={onWheel}
      {...props}
    >
      <div className="circular-gallery-track">
        {doubleItems.map((item, index) => {
          const aspect = getAspectType(item);
          return (
            <div
              key={`${item.title}-${index}`}
              ref={(el) => {
                cardElements.current[index] = el;
              }}
              className={cn("circular-gallery-card", aspect)}
            >
              <div className="circular-gallery-media-wrapper">
                {item.type === "video" ? (
                  item.rotate ? (
                    // Rotated portrait video: iframe is landscape-sized then rotated 90/270°
                    // so we need a wrapper that clips the overflow
                    <div className="rotated-video-container">
                      <iframe
                        src={item.src}
                        className={`rotate-video-${item.rotate}`}
                        style={{ border: "none" }}
                        allow="autoplay; fullscreen"
                        title={item.title}
                      />
                    </div>
                  ) : (
                    <iframe
                      src={item.src}
                      style={{ width: "100%", height: "100%", border: "none" }}
                      allow="autoplay; fullscreen"
                      title={item.title}
                    />
                  )
                ) : (
                  <img src={item.src} alt={item.title} loading="lazy" />
                )}
                <div
                  className="circular-gallery-overlay"
                  onClick={() => handleCardClick(item)}
                >
                  <h3 className="circular-gallery-label">{item.title}</h3>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
