# 小招喵 H5 - 部署指南

> 把这个文件夹拷到有 Git 的电脑后，按照下面流程上线。

## 一、上线前必备清单

| 项 | 说明 |
|---|---|
| Git | 命令行可用 `git --version` |
| GitHub 账号 | 已与 Vercel 关联 |
| Vercel 账号 | 已登录 |
| 域名 | `ofrcome.icu`（DNS 在阿里云） |
| Coze OAuth 应用密钥 | private_key.pem 等 6 个值 |

## 二、密钥准备（**不要提交到 git**）

把 `.env.example` 复制成 `.env.local`，填入真实值（仅本地调试用）。
私钥另存为 `private_key.pem`，**也不要提交**（`.gitignore` 已排除）。

## 三、推 GitHub（4 行命令）

```bash
cd 小招喵项目目录
git init -b main
git add .
git status                 # ⚠️ 确认列表里没有 .env / *.pem
git commit -m "init: 小招喵 H5 + Coze JWT 鉴权"

# 在 GitHub 先新建一个私有空仓库 xiaozhaomiao-demo
git remote add origin git@github.com:你的用户名/xiaozhaomiao-demo.git
git push -u origin main
```

## 四、Vercel 导入

1. https://vercel.com/new → 选 GitHub 仓库 `xiaozhaomiao-demo` → **Import**
2. **Framework Preset**: Other（无需 build）
3. **Root Directory**: `.`
4. **Build Command** / **Output Directory**: 留空
5. 先不要点 Deploy，**先去配环境变量**

## 五、Vercel 环境变量（关键）

进入项目 → **Settings → Environment Variables**，逐个添加，**三个环境（Production / Preview / Development）全勾**：

```
COZE_OAUTH_CLIENT_ID       = 1158563380145
COZE_OAUTH_PUBLIC_KEY_ID   = OKnKLHeKdkhh6hR5pwykdWtbnaD3tjdnIY6ScHLfjKY
COZE_OAUTH_PRIVATE_KEY     = （粘贴 private_key.pem 整个文件内容，多行直接粘贴）
COZE_BOT_ID                = 7640441427709165614
DEMO_ACCESS_TOKEN          = xzm-demo-2026
ALLOWED_ORIGIN             = https://ofrcome.icu,https://www.ofrcome.icu
```

**关于 `COZE_OAUTH_PRIVATE_KEY` 粘贴的两种方式**：

- **方式 A（推荐）**：直接多行粘贴 PEM 全文，Vercel 输入框支持多行
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvAIBADANBg...
  ...
  -----END PRIVATE KEY-----
  ```
- **方式 B（备用）**：单行带字面 `\n`，命令：
  ```bash
  awk 'NR==1{printf "%s",$0; next}{printf "\\n%s",$0} END{print ""}' \
    private_key.pem | pbcopy
  ```
  再去 Vercel 粘贴。

环境变量全配好后回到 Deployments → **Redeploy** 一次。

## 六、绑定 ofrcome.icu

### Vercel 侧
- 项目 **Settings → Domains → Add** → 输入 `ofrcome.icu`，再加一次 `www.ofrcome.icu`
- Vercel 会要求你在 DNS 里加记录

### 阿里云 DNS 侧

| 记录类型 | 主机记录 | 解析线路 | 记录值 | TTL |
|---|---|---|---|---|
| `A` | `@` | 默认 | `76.76.21.21` | 600 |
| `CNAME` | `www` | 默认 | `cname.vercel-dns.com` | 600 |

> 阿里云不支持根域 `@` 用 CNAME，所以根域用 A 记录指向 Vercel 的 IP `76.76.21.21`。

> 配好后等 1-5 分钟 SSL 证书自动签发。

## 七、验证（线上 curl 三连）

```bash
# 1. 页面可访问
curl -I https://ofrcome.icu

# 2. 鉴权生效（应返回 403）
curl -X POST https://ofrcome.icu/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"user_message":"你好"}'

# 3. 正确调用（应返回小招喵 reply，等待 30-55 秒）
curl -X POST https://ofrcome.icu/api/chat \
  -H 'Content-Type: application/json' \
  -H 'x-demo-token: xzm-demo-2026' \
  -H 'Origin: https://ofrcome.icu' \
  -d '{"user_message":"午饭30","user_id":"demo_user_001"}'
```

## 八、常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 403 Forbidden origin | Origin 未在 `ALLOWED_ORIGIN` | 加上对应域名 |
| 403 Invalid demo token | 前端 token 与后端不一致 | 检查 `app.js` 中 `DEMO_TOKEN` 是否等于环境变量 `DEMO_ACCESS_TOKEN` |
| Failed to exchange JWT | 私钥换行错 / kid 错 / 应用未授权 | 检查环境变量、kid、Coze 授权状态 |
| 兜底文案（"刚刚有点没听清"） | Coze 工作流超时（>55s） | 简化工作流节点、或换更快的模型 |

## 九、目录说明

```
xiaozhaomiao-deploy/
├── api/
│   └── chat.js              # Vercel Serverless Function（JWT 鉴权 + Coze 调用）
├── assets/
│   ├── stages/              # 小招喵四阶段透明 PNG
│   └── 小招喵.png
├── index.html               # H5 主页
├── app.js                   # 前端交互逻辑（包含 DEMO_TOKEN）
├── styles.css               # 招行红白风格
├── package.json             # 声明 Node 20+
├── vercel.json              # Vercel 配置（maxDuration 60s + 安全头）
├── .gitignore               # 排除 .env / *.pem
├── .env.example             # 环境变量模板（不含真实值）
└── README.md                # 本文件
```

## 十、安全清单

- [x] 私钥仅存 Vercel 环境变量，本地 `private_key.pem` 不提交
- [x] 前端无任何 Coze 密钥
- [x] Access Token 自动 24h 内复用 + 提前 2 分钟刷新
- [x] Origin / Referer 校验
- [x] 前端 demo token 二次校验
- [x] 单 IP 每分钟 20 次限流
- [x] 用户输入长度 ≤ 500
- [x] X-Content-Type-Options / X-Frame-Options 安全响应头
