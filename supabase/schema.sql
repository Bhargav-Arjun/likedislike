-- Run this in Supabase SQL Editor

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  bio text,
  accent_color text default 'blue',
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  title text not null,
  subtitle text,
  why_note text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table categories enable row level security;
alter table items enable row level security;

-- Anyone can read any profile/category/item (public pages)
create policy "public read profiles" on profiles for select using (true);
create policy "public read categories" on categories for select using (true);
create policy "public read items" on items for select using (true);

-- Only the owner can insert/update/delete their own data
create policy "own profile write" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own categories write" on categories for all
  using (auth.uid() = (select id from profiles where id = profile_id))
  with check (auth.uid() = (select id from profiles where id = profile_id));

create policy "own items write" on items for all
  using (auth.uid() = (select p.id from profiles p join categories c on c.profile_id = p.id where c.id = category_id))
  with check (auth.uid() = (select p.id from profiles p join categories c on c.profile_id = p.id where c.id = category_id));

-- Auto-create profile row on signup (username set later by user)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user' || substr(new.id::text, 1, 8), 'New User');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
