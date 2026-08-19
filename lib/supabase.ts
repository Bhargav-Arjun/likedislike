import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  accent_color: string;
};

export type Category = {
  id: string;
  profile_id: string;
  name: string;
  sort_order: number;
};

export type Item = {
  id: string;
  category_id: string;
  title: string;
  subtitle: string | null;
  why_note: string | null;
  sort_order: number;
};
