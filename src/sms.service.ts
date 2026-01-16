import { Injectable, Logger } from '@nestjs/common';

export interface SmsPayload {
  to: string;
  templateCode: string;
  params: Record<string, string>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendSms(payload: SmsPayload): Promise<boolean> {
    // Mock implementation for MVP
    // In production, integrate with Aliyun/Twilio here
    this.logger.warn(`[MOCK SMS] Sending to ${payload.to}: ${JSON.stringify(payload.params)}`);
    return true;
  }

  async sendAlert(phoneNumber: string, activityId: string, locationLink: string, description: string) {
      return this.sendSms({
          to: phoneNumber,
          templateCode: 'SMS_ALERT_001',
          params: {
              activityId,
              location: locationLink,
              desc: description
          }
      });
  }
}
