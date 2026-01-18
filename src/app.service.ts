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
    toleranceMinutes?: number,
    userName: string = '匿名用户',
    language: string = 'zh',
  ) {
    // 限制：同一个手机号 1 分钟内只能开启一次活动，防止恶意刷接口
    const recentActivity = await this.activityRepository.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });

    if (recentActivity && (new Date().getTime() - recentActivity.createdAt.getTime() < 60000)) {
      throw new Error('操作过于频繁，请 1 分钟后再试');
    }

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
    activity.userName = userName;
    activity.activityName = activityName;
    activity.description = description;
    activity.checkInIntervalMinutes = interval;
    activity.emergencyContactPhone = contactPhone;
    activity.emergencyContactEmail = contactEmail;
    activity.secondaryContactPhone = secondaryContactPhone;
    activity.secondaryContactEmail = secondaryContactEmail;
    activity.emergencyInstructions = emergencyInstructions;
    activity.toleranceMinutes = toleranceMinutes !== undefined ? toleranceMinutes : 0; // 测试期间默认设为0，方便快速验证
    activity.warningMinutes = warningMinutes;
    activity.language = language;
    activity.status = 'active';
    activity.lastLatitude = lastLatitude;
    activity.lastLongitude = lastLongitude;

    // 计算第一次 Deadline
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + interval + activity.toleranceMinutes);
    activity.nextCheckInDeadline = deadline;

    const savedActivity = await this.activityRepository.save(activity);
    this.logger.log(`Activity started: ${savedActivity.id}, Deadline: ${deadline.toISOString()}`);

    // 生成邮件预览内容
    const emailPreview = this.emailService.getAlertTemplate(
      savedActivity.activityName,
      savedActivity.userName || savedActivity.phoneNumber,
      savedActivity.lastLatitude ? Number(savedActivity.lastLatitude) : null,
      savedActivity.lastLongitude ? Number(savedActivity.lastLongitude) : null,
      savedActivity.description || '',
      savedActivity.emergencyInstructions || '',
      savedActivity.createdAt,
      savedActivity.language || 'zh'
    );

    // 添加延时任务
    const delayMs = (interval + activity.toleranceMinutes) * 60 * 1000;
    await this.alarmQueue.add(
      `📧 告警预览 | ${activity.userName || activity.phoneNumber} - ${activity.activityName}`,
      { 
        activityId: savedActivity.id,
        activityName: savedActivity.activityName,
        phoneNumber: savedActivity.phoneNumber,
        deadline: deadline.toISOString(),
        emailPreview: {
          subject: emailPreview.subject,
          body: emailPreview.html
        }
      },
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

    // 生成邮件预览内容
    const emailPreview = this.emailService.getAlertTemplate(
      activity.activityName,
      activity.userName || activity.phoneNumber,
      activity.lastLatitude ? Number(activity.lastLatitude) : null,
      activity.lastLongitude ? Number(activity.lastLongitude) : null,
      activity.description || '',
      activity.emergencyInstructions || '',
      activity.nextCheckInDeadline,
      activity.language || 'zh'
    );

    // 添加延时任务
    const delayMs =
      (activity.checkInIntervalMinutes + activity.toleranceMinutes) * 60 * 1000;
    await this.alarmQueue.add(
      `📧 告警预览 | ${activity.userName || activity.phoneNumber} - ${activity.activityName}`,
      { 
        activityId: activity.id,
        activityName: activity.activityName,
        phoneNumber: activity.phoneNumber,
        deadline: nextDeadline.toISOString(),
        emailPreview: {
          subject: emailPreview.subject,
          body: emailPreview.html
        }
      },
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
        // 核心改动：仅验证 SMTP 配置连通性，不发送真实邮件
        const isConfigValid = await this.emailService.verifyConfig();
        results.email = isConfigValid ? 'ok' : 'failed';
      } catch (e) {
        results.email = 'failed';
      }
    }

    return results;
  }
}
