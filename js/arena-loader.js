/* ============================================ */
/* Are.na + Cosmos Inspiration Image Loader     */
/* ============================================ */

const ArenaLoader = (function() {
  'use strict';

  // ── Configuration ──────────────────────────────
  const ARENA_CHANNELS = [
    'i-like-t58kvbzcjmu',
    'creative-direction-msvjvkzq6ei',
  ];
  const COSMOS_DATA_PATH = 'cosmos-data.json';

  const API_BASE = 'https://api.are.na/v2';
  const CACHE_KEY = 'hos-inspiration-images';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // ── Cache ──────────────────────────────────────
  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached.images;
    } catch (_) {
      return null;
    }
  }

  function setCache(images) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), images }));
    } catch (_) {
      // Storage full or unavailable
    }
  }

  // ── Are.na API ─────────────────────────────────
  async function fetchOneChannel(slug) {
    const url = `${API_BASE}/channels/${slug}/contents?per=100`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[Loader] Are.na channel "${slug}" returned ${res.status}. Skipping.`);
      return [];
    }

    const data = await res.json();
    const blocks = data.contents || data.data || [];

    return blocks
      .filter(b => b.class === 'Image' || b.class === 'image' || (b.image && b.image.url))
      .map(b => {
        const img = b.image || {};
        const src = (img.display && img.display.url)
          || (img.thumb && img.thumb.url)
          || (img.square && img.square.url)
          || img.url
          || '';
        return { src, alt: b.title || b.generated_title || 'Inspiration', source: 'arena' };
      })
      .filter(img => img.src);
  }

  async function fetchArenaImages() {
    const results = await Promise.all(
      ARENA_CHANNELS.map(slug => fetchOneChannel(slug).catch(() => []))
    );
    // Merge and dedupe by src
    const seen = new Set();
    const all = [];
    for (const imgs of results) {
      for (const img of imgs) {
        if (!seen.has(img.src)) {
          seen.add(img.src);
          all.push(img);
        }
      }
    }
    return all;
  }

  // ── Cosmos (local JSON from update-cosmos.py) ──
  async function fetchCosmosImages() {
    try {
      const res = await fetch(COSMOS_DATA_PATH);
      if (!res.ok) {
        console.warn('[Loader] cosmos-data.json not found. Run: python3 update-cosmos.py');
        return [];
      }
      const data = await res.json();
      return (data.images || []).map(img => ({
        src: img.src,
        alt: img.collection || 'Cosmos',
        source: 'cosmos',
        collection: img.collection,
      }));
    } catch (err) {
      console.warn('[Loader] Error loading cosmos-data.json:', err.message);
      return [];
    }
  }

  // ── Shuffle (Fisher-Yates) ─────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Public API ─────────────────────────────────
  async function getAllImages() {
    // Use cached raw data if available, but always reshuffle
    let raw = getCached();

    if (!raw || !raw.arena) {
      const [arenaImages, cosmosImages] = await Promise.all([
        fetchArenaImages().catch(err => {
          console.warn('[Loader] Are.na error:', err.message);
          return [];
        }),
        fetchCosmosImages(),
      ]);

      raw = { arena: arenaImages, cosmos: cosmosImages };

      if (raw.arena.length > 0 || raw.cosmos.length > 0) {
        setCache(raw);
      }
    }

    // Always reshuffle so every page load shows a different mix
    const result = {
      arena: shuffle(raw.arena),
      cosmos: shuffle(raw.cosmos),
    };

    console.log(`[Loader] ${result.arena.length} Are.na + ${result.cosmos.length} Cosmos`);
    return result;
  }

  return { getAllImages };
})();
