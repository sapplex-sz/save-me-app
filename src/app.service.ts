import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Activity } from './activity.entity';
import { EmailService } from './email.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    @InjectQueue('alarm-queue') private alarmQueue: Queue,
    private emailService: EmailService,
  ) {}

  // 1. 开始活动
  async startActivity(
    phoneNumber: string,
    activityName: string,
    description: string,
    interval: number, // 分钟
    contactPhone: string,
    contactEmail: string,
    warningMinutes: number = 5,
    lastLatitude?: number,
    lastLongitude?: number,
    secondaryContactPhone: string = '',
    secondaryContactEmail: string = '',
    emergencyInstructions: string = '',
  ) {
    // 结束旧的活动
    const oldActivity = await this.activityRepository.findOne({
      where: { phoneNumber, status: 'active' },
    });
    if (oldActivity) {
      oldActivity.status = 'finished';
      await this.activityRepository.save(oldActivity);
    }

    const activity = new Activity();
    activity.phoneNumber = phoneNumber;
    activity.activityName = activityName;
    activity.description = description;
    activity.checkInIntervalMinutes = interval;
    activity.emergencyContactPhone = contactPhone;
    activity.emergencyContactEmail = contactEmail;
    activity.secondaryContactPhone = secondaryContactPhone;
    activity.secondaryContactEmail = secondaryContactEmail;
    activity.emergencyInstructions = emergencyInstructions;
    activity.toleranceMinutes = 5; // 恢复为5分钟 (生产环境建议值)
    activity.warningMinutes = warningMinutes;
    activity.status = 'active';
    activity.lastLatitude = lastLatitude;
    activity.lastLongitude = lastLongitude;

    // 计算第一次 Deadline
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + interval + activity.toleranceMinutes);
    activity.nextCheckInDeadline = deadline;

    const savedActivity = await this.activityRepository.save(activity);
    this.logger.log(`Activity started: ${savedActivity.id}, Deadline: ${deadline.toISOString()}`);

    // 添加延时任务
    const delayMs = (interval + activity.toleranceMinutes) * 60 * 1000;
    await this.alarmQueue.add(
      'check-timeout',
      { activityId: savedActivity.id },
      { delay: delayMs },
    );

    return savedActivity;
  }

  // 2. 报平安 (心跳)
  async reportSafe(activityId: string, lat?: number, lng?: number, batteryLevel?: number) {
    const activity = await this.activityRepository.findOneBy({ id: activityId });
    if (!activity) throw new Error('Activity not found');
    if (activity.status !== 'active' && activity.status !== 'alarmed') {
        // 允许 alarmed 状态报平安，恢复为 active
        throw new Error('Activity is not active');
    }

    // 刷新 Deadline
    const now = new Date();
    const nextDeadline = new Date(now);
    nextDeadline.setMinutes(
      nextDeadline.getMinutes() +
        activity.checkInIntervalMinutes +
        activity.toleranceMinutes,
    );
    activity.nextCheckInDeadline = nextDeadline;

    // 如果之前是 alarmed，恢复为 active
    if (activity.status === 'alarmed') {
        activity.status = 'active';
        this.logger.log(`Activity ${activityId} recovered from ALARMED state!`);
    }

    // 更新位置 (如果有)
    if (lat !== undefined && lng !== undefined) {
      activity.lastLatitude = lat;
      activity.lastLongitude = lng;
    }

    // 更新电量
    if (batteryLevel !== undefined) {
        activity.batteryLevel = batteryLevel;
    }

    await this.activityRepository.save(activity);
    this.logger.log(`Safe reported: ${activityId}, Loc: ${lat},${lng}, Bat: ${batteryLevel}%, New Deadline: ${nextDeadline.toISOString()}`);

    // 添加新的延时任务
    const delayMs =
      (activity.checkInIntervalMinutes + activity.toleranceMinutes) * 60 * 1000;
    await this.alarmQueue.add(
      'check-timeout',
      { activityId: activity.id },
      { delay: delayMs },
    );

    return { status: 'ok', nextDeadline };
  }

  // 3. 结束活动
  async endActivity(activityId: string) {
    const activity = await this.activityRepository.findOneBy({ id: activityId });
    if (!activity) return;
    
    activity.status = 'finished';
    await this.activityRepository.save(activity);
    this.logger.log(`Activity finished: ${activityId}`);
    return activity;
  }

  // 4. 获取当前活动
  async getCurrentActivity(phoneNumber: string) {
      return this.activityRepository.findOne({
          where: { phoneNumber, status: 'active' },
          order: { createdAt: 'DESC' }
      });
  }

  // 5. 连接性测试
  async testConnection(email?: string, lat?: number, lng?: number) {
    const results = {
      network: 'ok',
      gps: 'pending',
      email: 'pending',
      timestamp: new Date().toISOString()
    };

    if (lat !== undefined && lng !== undefined) {
      results.gps = 'ok';
    } else {
      results.gps = 'missing';
    }

    if (email) {
      try {
        const testSubject = '【救救我 App】连接性测试邮件';
        const testHtml = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #4caf50; margin-top: 0;">✅ 连接测试成功</h2>
            <p>这是一封由“救救我”App 发出的自动测试邮件。</p>
            <p><strong>测试时间：</strong>${new Date().toLocaleString()}</p>
            <p>看到此邮件说明您的邮件通知功能已准备就绪。如果发生意外，系统将能准确地将求助信息发送至此邮箱。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">此邮件仅用于系统连接性测试，无需回复。</p>
          </div>
        `;
        const sent = await this.emailService.sendEmail({
          to: email,
          subject: testSubject,
          html: testHtml,
        });
        results.email = sent ? 'ok' : 'failed';
      } catch (e) {
        results.email = 'failed';
      }
    }

    return results;
  }
}
