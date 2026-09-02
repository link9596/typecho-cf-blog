// src/worker.ts
import { WorkerMailer } from '@workermailer/smtp';
import {
  buildMailerOptions,
  buildEmailOptions,
} from './plugins/typecho-plugin-smtp-mailer';

// 导入 Astro 构建后的 _worker.js（由 Astro 生成，位于 dist 目录）
import * as AstroWorker from '../dist/_worker.js';

// 导出自定义的 fetch 函数（直接调用 Astro 的 fetch）
export async function fetch(request: Request, env: any, ctx: ExecutionContext) {
  // 将 env 暴露给全局，供插件内部使用
  (globalThis as any).__ENV = env;
  // 调用 Astro 生成的 fetch
  return await AstroWorker.fetch(request, env, ctx);
}

// 导出队列消费者
export async function queue(batch: MessageBatch<any>, env: any) {
  for (const message of batch.messages) {
    const mailData = message.body;
    try {
      await WorkerMailer.send(
        buildMailerOptions(mailData.smtp),
        buildEmailOptions(
          {
            to: mailData.to,
            toName: mailData.toName,
            subject: mailData.subject,
            html: mailData.html,
            text: mailData.text,
            replyTo: mailData.replyTo,
            headers: mailData.headers,
          },
          mailData.from,
          mailData.fromName
        )
      );
    } catch (err) {
      console.error('队列邮件发送失败:', err);
      // 不抛出异常，让队列自动重试
    }
  }
}
