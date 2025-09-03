import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Question } from './question.entity';

@Entity('courses')
@Index(['courseCode'], { unique: true })
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'course_code' })
  courseCode: string;

  @Column({ type: 'varchar', length: 255, name: 'course_name' })
  courseName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'is_anonymized' })
  isAnonymized: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'anonymized_at' })
  anonymizedAt?: Date;

  @OneToMany(() => Question, (question) => question.course)
  questions: Question[];
}
