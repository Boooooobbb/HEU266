/**
 * Supabase Edge Function: notification-dispatcher
 *
 * 用途：阶段一通知发送任务
 * - mode=pre_reveal: 每周三 11:30 给开启预提醒的参与用户发送提醒
 * - mode=match_result: 每周三 12:00 给开启结果提醒的用户发送结果通知
 *
 * 部署：supabase functions deploy notification-dispatcher
 * 调用：supabase functions invoke notification-dispatcher --body '{"mode":"pre_reveal"}' --no-verify-jwt
 * 定时：
 *   - 30分钟预提醒: 30 3 * * WED (UTC, 对应北京时间11:30)
 *   - 结果提醒:     0 4 * * WED (UTC, 对应北京时间12:00)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const aliyunAccessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID');
const aliyunAccessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET');
const aliyunDmAccountName = Deno.env.get('ALIYUN_DM_ACCOUNT_NAME');
const aliyunDmFromAlias = Deno.env.get('ALIYUN_DM_FROM_ALIAS') || '意配 O-Match';
const aliyunDmRegionId = Deno.env.get('ALIYUN_DM_REGION_ID') || 'cn-hangzhou';
const aliyunDmEndpoint = Deno.env.get('ALIYUN_DM_ENDPOINT') || 'https://dm.aliyuncs.com/';
// TODO(上线前): 在 Supabase Edge Function Secrets 中配置 APP_BASE_URL（例如 https://app.your-domain.com）。
// 未配置时默认回退到本地地址，仅用于开发联调。
const appBaseUrl = (Deno.env.get('APP_BASE_URL') || 'https://localhost:5173').replace(/\/$/, '');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

type DispatchMode = 'pre_reveal' | 'match_result';

interface TargetUser {
  user_id: string;
  email: string | null;
}

const fetchUserEmails = async (
  client: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<Map<string, string>> => {
  if (!userIds.length) {
    return new Map();
  }

  const { data, error } = await client
    .schema('auth')
    .from('users')
    .select('id, email')
    .in('id', userIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, string>();
  (data || []).forEach((row: any) => {
    if (row.id && row.email) {
      map.set(row.id, row.email);
    }
  });

  return map;
};

const getWeekTag = (date = new Date()): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const encodeRFC3986 = (value: string): string => {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const signHmacSha1 = async (content: string, key: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(content));
  return toBase64(signature);
};

const sendEmail = async (to: string, subject: string, html: string) => {
  if (!aliyunAccessKeyId || !aliyunAccessKeySecret || !aliyunDmAccountName) {
    return { success: false, reason: 'missing_aliyun_email_secrets' };
  }

  const baseParams: Record<string, string> = {
    Action: 'SingleSendMail',
    Version: '2015-11-23',
    RegionId: aliyunDmRegionId,
    Format: 'JSON',
    AccessKeyId: aliyunAccessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    AccountName: aliyunDmAccountName,
    ReplyToAddress: 'true',
    AddressType: '1',
    ToAddress: to,
    Subject: subject,
    HtmlBody: html,
    FromAlias: aliyunDmFromAlias,
  };

  const sortedKeys = Object.keys(baseParams).sort();
  const canonicalizedQuery = sortedKeys
    .map((key) => `${encodeRFC3986(key)}=${encodeRFC3986(baseParams[key])}`)
    .join('&');
  const stringToSign = `POST&${encodeRFC3986('/')}&${encodeRFC3986(canonicalizedQuery)}`;
  const signature = await signHmacSha1(stringToSign, `${aliyunAccessKeySecret}&`);

  const formParams = new URLSearchParams({
    ...baseParams,
    Signature: signature,
  });

  const response = await fetch(aliyunDmEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParams,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return { success: false, reason: bodyText || `http_${response.status}` };
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return { success: false, reason: bodyText || 'invalid_response' };
  }

  if (data.Code && data.Code !== 'OK') {
    return { success: false, reason: String(data.Message || data.Code) };
  }

  return {
    success: true,
    providerMessageId: typeof data.RequestId === 'string' ? data.RequestId : undefined,
  };
};

const buildPayload = (mode: DispatchMode) => {
  if (mode === 'pre_reveal') {
    // TODO(上线前): 确认文案与跳转路径是否与产品最终揭晓流程一致。
    return {
      kind: 'pre_reveal' as const,
      title: '匹配结果将在 30 分钟后揭晓',
      content: '你的灵魂盲盒即将开启，请准备查收本周匹配结果。',
      linkPath: '/waiting',
      emailSubject: '【意配】你的匹配结果将于 30 分钟后揭晓',
      emailHtml:
        `<p>你的灵魂盲盒即将开启，请在 30 分钟后回到意配查看匹配结果。</p><p><a href="${appBaseUrl}/waiting">前往查看</a></p>`,
    };
  }

  // TODO(上线前): 确认结果页入口路径（/chat-entry 或 /match-report）与最终业务一致。
  return {
    kind: 'match_result' as const,
    title: '本周匹配结果已生成',
    content: '你的本周匹配结果已更新，点击查看详细报告。',
    linkPath: '/chat-entry',
    emailSubject: '【意配】你的本周匹配结果已生成',
    emailHtml:
      `<p>你的本周匹配结果已生成，快来查看匹配报告与聊天入口。</p><p><a href="${appBaseUrl}/chat-entry">前往查看</a></p>`,
  };
};

const fetchTargets = async (client: ReturnType<typeof createClient>, mode: DispatchMode): Promise<TargetUser[]> => {
  const weekTag = getWeekTag();

  if (mode === 'pre_reveal') {
    const { data: poolRows, error: poolError } = await client
      .from('match_pool')
      .select('user_id')
      .eq('week_tag', weekTag);

    if (poolError) throw poolError;

    const userIds = Array.from(new Set((poolRows || []).map((row: any) => row.user_id).filter(Boolean)));
    if (!userIds.length) {
      return [];
    }

    const { data: preferenceRows, error: preferenceError } = await client
      .from('privacy_settings')
      .select('user_id, allow_messages')
      .in('user_id', userIds)
      .eq('allow_messages', true);

    if (preferenceError) throw preferenceError;

    const allowedUserIds = Array.from(
      new Set((preferenceRows || []).map((row: any) => row.user_id).filter(Boolean))
    );

    const emailMap = await fetchUserEmails(client, allowedUserIds);

    return allowedUserIds.map((userId) => ({
      user_id: userId,
      email: emailMap.get(userId) || null,
    }));
  }

  const { data, error } = await client
    .from('matches')
    .select('user_a_id, user_b_id')
    .eq('week_tag', weekTag)
    .in('status', ['matched', 'failed']);

  if (error) throw error;

  const userIds = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.user_a_id) userIds.add(row.user_a_id);
    if (row.user_b_id) userIds.add(row.user_b_id);
  });

  if (!userIds.size) {
    return [];
  }

  const ids = Array.from(userIds);

  const { data: preferenceRows, error: preferenceError } = await client
    .from('privacy_settings')
    .select('user_id, allow_match')
    .in('user_id', ids)
    .eq('allow_match', true);

  if (preferenceError) throw preferenceError;

  const allowedUserIds = Array.from(
    new Set((preferenceRows || []).map((row: any) => row.user_id).filter(Boolean))
  );

  const emailMap = await fetchUserEmails(client, allowedUserIds);

  return allowedUserIds.map((userId) => ({
    user_id: userId,
    email: emailMap.get(userId) || null,
  }));
};

const insertInAppNotification = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  payload: ReturnType<typeof buildPayload>,
  idempotencyKey: string
) => {
  const { data, error } = await client
    .from('notifications')
    .insert({
      user_id: userId,
      kind: payload.kind,
      channel: 'in_app',
      title: payload.title,
      content: payload.content,
      link_path: payload.linkPath,
      scheduled_for: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await client.from('notification_deliveries').insert({
    notification_id: data.id,
    user_id: userId,
    channel: 'in_app',
    status: 'sent',
    provider: 'supabase',
  });

  return { success: true };
};

const insertEmailNotification = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  payload: ReturnType<typeof buildPayload>,
  idempotencyKey: string
) => {
  const { data, error } = await client
    .from('notifications')
    .insert({
      user_id: userId,
      kind: payload.kind,
      channel: 'email',
      title: payload.title,
      content: payload.content,
      link_path: payload.linkPath,
      scheduled_for: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const sent = await sendEmail(email, payload.emailSubject, payload.emailHtml);

  if (!sent.success) {
    await client.from('notification_deliveries').insert({
      notification_id: data.id,
      user_id: userId,
      channel: 'email',
      status: 'failed',
      provider: 'aliyun-directmail',
      error_message: sent.reason || 'unknown_error',
    });

    return { success: false, error: sent.reason || 'email_send_failed' };
  }

  await client
    .from('notifications')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', data.id);

  await client.from('notification_deliveries').insert({
    notification_id: data.id,
    user_id: userId,
    channel: 'email',
    status: 'sent',
    provider: 'aliyun-directmail',
    provider_message_id: sent.providerMessageId || null,
  });

  return { success: true };
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = (await req.json().catch(() => ({}))) as { mode?: DispatchMode };
    const mode = body.mode || 'pre_reveal';

    if (mode !== 'pre_reveal' && mode !== 'match_result') {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = buildPayload(mode);
    const targets = await fetchTargets(client, mode);

    let inAppSent = 0;
    let emailSent = 0;
    const failures: Array<{ user_id: string; channel: string; reason: string }> = [];

    for (const target of targets) {
      const baseKey = `${mode}:${getWeekTag()}:${target.user_id}`;

      const inAppResult = await insertInAppNotification(client, target.user_id, payload, `${baseKey}:in_app`);
      if (inAppResult.success) {
        inAppSent += 1;
      } else {
        failures.push({ user_id: target.user_id, channel: 'in_app', reason: inAppResult.error || 'insert_failed' });
      }

      if (target.email) {
        const emailResult = await insertEmailNotification(client, target.user_id, target.email, payload, `${baseKey}:email`);
        if (emailResult.success) {
          emailSent += 1;
        } else {
          failures.push({ user_id: target.user_id, channel: 'email', reason: emailResult.error || 'send_failed' });
        }
      }
    }

    return new Response(
      JSON.stringify({
        mode,
        targetCount: targets.length,
        inAppSent,
        emailSent,
        failures,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
