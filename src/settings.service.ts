import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';
import { EmailSender } from './email-sender.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
    @InjectRepository(EmailSender)
    private emailSenderRepository: Repository<EmailSender>,
  ) {}

  async onModuleInit() {
    // 初始化默认配置
    const defaultSettings = [
      { key: 'EMAIL_HOST', value: process.env.EMAIL_HOST || 'smtp.qq.com', description: '邮件服务器地址' },
      { key: 'EMAIL_PORT', value: process.env.EMAIL_PORT || '465', description: '邮件服务器端口' },
      { key: 'EMAIL_SECURE', value: process.env.EMAIL_SECURE || 'true', description: '是否使用 SSL/TLS (true/false)' },
      { key: 'EMAIL_USER', value: process.env.EMAIL_USER || 'app_mail@qq.com', description: '发件邮箱账号' },
      { key: 'EMAIL_PASS', value: process.env.EMAIL_PASS || '', description: '发件邮箱授权码' },
      // 阿里云短信设置
      { key: 'SMS_ACCESS_KEY_ID', value: '', description: '阿里云 AccessKey ID' },
      { key: 'SMS_ACCESS_KEY_SECRET', value: '', description: '阿里云 AccessKey Secret' },
      { key: 'SMS_SIGN_NAME', value: '', description: '阿里云短信签名' },
      { key: 'SMS_TEMPLATE_CODE', value: '', description: '阿里云短信模板 Code' },
    ];

    for (const s of defaultSettings) {
      const exists = await this.settingsRepository.findOne({ where: { key: s.key } });
      if (!exists) {
        await this.settingsRepository.save(s);
      }
    }
  }

  async getSetting(key: string): Promise<string> {
    const s = await this.settingsRepository.findOne({ where: { key } });
    return s ? s.value : '';
  }

  async getAllSettings(): Promise<Setting[]> {
    return this.settingsRepository.find();
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.settingsRepository.update({ key }, { value });
    }
  }

  // EmailSender 管理
  async getAllEmailSenders(): Promise<EmailSender[]> {
    return this.emailSenderRepository.find({ order: { id: 'DESC' } });
  }

  async addEmailSender(data: Partial<EmailSender>): Promise<EmailSender> {
    const sender = this.emailSenderRepository.create(data);
    return this.emailSenderRepository.save(sender);
  }

  async deleteEmailSender(id: number): Promise<void> {
    await this.emailSenderRepository.delete(id);
  }

  async toggleEmailSender(id: number, isActive: boolean): Promise<void> {
    await this.emailSenderRepository.update(id, { isActive });
  }
}
