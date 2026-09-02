// src/index.ts
import { onRequest } from './middleware';          // 原有的 Astro 中间件
import { WorkerMailer } from '@workermailer/smtp';
// 导入插件中的工具函数（路径根据实际情况调整）
import { buildMailerOptions, buildEmailOptions } from './plugins/typecho-plugin-smtp-mailer';

export default {
  // 请求处理：直接调用原有中间件
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    // 把 env 挂到全局，让插件内部能访问到队列
    (globalThis as any).__ENV = env;
    // 原有中间件需要三个参数（request, env, ctx）
    return await onRequest(request, env, ctx);
  },

  // 队列消费者：处理邮件发送
  async queue(batch: MessageBatch<any>, env: any) {
    for (const message of batch.messages) {
      const mailData = message.body; // 包含收件人、主题、内容 + SMTP 配置
      try {
        // 直接调用 WorkerMailer.send
        await WorkerMailer.send(
          buildMailerOptions(mailData.smtp),   // 从消息中取出 SMTP 配置
          buildEmailOptions(
            {
              to: mailData.to,
              subject: mailData.subject,
              html: mailData.html,
              text: mailData.text,
              replyTo: mailData.replyTo,
              headers: mailData.headers,
              toName: mailData.toName,
            },
            mailData.from,
            mailData.fromName
          )
        );
      } catch (err) {
        console.error('队列邮件发送失败:', err);
        // 不抛异常，让队列自动重试（由 max_retries 控制）
      }
    }
  }
};
