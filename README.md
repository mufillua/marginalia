# Marginalia — a reading journal

A private, cloud-synced book tracker: a bookshelf, a to-read list, a notebook-style
journal and a quiet "reading year", for one reader across all her devices.

- **Angular 22** (standalone components, signals, zoneless, strict TypeScript, SCSS)
- **Supabase** — Auth (email + password, reset), Postgres with Row Level Security,
  Realtime for live cross-device sync, Storage for uploaded cover photos
- **Google Books** for search and metadata, with **Open Library** as automatic fallback
- **Lucide** icons, self-hosted **Literata** + **Instrument Sans** fonts

---

## 1. What's already set up

A Supabase project was created for this app:

| | |
|---|---|
| Project | `marginalia-reading-journal` (org *maimoondigital*, region Mumbai `ap-south-1`) |
| Project ref | `nrbqgzqrxohjumjrnwmb` |
| URL | `https://nrbqgzqrxohjumjrnwmb.supabase.co` |

Both migrations in `supabase/migrations/` have been applied to it: tables, RLS
policies, triggers, realtime publication and the `covers` storage bucket. The
security advisor reports no issues.

`.env` (not committed) already holds this project's URL and **publishable** key.

## 2. Things you must configure in the Supabase dashboard

These can't be set from code. Do them before she signs up.

### a) Email sending (required for sign-up confirmation and password reset)

Supabase's built-in mailer **only delivers to members of your Supabase organization**
and is heavily rate-limited. Her confirmation and reset emails will fail with
"Email address not authorized" until you either:

1. **Recommended:** add custom SMTP (e.g. Resend's free tier) under
   *Authentication → Emails → SMTP Settings*, **or**
2. Create her account yourself: *Authentication → Users → Add user → Create new user*,
   tick **Auto Confirm User**, and give her the password. (Password resets will still
   need SMTP, or you can reset it from the same screen.)

### b) URLs (required for email links and Google sign-in)

*Authentication → URL Configuration*

- **Site URL:** your production URL, e.g. `https://marginalia.vercel.app`
- **Redirect URLs:** add
  - `https://marginalia.vercel.app/**` (your real domain)
  - `http://localhost:4200/**` (local development)

### c) Close sign-ups once she has an account (recommended)

It's a single-reader library. After her account exists, turn off
*Authentication → Sign In / Providers → Allow new users to sign up*. RLS already
keeps any other account's data separate, but this keeps strangers out entirely.

### d) Optional: Google sign-in

Enable the Google provider in *Authentication → Sign In / Providers* (needs a Google
OAuth client), then set `ENABLE_GOOGLE_SIGN_IN=true` and redeploy. The button only
appears when this flag is on.

## 3. Run locally

```bash
npm ci
cp .env.example .env      # skip if .env already exists
npm start                 # http://localhost:4200
```

`npm start` / `npm run build` first run `scripts/write-env.mjs`, which turns the
environment variables into `src/app/core/config/env.generated.ts` (git-ignored).
Without them, the app builds and shows a "setup needed" page instead of crashing.

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` (or legacy anon key). **Never** a secret/service-role key — the script refuses those. |
| `GOOGLE_BOOKS_API_KEY` | no | Raises the search quota. Restrict it to your domain in Google Cloud. |
| `ENABLE_GOOGLE_SIGN_IN` | no | `true` once Google auth is configured. |

The publishable key is designed to be public; access control lives in the database
(RLS), not in the key.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: *Add New → Project →* import the repo. `vercel.json` already sets the
   build command, output directory (`dist/marginalia/browser`) and SPA rewrites.
3. *Settings → Environment Variables*: add `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` (Production and Preview).
4. Deploy, then put the deployed URL into Supabase's **Site URL** and
   **Redirect URLs** (step 2b).

## 5. Using a fresh Supabase project instead

Run the two files in `supabase/migrations/` in order, in the SQL editor (or with
`supabase db push`), then repeat section 2 and update the env variables.

---

## How sync works

- After sign-in, everything for that user is loaded once, then kept current with
  **Supabase Realtime** (`postgres_changes`, filtered to her `user_id`).
- When the tab regains focus (after 20s away), comes back online, or realtime
  reconnects, the app **refetches** so nothing missed is lost.
- Every row has a `version` that a trigger increments on each update. Full edits
  (the book form, journal entries) only save if the row is still at the version she
  started editing; otherwise she sees "changed on another device" and the newer
  version is loaded — **an older edit never overwrites a newer one**. Merges from
  refetches and realtime events are version-aware for the same reason.
- Success messages only appear after the database confirms the write. Offline, writes
  are refused with a clear message and forms keep their content (there's no offline
  queue — new changes need a connection; reading what's loaded still works).
- Signing out clears the in-memory library and the stored session on that device.

## Security model

- RLS is enabled on every table; each policy is `to authenticated` **and** checks
  `(select auth.uid()) = user_id` (update policies use both `using` and `with check`).
- `anon` has no table privileges at all.
- Composite foreign keys `(book_id, user_id)` make it impossible to attach a quote,
  journal entry or Book of the Year to someone else's book.
- A trigger makes `user_id` immutable, so ownership can't be transferred.
- Covers upload to `covers/<user-id>/…`; storage policies restrict upload/replace/
  delete/list to the owner's own folder. Cover files are served by public URL with
  an unguessable name (fine for book covers; nothing else is stored there).

## Data model

`profiles` (name, theme) · `books` (metadata + status, progress, rating, review,
notes, favourite, wishlist reason/priority) · `quotes` (per book) ·
`journal_entries` (optionally linked to a book; kept, unlinked, if the book is
deleted) · `reading_goals` (one row per year: target and Book of the Year).
"To read" is simply `status = 'want_to_read'`, so wishlist books never count as read.

## Project structure

```
src/app/
  core/       config, models + mappers, data stores (sync), services, guards
  shared/     book cover, cards, badges, rating, progress, dialogs, toasts, utils
  features/   auth, dashboard, bookshelf, add-book (+ edit), book-details,
              reading-journal, wishlist, statistics, settings
  layout/     app shell (sidebar on desktop, tab bar on mobile)
supabase/migrations/   schema, RLS, realtime, storage
```

## Testing

```bash
npm test          # unit tests (Vitest): sync merge/conflict logic, text & date utils
npm run build     # production build
```

### What was verified during development

- **Database (live project):** 20 RLS checks run as two real users — isolation of
  books/quotes/journal/goals/profiles, URL-guessing by id, update/delete of another
  user's rows, inserting as another user, attaching quotes/entries to another user's
  book, ownership transfer, anonymous access, delete cascades, version bumps,
  stale-version updates. Plus storage-folder policies. All passed.
- **Browser (headless Chromium, against a local mock of Supabase and the book APIs,
  because the build sandbox can't reach supabase.co):** 76 end-to-end checks across
  sign-in/out, register, reset, search + import, manual add with validation,
  duplicate warning, edit, conflict handling, progress and finishing, to-read list,
  shelf search/filter/sort/views, journal CRUD and filters, statistics, goals,
  Book of the Year, refresh persistence, two-device realtime sync, refetch recovery,
  catalogue failures and fallback, offline and network-failure handling, delete,
  theme, keyboard skip link, and no horizontal overflow on a 390px phone.

### Checklist to run once deployed (real Supabase)

- [ ] Register (or sign in with the account you created) — profile name appears.
- [ ] Add a book from search; refresh — still there.
- [ ] Sign in on a phone with the same account — the same books, progress, journal.
- [ ] Update progress on the laptop — the phone updates within a second or two.
- [ ] Edit a book on the phone while the laptop's edit form is open, then save on the
      laptop — you should see the "changed on another device" message.
- [ ] Journal entry, rating, goal, Book of the Year — visible on both devices.
- [ ] Request a password reset — the email arrives (needs SMTP) and the link works.
- [ ] Sign out — the sign-in page shows and `/shelf` redirects back to it.
- [ ] Turn on airplane mode and try to save — a clear "you're offline" message, form
      contents kept.

## Credits

Literary quotes on the home page and sign-in screen are from public-domain works
(Austen, Dickinson, Thoreau, Bacon, Carroll, Charlotte Brontë), each attributed in
the interface. Book metadata comes from Google Books and Open Library; summaries are
shown as provided and labelled with their source, never generated.
