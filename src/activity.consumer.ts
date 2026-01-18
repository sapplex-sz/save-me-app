import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from './activity.entity';
import { Logger } from '@nestjs/common';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

@Processor('alarm-queue')
export class ActivityConsumer extends WorkerHost {
  private readonly logger = new Logger(ActivityConsumer.name);

  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    private smsService: SmsService,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { activityId, emailPreview } = job.data;
    this.logger.debug(`Checking timeout for activity: ${activityId}`);

    // 在日志中记录邮件预览内容，方便在 Bull Board 中单独查看
    if (emailPreview) {
      await job.log('--- 邮件预览 (待发送内容) ---');
      await job.log(`主题: ${emailPreview.subject}`);
      await job.log(`正文预览: ${emailPreview.body.substring(0, 500)}...`);
      await job.log('---------------------------');
    }

    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      const msg = `Activity ${activityId} not found, skipping.`;
      await job.log(msg);
      return { status: 'not_found', msg };
    }

    if (activity.status !== 'active') {
      const msg = `用户已安全 (状态: ${activity.status})，告警已取消发送。`;
      this.logger.debug(msg);
      await job.log(`✅ ${msg}`);
      return { status: 'cancelled', reason: activity.status, email: emailPreview?.subject };
    }

    // 核心判定：现在时间 > Deadline 吗？
    const now = new Date();
    if (now > activity.nextCheckInDeadline) {
      // !!! 真的超时了 !!!
      return await this.triggerAlarm(activity, job);
    } else {
      this.logger.debug(
        `Safe. Now: ${now.toISOString()} < Deadline: ${activity.nextCheckInDeadline.toISOString()}`,
      );
    }
  }

  private async triggerAlarm(activity: Activity, job: Job<any, any, string>) {
    // 1. 修改状态
    activity.status = 'alarmed';
    await this.activityRepository.save(activity);

    // 2. 生成地图链接 (统一使用高德地图)
    const mapLink = (activity.lastLatitude && activity.lastLongitude) 
      ? `https://uri.amap.com/marker?position=${activity.lastLongitude},${activity.lastLatitude}&name=最后已知位置`
      : '未知位置';

    // 3. 发送告警日志
    const alertMessage = `
    🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
    [EMERGENCY ALERT] 用户失联！
    活动ID: ${activity.id}
    用户手机: ${activity.phoneNumber}
    活动名称: ${activity.activityName}
    详细描述: ${activity.description || '无'}
    紧急联系人: ${activity.emergencyContactPhone}
    
    最后位置: ${mapLink}
    
    请立即拨打紧急联系人电话！
    🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
    `;
    this.logger.error(alertMessage);
    
    // 4. 发送短信
    try {
      await this.smsService.sendAlert(
        activity.emergencyContactPhone, 
        activity.id, 
        mapLink, 
        activity.description || 'No description'
      );
    } catch (error) {
      this.logger.error(`Failed to send SMS alert: ${error.message}`);
    }

    // 5. 发送邮件 (如果有)
    if (activity.emergencyContactEmail) {
      try {
        await this.emailService.sendAlert(
          activity.emergencyContactEmail,
          activity.activityName,
          activity.userName || activity.phoneNumber, // userName (V1 use phone)
          activity.lastLatitude ? Number(activity.lastLatitude) : null,
          activity.lastLongitude ? Number(activity.lastLongitude) : null,
          activity.description || 'No description',
          activity.emergencyInstructions || '',
          activity.nextCheckInDeadline, // 使用业务截止时间，让联系人知道用户从何时起失联
          activity.secondaryContactEmail || '',
          activity.language || 'zh',
        );
        const msg = `🚨 告警邮件已成功发送至: ${activity.emergencyContactEmail}`;
        await job.log(msg);
        return { status: 'sent', recipient: activity.emergencyContactEmail };
      } catch (error) {
        this.logger.error(`Failed to send Email alert: ${error.message}`);
      }
    }
  }
}
