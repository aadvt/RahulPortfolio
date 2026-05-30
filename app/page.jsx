"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { motion, useScroll, useTransform } from "framer-motion";
import anime from "animejs";
import ShaderBackground from "../components/ShaderBackground";
import GradientBackground from "../components/GradientBackground";

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

const projects = [
  {
    title: "Black Geometric Prisms",
    featured: true,
    category: "Branding",
    year: "2025",
    client: "Studio Prism",
    image: "https://framerusercontent.com/images/2nWXrWvPxxMHSpsOkNYf8KjzP7Q.jpeg",
    description:
      "A collection of sharp, angular black prisms floating against a gradient dark background, showcasing a sophisticated approach to digital 3D geometric composition.",
  },
  {
    title: "Pantone Very Peri Poster Design",
    featured: false,
    category: "Graphic Design",
    year: "2024",
    image: "https://framerusercontent.com/images/RFcUbpIGFydbU9WBSTc9HJRQI.jpeg",
    description:
      "A minimalist poster inspired by Pantone Very Peri, combining clean typography, a soft periwinkle background, and a delicate blue branch illustration.",
  },
  {
    title: "Coral Spiral Abstract",
    featured: true,
    category: "Branding",
    year: "2025",
    client: "VisualForms Studio",
    image: "https://framerusercontent.com/images/qbjsnnvP9w7UaA2syp36oUe8OSo.jpg",
    description:
      "A visually striking 3D abstract artwork featuring a coral-colored spiral form with smooth curves and a soft pink gradient background.",
  },
  {
    title: "Intenza Brand Boutique E-Gift Card Design",
    featured: false,
    category: "Graphic Design",
    year: "2023",
    image: "https://framerusercontent.com/images/346Dg9EFyDG62n4PMiwIhATISNU.jpeg",
    description:
      "A modern and elegant e-gift card for Intenza Brand Boutique with a premium black holder and active lifestyle imagery.",
  },
  {
    title: "Summer Vibes Festival Campaign",
    featured: true,
    category: "Graphic Design",
    year: "2024",
    client: "FestivalWorks",
    image: "https://framerusercontent.com/images/w08JBQPFYIq2vr4OfcD9W6vxEug.jpeg",
    description:
      "Promotional materials for Summer Vibes Festival, including posters, flyers, and social media graphics.",
  },
  {
    title: "ShopEase Redesign Sprint",
    featured: true,
    category: "UI / UX Design",
    year: "2025",
    client: "ShopEase",
    image: "https://framerusercontent.com/images/nTU7b0ZAdWdlqCI4mQ4tGTPpDs.jpeg",
    description:
      "A redesign sprint focused on simplifying navigation, optimizing checkout, and improving a commerce app experience.",
  },
  {
    title: "VistaHaven",
    featured: false,
    category: "Web Design",
    year: "2025",
    image: "https://framerusercontent.com/images/RzBOpbFyAywEXNkFbMTKVhq44.jpg",
    description:
      "A sleek real estate template designed to showcase luxury properties with elegance and sophistication.",
  },
  {
    title: "InnovateTech Identity Rollout",
    featured: false,
    category: "Branding",
    year: "2025",
    image: "https://framerusercontent.com/images/NbFTTP3LTcQw2s8139xTJnscc.jpeg",
    description:
      "A cohesive identity system with logo, color palette, and visual style guide for a forward-looking technology company.",
  },
];

const posts = [
  {
    title: "5 Design Trends That Will Define 2024",
    category: "Insights",
    date: "Apr 30, 2025",
    pinned: false,
    image: "https://framerusercontent.com/images/1wFj19qQG6zNr7gj3iTlH0Gdlu8.jpeg",
    description:
      "Explore the design trends influencing web, UI/UX, and branding projects, from 3D lettering to visible grid systems.",
  },
  {
    title: "The Power of Typography in Web Design",
    category: "Insights",
    date: "May 2, 2025",
    pinned: false,
    image: "https://framerusercontent.com/images/mu6sFIgrbmHNxa3m94cG4VVROM.jpeg",
    description:
      "Learn how typography can make or break a website and how to choose fonts for impact, clarity, and readability.",
  },
  {
    title: "How to Streamline Your Design Workflow",
    category: "Tutorials",
    date: "Apr 27, 2025",
    pinned: true,
    image: "https://framerusercontent.com/images/xmKml0E7v2iBI4zbbj0yVccaQwg.jpeg",
    description:
      "Practical strategies to improve your design process, save time, and deliver quality work more efficiently.",
  },
  {
    title: "The Role of Color Psychology in Branding",
    category: "Insights",
    date: "Apr 22, 2025",
    pinned: false,
    image: "https://framerusercontent.com/images/RFcUbpIGFydbU9WBSTc9HJRQI.jpeg",
    description:
      "Understand how colors evoke emotions and influence brand perception to create designs that connect.",
  },
  {
    title: "Mastering UI/UX Design: Key Principles for Success",
    category: "Resources",
    date: "Mar 30, 2025",
    pinned: false,
    image: "https://framerusercontent.com/images/9HduiIXX5eSq1WREpvO4qCnKM.jpeg",
    description:
      "Foundational UI/UX principles for seamless, enjoyable, and user-centered digital experiences.",
  },
  {
    title: "Balancing Creativity and Functionality in Design",
    category: "Insights",
    date: "Apr 5, 2025",
    pinned: false,
    image: "https://framerusercontent.com/images/7RrI1CE0NHr8L8o3ZXGWxQDFQc.jpeg",
    description:
      "How to create visually expressive designs that stay practical, accessible, and easy to use.",
  },
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

function FeaturedProjectCard({ project, index, total, scrollYProgress }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth > 810);
    const handleResize = () => setIsDesktop(window.innerWidth > 810);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const targetScale = 1 - ((total - 1 - index) * 0.05);
  const range = [index * (1 / total), 1];

  const scaleTransform = useTransform(scrollYProgress, range, [1, targetScale]);
  const overlayRange = [index * (1 / total), (index + 1) * (1 / total)];
  const opacityTransform = useTransform(scrollYProgress, overlayRange, [0, 0.6]);

  const scale = isDesktop ? scaleTransform : 1;
  const opacity = isDesktop ? opacityTransform : 0;

  return (
    <div className="featured-card-wrapper">
      <motion.article
        className="featured-card"
        style={isDesktop ? {
          scale,
          position: "sticky",
          top: `calc(120px + ${index * 24}px)`,
          transformOrigin: "top center",
        } : {}}
      >
        <a className="featured-media" href="#contact" aria-label={`Discuss ${project.title}`} style={{ position: "relative", display: "block" }}>
          <img src={project.image} alt={project.title} loading="lazy" />
          {isDesktop && (
            <motion.div
              className="card-dimmer"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 1)",
                opacity: index < total - 1 ? opacity : 0,
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          )}
        </a>
        <div className="featured-copy">
          <MetaRow items={[project.category, project.year, project.client]} />
          <h3>{project.title}</h3>
          <p>{project.description}</p>
        </div>
      </motion.article>
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
  const portraitStageRef = useRef(null);
  const projectsContainerRef = useRef(null);
  const theaterSectionRef = useRef(null);
  const mousePosRef = useRef({ x: 600, y: 400 });
  const { scrollYProgress } = useScroll({
    target: projectsContainerRef,
    offset: ["start start", "end end"]
  });
  const featuredProjects = projects.filter((project) => project.featured).slice(0, 4);
  const moreProjects = projects.filter((project) => !project.featured);
  const pinnedPost = posts.find((post) => post.pinned) || posts[0];
  const otherPosts = posts.filter((post) => post !== pinnedPost);

  // Services section reference
  const servicesSectionRef = useRef(null);
  const { scrollYProgress: servicesProgress } = useScroll({
    target: servicesSectionRef,
    offset: ["start 50%", "start 10%"]
  });
  const servicesOpacity = useTransform(servicesProgress, [0, 0.4, 1], [0, 0, 1]);

  // Theater section references and scroll transforms
  const theaterRef = useRef(null);
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [timecode, setTimecode] = useState("00:14:23:18");

  const { scrollYProgress: theaterProgress } = useScroll({
    target: theaterRef,
    offset: ["start start", "end end"]
  });

  const theaterScale = useTransform(theaterProgress, [0, 0.7, 1], [0.72, 1.05, 1.05]);
  const theaterWidth = useTransform(theaterProgress, [0, 0.7], ["min(calc(100% - 40px), 1100px)", "100%"]);
  const theaterBorderRadius = useTransform(theaterProgress, [0, 0.6], ["24px", "0px"]);
  const theaterBorderWidth = useTransform(theaterProgress, [0, 0.6], ["4px", "0px"]);
  const theaterGlowOpacity = useTransform(theaterProgress, [0, 0.4, 0.8], [0.35, 0.9, 0.1]);
  const hudOpacity = useTransform(theaterProgress, [0.35, 0.6], [1, 0]);

  // Live ticking timecode for brutalist film overlay
  useEffect(() => {
    let hours = 0;
    let minutes = 14;
    let seconds = 23;
    let frames = 18;

    const interval = setInterval(() => {
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
    }, 1000 / 24); // 24 fps tick

    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMute = !videoRef.current.muted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", true);
  }, []);

  useEffect(() => {
    const scene = heroSceneRef.current;
    const stage = portraitStageRef.current;
    if (!scene || !stage) return;

    const lenis = new Lenis({
      duration: 1.2,
      lerp: 0.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: "vertical",
      gestureDirection: "vertical",
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 1.5,
      infinite: false,
    });

    // Mouse tracking for cursor-following circle
    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Smoothed cursor position for buttery following
    let smoothMouse = { x: mousePosRef.current.x, y: mousePosRef.current.y };

    let sectionBounds = { heroBottom: 0, theaterTop: 0, theaterBottom: 0, aboutTop: 0, aboutBottom: 0 };
    let baseCoords = { x: 0, y: 0 };
    let aboutShift = { x: 0, y: 0 };

    const updateCoords = () => {
      const stageEl = stage;
      const theaterEl = theaterSectionRef.current;
      const aboutLanding = document.querySelector(".about-card-landing");
      const aboutSection = document.getElementById("about");

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

      // Get about section bounds
      if (aboutSection) {
        const aRect = aboutSection.getBoundingClientRect();
        sectionBounds.aboutTop = aRect.top + window.scrollY;
        sectionBounds.aboutBottom = aRect.bottom + window.scrollY;
      }

      // Compute base position (card's natural resting spot)
      const originalTransform = stageEl.style.transform;
      stageEl.style.transform = "none";
      const stageRect = stageEl.getBoundingClientRect();
      stageEl.style.transform = originalTransform;

      baseCoords.x = stageRect.left + window.scrollX + stageRect.width / 2;
      baseCoords.y = stageRect.top + window.scrollY + stageRect.height / 2;

      // Compute about-card-landing shift
      if (aboutLanding) {
        const rect = aboutLanding.getBoundingClientRect();
        const landingPageX = rect.left + window.scrollX + rect.width / 2;
        const landingPageY = rect.top + window.scrollY + rect.height / 2;
        aboutShift.x = landingPageX - baseCoords.x;
        aboutShift.y = landingPageY - baseCoords.y;
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

    const updateHeroMotion = (scroll) => {
      if (window.innerWidth <= 768) {
        stage.style.position = "absolute";
        stage.style.top = "50%";
        stage.style.left = "50%";
        stage.style.setProperty("--flip-rotation", "0deg");
        stage.style.setProperty("--flip-shift", "0px");
        stage.style.setProperty("--stage-shift", "0px");
        stage.style.setProperty("--stage-shift-x", "0px");
        stage.style.setProperty("--stage-scale", "1");
        stage.style.setProperty("--stage-opacity", "1");
        stage.style.setProperty("--card-border-radius", "0px");
        scene.style.setProperty("--text-parallax", "0px");
        stage.classList.remove("circle-mode");
        return;
      }

      const { heroBottom, theaterTop, theaterBottom, aboutTop } = sectionBounds;

      // Define transition zones
      const heroFlipEnd = theaterTop; // Card flips as user scrolls through hero
      const theaterMorphStart = theaterTop; // Circle morph begins
      const theaterMorphEnd = theaterTop + 300; // Circle morph completes (300px into theater)
      const theaterExitStart = theaterBottom - 400; // Begin unmorph
      const theaterExitEnd = theaterBottom; // Fully unmorphed, begin about transition
      const aboutSettleEnd = aboutTop + 600; // Card settles into about landing

      let x = 0;
      let y = 0;
      let rotation = 0;
      let scale = 1;
      let borderRadius = 0; // 0 = rectangular, 50 = full circle
      let isFixed = false;
      let opacity = 1;
      let phase = "hero";
      // circleP: 0 = card shape, 1 = full circle — used for height squishing
      let circleP = 0;

      if (scroll < theaterMorphStart) {
        // ===== PHASE 1: Hero scrolling (Flip + Morph & Fly Zone) =====
        phase = "hero";
        isFixed = false;

        const morphStartZone = theaterTop - 400;

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

        } else {
          // ----- PHASE 1b: Card morphs to circle & flies to cursor -----
          rotation = 180; // fully flipped

          // Morph progress from 0 to 1 over the last 400px of the hero section
          const rawMorphP = Math.min(Math.max((scroll - morphStartZone) / 400, 0), 1);
          const morphEase = rawMorphP * rawMorphP * (3 - 2 * rawMorphP); // smoothstep
          circleP = morphEase; // exposed to height interpolation

          borderRadius = morphEase * 50;
          scale = 1 - morphEase * 0.7; // Scale down to 0.3 (cursor circle)

          // Smooth cursor following
          const lerpFactor = 0.14;
          smoothMouse.x += (mousePosRef.current.x - smoothMouse.x) * lerpFactor;
          smoothMouse.y += (mousePosRef.current.y - smoothMouse.y) * lerpFactor;

          // Card starts at center-top of viewport at morphStartZone
          const startViewportX = window.innerWidth / 2;
          const startViewportY = theaterTop - scroll;

          // Interpolate viewport relative position from startViewport to smoothMouse
          const targetViewportX = startViewportX + (smoothMouse.x - startViewportX) * morphEase;
          const targetViewportY = startViewportY + (smoothMouse.y - startViewportY) * morphEase;

          // Convert viewport coordinate to page coordinates (since isFixed is false, positioning is absolute)
          x = targetViewportX - (window.innerWidth / 2);
          y = (targetViewportY + scroll) - baseCoords.y;
        }

        stage.style.position = "absolute";
        stage.style.top = "50%";
        stage.style.left = "50%";
        stage.style.zIndex = "100";

      } else if (scroll >= theaterMorphStart && scroll < theaterExitStart) {
        // ===== PHASE 2: Theater (circle morph + cursor follow) =====
        phase = "theater";
        isFixed = true;
        rotation = 180;

        // Morph is fully complete
        circleP = 1; // exposed to height interpolation
        borderRadius = 50;
        scale = 0.3; // fully shrunk

        // Smooth cursor following
        const lerpFactor = 0.14;
        smoothMouse.x += (mousePosRef.current.x - smoothMouse.x) * lerpFactor;
        smoothMouse.y += (mousePosRef.current.y - smoothMouse.y) * lerpFactor;

        // Glued to the cursor
        currentFixedX = smoothMouse.x;
        currentFixedY = smoothMouse.y;

        stage.style.position = "fixed";
        stage.style.top = "0";
        stage.style.left = "0";
        stage.style.zIndex = "9999";

      } else if (scroll >= theaterExitStart && scroll < theaterExitEnd) {
        // ===== PHASE 2.5: Theater exit (un-morph from circle back to card) =====
        phase = "theater-exit";
        isFixed = true;
        rotation = 180;

        const rawExitP = Math.min(Math.max((scroll - theaterExitStart) / (theaterExitEnd - theaterExitStart), 0), 1);
        const exitEase = rawExitP * rawExitP * (3 - 2 * rawExitP);
        circleP = 1 - exitEase; // exposed to height interpolation

        borderRadius = 50 * (1 - exitEase);
        scale = 0.3 + exitEase * 0.7; // Scale back up to 1

        // Move from cursor position toward center bottom of viewport
        smoothMouse.x += (mousePosRef.current.x - smoothMouse.x) * 0.12;
        smoothMouse.y += (mousePosRef.current.y - smoothMouse.y) * 0.12;

        const viewCenterX = window.innerWidth / 2;
        const viewCenterY = window.innerHeight / 2;

        currentFixedX = smoothMouse.x + (viewCenterX - smoothMouse.x) * exitEase;
        currentFixedY = smoothMouse.y + (viewCenterY - smoothMouse.y) * exitEase;

        stage.style.position = "fixed";
        stage.style.top = "0";
        stage.style.left = "0";
        stage.style.zIndex = "9999";

      } else {
        // ===== PHASE 3: About section (card flies to about-card-landing) =====
        phase = "about";
        rotation = 180;
        borderRadius = 0;

        const settleP = Math.min(Math.max((scroll - theaterExitEnd) / (aboutSettleEnd - theaterExitEnd), 0), 1);
        const settleEase = settleP * settleP * (3 - 2 * settleP);

        // Interpolate smoothly from viewport center to the absolute About landing position to eliminate jumps
        const startAbsoluteX = (window.innerWidth / 2) - baseCoords.x;
        const startAbsoluteY = (theaterExitEnd + window.innerHeight / 2) - baseCoords.y;

        x = startAbsoluteX + settleEase * (aboutShift.x - startAbsoluteX);
        y = startAbsoluteY + settleEase * (aboutShift.y - startAbsoluteY);

        stage.style.position = "absolute";
        stage.style.top = "50%";
        stage.style.left = "50%";
        stage.style.zIndex = "100";
      }

      // Apply circle mode class for glow effect, and interpolate stage height to be a perfect square
      // circleP is properly scoped (0 = card, 1 = full circle)
      if (phase === "theater" || phase === "theater-exit") {
        stage.classList.add("circle-mode");
        // Natural card width & height
        const naturalW = stage.offsetWidth || 300;
        const naturalH = parseFloat(stage.dataset.naturalH || stage.offsetHeight) || 388;
        // Store natural height once
        if (!stage.dataset.naturalH) stage.dataset.naturalH = stage.offsetHeight;
        // Smoothly squish height → width so border-radius 50% makes a perfect circle
        const targetH = naturalW + (naturalH - naturalW) * (1 - circleP);
        stage.style.height = `${targetH}px`;
      } else {
        stage.classList.remove("circle-mode");
        stage.style.height = "";
        delete stage.dataset.naturalH;
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
        shaderBg.style.opacity = (1 - blendEase).toString();
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
        stage.style.setProperty("--stage-opacity", "1");
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

      // Text parallax
      const textParallaxP = Math.min(Math.max(scroll / (sectionBounds.theaterTop || window.innerHeight), 0), 1);
      scene.style.setProperty("--text-parallax", `${textParallaxP * 180}px`);

      lastPhase = phase;
    };

    let rafId = 0;
    const raf = (time) => {
      lenis.raf(time);
      updateHeroMotion(Math.max(lenis.scroll || 0, window.scrollY || 0));
      rafId = window.requestAnimationFrame(raf);
    };

    updateHeroMotion(0);
    rafId = window.requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) window.cancelAnimationFrame(rafId);
      const overlay = document.getElementById("hero-blend-overlay");
      if (overlay) overlay.remove();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitText("Message ready");
    event.currentTarget.reset();
    window.setTimeout(() => {
      setSubmitText("Submit");
    }, 2200);
  }

  return (
    <div className="site-shell">
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
                    </div>
                  </div>
                </div>
                <span className="hero-letter">H</span>
                <span className="hero-letter">U</span>
                <span className="hero-letter">L</span>
              </div>
            </div>
            <div className="hero-filler-layer" aria-hidden="true">
              <p className="hero-filler-title">PROJECT BECOMING</p>
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

                {/* The actual HTML5 video */}
                <div className="theater-video-wrapper">
                  <video
                    ref={videoRef}
                    className="theater-video"
                    src="/images/RLTCA.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
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
              <div className="scroll-tip">
                Scroll to Zoom
              </div>
            </div>
          </div>
        </section>

        <section className="services" id="services" aria-labelledby="services-title" ref={servicesSectionRef}>
          <motion.div style={{ opacity: servicesOpacity, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}><GradientBackground /></motion.div>
          <motion.div style={{ opacity: servicesOpacity }}>
            <div className="services-content-wrapper">
              <ScrollReveal variant="wipe">
                <div className="section-intro">
                  <h2 id="services-title">what I can do for you</h2>
                  <p>
                    As a digital designer, I am a visual storyteller, crafting experiences that connect deeply
                    and spark creativity.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={200} variant="fluid-flow">
                <Accordion items={services} />
              </ScrollReveal>
            </div>
          </motion.div>
          <div className="services-card-landing" aria-hidden="true"></div>
        </section>

        <section className="about" id="about" aria-labelledby="about-title">
          <div className="about-content-wrapper">
            <ScrollReveal variant="wipe">
              <div className="section-intro">
                <p className="eyebrow">Who am I?</p>
                <h2 id="about-title">About me</h2>
                <p>
                  I am a digital designer and Framer developer passionate about crafting <span className="hand-text">unforgettable</span>,
                  user-centered experiences.
                </p>
                <p>
                  With a strong foundation in visual design and a deep understanding of interactive systems,
                  I bring ideas to life through thoughtful design, chaotic-yet-organized layouts, and expressive typography.
                </p>
              </div>
            </ScrollReveal>
            <div className="about-panel">
              <ScrollReveal delay={150} variant="fluid-flow">
                <div className="stats-grid">
                  <article>
                    <strong>12</strong>
                    <span>Years of experience</span>
                  </article>
                  <article>
                    <strong>270</strong>
                    <span>Completed projects</span>
                  </article>
                  <article>
                    <strong>50+</strong>
                    <span>Clients worldwide</span>
                  </article>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={300} variant="glitch">
                <div className="experience-list">
                  <h3>Discover my journey in design</h3>
                  <div className="timeline-row">
                    <span>2023 - Present</span>
                    <strong>Creative Art Director</strong>
                    <small>NovaWorks Agency</small>
                  </div>
                  <div className="timeline-row">
                    <span>2020 - 2023</span>
                    <strong>Senior UI/UX Designer</strong>
                    <small>BrightLabs Digital</small>
                  </div>
                  <div className="timeline-row">
                    <span>2017 - 2020</span>
                    <strong>Digital Designer</strong>
                    <small>Independent Studio</small>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
          <div className="about-card-landing"></div>
        </section>

        <section className="projects" id="projects" aria-labelledby="projects-title">
          <ScrollReveal variant="wipe">
            <div className="section-heading-wide">
              <h2 id="projects-title">Featured Projects</h2>
              <p>
                Selected work blending strategy with creativity, solving real problems through thoughtful
                design and impactful storytelling.
              </p>
            </div>
          </ScrollReveal>
          <div className="featured-projects" ref={projectsContainerRef}>
            {featuredProjects.map((project, index) => (
              <FeaturedProjectCard
                key={project.title}
                project={project}
                index={index}
                total={featuredProjects.length}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </div>
          <div className="more-projects">
            <ScrollReveal variant="wipe">
              <div className="divider-title">
                <h3>More Projects</h3>
                <span></span>
              </div>
            </ScrollReveal>
            <div className="project-grid">
              {moreProjects.map((project, index) => (
                <ScrollReveal key={project.title} delay={(index % 2) * 150} variant="fluid-flow">
                  <article className="project-card">
                    <img src={project.image} alt={project.title} loading="lazy" />
                    <MetaRow items={[project.category, project.year]} />
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="testimonials" aria-labelledby="testimonials-title">
          <ScrollReveal variant="wipe">
            <div className="section-heading-wide">
              <h2 id="testimonials-title">What clients say</h2>
              <p>Results from collaborative work across brand identity, web design, and product interfaces.</p>
            </div>
          </ScrollReveal>
          <div className="testimonial-grid">
            {[
              {
                text: "Duncan truly understood my vision and turned it into impactful designs. The results went beyond my expectations.",
                name: "John Harris",
                title: "Marketing Director"
              },
              {
                metric: "98%",
                label: "Satisfaction Rate",
                isMetric: true
              },
              {
                text: "He took the time to understand our goals and delivered a design that resonated perfectly with our audience.",
                name: "Michael Lee",
                title: "Product Manager"
              },
              {
                metric: "200%",
                label: "Client growth impact",
                isMetric: true,
                accent: true
              },
              {
                text: "His design skills are unmatched. He transformed my ideas into a high-performing, visually striking website.",
                name: "Sarah Johnson",
                title: "CEO"
              },
              {
                text: "As a small business owner, I appreciated how stress-free Duncan made the process.",
                name: "Laura Bennett",
                title: "Small Business Owner"
              }
            ].map((item, index) => (
              <ScrollReveal key={index} delay={(index % 3) * 100} variant="fluid-flow">
                {item.isMetric ? (
                  <article className={`metric-card ${item.accent ? 'accent' : ''}`}>
                    <span>{item.metric}</span>
                    <p>{item.label}</p>
                  </article>
                ) : (
                  <article>
                    <p>{item.text}</p>
                    <strong>{item.name}</strong>
                    <span>{item.title}</span>
                  </article>
                )}
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="journal" id="journal" aria-labelledby="journal-title">
          <ScrollReveal variant="wipe">
            <div className="section-heading-wide">
              <h2 id="journal-title">Design Insights &amp; Ideas</h2>
              <p>Articles on design trends, creative process, workflow, typography, and brand systems.</p>
            </div>
          </ScrollReveal>
          <div className="blog-layout">
            <ScrollReveal delay={150} variant="glitch">
              <article className="pinned-post">
                <img src={pinnedPost.image} alt={pinnedPost.title} loading="lazy" />
                <MetaRow items={[pinnedPost.category, pinnedPost.date, "Pinned"]} />
                <h3>{pinnedPost.title}</h3>
                <p>{pinnedPost.description}</p>
              </article>
            </ScrollReveal>
            <div className="blog-grid">
              {otherPosts.map((post, index) => (
                <ScrollReveal key={post.title} delay={(index % 2) * 150} variant="fluid-flow">
                  <article className="blog-card">
                    <img src={post.image} alt={post.title} loading="lazy" />
                    <MetaRow items={[post.category, post.date]} />
                    <h3>{post.title}</h3>
                    <p>{post.description}</p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="contact" id="contact" aria-labelledby="contact-title">
          <ScrollReveal variant="wipe">
            <div className="contact-image">
              <img
                src="/images/IMG_5775.PNG"
                alt="Rahul portrait"
              />
              <div className="circle-badge" aria-hidden="true">
                <span>Let us</span>
                <span>build</span>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200} variant="glitch">
            <div className="contact-copy">
              <h2 id="contact-title">Let's work together</h2>
              <p>Let us build something impactful together, whether it is your brand, your website, or your next big idea.</p>
              <form className="contact-form" onSubmit={handleSubmit}>
                <label>
                  <span>Name</span>
                  <input name="name" autoComplete="name" required />
                </label>
                <label>
                  <span>Email</span>
                  <input name="email" type="email" autoComplete="email" required />
                </label>
                <label>
                  <span>Service Needed?</span>
                  <select name="service" required defaultValue="">
                    <option value="">Choose a service</option>
                    <option>UI/UX Design</option>
                    <option>Graphic Design</option>
                    <option>Web Design</option>
                    <option>Branding</option>
                  </select>
                </label>
                <label>
                  <span>What can I help you with?</span>
                  <textarea name="message" rows="5"></textarea>
                </label>
                <button type="submit">{submitText}</button>
              </form>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="footer">
        <p>Duncan Robert</p>
        <div>
          <a href="https://x.com/home">X</a>
          <a href="https://www.instagram.com/">Instagram</a>
          <a href="https://www.behance.net/">Behance</a>
          <a href="https://dribbble.com/">Dribbble</a>
        </div>
      </footer>

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
    </div>
  );
}




