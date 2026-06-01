'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Testimonial {
  text: string;
  name: string;
  role: string;
  stars: number;
}

const testimonials: Testimonial[] = [
  {
    text: "Working with Zayla was an absolute game-changer for our brand. He took our vision and elevated it with sleek web design, thoughtful branding, and a seamless eCommerce experience. Our conversions went up 40% after launch!",
    name: "Sarah Mitchell",
    role: "Founder, Lumiere Skincare",
    stars: 5,
  },
  {
    text: "We needed high-quality 3D modeling for our client presentations, and Zayla delivered beyond expectations. His attention to detail and technical skills brought our ideas to life. Highly recommend his work for architectural renders!",
    name: "Daniel Kim",
    role: "Creative Director, Nova",
    stars: 5,
  },
  {
    text: "Zayla redesigned our website and gave our brand a much-needed refresh. The process was smooth, creative, and incredibly collaborative. He truly understands both design and business goals.",
    name: "Maria Lopez",
    role: "Marketing Manager, GreenVibe",
    stars: 5,
  },
  {
    text: "From UI/UX design to full-stack development, Zayla handled our SaaS dashboard like a pro. His expertise is unmatched. The performance and design speak for themselves.",
    name: "Jason Reed",
    role: "CEO, TechForge Solutions",
    stars: 5,
  },
  {
    text: "Zayla created stunning 3D visuals for our furniture line that looked hyper-realistic. It helped us showcase our products online in a way that photography just couldn't. He's a master of 3D modeling!",
    name: "Amina Al-Khaldi",
    role: "Art Director, Mirage Interiors",
    stars: 5,
  },
  {
    text: "The branding work we received was fresh, professional, and aligned perfectly with our mission. Zayla gave our ed-tech startup a modern identity and a user-friendly platform. Loved the process.",
    name: "Eric Johnson",
    role: "Co-Founder, BrightPath Learning",
    stars: 5,
  },
  {
    text: "Zayla is incredibly talented and easy to work with. He crafted a visually rich website and helped shape our visual identity. Everything from typography to motion felt premium.",
    name: "Chloe Zhang",
    role: "Brand Manager, Studio Sensé",
    stars: 5,
  },
  {
    text: "We hired Zayla for both 3D modeling and frontend integration into our AR platform. The quality, speed, and creativity he brought to the table were top-tier. Can't wait to work with him again!",
    name: "Tomás Rivera",
    role: "Head of Product, UrbanVR",
    stars: 5,
  },
  {
    text: "Rahul's digital design and custom motion expertise transformed our web presence completely. The custom cinematic animations and flawless layout have made our portfolio an industry standout. An extraordinary creative partner!",
    name: "Alex Thorne",
    role: "Art Director, FutureForms Studio",
    stars: 5,
  }
];

export default function TrustedFeedback() {
  const containerRef = useRef<HTMLDivElement>(null);

  // We track scroll progress across this 600vh container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Distribute testimonials into 3 columns
  const col1 = [testimonials[0], testimonials[3], testimonials[6]];
  const col2 = [testimonials[1], testimonials[4], testimonials[7]];
  const col3 = [testimonials[2], testimonials[5], testimonials[8]];

  return (
    <section className="trusted-feedback-wrapper" id="feedback" ref={containerRef}>
      <div className="trusted-feedback-sticky">
        
        {/* HUGE BACKGROUND TEXT */}
        <div className="feedback-huge-text">
          TRUSTED<br />FEEDBACK
        </div>

        <div className="feedback-grid-sticky">
          
          {/* Column 1 */}
          <div className="feedback-column col-1">
            {col1.map((item, idx) => (
              <FallingCard 
                key={`c1-${idx}`} 
                item={item} 
                scrollYProgress={scrollYProgress} 
                dropStart={0.00 + (idx * 0.27)} 
                dropEnd={0.33 + (idx * 0.27)}
              />
            ))}
          </div>

          {/* Column 2 - Staggered via CSS margin-top */}
          <div className="feedback-column col-2">
            {col2.map((item, idx) => (
              <FallingCard 
                key={`c2-${idx}`} 
                item={item} 
                scrollYProgress={scrollYProgress} 
                dropStart={0.12 + (idx * 0.27)} 
                dropEnd={0.45 + (idx * 0.27)}
              />
            ))}
          </div>

          {/* Column 3 */}
          <div className="feedback-column col-3">
            {col3.map((item, idx) => (
              <FallingCard 
                key={`c3-${idx}`} 
                item={item} 
                scrollYProgress={scrollYProgress} 
                dropStart={0.06 + (idx * 0.27)} 
                dropEnd={0.39 + (idx * 0.27)}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

function FallingCard({ 
  item, 
  scrollYProgress, 
  dropStart, 
  dropEnd 
}: { 
  item: Testimonial; 
  scrollYProgress: any;
  dropStart: number;
  dropEnd: number;
}) {
  // y moves from -250vh to 250vh for an extreme vertical distance spacing
  const y = useTransform(scrollYProgress, [dropStart, dropEnd], ["-250vh", "250vh"]);

  return (
    <motion.article 
      className="feedback-card"
      style={{ y }}
    >
      <div className="feedback-card-inner">
        <div className="card-quote-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </div>
        <p className="card-text">"{item.text}"</p>
        <div className="card-footer">
          <div className="card-avatar">
            {item.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="card-author-info">
            <strong className="card-author">{item.name}</strong>
            <span className="card-role">{item.role}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
