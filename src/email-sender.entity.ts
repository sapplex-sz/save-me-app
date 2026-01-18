import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class EmailSender {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  host: string;

  @Column()
  port: number;

  @Column({ default: true })
  secure: boolean;

  @Column()
  user: string;

  @Column()
  pass: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
