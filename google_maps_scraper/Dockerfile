# Use official Microsoft Playwright image pre-configured with Python and Chromium/Firefox dependencies
FROM mcr.microsoft.com/playwright/python:v1.48.0-noble

# Set working directory inside the container
WORKDIR /app

# Copy dependency definition
COPY requirements.txt .

# Install dependencies (e.g. Playwright itself)
RUN pip install --no-cache-dir -r requirements.txt

# Ensure playwright browsers are installed (Microsoft image has them pre-loaded, but this ensures safety)
RUN playwright install chromium

# Copy Python scripts
COPY scraper.py .
COPY runner.py .

# Environment variables setup (can also be passed directly in Railway control panel)
ENV PYTHONUNBUFFERED=1

# Start the Supabase queue daemon runner
CMD ["python", "runner.py"]
