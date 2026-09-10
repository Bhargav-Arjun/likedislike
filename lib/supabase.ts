import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Missing env vars would otherwise crash the entire build (every page
  // fails to prerender). Warn loudly instead so `npm run build` succeeds
  // and the real problem -- Vercel Environment Variables not set -- shows
  // up clearly in the browser console rather than as a cryptic build error.
  console.warn(
    'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel > Settings > Environment Variables, then redeploy.'
  );
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  accent_color: string;
  whatsapp: string | null;
  youtube: string | null;
  snapchat: string | null;
  facebook: string | null;
  gmail: string | null;
  telegram: string | null;
  phone: string | null;
  threads: string | null;
  premium_status: boolean;
  location_sharing_enabled: boolean;
  location_updated_at: string | null;
  // last_lat/last_lng are intentionally NOT here -- the column grant is
  // revoked for anti-surveillance reasons (see MIGRATION 8). Use
  // findNearbyUsers() to get distances, never raw coordinates.
  // connect_id is intentionally NOT populated by a normal select('*') --
  // the DB column grant is revoked for anti-enumeration reasons (see
  // MIGRATION 7). Use getMyConnectId() for your own, or searchConnectId()
  // to look someone else up by theirs.
  gender: string | null;
};

export type CategoryType = 'movies_series' | 'songs' | 'food' | 'places' | 'custom';

export type Category = {
  id: string;
  profile_id: string;
  name: string;
  type: CategoryType;
  item_limit: number;
  sort_order: number;
};

export type Item = {
  id: string;
  category_id: string;
  profile_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  why_note: string | null;
  stance: 'like' | 'dislike';
  rating: number | null;
  external_source: string | null;
  external_id: string | null;
  sort_order: number;
  created_at: string;
  audio_preview_url: string | null;
  preview_start_seconds: number | null;
};

export type CategoryWithItems = Category & {
  items: (Item & { reaction_count?: number; match_count?: number; user_reacted?: boolean })[];
};

// Turns a display name into a URL-safe slug ("Arjun Bhargav" -> "arjunbhargav"),
// and appends a number if that slug is already taken by someone else.
export async function slugifyAndReserveUsername(name: string, ownProfileId: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'user';

  let candidate = base.length >= 3 ? base : base.padEnd(3, '0');
  let suffix = 1;

  while (true) {
    const { data } = await supabase.from('profiles').select('id').eq('username', candidate).maybeSingle();
    if (!data || data.id === ownProfileId) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
}

// Whether a username still looks like the random fallback ("userab12cd34")
// that signup/ensureProfile generate before a real name has been set --
// used so we only auto-slugify once, and don't keep changing (and breaking)
// someone's shared link every time they save unrelated profile edits.
export function looksLikeDefaultUsername(username: string): boolean {
  return /^user[a-f0-9]{8}$/i.test(username);
}

// Looks up this user's profile. If the auto-create trigger didn't fire for
// some reason (e.g. the row was deleted, or signup happened before the
// trigger existed), this creates a fallback profile + default categories
// instead of leaving the person stuck with no profile row at all --
// which is what caused the "/" <-> "/dashboard" infinite redirect loop.
export async function ensureProfile(userId: string): Promise<{ username: string } | null> {
  const { data: existing } = await supabase.from('profiles').select('username').eq('id', userId).single();
  if (existing) return existing;

  const fallbackUsername = 'user' + userId.slice(0, 8);
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username: fallbackUsername, display_name: 'New User' })
    .select('username')
    .single();

  if (error || !created) return null;

  // Mirror the default categories the signup trigger normally creates.
  await supabase.from('categories').insert([
    { profile_id: userId, name: 'Movies I like', type: 'movies_series', item_limit: 20, sort_order: 0 },
    { profile_id: userId, name: 'Songs that play on my playlist', type: 'songs', item_limit: 15, sort_order: 1 },
    { profile_id: userId, name: 'Food I like to eat', type: 'food', item_limit: 10, sort_order: 2 },
    { profile_id: userId, name: 'Places that make me comfortable', type: 'places', item_limit: 10, sort_order: 3 },
  ]);

  return created;
}

// Reduces blank-canvas anxiety when adding an item.
// Short "@tag" shown on each post, X-hashtag style (e.g. "@movies").
// X-style compact relative timestamp: "2h", "3d", or a short date past a week.
export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function categoryTagSlug(cat: { type: CategoryType; name: string }): string {
  const map: Record<CategoryType, string> = {
    movies_series: 'movies',
    songs: 'songs',
    food: 'food',
    places: 'trips',
    custom: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
  };
  return map[cat.type] || 'items';
}

// ============ Connect ID + Messaging ============

export type ConversationStatus = 'pending' | 'accepted' | 'blocked' | 'exited' | 'reported';

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  item_id: string | null;
  status: ConversationStatus;
  initiated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ConnectIdResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  connect_id: string;
};

// Returns the signed-in user's own Connect ID. Direct table selects can't
// see this column (see MIGRATION 7) -- this RPC is the one sanctioned way.
export async function getMyConnectId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_connect_id');
  if (error) return null;
  return data;
}

// Looks someone up by their Connect ID. Server-side rate-limited (15/min)
// and format-validated inside the RPC itself -- a malformed or non-existent
// code just returns an empty array, not an error, to avoid leaking anything
// about which codes are "close" to valid.
export async function searchConnectId(query: string): Promise<ConnectIdResult | null> {
  const { data, error } = await supabase.rpc('search_connect_id', { query });
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

// Finds the existing conversation between the caller and otherUserId, or
// creates a fresh 'pending' one. An 'exited' conversation is revived
// (its messages are already gone from the exit itself) rather than
// creating a second row, since the DB enforces one conversation per pair.
export async function getOrCreateConversation(myId: string, otherUserId: string): Promise<Conversation> {
  const [userA, userB] = [myId, otherUserId].sort();
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'exited') {
      const { data: revived } = await supabase
        .from('conversations')
        .update({ status: 'pending', initiated_by: myId, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      return revived as Conversation;
    }
    return existing as Conversation;
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_a: userA, user_b: userB, initiated_by: myId, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return created as Conversation;
}

// Deletes the conversation's message content and marks it 'exited' -- the
// disappearing-chat behavior. Server-side (RPC), not a plain client delete,
// so it can't be triggered by just navigating away.
export async function exitConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('exit_conversation', { convo_id: conversationId });
  if (error) throw error;
}

export async function blockUser(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: blockedId });
}

export async function reportUser(reportedUserId: string, conversationId: string | null, reason: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    conversation_id: conversationId,
    reason: reason.slice(0, 500),
  });
}

export const NOTE_PROMPTS: Record<CategoryType, string[]> = {
  movies_series: ['mass buildup, story hit different...', "didn't land for you, story fell flat..."],
  songs: ['listen to this at 2 AM...', 'skip it every single time...'],
  food: ['best I have ever had, period...', "wouldn't order this again..."],
  places: ['underrated spot, go before it blows up...', "overhyped, wouldn't go back..."],
  custom: ['why this made the list...', "why this didn't work for you..."],
};

// ============ Nearby (opt-in, 1km, computed on page-open) ============

export type NearbyUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  distance_km: number;
};

export async function toggleLocationSharing(enabled: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const update: Record<string, any> = { location_sharing_enabled: enabled };
  if (!enabled) {
    // Clear the last known position when turning this off -- no point
    // keeping a stale coordinate around once the person has opted out.
    update.last_lat = null;
    update.last_lng = null;
    update.location_updated_at = null;
  }
  await supabase.from('profiles').update(update).eq('id', user.id);
}

export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('profiles')
    .update({ last_lat: lat, last_lng: lng, location_updated_at: new Date().toISOString() })
    .eq('id', user.id);
}

export async function findNearbyUsers(radiusKm: number = 1): Promise<NearbyUser[]> {
  const { data, error } = await supabase.rpc('find_nearby_users', { radius_km: radiusKm });
  if (error) throw error;
  return data || [];
}
