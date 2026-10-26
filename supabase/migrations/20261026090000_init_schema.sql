-- ============================================================================
-- Marginalia — initial schema
-- Personal reading journal: profiles, books, quotes, journal entries, goals.
-- Every personal row is owned by auth.users.id and protected by RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Private helper schema (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Bumps updated_at and the optimistic-concurrency version on every update.
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  -- Ownership can never change, even if a policy were misconfigured later.
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- profiles uses "id" rather than "user_id", so it gets its own toucher.
create or replace function private.touch_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.reading_status as enum (
  'want_to_read',
  'reading',
  'completed',
  'paused',
  'dnf'
);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) <= 60),
  theme         text not null default 'system' check (theme in ('system', 'light', 'dark')),
  version       integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function private.touch_profile();

-- Create a profile automatically when someone registers.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Books (shelf + wishlist; wishlist = status 'want_to_read')
-- ---------------------------------------------------------------------------
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- bibliographic metadata
  title           text not null check (char_length(btrim(title)) between 1 and 500),
  authors         text[] not null check (cardinality(authors) between 1 and 20),
  summary         text check (summary is null or char_length(summary) <= 20000),
  summary_source  text check (summary_source in ('google_books', 'open_library', 'manual')),
  genres          text[] not null default '{}' check (cardinality(genres) <= 20),
  cover_url       text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 2048)),
  isbn            text check (isbn is null or char_length(isbn) <= 20),
  publisher       text check (publisher is null or char_length(publisher) <= 300),
  published_year  smallint check (published_year between -3000 and 2200),
  page_count      integer check (page_count between 1 and 50000),
  source          text not null default 'manual' check (source in ('google_books', 'open_library', 'manual')),
  external_id     text check (external_id is null or char_length(external_id) <= 200),

  -- personal reading data
  status          public.reading_status not null default 'want_to_read',
  current_page    integer not null default 0 check (current_page >= 0),
  rating          numeric(2, 1) check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  review          text check (review is null or char_length(review) <= 50000),
  notes           text check (notes is null or char_length(notes) <= 50000),
  why_it_matters  text check (why_it_matters is null or char_length(why_it_matters) <= 5000),
  started_on      date,
  finished_on     date,
  is_favorite     boolean not null default false,

  -- wishlist
  wish_reason     text check (wish_reason is null or char_length(wish_reason) <= 2000),
  wish_priority   smallint check (wish_priority between 1 and 3),

  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint books_current_page_within_total
    check (page_count is null or current_page <= page_count),
  constraint books_finished_after_started
    check (finished_on is null or started_on is null or finished_on >= started_on),
  -- lets child tables reference (id, user_id) so a row can only point at
  -- a book owned by the same user
  constraint books_id_user_unique unique (id, user_id)
);

create index books_user_created_idx on public.books (user_id, created_at desc);
create index books_user_status_idx  on public.books (user_id, status);

create trigger books_touch
  before update on public.books
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------------
-- Favorite quotes (belong to a book)
-- ---------------------------------------------------------------------------
create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id     uuid not null,
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  page        integer check (page between 1 and 50000),
  note        text check (note is null or char_length(note) <= 2000),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint quotes_book_fk
    foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade
);

create index quotes_user_idx on public.quotes (user_id);
create index quotes_book_idx on public.quotes (book_id);

create trigger quotes_touch
  before update on public.quotes
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------------
-- Journal entries (optionally linked to a book; kept if the book is removed)
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id     uuid,
  entry_date  date not null default current_date,
  title       text check (title is null or char_length(title) <= 200),
  body        text not null check (char_length(btrim(body)) between 1 and 50000),
  quote       text check (quote is null or char_length(quote) <= 5000),
  quote_page  integer check (quote_page between 1 and 50000),
  tags        text[] not null default '{}' check (cardinality(tags) <= 30),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint journal_book_fk
    foreign key (book_id, user_id) references public.books (id, user_id) on delete set null (book_id)
);

create index journal_user_date_idx on public.journal_entries (user_id, entry_date desc);
create index journal_book_idx      on public.journal_entries (book_id);

create trigger journal_touch
  before update on public.journal_entries
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------------
-- Reading goals (one row per user per year; also holds Book of the Year)
-- ---------------------------------------------------------------------------
create table public.reading_goals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year               smallint not null check (year between 2000 and 2200),
  target_books       smallint check (target_books between 1 and 1000),
  book_of_year_id    uuid,
  book_of_year_note  text check (book_of_year_note is null or char_length(book_of_year_note) <= 2000),
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint reading_goals_user_year_unique unique (user_id, year),
  constraint reading_goals_book_fk
    foreign key (book_of_year_id, user_id) references public.books (id, user_id) on delete set null (book_of_year_id)
);

create index reading_goals_book_idx on public.reading_goals (book_of_year_id);

create trigger reading_goals_touch
  before update on public.reading_goals
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; CRUD for signed-in users, filtered by RLS.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.books, public.quotes, public.journal_entries, public.reading_goals
  from anon, public;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete
  on public.books, public.quotes, public.journal_entries, public.reading_goals
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.books           enable row level security;
alter table public.quotes          enable row level security;
alter table public.journal_entries enable row level security;
alter table public.reading_goals   enable row level security;

-- profiles: only your own row
create policy "profiles: read own"   on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- books
create policy "books: read own"   on public.books for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "books: insert own" on public.books for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "books: update own" on public.books for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "books: delete own" on public.books for delete to authenticated
  using ((select auth.uid()) = user_id);

-- quotes
create policy "quotes: read own"   on public.quotes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "quotes: insert own" on public.quotes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "quotes: update own" on public.quotes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "quotes: delete own" on public.quotes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- journal entries
create policy "journal: read own"   on public.journal_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal: insert own" on public.journal_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "journal: update own" on public.journal_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "journal: delete own" on public.journal_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- reading goals
create policy "goals: read own"   on public.reading_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "goals: insert own" on public.reading_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "goals: update own" on public.reading_goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "goals: delete own" on public.reading_goals for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes (RLS still decides who receives them)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime
  add table public.profiles, public.books, public.quotes, public.journal_entries, public.reading_goals;

-- ---------------------------------------------------------------------------
-- Storage: uploaded cover images, one folder per user ("<uid>/<file>")
-- Covers are served by public URL (unguessable path); only the owner can
-- upload, replace, list or delete files in their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "covers: read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
