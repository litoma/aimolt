-- Create prompts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_type TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (though mostly public access for this use case, standard practice)
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public/anon) since prompts are config
CREATE POLICY "Allow public read access" ON public.prompts FOR SELECT USING (true);

-- Allow write access only to service role (admin)
CREATE POLICY "Allow service role write access" ON public.prompts FOR ALL USING (auth.role() = 'service_role');
