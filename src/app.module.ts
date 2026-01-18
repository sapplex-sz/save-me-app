import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Activity } from './activity.entity';
import { User } from './user.entity';
import { CheckIn } from './check-in.entity';
import { ActivityConsumer } from './activity.consumer';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { Setting } from './setting.entity';
import { EmailSender } from './email-sender.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    // 1. 数据库连接
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'saveme_db',
      password: process.env.DB_PASSWORD || 'drKZLR8h7K7snzhD',
      database: process.env.DB_DATABASE || 'saveme_db',
      entities: [Activity, User, CheckIn, Setting, EmailSender],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Activity, User, CheckIn, Setting, EmailSender]),

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

    // 3. 可视化监控面板
    BullBoardModule.forRoot({
      adapter: ExpressAdapter,
      route: '/admin/queues',
      boardOptions: {
        uiConfig: {
          boardTitle: '救救我 App 管理后台',
          miscLinks: [
            { text: '系统设置', url: '/admin/settings' }
          ],
        }
      }
    }),
    BullBoardModule.forFeature({
      name: 'alarm-queue',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [AppController, SettingsController],
  providers: [
    AppService, 
    ActivityConsumer, 
    SmsService, 
    EmailService, 
    SettingsService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
