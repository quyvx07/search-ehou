# Search EHOU - Auto Extract Only

## Tổng quan
Extension Chrome đã được đơn giản hóa để chỉ giữ lại chức năng **auto extract** khi vào trang view.

## Chức năng duy nhất còn lại
- **Tự động phát hiện trang review quiz** khi người dùng vào trang
- **Tự động trích xuất dữ liệu câu hỏi** và gửi về backend API
- **Hiển thị thông báo** khi việc trích xuất hoàn tất

## Những thay đổi đã thực hiện

### 1. Đơn giản hóa content.js
- Loại bỏ tất cả các chức năng manual extract, search, bulk operations
- Chỉ giữ lại logic auto detect và auto extract
- Loại bỏ tất cả các message listeners không cần thiết

### 2. Đơn giản hóa background.js
- Chỉ giữ lại hàm xử lý `AUTO_EXTRACT_REVIEW_DATA`
- Loại bỏ tất cả các chức năng search, bulk operations, favorites
- Đơn giản hóa API communication

### 3. Đơn giản hóa popup
- Popup chỉ hiển thị trạng thái hoạt động của extension
- Loại bỏ tất cả các nút điều khiển, cài đặt

### 4. Cập nhật manifest.json
- Loại bỏ permissions không cần thiết (scripting, contextMenus)
- Chỉ giữ lại activeTab và storage
- Loại bỏ các content scripts không cần thiết (api-client.js, security-service.js)
- Loại bỏ content.css

### 5. Xóa các file không cần thiết
- `api-client.js` - không cần thiết cho chức năng đơn giản
- `security-service.js` - không cần thiết cho chức năng đơn giản
- `content.css` - không cần thiết cho chức năng đơn giản

## Cách hoạt động
1. Khi người dùng vào trang review quiz (có URL chứa review.php hoặc các pattern khác)
2. Extension tự động phát hiện và bắt đầu trích xuất sau 2 giây
3. Dữ liệu được trích xuất và gửi về backend API tại `http://localhost:3000/api/questions/bulk`
4. Hiển thị thông báo thành công trên trang

## Kiểm tra hoạt động
- Build extension: `node build.js`
- Load extension từ thư mục `dist/` trong Chrome Developer Mode
- Truy cập trang review quiz để test auto extract

## File cấu trúc cuối cùng
```
chrome-extension/
├── manifest.json          # Đã được đơn giản hóa
├── content.js            # Chỉ auto extract logic
├── background.js         # Chỉ xử lý auto extract
├── popup.html           # Giao diện đơn giản
├── popup.js             # Hiển thị trạng thái
├── icons/               # Icons của extension
└── dist/                # Build output
```
