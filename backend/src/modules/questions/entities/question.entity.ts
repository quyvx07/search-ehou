import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Course } from './course.entity';

@Entity('questions')
@Index(['courseId'])
@Index(['createdAt'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId: string;

  @Column({ type: 'text', name: 'question_html' })
  questionHtml: string;

  @Column({ type: 'jsonb', name: 'answers_html' })
  answersHtml: string[];

  @Column({ type: 'jsonb', name: 'correct_answers_html' })
  correctAnswersHtml: string[];

  @Column({ type: 'text', nullable: true, name: 'explanation_html' })
  explanationHtml?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'is_anonymized' })
  isAnonymized: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'anonymized_at' })
  anonymizedAt?: Date;

  @ManyToOne(() => Course, (course) => course.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;
}
