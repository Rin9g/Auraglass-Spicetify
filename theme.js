// ============================================================================
// AuraGlass theme.js
// - Dynamic Album Art Gradient Background Generator (Multi-source Realtime)
// - Fast HSL Vibrant Palette Extraction from Album Art (Color & Noir support)
// - Unified Playlist & Main View Background Sync
// - Safe Marketplace Topbar Integration (Zero duplicates)
// - Millisecond-accurate Real-time Karaoke Lyrics Engine (Black wipe tracking music)
// ============================================================================

function initAuraGlass() {
  if (!window.Spicetify || !window.Spicetify.Platform || !window.Spicetify.Player) {
    setTimeout(initAuraGlass, 150);
    return;
  }

  console.log("[AuraGlass] Initializing dynamic theme engine...");

  // Default atmospheric palette
  const DEFAULT_PALETTE = {
    primary: "#8a7aa6",
    secondary: "#5b7596",
    accent: "#a56ca0",
    dark: "#0a0a0f"
  };

  let lastTrackImgUrl = "";
  let lastTrackUri = "";
  let cachedLyrics = [];
  let currentActiveLyricEl = null;

  // --------------------------------------------------------------------------
  // 1. Dynamic Background DOM Setup
  // --------------------------------------------------------------------------
  function initBackground() {
    if (document.getElementById("aura-background-container")) return;

    const bgContainer = document.createElement("div");
    bgContainer.id = "aura-background-container";
    bgContainer.innerHTML = `
      <div class="aura-blob aura-blob-1"></div>
      <div class="aura-blob aura-blob-2"></div>
      <div class="aura-blob aura-blob-3"></div>
      <div class="aura-blob aura-blob-4"></div>
      <div class="aura-gradient-overlay"></div>
      <div class="aura-grain-overlay"></div>
    `;

    document.body.prepend(bgContainer);
  }

  // --------------------------------------------------------------------------
  // 2. Color Utilities & Fast HSL Vibrant Extractor
  // --------------------------------------------------------------------------
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function applyPalette(palette) {
    if (!palette) return;
    const root = document.documentElement;
    root.style.setProperty("--aura-color-primary", palette.primary);
    root.style.setProperty("--aura-color-secondary", palette.secondary);
    root.style.setProperty("--aura-color-accent", palette.accent);
    root.style.setProperty("--aura-color-dark", palette.dark);
  }

  function extractColorsFromImage(imgUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = 64;
          canvas.height = 64;
          ctx.drawImage(img, 0, 0, 64, 64);
          const data = ctx.getImageData(0, 0, 64, 64).data;

          // Group into 36 hue bins (10 deg each)
          const bins = Array.from({ length: 36 }, () => ({
            count: 0,
            totalS: 0,
            totalL: 0,
            hues: []
          }));
          const allSamples = [];

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;
            if (l < 0.05 || l > 0.95) continue;
            const d = (max - min) / 255;
            const s = d === 0 ? 0 : (l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255));
            
            allSamples.push({ r, g, b, s, l });

            if (s >= 0.12) {
              let h = 0;
              if (max === r) h = (g / 255 - b / 255) / d + (g < b ? 6 : 0);
              else if (max === g) h = (b / 255 - r / 255) / d + 2;
              else h = (r / 255 - g / 255) / d + 4;
              h = (h / 6) * 360;

              const binIdx = Math.floor(h / 10) % 36;
              bins[binIdx].count++;
              bins[binIdx].totalS += s;
              bins[binIdx].totalL += l;
              bins[binIdx].hues.push(h);
            }
          }

          const activeBins = bins
            .map((b, idx) => ({
              idx,
              count: b.count,
              avgH: b.count ? b.hues.reduce((acc, c) => acc + c, 0) / b.count : 0,
              avgS: b.count ? b.totalS / b.count : 0,
              avgL: b.count ? b.totalL / b.count : 0,
              score: b.count * (0.8 + (b.totalS / (b.count || 1)) * 1.5)
            }))
            .filter((b) => b.count > 10)
            .sort((a, b) => b.score - a.score);

          if (activeBins.length > 0) {
            const dom = activeBins[0];
            const sec =
              activeBins.find((c) => Math.abs(c.avgH - dom.avgH) > 28) ||
              activeBins[Math.min(1, activeBins.length - 1)];
            const acc =
              activeBins.find(
                (c) =>
                  Math.abs(c.avgH - dom.avgH) > 45 && Math.abs(c.avgH - sec.avgH) > 20
              ) || activeBins[activeBins.length - 1];

            // Preserve natural saturation and rich atmosphere
            const domS = Math.min(Math.max(dom.avgS * 100, 35), 85);
            const domL = Math.min(Math.max(dom.avgL * 100, 20), 44);

            const secS = Math.min(Math.max(sec.avgS * 100, 30), 80);
            const secL = Math.min(Math.max(sec.avgL * 100, 14), 36);

            const accS = Math.min(Math.max(acc.avgS * 100, 45), 90);
            const accL = Math.min(Math.max(acc.avgL * 100, 28), 54);

            resolve({
              primary: hslToHex(dom.avgH, domS, domL),
              secondary: hslToHex(sec.avgH, secS, secL),
              accent: hslToHex(acc.avgH, accS, accL),
              dark: "#0a0a0f"
            });
          } else {
            // Monochrome / Noir artwork
            allSamples.sort((a, b) => b.l - a.l);
            const mid = allSamples[Math.floor(allSamples.length / 2)] || { l: 0.35 };
            const dark = allSamples[allSamples.length - 1] || { l: 0.15 };
            const bright = allSamples[0] || { l: 0.6 };
            resolve({
              primary: hslToHex(220, 14, Math.min(Math.max(mid.l * 100, 22), 40)),
              secondary: hslToHex(210, 16, Math.min(Math.max(dark.l * 100, 12), 28)),
              accent: hslToHex(230, 20, Math.min(Math.max(bright.l * 100, 35), 58)),
              dark: "#08080c"
            });
          }
        } catch (e) {
          console.warn("[AuraGlass] Canvas extract exception:", e);
          resolve(DEFAULT_PALETTE);
        }
      };
      img.onerror = () => resolve(DEFAULT_PALETTE);
      img.src = imgUrl;
    });
  }

  // --------------------------------------------------------------------------
  // 3. Multi-source Track Color Watcher
  // --------------------------------------------------------------------------
  async function updateTrackColors() {
    let imgUrl = "";

    const domImg = document.querySelector(
      '.n6XE6JL2UDeFogzbLcNC img, .L5dM7nzQpMJtRkvZZBZL img, aside#Desktop_PanelContainer_Id img, [data-npv-root="true"] img, .main-nowPlayingBar-container img, [data-testid="now-playing-bar"] img, .Root__right-sidebar img'
    );
    if (domImg && domImg.src && domImg.src.startsWith("http")) {
      imgUrl = domImg.src;
    }

    if (!imgUrl) {
      const stateItem = Spicetify.Platform?.PlayerAPI?._state?.item;
      const meta = stateItem?.metadata || Spicetify.Player?.data?.item?.metadata;
      if (meta?.image_large_url && meta.image_large_url.startsWith("http")) {
        imgUrl = meta.image_large_url;
      } else if (meta?.image_url && meta.image_url.startsWith("http")) {
        imgUrl = meta.image_url;
      } else if (meta?.image_url && meta.image_url.startsWith("spotify:image:")) {
        const id = meta.image_url.replace("spotify:image:", "");
        imgUrl = `https://i.scdn.co/image/${id}`;
      }
    }

    if (!imgUrl || imgUrl === lastTrackImgUrl) return;
    lastTrackImgUrl = imgUrl;

    const palette = await extractColorsFromImage(imgUrl);
    applyPalette(palette);
  }

  // --------------------------------------------------------------------------
  // 4. Safe Marketplace Topbar Navigation Button (Zero Duplicates)
  // --------------------------------------------------------------------------
  function initMarketplaceButton() {
    // Check if Marketplace button already exists natively or injected
    const existing = document.querySelector(
      'button[aria-label="Marketplace"], button[title="Marketplace"], button.custom-navlink'
    );

    // Remove any extra duplicates
    const allMarketplaceButtons = document.querySelectorAll('#spicetify-marketplace-topbar-button');
    if (allMarketplaceButtons.length > 1) {
      for (let i = 1; i < allMarketplaceButtons.length; i++) {
        allMarketplaceButtons[i].remove();
      }
    }

    if (existing) return;
    if (!Spicetify.Topbar || !Spicetify.Topbar.Button) return;

    const mktSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 76.465 68.262"><path d="M151.909 72.923v6.5h10.097l8.663 44.567h48.968v-6.5h-43.61l-1.2-6.172h42.974l10.35-33.91h-59.915l-.872-4.485H151.91zm17.59 10.984h49.867l-6.393 20.91h-39.409l-4.064-20.91zm5.626 44.11a6.5 6.5 0 0 0-6.5 6.5 6.5 6.5 0 0 0 6.5 6.501 6.5 6.5 0 0 0 6.5-6.5 6.5 6.5 0 0 0-6.5-6.5zm38.274 0a6.5 6.5 0 0 0-6.5 6.5 6.5 6.5 0 0 0 6.5 6.501 6.5 6.5 0 0 0 6.5-6.5 6.5 6.5 0 0 0-6.5-6.5z" style="fill:currentColor;stroke-width:.264583" transform="translate(-151.909 -72.923)"/></svg>`;

    try {
      const btn = new Spicetify.Topbar.Button(
        "Marketplace",
        mktSvg,
        () => {
          Spicetify.Platform.History.push("/marketplace");
        }
      );
      if (btn && btn.element) {
        btn.element.id = "spicetify-marketplace-topbar-button";
      }
    } catch (e) {
      console.warn("[AuraGlass] Topbar button setup note:", e);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Millisecond-accurate Real-time Karaoke Lyrics Engine & Gentle Glide
  // --------------------------------------------------------------------------
  let lyricsGlideAnimId = null;
  let userManualScrollExpiry = 0;
  let lastGlidedLyricEl = null;
  let lastGlidedLyricTime = 0;

  function getLyricsScroller(targetEl) {
    // 1. Closest scrollable ancestor of targetEl
    if (targetEl && targetEl.closest) {
      let cur = targetEl.parentElement;
      while (cur && cur !== document.body) {
        if (cur.scrollHeight > cur.clientHeight + 10 && cur.clientHeight > 100) {
          const oy = window.getComputedStyle(cur).overflowY;
          if (oy === "auto" || oy === "scroll") {
            return cur;
          }
        }
        cur = cur.parentElement;
      }
    }

    // 2. Candidate viewports that are actively scrollable and contain lyrics
    const candidates = Array.from(document.querySelectorAll(
      ".TwBIa7RNOtp1qNK47ORO [data-overlayscrollbars-viewport], " +
      ".Root__lyrics-cinema [data-overlayscrollbars-viewport], " +
      "#lyrics-cinema [data-overlayscrollbars-viewport], " +
      "[data-overlayscrollbars-viewport], " +
      ".os-viewport"
    ));

    for (const el of candidates) {
      if (
        el.scrollHeight > el.clientHeight + 10 &&
        el.clientHeight > 100 &&
        el.querySelector(".VJ82jCGUtjX3d2YQSiFA, .lyrics-lyricsContent-lyric, .mzAT53py1LJkDA4izCjN")
      ) {
        return el;
      }
    }

    // 3. Fallback: any element with overflow-y auto/scroll containing lyrics
    const allScrollables = Array.from(document.querySelectorAll("div"));
    for (const el of allScrollables) {
      if (
        el.clientHeight > 100 &&
        el.scrollHeight > el.clientHeight + 10 &&
        el.querySelector(".VJ82jCGUtjX3d2YQSiFA, .lyrics-lyricsContent-lyric")
      ) {
        const oy = window.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") {
          return el;
        }
      }
    }

    return null;
  }

  let currentGlideTarget = null;

  function smoothGlideTo(targetTop, duration = 440, scroller = null, force = false) {
    if (!force && Date.now() < userManualScrollExpiry) return;
    if (!scroller) scroller = getLyricsScroller();
    if (!scroller) return;

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const clampedTarget = Math.max(0, Math.min(maxScroll, Math.round(targetTop)));

    // If an animation is already running towards this exact target (within 3px), let it finish smoothly without restarting
    if (lyricsGlideAnimId && currentGlideTarget !== null && Math.abs(currentGlideTarget - clampedTarget) < 3) {
      return;
    }

    if (lyricsGlideAnimId) {
      cancelAnimationFrame(lyricsGlideAnimId);
      lyricsGlideAnimId = null;
    }

    const startTop = scroller.scrollTop;
    const distance = clampedTarget - startTop;

    if (Math.abs(distance) < 2) {
      currentGlideTarget = null;
      return;
    }

    currentGlideTarget = clampedTarget;

    // Adaptive duration: smooth and organic based on hop distance
    const adaptiveDuration = Math.max(300, Math.min(480, Math.round(duration * Math.min(1.15, Math.max(0.65, Math.abs(distance) / 100)))));

    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / adaptiveDuration);
      // Continuous cosine easing: 0 initial acceleration jerk, gentle glide, soft touchdown
      const ease = 0.5 * (1 - Math.cos(Math.PI * progress));
      scroller.scrollTop = Math.round(startTop + distance * ease);

      if (progress < 1) {
        lyricsGlideAnimId = requestAnimationFrame(tick);
      } else {
        scroller.scrollTop = clampedTarget;
        lyricsGlideAnimId = null;
        currentGlideTarget = null;
      }
    }
    lyricsGlideAnimId = requestAnimationFrame(tick);
  }

  function smoothGlideToElement(el, duration = 440, force = false) {
    if (!el) return;
    const lyricItem = (el.closest && el.closest(".VJ82jCGUtjX3d2YQSiFA, .lyrics-lyricsContent-lyric, .mzAT53py1LJkDA4izCjN")) || el;
    const now = Date.now();
    if (!force && lastGlidedLyricEl === lyricItem && (now - lastGlidedLyricTime < 900)) {
      return;
    }
    lastGlidedLyricEl = lyricItem;
    lastGlidedLyricTime = now;

    const currentScroller = getLyricsScroller(lyricItem);
    if (!currentScroller) return;

    if (!currentScroller.__auraScrollListenerAttached) {
      currentScroller.__auraScrollListenerAttached = true;
      const onUserScroll = () => {
        userManualScrollExpiry = Date.now() + 2500;
        if (lyricsGlideAnimId) {
          cancelAnimationFrame(lyricsGlideAnimId);
          lyricsGlideAnimId = null;
          currentGlideTarget = null;
        }
      };
      currentScroller.addEventListener("wheel", onUserScroll, { passive: true });
      currentScroller.addEventListener("touchmove", onUserScroll, { passive: true });
    }

    const sRect = currentScroller.getBoundingClientRect();
    const lRect = lyricItem.getBoundingClientRect();
    const targetTop = currentScroller.scrollTop + (lRect.top + lRect.height / 2) - (sRect.top + sRect.height / 2);
    smoothGlideTo(targetTop, duration, currentScroller, force);
  }

  function initLyricsGlide() {
    const scroller = getLyricsScroller();
    if (scroller && !scroller.__auraScrollListenerAttached) {
      scroller.__auraScrollListenerAttached = true;
      const onUserScroll = () => {
        userManualScrollExpiry = Date.now() + 2500;
        if (lyricsGlideAnimId) {
          cancelAnimationFrame(lyricsGlideAnimId);
          lyricsGlideAnimId = null;
          currentGlideTarget = null;
        }
      };
      scroller.addEventListener("wheel", onUserScroll, { passive: true });
      scroller.addEventListener("touchmove", onUserScroll, { passive: true });
    }

    if (!window.__auraOrigScrollIntoView) {
      window.__auraOrigScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(...args) {
        const isLyric = this.closest && (
          this.closest(".VJ82jCGUtjX3d2YQSiFA") ||
          this.closest(".lyrics-lyricsContent-lyric") ||
          this.closest(".mzAT53py1LJkDA4izCjN")
        );

        if (isLyric) {
          smoothGlideToElement(this, 440, false);
          return;
        }

        return window.__auraOrigScrollIntoView.apply(this, args);
      };
    }
  }

  function extractLyricsFromFiber() {
    const lines = document.querySelectorAll(".VJ82jCGUtjX3d2YQSiFA, .mzAT53py1LJkDA4izCjN, .lyrics-lyricsContent-lyric");
    for (const line of lines) {
      const key = Object.keys(line).find((k) => k.startsWith("__reactFiber"));
      let curr = line[key];
      while (curr) {
        if (curr.memoizedProps?.data?.lyrics && Array.isArray(curr.memoizedProps.data.lyrics)) {
          return curr.memoizedProps.data.lyrics;
        }
        if (curr.memoizedProps?.lyrics && Array.isArray(curr.memoizedProps.lyrics)) {
          return curr.memoizedProps.lyrics;
        }
        curr = curr.return;
      }
    }
    return null;
  }

  function getCurrentProgress() {
    try {
      if (typeof Spicetify.Player?.getProgress === "function") {
        const p = Spicetify.Player.getProgress();
        if (typeof p === "number" && !isNaN(p)) return p;
      }
    } catch (e) {}

    try {
      const state = Spicetify.Player?.origin?._state || Spicetify.Platform?.PlayerAPI?._state;
      if (state && typeof state.positionAsOfTimestamp === "number") {
        if (state.isPaused) return state.positionAsOfTimestamp;
        return state.positionAsOfTimestamp + (Date.now() - state.timestamp);
      }
    } catch (e) {}

    try {
      const data = Spicetify.Player?.data;
      if (data && typeof data.position === "number") return data.position;
    } catch (e) {}

    return 0;
  }

  function getActiveLyricsContainer() {
    // 1. If in Spotify Cinema Carousel mode, find the slide at translateX(0%)
    const slides = Array.from(document.querySelectorAll(".f8Gyc3Ce0Zl_XyLWKpn5"));
    if (slides.length > 0) {
      const activeSlide = slides.find((s) => {
        const style = s.getAttribute("style") || "";
        return style.includes("translateX(0%)") || style.includes("translateX(0px)");
      });
      if (activeSlide) return activeSlide;
    }

    // 2. Fallback: check if Spotify native active line exists, take its container
    const nativeActive = document.querySelector("._VhzCfoPHl49dzp1MkmI, .lyrics-lyricsContent-active, .N6tht_GLY5suoRAtaggy");
    if (nativeActive) {
      const c = nativeActive.closest(".bTVPDNxj8i5NwSziiRvc, .ey0UVYcBf8FjA9nw6uSw, .Uh421XLh0yabNCraXuTm, [data-testid='lyrics-container']");
      if (c) return c;
    }

    // 3. Fallback: on-screen lyrics container
    const containers = Array.from(document.querySelectorAll(".bTVPDNxj8i5NwSziiRvc, .ey0UVYcBf8FjA9nw6uSw, [data-testid='lyrics-container']"));
    for (const c of containers) {
      const r = c.getBoundingClientRect();
      if (r.width > 100 && r.right > 0 && r.left < window.innerWidth) {
        return c;
      }
    }

    return document;
  }

  function getElementStartMs(el) {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    let curr = el[key];
    while (curr) {
      if (curr.memoizedProps?.start !== undefined && typeof curr.memoizedProps.start === "number") {
        return curr.memoizedProps.start;
      }
      curr = curr.return;
    }
    return null;
  }

  function cleanupLyricElement(el) {
    if (!el) return;
    el.classList.remove("aura-lyrics-active");
    el.style.removeProperty("--aura-lyrics-progress");
    const textChild = el.querySelector(".LFG5utG7LPiCVtel1IZQ, .C8vlCbXzAR7qEMsoQG1r, div:first-child");
    if (textChild) {
      textChild.removeAttribute("data-line-sweeping");
      textChild.style.removeProperty("--aura-lyrics-progress");
    }
    el.querySelectorAll(".aura-lyric-line").forEach((span) => {
      span.dataset.lineState = "passed";
      span.removeAttribute("data-line-sweeping");
      span.style.removeProperty("--aura-line-progress");
    });
  }

  function prepareLyricLines(activeEl) {
    if (!activeEl) return null;
    const textChild = activeEl.querySelector(".LFG5utG7LPiCVtel1IZQ, .C8vlCbXzAR7qEMsoQG1r, div:first-child") || activeEl;
    if (!textChild) return null;

    if (textChild.dataset.auraPrepared === "true") {
      return Array.from(textChild.querySelectorAll(".aura-lyric-line"));
    }

    const originalText = textChild.innerText.trim();
    if (!originalText) return null;

    textChild.dataset.originalText = originalText;
    textChild.dataset.auraPrepared = "true";

    // Fast check: if single unwrapped line, wrap in a single pass with 0 reflow loops
    let isSingle = true;
    try {
      const range = document.createRange();
      range.selectNodeContents(textChild);
      if (range.getClientRects().length > 1) {
        isSingle = false;
      }
    } catch (e) {
      isSingle = false;
    }

    if (isSingle) {
      textChild.innerHTML = `<span class="aura-lyric-line" data-line-state="active">${originalText}</span>`;
      return Array.from(textChild.querySelectorAll(".aura-lyric-line"));
    }

    // Wrapped multi-line sentence: group words into lines
    const words = originalText.split(/\s+/);
    textChild.innerHTML = words.map((w) => `<span class="aura-temp-word">${w}</span>`).join(" ");

    const lines = [];
    let currentTop = null;
    let currentWords = [];

    textChild.querySelectorAll(".aura-temp-word").forEach((span) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentTop === null || Math.abs(top - currentTop) < 8) {
        if (currentTop === null) currentTop = top;
        currentWords.push(span.innerText);
      } else {
        lines.push(currentWords.join(" "));
        currentWords = [span.innerText];
        currentTop = top;
      }
    });
    if (currentWords.length) lines.push(currentWords.join(" "));

    textChild.innerHTML = lines
      .map((lineText, i) => `<span class="aura-lyric-line" data-line-state="${i === 0 ? 'active' : 'upcoming'}">${lineText}</span>`)
      .join("");

    return Array.from(textChild.querySelectorAll(".aura-lyric-line"));
  }

  function updateLyricsEngine() {
    initLyricsGlide();

    // Check current playing track URI
    const currentTrack = Spicetify.Platform?.PlayerAPI?._state?.item?.uri || Spicetify.Player?.data?.item?.uri;
    if (currentTrack && currentTrack !== lastTrackUri) {
      lastTrackUri = currentTrack;
      cachedLyrics = [];
      lastGlidedLyricEl = null;
      lastGlidedLyricTime = 0;
      currentGlideTarget = null;
      if (currentActiveLyricEl) {
        cleanupLyricElement(currentActiveLyricEl);
        currentActiveLyricEl = null;
      }
    }

    const currentProgress = getCurrentProgress();
    const container = getActiveLyricsContainer();

    let activeEl = null;
    let lineStart = null;
    let duration = 3000;

    // Fast timestamp-driven line indexing directly from Fiber within active container
    const domLines = Array.from(
      container.querySelectorAll(".VJ82jCGUtjX3d2YQSiFA, .mzAT53py1LJkDA4izCjN, .lyrics-lyricsContent-lyric")
    );

    if (domLines.length > 0) {
      const lineData = domLines.map((el) => {
        return { el, start: getElementStartMs(el) };
      }).filter((x) => typeof x.start === "number");

      lineData.sort((a, b) => a.start - b.start);

      // 0.15s (150ms) lookahead to trigger line transition early
      const LINE_LOOKAHEAD_MS = 150;
      let foundIdx = -1;
      for (let i = 0; i < lineData.length; i++) {
        if (lineData[i].start <= currentProgress + LINE_LOOKAHEAD_MS) {
          foundIdx = i;
        } else {
          break;
        }
      }

      if (foundIdx >= 0) {
        const candidate = lineData[foundIdx].el;
        if (candidate && candidate.innerText.trim().length > 0) {
          activeEl = candidate;
          lineStart = lineData[foundIdx].start;

          if (!cachedLyrics || cachedLyrics.length === 0) {
            cachedLyrics = extractLyricsFromFiber() || [];
          }
          const fiberMatch = cachedLyrics.find((l) => l.start === lineStart);
          if (fiberMatch && typeof fiberMatch.end === "number" && fiberMatch.end > lineStart) {
            duration = fiberMatch.end - lineStart;
          } else {
            const nextStart = foundIdx < lineData.length - 1 ? lineData[foundIdx + 1].start : null;
            if (nextStart && nextStart > lineStart) {
              duration = nextStart - lineStart;
            }
          }

          // Pre-prepare next upcoming line ahead of time during playback to eliminate layout freeze on transition
          if (foundIdx < lineData.length - 1) {
            const nextEl = lineData[foundIdx + 1].el;
            if (nextEl && !nextEl.querySelector("[data-aura-prepared='true']")) {
              prepareLyricLines(nextEl);
            }
          }
        }
      }
    }

    // Fallback: check DOM active classes inside the active container
    if (!activeEl) {
      const activeSelector = [
        ".VJ82jCGUtjX3d2YQSiFA._VhzCfoPHl49dzp1MkmI",
        "._VhzCfoPHl49dzp1MkmI",
        ".mzAT53py1LJkDA4izCjN.N6tht_GLY5suoRAtaggy",
        ".lyrics-lyricsContent-active",
        ".lyrics-lyricsContainer-LyricsLine-active"
      ].join(", ");
      activeEl = container.querySelector(activeSelector) || document.querySelector(activeSelector);
      if (activeEl) {
        lineStart = getElementStartMs(activeEl);
        if (lineStart === null) lineStart = currentProgress;
      }
    }

    if (!activeEl) {
      if (currentActiveLyricEl) {
        cleanupLyricElement(currentActiveLyricEl);
        currentActiveLyricEl = null;
      }
      return;
    }

    // When active line changes, cleanup old line and register new
    if (activeEl !== currentActiveLyricEl) {
      if (currentActiveLyricEl) {
        cleanupLyricElement(currentActiveLyricEl);
      }
      currentActiveLyricEl = activeEl;
      activeEl.classList.add("aura-lyrics-active");

      // Settle DOM layout first so targetTop measures final stable geometry
      prepareLyricLines(activeEl);
      smoothGlideToElement(activeEl, 520, true);
    }

    if (lineStart === null) return;
    if (duration < 500) duration = 2500;

    let pct = 0;
    if (currentProgress >= lineStart) {
      pct = Math.min(100, Math.max(0, ((currentProgress - lineStart) / duration) * 100));
    }
    const pctStr = pct.toFixed(1) + "%";

    const lineSpans = prepareLyricLines(activeEl);
    if (lineSpans && lineSpans.length > 0) {
      const N = lineSpans.length;
      if (N === 1) {
        if (pct >= 100) {
          lineSpans[0].dataset.lineState = "passed";
          lineSpans[0].removeAttribute("data-line-sweeping");
          lineSpans[0].style.removeProperty("--aura-line-progress");
        } else if (pct <= 0.05) {
          lineSpans[0].dataset.lineState = "active";
          lineSpans[0].dataset.lineSweeping = "false";
          lineSpans[0].style.removeProperty("--aura-line-progress");
        } else {
          lineSpans[0].dataset.lineState = "active";
          lineSpans[0].dataset.lineSweeping = "true";
          lineSpans[0].style.setProperty("--aura-line-progress", pctStr);
        }
      } else {
        // Weighted smoothly by character count of each line so reading speed is 100% constant
        const lengths = lineSpans.map((s) => Math.max(1, (s.textContent || "").trim().length));
        const totalLen = lengths.reduce((acc, l) => acc + l, 0);

        let cumulative = 0;
        const thresholds = [0];
        for (let i = 0; i < N; i++) {
          cumulative += lengths[i];
          thresholds.push(cumulative / totalLen);
        }

        // 0.12s (120ms) lead time in progress ratio: wrap before sweep starts
        const leadRatio = Math.min(0.08, 120 / Math.max(500, duration));
        const pRatio = pct / 100;

        lineSpans.forEach((span, idx) => {
          const sweepStart = thresholds[idx];
          const wrapStart = idx === 0 ? 0 : Math.max(thresholds[idx - 1], sweepStart - leadRatio);
          const sweepEnd = idx === N - 1 ? 1.0 : Math.max(sweepStart + 0.02, thresholds[idx + 1] - leadRatio);

          if (pRatio >= sweepEnd) {
            span.dataset.lineState = "passed";
            span.removeAttribute("data-line-sweeping");
            span.style.removeProperty("--aura-line-progress");
          } else if (pRatio < wrapStart) {
            span.dataset.lineState = "upcoming";
            span.removeAttribute("data-line-sweeping");
            span.style.removeProperty("--aura-line-progress");
          } else if (pRatio < sweepStart || pct <= 0.05) {
            // In the pre-wrap window or waiting for singing to start: Line sits clean at 0%
            span.dataset.lineState = "active";
            span.dataset.lineSweeping = "false";
            span.style.removeProperty("--aura-line-progress");
          } else {
            // Actively sweeping black from left to right
            span.dataset.lineState = "active";
            span.dataset.lineSweeping = "true";
            const linePct = Math.min(100, Math.max(0, ((pRatio - sweepStart) / (sweepEnd - sweepStart)) * 100));
            span.style.setProperty("--aura-line-progress", linePct.toFixed(1) + "%");
          }
        });
      }
    } else {
      const textChild = activeEl.querySelector(".LFG5utG7LPiCVtel1IZQ, .C8vlCbXzAR7qEMsoQG1r, div:first-child");
      if (textChild) {
        if (pct <= 0.05) {
          textChild.dataset.lineSweeping = "false";
          textChild.style.removeProperty("--aura-lyrics-progress");
        } else {
          textChild.dataset.lineSweeping = "true";
          textChild.style.setProperty("--aura-lyrics-progress", pctStr);
        }
      }
    }
  }

  // Single VSYNC display refresh engine
  let frameCount = 0;
  function lyricsTick() {
    try {
      window.__auraLastTick = Date.now();
      window.__auraFrameCount = (window.__auraFrameCount || 0) + 1;
      updateLyricsEngine();
      window.__auraLastError = null;
      if (++frameCount % 12 === 0) {
        updateCinemaState();
      }
    } catch (e) {
      window.__auraLastError = e.message + " " + e.stack;
      console.error("[AuraGlass] lyricsTick error:", e);
    }
  }

  function lyricsLoop() {
    lyricsTick();
    requestAnimationFrame(lyricsLoop);
  }

  // --------------------------------------------------------------------------
  // 6. Cinema Lyrics State & Idle Auto-hide Controller
  // --------------------------------------------------------------------------
  let cinemaIdleTimer = null;
  function resetCinemaIdle() {
    if (document.body.hasAttribute("data-cinema-idle")) {
      document.body.removeAttribute("data-cinema-idle");
    }
    if (cinemaIdleTimer) {
      clearTimeout(cinemaIdleTimer);
      cinemaIdleTimer = null;
    }

    if (document.body.classList.contains("aura-cinema-active")) {
      cinemaIdleTimer = setTimeout(() => {
        if (document.body.classList.contains("aura-cinema-active")) {
          document.body.setAttribute("data-cinema-idle", "true");
        }
      }, 2000);
    }
  }

  function updateCinemaState() {
    const isLyricsPath = !!(
      Spicetify.Platform?.History?.location?.pathname?.startsWith("/lyrics") ||
      window.location.pathname.startsWith("/lyrics")
    );
    const lyricsBtn = document.querySelector(
      '[data-testid="lyrics-button"], button[aria-label*="lyric" i], button[aria-label*="lời" i]'
    );
    const isLyricsBtnActive = !!(
      lyricsBtn &&
      (lyricsBtn.getAttribute("aria-pressed") === "true" || lyricsBtn.getAttribute("aria-checked") === "true")
    );
    const cinemaEl = document.querySelector(
      "#main-view .VJ82jCGUtjX3d2YQSiFA, #main-view .bTVPDNxj8i5NwSziiRvc, .Gs2EwEu259e_Q_vcVyCx, .Root__lyrics-cinema, #lyrics-cinema, [data-testid=\"lyrics-cinema-view\"], [data-testid=\"lyrics-container\"], .lyrics-lyrics-container"
    );
    const isCinema = isLyricsPath || isLyricsBtnActive || !!(
      cinemaEl &&
      window.getComputedStyle(cinemaEl).display !== "none" &&
      cinemaEl.children.length > 0 &&
      cinemaEl.getBoundingClientRect().height > 150
    );
    const isFs = !!(document.fullscreenElement || document.body.classList.contains("fullscreen"));
    const active = isCinema || isFs;

    const wasActive = document.body.classList.contains("aura-cinema-active");
    if (wasActive !== active) {
      document.body.classList.toggle("aura-cinema-active", active);
      if (!active) {
        document.body.removeAttribute("data-cinema-idle");
        if (cinemaIdleTimer) {
          clearTimeout(cinemaIdleTimer);
          cinemaIdleTimer = null;
        }
      } else {
        resetCinemaIdle();
      }
    }
  }

  ["mousemove", "mousedown", "keydown", "wheel", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, resetCinemaIdle, { passive: true });
    document.addEventListener(evt, resetCinemaIdle, { passive: true });
  });

  // --------------------------------------------------------------------------
  // 7. Right Sidebar Vinyl Play State & Canvas Controller
  // --------------------------------------------------------------------------
  function updateVinylState() {
    let isPlaying = false;
    try {
      if (typeof Spicetify.Player?.isPlaying === "function") {
        isPlaying = Spicetify.Player.isPlaying();
      }
    } catch (e) {
      try {
        const state = Spicetify.Player?.origin?._state || Spicetify.Platform?.PlayerAPI?._state;
        if (state && typeof state.isPaused === "boolean") isPlaying = !state.isPaused;
      } catch (err) {}
    }
    document.documentElement.style.setProperty(
      "--aura-vinyl-play-state",
      isPlaying ? "running" : "paused"
    );

    // Keep Canvas disabled in Now Playing View so the Vinyl record is always visible
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith(":canvasVideosEnabled") && localStorage.getItem(k) !== "false") {
          localStorage.setItem(k, "false");
        }
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 8. Observers & Lifecycle Listeners (Start Engine)
  // --------------------------------------------------------------------------
  initBackground();
  applyPalette(DEFAULT_PALETTE);
  initMarketplaceButton();

  // Watch for DOM changes (Cover art in now playing bar, lyrics active line, and topbar)
  const domObserver = new MutationObserver(() => {
    updateTrackColors();
    initMarketplaceButton();
    updateCinemaState();
  });

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class"]
  });

  // Listen to Spicetify Player events
  if (Spicetify.Player?.addEventListener) {
    Spicetify.Player.addEventListener("songchange", () => {
      cachedLyrics = [];
      updateTrackColors();
      updateCinemaState();
    });
    Spicetify.Player.addEventListener("onplaypause", () => {
      updateTrackColors();
      updateVinylState();
    });
  }

  // Interval poll to catch any edge-case track changes
  setInterval(() => {
    updateTrackColors();
    updateCinemaState();
    updateVinylState();
  }, 1000);

  // Start synchronized VSYNC engine
  try {
    requestAnimationFrame(lyricsLoop);
  } catch (e) {}

  // Background fallback ONLY when window is hidden/minimized
  try {
    setInterval(() => {
      if (document.hidden) lyricsTick();
    }, 250);
  } catch (e) {}

  // Initial triggers with individual error boundary protection
  try { updateTrackColors(); } catch (e) { console.warn("[AuraGlass] initial track colors note:", e); }
  try { updateCinemaState(); } catch (e) { console.warn("[AuraGlass] initial cinema state note:", e); }
  try { updateVinylState(); } catch (e) { console.warn("[AuraGlass] initial vinyl state note:", e); }

  console.log("[AuraGlass] Dynamic theme engine loaded successfully!");
}

initAuraGlass();
