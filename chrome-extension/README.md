# Search EHOU Chrome Extension

Chrome Extension để thu thập và tự động điền câu hỏi từ các trang web kiểm tra trực tuyến.

## Tính năng

- ✅ **Thu thập câu hỏi**: Tự động phát hiện và thu thập câu hỏi từ trang web
- ✅ **Tự động điền**: Tự động điền đáp án đã biết vào form
- ✅ **Tìm kiếm thông minh**: Sử dụng Vietnamese text normalization
- ✅ **Giao diện hiện đại**: UI responsive và user-friendly
- ✅ **Cài đặt linh hoạt**: Nhiều tùy chọn cấu hình

## Cài đặt

### Development Mode

1. Clone repository và chuyển vào thư mục `chrome-extension`
2. Mở Chrome và truy cập `chrome://extensions/`
3. Bật "Developer mode" (góc phải trên)
4. Click "Load unpacked" và chọn thư mục `chrome-extension`
5. Extension sẽ xuất hiện trong danh sách

### Production

1. Build extension: `npm run build` (nếu có build script)
2. Package thành file `.crx` hoặc upload lên Chrome Web Store

## Sử dụng

### Thu thập câu hỏi

1. Mở trang web có câu hỏi cần thu thập
2. Click vào icon extension
3. Chọn khóa học từ dropdown
4. Click "Thu thập câu hỏi"
5. Extension sẽ tự động phát hiện và lưu câu hỏi

### Tự động điền

1. Mở trang quiz cần làm
2. Click vào icon extension
3. Click "Tự động điền"
4. Extension sẽ tìm và điền đáp án đã biết

### Cài đặt

1. Click vào icon extension
2. Click "Cài đặt nâng cao" ở footer
3. Điều chỉnh các tùy chọn theo ý muốn
4. Click "Lưu cài đặt"

## Cấu trúc dự án

```
chrome-extension/
├── manifest.json          # Extension manifest
├── background.js          # Background script
├── content.js            # Content script
├── content.css           # Content styles
├── popup.html            # Popup interface
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── options.html          # Options page
├── options.css           # Options styles
├── options.js            # Options logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## API Integration

Extension tích hợp với backend API qua các endpoints:

- `GET /api/v1/courses` - Lấy danh sách khóa học
- `POST /api/v1/questions/bulk` - Lưu nhiều câu hỏi
- `POST /api/v1/questions/bulk-search` - Tìm kiếm câu hỏi

## Cài đặt

### General Settings
- **Bật extension**: Bật/tắt toàn bộ chức năng
- **Tự động điền**: Tự động điền khi vào trang quiz
- **Độ chính xác**: Điều chỉnh độ chính xác tìm kiếm

### API Settings
- **Backend URL**: URL của backend API
- **Timeout**: Thời gian chờ API calls
- **Retry**: Tự động thử lại khi lỗi

### Data Settings
- **Cache strategy**: Cách lưu trữ cache
- **Cache timeout**: Thời gian lưu trữ cache
- **Clear cache**: Xóa dữ liệu cache

### UI Settings
- **Theme**: Chọn theme (auto/light/dark)
- **Notifications**: Hiển thị thông báo
- **Highlight**: Highlight elements trên trang

### Advanced Settings
- **Debug mode**: Bật chế độ debug
- **Log level**: Mức độ log chi tiết
- **Export/Import**: Xuất/nhập cài đặt

## Development

### Local Development

1. Start backend server: `cd backend && npm run start:dev`
2. Load extension trong Chrome
3. Test trên các trang web có quiz

### Testing

- Test trên các website khác nhau
- Kiểm tra performance với nhiều câu hỏi
- Test error handling và edge cases

### Building

```bash
# Build extension (if using build tools)
npm run build

# Package for distribution
npm run package
```

## Troubleshooting

### Extension không hoạt động
1. Kiểm tra backend server có đang chạy không
2. Kiểm tra console errors
3. Kiểm tra permissions trong manifest.json

### Không phát hiện được câu hỏi
1. Kiểm tra selectors trong content.js
2. Thêm custom selectors cho website cụ thể
3. Bật debug mode để xem log

### API calls thất bại
1. Kiểm tra CORS settings
2. Kiểm tra API URL trong settings
3. Kiểm tra network connectivity

## Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## License

MIT License - xem file LICENSE để biết thêm chi tiết.

## Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra documentation
2. Tìm trong issues
3. Tạo issue mới với thông tin chi tiết
