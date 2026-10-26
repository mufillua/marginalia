-- Cover the composite (book_id, user_id) foreign keys so cascades and
-- set-null actions on book deletion don't scan the child tables.
drop index if exists public.quotes_book_idx;
drop index if exists public.journal_book_idx;
drop index if exists public.reading_goals_book_idx;

create index quotes_book_user_idx        on public.quotes (book_id, user_id);
create index journal_book_user_idx       on public.journal_entries (book_id, user_id);
create index reading_goals_book_user_idx on public.reading_goals (book_of_year_id, user_id);
