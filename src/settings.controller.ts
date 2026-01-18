import { Controller, Get, Post, Body, Res, Param, Patch, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { Response } from 'express';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettingsPage(@Res() res: Response) {
    const settings = await this.settingsService.getAllSettings();
    const emailSenders = await this.settingsService.getAllEmailSenders();
    
    const emailSettings = settings.filter(s => s.key.startsWith('EMAIL_'));
    const smsSettings = settings.filter(s => s.key.startsWith('SMS_'));

    const renderRows = (list: any[]) => list.map(s => `
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">${s.description}</label>
        <input type="text" name="${s.key}" value="${s.value}" placeholder="${s.key}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
    `).join('');

    const renderSenders = (senders: any[]) => senders.map(s => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${s.user}</td>
        <td style="padding: 10px;">${s.host}:${s.port}</td>
        <td style="padding: 10px;">
          <span style="color: ${s.isActive ? '#28a745' : '#dc3545'}; font-weight: bold;">
            ${s.isActive ? '启用' : '禁用'}
          </span>
        </td>
        <td style="padding: 10px; font-size: 12px; color: #666;">
          成功: ${s.successCount} / 失败: ${s.failCount}
        </td>
        <td style="padding: 10px; text-align: right;">
          <button onclick="toggleSender(${s.id}, ${!s.isActive})" style="padding: 4px 8px; font-size: 12px; background: ${s.isActive ? '#6c757d' : '#28a745'}; color: #fff; border: none; border-radius: 3px; cursor: pointer;">
            ${s.isActive ? '禁用' : '启用'}
          </button>
          <button onclick="deleteSender(${s.id})" style="padding: 4px 8px; font-size: 12px; background: #dc3545; color: #fff; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">
            删除
          </button>
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>系统设置 - 救救我 App</title>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; background: #f4f7f6; padding: 20px; color: #333; }
          .container { max-width: 900px; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 0 auto; }
          h2 { color: #333; margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h3 { color: #007bff; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #007bff; padding-left: 10px; }
          .btn { background: #007bff; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 20px; }
          .btn-sm { background: #28a745; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 10px; }
          .btn:hover { background: #0056b3; }
          .nav { margin-bottom: 20px; text-align: center; }
          .nav a { color: #666; text-decoration: none; margin: 0 10px; font-weight: bold; }
          .nav a:hover { color: #007bff; }
          .msg { padding: 15px; margin-bottom: 20px; border-radius: 4px; display: none; text-align: center; font-weight: bold; }
          .msg-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .section { background: #fafafa; padding: 20px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; background: #f0f0f0; padding: 10px; border-bottom: 2px solid #ddd; }
          .add-sender-form input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-right: 5px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="nav">
          <a href="/admin/queues">← 返回任务队列面板</a>
        </div>
        <div class="container">
          <h2>系统服务集成设置</h2>
          <div id="message" class="msg msg-success">设置已保存。</div>
          
          <div class="section">
            <h3>📧 发件人池 (多账号轮询)</h3>
            <p style="font-size: 13px; color: #666; margin-bottom: 15px;">
              支持配置多个 SMTP 发件账号，系统将采用<strong>轮询 (Round-Robin)</strong> 策略发送邮件。当某个账号发送失败时，将自动尝试下一个账号。这能有效解决单账号发送频率限制问题。
            </p>
            
            <table>
              <thead>
                <tr>
                  <th>发件邮箱</th>
                  <th>服务器</th>
                  <th>状态</th>
                  <th>统计 (累计)</th>
                  <th style="text-align: right;">操作</th>
                </tr>
              </thead>
              <tbody>
                ${emailSenders.length > 0 ? renderSenders(emailSenders) : '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">暂无发件人，请在下方添加或确保旧版配置正确</td></tr>'}
              </tbody>
            </table>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ddd;">
              <h4>添加新发件人</h4>
              <form id="addSenderForm" class="add-sender-form">
                <input type="text" name="user" placeholder="邮箱账号 (如: user@qq.com)" required style="width: 250px;">
                <input type="password" name="pass" placeholder="授权码/密码" required style="width: 150px;">
                <input type="text" name="host" placeholder="SMTP 服务器 (如: smtp.qq.com)" value="smtp.qq.com" required style="width: 180px;">
                <input type="number" name="port" placeholder="端口" value="465" required style="width: 80px;">
                <label><input type="checkbox" name="secure" checked> SSL</label>
                <br>
                <button type="submit" class="btn-sm">添加发件人</button>
              </form>
            </div>
          </div>

          <form id="settingsForm">
            <div class="section">
              <h3>⚙️ 默认/备用邮件设置 (旧版)</h3>
              <p style="font-size: 13px; color: #666; margin-bottom: 15px;">当发件人池为空时，将回退使用此配置。建议优先使用上方的“发件人池”。</p>
              ${renderRows(emailSettings)}
            </div>

            <div class="section">
              <h3>📱 阿里云短信设置 (Aliyun SMS)</h3>
              ${renderRows(smsSettings)}
            </div>

            <button type="submit" class="btn">保存全局基础设置</button>
          </form>
        </div>

        <script>
          const showMsg = (text) => {
            const msg = document.getElementById('message');
            msg.innerText = text;
            msg.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => msg.style.display = 'none', 3000);
          };

          // 保存基础设置
          document.getElementById('settingsForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            formData.forEach((value, key) => data[key] = value);
            const res = await fetch('/admin/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (res.ok) showMsg('全局基础设置已保存');
          };

          // 添加发件人
          document.getElementById('addSenderForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              user: formData.get('user'),
              pass: formData.get('pass'),
              host: formData.get('host'),
              port: parseInt(formData.get('port')),
              secure: formData.get('secure') === 'on'
            };
            const res = await fetch('/admin/settings/senders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (res.ok) {
              showMsg('发件人添加成功');
              setTimeout(() => location.reload(), 1000);
            }
          };

          // 切换状态
          async function toggleSender(id, isActive) {
            const res = await fetch(\`/admin/settings/senders/\${id}/toggle\`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive })
            });
            if (res.ok) location.reload();
          }

          // 删除
          async function deleteSender(id) {
            if (!confirm('确定要删除该发件人吗？')) return;
            const res = await fetch(\`/admin/settings/senders/\${id}\`, {
              method: 'DELETE'
            });
            if (res.ok) location.reload();
          }
        </script>
      </body>
      </html>
    `;
    res.send(html);
  }

  @Post()
  async updateSettings(@Body() settings: Record<string, string>) {
    await this.settingsService.updateSettings(settings);
    return { success: true };
  }

  // 多发件人管理接口
  @Post('senders')
  async addSender(@Body() data: any) {
    return this.settingsService.addEmailSender(data);
  }

  @Patch('senders/:id/toggle')
  async toggleSender(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.settingsService.toggleEmailSender(parseInt(id), isActive);
  }

  @Delete('senders/:id')
  async deleteSender(@Param('id') id: string) {
    return this.settingsService.deleteEmailSender(parseInt(id));
  }
}
