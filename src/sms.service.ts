import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from './settings.service';
const SMSClient = require('@alicloud/sms-sdk');

export interface SmsPayload {
  to: string;
  templateCode: string;
  params: Record<string, string>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getClient() {
    const accessKeyId = await this.settingsService.getSetting('SMS_ACCESS_KEY_ID');
    const secretAccessKey = await this.settingsService.getSetting('SMS_ACCESS_KEY_SECRET');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('Aliyun SMS AccessKeyId or SecretAccessKey is missing. SMS will not be sent.');
      return null;
    }

    return new SMSClient({ accessKeyId, secretAccessKey });
  }

  async sendSms(payload: SmsPayload): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      this.logger.warn(`[MOCK SMS] Sending to ${payload.to}: ${JSON.stringify(payload.params)}`);
      return true; // Return true to not block the flow during development
    }

    const signName = await this.settingsService.getSetting('SMS_SIGN_NAME');
    
    try {
      const res = await client.sendSMS({
        PhoneNumbers: payload.to,
        SignName: signName || '救救我App',
        TemplateCode: payload.templateCode,
        TemplateParam: JSON.stringify(payload.params)
      });

      if (res.Code === 'OK') {
        this.logger.log(`SMS sent successfully to ${payload.to}`);
        return true;
      } else {
        this.logger.error(`Failed to send SMS to ${payload.to}: ${res.Message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Aliyun SMS error: ${error.message}`);
      return false;
    }
  }

  async sendAlert(phoneNumber: string, activityId: string, locationLink: string, description: string) {
      const templateCode = await this.settingsService.getSetting('SMS_TEMPLATE_CODE');
      
      return this.sendSms({
          to: phoneNumber,
          templateCode: templateCode || 'SMS_ALERT_001',
          params: {
              activityId: activityId.substring(0, 8), // 缩短 ID 节省字数
              location: locationLink,
              desc: description.substring(0, 20) // 限制描述长度
          }
      });
  }
}
