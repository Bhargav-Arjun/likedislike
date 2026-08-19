# likedislike — setup steps

## 1. Supabase (backend, free tier)
1. supabase.com → New project (free tier: 500MB DB, 50k monthly active users — plenty for 3k users)
2. Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Go to Authentication → Providers → make sure Email is enabled (magic link, no password needed)
4. Go to Authentication → URL Configuration → add your Vercel URL (once deployed) to Redirect URLs
5. Go to Settings → API → copy `Project URL` and `anon public` key

## 2. Local setup (on phone: use GitHub's web editor, or Termux, or push directly)
Create a file `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 3. Push to GitHub
Create a new repo, push this folder to it (GitHub mobile app or GitHub web upload works fine for this).

## 4. Deploy on Vercel (free tier)
1. vercel.com → New Project → import your GitHub repo
2. Add the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Vercel's Environment Variables settings
3. Deploy

## 5. Try it
- Visit your Vercel URL → "create your page" → enter email → check inbox for magic link
- After login you land on `/dashboard` — set your username, add categories (Songs, Movies, Heroes), add items
- Your public page is live at `yourapp.vercel.app/yourusername` — add this link to your Instagram bio

## What's built
- Passwordless auth (magic link — no password to manage)
- Editable profile: username, display name, bio, accent color
- Categories + items with title / subtitle / why-note
- Public profile page, server-rendered (fast, shareable)
- Row Level Security in Supabase — only you can edit your own data, anyone can view

## Next ideas (not built yet, for later)
- Drag-to-reorder categories/items
- "why I don't like X" comparison field per item
- Custom category icons
- View count per profile
