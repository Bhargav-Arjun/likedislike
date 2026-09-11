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

-- ============ MIGRATION 5: Threads social link ============
alter table profiles add column if not exists threads text;

-- ============ MIGRATION 6: 30s song preview playback ============
-- audio_preview_url: the iTunes preview clip (~90s max, that's the API's own limit)
-- preview_start_seconds: where within that clip the user's chosen 30s window starts
alter table items add column if not exists audio_preview_url text;
alter table items add column if not exists preview_start_seconds numeric(5,1) default 0;

-- ============ MIGRATION 7: Connect ID + real 1:1 messaging ============
-- Reuses the existing conversations/messages tables (previously only used
-- for the disabled per-item "discuss" feature) instead of creating new ones.

-- ---- 7a. Connect ID ----
-- 5 chars, A-Z0-9, at least one letter. Stored uppercase; search input is
-- normalized to uppercase before matching, so lookups are case-insensitive
-- without needing the citext extension.
alter table profiles add column if not exists connect_id text;
alter table profiles add column if not exists premium_status boolean not null default false;

create or replace function public.generate_connect_id()
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result text;
  has_letter boolean;
  attempt int := 0;
begin
  loop
    result := '';
    has_letter := false;
    for i in 1..5 loop
      result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    -- Guarantee at least one letter: if none landed, overwrite one random
    -- position with a random letter instead of re-rolling the whole thing.
    if result !~ '[A-Z]' then
      result := overlay(result placing substr(letters, floor(random() * 26)::int + 1, 1) from (floor(random() * 5)::int + 1) for 1);
    end if;

    exit when not exists (select 1 from profiles where connect_id = result);
    attempt := attempt + 1;
    if attempt > 50 then
      raise exception 'Could not generate a unique Connect ID after 50 attempts';
    end if;
  end loop;
  return result;
end;
$$ language plpgsql volatile;

create unique index if not exists profiles_connect_id_unique on profiles (connect_id);

-- Backfill existing profiles that don't have one yet.
update profiles set connect_id = generate_connect_id() where connect_id is null;

alter table profiles alter column connect_id set not null;

-- New signups get one automatically -- extends the existing handle_new_user
-- trigger function rather than adding a second trigger.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_profile_id uuid;
begin
  insert into public.profiles (id, username, display_name, connect_id)
  values (new.id, 'user' || substr(new.id::text, 1, 8), 'New User', generate_connect_id())
  returning id into new_profile_id;

  insert into public.categories (profile_id, name, type, item_limit, sort_order) values
    (new_profile_id, 'Movies I like', 'movies_series', 20, 0),
    (new_profile_id, 'Songs that play on my playlist', 'songs', 15, 1),
    (new_profile_id, 'Food I like to eat', 'food', 10, 2),
    (new_profile_id, 'Places that make me comfortable', 'places', 10, 3);

  return new;
end;
$$ language plpgsql security definer;

-- Protection against Connect ID enumeration: revoke direct column access so
-- the ONLY way to look someone up by Connect ID is the rate-limited
-- search_connect_id() function below (which runs as the table owner and can
-- still read the column despite this revoke). Existing profile browsing by
-- username is untouched -- this only blocks scanning connect_id directly.
-- (Column-level grants are independent of the existing "public read
-- profiles" row-level policy, so no new RLS policy is needed here.)
revoke select (connect_id) on profiles from anon, authenticated;

-- The column revoke above is role-wide (can't be conditioned per-row), so
-- the owner needs their own dedicated way to read their own Connect ID for
-- display on their profile -- this function is exactly that, scoped to the
-- caller only.
create or replace function public.get_my_connect_id()
returns text as $$
  select connect_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ---- 7b. Connect ID search, rate-limited server-side ----
create table connect_id_search_log (
  id uuid primary key default gen_random_uuid(),
  searcher_id uuid references profiles(id) on delete cascade not null,
  searched_at timestamptz default now()
);
create index idx_search_log_searcher on connect_id_search_log (searcher_id, searched_at);
alter table connect_id_search_log enable row level security;
create policy "own search log" on connect_id_search_log for select using (auth.uid() = searcher_id);

create or replace function public.search_connect_id(query text)
returns table (id uuid, username text, display_name text, avatar_url text, connect_id text) as $$
declare
  normalized text;
  recent_count int;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  -- Rate limit: max 15 searches per minute per user.
  select count(*) into recent_count from connect_id_search_log
    where searcher_id = auth.uid() and searched_at > now() - interval '1 minute';
  if recent_count >= 15 then
    raise exception 'Too many searches, please wait a moment';
  end if;

  insert into connect_id_search_log (searcher_id) values (auth.uid());

  normalized := upper(trim(query));
  if normalized !~ '^[A-Z0-9]{5}$' or normalized !~ '[A-Z]' then
    return; -- invalid format -- return no rows rather than erroring, nothing to look up
  end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.connect_id
    from profiles p
    where p.connect_id = normalized;
end;
$$ language plpgsql security definer;

-- ---- 7c. Blocks + reports ----
create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "read own blocks" on blocks for select using (auth.uid() = blocker_id);
create policy "create own blocks" on blocks for insert with check (auth.uid() = blocker_id);
create policy "remove own blocks" on blocks for delete using (auth.uid() = blocker_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade not null,
  reported_user_id uuid references profiles(id) on delete cascade not null,
  conversation_id uuid,
  reason text not null check (char_length(reason) <= 500),
  created_at timestamptz default now()
);
alter table reports enable row level security;
create policy "read own reports" on reports for select using (auth.uid() = reporter_id);
create policy "create own reports" on reports for insert with check (auth.uid() = reporter_id);

-- ---- 7d. Extend conversations for real 1:1 DMs ----
-- The old unique constraint allowed multiple conversations per pair (one
-- per item, for the disabled "discuss" feature). Real messaging needs
-- exactly one conversation per pair regardless of item context.
alter table conversations drop constraint if exists conversations_user_a_user_b_item_id_key;
alter table conversations add column if not exists status text not null default 'pending'
  check (status in ('pending', 'accepted', 'blocked', 'exited', 'reported'));
alter table conversations add column if not exists updated_at timestamptz default now();
alter table conversations add column if not exists initiated_by uuid references profiles(id);

create unique index if not exists conversations_pair_unique
  on conversations (least(user_a, user_b), greatest(user_a, user_b));

-- ---- 7e. Server-side enforcement: 5-message limit, block check, rate limit,
--          auto-accept when the recipient replies. This is a DB trigger, so
--          it can't be bypassed from the client no matter what the frontend
--          does or doesn't check. ----
create or replace function public.enforce_message_rules()
returns trigger as $$
declare
  convo record;
  other_id uuid;
  sender_count int;
  is_premium boolean;
  is_blocked boolean;
  recent_send_count int;
begin
  select * into convo from conversations where id = new.conversation_id;
  if convo is null then
    raise exception 'Conversation not found';
  end if;

  other_id := case when convo.user_a = new.sender_id then convo.user_b else convo.user_a end;

  -- General anti-spam: no more than 20 messages per minute from one sender,
  -- across all their conversations.
  select count(*) into recent_send_count from messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent_send_count >= 20 then
    raise exception 'Sending too fast, please slow down';
  end if;

  -- Blocks apply in either direction and freeze messaging entirely.
  select exists(
    select 1 from blocks
    where (blocker_id = new.sender_id and blocked_id = other_id)
       or (blocker_id = other_id and blocked_id = new.sender_id)
  ) into is_blocked;
  if is_blocked then
    raise exception 'This conversation is unavailable';
  end if;

  if convo.status in ('blocked', 'reported', 'exited') then
    raise exception 'This conversation is no longer active';
  end if;

  if convo.status = 'accepted' then
    return new; -- unlimited once accepted
  end if;

  -- status = 'pending' from here on.
  if new.sender_id = convo.initiated_by then
    select premium_status into is_premium from profiles where id = new.sender_id;
    if not coalesce(is_premium, false) then
      select count(*) into sender_count from messages
        where conversation_id = new.conversation_id and sender_id = new.sender_id;
      if sender_count >= 5 then
        raise exception 'Message limit reached -- wait for a reply before sending more';
      end if;
    end if;
  else
    -- The recipient's first reply accepts the conversation, unlocking
    -- unlimited messaging for both people from now on.
    update conversations set status = 'accepted', updated_at = now() where id = new.conversation_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_rules on messages;
create trigger on_message_rules
  before insert on messages
  for each row execute function public.enforce_message_rules();

-- ---- 7f. RLS: allow participants to update conversation status (exit/report) ----
create policy "participants update conversations" on conversations for update
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ---- 7g. Disappearing chat: exiting deletes message content but keeps the
--          conversation row (so blocks/reports still have something to
--          reference), matching "keep safety metadata, not visible content" ----
create or replace function public.exit_conversation(convo_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from conversations
    where id = convo_id and (user_a = auth.uid() or user_b = auth.uid())
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  delete from messages where conversation_id = convo_id;
  update conversations set status = 'exited', updated_at = now() where id = convo_id;
end;
$$ language plpgsql security definer;


-- ============ MIGRATION 8: Nearby (opt-in, 1km radius, on-open only) ============

-- Location fields on profiles. Opt-in, off by default. Only the latest
-- position is kept (overwritten each time, no history table) -- this
-- feature only ever needs "where are you right now", not a location log.
alter table profiles add column if not exists location_sharing_enabled boolean not null default false;
alter table profiles add column if not exists last_lat numeric(9,6);
alter table profiles add column if not exists last_lng numeric(9,6);
alter table profiles add column if not exists location_updated_at timestamptz;

-- Raw coordinates are never exposed directly to other users, even via a
-- direct table query -- only find_nearby_users() below can read them (it
-- runs as the table owner), and even that only returns a distance, never
-- the coordinates themselves. location_sharing_enabled and
-- location_updated_at stay publicly readable since they're just status,
-- not a location.
revoke select (last_lat, last_lng) on profiles from anon, authenticated;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reaction', 'match', 'message', 'nearby'));

-- Haversine distance in km between two lat/lng points -- no PostGIS/
-- earthdistance extension needed, plain math.
create or replace function public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$ language sql immutable;

-- Computed on demand when the person opens the Nearby page -- no
-- background job on this stack. Only matches people who are also
-- opted in, with a location updated in the last 24h (so it reflects
-- "nearby right now", not someone who enabled this once months ago).
-- Notifies each matched person (deduped to once per 6h per pair) that
-- someone is near them, without revealing who until they open Nearby too.
create or replace function public.find_nearby_users(radius_km numeric default 1)
returns table (id uuid, username text, display_name text, avatar_url text, distance_km numeric) as $$
declare
  me record;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select location_sharing_enabled, last_lat, last_lng into me from profiles where profiles.id = auth.uid();
  if not coalesce(me.location_sharing_enabled, false) or me.last_lat is null then
    raise exception 'Enable location sharing first';
  end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url,
           round(haversine_km(me.last_lat, me.last_lng, p.last_lat, p.last_lng), 2) as distance_km
    from profiles p
    where p.id != auth.uid()
      and p.location_sharing_enabled = true
      and p.last_lat is not null
      and p.location_updated_at > now() - interval '24 hours'
      and haversine_km(me.last_lat, me.last_lng, p.last_lat, p.last_lng) <= radius_km;

-- Notify each matched person, at most once per 6 hours per pair, so it
-- doesn't spam every single time either person reopens the page.
  insert into notifications (recipient_id, actor_id, type)
  select p.id, auth.uid(), 'nearby'
  from profiles p
  where p.id != auth.uid()
    and p.location_sharing_enabled = true
    and p.last_lat is not null
    and p.location_updated_at > now() - interval '24 hours'
    and haversine_km(me.last_lat, me.last_lng, p.last_lat, p.last_lng) <= radius_km
    and not exists (
      select 1 from notifications n
      where n.type = 'nearby' and n.recipient_id = p.id and n.actor_id = auth.uid()
        and n.created_at > now() - interval '6 hours'
    );
end;
$$ language plpgsql security definer;

-- Cleanup: the old notify_on_message trigger (from when "messages" only
-- powered the disabled per-item discuss feature) now fires on every real
-- chat message too, cluttering the Messages/bell feed with one row per DM.
-- The /chats conversation list already covers that -- drop it.
drop trigger if exists on_message_created on messages;
