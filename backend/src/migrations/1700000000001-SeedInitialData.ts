import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialData1700000000001 implements MigrationInterface {
  name = 'SeedInitialData1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert sample courses
    await queryRunner.query(`
      INSERT INTO courses (id, course_code, course_name, created_at, updated_at)
      VALUES 
        ('550e8400-e29b-41d4-a716-446655440001', 'IT01.100', 'Kỹ thuật lập trình cơ sở', NOW(), NOW()),
        ('550e8400-e29b-41d4-a716-446655440002', 'IT01.101', 'Cấu trúc dữ liệu và giải thuật', NOW(), NOW()),
        ('550e8400-e29b-41d4-a716-446655440003', 'IT01.102', 'Lập trình hướng đối tượng', NOW(), NOW())
      ON CONFLICT (course_code) DO NOTHING;
    `);

    // Insert sample questions
    await queryRunner.query(`
      INSERT INTO questions (course_id, question_html, answers_html, correct_answers_html, explanation_html, created_at, updated_at)
      VALUES 
        (
          '550e8400-e29b-41d4-a716-446655440001',
          '<p>Cho hàm HoanDoi được định nghĩa như hình:</p><p><img src="https://learning.ehou.edu.vn/pluginfile.php/1354885/question/questiontext/14530515/1/24395815/26952341.png" alt="" width="241px" height="92px"></p><p>Tham số của hàm HoanDoi thuộc loại gì?</p>',
          '["Tham biến và tham trị", "Không xác định được", "Tham biến", "Tham trị"]',
          '["Tham biến"]',
          '<p>Đáp án đúng là: Tham biến</p><p></p><p></p><p>Tham khảo: </p><p>Bài 4 – Hàm và CTC, Bản Text.</p>',
          NOW(),
          NOW()
        ),
        (
          '550e8400-e29b-41d4-a716-446655440001',
          '<p>Đâu là hàm thực hiện kiểm tra một số nguyên n là số lẻ?</p>',
          '["function isOdd(n) { return n % 2 == 1; }", "function isOdd(n) { return n % 2 == 0; }", "function isOdd(n) { return n / 2 == 0; }", "function isOdd(n) { return n * 2 == 1; }"]',
          '["function isOdd(n) { return n % 2 == 1; }"]',
          '<p>Hàm kiểm tra số lẻ sử dụng phép chia lấy dư (%) với 2. Nếu kết quả là 1 thì số đó là số lẻ.</p>',
          NOW(),
          NOW()
        ),
        (
          '550e8400-e29b-41d4-a716-446655440002',
          '<p>Thuật toán sắp xếp nào có độ phức tạp thời gian trung bình là O(n log n)?</p>',
          '["Bubble Sort", "Quick Sort", "Selection Sort", "Insertion Sort"]',
          '["Quick Sort"]',
          '<p>Quick Sort có độ phức tạp thời gian trung bình là O(n log n), trong khi các thuật toán khác có độ phức tạp O(n²).</p>',
          NOW(),
          NOW()
        )
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM questions WHERE course_id IN ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002')`);
    await queryRunner.query(`DELETE FROM courses WHERE course_code IN ('IT01.100', 'IT01.101', 'IT01.102')`);
  }
}
