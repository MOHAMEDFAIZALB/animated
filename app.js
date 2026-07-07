// --- Config & State ---
const CONFIG = {
  desktop: {
    totalFrames: 300,
    folder: "",
    loadedCount: 0,
    images: [],
    promise: null
  },
  mobile: {
    totalFrames: 240,
    folder: "building/",
    loadedCount: 0,
    images: [],
    promise: null
  }
};

const canvas = document.getElementById("animation-canvas");
const ctx = canvas.getContext("2d");
const smoothContent = document.getElementById("smooth-content");

// Loading Elements
const loader = document.getElementById("loader");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

// Helper to pad numbers (e.g., 1 -> 001)
const pad = (num, size) => {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
};

// Helper to get base path for subfolder hosting (like GitHub Pages /animated/)
const getBasePath = () => {
  const path = window.location.pathname;
  if (path.endsWith('/') || path.endsWith('.html')) {
    const lastSlash = path.lastIndexOf('/');
    return path.substring(0, lastSlash + 1);
  }
  return path + '/';
};
const BASE_PATH = getBasePath();

// Generate image source path based on layout mode and base directory path
const getFrameSrc = (mode, index) => {
  const cfg = CONFIG[mode];
  return `${BASE_PATH}${cfg.folder}ezgif-frame-${pad(index, 3)}.jpg?v=2`;
};

// Preload Images for a specific layout mode progressively
const preloadImagesForMode = (mode, onProgress, onComplete) => {
  const cfg = CONFIG[mode];
  if (cfg.promise) return cfg.promise; // Avoid duplicate preloading

  cfg.promise = new Promise((resolve) => {
    let count = 0;
    const minRequired = Math.min(25, cfg.totalFrames); // Load first 25 frames for quick interactive start
    let resolved = false;

    for (let i = 1; i <= cfg.totalFrames; i++) {
      const img = new Image();
      img.onload = () => {
        count++;
        cfg.loadedCount = count;

        if (!resolved) {
          const percent = Math.min(100, Math.floor((count / minRequired) * 100));
          if (onProgress) onProgress(percent);

          if (count >= minRequired) {
            resolved = true;
            resolve();
            if (onComplete) onComplete();
          }
        }
      };
      
      img.onerror = () => {
        count++;
        cfg.loadedCount = count;

        if (!resolved) {
          const percent = Math.min(100, Math.floor((count / minRequired) * 100));
          if (onProgress) onProgress(percent);

          if (count >= minRequired) {
            resolved = true;
            resolve();
            if (onComplete) onComplete();
          }
        }
      };

      img.src = getFrameSrc(mode, i);
      cfg.images.push(img);
    }
  });
  return cfg.promise;
};

// Drawing Images to Canvas (implementing "cover" behavior with pixel alignment)
function drawImageProp(ctx, img, x, y, w, h, offsetX = 0.5, offsetY = 0.5) {
  if (!ctx || !img) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let iw = img.width,
      ih = img.height,
      r = Math.min(w / iw, h / ih),
      nw = iw * r,
      nh = ih * r,
      cx, cy, cw, ch, ar = 1;

  if (nw < w) ar = w / nw;                             
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
  nw *= ar;
  nh *= ar;

  cw = iw / (nw / w);
  ch = ih / (nh / h);

  cx = (iw - cw) * offsetX;
  cy = (ih - ch) * offsetY;

  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  ctx.drawImage(
    img, 
    Math.floor(cx), 
    Math.floor(cy), 
    Math.floor(cw), 
    Math.floor(ch),  
    Math.floor(x), 
    Math.floor(y), 
    Math.floor(w), 
    Math.floor(h)
  );
}

// Resize Canvas to fill viewport
const resizeCanvas = () => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
};

// Sync virtual scroll body height
const syncBodyHeight = () => {
  if (smoothContent) {
    document.body.style.height = `${smoothContent.scrollHeight}px`;
  }
};

// Detect active layout mode (desktop vs. mobile)
const getActiveLayoutMode = () => {
  return window.innerWidth < 768 ? "mobile" : "desktop";
};

let currentLayoutMode = getActiveLayoutMode();
let currentFrameIndex = 0;
let targetFrameIndex = 0;
let smoothScrollY = 0;
let isRunning = false;

// Smooth Render Loop (Lerping scroll position and frame index)
const renderLoop = () => {
  const activeCfg = CONFIG[currentLayoutMode];
  const lerpFactor = 0.08; // Adjust for scroll/inertia feel (lower is smoother)

  // 1. Lerp scroll position
  const targetScrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollDiff = targetScrollY - smoothScrollY;

  if (Math.abs(scrollDiff) < 0.05) {
    smoothScrollY = targetScrollY;
  } else {
    smoothScrollY += scrollDiff * lerpFactor;
  }

  // 2. Translate floating content container smoothly
  if (smoothContent) {
    smoothContent.style.transform = `translate3d(0, -${Math.round(smoothScrollY)}px, 0)`;
  }

  // 3. Map smoothScrollY to target frame index (completing the animation 100% right before entering contact form)
  const contactSection = document.getElementById("contact");
  let maxScrollForAnimation = document.body.scrollHeight - window.innerHeight;
  if (contactSection) {
    const rect = contactSection.getBoundingClientRect();
    const absoluteContactTop = rect.top + smoothScrollY;
    maxScrollForAnimation = absoluteContactTop - window.innerHeight;
  }

  if (maxScrollForAnimation > 0) {
    const scrollFraction = Math.max(0, Math.min(1, smoothScrollY / maxScrollForAnimation));
    targetFrameIndex = scrollFraction * (activeCfg.totalFrames - 1);
  }

  // 4. Lerp current frame index to target frame index
  const frameDiff = targetFrameIndex - currentFrameIndex;
  if (Math.abs(frameDiff) < 0.01) {
    currentFrameIndex = targetFrameIndex;
  } else {
    currentFrameIndex += frameDiff * lerpFactor;
  }

  // 5. Draw frame
  const roundedFrame = Math.round(currentFrameIndex);
  if (activeCfg.images[roundedFrame]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawImageProp(ctx, activeCfg.images[roundedFrame], 0, 0, canvas.width, canvas.height);
  }

  // 6. Fade out background animation as contact form enters viewport
  const canvasContainer = document.querySelector(".canvas-container");
  if (contactSection && canvasContainer) {
    const contactRect = contactSection.getBoundingClientRect();
    if (contactRect.top < window.innerHeight) {
      const opacity = Math.max(0, contactRect.top / window.innerHeight);
      canvasContainer.style.opacity = opacity;
    } else {
      canvasContainer.style.opacity = 1;
    }
  }

  // Continue rendering if positions haven't settled
  if (Math.abs(scrollDiff) > 0.05 || Math.abs(frameDiff) > 0.01) {
    requestAnimationFrame(renderLoop);
  } else {
    isRunning = false;
  }
};

// Start loop if it is not already running
const triggerRender = () => {
  if (!isRunning) {
    isRunning = true;
    requestAnimationFrame(renderLoop);
  }
};

// Update scroll target and run animation frame
const updateFrameIndex = () => {
  triggerRender();
};

// Handle window resize dynamically and switch layouts
const handleResize = () => {
  resizeCanvas();
  syncBodyHeight();

  const activeMode = getActiveLayoutMode();
  if (activeMode !== currentLayoutMode) {
    currentLayoutMode = activeMode;
    // Load the other set if not already loaded
    preloadImagesForMode(activeMode);
    // Reset scroll metrics
    updateFrameIndex();
  } else {
    triggerRender();
  }
};

// Setup intersection observer for narrative fading in
const setupIntersectionObserver = () => {
  const sections = document.querySelectorAll(".scroll-section");
  const options = {
    root: null,
    threshold: 0.15, // Trigger when 15% of section is visible
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active-section");
      } else {
        entry.target.classList.remove("active-section");
      }
    });
  }, options);

  sections.forEach((section) => observer.observe(section));
};

// --- Functional Features ---

// 1. Smooth Virtual Anchor Navigation
const setupSmoothAnchorNavigation = () => {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      const targetEl = document.querySelector(targetId);

      if (targetEl) {
        // Calculate absolute top offset inside the smooth Content container
        const rect = targetEl.getBoundingClientRect();
        const targetOffset = rect.top + smoothScrollY;

        // Perform standard smooth scrolling on the window body
        window.scrollTo({
          top: targetOffset,
          behavior: "smooth"
        });
      }
    });
  });
};

// 2. Interactive Specifications Tabs
const setupSpecsTabs = () => {
  const tabContainers = document.querySelectorAll(".interactive-tabs");

  tabContainers.forEach((container) => {
    const buttons = container.querySelectorAll(".tab-btn");
    const panes = container.querySelectorAll(".tab-pane");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");

        // Remove active class from all buttons and panes in this tab container
        buttons.forEach((b) => b.classList.remove("active"));
        panes.forEach((p) => p.classList.remove("active"));

        // Activate clicked button and target pane
        btn.classList.add("active");
        const activePane = container.querySelector(`#tab-${targetTab}`);
        if (activePane) {
          activePane.classList.add("active");
        }

        // Sync body height in case tab contents have changed the height of the document
        setTimeout(syncBodyHeight, 100);
      });
    });
  });
};

// 3. Custom Success Modal & Form Handling
const setupConsultationForm = () => {
  const form = document.getElementById("consultation-form");
  const modal = document.getElementById("success-modal");
  const closeBtn = document.getElementById("close-modal-btn");

  if (form && modal) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Show Custom Success Modal
      modal.classList.add("active");

      // Reset Form fields
      form.reset();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    // Close modal if clicking overlay backdrop
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  }
};

// Initialize App
const init = async () => {
  window.addEventListener("resize", handleResize);
  resizeCanvas();

  const initialMode = getActiveLayoutMode();
  currentLayoutMode = initialMode;

  // Preload frames for the initial layout mode
  await preloadImagesForMode(
    initialMode,
    // onProgress:
    (percent) => {
      progressBar.style.width = `${percent}%`;
      progressText.innerText = `${percent}%`;
    },
    // onComplete:
    () => {
      setTimeout(() => {
        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        // Calculate scroll heights after loader hides and elements render
        syncBodyHeight();
      }, 600);
    }
  );
  
  // Initial draw and trigger loop
  triggerRender();

  // Scroll listener
  window.addEventListener("scroll", updateFrameIndex);

  // Setup core logic features
  setupIntersectionObserver();
  setupSmoothAnchorNavigation();
  setupSpecsTabs();
  setupConsultationForm();

  // Extra height syncs to account for late stylesheet/fonts loading
  setTimeout(syncBodyHeight, 1000);
  setTimeout(syncBodyHeight, 2500);

  // Background-preload the other layout mode so switching on resize is instant
  const inactiveMode = initialMode === "desktop" ? "mobile" : "desktop";
  preloadImagesForMode(inactiveMode);
};

init();
