-- Sample data for testing migration
-- This creates some basic data in the old schema format

-- Create subjects (courses)
INSERT INTO subjects (id, name, course_code, description, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Toán học', 'MATH101', 'Môn toán cơ bản', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Ngữ văn', 'LIT101', 'Môn ngữ văn cơ bản', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Tiếng Anh', 'ENG101', 'Môn tiếng Anh cơ bản', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create questions
INSERT INTO questions (id, content, explanation, subject_id, correct_answer_id, created_at, updated_at)
VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '1 + 1 bằng mấy?', 'Câu hỏi toán đơn giản', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', NOW(), NOW()),
  ('660e8400-e29b-41d4-a716-446655440002', 'Ai là tác giả của Truyện Kiều?', 'Câu hỏi văn học', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', NOW(), NOW()),
  ('660e8400-e29b-41d4-a716-446655440003', 'Hello bằng tiếng Việt là gì?', 'Câu hỏi tiếng Anh', '550e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create question choices
INSERT INTO question_choices (id, text, question_id)
VALUES
  (1, '1', '660e8400-e29b-41d4-a716-446655440001'),
  (2, '2', '660e8400-e29b-41d4-a716-446655440001'),
  (3, '3', '660e8400-e29b-41d4-a716-446655440001'),
  (4, '4', '660e8400-e29b-41d4-a716-446655440001'),

  (5, 'Nguyễn Du', '660e8400-e29b-41d4-a716-446655440002'),
  (6, 'Nguyễn Trãi', '660e8400-e29b-41d4-a716-446655440002'),
  (7, 'Nguyễn Đình Chiểu', '660e8400-e29b-41d4-a716-446655440002'),
  (8, 'Hồ Xuân Hương', '660e8400-e29b-41d4-a716-446655440002'),

  (9, 'Xin chào', '660e8400-e29b-41d4-a716-446655440003'),
  (10, 'Tạm biệt', '660e8400-e29b-41d4-a716-446655440003'),
  (11, 'Cảm ơn', '660e8400-e29b-41d4-a716-446655440003'),
  (12, 'Xin lỗi', '660e8400-e29b-41d4-a716-446655440003')
ON CONFLICT (id) DO NOTHING;

-- Create correct answers
INSERT INTO correct_answers (id, text)
VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '2'),
  ('770e8400-e29b-41d4-a716-446655440002', 'Nguyễn Du'),
  ('770e8400-e29b-41d4-a716-446655440003', 'Xin chào')
ON CONFLICT (id) DO NOTHING;

-- Create some additional tables if they don't exist
CREATE TABLE IF NOT EXISTS question_images (
  id SERIAL PRIMARY KEY,
  image_url VARCHAR(255),
  question_id VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS choice_images (
  id SERIAL PRIMARY KEY,
  image_url VARCHAR(255),
  choice_id BIGINT
);

CREATE TABLE IF NOT EXISTS attachment (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  url VARCHAR(255)
);

-- Insert sample data for additional tables
INSERT INTO question_images (image_url, question_id)
VALUES
  ('https://example.com/math1.png', '660e8400-e29b-41d4-a716-446655440001'),
  ('https://example.com/literature1.png', '660e8400-e29b-41d4-a716-446655440002')
ON CONFLICT DO NOTHING;

INSERT INTO choice_images (image_url, choice_id)
VALUES
  ('https://example.com/choice1.png', 1),
  ('https://example.com/choice2.png', 2)
ON CONFLICT DO NOTHING;

INSERT INTO attachment (id, name, url)
VALUES
  ('880e8400-e29b-41d4-a716-446655440001', 'Math Formula', 'https://example.com/formula.pdf'),
  ('880e8400-e29b-41d4-a716-446655440002', 'Literature Analysis', 'https://example.com/analysis.pdf')
ON CONFLICT (id) DO NOTHING;
