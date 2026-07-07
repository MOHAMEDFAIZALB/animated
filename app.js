// --- Config ---
const totalFrames = 300;
const images = [];
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

// Generate image source path
const getFrameSrc = (index) => {
  // Filename format: ezgif-frame-001.jpg?v=2
  return `ezgif-frame-${pad(index, 3)}.jpg?v=2`;
};

// Preload Images
let loadedCount = 0;
const preloadImages = () => {
  return new Promise((resolve) => {
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        const percent = Math.floor((loadedCount / totalFrames) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `${percent}%`;

        if (loadedCount === totalFrames) {
          // Hide loader with a slight delay for visual smoothness
          setTimeout(() => {
            loader.style.opacity = "0";
            loader.style.visibility = "hidden";
            resolve();
          }, 600);
        }
      };
      
      img.onerror = () => {
        // Fallback for failed loads to keep progression running
        loadedCount++;
        if (loadedCount === totalFrames) {
          loader.style.opacity = "0";
          loader.style.visibility = "hidden";
          resolve();
        }
      };

      img.src = getFrameSrc(i);
      images.push(img);
    }
  });
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

let currentFrameIndex = 0;
let targetFrameIndex = 0;

// Update target frame index based on scroll position
const updateFrameIndex = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  
  if (maxScroll <= 0) return;

  const scrollFraction = scrollTop / maxScroll;
  targetFrameIndex = Math.min(
    totalFrames - 1,
    Math.floor(scrollFraction * totalFrames)
  );
};

// Smooth Render Loop (Lerping frame index)
const renderLoop = () => {
  // Smoothly interpolate current frame to target frame
  const lerpFactor = 0.08; // Adjust between 0.01 (extremely slow/smooth) and 1.0 (instant)
  const diff = targetFrameIndex - currentFrameIndex;

  if (Math.abs(diff) < 0.01) {
    currentFrameIndex = targetFrameIndex;
  } else {
    currentFrameIndex += diff * lerpFactor;
  }

  const roundedFrame = Math.round(currentFrameIndex);
  if (images[roundedFrame]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw using full canvas.width and height (already scaled by DPR)
    drawImageProp(ctx, images[roundedFrame], 0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(renderLoop);
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
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  await preloadImages();
  
  // Start the smooth continuous animation loop
  renderLoop();

  // Scroll listener
  window.addEventListener("scroll", updateFrameIndex);

  // Setup text reveals
  setupIntersectionObserver();
};

init();
