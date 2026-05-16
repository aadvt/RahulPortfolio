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
    slug: "black-geometric-prisms",
    featured: true,
    category: "Branding",
    year: "2025",
    client: "Studio Prism",
    industry: "Tech",
    duration: "4 weeks",
    image: "https://framerusercontent.com/images/2nWXrWvPxxMHSpsOkNYf8KjzP7Q.jpeg",
    description:
      "A collection of sharp, angular black prisms floating against a gradient dark background, showcasing a sophisticated approach to digital 3D geometric composition.",
  },
  {
    title: "Pantone Very Peri Poster Design",
    slug: "pantone-very-peri-poster-design",
    featured: false,
    category: "Graphic Design",
    year: "2024",
    client: "ColorTrend Agency",
    industry: "Creative Agency",
    duration: "2 weeks",
    image: "https://framerusercontent.com/images/RFcUbpIGFydbU9WBSTc9HJRQI.jpeg",
    description:
      "A minimalist poster inspired by Pantone Very Peri, combining clean typography, a soft periwinkle background, and a delicate blue branch illustration.",
  },
  {
    title: "Coral Spiral Abstract",
    slug: "coral-spiral-abstract",
    featured: true,
    category: "Branding",
    year: "2025",
    client: "VisualForms Studio",
    industry: "Beauty",
    duration: "3 weeks",
    image: "https://framerusercontent.com/images/qbjsnnvP9w7UaA2syp36oUe8OSo.jpg",
    description:
      "A visually striking 3D abstract artwork featuring a coral-colored spiral form with smooth curves and a soft pink gradient background.",
  },
  {
    title: "Intenza Brand Boutique E-Gift Card Design",
    slug: "intenza-brand-boutique-e-gift-card-design",
    featured: false,
    category: "Graphic Design",
    year: "2023",
    client: "Intenza Boutique",
    industry: "Retail",
    duration: "5 weeks",
    image: "https://framerusercontent.com/images/346Dg9EFyDG62n4PMiwIhATISNU.jpeg",
    description:
      "A modern and elegant e-gift card for Intenza Brand Boutique with a premium black holder and active lifestyle imagery.",
  },
  {
    title: "Summer Vibes Festival Campaign",
    slug: "summer-vibes-festival-campaign",
    featured: true,
    category: "Graphic Design",
    year: "2024",
    client: "FestivalWorks",
    industry: "Event / Festival",
    duration: "6 weeks",
    image: "https://framerusercontent.com/images/w08JBQPFYIq2vr4OfcD9W6vxEug.jpeg",
    description:
      "Promotional materials for Summer Vibes Festival, including posters, flyers, and social media graphics.",
  },
  {
    title: "ShopEase Redesign Sprint",
    slug: "shopease-redesign-sprint",
    featured: true,
    category: "UI / UX Design",
    year: "2025",
    client: "ShopEase",
    industry: "E-commerce",
    duration: "3 weeks",
    image: "https://framerusercontent.com/images/nTU7b0ZAdWdlqCI4mQ4tGTPpDs.jpeg",
    description:
      "A redesign sprint focused on simplifying navigation, optimizing checkout, and improving a commerce app experience.",
  },
  {
    title: "VistaHaven",
    slug: "vistahaven-stunning-real-estate-template",
    featured: false,
    category: "Web Design",
    year: "2025",
    client: "VistaHaven",
    industry: "Real Estate",
    duration: "2 weeks",
    image: "https://framerusercontent.com/images/RzBOpbFyAywEXNkFbMTKVhq44.jpg",
    description:
      "A sleek real estate template designed to showcase luxury properties with elegance and sophistication.",
  },
  {
    title: "InnovateTech Identity Rollout",
    slug: "innovatetech-identity-rollout",
    featured: false,
    category: "Branding",
    year: "2025",
    client: "InnovateTech",
    industry: "Tech",
    duration: "5 weeks",
    image: "https://framerusercontent.com/images/NbFTTP3LTcQw2s8139xTJnscc.jpeg",
    description:
      "A cohesive identity system with logo, color palette, and visual style guide for a forward-looking technology company.",
  },
];

const faqs = [
  {
    question: "What services do you offer?",
    answer:
      "I specialize in UI/UX design, branding, web design, and development. Whether you need a complete website, a visual identity, or design consultation, I can help bring your ideas to life.",
  },
  {
    question: "How does the design process work?",
    answer:
      "The process begins with discovery and planning, then moves into concepts, revisions, testing, and delivery. It is collaborative and visible at every stage.",
  },
  {
    question: "How long does a project usually take?",
    answer:
      "Smaller projects may take 1-2 weeks, while larger website projects can take 4-6 weeks. A detailed timeline follows the first project conversation.",
  },
  {
    question: "What do I need to provide before starting a project?",
    answer:
      "Usually, I need information about your business, goals, existing brand assets, and any content such as text or images. I will guide you through the details.",
  },
  {
    question: "Do you offer revisions?",
    answer:
      "Yes. I usually include 2-3 rounds of revisions depending on scope, with additional revisions available when needed.",
  },
  {
    question: "How do I get started?",
    answer:
      "Reach out through the contact form or email. We will schedule a consultation, discuss your project, and create a proposal.",
  },
];

const posts = [
  {
    title: "5 Design Trends That Will Define 2024",
    category: "Insights",
    date: "Apr 30, 2025",
    featured: true,
    pinned: false,
    image: "https://framerusercontent.com/images/1wFj19qQG6zNr7gj3iTlH0Gdlu8.jpeg",
    description:
      "Explore the design trends influencing web, UI/UX, and branding projects, from 3D lettering to visible grid systems.",
  },
  {
    title: "The Power of Typography in Web Design",
    category: "Insights",
    date: "May 2, 2025",
    featured: false,
    pinned: false,
    image: "https://framerusercontent.com/images/mu6sFIgrbmHNxa3m94cG4VVROM.jpeg",
    description:
      "Learn how typography can make or break a website and how to choose fonts for impact, clarity, and readability.",
  },
  {
    title: "How to Streamline Your Design Workflow",
    category: "Tutorials",
    date: "Apr 27, 2025",
    featured: true,
    pinned: true,
    image: "https://framerusercontent.com/images/xmKml0E7v2iBI4zbbj0yVccaQwg.jpeg",
    description:
      "Practical strategies to improve your design process, save time, and deliver quality work more efficiently.",
  },
  {
    title: "The Role of Color Psychology in Branding",
    category: "Insights",
    date: "Apr 22, 2025",
    featured: false,
    pinned: false,
    image: "https://framerusercontent.com/images/RFcUbpIGFydbU9WBSTc9HJRQI.jpeg",
    description:
      "Understand how colors evoke emotions and influence brand perception to create designs that connect.",
  },
  {
    title: "Mastering UI/UX Design: Key Principles for Success",
    category: "Resources",
    date: "Mar 30, 2025",
    featured: false,
    pinned: false,
    image: "https://framerusercontent.com/images/9HduiIXX5eSq1WREpvO4qCnKM.jpeg",
    description:
      "Foundational UI/UX principles for seamless, enjoyable, and user-centered digital experiences.",
  },
  {
    title: "Balancing Creativity and Functionality in Design",
    category: "Insights",
    date: "Apr 5, 2025",
    featured: false,
    pinned: false,
    image: "https://framerusercontent.com/images/7RrI1CE0NHr8L8o3ZXGWxQDFQc.jpeg",
    description:
      "How to create visually expressive designs that stay practical, accessible, and easy to use.",
  },
];

function createAccordion(container, items, options = {}) {
  container.innerHTML = "";
  items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = `${options.className || "accordion-item"} ${index === 0 ? "open" : ""}`;

    const button = document.createElement("button");
    button.className = options.triggerClass || "accordion-trigger";
    button.type = "button";
    button.setAttribute("aria-expanded", index === 0 ? "true" : "false");
    button.innerHTML = `<strong>${item.title || `${index + 1}. ${item.question}`}</strong><span>+</span>`;

    const panel = document.createElement("div");
    panel.className = options.panelClass || "accordion-panel";
    const inner = document.createElement("div");
    inner.className = options.innerClass || "accordion-panel-inner";

    if (item.points) {
      const list = document.createElement("ul");
      list.className = "service-points";
      item.points.forEach((point) => {
        const li = document.createElement("li");
        li.textContent = point;
        list.appendChild(li);
      });
      inner.appendChild(list);
    } else {
      inner.innerHTML = `<p>${item.answer}</p>`;
    }

    panel.appendChild(inner);
    article.append(button, panel);
    container.appendChild(article);

    button.addEventListener("click", () => {
      const nextState = !article.classList.contains("open");
      article.classList.toggle("open", nextState);
      button.setAttribute("aria-expanded", String(nextState));
    });
  });
}

function meta(items) {
  return `<div class="meta-row">${items.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

function renderProjects() {
  const featured = document.querySelector("#featured-projects");
  const grid = document.querySelector("#project-grid");

  featured.innerHTML = projects
    .filter((project) => project.featured)
    .slice(0, 4)
    .map(
      (project) => `
        <article class="featured-card">
          <a class="featured-media" href="#contact" aria-label="Discuss ${project.title}">
            <img src="${project.image}" alt="${project.title}" loading="lazy" />
          </a>
          <div class="featured-copy">
            ${meta([project.category, project.year, project.client])}
            <h3>${project.title}</h3>
            <p>${project.description}</p>
          </div>
        </article>
      `,
    )
    .join("");

  grid.innerHTML = projects
    .filter((project) => !project.featured)
    .map(
      (project) => `
        <article class="project-card">
          <img src="${project.image}" alt="${project.title}" loading="lazy" />
          ${meta([project.category, project.year])}
          <h3>${project.title}</h3>
          <p>${project.description}</p>
        </article>
      `,
    )
    .join("");
}

function renderPosts() {
  const pinned = posts.find((post) => post.pinned) || posts[0];
  const pinnedEl = document.querySelector("#pinned-post");
  const grid = document.querySelector("#blog-grid");

  pinnedEl.innerHTML = `
    <img src="${pinned.image}" alt="${pinned.title}" loading="lazy" />
    ${meta([pinned.category, pinned.date, "Pinned"])}
    <h3>${pinned.title}</h3>
    <p>${pinned.description}</p>
  `;

  grid.innerHTML = posts
    .filter((post) => post !== pinned)
    .map(
      (post) => `
        <article class="blog-card">
          <img src="${post.image}" alt="${post.title}" loading="lazy" />
          ${meta([post.category, post.date])}
          <h3>${post.title}</h3>
          <p>${post.description}</p>
        </article>
      `,
    )
    .join("");
}

function setupTheme() {
  const button = document.querySelector(".theme-toggle");
  const stored = localStorage.getItem("duncan-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = stored ? stored === "dark" : prefersDark;

  document.body.classList.toggle("dark", shouldUseDark);
  button.setAttribute("aria-pressed", String(shouldUseDark));

  button.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("duncan-theme", isDark ? "dark" : "light");
    button.setAttribute("aria-pressed", String(isDark));
  });
}

function setupForm() {
  const form = document.querySelector(".contact-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.textContent = "Message ready";
    form.reset();
    window.setTimeout(() => {
      button.textContent = "Submit";
    }, 2200);
  });
}

function setupHeroMotion() {
  const heroScene = document.querySelector(".hero-scene");
  const portraitStage = document.querySelector(".portrait-stage");

  if (!heroScene || !portraitStage || typeof window.Lenis === "undefined") {
    return;
  }

  const lenis = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: "vertical",
    gestureDirection: "vertical",
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const updateHeroMotion = (scroll) => {
    const sceneTop = heroScene.offsetTop;
    const totalDistance = Math.max(heroScene.offsetHeight - window.innerHeight, 1);
    const progress = clamp((scroll - sceneTop) / totalDistance, 0, 1);
    const flipProgress = clamp(progress / 0.58, 0, 1);
    const exitProgress = clamp((progress - 0.52) / 0.48, 0, 1);
    const flipEase = flipProgress * flipProgress * (3 - 2 * flipProgress);
    const exitEase = exitProgress * exitProgress * (3 - 2 * exitProgress);
    const exitX = window.innerWidth >= 1200
      ? Math.max(520, window.innerWidth * 0.46)
      : Math.max(260, window.innerWidth * 0.34);
    const exitY = window.innerWidth >= 810 ? -110 : -82;
    const exitScale = window.innerWidth >= 1200 ? 0.28 : 0.18;

    portraitStage.style.setProperty("--flip-rotation", `${flipEase * 180}deg`);
    portraitStage.style.setProperty("--flip-shift", `${flipEase * 18}px`);
    portraitStage.style.setProperty("--stage-shift", `${exitEase * exitY}px`);
    portraitStage.style.setProperty("--stage-shift-x", `${exitEase * exitX}px`);
    portraitStage.style.setProperty("--stage-scale", `${1 - exitEase * exitScale}`);
    portraitStage.style.setProperty("--stage-opacity", `${1 - Math.max(0, (progress - 0.86) / 0.14) * 0.9}`);
  };

  let rafId = 0;
  const raf = (time) => {
    lenis.raf(time);
    updateHeroMotion(lenis.scroll);
    rafId = window.requestAnimationFrame(raf);
  };

  lenis.scrollTo(0, { immediate: true });
  window.__portfolioLenis = lenis;
  window.__portfolioHeroMotion = updateHeroMotion;

  updateHeroMotion(0);
  rafId = window.requestAnimationFrame(raf);

  window.addEventListener("beforeunload", () => {
    lenis.destroy();
    window.cancelAnimationFrame(rafId);
  });
}

createAccordion(document.querySelector("#services-list"), services);
createAccordion(document.querySelector("#faq-list"), faqs, {
  className: "faq-item",
  triggerClass: "faq-trigger",
  panelClass: "faq-panel",
  innerClass: "faq-panel-inner",
});
renderProjects();
renderPosts();
setupTheme();
setupForm();
setupHeroMotion();
