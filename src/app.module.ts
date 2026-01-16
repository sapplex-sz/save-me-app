import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Activity } from './activity.entity';
import { User } from './user.entity';
import { CheckIn } from './check-in.entity';
import { ActivityConsumer } from './activity.consumer';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

@Module({
  imports: [
    // 1. 数据库连接
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'saveme_db',
      password: process.env.DB_PASSWORD || 'drKZLR8h7K7snzhD',
      database: process.env.DB_DATABASE || 'saveme_db',
      entities: [Activity, User, CheckIn],
      synchronize: true,
    }),
      TypeOrmModule.forFeature([Activity, User, CheckIn]),

    // 2. Redis 任务队列连接
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({
      name: 'alarm-queue', // 队列名称
    }),
  ],
  controllers: [AppController],
  providers: [AppService, ActivityConsumer, SmsService, EmailService],
})
export class AppModule {}
