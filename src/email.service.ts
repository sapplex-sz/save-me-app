import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
        host: 'smtp.qq.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
            user: 'app_mail@qq.com',
            pass: 'rxrepqtebyanbhge'
        }
        });
    }

    async sendEmail(payload: EmailPayload): Promise<boolean> {
        try {
            const info = await this.transporter.sendMail({
                from: '"救救我 App" <app_mail@qq.com>',
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
        });
        this.logger.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        this.logger.error(`Failed to send email: ${error.message}`);
        return false;
    }
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
      secondaryEmail: string = ''
  ) {
      // 生成高德地图标记链接 (中国区最常用)
      const mapLink = latitude && longitude 
        ? `https://uri.amap.com/marker?position=${longitude},${latitude}&name=最后已知位置`
        : '未知位置';

      const subject = `【紧急求助】${userName} 可能遇到危险 - 救救我 App`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">紧急求助警报</h1>
            </div>
            <div style="padding: 20px;">
                <p><strong>${userName}</strong> 通过“救救我” App 触发了紧急预警。</p>
                <p>由于长时间未报平安（超时），系统自动发送此邮件。</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #d32f2f;">活动详情</h3>
                    <p><strong>活动名称：</strong>${activityName}</p>
                    <p><strong>事项描述：</strong>${description || '无'}</p>
                    <p><strong>最后报平安时间：</strong>${lastCheckInTime.toLocaleString()}</p>
                    ${latitude && longitude ? `<p><strong>最后已知坐标：</strong>${latitude}, ${longitude}</p>` : ''}
                </div>

                <div style="background-color: #fff3e0; padding: 15px; border-left: 5px solid #ff9800; border-radius: 4px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #e65100;">紧急操作指令</h3>
                    <p style="white-space: pre-wrap;">${emergencyInstructions || '请立即尝试联系当事人。如果无法取得联系，请根据情况考虑报警或联系其亲友。'}</p>
                </div>
                
                ${latitude && longitude ? `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${mapLink}" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">在地图上查看位置</a>
                    <p style="font-size: 12px; color: #999; margin-top: 10px;">(点击按钮将打开高德地图)</p>
                </div>
                ` : '<p style="color: #d32f2f; font-weight: bold;">无法获取到具体位置坐标。</p>'}
                
                <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px;">此邮件由“救救我”自动安全系统发出。请勿直接回复。</p>
            </div>
        </div>
      `;

      const targets = [toEmail];
      if (secondaryEmail) targets.push(secondaryEmail);
      
      return Promise.all(targets.map(to => this.sendEmail({ to, subject, html })));
  }
}
