-- Run this in the Supabase SQL Editor to create the transactions table

CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    person_name TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    due_date TEXT,
    interest_rate TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    settled_at TIMESTAMPTZ,
    raw_transcript TEXT,
    confidence NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to see and manage only their own transactions
CREATE POLICY "Users can manage their own transactions" 
ON public.transactions 
FOR ALL 
USING (auth.uid()::text = user_id) 
WITH CHECK (auth.uid()::text = user_id);

-- If you aren't using Supabase Auth (e.g. logging in with phone/password manually managed in users table), 
-- you might want to allow anon/authenticated access to the table to allow the app to sync.
-- In that case, you can use these policies instead (less secure if not using native Supabase Auth):
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;

CREATE POLICY "Enable all access for now" 
ON public.transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant permissions to anon and authenticated roles
GRANT ALL ON TABLE public.transactions TO anon, authenticated;
