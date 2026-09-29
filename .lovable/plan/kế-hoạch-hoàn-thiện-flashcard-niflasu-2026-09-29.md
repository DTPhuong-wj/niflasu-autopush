# Kế hoạch hoàn thiện Flashcard NiFlasu

## Mục tiêu
Sửa trực tiếp giao diện hiện tại theo tài liệu đã gửi, tập trung đúng ba ưu tiên: bố cục tham chiếu, lật thẻ 3D thật bằng CSS, và phong cách nâu–be ấm sáng, học thuật, tối giản.

## Thay đổi chính
- Giữ nguyên cấu trúc ứng dụng, dữ liệu Kanji, bộ chọn sách/Unit và chức năng luyện tập hiện có.
- Chuyển Flashcard thành cấu trúc hai mặt luôn cùng tồn tại trong DOM: khung phối cảnh, lõi xoay 180°, mặt trước/mặt sau dùng `backface-visibility`.
- Mặt trước chỉ hiển thị Kanji và dòng “Nhấn để lật”; mặt sau hiển thị Kanji, On, Kun, Hán Việt và từ ghép.
- Cho phép lật bằng click/chạm, Space hoặc Enter; chuyển thẻ bằng mũi tên trái/phải và luôn đặt thẻ mới về mặt trước.
- Bỏ nút “Lật thẻ”, toàn bộ nút/state/phím tắt/nội dung “Mẹo”, và không hiển thị `mnemonic` ở giao diện.
- Bố trí điều hướng dưới thẻ theo mẫu `← Trước   1 / 20   Tiếp →`; giữ tự động và toàn màn hình ở hàng công cụ riêng, gọn, không thêm chức năng mới.
- Giữ giới hạn trong Unit hiện tại; hết thẻ hiển thị “Đã hoàn thành Unit X”, không tự chuyển Unit.
- Cập nhật màu semantic sang warm brown + fresh beige, tăng độ sáng và độ thân thiện; thêm chuyển động nhẹ 180–600ms, không bounce/gradient/cartoon/emoji.
- Cố định kích thước thẻ theo desktop/tablet/mobile để khi lật không đổi kích thước hoặc làm nhảy bố cục; hỗ trợ giảm chuyển động theo cài đặt thiết bị.

## Kiểm tra
- Kiểm tra thao tác lật thật ở DOM/CSS và bằng chuột, touch, Enter, Space.
- Kiểm tra điều hướng, reset mặt trước, tự động, toàn màn hình và trạng thái hoàn thành.
- Kiểm tra hiển thị desktop và mobile, không tràn/chồng chữ.
- Xác nhận không còn UI “Mẹo” và trang không có lỗi biên dịch hoặc lỗi trình duyệt.

## Chi tiết kỹ thuật
- React chỉ quản lý trạng thái `revealed`; animation hoàn toàn bằng `perspective`, `transform-style: preserve-3d`, `rotateY(180deg)` và `backface-visibility: hidden`.
- Không thêm thư viện animation hoặc vòng lặp animation JavaScript.
- Màu sắc được định nghĩa bằng token trong stylesheet chung; dữ liệu `mnemonic` vẫn được giữ nguyên trong JSON để dùng về sau.
