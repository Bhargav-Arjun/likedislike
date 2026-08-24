# likedislike — Phase 1

Your taste, one link. Movies, series, songs, food, places — what you like and
why, on a single shareable profile. Built for a free-tier stack targeting
3–4k users.

## What's included

- Email + password auth (single screen, toggle between Sign up / Log in —
  no separate landing page, no magic link, no email step at all when
  "Confirm email" is off per the setup steps below)
- Public profile at `yourapp.vercel.app/username` — no separate pages per
  category, everything scrolls on one screen
- Default categories on signup: Movies+Series (20 item limit), Songs (15),
  Food (10), Places (10)
- Auto-fetch posters/covers: TMDB for movies+series, iTunes Search API for
  songs (free, no key needed). Food/places/anything else use manual photo
  upload.
- 5-star rating with half-star taps, for Movies+Series and Food only
- Like/dislike stance per item, shown as a thumbup/thumbdown badge
- Heart ("I relate") reactions from other logged-in users, with a
  notification to the item owner
- Match ("this is in my list too") — copies an item into the tapping user's
  own matching category, logged so it can't be double-counted
- Private 1-to-1 messaging anchored to a specific item ("discuss")
- Notifications table + triggers for reactions, matches, and messages
- Social links row (WhatsApp, YouTube, Snapchat, Facebook, Gmail, Telegram,
  phone) — only filled-in platforms are shown on the public profile
- Edit profile as its own screen; adding an item opens as a bottom-sheet
  overlay on the same page (no navigation away)

## 1. Supabase setup

1. supabase.com → New project (free tier: 500MB DB, 50k monthly active
   users — comfortable for 3–4k users)
2. SQL Editor → paste all of `supabase/schema.sql` → Run. This creates every
   table, RLS policy, and the triggers that auto-create a profile + default
   categories on signup, and auto-create notifications on reactions,
   matches, and messages.
3. Authentication → Providers → Email → confirm it's enabled, and **turn
   off "Confirm email"**. This is the important step: with it off, signup
   creates the account instantly with no email sent at all — no magic
   link, no confirmation click, and no chance of hitting Supabase's default
   email rate limit (which is very low and is what causes the "email rate
   limit exceeded" error during testing).
4. Authentication → URL Configuration → add your Vercel URL to Redirect URLs
   once deployed
5. Storage → Create bucket → name it `avatars` → toggle **Public bucket** on
6. Storage → Create bucket → name it `item-images` → toggle **Public
   bucket** on
7. Database → Replication → enable replication on the `messages` table (this
   powers the live chat in `/messages/[id]`)
8. Settings → API → copy `Project URL` and `publishable` key

## 2. TMDB setup (free, for movie/series auto-fetch)

1. themoviedb.org → create a free account → Settings → API → request an API
   key (choose "Developer", approval is instant)
2. Copy the API key (v3 auth)

Songs need no setup — the iTunes Search API is open and free.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
TMDB_API_KEY=...
```

## 4. Push to GitHub

Create a new repo and push this folder (GitHub's web upload or mobile app
works fine for this).

## 5. Deploy on Vercel (free tier)

1. vercel.com → New Project → import your repo
2. Add all three environment variables from step 3 in Vercel's Environment
   Variables settings
3. Deploy

## 6. Try it

- Visit your Vercel URL → you land straight on the sign up screen → enter
  email + password → account is created instantly and you land on your own
  profile at `/your-auto-username` with 4 empty default categories already
  there
- Returning visitors who are already logged in are redirected straight to
  their profile if they open the root URL again
- Tap the `+` button → pick a category → search (auto-fetch) or upload a
  photo → add your note, rating, and like/dislike → Save
- Tap "Edit profile" to add a display name, avatar, and social links
- Share `yourapp.vercel.app/yourusername` — add it to your Instagram bio

## How usernames work

There's no separate "user ID" field to fill in. A username is generated
automatically at signup and used only in the profile URL — it doesn't
change if the person edits their display name later, so shared links never
break.

## Updating an existing deployment (Phase 1.1)

If you already ran `schema.sql` once, don't re-run the whole file (it will
error on "already exists"). Instead, open `supabase/schema.sql`, scroll to
the **MIGRATION 2** section near the bottom, copy just that section, and run
it in the SQL Editor. It adds:

- A `gender` field on profiles (Edit Profile only, not shown publicly)
- Renames the 4 default categories to friendlier names
- **Storage policies for the `avatars` and `item-images` buckets** — this is
  the fix for photo uploads silently failing after the first try. Making a
  bucket "Public" only controls who can *view* files; without these
  policies nobody had permission to *upload* to it.

## New in this update

- **Custom categories** — in the "+ Add item" sheet, the category dropdown
  has a "+ New category" option at the bottom to create your own (Cars,
  Superheroes, anything), alongside the 4 defaults
- **Delete an item** — long-press (or press-and-hold) any item card as the
  owner to bring up a delete confirmation
- **Gender field** — added to Edit Profile, private (not shown on the
  public page), matching how Instagram handles it
- **Instagram-style header** — avatar on the left, likes/dislikes stacked
  to the right in a row, name below, matching the reference screenshots

## Notes on scope

- Match "percentage compatibility" between two profiles was discussed but
  superseded by the simpler per-item match/repost feature — not built in
  Phase 1.
- The "unpopular opinion" pinned quote and the "download as Instagram story"
  taste-summary graphic were flagged as good Phase 2/3 ideas, not included
  here to keep this build focused.
- The public profile page fetches data client-side rather than via
  server-side rendering. This keeps all the interactive bits (reactions,
  match, star editing) simple to wire up correctly; if SEO/link-preview
  quality becomes important later, this page can be converted to a
  server component with a client wrapper for the interactive parts.
