// 小招喵 H5 Demo —— Vercel Serverless Function
// 路径: /api/chat
//
// 核心安全设计：
//   1. JWT 私钥仅存 Vercel 环境变量，永不下发前端
//   2. 后端用私钥 RS256 签 JWT → 换 Coze 短期 access_token（默认 15 分钟）
//   3. 内存缓存 access_token 复用，减少签发开销
//   4. Origin / Referer 校验 + 前端 demo token 二次校验
//   5. 单实例内简单 IP 限流（防止单 IP 高频刷量）
//
// 必需环境变量（在 Vercel Dashboard → Settings → Environment Variables 配置）：
//   COZE_OAUTH_CLIENT_ID       OAuth 应用 ID（数字字符串）
//   COZE_OAUTH_PUBLIC_KEY_ID   公钥指纹 kid
//   COZE_OAUTH_PRIVATE_KEY     RS256 私钥 PEM（含 -----BEGIN/END----- 行，换行用 \n）
//   COZE_BOT_ID                你的智能体 ID
//   DEMO_ACCESS_TOKEN          前端调本站 API 的简易门票（自己起一串随机字符串）
//   ALLOWED_ORIGIN             允许的来源域名，如 https://ofrcome.icu（多个用逗号分隔）

const crypto = require('crypto');
const https = require('https');

// ============ 配置 ============
const CLIENT_ID = process.env.COZE_OAUTH_CLIENT_ID;
const PUBLIC_KEY_ID = process.env.COZE_OAUTH_PUBLIC_KEY_ID;
const PRIVATE_KEY = (process.env.COZE_OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const BOT_ID = process.env.COZE_BOT_ID;
const DEMO_TOKEN = process.env.DEMO_ACCESS_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ============ Token 缓存（单实例内复用） ============
let cachedAccessToken = null;
let cachedExpireAt = 0;

// ============ 简易 IP 限流（单实例内存计数） ============
const rateLimitStore = new Map(); // ip → { count, resetAt }
const RATE_LIMIT_MAX = 20;        // 每个 IP 每分钟最多 20 次
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = rateLimitStore.get(ip);
  if (!rec || rec.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) return false;
  rec.count++;
  return true;
}

// ============ JWT 签发 ============
function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT() {
  const header = { alg: 'RS256', typ: 'JWT', kid: PUBLIC_KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: CLIENT_ID,
    aud: 'api.coze.cn',
    iat: now,
    exp: now + 600,                  // JWT 自身 10 分钟有效
    jti: crypto.randomBytes(16).toString('hex')
  };
  const encHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(PRIVATE_KEY));
  return `${signingInput}.${signature}`;
}

// ============ HTTPS 请求封装 ============
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk.toString(); });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { resolve({ raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============ 获取 / 复用 Coze Access Token ============
async function getAccessToken() {
  const now = Date.now();
  // 缓存提前 2 分钟过期，避免边界情况
  if (cachedAccessToken && cachedExpireAt - 120 * 1000 > now) {
    return cachedAccessToken;
  }

  const jwtToken = signJWT();
  const body = JSON.stringify({
    duration_seconds: 86399, // 24 小时（接近 Coze 上限）
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
  });

  const resp = await httpsRequest({
    hostname: 'api.coze.cn',
    port: 443,
    path: '/api/permission/oauth2/token',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (!resp.access_token) {
    console.error('JWT exchange failed:', JSON.stringify(resp));
    throw new Error('Failed to exchange JWT for access_token');
  }
  cachedAccessToken = resp.access_token;
  cachedExpireAt = (resp.expires_in || (now / 1000 + 3600)) * 1000;
  return cachedAccessToken;
}

// ============ 调 Coze v3/chat（非流式 + 轮询） ============
async function callCoze(userMessage, userId) {
  const accessToken = await getAccessToken();

  // 1. 发起对话
  const chatBody = JSON.stringify({
    bot_id: BOT_ID,
    user_id: userId || 'demo_user',
    stream: false,
    auto_save_history: true,
    additional_messages: [{
      role: 'user',
      content: userMessage,
      content_type: 'text'
    }]
  });

  const chatResp = await httpsRequest({
    hostname: 'api.coze.cn',
    port: 443,
    path: '/v3/chat',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(chatBody)
    }
  }, chatBody);

  if (chatResp.code !== 0 || !chatResp.data) {
    console.error('Chat initiate failed:', JSON.stringify(chatResp));
    return { reply: '刚刚有点没听清喵，你可以再说一遍吗喵' };
  }

  const chatId = chatResp.data.id;
  const conversationId = chatResp.data.conversation_id;

  // 2. 轮询状态（最多 40 次 × 2.5s ≈ 100s，留余量给 Vercel 默认 60s 函数超时）
  let status = 'in_progress';
  let attempts = 0;
  while (status === 'in_progress' && attempts < 22) {
    await sleep(2500);
    attempts++;
    const statusResp = await httpsRequest({
      hostname: 'api.coze.cn',
      port: 443,
      path: `/v3/chat/retrieve?conversation_id=${conversationId}&chat_id=${chatId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (statusResp.code === 0 && statusResp.data) status = statusResp.data.status;
  }

  if (status !== 'completed') {
    return { reply: '小招喵想了好久没想出来喵，再试一次吧喵' };
  }

  // 3. 获取消息列表
  const msgResp = await httpsRequest({
    hostname: 'api.coze.cn',
    port: 443,
    path: `/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (msgResp.code !== 0 || !msgResp.data) {
    return { reply: '刚刚有点没听清喵，你可以再说一遍吗喵' };
  }

  // 优先从 tool_response 提取工作流原始结构化结果
  const toolResponses = msgResp.data.filter(m => m.role === 'assistant' && m.type === 'tool_response');
  for (const tr of toolResponses.reverse()) {
    if (!tr.content) continue;
    try {
      const wrapper = JSON.parse(tr.content);
      if (wrapper && wrapper.output) {
        const inner = typeof wrapper.output === 'string' ? wrapper.output : JSON.stringify(wrapper.output);
        try {
          const structured = JSON.parse(inner);
          if (structured && (structured.reply || structured.cards || structured.state_update)) {
            return structured;
          }
        } catch (e) { /* 跳过 */ }
      }
    } catch (e) { /* 跳过 */ }
  }

  // 回退：取 type=answer
  const answerMsg = msgResp.data.find(m => m.role === 'assistant' && m.type === 'answer');
  if (!answerMsg || !answerMsg.content) {
    return { reply: '刚刚有点没听清喵，你可以再说一遍吗喵' };
  }
  try { return JSON.parse(answerMsg.content); }
  catch (e) { return { reply: answerMsg.content }; }
}

// ============ Vercel Handler ============
module.exports = async (req, res) => {
  // 只允许 POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Origin / Referer 校验
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const matched = ALLOWED_ORIGINS.some(allowed =>
      origin.startsWith(allowed) || referer.startsWith(allowed)
    );
    if (!matched) {
      res.status(403).json({ error: 'Forbidden origin' });
      return;
    }
  }

  // 前端简易门票校验
  if (DEMO_TOKEN) {
    const clientToken = req.headers['x-demo-token'];
    if (clientToken !== DEMO_TOKEN) {
      res.status(403).json({ error: 'Invalid demo token' });
      return;
    }
  }

  // 限流
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests', reply: '小招喵有点忙不过来喵，歇一会儿再问问喵' });
    return;
  }

  // 解析 body（Vercel 会自动 parse JSON body）
  const { user_message, user_id } = req.body || {};
  if (!user_message || typeof user_message !== 'string') {
    res.status(400).json({ error: 'Missing user_message' });
    return;
  }

  // 输入长度保护
  if (user_message.length > 500) {
    res.status(400).json({ error: 'Message too long' });
    return;
  }

  try {
    console.log(`[chat] ip=${ip} msg=${user_message.slice(0, 40)}`);
    const result = await callCoze(user_message, user_id);
    res.status(200).json(result);
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ reply: '刚刚有点没听清喵，你可以再说一遍吗喵' });
  }
};
