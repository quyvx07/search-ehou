const http = require('http');
const fs = require('fs');

// Dữ liệu các câu hỏi đã lọc
const filteredQuestions = [
  {
    courseId: '18f6180d-c4ea-436d-81f2-6dbb76f0d539',
    questionHtml: '<p>Chức năng của thiết bị đầu vào ?</p><p></p>',
    answersHtml: [
      'Nhập và mã hoá thông tin đầu vào thành dạng thích hợp cho máy tính',
      'Nhập dữ liệu vào cho máy tính',
      'Nhập thông tin vào cho máy tính',
      'Nhập thông tin dạng ký tự vào cho máy tính'
    ],
    correctAnswersHtml: [
      'Nhập và mã hoá thông tin đầu vào thành dạng thích hợp cho máy tính'
    ],
    explanationHtml: '<p><strong>Đáp án đúng là:</strong> Nhập và mã hoá thông tin đầu vào thành dạng thích hợp cho máy tính<strong> Tham khảo:</strong> chương 1, mục 1.2.1, trang 4, 5, Bản Text.</p>'
  },
  {
    courseId: '18f6180d-c4ea-436d-81f2-6dbb76f0d539',
    questionHtml: '<p>Xét một máy tính với tập lệnh máy khuôn dạng 8-bit, với phần địa chỉ chỉ có một địa chỉ 5 bit. Dạng gợi nhớ của lệnh máy như sau: Tên lệnh xxxxx, trong đó xxxxx là số nhị phân 5 bit. Lệnh  STORE xxxxx thực hiện cất nội dung thanh tích luỹ ACC ra ô nhớ địa chỉ xxxxx. Giả sử ACC chứa gía trị 11001, khi lệnh STORE 11010 được thực hiện thì ô nhớ đích 11010 sẽ chứa giá trị:</p>',
    answersHtml: [
      '11010<br><p> </p>',
      '11001',
      '10110',
      '11011'
    ],
    correctAnswersHtml: [
      '11001'
    ],
    explanationHtml: '<p><strong>Đáp án đúng là</strong><strong>:</strong> 11001</p><p><strong>Tham khảo:</strong> chương 1, mục 1.2.3.5, trang 10-13, Bản Text.</p>'
  },
  {
    courseId: '18f6180d-c4ea-436d-81f2-6dbb76f0d539',
    questionHtml: '<p>Xét một máy tính với tập lệnh máy khuôn dạng 8-bit, với phần địa chỉ chỉ có một địa chỉ 5 bit. Dạng gợi nhớ của lệnh máy như sau: Tên lệnh xxxxx, trong đó xxxxx là số nhị phân 5 bit. Lệnh trừ SUB xxxxx thực hiện lấy nội dung ACC trừ đi nội dung ô nhớ địa chỉ xxxxx, kết quả chứa vào ACC. Vậy trong giai đoạn (tiểu chu kỳ) thực hiện lệnh, các thao tác nào sau đây sẽ được Đơn vị xử lý trung tâm thực hiện:</p>',
    answersHtml: [
      'Lấy nội dung ACC trừ đi nội dung ô nhớ địa chỉ xxxxx, kết quả chứa vào ACC',
      'Chuyển giá trị toán hạng từ ô nhớ địa chỉ xxxxx vào đơn vị xử lý trung tâm , lấy nội dung ACC trừ đi nội dung ô nhớ địa chỉ xxxxx, kết quả chứa vào ACC',
      'Xác định địa chỉ ô nhớ xxxxx chứa toán hạng, chuyển giá trị toán hạng từ ô nhớ này vào đơn vị xử lý trung tâm, lấy nội dung ACC trừ đi nội dung ô nhớ địa chỉ xxxxx, kết quả chứa vào ACC.'
    ],
    correctAnswersHtml: [
      'Lấy nội dung ACC trừ đi nội dung ô nhớ địa chỉ xxxxx, kết quả chứa vào ACC'
    ]
  },
  {
    courseId: '18f6180d-c4ea-436d-81f2-6dbb76f0d539',
    questionHtml: '<p>Trong đơn vị xử lý trung tâm, đơn vị điều khiển CU sinh ra các tín hiệu điều khiển dựa trên cơ sở:</p><p></p>',
    answersHtml: [
      'Các thông tin từ người sử dụng máy tính',
      'Các thông tin chứa trong mã lệnh máy',
      'Các thông tin chứa trong mã thao tác của mã lệnh máy',
      'Các thông tin chứa trong chương trình đang chạy trong máy tính'
    ],
    correctAnswersHtml: [
      'Các thông tin từ người sử dụng máy tính'
    ]
  },
  {
    courseId: '18f6180d-c4ea-436d-81f2-6dbb76f0d539',
    questionHtml: '<p>Chức năng của bộ nhớ chính là gì ?</p><p></p>',
    answersHtml: [
      'Chứa tập tin chương trình và dữ liệu có liên quan<br><p> <img src="https://learning.ehou.edu.vn/theme/image.php/coursemos/core/1739846736/i/grade_incorrect" alt="Câu trả lời không đúng" class="questioncorrectnessicon"></p>',
      'Chứa thông tin<br><p> </p>',
      'Chứa chương trình đang thực hiện và dữ liệu có liên quan',
      'Chứa dữ liệu'
    ],
    correctAnswersHtml: [
      'Chứa tập tin chương trình và dữ liệu có liên quan<br><p> <img src="https://learning.ehou.edu.vn/theme/image.php/coursemos/core/1739846736/i/grade_incorrect" alt="Câu trả lời không đúng" class="questioncorrectnessicon"></p>'
    ]
  }
];

function checkServer(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function sendQuestionsToAPI() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(filteredQuestions);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/questions/bulk-upsert',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('📤 Chuẩn bị gửi', filteredQuestions.length, 'câu hỏi có đáp án đúng lên hệ thống...\n');

  // Kiểm tra server
  console.log('🔍 Kiểm tra trạng thái backend server...');
  const isServerRunning = await checkServer('http://localhost:3000');

  if (!isServerRunning) {
    console.log('❌ Backend server không chạy trên http://localhost:3000');
    console.log('💡 Khởi động server bằng lệnh:');
    console.log('   cd backend && docker-compose up -d');
    console.log('   Hoặc: npm run start:dev');
    return;
  }

  console.log('✅ Backend server đang chạy\n');

  // Hiển thị preview
  console.log('📋 Preview các câu hỏi sẽ được gửi:');
  filteredQuestions.forEach((q, index) => {
    console.log(`  ${index + 1}. ${q.questionHtml.replace(/<[^>]*>/g, '').substring(0, 80)}...`);
  });
  console.log('');

  // Gửi dữ liệu
  console.log('🚀 Đang gửi dữ liệu lên API...');
  try {
    const result = await sendQuestionsToAPI();

    if (result.statusCode === 200) {
      console.log('✅ Thành công! Đã gửi', filteredQuestions.length, 'câu hỏi lên hệ thống');
      console.log('📊 Response:', result.data);
    } else {
      console.log('❌ Lỗi khi gửi dữ liệu:', result.statusCode);
      console.log('📊 Response:', result.data);
    }
  } catch (error) {
    console.log('❌ Lỗi kết nối:', error.message);
    console.log('💡 Kiểm tra lại:');
    console.log('   - Backend server có đang chạy không?');
    console.log('   - URL API có đúng không?');
    console.log('   - Database có kết nối được không?');
  }
}

main();
