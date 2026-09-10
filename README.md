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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
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
- **User-centric category voice** — defaults are now "Movies I like",
  "Songs that play on my playlist", "Food I like to eat", "Places that make
  me comfortable" instead of generic "Top rated ..." labels
- **Notifications (owner only)** — a bell icon top-right of your own
  profile opens a read-only feed of who related to or matched your items.
  Real 1-to-1 messaging (the "discuss" icon on each item, and a general
  message button visitors see) is intentionally a placeholder in Phase 1 —
  tapping it shows a "Messaging launches in Phase 2" toast rather than
  opening a chat. The `conversations`/`messages` tables and their
  notification triggers are still in the schema so this can be turned on
  later without a data model change.
- **Floating "+" button** — moved to a fixed bottom-right position (thumb
  zone, doesn't block content while scrolling) rather than inline next to
  Edit profile. Easy to move back if you'd rather have it bottom-center or
  in its original spot -- one class change in `app/[username]/page.tsx`.
- **Faster navigation** — profile data now loads via parallel requests
  instead of one-after-another, and the Edit Profile page is prefetched in
  the background so tapping "Edit profile" feels instant
- **Instagram-style empty state** — a brand-new profile (zero items added)
  shows just the avatar and a "Create" button, matching Instagram's "Create
  your first post" screen, instead of four empty category placeholders at
  once. The floating "+" button only appears after the first item exists.
- **Likes / Dislikes swipe tabs** — once a profile has items, the content
  area becomes two swipeable tabs (thumbup / thumbdown icons in the tab bar,
  in the same screen position Instagram uses for grid/reels/tagged). Swipe
  left for dislikes, right for likes, or tap the icons directly. Categories
  are filtered to the active tab.
- **Notification previews** — the notifications feed now shows a small
  thumbnail of the liked/matched item next to the text, similar to how
  Instagram previews a story inside a DM reply.

## Fixes from the latest round

- **Swipe bug fixed** — swiping Dislikes -> Likes wasn't registering
  because the swipeable area shrank to almost nothing when a tab had no
  items. It now has a fixed minimum height so swipes work consistently
  both directions regardless of content.
- **Tab bar always visible** — the Likes/Dislikes icon tabs now show even
  on a brand-new profile with nothing added yet (previously they only
  appeared once an item existed), so the swipe structure is visible from
  the start. They're neutral (no green/red highlight) until there's
  actually something to show.
- **Decorative empty-state graphic** — the empty items section and the
  empty Messages screen now show a colorful illustration (`EmptyIllustration`
  component) instead of duplicating the user's own profile photo.
- **"Messages" screen** — renamed from Notifications to Messages
  (`app/messages/page.tsx`) since that's the mental model requested: shows
  who liked/matched your items with a small preview, no typing/reply --
  real chat is still Phase 2.
- **Note length raised to 100 characters** (was 60) -- both in the Add
  Item form and the database constraint (see MIGRATION 4 in schema.sql).
- **Branding matches the domain** -- "GetMe" renamed to "Getmee" throughout
  (sign-in screen, page title, footer) to match `getmee.vercel.app`.

## X-inspired redesign (UI only -- no functionality changed)

The home/profile screen (`app/[username]/page.tsx`) and item cards were
restyled to match X's layout, fonts, and colors:

- **Top bar** -- small avatar top-left (tap to open a half-open drawer with
  your name, social links incl. **Threads**, and a "Profile" link to Edit
  Profile), "iSpace" wordmark centered, notification/message icon top-right
- **For You / Following tabs** -- text tabs with a blue underline on the
  active one, replacing the old thumbup/thumbdown icon tabs. Functionally
  identical: For You = Likes, Following = Dislikes, same swipe gesture.
- **Post-card items** -- small square thumbnail (not a big hero image),
  blue `@tag` above the title (`@movies`, `@songs`, `@food`, `@trips`, or a
  slugified custom category name), bold black title, X-style icon row
  (heart / repost / reply / share) at the bottom of each card
- **Share button added** -- uses the native share sheet where available,
  falls back to copying the link
- **Short video clips (10s max)** -- the Camera/Gallery upload buttons now
  accept video too; anything over 10 seconds is rejected client-side before
  upload. Item cards auto-detect and render video vs. image.
- App renamed to **iSpace** everywhere; ready for a custom icon whenever
  you send one over.

No backend/data model changes were needed for the visual parts of this
pass. Only genuinely new pieces: the `threads` profile column (MIGRATION 5
in schema.sql) and video support (reuses the existing `item-images` bucket
and `image_url` column -- no schema change needed there).

## 30-second song preview playback

Songs added via auto-fetch now carry a real playable clip:

- iTunes Search API returns a `previewUrl` for most tracks (~90 seconds --
  that's the API's own limit; there's no free/legal way to get the full
  song). When adding a song, a small clip-picker appears: play button +
  slider to choose which 30-second window of that preview to use.
- That choice is saved as `audio_preview_url` + `preview_start_seconds`
  (MIGRATION 6 in schema.sql).
- On the item card, the poster image gets a play/pause button overlaid on
  it (Spotify/Instagram-style). Only one song plays at a time across the
  whole feed -- starting one automatically pauses any other that's playing.
- Manually-added songs (no auto-fetch match) simply won't have a play
  button, since there's no audio source for them.

## Fixed: infinite loading / URL flicker on sign-in

If a logged-in account somehow ended up without a matching row in
`profiles` (for example, if a profile row got deleted while the auth
account stayed, or a very early signup happened before the auto-create
trigger existed), `/` and `/dashboard` used to redirect back and forth to
each other forever -- showing as a stuck "loading..." screen with the URL
flickering between the two.

Both pages now try to **self-heal**: if no profile row exists, they create
one directly (mirroring what the signup trigger normally does) instead of
redirecting. If that also fails -- almost always a sign the RLS policies
from `schema.sql` aren't applied -- you'll see a clear "Couldn't set up
your profile" message with a retry button instead of an endless spinner.

## Fixed: ugly/long profile URL

The username used in the URL was being generated as a random string at
signup (`userab12cd34`), completely disconnected from the person's actual
name -- that's why shared links looked long and ugly. Saving your name in
Edit Profile now auto-generates a clean slug from it (e.g. "Arjun Bhargav"
-> `/arjunbhargav`, with a number appended if that's already taken). This
only happens once, the first time -- once your URL has been customized it
won't change again on later edits, so a link you've already shared never
breaks.

**Reminder on sharing the right link:** the URL to put in your Instagram
bio is `getmee.vercel.app/yourusername` -- not a `vercel.com/...` link.
Links starting with `vercel.com` are Vercel's own dashboard pages (for
managing the deployment) and were never meant to be shared publicly.

## Other fixes in this round

- **Camera + Gallery, explicitly** — the photo upload step for
  food/places/custom items (anything without auto-fetch) now shows two
  separate buttons instead of one generic file picker: **Camera** opens
  the device camera directly, **Gallery** opens the photo library.
- **Dislikes now have their own defaults** — category headings flip to
  read naturally on the Dislikes tab ("Movies I don't like" instead of
  "Movies I like"), the note field's placeholder hint changes to a
  dislike-flavored prompt, and both "+" buttons now default to Dislike
  when you're already viewing the Dislikes tab -- previously they always
  defaulted to Like regardless of which tab you were on.
- **Cleaned up the empty-Dislikes message** — better spacing, color,
  and line length so it reads properly instead of looking cramped.

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

## Major redesign: X (Twitter)-style UI + Home feed

This round changes the app's *visual language* to match X — layout, fonts,
colors — while keeping every existing feature (reactions, match, star
ratings, notifications, categories) working the same way underneath.

- **New landing experience: `/home`** — after logging in, you now land on
  a Home feed (matching X's own Home) instead of going straight to your
  profile page. Top bar: your avatar (opens a slide-out drawer) on the
  left, "iSpace" wordmark centered, notifications bell on the right.
- **Profile drawer** — tapping the avatar slides open a half-screen panel
  (exactly like X's own account drawer) showing your avatar, name,
  `@username`, social icons (Threads added), and a "Profile" link. Tapping
  "Profile" opens the full Edit Profile page; saving there now redirects
  back to `/home`.
- **Posts, not cards** — every item (movie, song, food, place, or a custom
  category) now renders like an X post: a small thumbnail, a blue
  `@category` tag, bold black title, then the note text, then an X-style
  action row (relate / match / discuss) spaced evenly under the post.
- **For You / Following tabs on Home**, swipeable exactly like X's own
  tabs. **For You** shows everything you've added, likes and dislikes
  together (each post already carries its own like/dislike badge, so
  there's no separate sub-tab needed here).
- **"Following" is a placeholder in this phase** — see the note below on
  why, and what it would take to make it real.
- The existing per-profile page (`/[username]`, what anyone sees when they
  open your shared link) is unchanged in structure — same Likes/Dislikes
  swipe tabs as before — just restyled with the new Post look.

### Why "Following" isn't functional yet

A Following tab needs an actual follow/social-graph feature (a table
tracking who follows whom, plus UI to follow people, plus a feed query
that only pulls items from people you follow) — that's a new feature, not
a UI change, so building it silently as a UI-only reskin would mean
either faking data or leaving it broken. It's wired up as a clear "coming
in Phase 2" placeholder for now, consistent with how messaging is handled.

### Adding your icon

Once you have the iSpace icon file, drop it into the project root as
`app/icon.png` (any square PNG, 512x512 recommended) — Next.js
auto-detects that filename and uses it as the site's favicon/app icon with
no code changes needed.

### Not done in this round

- **Short video clips on posts** (<=10s) -- this needs a new database
  column, upload/compression handling, and duration validation, and was
  intentionally left out of this pass to avoid rushing it. Flagging it so
  it's not forgotten -- happy to build it next.

## Connect ID + real 1-to-1 messaging

A new feature layered on top of the existing app -- nothing already built
was redesigned or removed.

**Scope decisions made with you before building:**
- Identity stays on the existing email+password auth. Real mobile OTP was
  the spec's stated primary method, but it needs a paid SMS provider
  (Twilio or similar) which doesn't fit this project's zero-budget
  free-tier approach. The `phone` field already on profiles can still be
  filled in as a contact link -- it's just not a verification gate.
- Premium is a plain `premium_status` boolean on profiles, toggled manually
  in the Supabase table editor for now. There's no payment flow -- that's
  a separate, much larger feature if you want it later.

**What's built (MIGRATION 7 in schema.sql):**

- **Connect ID** -- every profile gets a permanent 5-character code
  (A-Z0-9, at least one letter, e.g. `K24M8`), generated server-side and
  guaranteed unique via a DB index. Shown in the profile drawer and on
  Edit Profile, read-only.
- **Anti-enumeration** -- direct SQL access to the `connect_id` column is
  revoked for every role except the table owner. The *only* way to look
  someone up by their code is the rate-limited `search_connect_id()`
  function (max 15 searches/minute/user, enforced in the database, not the
  frontend) -- reachable from the app at `/connect`.
- **Messaging reuses the existing `conversations`/`messages` tables**
  (previously only used for the disabled per-item "discuss" button) rather
  than creating new ones, per the spec's own instruction to extend instead
  of duplicate. One conversation per pair of users is enforced by a unique
  index, regardless of how it started.
- **5-message limit, enforced in the database** -- a `BEFORE INSERT`
  trigger on `messages` (not just a frontend check) blocks a 6th message
  from the person who started the conversation until the other person
  replies. A premium account skips the limit. The same trigger flips the
  conversation to `accepted` automatically the moment the recipient sends
  anything back.
- **Blocks and reports** -- new `blocks` and `reports` tables. A block in
  either direction freezes messaging immediately (checked inside the same
  trigger, so it can't be bypassed even by a premium account).
- **General send-rate limiting** -- max 20 messages/minute/sender across
  all their conversations, also enforced in the trigger.
- **Disappearing chat** -- "Exit conversation" (via the `⋮` menu in a chat
  thread) calls a server-side function that deletes the message content
  and marks the conversation `exited`, keeping just enough of the row for
  block/report history. Navigating back or closing the tab does **not**
  delete anything -- only the explicit exit action does.
- New routes: `/connect` (search), `/chats` (conversation list), and
  `/chats/[id]` (the thread itself, with live updates via Supabase
  Realtime, the message-count indicator, exit/block/report).
- The existing item-level "Message" icon and per-item "discuss" button
  (previously showing a "Phase 2" placeholder toast) now open a real
  conversation with that profile's owner.

**One more setup step:** enable Realtime replication on the `conversations`
table too (Database -> Replication), in addition to `messages` which the
original discuss feature already needed -- this is what makes an incoming
reply flip a chat from "pending" to "unlimited" live on screen without a
refresh.

## Nearby (opt-in, 1 km, computed on page-open)

A new feature -- see who else on the app is within 1 km, right now.

**Scope decisions made with you:**
- **Off by default, opt-in only.** Nobody's location is touched until they
  explicitly tap "Turn on Nearby". Turning it off clears the stored
  coordinates immediately.
- **1 km radius**, computed fresh each time the Nearby page opens -- no
  background job runs on this stack, so there's no passive "you just
  walked near someone" push notification. Opening the page is what
  triggers the check.
- Only the **latest** position is ever stored (no location history table),
  and it's ignored for matching if it's more than 24h old.

**What's built (MIGRATION 8 in schema.sql):**

- `location_sharing_enabled`, `last_lat`, `last_lng`, `location_updated_at`
  added to `profiles`. Raw coordinates are never selectable directly by
  anyone (including the person themselves) via a normal query -- column
  access is revoked, same anti-enumeration pattern as Connect ID. The only
  way distance data leaves the database is through `find_nearby_users()`,
  which returns a rounded distance in km, never coordinates.
- Distance is plain Haversine math in SQL -- no PostGIS/earthdistance
  extension needed.
- Opening `/nearby` requests the browser's location once, updates your
  stored position, then calls the matching function. A "Refresh" button
  repeats this without leaving the page.
- Each match also creates a row in the existing `notifications` table
  (type `nearby`), deduped to once per 6 hours per pair so it doesn't spam
  either person on every page reopen. It reveals who, matching the "open
  their profile" flow you described -- likes/dislikes are already public,
  and social links only show if that person has actually filled them in
  (existing behavior, unchanged).
- A "Nearby" entry was added to the profile drawer (both the shared
  `ProfileDrawer.tsx` used by `/home`, and the equivalent panel in
  `/[username]`), next to "Find people" and "Chats".

**Also cleaned up:** the old `notify_on_message` trigger (left over from
Phase 1, before `messages` was repurposed for real chat) was creating a
notification for every single DM, cluttering the Messages/bell feed. It's
dropped in this migration -- the `/chats` list already covers that job.

