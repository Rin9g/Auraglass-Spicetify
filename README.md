# AuraGlass - Spicetify Theme & Dynamic Lyrics

**AuraGlass** là Spicetify Theme cao cấp tích hợp giao diện kính mờ và hiệu ứng hiển thị lời bài hát (Lyrics) sống động:

- **Giao diện Kính mờ Trắng trong suốt (Frosted White Glassmorphism)**: Các ô (Thư viện bên trái, Main View, Now Playing bên phải, Player Bar ở dưới) đều sử dụng lớp nền kính trắng bán trong suốt (`rgba(255, 255, 255, 0.08)`), loại bỏ hoàn toàn các mảng màu xanh dương đậm / đen đục, kết hợp đường viền mảnh sáng tinh tế chia từng ô rõ ràng.
- **Nút bấm & Điều khiển sạch sẽ, không bị đóng khung**: Các nút icon (Shuffle, Repeat, Playback, Action bar) tối giản, không bị viền hộp thô; nút Shuffle khi kích hoạt có chấm đèn neon xanh. Các nút chức năng dạng văn bản (+ Add, Name & details) bo góc dạng pill trong suốt sang trọng.
- **Đồng bộ toàn diện nền Playlist & Main View**: Toàn bộ header và tracklist của Playlist loại bỏ hoàn toàn các khối màu đơn sắc (đỏ/xanh), để lộ nền gradient động phía sau hiển thị xuyên suốt từ đầu tới chân trang.
- **Sửa lỗi hiển thị & Cuộn trang Tìm kiếm (Search View)**: Khắc phục triệt để lỗi phần tìm kiếm bị ẩn / cắt dưới đáy bằng cách loại bỏ overflow cứng, thêm padding đệm thông minh và tối ưu thanh tìm kiếm trên Topbar luôn hiển thị ổn định.
- **Nút Marketplace chính thức**: Tích hợp nút Marketplace chuẩn duy nhất trên Topbar, loại bỏ các nút trùng lặp.
- **Background động hòa trộn màu album (Dynamic Living Gradient Mesh)**: Tự động trích xuất các dải màu nổi bật từ ảnh bìa (album art) của bài hát đang phát bằng Canvas HSL thời gian thực (hỗ trợ cả ảnh màu lẫn ảnh đơn sắc / noir). Màu sắc chuyển tiếp êm ái khi đổi bài hát trên nền obsidian sâu lắng.
- **Hiệu ứng Lyrics Karaoke Vệt Đen Chạy Theo Nhạc (Real-time Black Karaoke Wipe)**:
  - Khi nhạc phát, câu hát đang hát sẽ có vệt màu đen (`#000000`) quét từ trái sang phải qua từng chữ, được tính toán khớp chính xác theo thời gian thực (`Spicetify.Player.getProgress()`) với độ dài thực tế của câu hát (`start` & `end` timestamp theo mili-giây).
  - Vệt đen quét đến đúng chữ cuối cùng vừa vặn khi kết thúc câu hát.
  - Đi kèm hiệu ứng quầng sáng đen nhẹ (`black beam`) lướt theo điểm hát hiện tại.
  - Chữ chưa hát có màu trắng sáng (`#ffffff`), các câu hát đã qua hoặc sắp tới giữ màu trắng mờ thanh lịch, hiển thị rõ nét trên nền kính trong suốt.

---

## 📁 Cấu trúc thư mục

```
c:\Users\nguye\Documents\spicetify theme\
├── color.ini     # Bảng màu chuẩn Spicetify (nền obsidian trung tính cho kính trắng)
├── user.css      # CSS kính mờ trắng, viền phân ô, layout tìm kiếm & karaoke wipe
├── theme.js      # Script trích xuất màu album art, tối ưu topbar & động cơ karaoke thời gian thực
└── README.md     # Tài liệu chi tiết tính năng và hướng dẫn
```

---

## 🚀 Đã cài đặt & áp dụng sẵn

Theme đã được liên kết trực tiếp vào Spicetify:
- **Tên theme**: `AuraGlass`
- **Color scheme**: `AuraGlass`
- **Thư mục liên kết**: `C:\Users\nguye\AppData\Roaming\spicetify\Themes\AuraGlass`

---

## 🛠️ Lệnh Spicetify hữu ích

1. **Áp dụng cập nhật sau khi chỉnh sửa code**:
   ```powershell
   spicetify apply
   ```

2. **Chế độ tự động cập nhật khi lưu file (Watch mode)**:
   ```powershell
   spicetify watch -s
   ```

3. **Khởi động lại Spotify**:
   ```powershell
   spicetify restart
   ```
