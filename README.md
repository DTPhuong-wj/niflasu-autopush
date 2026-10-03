# NiFlasu AutoPush

## Development

```powershell
npm ci
npm run dev
```

The development build uses Local mode (`.env.development`). The production build uses Web mode (`.env.production`). The Listening page reads lessons from [`public/lessons.json`](./public/lessons.json) and audio from `public/audio`; it does not read Listening lessons from Supabase.

## Add a Listening lesson

Listening lessons are static files included in the app build. To add a unit, update `public/lessons.json` and add its audio file under `public/audio`. No application code or Supabase changes are needed for a normal lesson.

1. Add the audio file, for example `public/audio/Unit13.mp3`.
2. Add a lesson object to the existing `lessons` array in `public/lessons.json`. Keep the current top-level book wrapper so the lesson appears with the existing lessons. Set `unit` and `number` explicitly:

   ```json
   {
     "id": "5",
     "unit": 13,
     "number": 13,
     "title": "Lesson title",
     "description": "Short lesson description.",
     "audio": {
       "id": "audio-005",
       "filename": "Unit13.mp3",
       "url": "/audio/Unit13.mp3",
       "mimeType": "audio/mpeg"
     },
     "script": [
       {
         "id": "line-001",
         "speaker": "話者",
         "japanese": "日本語のセリフ。",
         "furigana": [{ "text": "日本語", "reading": "にほんご" }],
         "translation": "Câu thoại tiếng Nhật."
       }
     ]
   }
   ```

3. Make sure `audio.url` starts with `/audio/` and matches the file name and letter case exactly. Supported audio files must be committed under `public/audio`; a file left only in `uploads/audio` will not be served by the website.
4. Add each dialogue line to `script`. `japanese` is the displayed sentence; `speaker` and `translation` may be empty. Use `furigana` entries with `text` and `reading` to enable ruby readings.
5. Run `npm run build`, then deploy the updated files. After deployment, refresh the Listening page and open the lesson to check both playback and script.

If `unit` is omitted, the page tries to infer it from `Unit<number>` in the audio URL, then falls back to the lesson's position. Explicit `unit` and `number` values are recommended. Keep new lessons in the same book wrapper; a wrapper with a different `id` or `name` is displayed as a separate book.

## Bundled vocabulary books

The midterm noun review book is kept as source data in [`src/data/giua-ki-noun.json`](./src/data/giua-ki-noun.json) and bundled into the app, so it remains available after refresh and deploy without relying on browser storage. Its `unit: "9_10_11_12"` is presented as one combined review unit.

To add another permanent JSON vocabulary book, copy the validated JSON into `src/data`, import it in `src/routes/index.tsx`, and add it to `permanentVocabularyBooks`. Include that source change in Git and rebuild/deploy. The in-app **Thêm sách từ JSON** action remains a browser import and is not a way to write files into `src/data`.

## Legacy Supabase Listening setup (not used by the current Listening page)

The following sections document the former Supabase-backed Listening implementation and are retained for reference/migration only. They do not describe how to add lessons to the current website; use [Add a Listening lesson](#add-a-listening-lesson) instead.

### 1. Create the Supabase project and configure keys

1. Create a project at [supabase.com](https://supabase.com/).
2. In **Project Settings → API Keys**, copy the **Project URL** and **Publishable key** (`anon`/`public` on older projects).
3. For local development, create an ignored `.env.development.local` file:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

   `.env.development` already selects Local mode. For Cloudflare, set those two values as **build-time** variables for the production Worker and set `VITE_APP_MODE=web`.
4. Never put a Supabase Secret/service-role key in `VITE_*`, browser code, or Cloudflare build variables. The importer below requires the service-role key only in a private local terminal.

### 2. Create tables, migrate existing rows, bucket, and policies

Run the Supabase migrations in timestamp order in **SQL Editor**:

1. [`supabase/migrations/20261003000000_public_listening_storage.sql`](./supabase/migrations/20261003000000_public_listening_storage.sql) creates the legacy schema.
2. [`supabase/migrations/20261003010000_listening_supabase_source_of_truth.sql`](./supabase/migrations/20261003010000_listening_supabase_source_of_truth.sql) creates `public.lessons` and migrates existing normalized lesson/script rows into it.

The new `lessons` table has a UUID primary key, `title`, a JSONB `script`, `audio_path`, timestamps, and the book/order metadata needed by the existing Listening UI. Each JSONB script line contains `id`, `speaker`, `japanese`, `furigana`, and `translation` (and preserves `needsReview` when present). Existing book tables remain for grouping and navigation.

The second migration creates the public-read `audio` Storage bucket. Anonymous users can SELECT published lessons/books and read audio; only authenticated users whose **app metadata** contains `"role": "admin"` can insert, update, or delete lessons/books and upload, update, or delete audio. Legacy tables are kept read-only. The former `listening-audio` bucket remains readable to avoid breaking old references while content is migrated; only admins can remove a legacy file while replacing/deleting a migrated lesson.

To verify the deployed grants and policies in SQL Editor:

```sql
select
  has_table_privilege('anon', 'public.lessons', 'SELECT') as anon_can_read_lessons,
  has_table_privilege('anon', 'public.lessons', 'INSERT') as anon_has_insert_grant,
  has_table_privilege('anon', 'public.lessons', 'UPDATE') as anon_has_update_grant,
  has_table_privilege('anon', 'public.lessons', 'DELETE') as anon_has_delete_grant;

select policyname, tablename, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('lessons', 'listening_books')
order by tablename, policyname;

select id, name, public
from storage.buckets
where id in ('audio', 'listening-audio');
```

Expected: anonymous SELECT is granted, anonymous write grants are false, the `audio` bucket exists and is public for playback, and write policies for lessons/books/storage target `authenticated` and call `is_listening_admin()`. Test a direct anon REST insert/upload as well; it must be rejected. A signed-in account without the admin app-metadata role must also be denied by RLS even though it is authenticated.

### 3. Create a real Local administrator account

1. In Supabase, open **Authentication → Users** and create/ invite an account with a strong password. Disable public sign-up if it is not needed.
2. Open that user's details and set **App Metadata** (not User Metadata) to:

   ```json
   { "role": "admin" }
   ```

   Only a trusted project administrator can set `app_metadata`. Do not grant this role to learners. The Local Listening page requires this account to show management actions; Supabase RLS and Storage policies independently enforce the same role.
3. Start the development server, open **Listening**, and sign in with that account. The Web build remains read-only and does not display management actions.

### 4. Import the old `lessons.json` and audio

For the former Supabase-backed implementation, the website did not fetch or seed from `/lessons.json`. The migration tool below imports the JSON once from a trusted local terminal after applying both migrations. This is not required by the current file-backed Listening page.

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY"
npm run listening:import
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

By default it imports `public/lessons.json`. To import a different legacy export, pass its path:

```powershell
npm run listening:import -- "public/data/lessons.json"
```

The service-role key is used only by this local Node.js migration script; never set it in a `VITE_*` variable, commit it, or paste it into the app. Keep a secure backup of the JSON and audio files until the imported lessons and audio have been verified in Supabase. Re-running the import uses stable IDs and updates the same rows rather than creating duplicate lessons.

### 5. Add and verify a lesson in the former Supabase-backed Local mode

1. Start `npm run dev` and sign in as the Listening admin.
2. Create or select a book and choose **Thêm bài nghe**.
3. Enter the unit, order number, and title. Select an audio file (MP3 is supported); the Local app uploads it to `audio/<lesson-uuid>/...` in Supabase Storage when saving.
4. Enable Script and enter each Japanese line. Enter furigana and translation on the corresponding lines. Each line ID and all three text fields are saved in the lesson's `script` JSONB.
5. Save and wait for the Supabase response. The page reports success only after the database write succeeds. If replacing audio, the new uniquely named file is uploaded and referenced first; the previous file is removed only after the database update succeeds.
6. Refresh Local and verify the lesson, script, furigana, translation, and audio remain. Open the deployed Web site and verify the same lesson can be read and played. Web visitors cannot add, edit, or delete lessons.

### 6. Deploy the former Supabase-backed read-only Web mode to Cloudflare

1. In Cloudflare **Workers & Pages**, create a Worker from the GitHub repository and select the branch to deploy.
2. Configure the Worker build with:

   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy --config .output/server/wrangler.json`
   - Build variables: `VITE_APP_MODE=web`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`

   The variables must be present at build time. Deploying the app does not run the SQL migrations. No service-role key is needed by Cloudflare.
3. Deploy and open the Worker URL. Listening is fetched from Supabase on page load/refresh, with loading, empty, and error states. The Local editing controls are not rendered in this build.

## Google Drive audio links

### 1. Configure Google Drive API

Google Drive does not allow anonymous Drive API calls, even for public files. Configure credentials on the server only; never put a key in source code or a `VITE_*` variable.

1. In Google Cloud Console, create/select a project and enable **Google Drive API**.
2. Under **APIs & Services → Credentials**, create an API key. Restrict its API access to Google Drive. Use an API key only for files shared publicly; private files require a service account with access.

For local PowerShell development:

```powershell
$env:GOOGLE_DRIVE_API_KEY = "YOUR_SERVER_SIDE_API_KEY"
npm run dev
```

If Vite was already running, restart it after setting the variable. For service accounts, set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, then share each private Drive file with that account. On Cloudflare, set these values as Worker secrets; Wrangler local development can use the ignored `.dev.vars` file.

### 2. Upload audio to Drive and create a link

1. Upload an audio file to Drive. MP3 (`audio/mpeg`), WAV (`audio/wav`), and M4A (`audio/mp4`) are supported by Drive.
2. For API-key playback, set **General access → Anyone with the link → Viewer** and copy the share link, typically `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`.
3. For service-account playback, keep the file restricted and grant Viewer access to the service account.

### 3. Add a lesson using a Drive link

1. Run `npm run dev`, open Listening, and sign in as the Local Listening admin.
2. Choose **Thêm bài nghe**, select **Google Drive**, paste the share link, and choose **Kiểm tra link**. This checks the URL format and extracts its file ID; it does not verify Drive permissions.
3. Enter the book, unit, number, and title, then save. Select the lesson to open the player and start playback. Seeking depends on Drive's byte Range support.

NiFlasu stores the shared URL and file ID as metadata. Playback uses `/api/listening/google-drive/:fileId/stream`; it does not use the Drive `/view` page as the audio source. The backend reads the MIME type and streams the file instead of buffering the full audio.

### 4. Verify and troubleshoot

For `https://drive.google.com/file/d/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/view?usp=sharing`, the extracted ID should be `1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm`. Check stream headers and Range support with:

```powershell
curl.exe -I "http://localhost:5173/api/listening/google-drive/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/stream"
curl.exe -i -H "Range: bytes=0-1023" "http://localhost:5173/api/listening/google-drive/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/stream"
```

A successful stream typically returns `200 OK`, `Content-Type: audio/...`, and `Accept-Ranges: bytes`; a supported Range request returns `206 Partial Content` and `Content-Range`.

- `GOOGLE_DRIVE_AUTH_REQUIRED`: configure a valid API key/service account and enable Drive API.
- `GOOGLE_DRIVE_PERMISSION_DENIED`: grant Viewer access to the API key's public file or the service account.
- `GOOGLE_DRIVE_FILE_NOT_FOUND`: verify the link and file ID.
- `GOOGLE_DRIVE_FILE_IS_NOT_AUDIO`: Drive does not recognize the file as `audio/*`.
- `AUDIO_RANGE_REQUEST_FAILED`: Drive did not provide the requested byte range; playback or seeking may not work.

## Legacy Supabase troubleshooting and security checks

- `401` / invalid API key: verify the project URL and publishable key are for the same Supabase project as the migrations.
- `403` / RLS violation when writing in Local mode: verify the user is authenticated and `app_metadata.role` is exactly `admin`; refresh the session after changing metadata.
- Storage upload denied: confirm the second migration ran and the signed-in admin has the role above. Anonymous uploads are intentionally denied.
- For the current file-backed Listening page, verify the lesson is in `public/lessons.json` and its audio file exists at the matching path under `public/audio`.
- Check `public.lessons`, `public.listening_books`, `storage.buckets` (bucket `audio`), and `pg_policies` in Supabase. Anonymous INSERT/UPDATE/DELETE must be denied; anonymous SELECT and audio read are allowed.
