-- Create bot_locks table for distributed locking
create table if not exists public.bot_locks (
    id text primary key, -- 'gateway_shard_0'
    instance_id text not null,
    last_seen_at timestamptz not null default now()
);

-- Enable RLS (optional, but good practice, though we usually run as service role)
alter table public.bot_locks enable row level security;

-- Policy: Allow all access (for simplicity with service role interaction)
create policy "Allow all access" on public.bot_locks for all using (true) with check (true);
