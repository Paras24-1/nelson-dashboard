"""
Google Maps Lead Scraper
========================
Extracts business contact details from Google Maps search results.
Uses Playwright for browser automation.

Usage:
    python scraper.py "Dentists in Mumbai" --max-results 50
    python scraper.py "Restaurants in Delhi" --max-results 100 --output leads.csv
"""

import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print("❌ Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)


# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
GOOGLE_MAPS_URL = "https://www.google.com/maps"
SCROLL_PAUSE = 1.5          # seconds between scrolls
DETAIL_LOAD_WAIT = 1.0      # seconds to wait for detail panel
MAX_SCROLL_RETRIES = 5      # stop scrolling after N retries with no new results
DEFAULT_MAX_RESULTS = 50
OUTPUT_DIR = Path(__file__).parent / "output"


# ─────────────────────────────────────────────
# Scraper Class
# ─────────────────────────────────────────────
class GoogleMapsScraper:
    """Scrapes business listings from Google Maps search results."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser = None
        self.page = None
        self.playwright = None

    def start(self):
        """Launch browser."""
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=["--disable-blink-features=AutomationControlled"]
        )
        self.page = self.browser.new_page(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        # Block images and fonts for speed
        self.page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}", lambda route: route.abort())

    def stop(self):
        """Close browser."""
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    def _handle_consent(self):
        """Try to dismiss any Google consent / cookie dialogs."""
        consent_selectors = [
            "button:has-text('Accept all')",
            "button:has-text('Accept All')",
            "button:has-text('I agree')",
            "button:has-text('Agree')",
            "form[action*='consent'] button",
            "[aria-label='Accept all']",
            "button:has-text('Reject all')",  # Fallback: reject instead
        ]
        for sel in consent_selectors:
            try:
                btn = self.page.locator(sel).first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    print("   🍪 Dismissed consent dialog")
                    time.sleep(2)
                    return True
            except Exception:
                continue
        return False

    def _save_debug_screenshot(self, name: str = "debug"):
        """Save a screenshot for debugging."""
        debug_dir = Path(__file__).parent / "output"
        debug_dir.mkdir(parents=True, exist_ok=True)
        path = debug_dir / f"{name}_{int(time.time())}.png"
        try:
            self.page.screenshot(path=str(path), full_page=True)
            print(f"   📸 Debug screenshot saved: {path}")
        except Exception as e:
            print(f"   ⚠️  Could not save screenshot: {e}")

    def search(self, query: str):
        """Navigate to Google Maps and perform a search."""
        import urllib.parse

        # Strategy 1: Direct search URL (most reliable — skips needing to find search box)
        encoded_query = urllib.parse.quote_plus(query)
        search_url = f"https://www.google.com/maps/search/{encoded_query}/"

        print(f"🔍 Searching Google Maps for: \"{query}\"")
        print(f"   🌐 Loading: {search_url}")

        self.page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # Handle consent dialogs (may appear on first visit)
        self._handle_consent()
        time.sleep(2)

        # Check if we landed on results page by looking for the feed
        feed = self.page.locator('div[role="feed"]')
        try:
            feed.wait_for(timeout=10000)
            print("   ✅ Results page loaded successfully")
            return
        except PlaywrightTimeout:
            print("   ⚠️  Feed not found via direct URL, trying search box fallback...")

        # Strategy 2: Navigate to maps homepage and use search box
        self.page.goto(GOOGLE_MAPS_URL, wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)
        self._handle_consent()
        time.sleep(2)

        # Try multiple search box selectors
        search_selectors = [
            "#searchboxinput",
            "input[name='q']",
            "input[aria-label*='Search']",
            "input[aria-label*='search']",
            "input[placeholder*='Search']",
            "#searchbox input",
            "input.searchboxinput",
        ]

        search_box = None
        for sel in search_selectors:
            try:
                candidate = self.page.locator(sel).first
                if candidate.is_visible(timeout=3000):
                    search_box = candidate
                    print(f"   🔎 Found search box with selector: {sel}")
                    break
            except Exception:
                continue

        if search_box is None:
            self._save_debug_screenshot("search_box_not_found")
            raise RuntimeError(
                "Could not find Google Maps search box. "
                "Check the debug screenshot in the output/ folder."
            )

        search_box.click()
        time.sleep(0.5)
        search_box.fill(query)
        search_box.press("Enter")
        time.sleep(4)

    def _scroll_results_panel(self, max_results: int) -> int:
        """Scroll the results panel to load more listings. Returns count of loaded items."""
        # The results panel is the scrollable div containing business cards
        feed_selector = 'div[role="feed"]'

        try:
            self.page.wait_for_selector(feed_selector, timeout=10000)
        except PlaywrightTimeout:
            print("⚠️  Could not find results panel. The search may have returned no results.")
            return 0

        previous_count = 0
        no_change_count = 0

        while no_change_count < MAX_SCROLL_RETRIES:
            # Scroll the feed panel
            self.page.evaluate(f"""
                const feed = document.querySelector('{feed_selector}');
                if (feed) feed.scrollTop = feed.scrollHeight;
            """)
            time.sleep(SCROLL_PAUSE)

            # Count currently loaded items
            items = self.page.locator(f'{feed_selector} > div > div > a[href*="/maps/place/"]')
            current_count = items.count()

            # Check for "end of results" indicator
            end_marker = self.page.locator("p.fontBodyMedium span:has-text('end of list')")
            reached_end = False
            try:
                reached_end = end_marker.is_visible(timeout=500)
            except Exception:
                pass

            if not reached_end:
                # Also check for the "You've reached the end" text
                try:
                    end_text = self.page.locator("span:has-text(\"You've reached the end\")")
                    reached_end = end_text.is_visible(timeout=500)
                except Exception:
                    pass

            if reached_end:
                print(f"📋 Reached end of results. Total listings found: {current_count}")
                break

            if current_count >= max_results:
                print(f"📋 Reached target of {max_results} results. Loaded: {current_count}")
                break

            if current_count == previous_count:
                no_change_count += 1
            else:
                no_change_count = 0
                print(f"   📦 Loaded {current_count} listings...", end="\r")

            previous_count = current_count

        return min(current_count, max_results)

    def _extract_detail(self, link_element) -> dict:
        """Click a listing and extract its details from the side panel."""
        data = {
            "name": "",
            "address": "",
            "phone": "",
            "website": "",
            "rating": "",
            "reviews_count": "",
            "category": "",
            "google_maps_url": "",
        }

        try:
            link_element.click()
            time.sleep(DETAIL_LOAD_WAIT)

            # ── Name ──
            try:
                name_el = self.page.locator("h1.DUwDvf")
                if name_el.is_visible(timeout=3000):
                    data["name"] = name_el.inner_text().strip()
            except Exception:
                pass

            # ── Rating ──
            try:
                rating_el = self.page.locator("div.F7nice span[aria-hidden='true']").first
                if rating_el.is_visible(timeout=1000):
                    data["rating"] = rating_el.inner_text().strip()
            except Exception:
                pass

            # ── Reviews count ──
            try:
                reviews_el = self.page.locator("div.F7nice span[aria-label*='reviews']")
                if reviews_el.is_visible(timeout=1000):
                    label = reviews_el.get_attribute("aria-label") or ""
                    match = re.search(r"([\d,]+)", label)
                    if match:
                        data["reviews_count"] = match.group(1).replace(",", "")
            except Exception:
                pass

            # ── Category ──
            try:
                cat_el = self.page.locator("button.DkEaL")
                if cat_el.is_visible(timeout=1000):
                    data["category"] = cat_el.inner_text().strip()
            except Exception:
                pass

            # ── Info rows (address, phone, website) ──
            info_buttons = self.page.locator('div.rogA2c div[class*="Io6YTe"]')
            info_count = info_buttons.count()

            for i in range(info_count):
                try:
                    parent = info_buttons.nth(i).locator("..")
                    aria_label = parent.get_attribute("aria-label") or ""
                    text = info_buttons.nth(i).inner_text().strip()

                    if not text:
                        continue

                    # Use aria-label and data-item-id to classify
                    data_item_id = parent.get_attribute("data-item-id") or ""

                    if "address" in aria_label.lower() or "address" in data_item_id:
                        data["address"] = text
                    elif "phone" in aria_label.lower() or "phone" in data_item_id:
                        data["phone"] = text
                    elif "website" in aria_label.lower() or "authority" in data_item_id:
                        data["website"] = text
                except Exception:
                    continue

            # ── Fallback: try button-based extraction ──
            if not data["address"]:
                try:
                    addr_btn = self.page.locator('button[data-item-id="address"]')
                    if addr_btn.is_visible(timeout=500):
                        data["address"] = addr_btn.get_attribute("aria-label") or ""
                        data["address"] = data["address"].replace("Address: ", "")
                except Exception:
                    pass

            if not data["phone"]:
                try:
                    phone_btn = self.page.locator('button[data-item-id*="phone"]')
                    if phone_btn.is_visible(timeout=500):
                        data["phone"] = phone_btn.get_attribute("aria-label") or ""
                        data["phone"] = data["phone"].replace("Phone: ", "")
                except Exception:
                    pass

            if not data["website"]:
                try:
                    web_link = self.page.locator('a[data-item-id="authority"]')
                    if web_link.is_visible(timeout=500):
                        data["website"] = web_link.get_attribute("href") or ""
                except Exception:
                    pass

            # ── Google Maps URL ──
            data["google_maps_url"] = self.page.url

        except Exception as e:
            print(f"   ⚠️  Error extracting details: {e}")

        return data

    def scrape(self, query: str, max_results: int = DEFAULT_MAX_RESULTS) -> list[dict]:
        """
        Main method: search Google Maps and scrape business details.
        Returns a list of dicts with business data.
        """
        self.search(query)

        # Scroll to load listings
        loaded_count = self._scroll_results_panel(max_results)
        if loaded_count == 0:
            print("❌ No results found for this search query.")
            return []

        # Collect listing links
        feed_selector = 'div[role="feed"]'
        listing_links = self.page.locator(f'{feed_selector} > div > div > a[href*="/maps/place/"]')
        total = min(listing_links.count(), max_results)

        print(f"\n🏢 Extracting details from {total} businesses...\n")

        results = []
        for idx in range(total):
            try:
                link = listing_links.nth(idx)

                # Scroll the listing into view
                link.scroll_into_view_if_needed()
                time.sleep(0.3)

                data = self._extract_detail(link)

                if data["name"]:
                    results.append(data)
                    phone_display = data["phone"] or "N/A"
                    website_display = data["website"][:40] + "..." if len(data.get("website", "")) > 40 else (data["website"] or "N/A")
                    print(f"   ✅ [{idx + 1}/{total}] {data['name']}")
                    print(f"       📞 {phone_display}  |  🌐 {website_display}")
                else:
                    print(f"   ⏭️  [{idx + 1}/{total}] Skipped (no data)")

                # Go back to results list
                back_btn = self.page.locator('button[aria-label="Back"]')
                if back_btn.is_visible(timeout=2000):
                    back_btn.click()
                    time.sleep(1)

            except Exception as e:
                print(f"   ❌ [{idx + 1}/{total}] Error: {e}")
                # Try to recover by navigating back
                try:
                    back_btn = self.page.locator('button[aria-label="Back"]')
                    if back_btn.is_visible(timeout=2000):
                        back_btn.click()
                        time.sleep(1)
                except Exception:
                    pass

        print(f"\n✨ Successfully scraped {len(results)} out of {total} businesses!")
        return results


# ─────────────────────────────────────────────
# Export Functions
# ─────────────────────────────────────────────
def export_csv(results: list[dict], filepath: Path):
    """Export results to CSV."""
    if not results:
        print("⚠️  No results to export.")
        return

    filepath.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = ["name", "address", "phone", "website", "rating", "reviews_count", "category", "google_maps_url"]
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"📁 CSV saved to: {filepath}")


def export_json(results: list[dict], filepath: Path):
    """Export results to JSON."""
    if not results:
        return

    filepath.parent.mkdir(parents=True, exist_ok=True)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"📁 JSON saved to: {filepath}")


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="🗺️  Google Maps Lead Scraper — Extract business contact details",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scraper.py "Dentists in Mumbai"
  python scraper.py "Restaurants in Delhi" --max-results 100
  python scraper.py "Plumbers in Bangalore" --output plumbers.csv --visible
        """,
    )
    parser.add_argument("query", help='Search query (e.g., "Dentists in Mumbai")')
    parser.add_argument("--max-results", "-n", type=int, default=DEFAULT_MAX_RESULTS,
                        help=f"Maximum number of results to scrape (default: {DEFAULT_MAX_RESULTS})")
    parser.add_argument("--output", "-o", type=str, default=None,
                        help="Output CSV filename (default: auto-generated)")
    parser.add_argument("--json", action="store_true",
                        help="Also export results as JSON")
    parser.add_argument("--visible", action="store_true",
                        help="Run browser in visible (non-headless) mode")

    args = parser.parse_args()

    # Generate output filename
    if args.output:
        csv_path = OUTPUT_DIR / args.output
    else:
        safe_query = re.sub(r"[^\w\s-]", "", args.query).strip().replace(" ", "_").lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = OUTPUT_DIR / f"{safe_query}_{timestamp}.csv"

    # Banner
    print("=" * 60)
    print("🗺️  Google Maps Lead Scraper")
    print("=" * 60)
    print(f"   Query:       {args.query}")
    print(f"   Max Results: {args.max_results}")
    print(f"   Output:      {csv_path}")
    print(f"   Headless:    {not args.visible}")
    print("=" * 60)
    print()

    # Scrape
    scraper = GoogleMapsScraper(headless=not args.visible)
    try:
        scraper.start()
        results = scraper.scrape(args.query, max_results=args.max_results)
    except KeyboardInterrupt:
        print("\n\n⛔ Scraping interrupted by user.")
        results = []
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        results = []
    finally:
        scraper.stop()

    # Export
    if results:
        export_csv(results, csv_path)
        if args.json:
            json_path = csv_path.with_suffix(".json")
            export_json(results, json_path)

        # Summary table
        print(f"\n{'=' * 60}")
        print(f"📊 SUMMARY")
        print(f"{'=' * 60}")
        print(f"   Total scraped:    {len(results)}")
        with_phone = sum(1 for r in results if r.get("phone"))
        with_website = sum(1 for r in results if r.get("website"))
        with_address = sum(1 for r in results if r.get("address"))
        print(f"   With phone:       {with_phone} ({with_phone * 100 // len(results)}%)")
        print(f"   With website:     {with_website} ({with_website * 100 // len(results)}%)")
        print(f"   With address:     {with_address} ({with_address * 100 // len(results)}%)")
        print(f"{'=' * 60}")
    else:
        print("\n😔 No data was collected.")


if __name__ == "__main__":
    main()
