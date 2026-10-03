create table if not exists public.listening_books (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  script jsonb not null default '[]'::jsonb check (jsonb_typeof(script) = 'array'),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  book_id text references public.listening_books (id) on delete cascade,
  unit integer not null default 1,
  number integer not null default 1,
  data jsonb not null default '{}'::jsonb
);

create index if not exists lessons_book_sort_idx on public.lessons (book_id, unit, number);

alter table public.lessons enable row level security;
alter table public.listening_books enable row level security;

create or replace function public.is_listening_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_listening_admin() from public, anon;
grant execute on function public.is_listening_admin() to authenticated;

drop policy if exists "Public can manage listening books" on public.listening_books;
drop policy if exists "Public can read listening books" on public.listening_books;
drop policy if exists "Admins can insert listening books" on public.listening_books;
drop policy if exists "Admins can update listening books" on public.listening_books;
drop policy if exists "Admins can delete listening books" on public.listening_books;

create policy "Public can read listening books"
  on public.listening_books for select to anon, authenticated
  using (true);
create policy "Admins can insert listening books"
  on public.listening_books for insert to authenticated
  with check (public.is_listening_admin());
create policy "Admins can update listening books"
  on public.listening_books for update to authenticated
  using (public.is_listening_admin())
  with check (public.is_listening_admin());
create policy "Admins can delete listening books"
  on public.listening_books for delete to authenticated
  using (public.is_listening_admin());

drop policy if exists "Public can read lessons" on public.lessons;
drop policy if exists "Admins can insert lessons" on public.lessons;
drop policy if exists "Admins can update lessons" on public.lessons;
drop policy if exists "Admins can delete lessons" on public.lessons;

create policy "Public can read lessons"
  on public.lessons for select to anon, authenticated
  using (true);
create policy "Admins can insert lessons"
  on public.lessons for insert to authenticated
  with check (public.is_listening_admin());
create policy "Admins can update lessons"
  on public.lessons for update to authenticated
  using (public.is_listening_admin())
  with check (public.is_listening_admin());
create policy "Admins can delete lessons"
  on public.lessons for delete to authenticated
  using (public.is_listening_admin());

revoke all on public.lessons, public.listening_books from public, anon, authenticated;
grant select on public.lessons, public.listening_books to anon;
grant select, insert, update, delete on public.lessons, public.listening_books to authenticated;

-- Keep the old normalized tables read-only for rollback and migration recovery.
drop policy if exists "Public can manage listening lessons" on public.listening_lessons;
drop policy if exists "Public can manage listening script lines" on public.listening_script_lines;
revoke all on public.listening_lessons, public.listening_script_lines from public, anon, authenticated;
grant select on public.listening_lessons, public.listening_script_lines to anon, authenticated;

-- Preserve legacy rows, including each line's stable ID and complete script fields.
do $$
begin
  if to_regclass('public.listening_lessons') is not null
     and to_regclass('public.listening_script_lines') is not null then
    execute $migration$
      insert into public.lessons (
        id, title, script, audio_path, created_at, updated_at, book_id, unit, number, data
      )
      select
        case
          when old.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then old.id::uuid
          else (
            substr(md5(old.id), 1, 8) || '-' ||
            substr(md5(old.id), 9, 4) || '-' ||
            substr(md5(old.id), 13, 4) || '-' ||
            substr(md5(old.id), 17, 4) || '-' ||
            substr(md5(old.id), 21, 12)
          )::uuid
        end,
        old.title,
        coalesce(lines.script, '[]'::jsonb),
        null,
        old.created_at,
        old.updated_at,
        old.book_id,
        old.unit,
        old.number,
        coalesce(old.data, '{}'::jsonb) ||
          case when old.audio_path is null then '{}'::jsonb
               else jsonb_build_object('legacyAudioPath', old.audio_path) end
      from public.listening_lessons old
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', line.id,
            'speaker', line.speaker,
            'japanese', line.japanese,
            'furigana', line.furigana,
            'translation', line.translation,
            'needsReview', line.needs_review
          ) order by line.position
        ) as script
        from public.listening_script_lines line
        where line.lesson_id = old.id
      ) lines on true
      on conflict (id) do nothing
    $migration$;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, null, null)
on conflict (id) do update
set public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read listening audio" on storage.objects;
drop policy if exists "Public can upload listening audio" on storage.objects;
drop policy if exists "Public can update listening audio" on storage.objects;
drop policy if exists "Public can delete listening audio" on storage.objects;
drop policy if exists "Public can read audio" on storage.objects;
drop policy if exists "Admins can upload audio" on storage.objects;
drop policy if exists "Admins can update audio" on storage.objects;
drop policy if exists "Admins can delete audio" on storage.objects;
drop policy if exists "Admins can delete legacy listening audio" on storage.objects;

create policy "Public can read audio"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'audio');
create policy "Admins can upload audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and public.is_listening_admin());
create policy "Admins can update audio"
  on storage.objects for update to authenticated
  using (bucket_id = 'audio' and public.is_listening_admin())
  with check (bucket_id = 'audio' and public.is_listening_admin());
create policy "Admins can delete audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and public.is_listening_admin());

-- Legacy public audio remains readable, but anonymous writes are revoked.
create policy "Public can read listening audio"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listening-audio');
create policy "Admins can delete legacy listening audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listening-audio' and public.is_listening_admin());
