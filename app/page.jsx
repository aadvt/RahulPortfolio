"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { motion, useScroll, useTransform, useSpring, useMotionTemplate } from "framer-motion";
import anime from "animejs";
import { gsap } from "gsap";
import ShaderBackground from "../components/ShaderBackground";
import InfiniteGallery from "../components/InfiniteGallery";
import FullscreenVideoShowcase from "../components/FullscreenVideoShowcase";
import DualStackFeedback from "../components/DualStackFeedback";

const services = [
  {
    title: "1. ui/ux design",
    points: [
      "Wireframing and prototyping",
      "User Interface design for web and mobile apps",
      "Usability testing and user feedback analysis",
      "Interaction design and micro-animations",
    ],
  },
  {
    title: "2. Graphic Design",
    points: [
      "Logo and brand identity design",
      "Social media graphics and ad creatives",
      "Infographics and data visualization",
      "Custom illustrations and icons",
    ],
  },
  {
    title: "3. Web Design",
    points: [
      "Responsive website design",
      "Landing page design and optimization",
      "Webflow development and customization",
      "Website maintenance and updates",
    ],
  },
  {
    title: "4. Branding",
    points: [
      "Brand strategy and identity development",
      "Visual style guide creation",
      "Typography and color scheme selection",
      "Brand storytelling and messaging",
    ],
  },
];

const mediaCarouselItems = [
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831287?background=1&autoplay=1&loop=1&muted=1",
    title: "DARKTRACE — THE DEFENDERS",
    className: "media-card-video-landscape",
    poster: "/images/Images_1/IMG_7013.PNG"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831230?background=1&autoplay=1&loop=1&muted=1",
    title: "POWERADE — THE ATHLETE'S CODE",
    className: "media-card-video-landscape",
    rotate: 270,
    poster: "/images/Images_1/IMG_7012.PNG"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831232?background=1&autoplay=1&loop=1&muted=1",
    title: "SUPERBET — BET RESPONSIBLY",
    className: "media-card-video-landscape",
    rotate: 270,
    poster: "/images/Images_1/IMG_7011 (1).PNG"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831233?background=1&autoplay=1&loop=1&muted=1",
    title: "HARMAN KARDON — SEE / HEAR",
    className: "media-card-video-portrait",
    poster: "/images/Images_1/IMG_6195.PNG"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197831231?background=1&autoplay=1&loop=1&muted=1",
    title: "REVOLUT — MAKE YOUR MONEY MOVE",
    className: "media-card-video-landscape",
    poster: "/images/Images_1/IMG_3035.jpg"
  },
  {
    type: "video",
    src: "https://player.vimeo.com/video/1197780573?background=1&autoplay=1&loop=1&muted=1",
    title: "CINEMATIC SHOWREEL",
    className: "media-card-video-landscape",
    poster: "/images/Images_1/IMG_0227.JPG"
  }
];

const infiniteGalleryImages = [
  "/images/Images_1/IMG_0227.JPG",
  "/images/Images_1/IMG_3035.jpg",
  "/images/Images_1/IMG_6195.PNG",
  "/images/Images_1/IMG_7011 (1).PNG",
  "/images/Images_1/IMG_7012.PNG",
  "/images/Images_1/IMG_7013.PNG",
  "/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.02 AM.jpeg",
  "/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM (1).jpeg",
  "/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM (2).jpeg",
  "/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM.jpeg",
  "/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.05 AM.jpeg",
  "/images/IMG_5775.PNG",
  "/images/IMG_6471.jpg"
];







function MetaRow({ items }) {
  return (
    <div className="meta-row">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function Accordion({ items, variant = "accordion" }) {
  const [openItems, setOpenItems] = useState(() => new Set([0]));
  const isFaq = variant === "faq";

  function toggle(index) {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className={isFaq ? "faq-list" : "accordion-list"}>
      {items.map((item, index) => {
        const isOpen = openItems.has(index);

        return (
          <article
            className={`${isFaq ? "faq-item" : "accordion-item"} ${isOpen ? "open" : ""}`}
            key={item.title || item.question}
          >
            <button
              className={isFaq ? "faq-trigger" : "accordion-trigger"}
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(index)}
            >
              <strong>{item.title || `${index + 1}. ${item.question}`}</strong>
              <span>+</span>
            </button>
            <div className={isFaq ? "faq-panel" : "accordion-panel"}>
              <div className={isFaq ? "faq-panel-inner" : "accordion-panel-inner"}>
                {item.points ? (
                  <ul className="service-points">
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{item.answer}</p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}



const fadeUpProps = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
};

const fadeUpPropsDelay = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }
};

const metaLeftVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: [0, 0.9, 0.2, 0.9],
    x: 0,
    transition: {
      x: { type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.45, delay: 0.2 },
      opacity: { duration: 0.35, times: [0, 0.4, 0.6, 1], delay: 0.2 }
    }
  }
};

const metaRightVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: [0, 0.9, 0.2, 0.9],
    x: 0,
    transition: {
      x: { type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.45, delay: 0.2 },
      opacity: { duration: 0.35, times: [0, 0.4, 0.6, 1], delay: 0.2 }
    }
  }
};

const galleryFooterVariants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: [0, 1, 0.3, 1],
    y: 0,
    transition: {
      y: { type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.4, delay: 0.6 },
      opacity: { duration: 0.35, times: [0, 0.4, 0.6, 1], delay: 0.6 }
    }
  }
};

/**
 * Universal Reveal Component with dynamic transition types
 */
function ScrollReveal({ children, delay = 0, variant = "wipe" }) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const maskRef = useRef(null);
  const svgRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const activeVariant = variant;

        if (entry.isIntersecting) {
          if (animationRef.current) animationRef.current.pause();

          if (activeVariant === "wipe") {
            animationRef.current = anime.timeline({ delay: delay })
            .add({
              targets: maskRef.current,
              d: [
                { value: "M 0 100 Q 50 100 100 100 L 100 100 Q 50 100 0 100 Z", duration: 0 },
                { value: "M 0 50 Q 50 0 100 50 L 100 100 Q 50 100 0 100 Z", duration: 400, easing: "easeOutQuad" },
                { value: "M 0 0 Q 50 0 100 0 L 100 100 Q 50 100 0 100 Z", duration: 300, easing: "linear" }
              ]
            })
            .add({
              targets: maskRef.current,
              d: "M 0 0 Q 50 0 100 0 L 100 0 Q 50 0 0 0 Z",
              duration: 300,
              easing: "easeInOutCubic"
            })
            .add({
              targets: svgRef.current,
              opacity: 0,
              duration: 100,
              easing: "linear"
            });

            anime({
              targets: containerRef.current,
              opacity: [0, 1],
              translateY: [20, 0],
              duration: 600,
              delay: delay + 400,
              easing: "easeOutSine"
            });
          } else if (activeVariant === "fluid-flow") {
            animationRef.current = anime({
              targets: containerRef.current,
              opacity: [0, 1],
              translateY: [60, 0],
              scale: [0.98, 1],
              duration: 1000,
              delay: delay,
              easing: "easeOutCubic"
            });
          } else if (activeVariant === "glitch") {
            animationRef.current = anime({
              targets: containerRef.current,
              opacity: [0, 1],
              translateX: [15, 0],
              duration: 500,
              delay: delay,
              easing: "steps(4)"
            });
          } else if (activeVariant === "reveal-box") {
            // Guarantee parent visibility
            anime.set(containerRef.current, { opacity: 1, translateY: 0 });
            
            animationRef.current = anime.timeline({ delay: delay });
            
            animationRef.current
            .add({
              targets: maskRef.current,
              width: ["100%", "0%"],
              left: ["0%", "100%"],
              duration: 800,
              easing: "easeInOutExpo"
            })
            .add({
              targets: elementRef.current,
              opacity: [0, 1],
              duration: 600,
              easing: "easeOutSine"
            }, "-=600");
          }
        } else {
          if (animationRef.current) animationRef.current.pause();
          
          if (activeVariant === "wipe") {
            if (maskRef.current) maskRef.current.setAttribute("d", "M 0 100 Q 25 100 50 100 Q 75 100 100 100 L 100 100 Q 50 100 0 100 Z");
            if (svgRef.current) svgRef.current.style.opacity = "1";
          } else if (activeVariant === "reveal-box") {
            if (maskRef.current) {
              maskRef.current.style.width = "100%";
              maskRef.current.style.left = "0%";
            }
            if (elementRef.current) elementRef.current.style.opacity = "0";
          }
          anime.set(containerRef.current, { opacity: 0, translateY: 30 });
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [delay, variant]);

  const activeVariant = variant;

  return (
    <div ref={containerRef} style={{ position: "relative", opacity: 0, willChange: "transform, opacity" }}>
      {activeVariant === "wipe" && (
        <div ref={svgRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", overflow: "hidden", willChange: "transform" }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
            <path ref={maskRef} d="M 0 100 Q 25 100 50 100 Q 75 100 100 100 L 100 100 Q 50 100 0 100 Z" fill="var(--accent)" />
          </svg>
        </div>
      )}
      {activeVariant === "reveal-box" && (
        <div ref={maskRef} style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: "100%",
          backgroundColor: "var(--accent)",
          zIndex: 2,
          pointerEvents: "none",
          willChange: "transform, width"
        }} />
      )}
      <div ref={elementRef} style={{ opacity: activeVariant === "reveal-box" ? 0 : 1, willChange: "opacity" }}>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const [submitText, setSubmitText] = useState("Submit");
  const heroSceneRef = useRef(null);
  const lenisRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const scrollCooldownRef = useRef(false);
  const hasDisappearedRef = useRef(false);
  const [isServicesTextVisible, setIsServicesTextVisible] = useState(false);
  const isServicesTextVisibleRef = useRef(false);
  const quoteRef = useRef(null);

  const transitionToSection = (target, speedMultiplier = 1) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    const lenis = lenisRef.current;
    if (lenis) lenis.stop();
    document.body.style.overflow = "hidden";

    const overlay = document.querySelector(".page-wipe-overlay");
    const heading = document.querySelector(".wipe-heading");
    const sub = document.querySelector(".wipe-sub");
    const image = document.querySelector(".page-wipe-image");

    if (!overlay) {
      if (lenis) {
        lenis.scrollTo(target, { immediate: true });
        lenis.start();
      } else {
        const el = typeof target === "string" ? document.querySelector(target) : null;
        if (el) el.scrollIntoView();
        else if (typeof target === "number") window.scrollTo(0, target);
      }
      document.body.style.overflow = "";
      isTransitioningRef.current = false;
      return;
    }

    overlay.classList.add("active");

    const tl = gsap.timeline({
      onComplete: () => {
        overlay.classList.remove("active");
        isTransitioningRef.current = false;
        document.body.style.overflow = "";
        if (lenis) lenis.start();

        // Enable scroll cooldown for 1000ms to allow scroll values to settle down
        scrollCooldownRef.current = true;
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 1000);
      }
    });

    gsap.set(overlay, { clipPath: "inset(0% 100% 0% 0%)" });
    gsap.set(heading, { opacity: 0, y: 40, scale: 0.95 });
    gsap.set(sub, { opacity: 0, y: 20 });
    gsap.set(image, { scale: 1.15, transformOrigin: "center center" });

    tl.to(overlay, {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 0.85 * speedMultiplier,
      ease: "power4.inOut",
    })
    .to(image, {
      scale: 1.0,
      duration: 1.6 * speedMultiplier,
      ease: "power2.out",
    }, 0)
    .to(heading, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.55 * speedMultiplier,
      ease: "power4.out",
    }, "-=0.35")
    .to(sub, {
      opacity: 1,
      y: 0,
      duration: 0.45 * speedMultiplier,
      ease: "power3.out",
    }, "-=0.25")
    .add(() => {
      let targetScroll = 0;
      if (typeof target === "string") {
        const el = document.querySelector(target);
        if (el) {
          targetScroll = el.getBoundingClientRect().top + window.scrollY;
        }
      } else if (typeof target === "number") {
        targetScroll = target;
      }

      window.scrollTo(0, targetScroll);
      if (lenis) {
        lenis.scrollTo(targetScroll, { immediate: true });
      }
    }, "-=0.05")
    .to({}, { duration: 0.45 * speedMultiplier })
    .to([heading, sub], {
      opacity: 0,
      y: -20,
      duration: 0.35 * speedMultiplier,
      ease: "power3.in",
    })
    .to(overlay, {
      clipPath: "inset(0% 0% 0% 100%)",
      duration: 0.75 * speedMultiplier,
      ease: "power4.inOut",
    })
    .set(overlay, { clipPath: "inset(0% 100% 0% 0%)" });
  };

  const portraitStageRef = useRef(null);
  const theaterSectionRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [gyroPermission, setGyroPermission] = useState("pending");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    // Initialize mouse position to center to prevent jumps
    mousePosRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!quoteRef.current) return;
    const words = quoteRef.current.querySelectorAll(".quote-word-item");
    if (words.length === 0) return;

    if (isServicesTextVisible) {
      const tl = gsap.timeline();

      // Reset states
      gsap.set(words, { opacity: 0, y: 0, x: 0, scale: 1, skewX: 0, skewY: 0, filter: "none", clipPath: "none" });
      const bleedChars = words[3]?.querySelectorAll(".bleed-char");
      if (bleedChars && bleedChars.length > 0) {
        gsap.set(bleedChars, { opacity: 0, x: 0, textShadow: "none" });
      }

      // 0. "I" - Glitchy strobe flicker
      tl.to(words[0], {
        opacity: 1,
        duration: 0.35,
        keyframes: [
          { opacity: 0 },
          { opacity: 1 },
          { opacity: 0.1 },
          { opacity: 1 }
        ],
        ease: "none"
      }, 0);

      // 1. "AM" - Guillotine drop
      if (words[1]) {
        tl.fromTo(words[1], 
          { y: -80, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, ease: "power4.out" },
          0.08
        );
      }

      // 2. "THE" - Horizontal plate slam from left
      if (words[2]) {
        tl.fromTo(words[2],
          { x: -100, skewX: -20, opacity: 0 },
          { x: 0, skewX: 0, opacity: 1, duration: 0.4, ease: "power3.out" },
          0.14
        );
      }

      // 3. "UNIVERSE" - Full chromatic aberration glitch with letter stagger
      if (words[3]) {
        tl.set(words[3], { opacity: 1, x: 0, skewX: 0 }, 0.22);
        const chars = words[3]?.querySelectorAll(".bleed-char");
        if (chars && chars.length > 0) {
          chars.forEach((char, index) => {
            const charTl = gsap.timeline();
            charTl
              .to(char, { opacity: 1, duration: 0.01 })
              .to(char, {
                x: -8,
                duration: 0.04,
                ease: "none",
                onUpdate: function() {
                  const progress = this.progress();
                  const r = Math.round(-8 + progress * 8);
                  char.style.textShadow = `
                    ${r - 6}px 0 0 rgba(255,0,0,0.85),
                    ${-r + 6}px 0 0 rgba(0,0,255,0.7),
                    0 0 35px rgba(255,0,0,0.4)
                  `;
                }
              })
              .to(char, { x: 10, duration: 0.03, ease: "none",
                onUpdate: function() {
                  char.style.textShadow = `10px 0 0 rgba(255,0,0,0.9), -10px 0 0 rgba(0,0,255,0.8), 0 0 40px rgba(255,0,0,0.5)`;
                }
              })
              .to(char, { opacity: 0, duration: 0.02 })
              .to(char, { x: -5, opacity: 1, duration: 0.02, ease: "none",
                onUpdate: function() {
                  char.style.textShadow = `-5px 0 0 rgba(255,0,0,0.95), 5px 0 0 rgba(0,0,255,0.85)`;
                }
              })
              .to(char, { x: 7, duration: 0.03, ease: "none",
                onUpdate: function() {
                  char.style.textShadow = `7px 0 0 rgba(255,0,0,0.8), -7px 0 0 rgba(0,0,255,0.7)`;
                }
              })
              .to(char, { opacity: 0, duration: 0.025 })
              .to(char, { opacity: 1, x: -3, duration: 0.02,
                onUpdate: function() {
                  char.style.textShadow = `-3px 0 0 rgba(255,0,0,0.7), 3px 0 0 rgba(0,0,255,0.6)`;
                }
              })
              .to(char, {
                x: 0,
                duration: 0.22,
                ease: "power3.out",
                onUpdate: function() {
                  const p = this.progress();
                  const offset = Math.round((1 - p) * 3);
                  char.style.textShadow = `
                    ${offset}px 0 0 rgba(160,0,0,${0.45 * (1-p)}),
                    ${-offset}px 0 0 rgba(255,30,30,${0.2 * (1-p)}),
                    0 0 ${42 * (1-p) + 8}px rgba(255,0,0,${0.18 + 0.12 * (1-p)})
                  `;
                },
                onComplete: function() {
                  char.style.textShadow = "";
                }
              });
            tl.add(charTl, 0.22 + index * 0.06);
          });
        }
      }

    } else {
      const allBleedChars = quoteRef.current?.querySelectorAll(".bleed-char");
      gsap.killTweensOf(words);
      if (allBleedChars) {
        gsap.killTweensOf(allBleedChars);
        gsap.set(allBleedChars, { opacity: 0, x: 0, textShadow: "none" });
      }
      gsap.set(words, { opacity: 0 });
    }
  }, [isServicesTextVisible]);

  const requestGyro = async () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        setGyroPermission(permission);
        if (permission === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
        }
      } catch (error) {
        console.error("Gyro permission error:", error);
      }
    } else {
      setGyroPermission("granted");
      window.addEventListener("deviceorientation", handleOrientation);
    }
  };

  const handleOrientation = (event) => {
    if (!event.beta || !event.gamma) return;
    // Map tilt to a cursor-like coordinate system
    // beta: -180 to 180 (front/back tilt), gamma: -90 to 90 (left/right tilt)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const tiltX = Math.max(-30, Math.min(30, event.gamma)) / 30; // -1 to 1
    const tiltY = Math.max(-30, Math.min(30, event.beta - 45)) / 30; // -1 to 1 (offset beta for natural holding angle)
    
    mousePosRef.current = { 
      x: centerX + tiltX * (window.innerWidth * 0.4),
      y: centerY + tiltY * (window.innerHeight * 0.4)
    };
  };




  // Services section reference
  const servicesSectionRef = useRef(null);



  // Meech-inspired spinning 3D carousel for mixed photo and video media.
  // Fullscreen video showcase references and layout config

  // Theater section references and scroll transforms
  const theaterRef = useRef(null);
  const iframeRef = useRef(null);
  const [vimeoPlayer, setVimeoPlayer] = useState(null);
  const isPlayingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(true);
  const [timecode, setTimecode] = useState("00:14:23:18");
  const [activeModalItem, setActiveModalItem] = useState(null);
  const activeModalItemRef = useRef(null);

  // Sync activeModalItem to ref to avoid stale closures in RAF loop and toggle Lenis scroll
  useEffect(() => {
    activeModalItemRef.current = activeModalItem;
    const lenis = lenisRef.current;
    if (lenis) {
      if (activeModalItem) {
        lenis.stop();
      } else {
        lenis.start();
      }
    }
  }, [activeModalItem]);

  // Listen to Escape key to close the video modal
  useEffect(() => {
    if (!activeModalItem) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveModalItem(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModalItem]);

  const { scrollYProgress: theaterProgress } = useScroll({
    target: theaterRef,
    offset: ["start start", "end end"]
  });

  const footerRef = useRef(null);
  const { scrollYProgress: footerScrollProgress } = useScroll({
    target: footerRef,
    offset: ["start end", "end end"]
  });

  const rawRadius = useTransform(footerScrollProgress, [0, 0.95], [0, 145]);
  const springRadius = useSpring(rawRadius, {
    stiffness: 45,
    damping: 18,
    mass: 0.6
  });
  const circleRadius = useTransform(springRadius, (v) => `${v}vmax`);

  const [footerActive, setFooterActive] = useState(false);

  useEffect(() => {
    return footerScrollProgress.on("change", (v) => {
      if (v >= 0.85) {
        setFooterActive(true);
      } else {
        setFooterActive(false);
      }
    });
  }, [footerScrollProgress]);

  const [localTime, setLocalTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      const timeStr = date.toLocaleTimeString("en-US", { hour12: false });
      const offset = -date.getTimezoneOffset();
      const diffHours = Math.floor(Math.abs(offset) / 60);
      const diffMins = Math.abs(offset) % 60;
      const gmtStr = `GMT${offset >= 0 ? "+" : "-"}${String(diffHours).padStart(2, "0")}:${String(diffMins).padStart(2, "0")}`;
      setLocalTime(`${timeStr} ${gmtStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Full screen by default
  const theaterScale = 1;
  const theaterWidth = "100%";
  const theaterBorderRadius = "0px";
  const theaterBorderWidth = "0px";
  
  const theaterGlowOpacity = useTransform(theaterProgress, [0, 0.4, 0.8], [0.35, 0.9, 0.1]);
  const hudOpacity = useTransform(theaterProgress, [0.35, 0.6], [1, 0]);

  // Live ticking timecode for brutalist film overlay
  // Paused via IntersectionObserver when theater section is not visible
  useEffect(() => {
    let hours = 0;
    let minutes = 14;
    let seconds = 23;
    let frames = 18;
    let intervalId = null;
    let isVisible = false;

    const tick = () => {
      frames++;
      if (frames >= 24) {
        frames = 0;
        seconds++;
        if (seconds >= 60) {
          seconds = 0;
          minutes++;
          if (minutes >= 60) {
            minutes = 0;
            hours++;
          }
        }
      }
      const pad = (num) => String(num).padStart(2, "0");
      setTimecode(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`);
    };

    const startTick = () => { if (!intervalId) intervalId = setInterval(tick, 1000 / 24); };
    const stopTick  = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };

    // Only run when theater section is in view
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        isVisible ? startTick() : stopTick();
      },
      { threshold: 0.01 }
    );

    // Observe as soon as the ref is available (poll briefly)
    const attachObserver = () => {
      const el = theaterRef.current;
      if (el) { observer.observe(el); }
      else { setTimeout(attachObserver, 300); }
    };
    attachObserver();

    return () => {
      stopTick();
      observer.disconnect();
    };
  }, []);


  const toggleMute = () => {
    if (vimeoPlayer) {
      vimeoPlayer.getMuted().then((muted) => {
        const nextMute = !muted;
        vimeoPlayer.setMuted(nextMute).then(() => {
          setIsMuted(nextMute);
        }).catch((err) => {
          console.error("Vimeo setMuted error:", err);
        });
      }).catch(() => {
        const nextMute = !isMuted;
        vimeoPlayer.setMuted(nextMute).then(() => {
          setIsMuted(nextMute);
        });
      });
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", true);
  }, []);

  useEffect(() => {
    const initPlayer = () => {
      if (iframeRef.current && window.Vimeo) {
        const player = new window.Vimeo.Player(iframeRef.current);
        setVimeoPlayer(player);
      }
    };

    if (window.Vimeo) {
      initPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://player.vimeo.com/api/player.js";
      script.async = true;
      script.onload = initPlayer;
      document.body.appendChild(script);
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  useEffect(() => {
    const scene = heroSceneRef.current;
    const stage = portraitStageRef.current;
    if (!scene || !stage) return;

    const lenis = new Lenis({
      duration: isMobile ? 0.8 : 1.2,
      lerp: isMobile ? 0.18 : 0.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: "vertical",
      gestureDirection: "vertical",
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 1.5,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Mouse tracking for cursor-following circle
    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Smoothed cursor position for buttery following
    let smoothMouse = { x: mousePosRef.current.x, y: mousePosRef.current.y };

    let sectionBounds = { heroBottom: 0, theaterTop: 0, theaterBottom: 0, servicesTop: 0, servicesBottom: 0 };
    let baseCoords = { x: 0, y: 0 };
    let servicesShift = { x: 0, y: 0 };

    // ── Cached mobile flag — read once, not every frame ──────────────────────
    const isMobileRAF = window.innerWidth <= 768;

    // ── Dirty-flag cache for DOM writes — only write when values actually change ─
    let _cachedTransform = "";
    let _cachedOpacity = "";
    let _cachedBR = "";
    let _cachedFlipRot = "";
    let _cachedFilter = "";
    let _cachedShaderOpacity = "";
    let _cachedTextParallax = "";

    const setStyleProp = (el, prop, val) => {
      if (el.style.getPropertyValue(prop) !== val) el.style.setProperty(prop, val);
    };
    const setStyleDirect = (el, prop, val) => {
      if (el.style[prop] !== val) el.style[prop] = val;
    };

    const updateCoords = () => {
      const stageEl = stage;
      const theaterEl = theaterSectionRef.current;
      const servicesEl = servicesSectionRef.current;
      const servicesLanding = document.querySelector(".services-card-landing");

      if (!stageEl) return;

      // Get hero scene bottom
      const heroSceneEl = scene;
      const heroRect = heroSceneEl.getBoundingClientRect();
      sectionBounds.heroBottom = heroRect.bottom + window.scrollY;

      // Get theater section bounds
      if (theaterEl) {
        const tRect = theaterEl.getBoundingClientRect();
        sectionBounds.theaterTop = tRect.top + window.scrollY;
        sectionBounds.theaterBottom = tRect.bottom + window.scrollY;
      }

      // Get services section bounds
      if (servicesEl) {
        const sRect = servicesEl.getBoundingClientRect();
        sectionBounds.servicesTop = sRect.top + window.scrollY;
        sectionBounds.servicesBottom = sRect.bottom + window.scrollY;
      }

      // Compute base position (card's natural resting spot using parent container)
      const parentEl = stageEl.parentElement;
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        baseCoords.x = parentRect.left + window.scrollX + parentRect.width / 2;
        baseCoords.y = parentRect.top + window.scrollY + parentRect.height / 2;
      } else {
        const originalTransform = stageEl.style.transform;
        stageEl.style.transform = "none";
        const stageRect = stageEl.getBoundingClientRect();
        stageEl.style.transform = originalTransform;
        baseCoords.x = stageRect.left + window.scrollX + stageRect.width / 2;
        baseCoords.y = stageRect.top + window.scrollY + stageRect.height / 2;
      }

      // Compute services-card-landing shift
      if (servicesLanding) {
        const rect = servicesLanding.getBoundingClientRect();
        const landingPageX = rect.left + window.scrollX + rect.width / 2;
        const landingPageY = rect.top + window.scrollY + rect.height / 2;
        servicesShift.x = landingPageX - baseCoords.x;
        servicesShift.y = landingPageY - baseCoords.y;
      }

    };

    updateCoords();
    const timer = setTimeout(updateCoords, 600);
    const timer2 = setTimeout(updateCoords, 1500);

    const handleResize = () => { updateCoords(); };
    window.addEventListener("resize", handleResize);

    // Current animated values for smooth lerping
    let currentCircleScale = 1;
    let currentBorderRadius = 0;
    let currentFixedX = 0;
    let currentFixedY = 0;
    let lastPhase = "hero";
    let snapStartMouse = { x: 0, y: 0 };
    let lockImpactTime = 0;

    const updateHeroMotion = (scroll) => {
      const stageEl = stage;
      if (!stageEl) return;

      const servicesBottomValTemp = sectionBounds.servicesBottom || (sectionBounds.theaterBottom || 0 + 1000);
      const servicesStickyEndTemp = servicesBottomValTemp - (typeof window !== 'undefined' ? window.innerHeight : 800);

      // The top of the 3rd section (#services / infinite gallery)
      const servicesTopVal = sectionBounds.servicesTop || 0;

      // Reset state at the absolute top
      if (scroll < 10) {
        hasDisappearedRef.current = false;
      }

      // Once the card is scrolled far past the services section, mark as permanently disappeared
      if (servicesTopVal > 0 && scroll >= servicesTopVal + (typeof window !== 'undefined' ? window.innerHeight : 800) * 1.2) {
        hasDisappearedRef.current = true;
      }

      // Permanent disappearance fail-safe
      if (hasDisappearedRef.current) {
        stageEl.style.display = "none";
        stageEl.style.setProperty("--stage-opacity", "0");
        return;
      }

      stageEl.style.display = "block";
      const isMobileView = isMobileRAF;
      
      const { heroBottom, theaterTop: theaterTopBound, theaterBottom: theaterBottomBound, servicesBottom } = sectionBounds;

      // Define transition zones
      const theaterTop = theaterTopBound || 0;
      const theaterBottom = theaterBottomBound || 0;
      const theaterMorphStart = theaterTop; // Circle morph begins
      
      // Snapping zones
      const theaterExitStart = theaterBottom - 500; 
      const theaterExitEnd = theaterBottom - 50; 
      
      const servicesSettleEnd = theaterExitEnd; 
      
      const servicesBottomVal = servicesBottom || (theaterBottom + 1000);
      const servicesExitStart = theaterExitEnd + 350;


      let x = 0;
      let y = 0;
      let rotation = 0;
      let scale = 1;
      let borderRadius = 0; // 0 = rectangular, 50 = full circle
      let isFixed = false;
      let opacity = 1;
      let phase = "hero";
      let circleP = 0;

      // Define target coordinates for the circle
      let targetPosX = mousePosRef.current.x;
      let targetPosY = mousePosRef.current.y;

      const circleScale = isMobileView ? 0.4 : 0.3;

      if (isMobileView) {
        // On mobile, the circle stays on the right side of the screen
        const stageW = stageEl.offsetWidth || 240;
        targetPosX = window.innerWidth - (stageW * circleScale) / 2 - 20;
        targetPosY = window.innerHeight / 2;
      }

      stageEl.style.filter = "none";

      if (scroll < theaterMorphStart) {
        // ===== PHASE 1: Hero scrolling (Flip + Morph & Fly Zone) =====
        phase = "hero";
        isFixed = false;

        const morphOffset = isMobileView ? 200 : 400;
        const morphStartZone = theaterTop - morphOffset;

        if (scroll < morphStartZone) {
          // ----- PHASE 1a: Card Flips -----
          const flipRange = morphStartZone - 0;
          const p1 = Math.min(Math.max(scroll / flipRange, 0), 1);
          const ease1 = p1 * p1 * (3 - 2 * p1); // smoothstep
          rotation = ease1 * 180;
          scale = 1;
          borderRadius = 0;
          circleP = 0;

          // Slide card toward viewport center
          const centerShiftX = 0;
          const centerShiftY = ease1 * (theaterTop - baseCoords.y);
          x = centerShiftX;
          y = centerShiftY;

          // Keep smoothMouse updated with the card's exact viewport position
          const viewCenterX = window.innerWidth / 2;
          const cardViewportY = (baseCoords.y + y) - scroll;
          smoothMouse.x = viewCenterX;
          smoothMouse.y = cardViewportY;

          stageEl.style.position = "absolute";
          stageEl.style.top = "50%";
          stageEl.style.left = "50%";
          stageEl.style.zIndex = "100";
          stageEl.classList.remove("is-locked");
        } else {
          // ----- PHASE 1b: Card morphs to circle -----
          rotation = 180; // fully flipped

          // Morph progress from 0 to 1
          const rawMorphP = Math.min(Math.max((scroll - morphStartZone) / morphOffset, 0), 1);
          const morphEase = rawMorphP * rawMorphP * (3 - 2 * rawMorphP); // smoothstep
          circleP = morphEase; // height interpolation

          borderRadius = morphEase * 50;
          scale = 1 - morphEase * (1 - circleScale);

          // Fly toward target (cursor on desktop, right side on mobile)
          const lerpFactor = 0.14;
          smoothMouse.x += (targetPosX - smoothMouse.x) * lerpFactor;
          smoothMouse.y += (targetPosY - smoothMouse.y) * lerpFactor;

          const startViewportX = window.innerWidth / 2;
          const startViewportY = theaterTop - scroll;

          const targetViewportX = startViewportX + (smoothMouse.x - startViewportX) * morphEase;
          const targetViewportY = startViewportY + (smoothMouse.y - startViewportY) * morphEase;

          x = targetViewportX - (window.innerWidth / 2);
          y = (targetViewportY + scroll) - baseCoords.y;

          stageEl.classList.remove("is-locked");
          stageEl.style.position = "absolute";
          stageEl.style.top = "50%";
          stageEl.style.left = "50%";
          stageEl.style.zIndex = "100";
        }

      } else if (scroll >= theaterMorphStart && scroll < theaterExitStart) {
        // ===== PHASE 2: Theater (circle follows cursor on desktop, stays right on mobile) =====
        phase = "theater";
        isFixed = true;
        rotation = 180;
        stageEl.classList.remove("is-locked");

        circleP = 1;
        borderRadius = 50;
        scale = circleScale;

        // Smoothly follow target position
        const lerpFactor = 0.14;
        smoothMouse.x += (targetPosX - smoothMouse.x) * lerpFactor;
        smoothMouse.y += (targetPosY - smoothMouse.y) * lerpFactor;
        currentFixedX = smoothMouse.x;
        currentFixedY = smoothMouse.y;

        // Capture position for next phase snap
        snapStartMouse.x = currentFixedX;
        snapStartMouse.y = currentFixedY;

        stageEl.style.position = "fixed";
        stageEl.style.top = "0";
        stageEl.style.left = "0";
        stageEl.style.zIndex = "9999";

      } else if (scroll >= theaterExitStart && scroll < theaterExitEnd) {
        // ===== PHASE 3: Entering Services (Snap to Center) =====
        phase = "services-snap";
        isFixed = true;
        rotation = 180;
        stageEl.classList.remove("is-locked");

        const snapP = Math.min(Math.max((scroll - theaterExitStart) / (theaterExitEnd - theaterExitStart), 0), 1);
        const snapEase = snapP * snapP * (3 - 2 * snapP);

        // Morph from circle back to rectangle
        circleP = 1 - snapEase;
        borderRadius = (1 - snapEase) * 50;
        
        // Scale down to a small card size (e.g. 0.3)
        scale = circleScale + snapEase * (0.3 - circleScale);

        // Target viewport position: center of the screen
        const landingViewportX = window.innerWidth / 2;
        const landingViewportY = window.innerHeight / 2;

        // Smoothly move from captured snapStartMouse to center of the screen
        currentFixedX = snapStartMouse.x + (landingViewportX - snapStartMouse.x) * snapEase;
        currentFixedY = snapStartMouse.y + (landingViewportY - snapStartMouse.y) * snapEase;

        stageEl.style.position = "fixed";
        stageEl.style.top = "0";
        stageEl.style.left = "0";
        stageEl.style.zIndex = "9999";

      } else if (scroll < servicesExitStart) {
        // ===== PHASE 3.5: Falling into the Abyss =====
        phase = "services-abyss";
        isFixed = true;
        rotation = 180;
        borderRadius = 0;
        circleP = 0;
        stageEl.classList.remove("is-locked");

        const abyssP = Math.min(Math.max((scroll - theaterExitEnd) / (servicesExitStart - theaterExitEnd), 0), 1);
        const abyssEase = abyssP * abyssP * (3 - 2 * abyssP); // smoothstep

        // Shrink, fade, and blur to look like it is receding into depth
        scale = 0.3 * (1 - abyssEase);
        opacity = 1 - abyssEase;
        const blurAmount = abyssEase * 8;
        stageEl.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : "none";

        // Keep it fixed in the center of the screen
        currentFixedX = window.innerWidth / 2;
        currentFixedY = window.innerHeight / 2;

        stageEl.style.position = "fixed";
        stageEl.style.top = "0";
        stageEl.style.left = "0";
        stageEl.style.zIndex = "9999";
      } else {
        phase = "services-hidden";
        rotation = 180;
        circleP = 0;
        isFixed = true;
        stageEl.classList.remove("is-locked");
        opacity = 0;
        stageEl.style.display = "none";
      }

      // Reset gallery bloom when not in Phase 4
      if (scroll < servicesExitStart) {
        const galleryEl = document.getElementById("services");
        if (galleryEl) {
          galleryEl.dataset.bloomP = "0";
          galleryEl.style.setProperty("--gallery-reveal-r", "0vmax");
        }
      }

      // Apply circle mode class for glow effect, and interpolate stage height to be a perfect square
      // circleP is properly scoped (0 = card, 1 = full circle)
      if (phase === "theater" || phase === "theater-exit" || phase === "services-snap") {
        stageEl.classList.add("circle-mode");
        // Natural card width & height
        const naturalW = stageEl.offsetWidth || 300;
        const naturalH = parseFloat(stageEl.dataset.naturalH || stageEl.offsetHeight) || 388;
        // Store natural height once
        if (!stageEl.dataset.naturalH) stageEl.dataset.naturalH = stageEl.offsetHeight;
        // Smoothly squish height → width so border-radius 50% makes a perfect circle
        const targetH = naturalW + (naturalH - naturalW) * (1 - circleP);
        stageEl.style.height = `${targetH}px`;
      } else {
        stageEl.classList.remove("circle-mode");
        stageEl.style.height = "";
        delete stageEl.dataset.naturalH;
      }

      // ── Hero → Theater blend: scroll-linked dark overlay fade + upward drift ──
      const theaterTopVal = sectionBounds.theaterTop || window.innerHeight || 800;
      // Overlay fades in during the last 60% of the hero scroll
      const blendStart = theaterTopVal * 0.4;
      const blendP = Math.min(Math.max((scroll - blendStart) / (theaterTopVal - blendStart), 0), 1);
      const blendEase = blendP * blendP * (3 - 2 * blendP);

      // Hero content parallax upward + fade - target only text elements to keep ancestors untransformed for card positioning
      const textElements = document.querySelectorAll(".hero-top-left, .hero-letter, .hero-filler-layer");
      const heroFade = Math.max(1 - blendEase * 1.4, 0);
      textElements.forEach((el) => {
        el.style.opacity = heroFade.toString();
        el.style.transform = `translate3d(0, ${-blendEase * 60}px, 0)`;
        el.style.willChange = "transform, opacity";
      });

      // Fade the red smoke background (ShaderBackground) to black directly as we scroll to the video
      const shaderBg = document.querySelector(".hero-bg");
      if (shaderBg) {
        const newShaderOpacity = (1 - blendEase).toFixed(3);
        if (_cachedShaderOpacity !== newShaderOpacity) {
          shaderBg.style.opacity = newShaderOpacity;
          _cachedShaderOpacity = newShaderOpacity;
        }
      }

      // Boxy grid interactive scroll transition classes
      const overlayEl = document.querySelector(".theater-grid-overlay");
      if (overlayEl) {
        // For mobile, start much later so there's no dead black space
        const triggerPoint = isMobileView ? (theaterTopVal - window.innerHeight * 0.4) : theaterTopVal;
        overlayEl.classList.toggle("video-reached", scroll >= triggerPoint);
        
        // State 2: Collapse completely
        overlayEl.classList.toggle("video-fully-active", scroll >= triggerPoint + 400);
      }

      // Auto-play/pause video based on viewport
      if (vimeoPlayer) {
        const shouldPlay = scroll >= theaterTopVal - window.innerHeight && scroll < theaterTopVal + window.innerHeight * 2;
        if (shouldPlay && !isPlayingRef.current) {
          isPlayingRef.current = true;
          vimeoPlayer.play().catch(() => {});
        } else if (!shouldPlay && isPlayingRef.current) {
          isPlayingRef.current = false;
          vimeoPlayer.pause().catch(() => {});
        }
      }


      // Apply transforms based on phase
      if (isFixed) {
        // Fixed positioning: use direct pixel coordinates
        const stageW = stage.offsetWidth || 300;
        const stageH = stage.offsetHeight || 380;
        const transformX = currentFixedX - stageW / 2;
        const transformY = currentFixedY - stageH / 2;
        stage.style.transform = `translate3d(${transformX}px, ${transformY}px, 0) scale(${scale})`;
        stage.style.setProperty("--flip-rotation", `${rotation}deg`);
        stage.style.setProperty("--flip-shift", `${rotation > 0 ? (rotation / 180) * 18 : 0}px`);
        stage.style.setProperty("--stage-scale", "1");
        stage.style.setProperty("--stage-opacity", `${opacity}`);
        stage.style.setProperty("--card-border-radius", `${borderRadius}%`);
      } else {
        stage.style.setProperty("--flip-rotation", `${rotation}deg`);
        stage.style.setProperty("--flip-shift", `${rotation > 0 ? (rotation / 180) * 18 : 0}px`);
        stage.style.setProperty("--stage-shift", `${y}px`);
        stage.style.setProperty("--stage-shift-x", `${x}px`);
        stage.style.setProperty("--stage-scale", `${scale}`);
        stage.style.setProperty("--stage-opacity", `${opacity}`);
        stage.style.setProperty("--card-border-radius", `${borderRadius}%`);

        stage.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${scale})`;
      }

      stage.style.pointerEvents = opacity <= 0.05 ? "none" : "auto";

      // Text parallax — only write if value changed meaningfully
      const textParallaxP = Math.min(Math.max(scroll / (sectionBounds.theaterTop || window.innerHeight), 0), 1);
      const newTextParallax = `${Math.round(textParallaxP * 180)}px`;
      if (_cachedTextParallax !== newTextParallax) {
        scene.style.setProperty("--text-parallax", newTextParallax);
        _cachedTextParallax = newTextParallax;
      }

      stage.dataset.phase = phase; 
      scene.classList.toggle("card-over-video", scroll > 10);

      lastPhase = phase;
    };

    let lastScroll = 0;
    let rafId = 0;
    // Mobile: throttle to ~30fps to halve CPU cost
    const RAF_INTERVAL = isMobileRAF ? 1000 / 30 : 0;
    let lastRafTime = 0;

    const raf = (time) => {
      // Throttle on mobile
      if (RAF_INTERVAL > 0 && time - lastRafTime < RAF_INTERVAL) {
        rafId = window.requestAnimationFrame(raf);
        return;
      }
      lastRafTime = time;

      lenis.raf(time);
      const currentScroll = Math.max(lenis.scroll || 0, window.scrollY || 0);
      updateHeroMotion(currentScroll);

      // Check if services section is active to trigger text entrance animation
      const servicesTopBound = sectionBounds.servicesTop || 0;
      const servicesBottomBound = sectionBounds.servicesBottom || 0;
      if (servicesTopBound && servicesBottomBound) {
        const isActive = currentScroll >= (servicesTopBound - 350) && currentScroll < (servicesBottomBound - 150);
        if (isActive !== isServicesTextVisibleRef.current) {
          isServicesTextVisibleRef.current = isActive;
          setIsServicesTextVisible(isActive);
        }
      }

      // Scroll bound triggers between #services and #media-carousel
      const { servicesBottom } = sectionBounds;
      if (servicesBottom && !isTransitioningRef.current && !scrollCooldownRef.current && !activeModalItemRef.current) {
        const isScrollingDown = currentScroll > lastScroll;
        const servicesThresholdDown = servicesBottom - window.innerHeight - 20;
        const servicesThresholdUp = servicesBottom - 150;

        // Downward trigger: from services to media-carousel
        if (isScrollingDown && currentScroll > servicesThresholdDown && lastScroll <= servicesThresholdDown) {
          transitionToSection('#media-carousel');
        }
        
        // Upward trigger: from media-carousel to services
        if (!isScrollingDown && currentScroll < servicesThresholdUp && lastScroll >= servicesThresholdUp && currentScroll > servicesBottom - window.innerHeight) {
          transitionToSection(servicesBottom - window.innerHeight - 350);
        }
      }

      lastScroll = currentScroll;
      rafId = window.requestAnimationFrame(raf);
    };

    updateHeroMotion(0);
    rafId = window.requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleOrientation);
      if (rafId) window.cancelAnimationFrame(rafId);
      const overlay = document.getElementById("hero-blend-overlay");
      if (overlay) overlay.remove();
    };
  }, [gyroPermission]); // Re-run if permission changes to re-add orientation listener

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitText("Message ready");
    event.currentTarget.reset();
    window.setTimeout(() => {
      setSubmitText("Submit");
    }, 2200);
  }

  return (
    <div className="site-shell" onClick={() => { if (gyroPermission === "pending") requestGyro(); }}>
      <main>

        <div className="hero-scene" id="home" aria-labelledby="hero-title" ref={heroSceneRef}>
          <ShaderBackground className="hero-bg" smokeColor="#E3142A" />
          <section className="hero">
            <div className="hero-top-left">
              <div className="hero-info">
                <span className="info-label">A Rahul portfolio</span>
                <span className="info-label">Project: RAHUL®</span>
                <span className="info-label">Director</span>
                <span className="info-label">Product Design</span>
              </div>
              <div className="hero-status">
                <span className="dot-indicator"></span> Available for projects
                <br/><span className="sub-date">EARLY FEB 2025</span>
              </div>
            </div>

            <div className="hero-main-display">
              <div className="display-text-container">
                <span className="hero-letter">R</span>
                <div className="hero-card-container">
                  <div className="portrait-stage" aria-label="Portrait card" ref={portraitStageRef}>
                    <div className="portrait-card portrait-card-back">
                      <img src="/images/IMG_6471.jpg" alt="Back portrait" />
                    </div>
                    <div className="portrait-card portrait-card-front">
                      <img
                        src="/images/IMG_5775.PNG"
                        alt="Portrait of designer Rahul"
                      />
                      {/* Reference labels that appear in 3rd section */}
                      <div className="card-label card-label-top">SINCE — 2024</div>
                      <div className="card-label card-label-bottom">
                        <div className="label-name">RAHUL®</div>
                        <div className="label-role">Digital Designer & Art Director</div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="hero-letter">H</span>
                <span className="hero-letter">U</span>
                <span className="hero-letter">L</span>
              </div>
            </div>
            <div className="hero-filler-layer" aria-hidden="true">
              <p className="hero-filler-title">l1lRED</p>
              <p className="hero-note hero-note-left">Selected identity fragments, motion tests, and visual systems.</p>
              <p className="hero-note hero-note-center">Digital designer building image-led product stories.</p>
              <p className="hero-note hero-note-right">Portfolio edition: Rahul / experimental web direction.</p>
              <p className="hero-note hero-note-bottom">Scroll for the next frame.</p>
            </div>
          </section>
        </div>

        {/* Cinematic Theater Section with Scroll Snapping / Pinning */}
        <section className="theater-track" ref={(el) => { theaterRef.current = el; theaterSectionRef.current = el; }}>
          <div className="theater-sticky">
            <div className="theater-grain" />
            <div className="theater-light-beam" />
            
            {/* Main Cinema Screen Container */}
            <motion.div 
              className="theater-container"
              style={{
                scale: theaterScale,
                width: theaterWidth,
              }}
            >
              {/* Dynamic Backglow reflecting projection */}
              <motion.div 
                className="theater-ambient-glow"
                style={{ opacity: theaterGlowOpacity }}
              />

              {/* The high-contrast outer frame */}
              <motion.div 
                className="theater-frame-outer"
                style={{ 
                  borderRadius: theaterBorderRadius,
                  borderWidth: theaterBorderWidth 
                }}
              >
                {/* Boxy grid overlay at the top */}
                <div className="theater-grid-overlay">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="grid-box" />
                  ))}
                </div>

                {/* Subtle bottom fade */}
                <div className="theater-bottom-fade" />

                {/* Yellow caution stripe on the top right */}
                <motion.div 
                  className="caution-strip"
                  style={{ opacity: hudOpacity }}
                />

                {/* Left film reel sprocket holes */}
                <motion.div 
                  className="film-perforations film-perforations-left"
                  style={{ opacity: hudOpacity }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="perforation-hole" />
                  ))}
                </motion.div>

                {/* Right film reel sprocket holes */}
                <motion.div 
                  className="film-perforations film-perforations-right"
                  style={{ opacity: hudOpacity }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="perforation-hole" />
                  ))}
                </motion.div>

                {/* Cinematic HUD Overlays */}
                <motion.div 
                  className="theater-hud"
                  style={{ opacity: hudOpacity }}
                >
                  <div className="theater-hud-top">
                    <span className="hud-tag hud-tag-rec">REC [RAW EDIT]</span>
                    <span className="hud-crosshair">+</span>
                    <span className="hud-tag">SCREEN 01</span>
                  </div>
                  
                  <div />

                  <div className="theater-hud-bottom">
                    {/* Live ticking timecode */}
                    <div className="hud-timecode">
                      TC {timecode}
                    </div>

                    {/* Animated audio waves */}
                    <div className="audio-visualizer">
                      <div className="visualizer-bar" style={{ animationPlayState: isMuted ? 'paused' : 'running' }} />
                      <div className="visualizer-bar" style={{ animationPlayState: isMuted ? 'paused' : 'running' }} />
                      <div className="visualizer-bar" style={{ animationPlayState: isMuted ? 'paused' : 'running' }} />
                      <div className="visualizer-bar" style={{ animationPlayState: isMuted ? 'paused' : 'running' }} />
                      <div className="visualizer-bar" style={{ animationPlayState: isMuted ? 'paused' : 'running' }} />
                    </div>
                  </div>
                </motion.div>

                {/* Embedded Vimeo Video */}
                <div className="theater-video-wrapper">
                  <iframe
                    ref={iframeRef}
                    className="theater-video"
                    src="https://player.vimeo.com/video/1197780573?background=1&autoplay=1&loop=1&muted=1&api=1"
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="autoplay; fullscreen"
                    title="Cinematic Theater Video"
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Volume & Scroll Controls */}
            <div className="theater-controls">
              <button 
                className="theater-mute-btn" 
                type="button"
                onClick={toggleMute}
              >
                {isMuted ? "🔇 UNMUTE AUDIO" : "🔊 MUTE AUDIO"}
              </button>
            </div>
          </div>
        </section>

        <section
          className="infinite-gallery-section services-gallery"
          id="services"
          aria-label="Infinite gallery"
          ref={servicesSectionRef}
        >
          <div className="infinite-gallery-container">
            <InfiniteGallery
              images={infiniteGalleryImages}
              speed={1.2}
              zSpacing={3}
              visibleCount={12}
              falloff={{ near: 0.8, far: 14 }}
              className="infinite-gallery-canvas"
            />
            <div className="gallery-brutalist-ui" aria-label="Statement">
              <svg
                className="gallery-worn-filters"
                aria-hidden="true"
                focusable="false"
                width="0"
                height="0"
              >
                <defs>
                  <filter
                    id="gallery-worn-heavy"
                    x="-8%"
                    y="-8%"
                    width="116%"
                    height="116%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.07 0.11"
                      numOctaves="3"
                      seed="8"
                      result="noise"
                    />
                    <feDisplacementMap
                      in="SourceGraphic"
                      in2="noise"
                      scale="2.4"
                      xChannelSelector="R"
                      yChannelSelector="G"
                    />
                  </filter>
                  <filter
                    id="gallery-worn-light"
                    x="-6%"
                    y="-6%"
                    width="112%"
                    height="112%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.12 0.18"
                      numOctaves="2"
                      seed="3"
                      result="noise"
                    />
                    <feDisplacementMap
                      in="SourceGraphic"
                      in2="noise"
                      scale="0.9"
                      xChannelSelector="R"
                      yChannelSelector="G"
                    />
                  </filter>
                </defs>
              </svg>
              <motion.p 
                className="gallery-brutalist-meta gallery-brutalist-meta--left gallery-brutalist-worn gallery-brutalist-worn--light"
                variants={metaLeftVariants}
                initial="hidden"
                animate={isServicesTextVisible ? "visible" : "hidden"}
              >
                Powered by God
              </motion.p>
              <motion.p 
                className="gallery-brutalist-meta gallery-brutalist-meta--right gallery-brutalist-worn gallery-brutalist-worn--light"
                variants={metaRightVariants}
                initial="hidden"
                animate={isServicesTextVisible ? "visible" : "hidden"}
              >
                Art with purpose
              </motion.p>
              <div className="gallery-overlay-text" ref={quoteRef}>
                <h2 className={`gallery-quote gallery-brutalist-worn gallery-brutalist-worn--heavy ${isServicesTextVisible ? 'is-active' : ''}`}>
                  <span className="gallery-quote-line">
                    {["I", "AM"].map((word, i) => (
                      <span
                        key={`w-1-${i}`}
                        className="quote-word-item"
                        style={{ opacity: 0 }}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                  <span className="gallery-quote-line">
                    {["THE"].map((word, i) => (
                      <span
                        key={`w-2-${i}`}
                        className="quote-word-item"
                        style={{ opacity: 0 }}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                  <span className="gallery-quote-line">
                    {["UNIVERSE"].map((word, i) => (
                      <span
                        key={`w-3-${i}`}
                        className="quote-word-item"
                        style={{ opacity: 0 }}
                      >
                        {"UNIVERSE".split("").map((char, charIdx) => (
                          <span key={charIdx} className="bleed-char" style={{ display: "inline-block" }}>
                            {char}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </h2>
              </div>
              <motion.div 
                className="gallery-brutalist-footer gallery-brutalist-worn gallery-brutalist-worn--light"
                variants={galleryFooterVariants}
                initial="hidden"
                animate={isServicesTextVisible ? "visible" : "hidden"}
              >
                <span className="gallery-brutalist-star" aria-hidden="true">
                  ★
                </span>
                <p className="gallery-brutalist-credit">
                  <span className="gallery-brutalist-credit-name">
                    @idosomethinguseless
                  </span>
                </p>
              </motion.div>
            </div>
            <div className="services-card-landing" aria-hidden="true" />
          </div>
        </section>

        <FullscreenVideoShowcase
          items={mediaCarouselItems}
          lenisRef={lenisRef}
          onItemClick={setActiveModalItem}
        />

        <DualStackFeedback />


      </main>

      <motion.footer 
        ref={footerRef}
        id="contact"
        className="footer-reveal-container"
        style={{
          clipPath: useMotionTemplate`circle(${circleRadius} at 50% 100%)`
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { 
              opacity: 1, 
              y: 0,
              transition: {
                duration: 0.6,
                delay: 0.25,
                ease: "easeOut"
              }
            }
          }}
          initial="hidden"
          animate={footerActive ? "visible" : "hidden"}
          className="footer-content-wrapper"
        >
          <div className="footer-top">
            <div className="footer-col">
              <span className="footer-label">DESIGN & ART DIRECTION</span>
              <span className="footer-value">AVAILABLE FOR FREELANCE & CONTRACT</span>
            </div>
            <div className="footer-col">
            </div>
            <div className="footer-col align-right">
              <span className="footer-label">SAY HELLO</span>
              <a href="mailto:Rahulcdf17@gmail.com" className="footer-email">RAHULCDF17@GMAIL.COM</a>
            </div>
          </div>

          <div className="footer-title-wrap">
            <h2 className="footer-title">RAHUL</h2>
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">©2026 RAHUL. ALL RIGHTS RESERVED.</p>
            <div className="footer-socials">
              <a href="https://www.instagram.com/l1llred" target="_blank" rel="noreferrer">INSTAGRAM</a>
            </div>
          </div>
        </motion.div>
      </motion.footer>

      {/* SVG Filter to dynamically map the bright red in the custom portrait to #C74A57 */}
      <svg style={{ display: 'none' }}>
        <defs>
          <filter id="red-sync">
            <feColorMatrix
              type="matrix"
              values="
                0.78 0 0 0 0
                0.29 0 0 0 0
                0.34 0 0 0 0
                0    0 0 1 0
              "
            />
          </filter>
        </defs>
      </svg>

      {/* ─── Premium brutalist media modal popup ─── */}
      {activeModalItem && (
        <div 
          className="media-modal-overlay" 
          onClick={() => setActiveModalItem(null)}
          aria-modal="true"
          role="dialog"
        >
          <div 
            className="media-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="media-modal-close" 
              onClick={() => setActiveModalItem(null)}
            >
              CLOSE [X]
            </button>
            <div className={activeModalItem.className.includes("landscape") ? "media-modal-player-landscape" : "media-modal-player-portrait"}>
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

      {/* Horizontal Page-Wipe Transition Overlay */}
      <div className="page-wipe-overlay">
        <div className="page-wipe-content">
          <div className="page-wipe-image" />
          <div className="page-wipe-text">
            <h2 className="wipe-heading">RAHUL®</h2>
            <p className="wipe-sub">DIGITAL PORTFOLIO SHOWCASE</p>
          </div>
        </div>
      </div>
    </div>
  );
}




