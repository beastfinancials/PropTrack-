-- Run this entire block in your Supabase SQL Editor

-- Accounts table
create table accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  firm text not null,
  plan text,
  size numeric,
  status text default 'evaluation',
  days_complete integer default 0,
  days_required integer,
  profit numeric,
  eval_cost numeric,
  notes text,
  created_at timestamptz default now()
);

-- Transactions table
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'spent' or 'earned'
  firm text not null,
  amount numeric not null,
  note text,
  created_at timestamptz default now()
);

-- Row Level Security: users can only see their own data
alter table accounts enable row level security;
alter table transactions enable row level security;

create policy "Users see own accounts" on accounts for all using (auth.uid() = user_id);
create policy "Users see own transactions" on transactions for all using (auth.uid() = user_id);
