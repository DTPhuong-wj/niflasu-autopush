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

## Listening Local / Web

`npm run dev` uses Local mode (`.env.development`): lesson metadata stays in browser `localStorage` and uploaded audio stays in IndexedDB. Add, edit, and delete Listening content here, then select **Sync / Export** to download `niflasu-listening-export.zip`.

Extract the ZIP at the repository root and replace `public/data/lessons.json`; uploaded files are included under `public/audio/`. The export does not remove browser data. Deploy the project afterward. Production builds use Web mode (`.env.production`), which reads only `/data/lessons.json` and hides Listening management controls.

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
