import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
};

export type CategoryWithItems = Category & {
  items: (Item & { reaction_count?: number; match_count?: number; user_reacted?: boolean })[];
};

// Placeholder prompts shown in the "why" note field, per category type.
// Reduces blank-canvas anxiety when adding an item.
export const NOTE_PROMPTS: Record<CategoryType, string[]> = {
  movies_series: ['mass buildup, story hit different...', 'overrated because...', 'rewatch value is unmatched...'],
  songs: ['listen to this at 2 AM...', 'childhood core memory...', 'this beat lives in my head...'],
  food: ['best I have ever had, period...', 'go-to comfort order...', 'worth the wait, trust me...'],
  places: ['underrated spot, go before it blows up...', 'perfect weekend hangout...', 'view alone is worth it...'],
  custom: ['why this made the list...', ''],
};
