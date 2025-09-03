# Search EHOU Chrome Extension - Đã Cập Nhật

## 🚀 Tính năng mới (v1.1)

### ✅ Chỉ gửi câu hỏi có đáp án đúng
Extension đã được cập nhật để chỉ trích xuất và gửi những câu hỏi **có đáp án đúng** lên hệ thống. Những câu hỏi không có đáp án đúng sẽ bị bỏ qua.

## 📋 Chi tiết thay đổi

### 🔍 Logic lọc câu hỏi
- **Trước**: Gửi tất cả câu hỏi được tìm thấy
- **Sau**: Chỉ gửi câu hỏi có `correctAnswersHtml` không rỗng

### 📊 Thông báo được cải thiện
- Hiển thị số câu hỏi hợp lệ vs tổng số câu hỏi
- Thông báo số câu hỏi bị bỏ qua (không có đáp án đúng)
- Chi tiết hơn về quá trình xử lý

### 🛡️ Kiểm tra đáp án
```javascript
// Kiểm tra trong extractQuestionData()
if (!correctAnswersHTML || correctAnswersHTML.length === 0) {
    console.log(`⚠️ Skipping question ${questionNumber} - no correct answers found`);
    return null; // Bỏ qua câu hỏi
}
```

## 📈 Thống kê

Khi extension xử lý trang review, bạn sẽ thấy:

```
📊 Review data summary: {
  courseName: "Tên môn học",
  totalQuestionsFound: 10,     // Tổng số câu hỏi tìm thấy
  validQuestions: 8,           // Số câu hỏi có đáp án đúng
  questionsSkipped: 2          // Số câu hỏi bị bỏ qua
}
```

## 🎯 Cách sử dụng

1. **Mở trang review quiz** trên hệ thống EHOU
2. Extension sẽ tự động:
   - Phát hiện trang review
   - Trích xuất câu hỏi có đáp án đúng
   - Bỏ qua câu hỏi không có đáp án
   - Gửi lên backend API
3. **Thông báo** sẽ hiển thị kết quả

## 🔧 Cấu hình

Extension sử dụng các API endpoints sau:
- `POST /api/v1/courses/upsert` - Tạo/cập nhật môn học
- `POST /api/v1/questions/bulk-upsert` - Tạo/cập nhật câu hỏi

## 📝 Logs

Extension sẽ log chi tiết:
- ✅ Câu hỏi nào được gửi
- ⚠️ Câu hỏi nào bị bỏ qua và tại sao
- 📊 Thống kê tổng kết

## 🐛 Troubleshooting

### Không thấy thông báo?
- Kiểm tra console browser (F12)
- Đảm bảo đang ở trang review quiz
- Kiểm tra backend có chạy không

### Tất cả câu hỏi đều bị bỏ qua?
- Kiểm tra trang có hiển thị đáp án đúng không
- Đảm bảo trang review hiển thị đáp án

## 📚 Ví dụ

```javascript
// Câu hỏi SẼ được gửi
{
  questionHTML: "<p>Câu hỏi về toán?</p>",
  answersHTML: ["A", "B", "C", "D"],
  correctAnswersHTML: ["B"],  // ← Có đáp án đúng
  explanationHTML: "..."
}

// Câu hỏi SẼ BỊ BỎ QUA
{
  questionHTML: "<p>Câu hỏi về toán?</p>",
  answersHTML: ["A", "B", "C", "D"],
  correctAnswersHTML: [],     // ← Không có đáp án đúng
  explanationHTML: ""
}
```

## 🔄 Backend Compatibility

Extension này tương thích với backend đã được cập nhật để xử lý việc chỉ nhận câu hỏi có đáp án đúng.
