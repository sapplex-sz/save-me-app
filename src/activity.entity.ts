import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { CheckIn } from './check-in.entity';

@Entity()
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phoneNumber: string; // 用户的手机号 (V1 作为简易 ID，保留以防 User 为空)

  @Column({ nullable: true })
  userName: string; // 用户的昵称

  @Column({ default: 'zh' })
  language: string; // 用户偏好语言: zh, en

  @ManyToOne(() => User, (user) => user.activities, { nullable: true })
  user: User;

  @Column()
  emergencyContactPhone: string; // 紧急联系人电话

  @Column({ nullable: true })
  emergencyContactEmail: string; // 紧急联系人邮箱

  @Column({ nullable: true })
  secondaryContactPhone: string; // 备用联系人电话

  @Column({ nullable: true })
  secondaryContactEmail: string; // 备用联系人邮箱

  @Column()
  activityName: string; // 活动名称，如"周六徒步"

  @Column({ nullable: true, type: 'text' })
  description: string; // 事项主题/详细描述

  @Column({ nullable: true, type: 'text' })
  emergencyInstructions: string; // 紧急指令（发生意外联系人该怎么做）

  @Column({ type: 'float', nullable: true })
  lastLatitude?: number; // 最后已知纬度

  @Column({ type: 'float', nullable: true })
  lastLongitude?: number; // 最后已知经度

  @Column({ type: 'int', nullable: true })
  batteryLevel?: number; // 剩余电量 %

  @Column({ type: 'int' })
  checkInIntervalMinutes: number; // 报平安间隔 (分钟)

  @Column({ type: 'int', default: 5 })
  toleranceMinutes: number; // 容忍延迟 (分钟) - Hard Deadline buffer

  @Column({ type: 'int', default: 5 })
  warningMinutes: number; // 预警提前量 (分钟) - Soft Deadline buffer

  @Column({ type: 'timestamp' })
  nextCheckInDeadline: Date; // 下一次必须报平安的最晚时间 (Hard Deadline)

  @Column({ default: false })
  isWarned: boolean; // 是否已触发预警

  @Column({ default: 'active' })
  status: 'active' | 'safe' | 'alarmed' | 'finished'; // 活动状态

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CheckIn, (checkIn) => checkIn.activity)
  checkIns: CheckIn[];
}
