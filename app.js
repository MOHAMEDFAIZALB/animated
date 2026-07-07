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

// Generate image source path based on layout mode
const getFrameSrc = (mode, index) => {
  const cfg = CONFIG[mode];
  return `${cfg.folder}ezgif-frame-${pad(index, 3)}.jpg?v=2`;
};

// Preload Images for a specific layout mode progressively
const preloadImagesForMode = (mode, onProgress, onComplete) => {
  const cfg = CONFIG[mode];
  if (cfg.promise) return cfg.promise; // Avoid duplicate preloading

  cfg.promise = new Promise((resolve) => {
    let count = 0;
    const minRequired = Math.min(25, cfg.totalFrames); // Wait for only 25 frames (~10% load) to make the site load 10x faster!
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

  // Set high quality smoothing settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Keep aspect ratio
  let iw = img.width,
      ih = img.height,
      r = Math.min(w / iw, h / ih),
      nw = iw * r,   // new prop. width
      nh = ih * r,   // new prop. height
      cx, cy, cw, ch, ar = 1;

  // Decide which gap to fill
  if (nw < w) ar = w / nw;                             
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
  nw *= ar;
  nh *= ar;

  // Source rectangle
  cw = iw / (nw / w);
  ch = ih / (nh / h);

  cx = (iw - cw) * offsetX;
  cy = (ih - ch) * offsetY;

  // Make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  // Draw image aligned to integer boundaries to prevent sub-pixel blurring
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

// Resize Canvas to fill viewport (supporting High-DPI / Retina screens)
const resizeCanvas = () => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
};

// Detect active layout mode (desktop vs. mobile)
const getActiveLayoutMode = () => {
  return window.innerWidth < 768 ? "mobile" : "desktop";
};

let currentLayoutMode = getActiveLayoutMode();
let currentFrameIndex = 0;
let targetFrameIndex = 0;
let isRunning = false;

// Smooth Render Loop (Lerping frame index)
const renderLoop = () => {
  const activeCfg = CONFIG[currentLayoutMode];
  // Smoothly interpolate current frame to target frame
  const lerpFactor = 0.08; 
  const diff = targetFrameIndex - currentFrameIndex;

  if (Math.abs(diff) < 0.01) {
    currentFrameIndex = targetFrameIndex;
    isRunning = false; // Stop the loop when target frame is reached
  } else {
    currentFrameIndex += diff * lerpFactor;
  }

  const roundedFrame = Math.round(currentFrameIndex);
  if (activeCfg.images[roundedFrame]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw using full canvas.width and height (already scaled by DPR)
    drawImageProp(ctx, activeCfg.images[roundedFrame], 0, 0, canvas.width, canvas.height);
  }

  if (isRunning) {
    requestAnimationFrame(renderLoop);
  }
};

// Start loop if it is not already running
const triggerRender = () => {
  if (!isRunning) {
    isRunning = true;
    requestAnimationFrame(renderLoop);
  }
};

// Update target frame index based on scroll position and active config
const updateFrameIndex = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  
  if (maxScroll <= 0) return;

  const activeCfg = CONFIG[currentLayoutMode];
  const scrollFraction = scrollTop / maxScroll;
  targetFrameIndex = Math.min(
    activeCfg.totalFrames - 1,
    Math.floor(scrollFraction * activeCfg.totalFrames)
  );

  triggerRender();
};

// Handle window resize dynamically and switch layouts
const handleResize = () => {
  resizeCanvas();

  const activeMode = getActiveLayoutMode();
  if (activeMode !== currentLayoutMode) {
    currentLayoutMode = activeMode;
    // Load the other set if not already loaded
    preloadImagesForMode(activeMode);
    // Map current progress to the new frame size
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

// Initialize App
const init = async () => {
  // Set up resize handler and run it initially to set dimensions with DPR
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
      }, 600);
    }
  );
  
  // Start the smooth continuous animation loop
  renderLoop();

  // Scroll listener
  window.addEventListener("scroll", updateFrameIndex);

  // Setup text reveals
  setupIntersectionObserver();

  // Background-preload the other layout mode so switching on resize is instant
  const inactiveMode = initialMode === "desktop" ? "mobile" : "desktop";
  preloadImagesForMode(inactiveMode);
};

init();
