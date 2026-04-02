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

// Void stars (behind the crack)
var voidStarsEl = document.getElementById('voidStars');
if (voidStarsEl) createStars(voidStarsEl, 60, true);

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
ringPreview.innerHTML = '<img />';
document.body.appendChild(ringPreview);

function showRingPreview(src, rect) {
  var img = ringPreview.querySelector('img');
  img.src = src;
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

    var imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = img.alt || 'Inspiration';
    imgEl.loading = 'lazy';
    imgEl.decoding = 'async';
    imgEl.onerror = function() { wrapper.style.display = 'none'; };

    wrapper.appendChild(imgEl);

    // Hover — show enlarged preview outside the 3D context
    var hovered = false;
    wrapper.addEventListener('mouseenter', function() {
      hovered = true;
      if (tween) tween.pause();
      var rect = imgEl.getBoundingClientRect();
      showRingPreview(imgEl.src, rect);
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

// Load and build both rings
ArenaLoader.getAllImages().then(function(data) {
  var containerW = document.getElementById('saturn').offsetWidth || 800;
  var MAX_PER_RING = 80;

  // Inner ring — Are.na (closer to outer, smaller thumbnails, faster)
  buildRing(
    data.arena.slice(0, MAX_PER_RING),
    document.getElementById('arenaRingBack'),
    document.getElementById('arenaRingFront'),
    containerW * 0.55,    // inner radius — close to cosmos
    [28, 50],             // slightly smaller thumbnails
    [60, 90]              // faster orbit
  );

  // Outer ring — Cosmos (just outside arena, larger thumbnails, slower)
  buildRing(
    data.cosmos.slice(0, MAX_PER_RING),
    document.getElementById('cosmosRingBack'),
    document.getElementById('cosmosRingFront'),
    containerW * 0.70,    // outer radius
    [38, 68],             // larger thumbnails
    [110, 160]            // slower orbit
  );
}).catch(function() {});

// ============================================
// SECTION 2: THE CRACK
// ============================================
// Jagged crack points — wider amplitude than before
var crackPoints = [
  [0, 520],
  [80, 410],
  [140, 590],
  [250, 370],
  [340, 570],
  [430, 340],
  [520, 540],
  [640, 310],
  [720, 560],
  [850, 330],
  [960, 550],
  [1080, 300],
  [1180, 570],
  [1320, 320],
  [1440, 580],
  [1580, 340],
  [1700, 550],
  [1820, 370],
  [1920, 510],
];

// Branch crack — forks off at point index 7 (x=640)
var branchPoints = [
  [640, 310],
  [700, 240],
  [750, 280],
  [810, 200],
  [860, 250],
];

function buildPath(points, progress) {
  var total = points.length;
  var active = Math.max(2, Math.ceil(total * progress));
  var d = 'M' + points[0][0] + ',' + points[0][1];
  for (var i = 1; i < active; i++) {
    d += ' L' + points[i][0] + ',' + points[i][1];
  }
  return d;
}

function buildCrackClipPath(progress) {
  if (progress <= 0) return 'polygon(0 50%, 100% 50%, 100% 50%, 0 50%)';

  var height = progress * 50; // max 50% open
  var top = 50 - height / 2;
  var bottom = 50 + height / 2;

  var steps = 14;
  var topLine = '';
  var bottomLine = '';

  for (var i = 0; i <= steps; i++) {
    var t = i / steps;
    var x = t * 100;
    var jT = Math.sin(t * Math.PI * 5) * (height * 0.12);
    var jB = Math.sin(t * Math.PI * 4 + 2) * (height * 0.12);
    topLine += x + '% ' + (top + jT) + '%, ';
    bottomLine = x + '% ' + (bottom + jB) + '%, ' + bottomLine;
  }

  return 'polygon(' + topLine + bottomLine.slice(0, -2) + ')';
}

// Crack scroll animation
var crackTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#crack-section',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.5,
    onUpdate: function(self) {
      var p = self.progress;
      var mainPath = buildPath(crackPoints, p);
      document.getElementById('crackGlow').setAttribute('d', mainPath);
      document.getElementById('crackLine').setAttribute('d', mainPath);

      // Branch appears after 30% progress
      if (p > 0.3) {
        var branchP = Math.min(1, (p - 0.3) / 0.5);
        var bp = buildPath(branchPoints, branchP);
        document.getElementById('branchGlow').setAttribute('d', bp);
        document.getElementById('branchLine').setAttribute('d', bp);
      }

      document.getElementById('crackReveals').style.clipPath = buildCrackClipPath(p);
    }
  }
});

crackTl
  .to('.surface-label', { opacity: 0, duration: 0.1 }, 0)
  .to('.crack-glow', { opacity: 0.6, duration: 0.3 }, 0.05)
  .to('.crack-line', { opacity: 1, duration: 0.2 }, 0.05)
  .to('.branch-glow', { opacity: 0.4, duration: 0.3 }, 0.3)
  .to('.branch-line', { opacity: 0.7, duration: 0.3 }, 0.3)
  .to('.crack-glow', { opacity: 0.9, duration: 0.5 }, 0.3);

// ============================================
// SECTION 3: GALLERY
// ============================================

// Build frames dynamically from GALLERY_ART
function buildGalleryFrames() {
  var leftWall = document.getElementById('wallLeft');
  var rightWall = document.getElementById('wallRight');
  if (!leftWall || !rightWall) return;

  GALLERY_ART.forEach(function(art, index) {
    var frame = document.createElement('div');
    frame.className = 'art-frame';
    frame.dataset.art = index;
    frame.dataset.type = art.type;
    frame.dataset.wall = art.wall;
    frame.dataset.position = art.position;
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', 'View ' + art.title);

    var inner;
    if (art.type === 'video') {
      inner =
        '<div class="frame-border">' +
          '<video class="art-media" src="' + art.src + '"' +
          (art.poster ? ' poster="' + art.poster + '"' : '') +
          ' muted loop playsinline preload="metadata"></video>' +
          '<div class="video-indicator">&#9654;</div>' +
        '</div>' +
        '<div class="art-label">' + art.title + '</div>';
    } else {
      inner =
        '<div class="frame-border">' +
          '<img class="art-media" src="' + art.src + '" alt="' + art.title + '" loading="lazy" />' +
        '</div>' +
        '<div class="art-label">' + art.title + '</div>';
    }
    frame.innerHTML = inner;

    if (art.wall === 'right') {
      rightWall.appendChild(frame);
    } else {
      leftWall.appendChild(frame);
    }
  });
}

buildGalleryFrames();

// Position frames in perspective
function positionArtFrames() {
  var vw = window.innerWidth;
  var vh = window.innerHeight;

  var leftFrames = Array.from(document.querySelectorAll('#wallLeft .art-frame'));
  var rightFrames = Array.from(document.querySelectorAll('#wallRight .art-frame'));

  // Sort by position
  leftFrames.sort(function(a, b) { return a.dataset.position - b.dataset.position; });
  rightFrames.sort(function(a, b) { return a.dataset.position - b.dataset.position; });

  function positionWall(frames, side) {
    var total = frames.length;
    if (total === 0) return;

    frames.forEach(function(frame, i) {
      var depth = total > 1 ? i / (total - 1) : 0;

      // Size shrinks with distance
      var fw = lerp(vw * 0.14, vw * 0.04, depth);
      var fh = lerp(vh * 0.32, vh * 0.10, depth);

      // Position converges toward vanishing point
      var x, rotY;
      if (side === 'left') {
        x = lerp(vw * 0.02, vw * 0.36, depth);
        rotY = lerp(28, 40, depth);
      } else {
        x = lerp(vw * 0.98 - fw, vw * 0.60, depth);
        rotY = lerp(-28, -40, depth);
      }

      var y = vh * 0.5 - fh / 2;

      frame.style.left = x + 'px';
      frame.style.top = y + 'px';
      frame.style.transform = 'perspective(500px) rotateY(' + rotY + 'deg)';
      frame.style.zIndex = 10 - i;

      var border = frame.querySelector('.frame-border');
      if (border) {
        border.style.width = fw + 'px';
        border.style.height = fh + 'px';
      }
    });
  }

  positionWall(leftFrames, 'left');
  positionWall(rightFrames, 'right');
}

positionArtFrames();

var resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(positionArtFrames, 150);
});

// Gallery scroll-walk animation
var galleryTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#gallery-section',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
  }
});

// Gallery intro fade in then out
gsap.fromTo('#galleryIntro',
  { opacity: 0, y: 20 },
  {
    opacity: 1, y: 0,
    scrollTrigger: {
      trigger: '#gallery-section',
      start: 'top 90%',
      end: 'top 60%',
      scrub: true,
    }
  }
);

galleryTl
  .to('#galleryIntro', { opacity: 0, y: -30, duration: 0.08 }, 0)
  .to('#hallwayPerspective', {
    scale: 2.2,
    duration: 1,
    ease: 'none',
    transformOrigin: '50% 50%',
  }, 0)
  .to('.hallway-door', { scale: 2.5, duration: 1, ease: 'none' }, 0.3);

// Video hover — autoplay muted on hover
document.querySelectorAll('.art-frame[data-type="video"]').forEach(function(frame) {
  var vid = frame.querySelector('video');
  if (!vid) return;
  frame.addEventListener('mouseenter', function() { vid.play().catch(function() {}); });
  frame.addEventListener('mouseleave', function() { vid.pause(); });
});

// ── Art Viewer ───────────────────────────────
var artViewer = document.getElementById('artViewer');
var artViewerMedia = document.getElementById('artViewerMedia');
var artViewerInfo = document.getElementById('artViewerInfo');

function openArtViewer(index) {
  var data = GALLERY_ART[index];
  if (!data) return;

  // Build media element
  if (data.type === 'video') {
    artViewerMedia.innerHTML =
      '<video src="' + data.src + '" controls autoplay' +
      (data.poster ? ' poster="' + data.poster + '"' : '') +
      ' playsinline style="max-width:70vw;max-height:65vh;"></video>';
  } else {
    artViewerMedia.innerHTML =
      '<img src="' + data.src + '" alt="' + data.title + '" />';
  }

  artViewerInfo.querySelector('.viewer-title').textContent = data.title;
  artViewerInfo.querySelector('.viewer-medium').textContent =
    [data.medium, data.year].filter(Boolean).join(' \u2014 ');
  artViewerInfo.querySelector('.viewer-description').textContent = data.description || '';

  artViewer.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Focus trap
  document.getElementById('artViewerClose').focus();
}

function closeArtViewer() {
  artViewer.classList.remove('active');
  document.body.style.overflow = '';
  // Clean up video playback
  var vid = artViewerMedia.querySelector('video');
  if (vid) vid.pause();
}

// Click handlers on frames
document.addEventListener('click', function(e) {
  var frame = e.target.closest('.art-frame');
  if (!frame) return;
  var idx = parseInt(frame.dataset.art);
  openArtViewer(idx);
});

document.addEventListener('keydown', function(e) {
  var frame = e.target.closest('.art-frame');
  if (frame && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    var idx = parseInt(frame.dataset.art);
    openArtViewer(idx);
  }
  if (e.key === 'Escape') closeArtViewer();
});

document.getElementById('artViewerClose').addEventListener('click', closeArtViewer);
document.querySelector('.art-viewer-backdrop').addEventListener('click', closeArtViewer);

// ============================================
// DOOR → CONTACT
// ============================================
var hallwayDoor = document.getElementById('hallwayDoor');
var contactSection = document.getElementById('contact-section');
var backToGallery = document.getElementById('backToGallery');

hallwayDoor.addEventListener('click', function() {
  gsap.to('#doorPanel', {
    rotateY: -90,
    duration: 0.8,
    ease: 'power2.inOut',
    onComplete: function() {
      contactSection.style.display = 'block';
      gsap.fromTo(contactSection, { opacity: 0 }, { opacity: 1, duration: 0.6 });
      gsap.fromTo('.contact-content', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.2 });
    }
  });
});

hallwayDoor.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    hallwayDoor.click();
  }
});

backToGallery.addEventListener('click', function() {
  gsap.to(contactSection, {
    opacity: 0,
    duration: 0.4,
    onComplete: function() {
      contactSection.style.display = 'none';
      gsap.to('#doorPanel', { rotateY: 0, duration: 0.5 });
    }
  });
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
