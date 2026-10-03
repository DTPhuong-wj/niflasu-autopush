CREATE TABLE public.listening_books (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.listening_lessons (
  id text PRIMARY KEY,
  book_id text NOT NULL REFERENCES public.listening_books(id) ON DELETE CASCADE,
  unit int NOT NULL,
  number int NOT NULL,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.listening_script_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id text NOT NULL REFERENCES public.listening_lessons(id) ON DELETE CASCADE,
  position int NOT NULL,
  speaker text NOT NULL DEFAULT '',
  japanese text NOT NULL,
  furigana jsonb NOT NULL DEFAULT '[]'::jsonb,
  translation text NOT NULL DEFAULT '',
  needs_review boolean NOT NULL DEFAULT false
);
CREATE INDEX ON public.listening_script_lines(lesson_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_books, public.listening_lessons, public.listening_script_lines TO anon, authenticated;
GRANT ALL ON public.listening_books, public.listening_lessons, public.listening_script_lines TO service_role;
ALTER TABLE public.listening_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_script_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all books" ON public.listening_books FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all lessons" ON public.listening_lessons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all lines" ON public.listening_script_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "listening audio read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'listening-audio');
CREATE POLICY "listening audio write" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'listening-audio');
CREATE POLICY "listening audio delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'listening-audio');