-- Supabase -> SQL Editor mein ye poora paste karke "Run" dabao (sirf ek baar)

create table if not exists public.memories (
  id bigint generated always as identity primary key,
  content text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security ON: bahar se koi seedha table nahi padh sakta.
-- Hamara server "service_role" key use karta hai jo RLS bypass karti hai.
alter table public.memories enable row level security;
