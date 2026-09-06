-- Add is_blocked column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
