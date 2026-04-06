#!/usr/bin/env python3
"""
Pinterest Board Scraper for Hues of Saturn
Pulls images from a specific Pinterest board and saves to pinterest-data.json.

Usage:  python3 update-pinterest.py
"""

import json
import re
import time
import requests

BOARD_URL = "https://www.pinterest.com/deschamps23/_tpd_social/"
USERNAME = "deschamps23"
BOARD_SLUG = "_tpd_social"
OUTPUT_FILE = "pinterest-data.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Pinterest CDN image pattern
PIN_IMG_PATTERN = re.compile(r'https://i\.pinimg\.com/[^"\'\\]+\.(?:jpg|jpeg|png|gif|webp)', re.IGNORECASE)

# Fallback: any pinimg URL in the page source
PIN_IMG_FALLBACK = re.compile(r'https://i\.pinimg\.com/\d+x[^"\'\\\s]+', re.IGNORECASE)

# Pinterest video pattern (mp4 on v1.pinimg.com)
PIN_VIDEO_PATTERN = re.compile(r'https://v1\.pinimg\.com/videos/[^"\'\\]+\.mp4', re.IGNORECASE)


def fetch_page(url):
    """Fetch page HTML."""
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.text


def extract_pins_from_html(html):
    """Extract pin image URLs from the initial HTML/JSON payload."""
    # Collect all pinimg URLs
    raw_urls = PIN_IMG_PATTERN.findall(html)
    if not raw_urls:
        raw_urls = PIN_IMG_FALLBACK.findall(html)

    # Deduplicate by image hash (the unique part of the path)
    hash_pattern = re.compile(r'/([a-f0-9]{2}/[a-f0-9]{2}/[a-f0-9]{2}/[a-f0-9]+\.\w+)')
    seen_hashes = set()
    results = []

    for url in raw_urls:
        # Skip tiny thumbnails and srcset junk
        if '/30x30' in url or '/75x75' in url or '/140x140' in url or '/170x' in url:
            continue
        if ' ' in url:  # srcset entries have spaces
            continue

        # Extract the unique hash
        m = hash_pattern.search(url)
        if not m:
            continue
        img_hash = m.group(1)
        if img_hash in seen_hashes:
            continue
        seen_hashes.add(img_hash)

        # Prefer originals, fall back to 736x
        if '/originals/' in url:
            results.append(url)
        else:
            results.append(re.sub(r'/\d+x[^/]*/', '/originals/', url))

    # Also extract video URLs
    video_urls = set()
    for url in PIN_VIDEO_PATTERN.findall(html):
        video_urls.add(url)

    return results, list(video_urls)


def try_pinterest_api(username, board_slug):
    """Try Pinterest's internal resource API for board pins."""
    # Pinterest internal API endpoint
    api_url = "https://www.pinterest.com/resource/BoardFeedResource/get/"
    params = {
        "source_url": f"/{username}/{board_slug}/",
        "data": json.dumps({
            "options": {
                "board_id": "",
                "board_url": f"/{username}/{board_slug}/",
                "field_set_key": "partner_react_grid_pin",
                "filter_section_pins": True,
                "layout": "default",
                "page_size": 25,
            },
            "context": {}
        }),
    }

    try:
        resp = requests.get(api_url, params=params, headers={
            **HEADERS,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json",
        }, timeout=15)

        if resp.ok:
            data = resp.json()
            pins = []
            resource_data = data.get("resource_response", {}).get("data", [])
            if isinstance(resource_data, list):
                for pin in resource_data:
                    if isinstance(pin, dict):
                        images = pin.get("images", {})
                        orig = images.get("orig", {}) or images.get("736x", {})
                        url = orig.get("url", "")
                        if url:
                            pins.append(url)
            return pins
    except Exception as e:
        print(f"  API approach failed: {e}")

    return []


def main():
    print(f"Fetching Pinterest board: {BOARD_URL}")
    all_images = []
    all_videos = []

    # Try API first
    print("  Trying Pinterest API...")
    api_pins = try_pinterest_api(USERNAME, BOARD_SLUG)
    if api_pins:
        print(f"  API returned {len(api_pins)} pins")
        all_images = api_pins
    else:
        # Fall back to HTML scraping
        print("  API returned nothing, trying HTML scrape...")
        try:
            html = fetch_page(BOARD_URL)
            all_images, all_videos = extract_pins_from_html(html)
            print(f"  HTML scrape found {len(all_images)} images + {len(all_videos)} videos")
        except Exception as e:
            print(f"  HTML scrape failed: {e}")

    # Build map: thumbnail hash → video URL
    video_hash_map = {}
    for v in all_videos:
        m = re.search(r'/([a-f0-9]{32,})', v)
        if m:
            video_hash_map[m.group(1)] = v

    # Filter out duplicates and junk
    seen = set()
    filtered = []
    SKIP_HASHES = {'d53b014d86a6b6761bf649a0ed813c2b'}

    for url in all_images:
        if url not in seen and 'profile' not in url.lower():
            skip = False
            for h in SKIP_HASHES:
                if h in url:
                    skip = True
                    break
            if skip:
                continue
            seen.add(url)

            # Check if this is a video thumbnail — swap for actual video
            img_hash = re.search(r'/([a-f0-9]{32,})', url)
            video_url = video_hash_map.get(img_hash.group(1)) if img_hash else None

            if video_url:
                filtered.append({
                    "src": video_url,
                    "board": BOARD_SLUG,
                    "isVideo": True,
                })
            else:
                filtered.append({
                    "src": url,
                    "board": BOARD_SLUG,
                })

    output = {
        "username": USERNAME,
        "board": BOARD_SLUG,
        "board_url": BOARD_URL,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(filtered),
        "images": filtered,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone! {len(filtered)} images saved to {OUTPUT_FILE}")
    if len(filtered) == 0:
        print("  (Board may be empty or still syncing — run again later)")


if __name__ == "__main__":
    main()
