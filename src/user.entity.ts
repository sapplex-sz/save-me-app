import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Activity } from './activity.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  defaultContactPhone: string;

  @Column({ nullable: true })
  defaultContactEmail: string;

  @Column({ default: 30 })
  defaultIntervalMinutes: number;

  @Column({ default: 5 })
  defaultWarningMinutes: number;

  @OneToMany(() => Activity, (activity) => activity.user)
  activities: Activity[];

  @CreateDateColumn()
  createdAt: Date;
}
