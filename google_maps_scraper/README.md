# 🗺️ Google Maps Lead Scraper

Extract business contact details (name, address, phone, website, ratings) from Google Maps search results. Built with Playwright for browser automation.

## Setup

```bash
# Navigate to the scraper directory
cd /Users/trimanjotsingh/.gemini/antigravity/scratch/google_maps_scraper

# Install dependencies
pip install -r requirements.txt

# Install Chromium browser for Playwright
playwright install chromium
```

## Usage

### Basic usage
```bash
python scraper.py "Dentists in Mumbai"
```

### With options
```bash
# Scrape 100 results
python scraper.py "Restaurants in Delhi" --max-results 100

# Custom output filename
python scraper.py "Plumbers in Bangalore" --output plumbers.csv

# Also export as JSON
python scraper.py "Cafes in Pune" --max-results 30 --json

# Run with visible browser (useful for debugging)
python scraper.py "Hotels in Goa" --visible
```

## Output

Results are saved to the `output/` folder as CSV files. Each row contains:

| Field | Description |
|-------|-------------|
| `name` | Business name |
| `address` | Full address |
| `phone` | Phone number |
| `website` | Website URL |
| `rating` | Star rating (1-5) |
| `reviews_count` | Number of reviews |
| `category` | Business category |
| `google_maps_url` | Direct Google Maps link |

## ⚠️ Disclaimer

This tool is for **educational purposes only**. Scraping Google Maps may violate Google's Terms of Service. Use responsibly and consider the official [Google Places API](https://developers.google.com/maps/documentation/places/web-service) for production use.
