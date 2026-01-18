import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import { EmailSender } from './email-sender.entity';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private currentIndex = 0;

  constructor(
    private readonly settingsService: SettingsService,
    @InjectRepository(EmailSender)
    private readonly emailSenderRepository: Repository<EmailSender>,
  ) {}

  private async getActiveSenders(): Promise<EmailSender[]> {
    const senders = await this.emailSenderRepository.find({
      where: { isActive: true },
    });

    if (senders.length > 0) {
      return senders;
    }

    // 如果 EmailSender 表为空，则尝试从 Settings 迁移或使用默认值
    const host = await this.settingsService.getSetting('EMAIL_HOST');
    const port = await this.settingsService.getSetting('EMAIL_PORT');
    const secure = await this.settingsService.getSetting('EMAIL_SECURE');
    const user = await this.settingsService.getSetting('EMAIL_USER');
    const pass = await this.settingsService.getSetting('EMAIL_PASS');

    if (user && pass) {
      const defaultSender = new EmailSender();
      defaultSender.host = host || 'smtp.qq.com';
      defaultSender.port = parseInt(port || '465', 10);
      defaultSender.secure = secure === 'true';
      defaultSender.user = user;
      defaultSender.pass = pass;
      await this.emailSenderRepository.save(defaultSender);
      return [defaultSender];
    }

    return [];
  }

  private async createTransporter(sender: EmailSender): Promise<nodemailer.Transporter> {
    return nodemailer.createTransport({
      host: sender.host,
      port: sender.port,
      secure: sender.secure,
      auth: {
        user: sender.user,
        pass: sender.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async verifyConfig(): Promise<boolean> {
    try {
      const senders = await this.getActiveSenders();
      if (senders.length === 0) return false;
      
      // 验证第一个可用的配置
      const transporter = await this.createTransporter(senders[0]);
      await transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`SMTP Configuration verification failed: ${error.message}`);
      return false;
    }
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    const senders = await this.getActiveSenders();
    if (senders.length === 0) {
      this.logger.error('No active email senders configured');
      return false;
    }

    // 轮询选择一个发件人
    const sender = senders[this.currentIndex % senders.length];
    this.currentIndex++;

    try {
      const transporter = await this.createTransporter(sender);
      this.logger.log(`Attempting to send email from: ${sender.user} (Sender ID: ${sender.id}) to: ${payload.to}`);
      
      const info = await transporter.sendMail({
        from: `"救救我 App" <${sender.user}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });

      this.logger.log(`Email sent: ${info.messageId} via ${sender.user}`);
      
      // 更新成功统计
      await this.emailSenderRepository.update(sender.id, { 
        successCount: sender.successCount + 1 
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email via ${sender.user}: ${error.message}`);
      
      // 更新失败统计
      await this.emailSenderRepository.update(sender.id, { 
        failCount: sender.failCount + 1 
      });

      // 尝试使用下一个发件人重试（如果还有其他发件人）
      if (senders.length > 1) {
        this.logger.warn('Retrying with next available sender...');
        return this.sendEmail(payload); 
      }

      return false;
    }
  }

  getAlertTemplate(
    activityName: string, 
    userName: string,
    latitude: number | null,
    longitude: number | null,
    description: string,
    emergencyInstructions: string,
    lastCheckInTime: Date,
    lang: string = 'zh',
  ) {
    const isEn = lang === 'en';
    
    const mapLink = latitude && longitude 
      ? `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${isEn ? 'Last Known Location' : '最后已知位置'}`
      : (isEn ? 'Unknown Location' : '未知位置');

    const subject = isEn 
      ? `[EMERGENCY] ${userName} may be in danger - SaveMe App`
      : `【紧急求助】${userName} 可能遇到危险 - 救救我 App`;

    const title = isEn ? 'Emergency Alert' : '紧急求助警报';
    const hello = isEn ? 'Hello,' : '您好，';
    const bodyText = isEn 
      ? `This is an automated alert from <strong>SaveMe App</strong>. Your contact <strong>${userName}</strong> is participating in <strong>"${activityName}"</strong> but failed to check in on time and is currently unreachable.`
      : `这是来自 <strong>救救我 App</strong> 的自动警报。您的联系人 <strong>${userName}</strong> 正在进行活动 <strong>“${activityName}”</strong>，但未能按时签到，且目前处于失联状态。`;
    
    const lastKnownStatus = isEn ? 'Last Known Status:' : '最后已知状态：';
    const lostTimeLabel = isEn ? 'Lost Contact Since:' : '失联判定时间：';
    const locationLabel = isEn ? 'Last Known Location:' : '当前已知位置：';
    const defaultInstructions = isEn 
      ? 'Please try to contact them immediately. If you cannot reach them, consider contacting local authorities or their family/friends.'
      : '请立即尝试联系当事人。如果无法取得联系，请根据情况考虑报警或联系其亲友。';
    const footer = isEn 
      ? 'This email was automatically generated by SaveMe App. Please do not reply.'
      : '此邮件由 救救我 App 自动发出，请勿直接回复。';

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ff4d4f; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ff4d4f; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${title}</h1>
        </div>
        <div style="padding: 20px; line-height: 1.6; color: #333;">
          <p>${hello}</p>
          <p>${bodyText}</p>
          
          <div style="background-color: #fff1f0; border: 1px solid #ffa39e; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #cf1322;">${lastKnownStatus}</h3>
            <ul style="margin-bottom: 0;">
              <li><strong>${lostTimeLabel}</strong> ${lastCheckInTime.toLocaleString(isEn ? 'en-US' : 'zh-CN')}</li>
              <li><strong>${locationLabel}</strong> ${mapLink}</li>
            </ul>
          </div>

          <p><strong>${userName}</strong> ${isEn ? 'triggered this emergency alert via SaveMe App.' : '通过“救救我” App 触发了紧急预警。'}</p>

          <div style="background-color: #fff3e0; padding: 15px; border-left: 5px solid #ff9800; border-radius: 4px; margin: 20px 0;">
            <p style="white-space: pre-wrap; margin: 0;">${emergencyInstructions || defaultInstructions}</p>
          </div>

          <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
            ${footer}
          </p>
        </div>
      </div>
    `;
    return { subject, html };
  }

  async sendAlert(
    toEmail: string, 
    activityName: string, 
    userName: string,
    latitude: number | null,
    longitude: number | null,
    description: string,
    emergencyInstructions: string,
    lastCheckInTime: Date,
    secondaryEmail: string = '',
    lang: string = 'zh'
  ) {
    if (!toEmail || !toEmail.includes('@')) {
      this.logger.warn(`Invalid primary email address: ${toEmail}, skipping.`);
      return;
    }

    const { subject, html } = this.getAlertTemplate(
      activityName,
      userName,
      latitude,
      longitude,
      description,
      emergencyInstructions,
      lastCheckInTime,
      lang
    );

    await this.sendEmail({
      to: toEmail,
      subject,
      html,
    });

    if (secondaryEmail && secondaryEmail.includes('@')) {
      await this.sendEmail({
        to: secondaryEmail,
        subject,
        html,
      });
    } else if (secondaryEmail) {
      this.logger.warn(`Invalid secondary email address: ${secondaryEmail}, skipping.`);
    }
  }
}
