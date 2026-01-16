import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Activity } from './activity.entity';

@Entity()
export class CheckIn {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Activity, (activity) => activity.checkIns)
  activity: Activity;

  @Column('double')
  latitude: number;

  @Column('double')
  longitude: number;

  @CreateDateColumn()
  createdAt: Date;
}
