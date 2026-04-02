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
CDN_PATTERN = re.compile(r'https://cdn\.cosmos\.so/[a-f0-9\-]+')
OUTPUT_FILE = "cosmos-data.json"

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


def main():
    print(f"Fetching collections from {BASE_URL}/collections ...")
    collections_html = fetch_page(f"{BASE_URL}/collections")
    slugs = extract_collections(collections_html)
    print(f"Found {len(slugs)} collections: {', '.join(slugs)}\n")

    all_images = []
    seen_globally = set()

    for slug in slugs:
        url = f"{BASE_URL}/{slug}"
        print(f"  {slug} ...", end=" ", flush=True)
        try:
            html = fetch_page(url)
            cdn_urls = extract_images(html)
            count = 0
            for u in cdn_urls:
                if u not in seen_globally:
                    seen_globally.add(u)
                    all_images.append({
                        "src": u + "?format=webp&w=400",
                        "collection": slug,
                    })
                    count += 1
            print(f"{count} new images ({len(cdn_urls)} total on page)")
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(0.5)

    output = {
        "username": USERNAME,
        "profile": f"https://www.cosmos.so/{USERNAME}",
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "collections": slugs,
        "total": len(all_images),
        "images": all_images,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone! {len(all_images)} images saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
