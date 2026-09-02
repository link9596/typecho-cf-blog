/**
 * typecho-plugin-smtp-mailer
 *
 * SMTP 邮件发送适配器（基于 `@workermailer/smtp`，Cloudflare TCP Sockets）。
 *
 * 职责：
 *  - 实现 `mail:send` filter hook：将发送任务入队到 Cloudflare Queues，
 *    由后台队列消费者真正投递，避免请求超时；
 *  - `plugin:config:beforeSave`：保存前校验并规范化 SMTP 配置；
 *  - 插件专属设置页（/admin/plugin/smtp-mailer）：展示当前配置摘要，
 *    并支持一键发送测试邮件（也入队）。
 *
 * 说明：
 *  - 发件人使用站点级选项 `mailFrom` / `mailFromName`；
 *  - Cloudflare Workers 不允许 25 端口出站，端口需为 465（SSL/TLS）或 587（STARTTLS）；
 *  - `@workermailer/smtp` 需要 `nodejs_compat` compatibility flag（项目已配置）。
 */
import { parsePluginOption, escapeAttr, hasPermission } from 'typecho/plugin-sdk';
import type { PluginInitContext } from 'typecho/plugin-sdk';
import { WorkerMailer } from '@workermailer/smtp';
import type { WorkerMailerOptions, EmailOptions } from '@workermailer/smtp';
import { isValidEmail } from '@/lib/mail';
import type { MailPayload, MailContext, MailResult } from '@/lib/mail';

export const PLUGIN_ID = 'typecho-plugin-smtp-mailer';
export const PROVIDER = 'smtp-mailer';
export const ADMIN_SLUG = 'smtp-mailer';

const AUTH_TYPES = ['plain', 'login', 'cram-md5'] as const;
type AuthType = (typeof AUTH_TYPES)[number];

export interface SmtpMailerConfig {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  username: string;
  password: string;
  authType: AuthType;
  socketTimeoutMs?: number;
  responseTimeoutMs?: number;
}

const DEFAULT_CONFIG: SmtpMailerConfig = {
  host: '',
  port: 465,
  secure: true,
  startTls: false,
  username: '',
  password: '',
  authType: 'plain',
  socketTimeoutMs: 30000,
  responseTimeoutMs: 30000,
};

function toInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === '1' || value === 1 || value === true) return true;
  if (value === '0' || value === 0 || value === false) return false;
  return fallback;
}

/** 从插件配置原始值（options 中的 JSON 或对象）归一化为强类型配置。 */
export function normalizeConfig(raw: Record<string, unknown> | undefined): SmtpMailerConfig {
  const r = raw || {};
  const authType = String(r.authType ?? '');
  return {
    host: String(r.host ?? '').trim(),
    port: toInt(r.port, DEFAULT_CONFIG.port),
    secure: toBool(r.secure, DEFAULT_CONFIG.secure),
    startTls: toBool(r.startTls, DEFAULT_CONFIG.startTls),
    username: String(r.username ?? ''),
    password: String(r.password ?? ''),
    authType: (AUTH_TYPES as readonly string[]).includes(authType) ? (authType as AuthType) : DEFAULT_CONFIG.authType,
    socketTimeoutMs: toInt(r.socketTimeoutMs, DEFAULT_CONFIG.socketTimeoutMs ?? 0),
    responseTimeoutMs: toInt(r.responseTimeoutMs, DEFAULT_CONFIG.responseTimeoutMs ?? 0),
  };
}

function readConfig(options?: Record<string, unknown>): SmtpMailerConfig {
  return normalizeConfig(parsePluginOption(options?.[`plugin:${PLUGIN_ID}`]));
}

/** 组装 @workermailer/smtp 的连接参数（WorkerMailerOptions）。 */
export function buildMailerOptions(config: SmtpMailerConfig): WorkerMailerOptions {
  const opts: WorkerMailerOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    startTls: config.startTls,
    authType: config.authType,
  };
  if (config.username) {
    opts.credentials = { username: config.username, password: config.password };
  }
  if (config.socketTimeoutMs && config.socketTimeoutMs > 0) opts.socketTimeoutMs = config.socketTimeoutMs;
  if (config.responseTimeoutMs && config.responseTimeoutMs > 0) opts.responseTimeoutMs = config.responseTimeoutMs;
  return opts;
}

/** 把核心 MailPayload 映射为 @workermailer/smtp 的 EmailOptions。 */
export function buildEmailOptions(payload: MailPayload, from: string, fromName: string): EmailOptions {
  const opts: EmailOptions = {
    from: fromName ? { name: fromName, email: from } : from,
    to: payload.toName ? { name: payload.toName, email: payload.to } : payload.to,
    subject: payload.subject,
  };
  if (payload.html) opts.html = payload.html;
  if (payload.text) opts.text = payload.text;
  if (payload.replyTo) opts.reply = payload.replyTo;
  if (payload.headers && Object.keys(payload.headers).length > 0) opts.headers = payload.headers;
  return opts;
}

function escapeHtml(value: unknown): string {
  return escapeAttr(String(value ?? ''));
}

export default function init({ addHook, pluginId }: PluginInitContext): void {
  // ── mail:send 适配器：改为入队，让后台消费者真正发送 ──
  addHook('mail:send', pluginId, async (
    _result: MailResult | null,
    extra?: { payload?: MailPayload; ctx?: MailContext },
  ): Promise<MailResult> => {
    console.log('[SMTP-DEBUG] mail:send triggered (queued)', {
      hasPayload: !!extra?.payload,
      to: extra?.payload?.to,
      subject: extra?.payload?.subject,
    });

    const payload = extra?.payload;
    const ctx = extra?.ctx;
    const config = readConfig(ctx?.options);

    if (!config.host) {
      return { sent: false, provider: PROVIDER, error: 'not-configured' };
    }
    if (!payload || !payload.to || !payload.subject) {
      return { sent: false, provider: PROVIDER, error: 'invalid-payload' };
    }

    const from = String(ctx?.options?.mailFrom ?? '');
    const fromName = String(ctx?.options?.mailFromName ?? '');

    // 获取全局 env（由 src/index.ts 注入）
    const env = (globalThis as any).__ENV;
    if (!env || !env.EMAIL_QUEUE) {
      return { sent: false, provider: PROVIDER, error: 'queue-unavailable' };
    }

    // 构造队列消息（包含所有邮件数据 + SMTP 配置）
    const mailData = {
      to: payload.to,
      toName: payload.toName,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
      headers: payload.headers,
      from,
      fromName,
      smtp: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        startTls: config.startTls,
        username: config.username,
        password: config.password,
        authType: config.authType,
        socketTimeoutMs: config.socketTimeoutMs,
        responseTimeoutMs: config.responseTimeoutMs,
      },
    };

    try {
      await env.EMAIL_QUEUE.send(mailData);
      return { sent: true, provider: 'queue' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${PLUGIN_ID}] queue send failed:`, err);
      return { sent: false, provider: PROVIDER, error: message };
    }
  });

  // ── 配置保存前校验（保持不变） ──
  addHook('plugin:config:beforeSave', pluginId, (
    result: unknown,
    extra?: { pluginId?: string; settings?: Record<string, unknown> },
  ) => {
    if (!extra || extra.pluginId !== PLUGIN_ID) return result;

    const s = extra.settings || {};
    const host = String(s.host ?? '').trim();
    if (!host) return { success: false, error: '请填写 SMTP 服务器地址（host）' };

    const port = toInt(s.port, 0);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { success: false, error: '端口必须是 1-65535 的整数' };
    }

    const authType = String(s.authType ?? 'plain');
    if (!(AUTH_TYPES as readonly string[]).includes(authType)) {
      return { success: false, error: '不支持的认证方式（仅支持 plain / login / cram-md5）' };
    }

    const socketTimeoutMs = toInt(s.socketTimeoutMs, 0);
    const responseTimeoutMs = toInt(s.responseTimeoutMs, 0);
    if (socketTimeoutMs < 0 || responseTimeoutMs < 0) {
      return { success: false, error: '超时时间不能为负数' };
    }

    return {
      success: true,
      settings: {
        ...s,
        host,
        port: String(port),
        secure: toBool(s.secure, true) ? '1' : '0',
        startTls: toBool(s.startTls, false) ? '1' : '0',
        authType,
        socketTimeoutMs: socketTimeoutMs > 0 ? String(socketTimeoutMs) : '',
        responseTimeoutMs: responseTimeoutMs > 0 ? String(responseTimeoutMs) : '',
      },
    };
  });

  // ── 插件专属设置页：配置摘要 + 测试发送（保持不变） ──
  addHook('admin:page', pluginId, (
    html: string,
    extra?: { slug?: string; csrfToken?: string; options?: Record<string, unknown> },
  ) => {
    if (extra?.slug !== ADMIN_SLUG) return html;
    return renderAdminPage(extra.csrfToken || '', extra.options);
  });

  // ── 后台导航注入（保持不变） ──
  addHook('admin:footer', pluginId, (
    html: string,
    extra?: { activeMenu?: string; user?: { group?: string } },
  ) => {
    if (extra?.user?.group && !hasPermission(extra.user.group, 'administrator')) return html;
    const isActive = extra?.activeMenu === ADMIN_SLUG;
    const extraHtml = `<script>
(function(){
  var mgmt = document.querySelector('#typecho-nav-list ul.root:nth-child(3) ul.child');
  if (mgmt && !document.getElementById('nav-smtp-mailer')) {
    var li = document.createElement('li');
    li.id = 'nav-smtp-mailer';
    li.className = '${isActive ? 'focus' : ''}';
    li.innerHTML = '<a href="/admin/plugin/smtp-mailer">SMTP Mailer</a>';
    mgmt.appendChild(li);
  }
})();
</script>`;
    return html + extraHtml;
  });

  // ── 动作鉴权：test-send 仅管理员 ──
  addHook(`plugin:${PLUGIN_ID}:action:auth`, pluginId, (_role: string) => 'administrator');

  // ── 动作：发送测试邮件（改为入队） ──
  addHook(`plugin:${PLUGIN_ID}:action`, pluginId, async (
    result: unknown,
    extra?: {
      action?: string;
      payload?: Record<string, unknown>;
      options?: Record<string, unknown>;
      request?: Request;
    },
  ) => {
    if (extra?.action !== 'test-send') return result;

    const to = String(extra.payload?.to ?? '').trim();
    if (!isValidEmail(to)) {
      return { handled: true, success: false, error: '收件邮箱格式不正确' };
    }

    const options = extra.options || {};
    const config = readConfig(options);
    if (!config.host) {
      return { handled: true, success: false, error: 'SMTP 未配置' };
    }

    const env = (globalThis as any).__ENV;
    if (!env || !env.EMAIL_QUEUE) {
      return { handled: true, success: false, error: '队列不可用' };
    }

    const from = String(options?.mailFrom ?? '');
    const fromName = String(options?.mailFromName ?? '');
    const timestamp = new Date().toISOString();
    const subject = `[${String(options.title ?? 'Typecho')}] SMTP 测试邮件`;
    const html = `<p>这是一封来自 Cloudflare-Typecho 的测试邮件。</p><p>发送时间：${timestamp}</p><p>如果你收到了这封邮件，说明 SMTP 配置正确。</p>`;
    const text = `这是一封来自 Cloudflare-Typecho 的测试邮件。\n发送时间：${timestamp}\n如果你收到了这封邮件，说明 SMTP 配置正确。`;

    const mailData = {
      to,
      subject,
      html,
      text,
      from,
      fromName,
      smtp: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        startTls: config.startTls,
        username: config.username,
        password: config.password,
        authType: config.authType,
        socketTimeoutMs: config.socketTimeoutMs,
        responseTimeoutMs: config.responseTimeoutMs,
      },
    };

    try {
      await env.EMAIL_QUEUE.send(mailData);
      return { handled: true, success: true, sent: true, provider: 'queue' };
    } catch (err) {
      return { handled: true, success: false, error: String(err) };
    }
  });
}

function renderAdminPage(csrfToken: string, options?: Record<string, unknown>): string {
  const config = readConfig(options);
  const summary: Array<[string, string]> = [
    ['SMTP 服务器', config.host || '（未配置）'],
    ['端口', String(config.port)],
    ['SSL/TLS 加密', config.secure ? '是' : '否'],
    ['STARTTLS 升级', config.startTls ? '是' : '否'],
    ['认证方式', config.authType],
    ['用户名', config.username || '（未设置，匿名）'],
    ['密码 / 授权码', config.password ? '已设置' : '（未设置）'],
  ];
  const rows = summary
    .map(([k, v]) => `<tr><th style="width:180px;text-align:left;padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(k)}</th><td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`)
    .join('');

  return `<div class="col-mb-12" style="max-width:760px">
  <h2 style="margin-bottom:.5em">SMTP Mailer 设置</h2>
  <p style="color:#999;font-size:.92857em">基于 <code>@workermailer/smtp</code> 的 SMTP 邮件适配器。启用后，<a href="/admin/options-general">常规设置</a> 中的「启用邮件发送」与 <a href="/admin/options-discussion">评论设置</a> 中的「有新评论时发送邮件通知」才会真正投递评论提醒邮件（含评论回复提醒与密码重置邮件）。</p>

  <h3 style="margin:1.2em 0 .5em">当前配置</h3>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
  <p style="color:#999;font-size:.92857em;margin-top:.6em">修改配置请前往 <a href="/admin/plugin-config?id=${escapeHtml(PLUGIN_ID)}">插件设置</a>。</p>

  <h3 style="margin:1.2em 0 .5em">发送测试邮件</h3>
  <div style="padding:14px;background:#f7f7f7;border:1px solid #eee;border-radius:4px">
    <p><label for="smtp-test-to" style="display:block;margin-bottom:6px">收件邮箱</label>
    <input type="email" id="smtp-test-to" class="text" style="width:100%;box-sizing:border-box" placeholder="you@example.com" /></p>
    <p><button type="button" id="smtp-test-send" class="btn btn-s primary">发送测试邮件</button>
    <span id="smtp-test-result" style="margin-left:.8em;font-size:.92857em"></span></p>
  </div>
</div>
<script>
(function(){
  var btn = document.getElementById('smtp-test-send');
  var input = document.getElementById('smtp-test-to');
  var result = document.getElementById('smtp-test-result');
  if (!btn) return;
  btn.addEventListener('click', async function(){
    var to = (input.value || '').trim();
    if (!to) { result.textContent = '请先填写收件邮箱'; result.style.color = '#d00'; return; }
    btn.disabled = true;
    result.textContent = '发送中…'; result.style.color = '#999';
    try {
      var resp = await fetch('/api/admin/plugin-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': '${escapeHtml(csrfToken)}'
        },
        body: JSON.stringify({ plugin: '${escapeHtml(PLUGIN_ID)}', action: 'test-send', payload: { to: to } })
      });
      var data = await resp.json().catch(function(){ return {}; });
      if (resp.ok && data.success) {
        result.textContent = '发送成功（' + (data.provider || '') + '）';
        result.style.color = '#080';
      } else {
        result.textContent = '发送失败：' + (data.error || resp.status);
        result.style.color = '#d00';
      }
    } catch (e) {
      result.textContent = '请求出错：' + String(e);
      result.style.color = '#d00';
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>`;
}
