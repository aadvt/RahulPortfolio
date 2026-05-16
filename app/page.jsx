"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

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

export default function Home() {
  const [isDark, setIsDark] = useState(false);
  const [submitText, setSubmitText] = useState("Submit");
  const heroSceneRef = useRef(null);
  const portraitStageRef = useRef(null);
  const featuredProjects = projects.filter((project) => project.featured).slice(0, 4);
  const moreProjects = projects.filter((project) => !project.featured);
  const pinnedPost = posts.find((post) => post.pinned) || posts[0];
  const otherPosts = posts.filter((post) => post !== pinnedPost);

  useEffect(() => {
    const stored = window.localStorage.getItem("duncan-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = stored ? stored === "dark" : prefersDark;
    setIsDark(shouldUseDark);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", isDark);
    window.localStorage.setItem("duncan-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const scene = heroSceneRef.current;
    const stage = portraitStageRef.current;
    if (!scene || !stage) return;

    const lenis = new Lenis({
      duration: 1.5,
      lerp: 0.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: "vertical",
      gestureDirection: "vertical",
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    const updateHeroMotion = (scroll) => {
      const sceneTop = scene.offsetTop;
      const totalDistance = Math.max(scene.offsetHeight - window.innerHeight, 1);
      const rawProgress = (scroll - sceneTop) / totalDistance;
      const progress = Math.min(Math.max(rawProgress, 0), 1);
      const flipProgress = Math.min(Math.max((progress - 0.1) / 0.6, 0), 1); // Flip over 10%-70% of scroll
      const exitProgress = Math.min(Math.max((progress - 0.1) / 0.9, 0), 1); // Exit starts at 10%
      const flipEase = flipProgress * flipProgress * (3 - 2 * flipProgress);
      const exitEase = exitProgress * exitProgress * (3 - 2 * exitProgress);
      const exitX = window.innerWidth >= 1200
        ? Math.max(280, window.innerWidth * 0.22)
        : Math.max(180, window.innerWidth * 0.15);
      const exitY = window.innerWidth >= 810 ? 580 : 420; 
      const exitScale = window.innerWidth >= 1200 ? 0.85 : 0.75;

      // Card Animation - Full 180deg flip to show the back side
      stage.style.setProperty("--flip-rotation", `${flipEase * 180}deg`);
      stage.style.setProperty("--flip-shift", `${flipEase * 18}px`);
      stage.style.setProperty("--stage-shift", `${exitEase * exitY}px`);
      stage.style.setProperty("--stage-shift-x", `${exitEase * exitX}px`);
      stage.style.setProperty("--stage-scale", `${1 - exitEase * (1 - exitScale)}`);
      stage.style.setProperty("--stage-opacity", "1"); // Keep it visible in the next section

      // Text Splitting Parallax - Matching Portavia splitting effect
      const textParallax = progress * 150; // 150px movement
      scene.style.setProperty("--text-parallax-left", `-${textParallax}px`);
      scene.style.setProperty("--text-parallax-right", `${textParallax}px`);
    };

    let rafId = 0;
    const raf = (time) => {
      lenis.raf(time);
      updateHeroMotion(lenis.scroll);
      rafId = window.requestAnimationFrame(raf);
    };

    updateHeroMotion(0);
    rafId = window.requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      if (rafId) window.cancelAnimationFrame(rafId);
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
      <header className="nav-shell" aria-label="Primary navigation">
        <a className="avatar-chip" href="#home" aria-label="Duncan Robert home">
          <span className="avatar-dot"></span>
          <span>DR</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#journal">Blogs</a>
        </nav>
        <button
          className="theme-toggle"
          type="button"
          aria-label="Toggle theme"
          aria-pressed={isDark}
          onClick={() => setIsDark((current) => !current)}
        >
          <span className="toggle-track">
            <span className="toggle-thumb"></span>
          </span>
        </button>
        <a className="contact-link" href="#contact">Contact</a>
      </header>

      <main>
        <div className="hero-scene" id="home" aria-labelledby="hero-title" ref={heroSceneRef}>
          <section className="hero">
            <div className="hero-copy hero-copy-left">
              <p className="eyebrow">Duncan Robert</p>
              <h1 id="hero-title"><span>digital</span></h1>
            </div>
            <div className="portrait-stage" aria-label="Portrait card" ref={portraitStageRef}>
              <div className="portrait-card portrait-card-back">
                <img src="https://framerusercontent.com/images/VRQgkdWsjawSg1qpCm45HfSY1I.jpeg" alt="" />
              </div>
              <div className="portrait-card portrait-card-front">
                <img
                  src="https://framerusercontent.com/images/qrxY8NagVO40NBrdhFEGgFR3PYY.jpg"
                  alt="Portrait of designer Duncan Robert"
                />
              </div>
              <div className="circle-badge" aria-hidden="true">
                <span>Available</span>
                <span>for work</span>
              </div>
            </div>
            <div className="hero-copy hero-copy-right">
              <h1><span>designer</span></h1>
              <p>I am a US-based digital designer and Framer developer.</p>
            </div>
          </section>
        </div>

        <section className="services" id="services" aria-labelledby="services-title">
          <div className="services-content-wrapper">
            <div className="section-intro">
            <h2 id="services-title">what I can do for you</h2>
            <p>
              As a digital designer, I am a visual storyteller, crafting experiences that connect deeply
              and spark creativity.
            </p>
          </div>
            <Accordion items={services} />
          </div>
          <div className="services-card-landing"></div>
        </section>

        <section className="about section-grid" id="about" aria-labelledby="about-title">
          <div className="section-intro">
            <p className="eyebrow">Duncan Robert</p>
            <h2 id="about-title">About me</h2>
            <p>
              I am a digital designer and Framer developer passionate about crafting meaningful,
              user-centered experiences.
            </p>
            <p>
              With a strong foundation in visual design and a deep understanding of interactive systems,
              I bring ideas to life through thoughtful design, smooth animations, and responsive layouts.
            </p>
          </div>
          <div className="about-panel">
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
          </div>
        </section>

        <section className="projects" id="projects" aria-labelledby="projects-title">
          <div className="section-heading-wide">
            <h2 id="projects-title">Featured Projects</h2>
            <p>
              Selected work blending strategy with creativity, solving real problems through thoughtful
              design and impactful storytelling.
            </p>
          </div>
          <div className="featured-projects">
            {featuredProjects.map((project) => (
              <article className="featured-card" key={project.title}>
                <a className="featured-media" href="#contact" aria-label={`Discuss ${project.title}`}>
                  <img src={project.image} alt={project.title} loading="lazy" />
                </a>
                <div className="featured-copy">
                  <MetaRow items={[project.category, project.year, project.client]} />
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="more-projects">
            <div className="divider-title">
              <h3>More Projects</h3>
              <span></span>
            </div>
            <div className="project-grid">
              {moreProjects.map((project) => (
                <article className="project-card" key={project.title}>
                  <img src={project.image} alt={project.title} loading="lazy" />
                  <MetaRow items={[project.category, project.year]} />
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="testimonials" aria-labelledby="testimonials-title">
          <div className="section-heading-wide">
            <h2 id="testimonials-title">What clients say</h2>
            <p>Results from collaborative work across brand identity, web design, and product interfaces.</p>
          </div>
          <div className="testimonial-grid">
            <article>
              <p>Duncan truly understood my vision and turned it into impactful designs. The results went beyond my expectations.</p>
              <strong>John Harris</strong>
              <span>Marketing Director</span>
            </article>
            <article className="metric-card">
              <span>98%</span>
              <p>Satisfaction Rate</p>
            </article>
            <article>
              <p>He took the time to understand our goals and delivered a design that resonated perfectly with our audience.</p>
              <strong>Michael Lee</strong>
              <span>Product Manager</span>
            </article>
            <article className="metric-card accent">
              <span>200%</span>
              <p>Client growth impact</p>
            </article>
            <article>
              <p>His design skills are unmatched. He transformed my ideas into a high-performing, visually striking website.</p>
              <strong>Sarah Johnson</strong>
              <span>CEO</span>
            </article>
            <article>
              <p>As a small business owner, I appreciated how stress-free Duncan made the process.</p>
              <strong>Laura Bennett</strong>
              <span>Small Business Owner</span>
            </article>
          </div>
        </section>

        <section className="journal" id="journal" aria-labelledby="journal-title">
          <div className="section-heading-wide">
            <h2 id="journal-title">Design Insights &amp; Ideas</h2>
            <p>Articles on design trends, creative process, workflow, typography, and brand systems.</p>
          </div>
          <div className="blog-layout">
            <article className="pinned-post">
              <img src={pinnedPost.image} alt={pinnedPost.title} loading="lazy" />
              <MetaRow items={[pinnedPost.category, pinnedPost.date, "Pinned"]} />
              <h3>{pinnedPost.title}</h3>
              <p>{pinnedPost.description}</p>
            </article>
            <div className="blog-grid">
              {otherPosts.map((post) => (
                <article className="blog-card" key={post.title}>
                  <img src={post.image} alt={post.title} loading="lazy" />
                  <MetaRow items={[post.category, post.date]} />
                  <h3>{post.title}</h3>
                  <p>{post.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="contact" id="contact" aria-labelledby="contact-title">
          <div className="contact-image">
            <img
              src="https://framerusercontent.com/images/qrxY8NagVO40NBrdhFEGgFR3PYY.jpg"
              alt="Duncan Robert portrait"
            />
            <div className="circle-badge" aria-hidden="true">
              <span>Let us</span>
              <span>build</span>
            </div>
          </div>
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
    </div>
  );
}
