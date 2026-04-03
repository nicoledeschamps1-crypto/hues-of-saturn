#!/usr/bin/env python3
"""
Cosmos Scraper for Hues of Saturn
Scrapes all public collections from cosmos.so/huesofsaturn
and saves image URLs to cosmos-data.json.

Usage:  python3 update-cosmos.py
"""

import json
import re
import time
import requests

USERNAME = "huesofsaturn"
BASE_URL = f"https://www.cosmos.so/{USERNAME}"
CDN_PATTERN = re.compile(r'https://cdn\.cosmos\.so/[a-f0-9\-]{20,}')
OUTPUT_FILE = "cosmos-data.json"

# URLs to skip — profile avatars, covers, UI elements
# These appear on every page and aren't content
SKIP_URLS = set()

# Keywords in page HTML that suggest Pinterest-sourced content
PINTEREST_MARKERS = [
    'pinterest.com', 'pinimg.com', 'pin.it',
    '"pinterest"', "'pinterest'", 'data-pin',
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_page(url):
    """Fetch a page with a browser-like user-agent."""
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.text


def extract_collections(html):
    """Extract collection slugs from the RSC payload."""
    slugs = re.findall(r'"slug":"([^"]+)"', html)
    # Dedupe preserving order
    seen = set()
    result = []
    for s in slugs:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def extract_images(html):
    """Extract unique CDN image URLs from a page."""
    raw_urls = CDN_PATTERN.findall(html)
    # Dedupe preserving order, skip tiny avatars by checking context
    seen = set()
    urls = []
    for url in raw_urls:
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def is_pinterest_context(html, cdn_url):
    """Check if a CDN URL appears near Pinterest markers in the HTML."""
    # Find the position of this URL in the HTML
    pos = html.find(cdn_url)
    if pos == -1:
        return False
    # Check a window around the URL for Pinterest markers
    window = html[max(0, pos - 500):pos + 500].lower()
    return any(marker in window for marker in PINTEREST_MARKERS)


def add_images(html, source_name, all_images, seen_globally):
    """Extract images from HTML and add new ones to the list."""
    cdn_urls = extract_images(html)
    count = 0
    skipped_pin = 0
    for u in cdn_urls:
        if u not in seen_globally:
            # Skip images that appear near Pinterest references
            if is_pinterest_context(html, u):
                seen_globally.add(u)
                skipped_pin += 1
                continue
            seen_globally.add(u)
            all_images.append({
                "src": u + "?format=webp&w=400",
                "collection": source_name,
            })
            count += 1
    if skipped_pin:
        print(f"  (skipped {skipped_pin} Pinterest-sourced)")
    return count, len(cdn_urls)


def find_avatar_urls():
    """Find URLs that appear on every page — these are avatars/UI, not content."""
    print("Identifying avatar/UI images to exclude...")
    pages = [f"{BASE_URL}", f"{BASE_URL}/collections"]
    url_counts = {}

    for page_url in pages:
        try:
            html = fetch_page(page_url)
            urls = set(CDN_PATTERN.findall(html))
            for u in urls:
                url_counts[u] = url_counts.get(u, 0) + 1
        except Exception:
            pass
        time.sleep(0.3)

    # URLs on both pages are likely avatars
    avatars = {u for u, c in url_counts.items() if c >= 2}
    if avatars:
        print(f"  Excluding {len(avatars)} avatar/UI images")
    return avatars


def main():
    all_images = []
    seen_globally = set()

    # Find and exclude avatar URLs
    avatar_urls = find_avatar_urls()
    seen_globally.update(avatar_urls)

    # 1. Scrape Elements page (all individual saves)
    print(f"\nFetching elements from {BASE_URL} ...")
    try:
        elements_html = fetch_page(BASE_URL)
        new, total = add_images(elements_html, "elements", all_images, seen_globally)
        print(f"  elements: {new} new images ({total} total on page)\n")
    except Exception as e:
        print(f"  elements: ERROR {e}\n")
    time.sleep(0.5)

    # 2. Scrape each collection
    print(f"Fetching collections from {BASE_URL}/collections ...")
    collections_html = fetch_page(f"{BASE_URL}/collections")
    slugs = extract_collections(collections_html)
    print(f"Found {len(slugs)} collections: {', '.join(slugs)}\n")

    for slug in slugs:
        url = f"{BASE_URL}/{slug}"
        print(f"  {slug} ...", end=" ", flush=True)
        try:
            html = fetch_page(url)
            new, total = add_images(html, slug, all_images, seen_globally)
            print(f"{new} new images ({total} total on page)")
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(0.5)

    output = {
        "username": USERNAME,
        "profile": f"https://www.cosmos.so/{USERNAME}",
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "collections": ["elements"] + slugs,
        "total": len(all_images),
        "images": all_images,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone! {len(all_images)} images saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
