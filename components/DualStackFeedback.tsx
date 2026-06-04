"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reviews = [
  {
    name: "Sarah Mitchell",
    role: "Founder, Lumiere Skincare",
    avatar: "/images/avatar-sarah.png",
    quote:
      "Working with Rahul was a game-changer. He took our vision and elevated it with sleek design and a seamless experience. Our conversions went up 40% after launch.",
    index: "01",
  },
  {
    name: "Daniel Kim",
    role: "Creative Director, Nova",
    avatar: "/images/avatar-daniel.png",
    quote:
      "We needed high-quality 3D modeling for client presentations and Rahul delivered beyond expectations. His attention to detail brought our ideas to life in extraordinary ways.",
    index: "02",
  },
  {
    name: "Maria Lopez",
    role: "Marketing Manager, GreenVibe",
    avatar: "/images/avatar-maria.png",
    quote:
      "Rahul redesigned our website and gave our brand a much-needed refresh. The process was smooth, creative, and collaborative. He truly understands both design and business.",
    index: "03",
  },
  {
    name: "Jason Reed",
    role: "CEO, TechForge Solutions",
    avatar: "/images/avatar-jason.png",
    quote:
      "From UI/UX to full-stack development, Rahul handled our SaaS dashboard like a pro. His expertise is unmatched. The performance and design speak for themselves.",
    index: "04",
  },
];

export default function DualStackFeedback() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const imageStackRef = useRef<HTMLDivElement>(null);
  const textStackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const imageStack = imageStackRef.current;
    const textStack = textStackRef.current;
    if (!section || !sticky || !imageStack || !textStack) return;

    const imgCards = gsap.utils.toArray<HTMLElement>(".dsf-img-card");
    const txtCards = gsap.utils.toArray<HTMLElement>(".dsf-txt-card");
    const total = reviews.length;

    // Enable 3-D perspective on each stack wrapper
    gsap.set([imageStack, textStack], {
      perspective: 1200,
      transformStyle: "preserve-3d",
    });

    // Dynamic translation offsets based on layout bounds
    const offsets = { x: 0, y: 0 };
    const updateOffsets = () => {
      const imgRect = imageStack.getBoundingClientRect();
      const txtRect = textStack.getBoundingClientRect();
      offsets.x = txtRect.left - imgRect.left;
      offsets.y = txtRect.top - imgRect.top;
    };
    updateOffsets();

    // Initial state
    // Card 0 = active at z=0, scale=1, x=0, rotateY=0, opacity=1
    // Card 1+ = queued behind Card i-1's active side at opacity=0 (to avoid overlap)
    imgCards.forEach((card, i) => {
      gsap.set(card, {
        rotateY: () => (i > 0 ? ((i - 1) % 2 !== 0 ? 180 : -180) : 0),
        x: () => (i > 0 ? ((i - 1) % 2 !== 0 ? offsets.x : 0) : 0),
        y: () => (i > 0 ? ((i - 1) % 2 !== 0 ? offsets.y : 0) : 0),
        z: -(i * 18),           // 0 → front, 1 → -18px behind, etc.
        scale: 1 - i * 0.03,   // 0 → 1.0, 1 → 0.97, 2 → 0.94 …
        opacity: i === 0 ? 1 : 0,
        transformOrigin: "center center",
        willChange: "transform, opacity",
      });
    });

    txtCards.forEach((card, i) => {
      gsap.set(card, {
        rotateY: () => (i > 0 ? ((i - 1) % 2 !== 0 ? -180 : 180) : 0),
        x: () => (i > 0 ? ((i - 1) % 2 !== 0 ? -offsets.x : 0) : 0),
        y: () => (i > 0 ? ((i - 1) % 2 !== 0 ? -offsets.y : 0) : 0),
        z: -(i * 18),
        scale: 1 - i * 0.03,
        opacity: i === 0 ? 1 : 0,
        transformOrigin: "center center",
        willChange: "transform, opacity",
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${total * 900}`,
        scrub: 1.2,
        pin: sticky,
        anticipatePin: 1,
        invalidateOnRefresh: true, // Recalculate function-based values on refresh
      },
    });

    // One transition per consecutive card pair
    for (let i = 0; i < total - 1; i++) {
      const fromImg = imgCards[i];
      const toImg = imgCards[i + 1];
      const fromTxt = txtCards[i];
      const toTxt = txtCards[i + 1];

      const seg = 1;          // timeline duration units per segment
      const start = i * seg;

      const isOddTransition = i % 2 !== 0;

      // 1. Active card flips Y by rotating 180 degrees and moves to the opposite side (slower transition)
      tl.to(
        fromImg,
        { 
          rotateY: isOddTransition ? -180 : 180, 
          x: () => (isOddTransition ? 0 : offsets.x), 
          y: () => (isOddTransition ? 0 : offsets.y), 
          z: -80, 
          scale: 0.86, 
          ease: "power2.inOut", 
          duration: seg * 0.7 
        },
        start
      );
      tl.to(
        fromImg,
        { opacity: 0, duration: seg * 0.2, ease: "power1.in" },
        start + seg * 0.3 // Fades out in the second half of its flip
      );

      tl.to(
        fromTxt,
        { 
          rotateY: isOddTransition ? 180 : -180, 
          x: () => (isOddTransition ? 0 : -offsets.x), 
          y: () => (isOddTransition ? 0 : -offsets.y), 
          z: -80, 
          scale: 0.86, 
          ease: "power2.inOut", 
          duration: seg * 0.7 
        },
        start + 0.07
      );
      tl.to(
        fromTxt,
        { opacity: 0, duration: seg * 0.2, ease: "power1.in" },
        start + 0.07 + seg * 0.3 // Fades out in the second half of its flip
      );

      // 2. Next card rises from hidden depth to front face while sliding to its target side (starts earlier and overlaps)
      tl.fromTo(
        toImg,
        { 
          rotateY: isOddTransition ? 180 : -180, 
          x: () => (isOddTransition ? offsets.x : 0), 
          y: () => (isOddTransition ? offsets.y : 0),
          z: -((total - 1 - i) * 18), 
          scale: 0.88, 
          opacity: 0 
        },
        { 
          rotateY: 0,   
          x: () => (isOddTransition ? 0 : offsets.x), // ends on opposite side
          y: () => (isOddTransition ? 0 : offsets.y),
          z: 0,  
          scale: 1,    
          ease: "power2.inOut", 
          duration: seg * 0.8 
        },
        start + seg * 0.1 // Starts much earlier
      );
      tl.to(
        toImg,
        { opacity: 1, duration: seg * 0.2, ease: "power1.out" },
        start + seg * 0.1 + seg * 0.15 // Fades in as the old card is fading out
      );

      tl.fromTo(
        toTxt,
        { 
          rotateY: isOddTransition ? -180 : 180, 
          x: () => (isOddTransition ? -offsets.x : 0), 
          y: () => (isOddTransition ? -offsets.y : 0),
          z: -((total - 1 - i) * 18), 
          scale: 0.88, 
          opacity: 0 
        },
        { 
          rotateY: 0,   
          x: () => (isOddTransition ? 0 : -offsets.x), // ends on opposite side
          y: () => (isOddTransition ? 0 : -offsets.y),
          z: 0,  
          scale: 1,    
          ease: "power2.inOut", 
          duration: seg * 0.8 
        },
        start + seg * 0.1 + 0.07 // Starts much earlier
      );
      tl.to(
        toTxt,
        { opacity: 1, duration: seg * 0.2, ease: "power1.out" },
        start + seg * 0.1 + 0.07 + seg * 0.15 // Fades in as the old card is fading out
      );

      // 3. Progress bar fills proportionally
      tl.to(
        ".dsf-progress-fill",
        { scaleX: (i + 1) / (total - 1), ease: "power2.inOut", duration: seg * 0.5 },
        start + seg * 0.3
      );
    }

    const handleResize = () => {
      updateOffsets();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === section) st.kill();
      });
    };
  }, []);

  return (
    <section className="dsf-section" ref={sectionRef} id="dual-stack-feedback" aria-label="Client feedback">
      <div className="dsf-sticky" ref={stickyRef}>

        {/* Section label */}
        <div className="dsf-label-row">
          <span className="dsf-kicker">CLIENT FEEDBACK</span>
          <div className="dsf-progress-track">
            <div className="dsf-progress-fill" />
          </div>
          <span className="dsf-counter">04 REVIEWS</span>
        </div>

        {/* Headline */}
        <div className="dsf-headline-row">
          <h2 className="dsf-headline">WHAT THEY SAY</h2>
        </div>

        {/* Dual stacks */}
        <div className="dsf-stacks">

          {/* Image stack */}
          <div className="dsf-image-stack" ref={imageStackRef}>
            {reviews.map((r, i) => (
              <div
                key={r.name}
                className={`dsf-img-card dsf-card-${i}`}
              >
                <div className="dsf-img-inner">
                  <img src={r.avatar} alt={r.name} className="dsf-avatar" />
                  <div className="dsf-img-index">{r.index}</div>
                  <div className="dsf-img-name">{r.name}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Text stack */}
          <div className="dsf-text-stack" ref={textStackRef}>
            {reviews.map((r, i) => (
              <div
                key={r.name}
                className={`dsf-txt-card dsf-card-${i}`}
              >
                <div className="dsf-txt-inner">
                  <blockquote className="dsf-quote">
                    <span className="dsf-quote-mark">"</span>
                    {r.quote}
                    <span className="dsf-quote-mark">"</span>
                  </blockquote>
                  <footer className="dsf-author">
                    <span className="dsf-author-name">{r.name}</span>
                    <span className="dsf-author-role">{r.role}</span>
                  </footer>
                  <div className="dsf-stars" aria-label="5 stars">
                    {"★★★★★"}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Scroll nudge */}
        <div className="dsf-scroll-nudge">
          <span>SCROLL TO READ</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M3 9l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

      </div>
    </section>
  );
}
