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

// ── Utility ──────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

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
      mediaEl.autoplay = true;
      mediaEl.setAttribute('playsinline', '');
      mediaEl.onerror = function() { wrapper.style.display = 'none'; };
    } else {
      mediaEl = document.createElement('img');
      mediaEl.src = img.src;
      mediaEl.alt = img.alt || 'Inspiration';
      mediaEl.loading = 'lazy';
      mediaEl.decoding = 'async';
      mediaEl.onerror = function() { wrapper.style.display = 'none'; };
    }

    wrapper.appendChild(mediaEl);
    var imgEl = mediaEl; // for hover preview compatibility

    // Hover — show enlarged preview outside the 3D context
    var hovered = false;
    wrapper.addEventListener('mouseenter', function() {
      hovered = true;
      if (tween) tween.pause();
      var rect = imgEl.getBoundingClientRect();
      showRingPreview(imgEl.src, rect, img.isVideo);
    });
    wrapper.addEventListener('mouseleave', function() {
      hovered = false;
      if (tween) tween.resume();
      hideRingPreview();
    });

    if (angle >= 0 && angle < 180) {
      backEl.appendChild(wrapper);
    } else {
      frontEl.appendChild(wrapper);
    }

    // Animate orbit
    var tween = gsap.to(wrapper, {
      '--angle': angle + 360,
      duration: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
      repeat: -1,
      ease: 'none',
      onUpdate: function() {
        if (hovered) return; // don't swap containers while hovered
        var current = parseFloat(wrapper.style.getPropertyValue('--angle')) % 360;
        if (current < 0) current += 360;
        var shouldBeBack = (current >= 0 && current < 180);
        var isInBack = wrapper.parentElement === backEl;
        if (shouldBeBack && !isInBack) {
          backEl.appendChild(wrapper);
        } else if (!shouldBeBack && isInBack) {
          frontEl.appendChild(wrapper);
        }
      }
    });
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
}).catch(function() {});

// ============================================
// SECTION 2: ELEVATOR DOORS
// ============================================
var elevatorSection = document.getElementById('elevator-section');
var behindContent = document.querySelector('.behind-content');
var activeFloor = null;

var behindText = document.getElementById('behindText');
var behindGallery = document.getElementById('behindGallery');
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
  if (floor === 'gallery') {
    behindText.style.display = 'none';
    behindGallery.classList.add('active');
  } else {
    behindGallery.classList.remove('active');
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
  allBtns.forEach(function(b) { b.classList.remove('active'); });
  var btn = document.querySelector('[data-floor="' + floor + '"]');
  if (btn) btn.classList.add('active');

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
  elevatorSection.classList.remove('doors-open');
  document.querySelectorAll('.floor-btn').forEach(function(b) { b.classList.remove('active'); });
  behindGallery.classList.remove('active');
  behindText.style.display = '';
  // Travel back to lobby
  if (currentFloorIndex !== 0) {
    traveling = true;
    setTimeout(function() {
      travelToFloor({ gallery: 'gallery' }, function() { traveling = false; });
      // Reset to lobby
      var goLobby = setInterval(function() {
        if (currentFloorIndex > 0) {
          currentFloorIndex--;
          floorIndicator.textContent = floorOrder[currentFloorIndex];
        } else {
          clearInterval(goLobby);
          traveling = false;
        }
      }, 500);
    }, 800);
  }
  floorIndicator.textContent = '★';
  currentFloorIndex = 0;
  activeFloor = null;
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
var navTargets = {
  hero: '#hero',
  gallery: '#gallery-section',
  hod: null,      // stays at elevator, opens doors
  about: null,
  contact: null,
};

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

function buildGalleryFrames() {
  if (!hallwayInner) return;

  GALLERY_ART.forEach(function(art, index) {
    var frame = document.createElement('div');
    frame.className = 'art-frame';
    frame.dataset.art = index;
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', 'View ' + art.title);

    frame.innerHTML =
      '<div class="frame-border">' +
        '<img class="art-media" src="' + art.src + '" alt="' + art.title + '" loading="lazy" />' +
      '</div>' +
      '<div class="art-label">' + art.title + '</div>';

    hallwayInner.appendChild(frame);
  });
}

buildGalleryFrames();

// Scroll wheel → horizontal scroll (walking through the hallway)
if (galleryHallway) {
  galleryHallway.addEventListener('wheel', function(e) {
    if (!behindGallery.classList.contains('active')) return;
    e.preventDefault();
    hallwayInner.scrollLeft += e.deltaY;

    // Hide hint after scrolling
    var hint = galleryHallway.querySelector('.gallery-scroll-hint');
    if (hint && hallwayInner.scrollLeft > 30) hint.style.opacity = '0';
  }, { passive: false });
}

// ── Art Viewer ───────────────────────────────
var artViewer = document.getElementById('artViewer');
var artViewerMedia = document.getElementById('artViewerMedia');
var artViewerInfo = document.getElementById('artViewerInfo');

function openArtViewer(index) {
  var data = GALLERY_ART[index];
  if (!data) return;
  artViewerMedia.innerHTML = '<img src="' + data.src + '" alt="' + data.title + '" />';
  artViewerInfo.querySelector('.viewer-title').textContent = data.title;
  artViewerInfo.querySelector('.viewer-medium').textContent =
    [data.medium, data.year].filter(Boolean).join(' \u2014 ');
  artViewerInfo.querySelector('.viewer-description').textContent = data.description || '';
  artViewer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeArtViewer() {
  artViewer.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('click', function(e) {
  var frame = e.target.closest('.art-frame');
  if (frame) { openArtViewer(parseInt(frame.dataset.art)); return; }
  if (e.target.closest('.art-viewer-backdrop') || e.target.closest('.art-viewer-close')) closeArtViewer();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeArtViewer();
});

// ============================================
// PAGE LOAD ANIMATION
// ============================================
gsap.set('.saturn-container', { scale: 0.8, opacity: 0 });
gsap.set('.title-main', { y: 40, opacity: 0 });
gsap.set('.scroll-hint', { opacity: 0 });

var loadTl = gsap.timeline({ delay: 0.3 });
loadTl
  .to('.saturn-container', { scale: 1, opacity: 1, duration: 1.5, ease: 'power3.out' })
  .to('.title-main', { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: 'power3.out' }, '-=1')
  .to('.scroll-hint', { opacity: 0.5, duration: 1 }, '-=0.3');

})();
