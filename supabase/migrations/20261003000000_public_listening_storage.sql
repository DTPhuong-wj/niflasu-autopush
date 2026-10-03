create table if not exists public.listening_books (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.listening_lessons (
  id text primary key,
  book_id text not null references public.listening_books (id) on delete cascade,
  unit integer not null,
  number integer not null,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listening_script_lines (
  id text primary key default gen_random_uuid()::text,
  lesson_id text not null references public.listening_lessons (id) on delete cascade,
  position integer not null,
  speaker text not null default '',
  japanese text not null default '',
  furigana jsonb not null default '[]'::jsonb,
  translation text not null default '',
  needs_review boolean not null default false
);

alter table public.listening_books enable row level security;
alter table public.listening_lessons enable row level security;
alter table public.listening_script_lines enable row level security;

drop policy if exists "Public can manage listening books" on public.listening_books;
create policy "Public can manage listening books"
  on public.listening_books for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Public can manage listening lessons" on public.listening_lessons;
create policy "Public can manage listening lessons"
  on public.listening_lessons for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Public can manage listening script lines" on public.listening_script_lines;
create policy "Public can manage listening script lines"
  on public.listening_script_lines for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.listening_books to anon, authenticated;
grant select, insert, update, delete on public.listening_lessons to anon, authenticated;
grant select, insert, update, delete on public.listening_script_lines to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listening-audio', 'listening-audio', true, null, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read listening audio" on storage.objects;
create policy "Public can read listening audio"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listening-audio');

drop policy if exists "Public can upload listening audio" on storage.objects;
create policy "Public can upload listening audio"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'listening-audio');

drop policy if exists "Public can update listening audio" on storage.objects;
create policy "Public can update listening audio"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'listening-audio')
  with check (bucket_id = 'listening-audio');

drop policy if exists "Public can delete listening audio" on storage.objects;
create policy "Public can delete listening audio"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'listening-audio');
