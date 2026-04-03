/* ============================================ */
/* HUES OF SATURN — Main JavaScript             */
/* ============================================ */

(function() {
'use strict';

gsap.registerPlugin(ScrollTrigger);

// Force scroll to top on load
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ── Accessibility ──────────────────────────────
var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================
// STARS & SPARKLES
// ============================================
function createStars(container, count, tintBlue) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = tintBlue ? 'void-star' : 'star';
    const size = Math.random() * 2 + 1;
    star.style.cssText =
      'width:' + size + 'px;height:' + size + 'px;' +
      'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
      '--duration:' + (Math.random() * 3 + 2) + 's;' +
      '--delay:' + (Math.random() * 3) + 's;';
    container.appendChild(star);
  }
}

function createSparkles() {
  var container = document.getElementById('sparkles');
  var chars = ['+', '\u2726', '\u2727', '\u00B7'];
  for (let i = 0; i < 12; i++) {
    var s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.cssText =
      'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
      '--size:' + (Math.random() * 14 + 8) + 'px;' +
      '--duration:' + (Math.random() * 4 + 3) + 's;' +
      '--delay:' + (Math.random() * 4) + 's;';
    container.appendChild(s);
  }
}

// Hero stars
createStars(document.getElementById('stars'), 100, false);
createSparkles();

// (void stars removed — crack now uses light-through-wall approach)

// ============================================
// HERO — fade on scroll
// ============================================
gsap.to('#hero', {
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
  },
  opacity: 0,
  y: -80,
});

// ============================================
// RING IMAGE PREVIEW (hover overlay)
// ============================================
var ringPreview = document.createElement('div');
ringPreview.className = 'ring-preview';
ringPreview.innerHTML = '<img /><video muted loop playsinline style="display:none"></video>';
document.body.appendChild(ringPreview);

function showRingPreview(src, rect, isVideo) {
  var img = ringPreview.querySelector('img');
  var vid = ringPreview.querySelector('video');
  if (isVideo) {
    img.style.display = 'none';
    vid.style.display = 'block';
    vid.src = src;
    vid.play().catch(function() {});
  } else {
    vid.style.display = 'none';
    vid.pause();
    img.style.display = 'block';
    img.src = src;
  }
  // Position near the hovered image, centered
  var size = 200;
  var x = rect.left + rect.width / 2 - size / 2;
  var y = rect.top + rect.height / 2 - size / 2;
  // Keep on screen
  x = Math.max(10, Math.min(window.innerWidth - size - 10, x));
  y = Math.max(10, Math.min(window.innerHeight - size - 10, y));
  ringPreview.style.left = x + 'px';
  ringPreview.style.top = y + 'px';
  ringPreview.style.width = size + 'px';
  ringPreview.style.height = size + 'px';
  ringPreview.classList.add('visible');
}

function hideRingPreview() {
  ringPreview.classList.remove('visible');
}

// ============================================
// SATURN — Dual Inspiration Rings
// ============================================
function buildRing(images, backEl, frontEl, radius, sizeRange, speedRange) {
  if (!backEl || !frontEl || !images || images.length === 0) return;

  var goldenAngle = 137.508;
  var items = [];

  images.forEach(function(img, i) {
    var angle = (i * goldenAngle) % 360;
    var imgSize = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    var opacity = 0.7 + Math.random() * 0.3;

    var wrapper = document.createElement('div');
    wrapper.className = 'ring-image';
    wrapper.dataset.baseAngle = angle;
    wrapper.style.setProperty('--angle', angle);
    wrapper.style.setProperty('--radius', radius);
    wrapper.style.setProperty('--img-size', imgSize);
    wrapper.style.setProperty('--img-opacity', opacity);

    var mediaEl;
    if (img.isVideo) {
      mediaEl = document.createElement('video');
      mediaEl.src = img.src;
      mediaEl.muted = true;
      mediaEl.loop = true;
      mediaEl.playsInline = true;
      mediaEl.preload = 'none';
      mediaEl.setAttribute('playsinline', '');
      mediaEl.onerror = function() { wrapper.style.display = 'none'; };
      // Lazy-load: only play when visible
      var videoObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) { mediaEl.play().catch(function(){}); }
          else { mediaEl.pause(); }
        });
      });
      videoObs.observe(wrapper);
    } else {
      mediaEl = document.createElement('img');
      mediaEl.src = img.src;
      mediaEl.alt = img.alt || 'Inspiration';
      mediaEl.loading = 'lazy';
      mediaEl.decoding = 'async';
      mediaEl.onerror = function() { wrapper.style.display = 'none'; };
    }

    wrapper.appendChild(mediaEl);
    wrapper._hovered = false;
    wrapper._mediaEl = mediaEl;

    // Hover — show enlarged preview outside the 3D context
    wrapper.addEventListener('mouseenter', function() {
      wrapper._hovered = true;
      var rect = wrapper._mediaEl.getBoundingClientRect();
      showRingPreview(wrapper._mediaEl.src, rect, img.isVideo);
    });
    wrapper.addEventListener('mouseleave', function() {
      wrapper._hovered = false;
      hideRingPreview();
    });

    if (angle >= 0 && angle < 180) {
      backEl.appendChild(wrapper);
    } else {
      frontEl.appendChild(wrapper);
    }

    items.push({ wrapper: wrapper, baseAngle: angle });
  });

  // Single tween per ring — batch-update all items from shared phase
  if (prefersReducedMotion || items.length === 0) return;
  var ringPhase = { angle: 0 };
  var avgDuration = (speedRange[0] + speedRange[1]) / 2;
  gsap.to(ringPhase, {
    angle: 360,
    duration: avgDuration,
    repeat: -1,
    ease: 'none',
    onUpdate: function() {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.wrapper._hovered) continue;
        var current = (item.baseAngle + ringPhase.angle) % 360;
        item.wrapper.style.setProperty('--angle', current);
        var shouldBeBack = (current >= 0 && current < 180);
        var isInBack = item.wrapper.parentElement === backEl;
        if (shouldBeBack && !isInBack) {
          backEl.appendChild(item.wrapper);
        } else if (!shouldBeBack && isInBack) {
          frontEl.appendChild(item.wrapper);
        }
      }
    }
  });
}

// Load and build all three rings
ArenaLoader.getAllImages().then(function(data) {
  var containerW = document.getElementById('saturn').offsetWidth || 800;
  var MAX_PER_RING = 80;

  // Innermost ring — Your art + videos
  var artImages = GALLERY_ART.map(function(a) {
    return { src: a.src, alt: a.title, source: 'art' };
  });
  // Add BlobFX videos to the orbit
  var videoFiles = [
    { src: 'assets/art/blob-tracking-2026-03-19_131722.mp4', alt: 'Hues of Dispositions I', source: 'art', isVideo: true },
    { src: 'assets/art/blob-tracking-2026-03-19_175436.mp4', alt: 'Hues of Dispositions II', source: 'art', isVideo: true },
    { src: 'assets/art/blob-tracking-2026-03-23_172251.mp4', alt: 'Hues of Dispositions III', source: 'art', isVideo: true },
  ];
  artImages = artImages.concat(videoFiles);
  // Add Pinterest (@planetarydispositions) posts to the art ring
  if (data.pinterest && data.pinterest.length > 0) {
    artImages = artImages.concat(data.pinterest);
  }
  buildRing(
    artImages,
    document.getElementById('artRingBack'),
    document.getElementById('artRingFront'),
    containerW * 0.42,
    [40, 60],
    [50, 70]
  );

  // Middle ring — Are.na
  buildRing(
    data.arena.slice(0, MAX_PER_RING),
    document.getElementById('arenaRingBack'),
    document.getElementById('arenaRingFront'),
    containerW * 0.57,
    [28, 50],
    [60, 90]
  );

  // Outer ring — Cosmos
  buildRing(
    data.cosmos.slice(0, MAX_PER_RING),
    document.getElementById('cosmosRingBack'),
    document.getElementById('cosmosRingFront'),
    containerW * 0.72,
    [38, 68],
    [110, 160]
  );

  // Check if all rings are empty (resolved but no data)
  var totalImages = (data.arena || []).length + (data.cosmos || []).length + (data.pinterest || []).length;
  if (totalImages === 0) {
    var saturn = document.getElementById('saturn');
    if (saturn) saturn.classList.add('rings-failed');
  }
}).catch(function(err) {
  console.warn('[Rings] Failed to load inspiration data:', err);
  var saturn = document.getElementById('saturn');
  if (saturn) saturn.classList.add('rings-failed');
});

// B9: Recompute ring radii on container resize
var RING_RADIUS_MULTIPLIERS = { 'ring-art': 0.42, 'ring-arena': 0.57, 'ring-cosmos': 0.72 };
var saturnEl = document.getElementById('saturn');
if (saturnEl && typeof ResizeObserver !== 'undefined') {
  var ringResizeObs = new ResizeObserver(function(entries) {
    var newW = entries[0].contentRect.width || 800;
    Object.keys(RING_RADIUS_MULTIPLIERS).forEach(function(ringClass) {
      var r = newW * RING_RADIUS_MULTIPLIERS[ringClass];
      document.querySelectorAll('.' + ringClass + ' .ring-image').forEach(function(el) {
        el.style.setProperty('--radius', r);
      });
    });
  });
  ringResizeObs.observe(saturnEl);
}

// ============================================
// SECTION 2: ELEVATOR DOORS
// ============================================
var elevatorSection = document.getElementById('elevator-section');
var behindContent = document.querySelector('.behind-content');
var activeFloor = null;

var behindText = document.getElementById('behindText');
var behindGallery = document.getElementById('behindGallery');
var behindAbout = document.getElementById('behindAbout');
var behindConnect = document.getElementById('behindConnect');
var floorIndicator = document.querySelector('.indicator-floor');

var floorLabels = {
  gallery: '1', hod: '2', about: '3', contact: '4', help: '?'
};

// Floor order for counter ticking (lobby=0)
var floorOrder = ['★', '1', '2', '3', '4'];
var floorToIndex = { gallery: 1, hod: 2, about: 3, contact: 4, help: 4 };
var currentFloorIndex = 0;
var traveling = false;

var floorContent = {
  hod: { title: 'HUES OF DISPOSITIONS', subtitle: 'thoughts pending...' },
  about: { title: 'ABOUT', subtitle: 'more soon' },
  contact: { title: 'LET\'S CONNECT', subtitle: 'nicole@huesofsaturn.com' },
  help: { title: '?', subtitle: 'you\'re doing great' },
};

var indicatorArrow = document.getElementById('indicatorArrow');

// (Sound effects removed)

// ── Travel sequence ──────────────────────────
function setFloorContent(floor) {
  // Hide all floor-specific content first
  behindGallery.classList.remove('active');
  behindAbout.classList.remove('active');
  behindConnect.classList.remove('active');
  aboutActive = false;
  connectActive = false;
  behindText.style.display = 'none';

  if (floor === 'gallery') {
    behindGallery.classList.add('active');
  } else if (floor === 'about') {
    behindAbout.classList.add('active');
    aboutActive = true;
  } else if (floor === 'contact') {
    behindConnect.classList.add('active');
    connectActive = true;
  } else {
    behindText.style.display = '';
    var content = floorContent[floor];
    if (content) {
      behindText.querySelector('.behind-title').textContent = content.title;
      behindText.querySelector('.behind-subtitle').textContent = content.subtitle;
    }
  }
}

function travelToFloor(floor, callback) {
  var targetIndex = floorToIndex[floor] || 0;
  var direction = targetIndex > currentFloorIndex ? 1 : -1;
  var floorsToTravel = Math.abs(targetIndex - currentFloorIndex);
  if (floorsToTravel === 0) { callback(); return; }

  var travelTime = floorsToTravel * 0.7; // 0.7s per floor

  // Set arrow direction
  indicatorArrow.className = 'indicator-arrow' + (direction > 0 ? '' : ' arrow-down');

  // Start shake
  elevatorSection.classList.add('traveling');

  // Tick through floors
  var step = 0;
  var tickInterval = setInterval(function() {
    step++;
    currentFloorIndex += direction;
    floorIndicator.textContent = floorOrder[currentFloorIndex] || '?';

    if (step >= floorsToTravel) {
      clearInterval(tickInterval);

      // Arrive — stop shake, ding, open
      setTimeout(function() {
        elevatorSection.classList.remove('traveling');
        indicatorArrow.className = 'indicator-arrow';
        callback();
      }, 300);
    }
  }, 700);
}

function pressFloor(floor) {
  if (traveling) return;
  var allBtns = document.querySelectorAll('.floor-btn');

  if (floor === 'close') { closeDoors(); return; }
  if (floor === 'open' && activeFloor) {
    elevatorSection.classList.add('doors-open');
    return;
  }
  if (activeFloor === floor) { closeDoors(); return; }

  traveling = true;

  // Light up button
  allBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  var btn = document.querySelector('[data-floor="' + floor + '"]');
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }

  // Prepare content behind doors
  setFloorContent(floor);

  // If doors are open, close first then travel
  if (elevatorSection.classList.contains('doors-open')) {
    elevatorSection.classList.remove('doors-open');
    setTimeout(function() {
      travelToFloor(floor, function() {
        elevatorSection.classList.add('doors-open');
        activeFloor = floor;
        traveling = false;
      });
    }, 1600); // wait for 1.5s door close animation
  } else {
    // Doors already closed — travel then open
    travelToFloor(floor, function() {
      elevatorSection.classList.add('doors-open');
      activeFloor = floor;
      traveling = false;
    });
  }
}

function closeDoors() {
  if (traveling) return;
  elevatorSection.classList.remove('doors-open');
  document.querySelectorAll('.floor-btn').forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  behindGallery.classList.remove('active');
  behindAbout.classList.remove('active');
  behindConnect.classList.remove('active');
  aboutActive = false;
  connectActive = false;
  behindText.style.display = '';
  // Reset gallery walk position
  walkZ = 0;
  if (hallwayInner) hallwayInner.style.transform = 'translateZ(0px)';
  activeFloor = null;
  // Travel back to lobby after doors close (1.5s CSS animation)
  if (currentFloorIndex !== 0) {
    traveling = true;
    indicatorArrow.className = 'indicator-arrow arrow-down';
    setTimeout(function() {
      var goLobby = setInterval(function() {
        if (currentFloorIndex > 0) {
          currentFloorIndex--;
          floorIndicator.textContent = floorOrder[currentFloorIndex] || '★';
        }
        if (currentFloorIndex <= 0) {
          clearInterval(goLobby);
          currentFloorIndex = 0;
          floorIndicator.textContent = '★';
          indicatorArrow.className = 'indicator-arrow';
          traveling = false;
        }
      }, 500);
    }, 1600); // wait for 1.5s door close animation to finish
  }
}

// Button click handlers (door panel — all button types)
document.querySelectorAll('.floor-btn, .door-btn, .alarm-btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var floor = btn.dataset.floor;
    if (floor) pressFloor(floor);
  });
});

// ── Floating elevator nav ────────────────────
var elevatorNav = document.getElementById('elevatorNav');

// Show nav after scrolling past the hero
ScrollTrigger.create({
  trigger: '#elevator-section',
  start: 'top 90%',
  onEnter: function() { elevatorNav.classList.add('visible'); },
  onLeaveBack: function() { elevatorNav.classList.remove('visible'); },
});

// Nav button clicks
document.querySelectorAll('.nav-floor-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var target = btn.dataset.nav;

    // Update active state
    document.querySelectorAll('.nav-floor-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    if (target === 'hero') {
      gsap.to(window, { scrollTo: 0, duration: 1, ease: 'power2.inOut' });
    } else {
      // All floors go through the elevator
      gsap.to(window, {
        scrollTo: '#elevator-section',
        duration: 1,
        ease: 'power2.inOut',
        onComplete: function() { pressFloor(target); }
      });
    }
  });
});

// ============================================
// GALLERY (inside elevator — walk-through hallway)
// ============================================
var hallwayInner = document.getElementById('hallwayInner');
var galleryHallway = document.getElementById('galleryHallway');
var walkZ = 0;
var maxWalkZ = 0;

function buildGalleryFrames() {
  if (!hallwayInner) return;

  // Depth spacing per position level
  var depthStep = 1200;
  var maxPos = 0;
  GALLERY_ART.forEach(function(a) { if (a.position > maxPos) maxPos = a.position; });
  maxWalkZ = maxPos * depthStep + 400;

  GALLERY_ART.forEach(function(art, index) {
    var frame = document.createElement('div');
    frame.className = 'art-frame';
    frame.dataset.art = index;
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', 'View ' + art.title);

    // Frame size
    var w = 240;
    var h = 300;

    frame.innerHTML =
      '<div class="frame-border" style="width:' + w + 'px;height:' + h + 'px">' +
        '<img class="art-media" src="' + art.src + '" alt="' + art.title + '" loading="lazy" />' +
      '</div>' +
      '<div class="art-label">' + art.title + '</div>';

    // Position in 3D space — flush against walls
    // Start art 600px into the hallway so you see some empty corridor first
    var z = -600 - (art.position * depthStep);
    var xOffset = art.wall === 'left' ? -480 : 480;
    var rotY = art.wall === 'left' ? 72 : -72;
    var yOffset = -20;

    frame.style.top = '50%';
    frame.style.left = '50%';
    frame.style.transform =
      'translate(-50%, -50%) ' +
      'translateX(' + xOffset + 'px) ' +
      'translateY(' + yOffset + 'px) ' +
      'translateZ(' + z + 'px) ' +
      'rotateY(' + rotY + 'deg) ' +
      'rotateX(-2deg)';

    hallwayInner.appendChild(frame);
  });
}

buildGalleryFrames();

// Scroll wheel → walk through the hallway (translateZ)
if (galleryHallway) {
  galleryHallway.addEventListener('wheel', function(e) {
    if (!behindGallery.classList.contains('active')) return;
    e.preventDefault();

    walkZ = Math.max(0, Math.min(maxWalkZ, walkZ + e.deltaY * 1.5));
    hallwayInner.style.transform = 'translateZ(' + walkZ + 'px)';

    // Hide hint after walking
    var hint = galleryHallway.querySelector('.gallery-scroll-hint');
    if (hint && walkZ > 30) hint.style.opacity = '0';
  }, { passive: false });

  // Touch support for gallery walk-through
  var touchStartY = 0;
  var touchWalkZ = 0;
  var touchMoved = false;
  galleryHallway.addEventListener('touchstart', function(e) {
    if (!behindGallery.classList.contains('active')) return;
    touchStartY = e.touches[0].clientY;
    touchWalkZ = walkZ;
    touchMoved = false;
  }, { passive: true });

  galleryHallway.addEventListener('touchmove', function(e) {
    if (!behindGallery.classList.contains('active')) return;
    var deltaY = touchStartY - e.touches[0].clientY;
    if (Math.abs(deltaY) > 10) touchMoved = true;
    if (!touchMoved) return;
    e.preventDefault();
    walkZ = Math.max(0, Math.min(maxWalkZ, touchWalkZ + deltaY * 2));
    hallwayInner.style.transform = 'translateZ(' + walkZ + 'px)';
    var hint = galleryHallway.querySelector('.gallery-scroll-hint');
    if (hint && walkZ > 30) hint.style.opacity = '0';
  }, { passive: false });
}

// Keyboard activation for gallery art frames
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    var frame = e.target.closest('.art-frame');
    if (frame) {
      e.preventDefault();
      openArtViewer(parseInt(frame.dataset.art));
    }
  }
});

// ── Art Viewer ───────────────────────────────
var artViewer = document.getElementById('artViewer');
var artViewerMedia = document.getElementById('artViewerMedia');
var artViewerInfo = document.getElementById('artViewerInfo');

var _artViewerPrevFocus = null;

function openArtViewer(index) {
  var data = GALLERY_ART[index];
  if (!data) return;
  _artViewerPrevFocus = document.activeElement;
  artViewerMedia.innerHTML = '<img src="' + data.src + '" alt="' + data.title + '" />';
  artViewerInfo.querySelector('.viewer-title').textContent = data.title;
  artViewerInfo.querySelector('.viewer-medium').textContent =
    [data.medium, data.year].filter(Boolean).join(' \u2014 ');
  artViewerInfo.querySelector('.viewer-description').textContent = data.description || '';
  artViewer.classList.add('active');
  // Move focus to close button
  var closeBtn = artViewer.querySelector('.art-viewer-close');
  if (closeBtn) closeBtn.focus();
}

function closeArtViewer() {
  artViewer.classList.remove('active');
  // Return focus to triggering element
  if (_artViewerPrevFocus) { _artViewerPrevFocus.focus(); _artViewerPrevFocus = null; }
}

document.addEventListener('click', function(e) {
  var frame = e.target.closest('.art-frame');
  if (frame) { openArtViewer(parseInt(frame.dataset.art)); return; }
  if (e.target.closest('.art-viewer-backdrop') || e.target.closest('.art-viewer-close')) closeArtViewer();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeArtViewer();
});

// Focus trap for art viewer dialog
if (artViewer) {
  artViewer.addEventListener('keydown', function(e) {
    if (!artViewer.classList.contains('active')) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      var closeBtn = artViewer.querySelector('.art-viewer-close');
      if (closeBtn) closeBtn.focus();
    }
  });
}

// ============================================
// ABOUT — Pretext-style floating orbs + text parting
// ============================================
var aboutText = document.getElementById('aboutText');
var connectText = document.getElementById('connectText');
var aboutWords = [];
var connectWords = [];
var aboutActive = false;
var connectActive = false;

var ABOUT_COPY = [
  'I make things because the alternative is just watching.',
  '',
  'my work lives in the ether.. between what i feel and what i can touch.. paint, clay, wood, trash, code, sound, whatever\'s in reach. every medium is fair game. every emotion is material.',
  '',
  'i don\'t believe art owes anyone an explanation. it\'s subjective, it\'s supposed to be. i\'d rather you feel something than understand something.',
  '',
  'hues of saturn is the universe i build from. the art, the tools, the experiments, all of it comes from the same place: curiosity about the tangible world, filtered through every feeling i can\'t name.',
  '',
  'curiosity killed the cat.. yet satisfaction brought it back',
  '',
  'so i welcome you to my universe',
  '',
  'if you must think of me, think of me as the moon, constantly changing yet always remaining the same.',
];

var CONNECT_COPY = [
  'i\'m always open to collaboration, conversation, or just hearing what moved you. whether it\'s about the art, the tools, or something entirely unrelated.. reach out.',
  '',
  'the best things happen when curious people find each other.',
];

function buildFloorWords(container, copy) {
  if (!container) return [];
  container.innerHTML = '';
  var words = [];

  copy.forEach(function(line) {
    if (line === '') {
      container.appendChild(document.createElement('br'));
      return;
    }
    var parts = line.split(' ');
    parts.forEach(function(word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      container.appendChild(span);
      words.push(span);
      if (i < parts.length - 1) {
        container.appendChild(document.createTextNode(' '));
      }
    });
    container.appendChild(document.createTextNode(' '));
  });

  return words;
}

aboutWords = buildFloorWords(aboutText, ABOUT_COPY);
connectWords = buildFloorWords(connectText, CONNECT_COPY);

// ── Orb physics system (Pretext-inspired) ──
var ORB_DEFS = [
  { name: 'sun',    radius: 75,  vx:  0.35, vy:  0.25, startX: 0.55, startY: 0.30 },
  { name: 'saturn', radius: 65,  vx: -0.30, vy:  0.40, startX: 0.25, startY: 0.55 },
  { name: 'coral',  radius: 55,  vx:  0.28, vy: -0.35, startX: 0.70, startY: 0.65 },
  { name: 'teal',   radius: 60,  vx: -0.22, vy: -0.28, startX: 0.40, startY: 0.75 },
];
var MOON_RADIUS = 50;
var MIN_ORB_GAP = 20;

var aboutOrbs = [];
var moonEl = behindAbout ? behindAbout.querySelector('.orb-moon') : null;
var aboutMouseX = -9999, aboutMouseY = -9999;
var aboutOrbRAF = null;

// Initialize orbs
if (behindAbout) {
  ORB_DEFS.forEach(function(def) {
    var el = behindAbout.querySelector('.orb-' + def.name);
    if (!el) return;
    var pw = behindAbout.offsetWidth || 800;
    var ph = behindAbout.offsetHeight || 600;
    var orb = {
      el: el,
      name: def.name,
      radius: def.radius,
      x: def.startX * pw,
      y: def.startY * ph,
      vx: def.vx,
      vy: def.vy,
      dragging: false,
      dragOffX: 0,
      dragOffY: 0,
    };
    el.style.left = orb.x + 'px';
    el.style.top = orb.y + 'px';

    // Drag handlers
    el.addEventListener('pointerdown', function(e) {
      orb.dragging = true;
      el.classList.add('dragging');
      var rect = el.getBoundingClientRect();
      orb.dragOffX = e.clientX - rect.left - rect.width / 2;
      orb.dragOffY = e.clientY - rect.top - rect.height / 2;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener('pointermove', function(e) {
      if (!orb.dragging) return;
      var pr = behindAbout.getBoundingClientRect();
      orb.x = e.clientX - pr.left - orb.dragOffX - el.offsetWidth / 2;
      orb.y = e.clientY - pr.top - orb.dragOffY - el.offsetHeight / 2;
      el.style.left = orb.x + 'px';
      el.style.top = orb.y + 'px';
    });

    el.addEventListener('pointerup', function() {
      orb.dragging = false;
      el.classList.remove('dragging');
      orb.vx = (Math.random() - 0.5) * 0.7;
      orb.vy = (Math.random() - 0.5) * 0.7;
    });

    aboutOrbs.push(orb);
  });

  // Mouse tracking — move moon orb to cursor
  behindAbout.addEventListener('mousemove', function(e) {
    aboutMouseX = e.clientX;
    aboutMouseY = e.clientY;
    if (moonEl) {
      var pr = behindAbout.getBoundingClientRect();
      moonEl.style.left = (e.clientX - pr.left - moonEl.offsetWidth / 2) + 'px';
      moonEl.style.top = (e.clientY - pr.top - moonEl.offsetHeight / 2) + 'px';
    }
    var hint = behindAbout.querySelector('.about-hint');
    if (hint) hint.style.opacity = '0';
  });

  behindAbout.addEventListener('mouseleave', function() {
    aboutMouseX = -9999;
    aboutMouseY = -9999;
  });
}

// Physics + text displacement loop (runs continuously when about is active)
function orbPhysicsLoop() {
  aboutOrbRAF = requestAnimationFrame(orbPhysicsLoop);
  if (!aboutActive) return;

  var pw = behindAbout.offsetWidth;
  var ph = behindAbout.offsetHeight;

  // Move orbs
  for (var i = 0; i < aboutOrbs.length; i++) {
    var orb = aboutOrbs[i];
    if (orb.dragging) continue;

    orb.x += orb.vx;
    orb.y += orb.vy;

    // Bounce off walls
    var ew = orb.el.offsetWidth;
    var eh = orb.el.offsetHeight;
    if (orb.x <= 0) { orb.vx = Math.abs(orb.vx); orb.x = 0; }
    if (orb.x >= pw - ew) { orb.vx = -Math.abs(orb.vx); orb.x = pw - ew; }
    if (orb.y <= 0) { orb.vy = Math.abs(orb.vy); orb.y = 0; }
    if (orb.y >= ph - eh) { orb.vy = -Math.abs(orb.vy); orb.y = ph - eh; }

    orb.el.style.left = orb.x + 'px';
    orb.el.style.top = orb.y + 'px';
  }

  // Orb-orb collision avoidance
  for (var a = 0; a < aboutOrbs.length; a++) {
    for (var b = a + 1; b < aboutOrbs.length; b++) {
      var oa = aboutOrbs[a], ob = aboutOrbs[b];
      var acx = oa.x + oa.el.offsetWidth / 2;
      var acy = oa.y + oa.el.offsetHeight / 2;
      var bcx = ob.x + ob.el.offsetWidth / 2;
      var bcy = ob.y + ob.el.offsetHeight / 2;
      var dx = bcx - acx, dy = bcy - acy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var minDist = oa.radius + ob.radius + MIN_ORB_GAP;
      if (dist < minDist && dist > 0) {
        var nx = dx / dist, ny = dy / dist;
        var overlap = (minDist - dist) / 2;
        if (!oa.dragging) { oa.x -= nx * overlap; oa.y -= ny * overlap; }
        if (!ob.dragging) { ob.x += nx * overlap; ob.y += ny * overlap; }
        // Deflect velocities
        if (!oa.dragging) { oa.vx -= nx * 0.05; oa.vy -= ny * 0.05; }
        if (!ob.dragging) { ob.vx += nx * 0.05; ob.vy += ny * 0.05; }
      }
    }
  }

  // Text displacement from all orbs + moon cursor
  var pr = behindAbout.getBoundingClientRect();
  var orbCenters = [];

  for (var k = 0; k < aboutOrbs.length; k++) {
    var o = aboutOrbs[k];
    orbCenters.push({
      cx: pr.left + o.x + o.el.offsetWidth / 2,
      cy: pr.top + o.y + o.el.offsetHeight / 2,
      r: o.radius + 30,
    });
  }
  // Moon (cursor) orb
  if (aboutMouseX > -9999) {
    orbCenters.push({ cx: aboutMouseX, cy: aboutMouseY, r: MOON_RADIUS + 25 });
  }

  displaceWords(aboutWords, orbCenters);
}
orbPhysicsLoop();

function displaceWords(words, centers) {
  for (var i = 0; i < words.length; i++) {
    var span = words[i];
    var rect = span.getBoundingClientRect();
    var wcx = rect.left + rect.width / 2;
    var wcy = rect.top + rect.height / 2;
    var totalTX = 0, totalTY = 0, minOpacity = 1;

    for (var j = 0; j < centers.length; j++) {
      var c = centers[j];
      var dx = wcx - c.cx, dy = wcy - c.cy;
      var dist2 = dx * dx + dy * dy;
      var r2 = c.r * c.r;
      if (dist2 < r2) {
        var dist = Math.sqrt(dist2) || 1;
        var force = 1 - dist / c.r;
        force = force * force * force;
        var pushDist = force * 80;
        totalTX += (dx / dist) * pushDist;
        totalTY += (dy / dist) * pushDist;
        minOpacity = Math.min(minOpacity, 0.2 + (1 - force) * 0.8);
      }
    }

    if (totalTX !== 0 || totalTY !== 0) {
      span.style.transform = 'translate(' + totalTX.toFixed(1) + 'px,' + totalTY.toFixed(1) + 'px)';
      span.style.opacity = minOpacity.toFixed(2);
    } else {
      if (span.style.transform) span.style.transform = '';
      if (span.style.opacity) span.style.opacity = '';
    }
  }
}

// ── Connect page: simpler — cursor only displacement ──
var connectMouseX = -9999, connectMouseY = -9999;
if (behindConnect) {
  behindConnect.addEventListener('mousemove', function(e) {
    connectMouseX = e.clientX;
    connectMouseY = e.clientY;
    var hint = behindConnect.querySelector('.about-hint');
    if (hint) hint.style.opacity = '0';
  });
  behindConnect.addEventListener('mouseleave', function() {
    connectMouseX = -9999;
    connectMouseY = -9999;
    connectWords.forEach(function(s) { s.style.transform = ''; s.style.opacity = ''; });
  });
}

function connectLoop() {
  requestAnimationFrame(connectLoop);
  if (!connectActive) return;
  if (connectMouseX < -9000) return;
  displaceWords(connectWords, [{ cx: connectMouseX, cy: connectMouseY, r: 80 }]);
}
connectLoop();

// ============================================
// PAGE LOAD ANIMATION
// ============================================
if (prefersReducedMotion) {
  // Show everything instantly — no animations
  gsap.set('.saturn-container', { scale: 1, opacity: 1 });
  gsap.set('.title-main', { y: 0, opacity: 1 });
  gsap.set('.scroll-hint', { opacity: 0.5 });
} else {
  gsap.set('.saturn-container', { scale: 0.8, opacity: 0 });
  gsap.set('.title-main', { y: 40, opacity: 0 });
  gsap.set('.scroll-hint', { opacity: 0 });

  var loadTl = gsap.timeline({ delay: 0.3 });
  loadTl
    .to('.saturn-container', { scale: 1, opacity: 1, duration: 1.5, ease: 'power3.out' })
    .to('.title-main', { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: 'power3.out' }, '-=1')
    .to('.scroll-hint', { opacity: 0.5, duration: 1 }, '-=0.3');
}

})();
