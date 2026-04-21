// ══════════════════════════════════════════════════════════════════
// IMMERSIVE ORBIT v3 — hand-tracked Saturn
//
// Gestures (one-hand):
//   • swipe (L/R)  → ring-spin burst, decays naturally
//   • pinch        → open image under cursor (one-shot, rearm-latched)
//   • fist         → exit immersive mode + close lightbox
//
// v3 fixes:
//   - Discrete swipe bursts (replaces continuous palm-velocity mapping)
//   - Pinch strength meter on cursor (SVG arc driven by smoothed display score)
//   - One-shot pinch with rearm latch that survives hand-loss
//   - Time-based gesture gates (not RAF-frame counters)
//   - Two-pass arbitration: scores → intents → conflict resolution → callbacks
//   - Midpoint + expanded-rect hit-test (raw landmarks) for pinch target
//   - Celestial line-art onboarding icons (no emoji)
// ══════════════════════════════════════════════════════════════════

const MP_VERSION  = '0.10.18';
const MP_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MODEL_PATH = 'assets/hand_landmarker.task';

// ── Detection / smoothing ─────────────────────────────────────────
const HAND_DETECT_INTERVAL = 3;     // MediaPipe runs every Nth RAF tick
const LANDMARK_SMOOTH      = 0.35;  // EMA for cursor + palm velocity

// ── Ring spin ──────────────────────────────────────────────────────
const IDLE_AUTO_SPIN_DEG   = 16;    // deg/sec when no swipe active
const SPIN_EASE            = 0.08;  // how fast currentVelocity relaxes to target
const RING_MULT            = { art: 1.0, arena: 0.7, cosmos: 0.5 };
const KEYBOARD_SPIN_DEG    = 220;

// ── Swipe detection ────────────────────────────────────────────────
const SWIPE_HISTORY_SIZE    = 12;
const SWIPE_WINDOW_MS       = 350;   // total time window considered
const SWIPE_MIN_WINDOW_MS   = 80;    // too fast = not a swipe
const SWIPE_MIN_DX          = 0.18;  // normalized frame-width displacement
const SWIPE_DIR_RATIO       = 0.65;  // min |dx| / (|dx| + |dy|) — mostly horizontal
const SWIPE_BURST_DEG       = 360;   // spin burst applied on a swipe
const SWIPE_COOLDOWN_MS     = 350;

// ── Pinch meter (display) ──────────────────────────────────────────
const PINCH_METER_FADE_IN   = 0.08;  // score below this → arc hidden
const PINCH_METER_SMOOTH    = 0.30;  // EMA on displayed score for smoothness

// ── Shared state buildRing reads from ──────────────────────────────
window.ImmersiveOrbit = window.ImmersiveOrbit || {
  ringSpinDeg: { art: 0, arena: 0, cosmos: 0 }
};

// ══════════════════════════════════════════════════════════════════
//  MODULE STATE
// ══════════════════════════════════════════════════════════════════

const state = {
  active: false,
  loading: false,
  videoStream: null,
  landmarker: null,
  rafId: null,
  detectTick: 0,

  // Landmarks
  smoothedLandmarks: null,   // EMA-smoothed — for cursor, palm velocity
  rawLandmarks: null,         // raw from the last fresh detection — for pinch score

  // Palm history for swipe detection
  palmHistory: [],             // [{x, y, t}, ...]
  lastSwipeTime: 0,

  // Spin
  currentVelocity: 0,
  lastTick: 0,
  keyboardSpin: 0,

  // Pinch display meter
  displayedPinchScore: 0,

  // Misc
  permissionDenied: false,
  pinchTarget: null,           // ring-image element currently opened
  pendingPinchTargetUntil: 0,  // retry hit-test until this timestamp
  lastCursoredRing: null,      // ring-image under cursor (for cursor-over class)
  onboardingShown: false,
  firstGestureFired: false,
};

// ── DOM handles (resolved on init) ─────────────────────────────────
let $portalStar, $modal, $modalHint, $modalEnter, $modalCancel;
let $hud, $hudHint, $hudVideo, $hudExit, $hudHelp, $cam, $onboarding;
let $cursor, $cursorMeterFill;
let $hudSkeleton, _hudSkelCtx = null, _hudSkelSized = false;

// MediaPipe hand topology (21 landmarks)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],          // thumb
  [0,5],[5,6],[6,7],[7,8],          // index
  [5,9],[9,10],[10,11],[11,12],     // middle
  [9,13],[13,14],[14,15],[15,16],   // ring
  [13,17],[0,17],[17,18],[18,19],[19,20], // pinky + palm edge
];
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// ══════════════════════════════════════════════════════════════════
//  GESTURE ICONS — inline SVG, constellation/line-art aesthetic
//  32px viewBox, cream stroke, round caps. Match Cancer/Libra hero stars.
// ══════════════════════════════════════════════════════════════════

const GESTURE_ICONS = {
  swipe: `
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- Four stars along a gentle arc sweeping right -->
      <circle cx="6"  cy="19" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="13" cy="15" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="20" cy="15" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="27" cy="19" r="1.3" fill="currentColor" stroke="none"/>
      <!-- Connecting arc + leading tick indicating direction -->
      <path d="M6 19 Q13 13 20 13 Q26 13 27 19"/>
      <path d="M24 16 L27 19 L24 22"/>
    </svg>`,

  pinch: `
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- Two rings meeting — thumb + index -->
      <circle cx="12" cy="16" r="3.4"/>
      <circle cx="20" cy="16" r="3.4"/>
      <!-- Four-point spark between them -->
      <path d="M16 11 L16 14  M16 18 L16 21  M13 16 L14 16  M18 16 L19 16" stroke-width="1.3"/>
      <circle cx="16" cy="16" r="0.9" fill="currentColor" stroke="none"/>
    </svg>`,

  fist: `
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- Rounded tight shape + three knuckle lines -->
      <path d="M9 12 Q9 8 13 8 L19 8 Q23 8 23 12 L23 19 Q23 24 18 24 L14 24 Q9 24 9 19 Z"/>
      <path d="M12 12 L20 12"/>
      <path d="M12 15 L20 15"/>
      <path d="M13 18 L19 18"/>
    </svg>`,
};

// ══════════════════════════════════════════════════════════════════
//  GESTURE FRAMEWORK (v3)
//  Time-based gates (not RAF frames). Two-pass arbitration.
//  Each gesture:
//    compute(landmarks, handSpan)   → score 0..1
//    threshold / releaseThreshold    → hysteresis bounds
//    fireHoldMs / releaseHoldMs     → continuous time required, measured
//                                     via fresh-detection timestamps
//    cooldown (ms)                  → min time between fires
//    priority (higher wins conflicts)
//    mutualExclusion: [...]          → other gesture keys suppressing this
//    continuous: bool                → if true, onFire once + onRelease on release
//    onFire / onHold / onRelease / onReady (ready = rearmed after fire)
// ══════════════════════════════════════════════════════════════════

const GESTURE_DEFS = {
  pinch: {
    compute: computePinchScore,
    threshold: 0.55,
    releaseThreshold: 0.35,
    fireHoldMs: 150,
    releaseHoldMs: 200,     // must stay released for this long before rearm
    cooldown: 350,
    priority: 10,           // pinch wins conflicts
    continuous: true,
    onFire: onPinchStart,
    onHold: onPinchHold,
    onRelease: onPinchEnd,
  },
  fist: {
    compute: computeFistScore,
    threshold: 0.72,
    releaseThreshold: 0.55,
    fireHoldMs: 220,
    releaseHoldMs: 150,
    cooldown: 1500,
    priority: 5,
    mutualExclusion: ['pinch'],
    continuous: false,
    onFire: () => exitImmersive('fist'),
  },
};

const gestureState = {};
for (const key of Object.keys(GESTURE_DEFS)) {
  gestureState[key] = {
    active: false,
    rearmed: true,          // becomes false after fire, true again after full release
    aboveSinceTs: 0,        // timestamp score first rose above threshold (0 = not above)
    belowSinceTs: 0,        // timestamp score first dropped below release
    lastFireTs: 0,
    lastScore: 0,
  };
}

/**
 * Evaluate every gesture with two-pass arbitration:
 *   1. Compute all scores.
 *   2. Compute per-gesture intent (wantActivate / wantStayActive / wantRelease / nothing).
 *   3. Resolve conflicts by priority + mutualExclusion (no callbacks fire yet).
 *   4. Apply winning transitions (fire callbacks).
 */
function evaluateGestures(smoothed, raw, handSpan, nowMs, isFreshDetection) {
  // Pass 1 — scores (use raw landmarks for finer detail when available).
  const source = raw || smoothed;
  const scores = {};
  for (const [key, def] of Object.entries(GESTURE_DEFS)) {
    scores[key] = def.compute(source, handSpan);
    gestureState[key].lastScore = scores[key];
  }

  // Pass 2 — intents. Advance timers ONLY on fresh detections so "150ms hold"
  // reflects real detection evidence, not RAF ticks re-using cached landmarks.
  const intents = {};
  for (const [key, def] of Object.entries(GESTURE_DEFS)) {
    const st = gestureState[key];
    const score = scores[key];

    if (isFreshDetection) {
      // Track "above threshold since" and "below release-threshold since"
      if (score >= def.threshold) {
        if (st.aboveSinceTs === 0) st.aboveSinceTs = nowMs;
      } else {
        st.aboveSinceTs = 0;
      }
      if (score <= def.releaseThreshold) {
        if (st.belowSinceTs === 0) st.belowSinceTs = nowMs;
      } else {
        st.belowSinceTs = 0;
      }
      // Rearm latch: once enough continuous below-time has passed, rearm.
      if (!st.rearmed && st.belowSinceTs > 0 &&
          (nowMs - st.belowSinceTs) >= def.releaseHoldMs) {
        st.rearmed = true;
      }
    }

    if (st.active) {
      // Currently active — should we stay, or release?
      if (score < def.releaseThreshold &&
          st.belowSinceTs > 0 &&
          (nowMs - st.belowSinceTs) >= def.releaseHoldMs) {
        intents[key] = 'wantRelease';
      } else {
        intents[key] = 'wantStayActive';
      }
    } else {
      // Inactive — should we activate?
      if (st.rearmed &&
          st.aboveSinceTs > 0 &&
          (nowMs - st.aboveSinceTs) >= def.fireHoldMs &&
          (nowMs - st.lastFireTs) >= def.cooldown) {
        intents[key] = 'wantActivate';
      } else {
        intents[key] = 'idle';
      }
    }
  }

  // Pass 3 — resolve conflicts. Higher-priority wantActivate suppresses
  // mutually-excluded lower-priority gestures.
  const sortedKeys = Object.keys(GESTURE_DEFS).sort(
    (a, b) => GESTURE_DEFS[b].priority - GESTURE_DEFS[a].priority
  );
  const winners = { ...intents };
  const activatingOrActive = new Set();
  for (const key of sortedKeys) {
    const intent = winners[key];
    if (intent === 'wantActivate' || intent === 'wantStayActive') {
      activatingOrActive.add(key);
    }
  }
  for (const key of sortedKeys) {
    const def = GESTURE_DEFS[key];
    if (!def.mutualExclusion) continue;
    const winning = winners[key];
    if (winning !== 'wantActivate' && winning !== 'wantStayActive') continue;
    for (const blockerKey of def.mutualExclusion) {
      // If a gesture listed in our mutual-exclusion is activating/active AND
      // has higher priority, we must yield.
      if (activatingOrActive.has(blockerKey) &&
          GESTURE_DEFS[blockerKey].priority >= def.priority) {
        winners[key] = 'idle';
        // This gesture is suppressed — if it was active, force release later.
        if (gestureState[key].active) {
          winners[key] = 'wantRelease';
        }
        break;
      }
    }
  }

  // Pass 4 — apply transitions. Fire callbacks now, safely.
  for (const key of sortedKeys) {
    const def = GESTURE_DEFS[key];
    const st  = gestureState[key];
    const outcome = winners[key];

    if (outcome === 'wantActivate') {
      st.active = true;
      st.rearmed = false;
      st.lastFireTs = nowMs;
      st.aboveSinceTs = 0;
      st.belowSinceTs = 0;
      try {
        if (def.onFire) def.onFire(smoothed, raw);
      } catch (e) { console.warn('[ImmersiveOrbit] onFire threw:', e); }
      markFirstGesture(key);
      dispatch('orbit:gesture-fired', { gesture: key, score: scores[key] });
    } else if (outcome === 'wantStayActive') {
      if (def.continuous && def.onHold) {
        try { def.onHold(smoothed, raw, nowMs); } catch (e) {}
      }
    } else if (outcome === 'wantRelease') {
      st.active = false;
      // rearmed flips to true only via below-threshold time — leave alone here
      if (def.continuous && def.onRelease) {
        try { def.onRelease(); } catch (e) {}
      }
    }
  }
}

/**
 * Called when the hand is lost (no landmarks this frame). Resets time-based
 * counters but does NOT fire onRelease for continuous gestures and does NOT
 * flip the rearm latch. This protects against flash-close on tracking drops.
 */
function onHandLost() {
  for (const key of Object.keys(gestureState)) {
    const st = gestureState[key];
    st.aboveSinceTs = 0;
    st.belowSinceTs = 0;
    // Keep st.active and st.rearmed as-is; tracking loss isn't the same as
    // a real gesture release.
  }
}

// ══════════════════════════════════════════════════════════════════
//  GESTURE SCORE FUNCTIONS
//  Indices: 0=wrist, 4=thumbTip, 8=indexTip, 12=midTip, 16=ringTip, 20=pinkyTip
//           9 = middle-finger MCP (≈ palm center).
// ══════════════════════════════════════════════════════════════════

function dist2D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function handSpanOf(landmarks) {
  return Math.max(0.05, dist2D(landmarks[0], landmarks[9]));
}

function computePinchScore(landmarks, handSpan) {
  const d = dist2D(landmarks[4], landmarks[8]) / handSpan;
  return clamp((0.55 - d) / 0.40, 0, 1);
}

function computeFistScore(landmarks, handSpan) {
  const tips = [8, 12, 16, 20];
  let sum = 0;
  for (const t of tips) sum += dist2D(landmarks[t], landmarks[0]) / handSpan;
  const avg = sum / 4;
  return clamp((1.8 - avg) / 0.90, 0, 1);
}

// ══════════════════════════════════════════════════════════════════
//  SWIPE DETECTION
//  Palm position history → directional burst. Replaces continuous
//  palm-velocity-to-spin mapping. One-shot with cooldown.
// ══════════════════════════════════════════════════════════════════

function recordPalmSample(landmarks, nowMs) {
  const palm = landmarks[9];
  state.palmHistory.push({ x: palm.x, y: palm.y, t: nowMs });
  while (state.palmHistory.length > SWIPE_HISTORY_SIZE) state.palmHistory.shift();
  // Drop stale samples outside the window
  while (state.palmHistory.length > 0 &&
         nowMs - state.palmHistory[0].t > SWIPE_WINDOW_MS * 1.5) {
    state.palmHistory.shift();
  }
}

function detectSwipe(nowMs) {
  if (nowMs - state.lastSwipeTime < SWIPE_COOLDOWN_MS) return 0;
  if (state.palmHistory.length < 4) return 0;

  const oldest = state.palmHistory[0];
  const newest = state.palmHistory[state.palmHistory.length - 1];
  const elapsed = newest.t - oldest.t;
  if (elapsed < SWIPE_MIN_WINDOW_MS || elapsed > SWIPE_WINDOW_MS) return 0;

  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < SWIPE_MIN_DX) return 0;
  if (adx / (adx + ady + 1e-6) < SWIPE_DIR_RATIO) return 0;

  state.lastSwipeTime = nowMs;
  state.palmHistory = [];  // reset so the same motion doesn't re-fire

  // Unmirrored camera: dx > 0 means user's hand moved to user's LEFT.
  // User-intuitive: right-swipe = spin clockwise (positive deg).
  // So dx > 0 → negative burst, dx < 0 → positive burst.
  const direction = dx > 0 ? -1 : 1;
  markFirstGesture('swipe');
  dispatch('orbit:gesture-fired', { gesture: 'swipe', direction });
  return direction * SWIPE_BURST_DEG;
}

// ══════════════════════════════════════════════════════════════════
//  PINCH HIT-TEST + BEHAVIOR
//  Midpoint of thumb+index → elementsFromPoint → ring-image.
//  If nothing hits, fall back to expanded-rect nearest-match.
//  Target acquisition window retries for 200ms after initial fire.
// ══════════════════════════════════════════════════════════════════

const TARGET_ACQUIRE_MS = 200;
const RECT_PADDING_PX   = 12;

function landmarkToScreen(lm) {
  // Detection runs on the unmirrored #orbitCam stream; user sees mirrored HUD.
  // Flip x to match what the user visually intuits.
  return {
    x: (1 - lm.x) * window.innerWidth,
    y: lm.y * window.innerHeight,
  };
}

function pinchMidpointScreen(landmarks) {
  const thumb = landmarkToScreen(landmarks[4]);
  const index = landmarkToScreen(landmarks[8]);
  return {
    x: (thumb.x + index.x) / 2,
    y: (thumb.y + index.y) / 2,
  };
}

function findRingImageAt(x, y) {
  // 1) Try exact hit via document hit stack
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const match = el.classList && el.classList.contains('ring-image')
      ? el
      : (el.closest ? el.closest('.ring-image') : null);
    if (match) return match;
  }
  // 2) Fallback: scan visible ring images, take the nearest whose expanded
  //    bounding rect contains (x, y).
  const imgs = document.querySelectorAll('.ring-image');
  let best = null, bestDist = Infinity;
  for (const img of imgs) {
    const r = img.getBoundingClientRect();
    if (r.width === 0) continue;
    if (x < r.left - RECT_PADDING_PX || x > r.right + RECT_PADDING_PX) continue;
    if (y < r.top  - RECT_PADDING_PX || y > r.bottom + RECT_PADDING_PX) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestDist) { bestDist = d; best = img; }
  }
  return best;
}

function attemptOpenAt(x, y) {
  const ringImage = findRingImageAt(x, y);
  if (!ringImage) return false;
  const media = ringImage._mediaEl;
  const src = media ? (media.src || media.currentSrc) : null;
  if (!src) return false;

  state.pinchTarget = ringImage;
  if (typeof window.openRingLightbox === 'function') {
    window.openRingLightbox(
      src,
      !!ringImage._isVideo,
      ringImage._source || 'art',
      ringImage._boardUrl || ''
    );
  }
  ringImage.classList.add('pinch-selected');
  pulseOnboardingIcon('pinch');
  fireCursorSparkle();
  return true;
}

function onPinchStart(/* smoothed */ _s, raw) {
  if ($cursor) $cursor.classList.add('is-pinching');
  if (!raw) return;
  const pt = pinchMidpointScreen(raw);
  const opened = attemptOpenAt(pt.x, pt.y);
  if (!opened) {
    // Keep retrying for target-acquire window — user may still be closing
    // the pinch onto an image.
    state.pendingPinchTargetUntil = performance.now() + TARGET_ACQUIRE_MS;
  }
}

function onPinchHold(_s, raw, nowMs) {
  // Retry hit-test while in the target-acquisition window
  if (!raw) return;
  if (state.pinchTarget) return;
  if (nowMs > state.pendingPinchTargetUntil) return;
  const pt = pinchMidpointScreen(raw);
  attemptOpenAt(pt.x, pt.y);
}

function onPinchEnd() {
  if ($cursor) $cursor.classList.remove('is-pinching');
  if (state.pinchTarget) {
    state.pinchTarget.classList.remove('pinch-selected');
    state.pinchTarget = null;
  }
  state.pendingPinchTargetUntil = 0;
  // v3: do NOT close the lightbox here. Lightbox closes via backdrop, Esc,
  // or fist-to-exit. Tracking drops won't flash the lightbox away.
}

function closeLightboxIfOpen() {
  if (typeof window.closeRingLightbox === 'function') {
    try { window.closeRingLightbox(); } catch (e) {}
  }
  if (state.pinchTarget) {
    state.pinchTarget.classList.remove('pinch-selected');
    state.pinchTarget = null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  CURSOR + PINCH METER
// ══════════════════════════════════════════════════════════════════

function updateCursorPosition(landmarks) {
  if (!$cursor) return;
  const tip = landmarkToScreen(landmarks[8]);
  $cursor.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
  if (!$cursor.classList.contains('is-visible')) {
    $cursor.classList.add('is-visible');
    $cursor.setAttribute('aria-hidden', 'false');
  }
  // Maintain cursor-over highlight on the ring image under the cursor
  const hoveredRing = findRingImageAt(tip.x, tip.y);
  if (hoveredRing !== state.lastCursoredRing) {
    if (state.lastCursoredRing) state.lastCursoredRing.classList.remove('cursor-over');
    if (hoveredRing) hoveredRing.classList.add('cursor-over');
    state.lastCursoredRing = hoveredRing;
  }
}

function hideCursor() {
  if (!$cursor) return;
  $cursor.classList.remove('is-visible');
  $cursor.setAttribute('aria-hidden', 'true');
  if (state.lastCursoredRing) {
    state.lastCursoredRing.classList.remove('cursor-over');
    state.lastCursoredRing = null;
  }
}

function updatePinchMeter(rawScore) {
  state.displayedPinchScore += (rawScore - state.displayedPinchScore) * PINCH_METER_SMOOTH;
  const s = state.displayedPinchScore;
  if ($cursorMeterFill) {
    // pathLength=100 → dashoffset in [0 (full) ... 100 (empty)]
    $cursorMeterFill.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, s * 100)));
  }
  if ($cursor) {
    $cursor.classList.toggle('is-meter-visible', s > PINCH_METER_FADE_IN);
    $cursor.classList.toggle('is-meter-ready',   s > 0.55);
  }
}

// ══════════════════════════════════════════════════════════════════
//  HAND SKELETON — drawn on the HUD preview to prove tracking works
// ══════════════════════════════════════════════════════════════════

function ensureSkeletonSized() {
  if (!$hudSkeleton || !_hudSkelCtx) return false;
  const rect = $hudSkeleton.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if ($hudSkeleton.width !== w || $hudSkeleton.height !== h) {
    $hudSkeleton.width = w;
    $hudSkeleton.height = h;
    _hudSkelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _hudSkelSized = true;
  } else if (!_hudSkelSized) {
    _hudSkelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _hudSkelSized = true;
  }
  return true;
}

function drawHandSkeleton(landmarks) {
  if (!$hudSkeleton || !_hudSkelCtx || !landmarks) return;
  if (!ensureSkeletonSized()) return;
  const rect = $hudSkeleton.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const ctx = _hudSkelCtx;
  ctx.clearRect(0, 0, W, H);

  // Connections (cream lines)
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.78)';
  ctx.shadowColor = 'rgba(255, 220, 180, 0.45)';
  ctx.shadowBlur = 3;
  for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
    const [a, b] = HAND_CONNECTIONS[i];
    const A = landmarks[a], B = landmarks[b];
    if (!A || !B) continue;
    ctx.beginPath();
    ctx.moveTo(A.x * W, A.y * H);
    ctx.lineTo(B.x * W, B.y * H);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Joints (cream dots)
  ctx.fillStyle = 'rgba(255, 248, 232, 0.95)';
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    const r = FINGERTIP_INDICES.indexOf(i) !== -1 ? 2.8 : 1.8;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fingertip glow (gold)
  ctx.fillStyle = 'rgba(255, 220, 150, 0.35)';
  for (let i = 0; i < FINGERTIP_INDICES.length; i++) {
    const p = landmarks[FINGERTIP_INDICES[i]];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clearHandSkeleton() {
  if (!$hudSkeleton || !_hudSkelCtx) return;
  const rect = $hudSkeleton.getBoundingClientRect();
  _hudSkelCtx.clearRect(0, 0, rect.width, rect.height);
}

let _sparkleTimer = null;
function fireCursorSparkle() {
  if (!$cursor) return;
  $cursor.classList.remove('is-sparkling');
  void $cursor.offsetWidth;
  $cursor.classList.add('is-sparkling');
  if (_sparkleTimer) clearTimeout(_sparkleTimer);
  _sparkleTimer = setTimeout(() => {
    if ($cursor) $cursor.classList.remove('is-sparkling');
    _sparkleTimer = null;
  }, 600);
}

// ══════════════════════════════════════════════════════════════════
//  ONBOARDING HUD
// ══════════════════════════════════════════════════════════════════

const ONBOARDING_ITEMS = [
  { key: 'swipe', icon: GESTURE_ICONS.swipe, label: 'swipe to spin' },
  { key: 'pinch', icon: GESTURE_ICONS.pinch, label: 'pinch to open' },
  { key: 'fist',  icon: GESTURE_ICONS.fist,  label: 'fist to exit' },
];

let _onboardingTimer = null;

function buildOnboardingCards() {
  if (!$onboarding || $onboarding.childElementCount > 0) return;
  for (const item of ONBOARDING_ITEMS) {
    const card = document.createElement('div');
    card.className = 'orbit-gesture-card';
    card.dataset.gestureKey = item.key;
    card.innerHTML = `
      <div class="orbit-gesture-icon">${item.icon}</div>
      <div class="orbit-gesture-label">${item.label}</div>
    `;
    $onboarding.appendChild(card);
  }
}

function showOnboarding(manual) {
  if (!$onboarding) return;
  if (_onboardingTimer) { clearTimeout(_onboardingTimer); _onboardingTimer = null; }
  $onboarding.classList.add('is-visible');
  _onboardingTimer = setTimeout(hideOnboarding, manual ? 5000 : 7000);
  state.onboardingShown = true;
}

function hideOnboarding() {
  if (!$onboarding) return;
  $onboarding.classList.remove('is-visible');
  if (_onboardingTimer) { clearTimeout(_onboardingTimer); _onboardingTimer = null; }
}

function markFirstGesture(/* key */) {
  if (state.firstGestureFired) return;
  state.firstGestureFired = true;
  setTimeout(hideOnboarding, 1200);
}

function pulseOnboardingIcon(key) {
  if (!$onboarding) return;
  const card = $onboarding.querySelector(`.orbit-gesture-card[data-gesture-key="${key}"]`);
  if (!card) return;
  card.classList.remove('is-pulse');
  void card.offsetWidth;
  card.classList.add('is-pulse');
  setTimeout(() => card.classList.remove('is-pulse'), 700);
}

// ══════════════════════════════════════════════════════════════════
//  INIT + PORTAL FLOW
// ══════════════════════════════════════════════════════════════════

function init() {
  $portalStar   = document.querySelector('.portal-star');
  $modal        = document.getElementById('orbitModal');
  $modalHint    = document.getElementById('orbitModalHint');
  $modalEnter   = document.getElementById('orbitEnterBtn');
  $modalCancel  = document.getElementById('orbitCancelBtn');
  $hud          = document.getElementById('orbitHud');
  $hudHint      = document.getElementById('orbitHudHint');
  $hudVideo     = document.getElementById('orbitHudVideo');
  $hudExit      = document.getElementById('orbitHudExitBtn');
  $hudHelp      = document.getElementById('orbitHudHelpBtn');
  $cam          = document.getElementById('orbitCam');
  $onboarding   = document.getElementById('orbitOnboarding');
  $cursor       = document.getElementById('orbitCursor');
  $cursorMeterFill = $cursor ? $cursor.querySelector('.orbit-cursor-meter-fill') : null;
  $hudSkeleton  = document.getElementById('orbitHudSkeleton');
  if ($hudSkeleton) {
    try { _hudSkelCtx = $hudSkeleton.getContext('2d'); } catch (e) { _hudSkelCtx = null; }
    if (_hudSkelCtx) {
      // Size once after layout + resync on resize
      requestAnimationFrame(ensureSkeletonSized);
      window.addEventListener('resize', () => { _hudSkelSized = false; }, { passive: true });
    }
  }

  if (!$portalStar || !$modal) {
    console.warn('[ImmersiveOrbit] Missing required DOM nodes');
    return;
  }

  buildOnboardingCards();

  $portalStar.addEventListener('click', (e) => {
    e.stopPropagation();
    onPortalActivate();
  });

  $modalCancel.addEventListener('click', closeModal);
  $modalEnter.addEventListener('click', onEnterConfirmed);
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal || e.target.classList.contains('orbit-modal-backdrop')) {
      if (!state.loading) closeModal();
    }
  });

  $hudExit.addEventListener('click', () => exitImmersive('button'));
  if ($hudHelp) $hudHelp.addEventListener('click', () => showOnboarding(true));

  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('keyup', onGlobalKeyup);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', () => stopStreamOnly());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.active) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = null;
    } else if (!document.hidden && state.active && !state.rafId) {
      state.lastTick = performance.now();
      state.rafId = requestAnimationFrame(detectLoop);
    }
  });
}

function onPortalActivate() {
  if (state.active || state.loading) return;
  if (isCoarsePointerOrMobile()) {
    openModal({
      title: 'desktop experience',
      body: 'this one needs a camera and some room to move. come back on a laptop 🪐',
      enter: null, cancel: 'okay',
    });
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    openModal({
      title: 'no camera available',
      body: 'your browser won’t let me reach the webcam here. try chrome or safari on a laptop.',
      enter: null, cancel: 'okay',
    });
    return;
  }
  openModal();
}

function isCoarsePointerOrMobile() {
  try { if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true; }
  catch (e) {}
  return window.innerWidth < 700;
}

function openModal(opts) {
  opts = opts || {};
  const titleEl = $modal.querySelector('.orbit-modal-title');
  const bodyEl  = $modal.querySelector('.orbit-modal-body');
  titleEl.textContent = opts.title || 'enter my orbit?';
  bodyEl.textContent  = opts.body  ||
    'your webcam powers the spin. nothing is recorded, nothing leaves your browser. ' +
    'swipe, pinch, or make a fist.';
  $modalHint.textContent = '';

  if (opts.enter === null) {
    $modalEnter.style.display = 'none';
  } else {
    $modalEnter.style.display = '';
    $modalEnter.textContent = opts.enter || 'enter';
  }
  $modalCancel.textContent = opts.cancel || 'not now';

  $modal.classList.add('is-open');
  $modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    ($modalEnter.style.display === 'none' ? $modalCancel : $modalEnter).focus();
  }, 50);
}

function closeModal() {
  $modal.classList.remove('is-open');
  $modal.setAttribute('aria-hidden', 'true');
  setModalLoading(false);
  if ($portalStar) $portalStar.focus();
}

function setModalLoading(loading) {
  state.loading = loading;
  $modalEnter.disabled = loading;
  $modalCancel.disabled = loading;
  $modalEnter.textContent = loading ? 'tuning in…' : 'enter';
}

async function onEnterConfirmed() {
  if (state.loading) return;
  setModalLoading(true);
  $modalHint.textContent = '';

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    state.permissionDenied = true;
    setModalLoading(false);
    $modalHint.textContent = err.name === 'NotAllowedError'
      ? 'camera access was blocked. you can try again anytime.'
      : 'couldn’t open the camera — ' + (err.message || 'unknown error');
    console.warn('[ImmersiveOrbit] getUserMedia failed:', err);
    return;
  }
  state.videoStream = stream;
  $cam.srcObject = stream;
  $hudVideo.srcObject = stream;
  try { await $cam.play(); } catch (e) {}
  try { await $hudVideo.play(); } catch (e) {}

  try {
    $modalHint.textContent = 'waking up the sky…';
    const mp = await import(/* @vite-ignore */ MP_BUNDLE_URL);
    const vision = await mp.FilesetResolver.forVisionTasks(MP_WASM_URL);
    state.landmarker = await mp.HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  } catch (err) {
    setModalLoading(false);
    $modalHint.textContent = 'hand tracking couldn’t load. check your connection?';
    console.error('[ImmersiveOrbit] HandLandmarker init failed:', err);
    stopStreamOnly();
    return;
  }

  // Enter immersive
  state.active = true;
  state.loading = false;
  state.firstGestureFired = false;
  state.palmHistory = [];
  state.lastSwipeTime = 0;
  state.displayedPinchScore = 0;
  $modal.classList.remove('is-open');
  $modal.setAttribute('aria-hidden', 'true');
  document.body.classList.add('immersive-active');
  $hud.setAttribute('aria-hidden', 'false');

  if (window.gsap) {
    window.gsap.to('.saturn-container', { scale: 1.06, duration: 0.9, ease: 'power3.out' });
  }

  showOnboarding(false);

  state.lastTick = performance.now();
  state.detectTick = 0;
  state.rafId = requestAnimationFrame(detectLoop);

  dispatch('orbit:enter');
}

// ══════════════════════════════════════════════════════════════════
//  DETECT LOOP
// ══════════════════════════════════════════════════════════════════

function detectLoop(now) {
  if (!state.active) return;

  const dt = Math.min(0.1, (now - state.lastTick) / 1000);
  state.lastTick = now;

  let haveHand = false;
  let isFreshDetection = false;

  state.detectTick = (state.detectTick + 1) % HAND_DETECT_INTERVAL;
  if (state.detectTick === 0 && state.landmarker && $cam.readyState >= 2) {
    try {
      const result = state.landmarker.detectForVideo($cam, now);
      if (result.landmarks && result.landmarks.length > 0) {
        const raw = result.landmarks[0];
        state.rawLandmarks = raw;
        // Smoothed buffer for cursor + palm-history
        if (!state.smoothedLandmarks) {
          state.smoothedLandmarks = raw.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
        } else {
          for (let i = 0; i < raw.length; i++) {
            const s = state.smoothedLandmarks[i];
            s.x += (raw[i].x - s.x) * LANDMARK_SMOOTH;
            s.y += (raw[i].y - s.y) * LANDMARK_SMOOTH;
          }
        }
        haveHand = true;
        isFreshDetection = true;
      } else {
        state.smoothedLandmarks = null;
        state.rawLandmarks = null;
        onHandLost();
      }
    } catch (err) {
      console.warn('[ImmersiveOrbit] detectForVideo failed:', err);
    }
  } else if (state.smoothedLandmarks) {
    haveHand = true;  // Reuse last smoothed landmarks between detections
  }

  // Cursor + meter + gesture evaluation
  if (haveHand && state.smoothedLandmarks) {
    updateCursorPosition(state.smoothedLandmarks);
    drawHandSkeleton(state.smoothedLandmarks);
    const handSpan = handSpanOf(state.rawLandmarks || state.smoothedLandmarks);
    const pinchRaw = computePinchScore(state.rawLandmarks || state.smoothedLandmarks, handSpan);
    updatePinchMeter(pinchRaw);
    if (isFreshDetection) {
      recordPalmSample(state.smoothedLandmarks, now);
    }
    evaluateGestures(state.smoothedLandmarks, state.rawLandmarks, handSpan, now, isFreshDetection);
  } else {
    hideCursor();
    clearHandSkeleton();
    updatePinchMeter(0);
  }

  // Ring spin: idle drift + swipe bursts + keyboard
  let targetDeg = IDLE_AUTO_SPIN_DEG;
  const swipeBurst = haveHand && isFreshDetection ? detectSwipe(now) : 0;
  if (swipeBurst !== 0) {
    // Inject burst directly into currentVelocity so it decays gracefully
    state.currentVelocity = swipeBurst;
  }
  // Suppress spin while pinching so the opened image isn't flung away
  const pinching = gestureState.pinch.active;
  if (pinching) {
    state.currentVelocity *= 0.85;
  } else {
    targetDeg += state.keyboardSpin;
    state.currentVelocity += (targetDeg - state.currentVelocity) * SPIN_EASE;
  }

  const rings = window.ImmersiveOrbit.ringSpinDeg;
  rings.art    = wrap360(rings.art    + state.currentVelocity * dt * RING_MULT.art);
  rings.arena  = wrap360(rings.arena  + state.currentVelocity * dt * RING_MULT.arena);
  rings.cosmos = wrap360(rings.cosmos + state.currentVelocity * dt * RING_MULT.cosmos);

  state.rafId = requestAnimationFrame(detectLoop);
}

function wrap360(d) {
  d = d % 360;
  if (d < 0) d += 360;
  return d;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ══════════════════════════════════════════════════════════════════
//  EXIT + CLEANUP
// ══════════════════════════════════════════════════════════════════

function exitImmersive(reason) {
  if (!state.active) return;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.active = false;
  state.currentVelocity = 0;
  state.keyboardSpin = 0;
  state.smoothedLandmarks = null;
  state.rawLandmarks = null;
  state.palmHistory = [];
  state.displayedPinchScore = 0;

  // Reset gesture states completely on exit
  for (const key of Object.keys(gestureState)) {
    const st = gestureState[key];
    if (st.active && GESTURE_DEFS[key].continuous && GESTURE_DEFS[key].onRelease) {
      try { GESTURE_DEFS[key].onRelease(); } catch (e) {}
    }
    st.active = false;
    st.rearmed = true;
    st.aboveSinceTs = 0;
    st.belowSinceTs = 0;
  }

  closeLightboxIfOpen();
  hideOnboarding();
  hideCursor();
  clearHandSkeleton();

  stopStreamOnly();

  if (state.landmarker) {
    try { state.landmarker.close(); } catch (e) {}
    state.landmarker = null;
  }

  document.body.classList.remove('immersive-active');
  $hud.setAttribute('aria-hidden', 'true');

  if (window.gsap) {
    window.gsap.to('.saturn-container', { scale: 1, duration: 0.7, ease: 'power3.out' });
  }

  // Ease ring offsets back to zero
  const rings = window.ImmersiveOrbit.ringSpinDeg;
  const startArt = rings.art, startArena = rings.arena, startCosmos = rings.cosmos;
  const t0 = performance.now();
  function settle(now) {
    const t = Math.min(1, (now - t0) / 1500);
    const e = 1 - Math.pow(1 - t, 3);
    rings.art    = startArt    * (1 - e);
    rings.arena  = startArena  * (1 - e);
    rings.cosmos = startCosmos * (1 - e);
    if (t < 1) requestAnimationFrame(settle);
  }
  requestAnimationFrame(settle);

  dispatch('orbit:exit', { reason: reason || 'unknown' });
}

function stopStreamOnly() {
  if (state.videoStream) {
    try { state.videoStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    state.videoStream = null;
  }
  try { $cam.srcObject = null; } catch (e) {}
  try { $hudVideo.srcObject = null; } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════
//  KEYBOARD + SCROLL
// ══════════════════════════════════════════════════════════════════

function onGlobalKeydown(e) {
  if (e.key === 'Escape') {
    // Two-step Escape: close lightbox first (if open), then exit immersive
    if (state.active && state.pinchTarget) {
      closeLightboxIfOpen();
      e.preventDefault();
      return;
    }
    if (state.active) { exitImmersive('escape'); e.preventDefault(); return; }
    if ($modal.classList.contains('is-open') && !state.loading) {
      closeModal(); e.preventDefault(); return;
    }
  }
  if (state.active) {
    if (e.key === 'ArrowLeft')  { state.keyboardSpin = -KEYBOARD_SPIN_DEG; e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.keyboardSpin =  KEYBOARD_SPIN_DEG; e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') {
      // Open the ring under the cursor, if any
      if (state.lastCursoredRing) {
        const ring = state.lastCursoredRing;
        const r = ring.getBoundingClientRect();
        attemptOpenAt(r.left + r.width / 2, r.top + r.height / 2);
        e.preventDefault();
      }
    }
  }
}

function onGlobalKeyup(e) {
  if (!state.active) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') state.keyboardSpin = 0;
}

function onScroll() {
  if (!state.active) return;
  const hero = document.getElementById('hero');
  if (!hero) return;
  const rect = hero.getBoundingClientRect();
  if (rect.bottom < window.innerHeight * 0.35) exitImmersive('scroll');
}

function dispatch(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
}

// ── Boot ────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
