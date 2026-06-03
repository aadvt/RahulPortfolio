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

    // Initial state
    // Card 0 = front face: z=0, scale=1, opacity=1  (visible)
    // Card 1+ = queued behind: z=-18n, scale<1, opacity=0  (hidden)
    imgCards.forEach((card, i) => {
      gsap.set(card, {
        rotateY: 0,
        z: -(i * 18),           // 0 → front, 1 → -18px behind, etc.
        scale: 1 - i * 0.03,   // 0 → 1.0, 1 → 0.97, 2 → 0.94 …
        opacity: i === 0 ? 1 : 0,
        transformOrigin: "center center",
        willChange: "transform, opacity",
      });
    });

    txtCards.forEach((card, i) => {
      gsap.set(card, {
        rotateY: 0,
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
      },
    });

    // One transition per consecutive card pair
    for (let i = 0; i < total - 1; i++) {
      const fromImg = imgCards[i];
      const toImg   = imgCards[i + 1];
      const fromTxt = txtCards[i];
      const toTxt   = txtCards[i + 1];

      const seg   = 1;          // timeline duration units per segment
      const start = i * seg;

      // 1. Active card flips away and fades out
      tl.to(
        fromImg,
        { rotateY: 90, z: -80, scale: 0.86, opacity: 0, ease: "power2.inOut", duration: seg * 0.5 },
        start
      );
      tl.to(
        fromTxt,
        { rotateY: -90, z: -80, scale: 0.86, opacity: 0, ease: "power2.inOut", duration: seg * 0.5 },
        start + 0.07
      );

      // 2. Next card rises from hidden depth to front face
      // It starts invisible at its current queued depth and comes forward
      tl.fromTo(
        toImg,
        { rotateY: -20, z: -((total - 1 - i) * 18), scale: 0.88, opacity: 0 },
        { rotateY: 0,   z: 0,  scale: 1,    opacity: 1, ease: "power2.inOut", duration: seg * 0.6 },
        start + seg * 0.38
      );
      tl.fromTo(
        toTxt,
        { rotateY: 20,  z: -((total - 1 - i) * 18), scale: 0.88, opacity: 0 },
        { rotateY: 0,   z: 0,  scale: 1,    opacity: 1, ease: "power2.inOut", duration: seg * 0.6 },
        start + seg * 0.38 + 0.07
      );

      // 3. Progress bar fills proportionally
      tl.to(
        ".dsf-progress-fill",
        { scaleX: (i + 1) / (total - 1), ease: "power2.inOut", duration: seg * 0.5 },
        start + seg * 0.3
      );
    }

    return () => {
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
                style={{ zIndex: reviews.length - i }}
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
                style={{ zIndex: reviews.length - i }}
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
            <path d="M8 2v12M3 9l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

      </div>
    </section>
  );
}
