import os
import sys
import time
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from Next.js project directory
env_path_1 = Path(__file__).resolve().parents[3] / "voxaiagents" / ".env.local"
env_path_2 = Path(__file__).resolve().parents[3] / "voxaiagents" / ".env"
load_dotenv(env_path_1)
load_dotenv(env_path_2)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    print("Ensure you run this with the correct environmental variables set.")
    sys.exit(1)

# Ensure playwright and scraper script can be imported
sys.path.append(str(Path(__file__).parent))

try:
    from scraper import GoogleMapsScraper
except ImportError as e:
    print(f"❌ Error importing scraper: {e}")
    sys.exit(1)


# Setup headers for Supabase REST API
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

class SupabaseMapsScraper(GoogleMapsScraper):
    """Subclass to intercept leads as they are scraped and sync to Supabase in real-time."""
    
    def __init__(self, headless=True, on_lead_scraped=None):
        super().__init__(headless=headless)
        self.on_lead_scraped = on_lead_scraped

    def scrape(self, query: str, max_results: int = 50) -> list[dict]:
        self.search(query)
        loaded_count = self._scroll_results_panel(max_results)
        if loaded_count == 0:
            print("❌ No results found for this search query.")
            return []

        feed_selector = 'div[role="feed"]'
        listing_links = self.page.locator(f'{feed_selector} > div > div > a[href*="/maps/place/"]')
        total = min(listing_links.count(), max_results)

        print(f"\n🏢 Extracting details from {total} businesses in the cloud...\n")

        results = []
        for idx in range(total):
            try:
                link = listing_links.nth(idx)
                link.scroll_into_view_if_needed()
                time.sleep(0.3)
                data = self._extract_detail(link)

                if data["name"]:
                    results.append(data)
                    phone_display = data["phone"] or "N/A"
                    print(f"   ✅ [{idx + 1}/{total}] {data['name']} (Phone: {phone_display})")
                    
                    # Trigger the real-time sync callback
                    if self.on_lead_scraped:
                        self.on_lead_scraped(data, len(results))
                else:
                    print(f"   ⏭️  [{idx + 1}/{total}] Skipped (no name)")

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
        return results


def process_job(job):
    job_id = job["id"]
    org_id = job["org_id"]
    query = job["query"]
    max_results = job["max_results"]

    print(f"\n🚀 Running job '{query}' (Max: {max_results}) for org {org_id}...")

    # 1. Update job status to 'scraping'
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/scraping_jobs?id=eq.{job_id}",
        headers=headers,
        json={"status": "scraping", "updated_at": datetime.utcnow().isoformat()}
    )

    # Callback to push each lead to Supabase as it is found
    def sync_lead(lead_data, current_count):
        # Insert lead
        requests.post(
            f"{SUPABASE_URL}/rest/v1/scraped_leads",
            headers=headers,
            json={
                "job_id": job_id,
                "org_id": org_id,
                "name": lead_data["name"],
                "address": lead_data["address"],
                "phone": lead_data["phone"],
                "website": lead_data["website"],
                "rating": str(lead_data["rating"]),
                "reviews_count": str(lead_data["reviews_count"]),
                "category": lead_data["category"],
                "google_maps_url": lead_data["google_maps_url"]
            }
        )
        # Update job count
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/scraping_jobs?id=eq.{job_id}",
            headers=headers,
            json={"scraped_count": current_count, "updated_at": datetime.utcnow().isoformat()}
        )

    # 2. Run the Playwright scraper
    scraper = SupabaseMapsScraper(headless=True, on_lead_scraped=sync_lead)
    try:
        scraper.start()
        results = scraper.scrape(query, max_results)
        scraper.stop()

        # 3. Mark job as completed
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/scraping_jobs?id=eq.{job_id}",
            headers=headers,
            json={"status": "completed", "updated_at": datetime.utcnow().isoformat()}
        )
        print(f"✨ Finished job. Scraped {len(results)} leads.")

    except Exception as e:
        print(f"❌ Error during scraping: {e}")
        try:
            scraper.stop()
        except:
            pass
        # Mark job as failed
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/scraping_jobs?id=eq.{job_id}",
            headers=headers,
            json={"status": "failed", "error_message": str(e), "updated_at": datetime.utcnow().isoformat()}
        )


def main():
    print("🤖 Google Maps Supabase Queue Runner started...")
    print(f"📡 Listening to Supabase jobs at {SUPABASE_URL}")
    
    while True:
        try:
            # Query oldest pending job
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/scraping_jobs?status=eq.pending&select=*&order=created_at.asc&limit=1",
                headers=headers
            )
            
            if res.status_code == 200:
                jobs = res.json()
                if jobs:
                    process_job(jobs[0])
            else:
                print(f"⚠️ Error polling queue: {res.status_code} - {res.text}")
                
        except Exception as e:
            print(f"⚠️ Network error polling queue: {e}")
            
        time.sleep(5)  # Poll every 5 seconds


if __name__ == "__main__":
    main()
