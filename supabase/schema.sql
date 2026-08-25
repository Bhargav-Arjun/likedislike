drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.notify_on_reaction() cascade;
drop function if exists public.notify_on_match() cascade;
drop function if exists public.notify_on_message() cascade;

drop table if exists notifications cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists item_matches cascade;
drop table if exists item_reactions cascade;
drop table if exists items cascade;
drop table if exists categories cascade;
drop table if exists profiles cascade;



-- Run this entire file in Supabase SQL Editor (Project -> SQL Editor -> New query)

-- Run this entire file in Supabase SQL Editor (Project -> SQL Editor -> New query)

-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null,
  avatar_url text,
  accent_color text default 'blue',
  whatsapp text,
  youtube text,
  snapchat text,
  facebook text,
  gmail text,
  telegram text,
  phone text,
  created_at timestamptz default now()
);

-- ============ CATEGORIES ============
-- Each profile gets default categories on signup (via trigger below).
-- type controls behavior: 'movies_series' | 'songs' | 'food' | 'places' | 'custom'
create table categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  type text not null default 'custom',
  item_limit int not null default 20,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============ ITEMS ============
create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null, -- denormalized for fast RLS + counts
  title text not null,
  subtitle text,
  image_url text,
  why_note text check (char_length(why_note) <= 100),
  stance text not null check (stance in ('like', 'dislike')),
  rating numeric(2,1) check (rating >= 0 and rating <= 5 and rating * 2 = floor(rating * 2)), -- half-star steps
  external_source text, -- 'tmdb' | 'itunes' | 'manual'
  external_id text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============ REACTIONS (heart = "I relate / agree") ============
create table item_reactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  reactor_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (item_id, reactor_id)
);

-- ============ MATCHES (repost: "this is in my list too") ============
-- Logs who copied which item, so we can show a match count and avoid duplicate copies.
create table item_matches (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid references items(id) on delete cascade not null,
  copied_item_id uuid references items(id) on delete cascade not null,
  matcher_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (source_item_id, matcher_id)
);

-- ============ CONVERSATIONS + MESSAGES (private 1-to-1, item-anchored) ============
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references profiles(id) on delete cascade not null,
  user_b uuid references profiles(id) on delete cascade not null,
  item_id uuid references items(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_a, user_b, item_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz default now()
);

-- ============ NOTIFICATIONS ============
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('reaction', 'match', 'message')),
  item_id uuid references items(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============ INDEXES ============
create index idx_categories_profile on categories(profile_id);
create index idx_items_category on items(category_id);
create index idx_items_profile on items(profile_id);
create index idx_reactions_item on item_reactions(item_id);
create index idx_matches_source on item_matches(source_item_id);
create index idx_messages_conversation on messages(conversation_id);
create index idx_notifications_recipient on notifications(recipient_id, read);

-- ============ ROW LEVEL SECURITY ============
alter table profiles enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table item_reactions enable row level security;
alter table item_matches enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- Profiles: public read, owner write
create policy "public read profiles" on profiles for select using (true);
create policy "own profile write" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Categories: public read, owner write
create policy "public read categories" on categories for select using (true);
create policy "own categories write" on categories for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Items: public read, owner write
create policy "public read items" on items for select using (true);
create policy "own items write" on items for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Reactions: public read (counts visible), any logged-in user can react/unreact as themselves
create policy "public read reactions" on item_reactions for select using (true);
create policy "own reactions write" on item_reactions for all
  using (auth.uid() = reactor_id) with check (auth.uid() = reactor_id);

-- Matches: public read (counts visible), any logged-in user can log their own match
create policy "public read matches" on item_matches for select using (true);
create policy "own matches write" on item_matches for all
  using (auth.uid() = matcher_id) with check (auth.uid() = matcher_id);

-- Conversations: only participants can see/create
create policy "participants read conversations" on conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "participants create conversations" on conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- Messages: only participants of the parent conversation
create policy "participants read messages" on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
create policy "participants send messages" on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Notifications: only the recipient can read/update (mark as read) their own
create policy "own notifications read" on notifications for select
  using (auth.uid() = recipient_id);
create policy "own notifications update" on notifications for update
  using (auth.uid() = recipient_id);
create policy "system inserts notifications" on notifications for insert
  with check (true); -- triggers insert on behalf of actors; safe since only non-sensitive fields

-- ============ AUTO-SETUP ON SIGNUP ============
-- Creates profile + 4 default categories (Movies+Series, Songs, Food, Places) for every new user.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_profile_id uuid;
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user' || substr(new.id::text, 1, 8), 'New User')
  returning id into new_profile_id;

  insert into public.categories (profile_id, name, type, item_limit, sort_order) values
    (new_profile_id, 'Movies I like', 'movies_series', 20, 0),
    (new_profile_id, 'Songs that play on my playlist', 'songs', 15, 1),
    (new_profile_id, 'Food I like to eat', 'food', 10, 2),
    (new_profile_id, 'Places that make me comfortable', 'places', 10, 3);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ AUTO-NOTIFY ON REACTION ============
create or replace function public.notify_on_reaction()
returns trigger as $$
declare
  item_owner uuid;
begin
  select profile_id into item_owner from items where id = new.item_id;
  if item_owner is not null and item_owner != new.reactor_id then
    insert into notifications (recipient_id, actor_id, type, item_id)
    values (item_owner, new.reactor_id, 'reaction', new.item_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_reaction_created
  after insert on item_reactions
  for each row execute function public.notify_on_reaction();

-- ============ AUTO-NOTIFY ON MATCH ============
create or replace function public.notify_on_match()
returns trigger as $$
declare
  item_owner uuid;
begin
  select profile_id into item_owner from items where id = new.source_item_id;
  if item_owner is not null and item_owner != new.matcher_id then
    insert into notifications (recipient_id, actor_id, type, item_id)
    values (item_owner, new.matcher_id, 'match', new.source_item_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_match_created
  after insert on item_matches
  for each row execute function public.notify_on_match();

-- ============ AUTO-NOTIFY ON MESSAGE ============
create or replace function public.notify_on_message()
returns trigger as $$
declare
  recipient uuid;
begin
  select case when user_a = new.sender_id then user_b else user_a end
  into recipient from conversations where id = new.conversation_id;

  if recipient is not null then
    insert into notifications (recipient_id, actor_id, type, conversation_id)
    values (recipient, new.sender_id, 'message', new.conversation_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_message_created
  after insert on messages
  for each row execute function public.notify_on_message();

-- ============ MIGRATION 2: run this if you already ran schema.sql once ============
-- (New installs: this is already folded into the sections above/below, no separate action needed)

-- Gender field for Edit Profile (not shown publicly, matches Instagram's own pattern)
alter table profiles add column if not exists gender text;

-- Friendlier default category names (only affects rows still using the old defaults)
update categories set name = 'Movies I like' where name = 'Top rated movies';
update categories set name = 'Songs I listen' where name = 'Top rated songs';
update categories set name = 'I love food' where name = 'Top rated food';
update categories set name = 'Best places to visit' where name = 'Best places';

-- Storage policies -- this is the actual fix for "photo upload stops showing after a
-- while": making a bucket "Public" only controls read access. Without an explicit
-- policy, authenticated users have no permission to upload/overwrite files at all,
-- so uploads were silently failing.
create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "owner upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner update avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner delete avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public read item images" on storage.objects for select
  using (bucket_id = 'item-images');
create policy "owner upload item images" on storage.objects for insert
  with check (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner update item images" on storage.objects for update
  using (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner delete item images" on storage.objects for delete
  using (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ MIGRATION 3: friendlier, user-centric category names ============
update categories set name = 'Songs that play on my playlist' where name in ('Top rated songs', 'Songs I listen');
update categories set name = 'Food I like to eat' where name in ('Top rated food', 'I love food');
update categories set name = 'Places that make me comfortable' where name in ('Best places', 'Best places to visit');

-- ============ MIGRATION 4: raise the "why" note limit from 60 to 100 chars ============
alter table items drop constraint if exists items_why_note_check;
alter table items add constraint items_why_note_check check (char_length(why_note) <= 100);

