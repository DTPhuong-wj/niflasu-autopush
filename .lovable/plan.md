# Nâng cấp Listening / Script

Chỉ sửa phần Nghe. Sidebar, Kanji, Từ vựng, cách bố trí chung giữ nguyên.

## 1. Lưu bài nghe bền vững trên web (sửa lỗi không thêm được bài khi đã đăng web)
- Lý do lỗi: bài nghe hiện lưu vào ổ đĩa của máy chủ. Máy chủ web không giữ được file nên không thêm được bài.
- Bật Lovable Cloud. Dùng nó để lưu dữ liệu bài nghe (sách, bài, script) và lưu file âm thanh. Bản chạy thử và bản đã đăng web dùng chung cách lưu này, không chia theo localhost.
- Thống nhất một cách gọi chung: uploadAudio / getAudio / deleteAudio / saveLesson / getLesson. Phần giao diện chỉ gọi qua đây.
- Không yêu cầu đăng nhập (giống hiện tại): ai mở trang cũng thêm, sửa được bài.
- Bài cũ đang lưu trong trình duyệt được chuyển sang tự động một lần.
- Tạo `data/lessons.json`, dùng đúng cấu trúc trong file bạn gửi (version, lessons, audio chỉ ghi tên và đường dẫn file, script gồm speaker / japanese / furigana[] / translation). Đây là dữ liệu mẫu và dữ liệu khởi tạo. Không lưu nội dung âm thanh trong JSON.

## 2. AI tự xử lý Script khi thêm bài
- Khi lưu bài có Script tiếng Nhật, AI tách từng câu theo người nói. Script gốc giữ nguyên, AI chỉ thêm furigana (cách đọc của chữ Kanji) và bản dịch tiếng Việt.
- Câu AI không chắc sẽ được đánh dấu "Cần kiểm tra" để bạn tự sửa.
- Kết quả được lưu lại, lần sau mở bài không dịch lại.

## 3. Script
- Nút Furigana BẬT/TẮT, chữ đọc nằm ngay trên Kanji. Chỉ Kanji mới có, khoảng cách dòng gần như không đổi.
- Mỗi câu có nút 訳: mở hoặc đóng bản dịch ngay dưới câu đó, có hiệu ứng nhẹ. Mỗi câu mở riêng.
- Mỗi câu là một khối gồm người nói, câu tiếng Nhật (chữ to nhất), bản dịch (chữ nhỏ hơn). Có hiệu ứng khi rê chuột, dùng ít màu theo tông nâu–be hiện tại.
- Hiện chưa có mốc thời gian nên chưa tô sáng câu đang phát. Không làm thêm phần này.

## 4. Sửa Script
- Nút Sửa: chỉnh người nói, câu tiếng Nhật, furigana và bản dịch từng câu, rồi bấm Lưu.
- Khi lưu, bản mới thay luôn bản cũ. Không giữ bản trùng, màn hình hiện ngay bản mới nhất.

## 5. Cửa sổ nghe lớn hơn
- Trên máy tính: rộng khoảng 960px. Trình phát nằm trên, Script cuộn riêng bên dưới.
- Trên điện thoại: cửa sổ gần đầy màn hình, nút điều khiển luôn hiện.

## Chi tiết kỹ thuật
- Bảng: listening_books, listening_lessons (audio metadata), listening_script_lines (lesson_id, position, speaker, japanese, furigana jsonb, translation, needs_review). Grants + RLS mở cho anon/authenticated. Bucket công khai `listening-audio`.
- `src/services/listeningRepository.ts` là lớp chung, thay `listeningApi` / `listeningFileStorage` (các route API ghi vào ổ đĩa sẽ bị bỏ).
- Server function `processScript` gọi Lovable AI Gateway (gemini-flash) với structured output → lines[] gồm furigana segments và translation.
- Ruby: render `<ruby>text<rt>reading</rt></ruby>` từ furigana segments khớp trong chuỗi japanese.
- Sau khi lưu, gọi lại danh sách từ server để cập nhật màn hình.
