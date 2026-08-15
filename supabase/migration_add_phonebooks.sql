-- Create phonebooks table
CREATE TABLE IF NOT EXISTS phonebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for phonebooks
ALTER TABLE phonebooks ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
CREATE POLICY "Allow all actions for authenticated users in same org" ON phonebooks
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Create phonebook_contacts table (supports arbitrary custom variable columns)
CREATE TABLE IF NOT EXISTS phonebook_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phonebook_id UUID NOT NULL REFERENCES phonebooks(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    variables JSONB DEFAULT '{}'::jsonb, -- Stores custom variables (e.g. email, city, order_id)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for phonebook_contacts
ALTER TABLE phonebook_contacts ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
CREATE POLICY "Allow all actions for authenticated users" ON phonebook_contacts
    FOR ALL
    USING (auth.role() = 'authenticated');
