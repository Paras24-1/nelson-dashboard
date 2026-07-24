-- ============================================================
-- Google Maps Scraper Integration Migration
-- Run this inside your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jncmizoejeaclpnfxazg/sql/new
-- ============================================================

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    max_results INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, scraping, completed, failed
    scraped_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create scraped_leads table
CREATE TABLE IF NOT EXISTS scraped_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating TEXT,
    reviews_count TEXT,
    category TEXT,
    google_maps_url TEXT,
    imported BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_org_id ON scraping_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_job_id ON scraped_leads(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_org_id ON scraped_leads(org_id);
