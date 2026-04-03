# Hues of Saturn — AGENTS.md

## Project Identity
**Hues of Saturn** is a creative portfolio website for Nicole Deschamps (HUESOFSATURN). It features an interactive face-planet hero with orbiting inspiration rings, an elevator-portal navigation metaphor, and a 3D perspective gallery walkthrough. Static site, no build step.

**Location**: ~/Desktop/Creative-Projects/hues-of-saturn/

## Architecture
- **Pure static site** — HTML5, CSS3, vanilla ES6+ JavaScript
- **No build tools** — no webpack, vite, npm, or framework
- **Single page**: `index.html` (185 lines)
- **~2,960 lines total** across HTML, CSS, and JS

### File Structure
```
index.html              — page structure, all sections
css/style.css           — 1,952 lines, 3D transforms, animations, design system
js/main.js              — 564 lines, hero animations, elevator, gallery, GSAP
js/arena-loader.js      — 260 lines, Are.na API + Cosmos.so data fetching
js/gallery-data.js      — 106 lines, hand-curated art catalog (9 pieces)
update-cosmos.py         — 180 lines, Cosmos.so web scraper (GitHub Actions daily)
arena-data.json          — Are.na API fallback cache
cosmos-data.json         — Cosmos.so scraped data cache
assets/                  — images, art, textures
.github/workflows/       — daily Cosmos scraper CI
```

### Tech Stack
- **GSAP 3.12.5** — animation engine (ScrollTrigger, ScrollToPlugin)
- **Google Fonts** — Climate Crisis, Playfair Display, Inter
- **Are.na API v2** — public channel image fetching (with sessionStorage cache, 15-min TTL)
- **Cosmos.so** — scraped via Python, cached as JSON
- **Python 3** — dev server (`python3 -m http.server 8080`) + Cosmos scraper

### Page Sections
1. **Hero** — Saturn face image with 3 concentric rotating inspiration rings (art, Are.na, Cosmos)
2. **Elevator** — interactive elevator with doors, floor buttons, floor indicator, gallery hallway behind doors
3. **Art Viewer** — modal overlay for expanded artwork display
4. **Floating Nav** — persistent navigation after scroll

## Code Conventions
- **Indentation**: 2 spaces (CSS, JS, HTML)
- **JS pattern**: IIFE for encapsulation, strict mode
- **CSS classes**: kebab-case (`saturn-ring-back`, `elevator-wall-left`)
- **JS variables**: camelCase
- **Data attributes**: `data-floor`, `data-nav`, `data-art`, `data-baseAngle`
- **Section headers**: `/* ============ */` comment dividers
- **Cache busting**: `?v=20260403x` on CSS/JS links

## Key Patterns
- **Ring system**: 3 rings built with golden angle distribution, GSAP continuous rotation, z-order swapping via back/front layers
- **Elevator**: GSAP-animated door open/close, floor travel sequences with counter + directional arrow
- **Gallery**: 3D CSS perspective hallway, ScrollTrigger integration, left/right wall placement
- **Data fallback chain**: sessionStorage cache -> live API -> session cache -> static JSON files
- **Image filtering**: removes avatars (regex), tiny images (<200x200), Pinterest sources, screenshots

## Known Issues — Priority Review Areas

### Functional
1. **Elevator door animations** — recently reworked, verify doors open fully for gallery view
2. **Ring image loading** — Are.na API can fail; verify fallback chain works end-to-end
3. **Pinterest content leaking** — filter in arena-loader.js may miss edge cases
4. **Gallery scroll behavior** — 3D perspective + ScrollTrigger interaction needs testing

### Performance
5. **Large CSS file** (1,952 lines) — single file, could benefit from splitting or auditing unused rules
6. **Image lazy loading** — verify `loading="lazy"` + `decoding="async"` working correctly
7. **GSAP ScrollTrigger** — multiple triggers on same page, check for conflicts or jank
8. **Ring rotation** — continuous GSAP animation with z-order swapping, verify smooth on low-end devices

### Accessibility
9. **Elevator metaphor** — heavily visual, screen reader experience needs audit
10. **ARIA labels** — present but may not fully describe interactive elevator UI
11. **Keyboard navigation** — elevator buttons and gallery should be keyboard-accessible
12. **Color contrast** — white text on dark backgrounds, verify WCAG compliance

### Data & Security
13. **Are.na API** — public, no auth key exposed, but verify CORS handling
14. **Cosmos scraper** — Python script runs in CI, check for injection in scraped data
15. **sessionStorage** — 15-min cache TTL, verify stale data doesn't persist

### CSS Architecture
16. **3D transforms** — heavy use of preserve-3d, perspective, rotateX/Y/Z — verify cross-browser
17. **Crack/void effect** — CSS variables for blue-purple glow, check if still used or orphaned
18. **Responsive** — uses `clamp()` and viewport units, verify mobile breakpoints

## What a Good Review Covers
1. **Visual bugs**: CSS 3D transforms, animation timing, z-index stacking issues
2. **Data integrity**: API fallback chain, image filtering, cache invalidation
3. **Performance**: animation jank, image loading strategy, unused CSS
4. **Accessibility**: screen reader experience, keyboard nav, ARIA completeness
5. **Cross-browser**: Safari 3D transforms, mobile viewport units (dvh), GSAP compat
6. **Code quality**: dead code, error handling in API calls, event listener cleanup

## Do NOT
- Suggest switching to React/Next.js — this is intentionally a static vanilla site
- Add a CSS preprocessor — plain CSS with custom properties is deliberate
- Remove the elevator metaphor — it's the core creative concept
- Change the font choices — Climate Crisis + Playfair Display are brand identity
