# NiFlasu AutoPush

create project NiFlasu with requirements. Auto push code on github with name: NiFlasu

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/836eefb8-7aa0-4769-8780-79d61580af63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Cloudflare Workers

The production build uses Nitro's Cloudflare Workers preset and generates `.output/server/wrangler.json`. For first-time setup, follow **Bật lưu bài nghe trên website** below; it covers connecting this GitHub repository to Cloudflare and configuring the build. To deploy manually from a computer with Node.js and npm installed:

```sh
npm ci
npx wrangler login
npm run deploy:cloudflare:dry-run
npm run deploy:cloudflare
```

## Listening Local / Web

`npm run dev` uses Local mode (`.env.development`): lesson metadata stays in browser `localStorage` and uploaded audio stays in IndexedDB. **Sync / Export** can package that local content for backup.

Web mode (`.env.production`) reads and writes books, lessons, scripts, and audio through Supabase. Cloudflare hosts the website, while Supabase keeps uploaded content when the site is redeployed. The Listening editor is available without sign-in.

### Bật lưu bài nghe trên website — từ đầu đến cuối

Các bước sau tạo nơi lưu trữ trên Supabase, kết nối website với kho đó, triển khai ứng dụng lên Cloudflare Workers rồi thử tải một bài nghe lên. Bạn cần có tài khoản GitHub và quyền truy cập repository này. Không cần bật đăng nhập cho người học.

#### A. Tạo dự án Supabase

1. Mở [supabase.com](https://supabase.com/) và chọn **Start your project**. Đăng nhập hoặc tạo tài khoản.
2. Tạo một **Organization** nếu Supabase yêu cầu: nhập tên tổ chức, chọn gói phù hợp rồi tiếp tục.
3. Trong organization, chọn **New project**. Điền tên, ví dụ `niflasu-listening`; chọn một mật khẩu database mạnh, lưu ở nơi an toàn; chọn region gần bạn/đối tượng nghe nhất; sau đó chọn **Create new project**.
4. Đợi trạng thái dự án hoàn tất khởi tạo. Mở **Project Settings → API Keys** (một số giao diện cũ hiển thị **Project Settings → API**).
5. Sao chép **Project URL** và **Publishable key** (ở giao diện cũ có thể tên là `anon`/`public`). Giữ hai giá trị này để cấu hình Cloudflare ở phần C.
6. Không sao chép hoặc đưa **Secret key**, `service_role` key, hay mật khẩu database vào website. Ứng dụng chỉ cần URL và publishable key; không đăng các giá trị này công khai trong issue/chat.

#### B. Tạo bảng và kho audio

1. Trong dự án Supabase, mở **SQL Editor** → **New query**.
2. Mở file [`supabase/migrations/20261003000000_public_listening_storage.sql`](./supabase/migrations/20261003000000_public_listening_storage.sql) trong repository. Sao chép toàn bộ nội dung, dán vào SQL Editor rồi chọn **Run**.
3. Xác nhận query chạy thành công. Có thể kiểm tra trong **Table Editor** thấy `listening_books`, `listening_lessons`, `listening_script_lines`, và trong **Storage** thấy bucket `listening-audio`.
4. Không cần tạo bucket hay bảng thủ công thêm lần nữa. Migration đã tạo quyền đọc/ghi cho chế độ không đăng nhập.

#### C. Kết nối GitHub và tạo Cloudflare Worker

1. Mở [dash.cloudflare.com](https://dash.cloudflare.com/) và đăng nhập hoặc tạo tài khoản Cloudflare.
2. Trong Cloudflare, mở **Workers & Pages** → **Create application** → **Workers** → **Import a repository** (tên nút có thể thay đổi theo giao diện).
3. Kết nối GitHub nếu được hỏi, cấp quyền truy cập repository `DTPhuong-wj/niflasu-autopush`, rồi chọn repository và branch cần deploy (thường là `main`).
4. Đặt tên Worker, ví dụ `niflasu-autopush`. Nếu Cloudflare hỏi loại cấu hình, chọn **Workers Builds / Connect to Git** để mỗi lần push lên branch đã chọn sẽ build và deploy tự động.
5. Cấu hình build:
   - **Root directory:** `/` (thư mục gốc của repository).
   - **Build command:** `npm run build`.
   - **Deploy command:** `npx wrangler deploy --config .output/server/wrangler.json`.
   - Nếu có mục **Build system version**, chọn phiên bản tương thích Node.js 22 trở lên.
6. Trước khi chạy deploy đầu tiên, thêm hai biến môi trường build trong cấu hình build của Worker:
   - `VITE_SUPABASE_URL` = **Project URL** đã lấy ở phần A.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = **Publishable key** đã lấy ở phần A.
   
   Đặt biến cho **Production** (và Preview nếu cần kiểm tra preview). Đây là biến **build-time**: phải khai báo trước khi build vì ứng dụng Vite đóng gói chúng vào website. Không khai báo Secret/service-role key.
7. Lưu cấu hình rồi chọn **Deploy**. Chờ build và deploy hoàn tất; Cloudflare sẽ hiển thị URL dạng `https://niflasu-autopush.<your-subdomain>.workers.dev`.
8. Mở URL Worker để kiểm tra trang tải lên. Sau khi thay đổi source code và push lên branch đã kết nối, Cloudflare sẽ tự build/deploy lại. File audio/script vẫn nằm ở Supabase, không mất khi deploy phiên bản website mới.

> **Deploy bằng máy cá nhân thay cho GitHub Builds:** đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` trong môi trường của terminal trước lúc build, đăng nhập bằng `npx wrangler login`, rồi chạy `npm run deploy:cloudflare`. Không chạy build trước khi thiết lập hai biến vì chúng được nhúng vào client bundle.

#### D. Tạo bài nghe, tải audio và lưu script

1. Mở website Cloudflare, vào **Listening** rồi chọn **Thêm sách** nếu danh sách chưa có sách. Nhập tên sách và lưu.
2. Chọn **Thêm bài nghe**. Chọn sách, nhập **Unit**, **Số thứ tự**, tên bài và các thông tin khác nếu cần.
3. Ở **Nguồn bài nghe**, chọn **File máy tính**, bấm **Chọn file** hoặc kéo file audio vào vùng tải lên. Chờ chọn xong file.
4. Tích **Có Script**. Nhập mỗi câu trên một dòng; ví dụ `リー：大沢さん、すみません。`. Có thể nhập thêm furigana và bản dịch theo thứ tự từng câu vào hai ô tương ứng. Các trường này được lưu cùng bài nghe.
5. Bấm **Lưu bài nghe** và đợi hoàn tất. Nếu lưu thành công, bài sẽ xuất hiện trong danh sách. Chọn bài để mở trình phát và xác nhận audio/script hiển thị.
6. Tải lại trang. Bài, script và audio vẫn phải còn. Có thể mở URL website trên trình duyệt/thiết bị khác để kiểm tra dữ liệu được lưu dùng chung.

#### E. Kiểm tra và xử lý lỗi thường gặp

- **Thiếu cấu hình Supabase / lỗi không tải được dữ liệu:** kiểm tra `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` trong cấu hình build Cloudflare; sau khi thêm/sửa biến, chạy deploy mới để build lại.
- **Bảng hoặc bucket không tồn tại / lỗi permission:** xác nhận migration ở phần B chạy thành công trên đúng Supabase project đang dùng bởi Cloudflare.
- **Audio nghe báo lỗi sau khi lưu:** kiểm tra bucket `listening-audio` tồn tại và là public, migration policy đọc file đã được áp dụng, rồi thử tải lại trang.
- **Trang chưa thay đổi sau khi push:** mở build log trong Cloudflare **Workers & Pages → Worker → Builds/Deployments** và kiểm tra branch, build command, deploy command có đúng như phần C.
- **Giới hạn dung lượng:** ứng dụng không đặt giới hạn riêng và bucket được tạo không cấu hình MIME/size cap riêng; quota, giới hạn upload của gói Supabase, trình duyệt và kết nối mạng vẫn áp dụng.

**Quyền truy cập công khai:** để không yêu cầu đăng nhập, migration cho phép bất kỳ khách truy cập nào đọc, thêm, sửa và xóa tất cả sách, bài, script và audio. Audio có thể được truy cập bằng public URL. Không lưu nội dung riêng tư và không chia sẻ website nếu bạn không muốn người khác thay đổi/xóa dữ liệu. Nếu cần giới hạn người có quyền chỉnh sửa, phải bổ sung xác thực và thay các policy mở trước khi dùng.

Khi các bảng Supabase chưa có sách nào, ứng dụng sẽ nhập nội dung khởi tạo từ `/lessons.json` hoặc `/data/lessons.json` nếu có.

## Thêm link Google Drive và phát audio

### 1. Cấu hình Google Drive API

Google Drive không cho phép gọi Drive API ẩn danh, kể cả với file công khai. Cần cấu hình credential ở **server**, không đặt key trong source code hoặc biến `VITE_*`.

1. Mở Google Cloud Console, chọn/tạo project và bật **Google Drive API**.
2. Vào **APIs & Services → Credentials → Create credentials → API key**.
3. Trong phần giới hạn key, giới hạn **API restrictions** cho Google Drive API. API key phù hợp với file được chia sẻ công khai; với file riêng tư, dùng service account có quyền đọc file.

Khi chạy local trên PowerShell, đặt biến trong cùng terminal trước khi chạy app:

```powershell
$env:GOOGLE_DRIVE_API_KEY = "YOUR_SERVER_SIDE_API_KEY"
npm run dev
```

Giữ terminal đó chạy Vite. Nếu đang chạy `npm run dev` rồi mới đặt biến, hãy dừng và khởi động lại server. Không gửi API key lên chat hoặc commit key vào Git.

Với service account, cấu hình cả `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`; chia sẻ file Drive cho email của service account. Trên Cloudflare, đặt API key hoặc service-account values trong Worker **Secrets/Variables**. Khi chạy Wrangler local, có thể dùng file `.dev.vars` đã được Git ignore.

### 2. Tải audio lên Drive và tạo link

1. Tải file audio lên Google Drive. Dùng định dạng được Drive nhận dạng là audio, ví dụ MP3 (`audio/mpeg`), WAV (`audio/wav`) hoặc M4A (`audio/mp4`).
2. Mở **Share → General access**. Với API key, chọn **Anyone with the link → Viewer** rồi bấm **Copy link**. Link thường có dạng `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`.
3. Với service account và file riêng tư, có thể để chế độ restricted nhưng phải thêm email service account vào danh sách người được xem.

### 3. Thêm bài nghe trong NiFlasu

1. Chạy app bằng `npm run dev`, mở Listening và chọn **Thêm bài nghe**.
2. Chọn nguồn **Google Drive**, dán link vừa sao chép, rồi bấm **Kiểm tra link**. Bước này kiểm tra định dạng URL và trích `fileId`; chưa xác minh quyền truy cập file.
3. Điền sách, Unit, số thứ tự và tên bài nghe; bấm **Lưu bài nghe**.
4. Chọn bài vừa tạo để mở player và bấm **Phát**. Có thể kéo thanh tiến trình để tua nếu Drive hỗ trợ byte Range.

NiFlasu lưu URL chia sẻ làm metadata và lưu `fileId` riêng. Khi phát, trình duyệt chỉ dùng endpoint của ứng dụng `/api/listening/google-drive/:fileId/stream`; URL trang `/view` không được dùng làm audio source. Backend đọc MIME từ Drive API và chuyển tiếp nội dung dạng stream, không tải toàn bộ audio vào bộ nhớ.

### 4. Kiểm tra nhanh và xử lý lỗi

Với URL mẫu `https://drive.google.com/file/d/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/view?usp=sharing`, ID phải là `1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm`. Sau khi server chạy, có thể kiểm tra metadata bằng:

```powershell
curl.exe -I "http://localhost:5173/api/listening/google-drive/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/stream"
```

Kết quả hợp lệ thường có `200 OK`, `Content-Type: audio/...` và `Accept-Ranges: bytes`. Kiểm tra Range bằng:

```powershell
curl.exe -i -H "Range: bytes=0-1023" "http://localhost:5173/api/listening/google-drive/1Pwpz_-w6aPkRUCa1i0nTrPWs3cwlpYFm/stream"
```

Nếu upstream hỗ trợ Range, response là `206 Partial Content` kèm `Content-Range`. Các mã lỗi thường gặp:

- `GOOGLE_DRIVE_AUTH_REQUIRED`: thiếu API key/service account, key sai, hoặc Drive API chưa bật. Kiểm tra biến môi trường rồi khởi động lại server.
- `GOOGLE_DRIVE_PERMISSION_DENIED`: cấp quyền Viewer cho API key công khai hoặc chia sẻ file với service account.
- `GOOGLE_DRIVE_FILE_NOT_FOUND`: kiểm tra link và file ID.
- `GOOGLE_DRIVE_FILE_IS_NOT_AUDIO`: Drive không nhận dạng file là `audio/*`.
- `AUDIO_RANGE_REQUEST_FAILED`: Drive không hỗ trợ hoặc không trả đúng Range; phát/tua có thể không hoạt động với file đó.
