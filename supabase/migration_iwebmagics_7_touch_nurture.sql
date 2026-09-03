-- iWebMagics 7-Touch WhatsApp Nurture Migration
-- Creates scheduled_drips table and helper RPC functions for n8n

-- 1. Create scheduled_drips Table
CREATE TABLE IF NOT EXISTS public.scheduled_drips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    touch_step INTEGER NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, cancelled, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron job performance
CREATE INDEX IF NOT EXISTS idx_scheduled_drips_cron
ON public.scheduled_drips (status, scheduled_for)
WHERE status = 'pending';

-- Index for fast lead lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_drips_lead
ON public.scheduled_drips (lead_id, status);

-- 2. Function to cancel all pending nurture drips when a lead replies ("STOP DRIP")
CREATE OR REPLACE FUNCTION public.cancel_lead_drips(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.scheduled_drips
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE lead_id = p_lead_id
      AND status = 'pending';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'cancelled_count', v_updated_count,
        'lead_id', p_lead_id
    );
END;
$$;

-- 3. Function for n8n cron job to retrieve due drips with lead metadata
CREATE OR REPLACE FUNCTION public.get_due_scheduled_drips(p_org_id UUID)
RETURNS TABLE (
    drip_id UUID,
    lead_id UUID,
    phone_number TEXT,
    touch_step INTEGER,
    lead_name TEXT,
    lead_metadata JSONB,
    lead_temperature TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sd.id AS drip_id,
        sd.lead_id,
        sd.phone_number,
        sd.touch_step,
        COALESCE(l.name, l.customer_name, 'Customer') AS lead_name,
        COALESCE(l.metadata, '{}'::jsonb) AS lead_metadata,
        COALESCE(l.lead_temperature, 'COLD') AS lead_temperature
    FROM public.scheduled_drips sd
    JOIN public.leads l ON l.id = sd.lead_id
    WHERE sd.org_id = p_org_id
      AND sd.status = 'pending'
      AND sd.scheduled_for <= NOW()
      AND (l.lead_temperature IS NULL OR l.lead_temperature != 'SUPPRESSED')
    ORDER BY sd.scheduled_for ASC
    LIMIT 50;
END;
$$;
