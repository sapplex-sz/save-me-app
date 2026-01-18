import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Setting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
