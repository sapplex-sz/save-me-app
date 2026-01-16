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
    const { activityId } = job.data;
    this.logger.debug(`Checking timeout for activity: ${activityId}`);

    const activity = await this.activityRepository.findOneBy({ id: activityId });

    if (!activity) {
      this.logger.warn('Activity not found, skipping check.');
      return;
    }

    if (activity.status !== 'active') {
      this.logger.debug(`Activity status is ${activity.status}, skipping alarm.`);
      return;
    }

    // 核心判定：现在时间 > Deadline 吗？
    const now = new Date();
    if (now > activity.nextCheckInDeadline) {
      // !!! 真的超时了 !!!
      await this.triggerAlarm(activity);
    } else {
      this.logger.debug(
        `Safe. Now: ${now.toISOString()} < Deadline: ${activity.nextCheckInDeadline.toISOString()}`,
      );
    }
  }

  private async triggerAlarm(activity: Activity) {
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
          activity.phoneNumber, // userName (V1 use phone)
          activity.lastLatitude ? Number(activity.lastLatitude) : null,
          activity.lastLongitude ? Number(activity.lastLongitude) : null,
          activity.description || 'No description',
          activity.emergencyInstructions || '',
          activity.updatedAt || activity.createdAt,
          activity.secondaryContactEmail || ''
        );
      } catch (error) {
        this.logger.error(`Failed to send Email alert: ${error.message}`);
      }
    }
  }
}
