# Visora

一个自托管的通用访问统计平台。基于 shadcn-admin 的 React 管理界面，将 new-api、grok-iq 及其他系统的访问数据汇聚到同一个工作空间。

## 通用化方案

```text
React / Vue / 静态站 ── tracker.js ──→ 浏览器采集接口（站点 ID + 来源白名单）
Go / Python / Node  ── JSON HTTP ──→ 服务端采集接口（项目独立密钥）
                                              ↓
                          Visora 统一事件模型 → Sequelize ORM → 聚合看板
                                            ↓
                              SQLite / PostgreSQL / MySQL
```

每个系统只负责发送统一的事件，无需再实现统计数据库、聚合逻辑、图表和管理页面。项目有独立站点 ID、来源白名单和密钥，可以单独暂停或恢复。看板支持全部项目与单项目筛选。

已实现：管理登录、项目创建/编辑、密钥轮换、网页 SPA 自动采集、批量服务端采集、幂等去重、PV/UV/会话、最近 5 分钟活跃访客、按天趋势、页面/来源/设备/浏览器/系统/语言排行、自定义事件、访问明细分页、CSV 导出和自动清理。

后端使用 Node.js 24 + Fastify + Sequelize ORM，按业务模块划分 routes / services / repositories。默认 SQLite WAL，适合个人项目、单实例部署与中小流量；可通过配置选择 PostgreSQL 或 MySQL。前端使用 React、TypeScript、TanStack Query/Router、shadcn/ui、Recharts。默认部署无需外部数据库、Redis 或 SaaS。未实现组织多租户、跨站身份拼接、地理定位或任意旧数据库自动同步。

目录职责、数据模型、迁移策略和扩展方式见 [后端架构说明](server/README.md)。

## 本地运行

需要 Node.js **24+**、Corepack / pnpm。

```sh
corepack enable
pnpm install
cp .env.example .env
# 编辑 .env，设置 VISORA_ADMIN_PASSWORD 为至少 12 位的独立密码
pnpm dev
```

打开 `http://127.0.0.1:5173`，使用配置的管理密码登录。开发时 Vite 将 `/api` 和 `/tracker.js` 代理至 `127.0.0.1:3001`。默认 SQLite 数据库自动创建于 `data/visora.sqlite`，初始没有示例项目或虚构流量。

生产构建与启动：

```sh
pnpm build
pnpm start
```

打开 `http://127.0.0.1:3001`，同一服务同时提供前端、API、采集脚本。**整个平台应部署在域名根路径**，例如 `https://visora.example.com`。设置 HTTPS 反向代理后，将 `VISORA_SECURE_COOKIE=true`；仅在直接入口受限制且代理可信时设置 `VISORA_TRUST_PROXY=true`，并让代理传递原始 Host、X-Forwarded-Proto 和 X-Forwarded-For。

后端无法启动时不会启用无鉴权模式；未配置密码或密码少于 12 位会直接报错。修改管理密码并重启后，之前的所有管理会话失效。会话有效期 7 天。

## 数据库选择与迁移

默认配置使用 SQLite。若后续需要远程数据库，先准备 **Visora 专用库及账号**，然后在 `.env` 中设置以下其中一种连接（仅为占位示例）：

```dotenv
VISORA_DATABASE_URL=postgres://visora:CHANGE_ME@visora-db:5432/visora
# 或 VISORA_DATABASE_URL=mysql://visora:CHANGE_ME@visora-db:3306/visora
VISORA_AUTO_MIGRATE=false
# 远程服务要求 TLS 时启用，并按需指定 CA
# VISORA_DB_SSL=true
# VISORA_DB_CA_FILE=/path/to/ca.pem
```

URL 非空时优先于 `VISORA_DATABASE` 文件路径。远程数据库默认不自动建表，需要在启动应用前由单个进程执行 `pnpm db:migrate`。该命令使用同一套连接配置，不需要管理密码，也不会启动 HTTP 或清理任务。数据库和账号需提前创建，迁移只管理 Visora 的表、索引与版本。

SQLite 默认在启动时自动迁移；可以同样设置 `VISORA_AUTO_MIGRATE=false`，改用显式迁移。已有业务表不使用自动 `sync alter/force` 修改。迁移为向前执行，升级前需备份；MySQL DDL 会隐式提交，迁移按可重入方式处理。多实例只允许一个迁移任务，应用副本仅检查版本。

切换连接配置不会自动搬迁 SQLite 数据。迁移已有记录时需保留项目映射和 `settings.identity_salt`，否则访客身份无法连续。运行中的数据库与其他应用应独立，接入 new-api / grok-iq 通过事件 API 完成，不需要 Visora 访问其业务数据库。

本轮按要求未运行 ORM 改造后的验证或迁移，没有连接本机现有 PostgreSQL/MySQL；数据库兼容性待后续独立环境验证。

## Docker

设置好根目录 `.env` 后：

```sh
docker compose up -d --build
```

默认只映射本机 `127.0.0.1:3001`，SQLite 数据库放在持久化卷 `visora-data`。对外提供服务时由反向代理发布 HTTPS。备份时停止实例再备份整个数据卷（包括 WAL），或使用 SQLite 在线备份功能；不要只拷贝正在写入的 `.sqlite` 主文件。恢复时保留 `settings` 表中的身份盐，否则访客统计无法连续。

使用远程数据库时，连接地址必须能从容器内访问，按配置先单独迁移再启动：

```sh
docker compose build
docker compose run --rm visora node server/src/cli/migrate.mjs
docker compose up -d
```

Compose 会传入 `.env` 中的数据库、TLS、迁移和限流配置。自定义 CA 文件需要额外只读挂载到 `VISORA_DB_CA_FILE` 指定的容器路径。PostgreSQL/MySQL 的备份使用各自数据库工具，并包含 Visora 的 settings 表。

## 接入网页

1. 在「项目管理」创建项目，例如 `new-api`。
2. 添加精确来源，例如 `https://api.example.com`、`http://localhost:5173`。协议、域名、端口必须一致；不支持通配符。
3. 将项目的接入代码放入目标网站 `<head>`，Visora 地址应能被访客浏览器访问。

```html
<script defer src="https://visora.example.com/tracker.js" data-site="v_项目站点ID"></script>
```

脚本自动统计初次加载和 SPA `pushState` / `replaceState` / `popstate`，相同路径的重复通知不增加 PV。查询参数变化不计新页面。Hash 路由可添加 `data-hash="true"`，仅将 `#/path` 识别为路由。手动采集可添加 `data-auto="false"` 再调用 `window.visora?.pageview()`。

```js
window.visora?.track('signup_completed')
window.visora?.track('file_downloaded')
// 需要在采集前征得同意的网站，应在用户同意后才加载脚本。
if (window.visora) window.visora.disabled = true
```

需要 CSP 的网站，允许 Visora 域名的 `script-src` 和 `connect-src`。公开站点 ID 可以放在网页中，**服务端密钥只能存放在后端**。来源白名单限制正常浏览器请求，但无法阻止伪造 Origin 的非浏览器流量；可信业务指标应使用服务端接口。

## 服务端事件协议

`POST /api/ingest`，请求头 `Authorization: Bearer vs_...` 与 `Content-Type: application/json`。每个密钥绑定一个项目，一次 1–100 条，正文最多 256 KiB。

```json
{
  "events": [
    {
      "eventId": "new-api-visit-12345",
      "visitorId": "analytics-visitor-42",
      "sessionId": "analytics-session-123",
      "type": "pageview",
      "path": "/dashboard",
      "referrer": "https://search.example.com",
      "language": "zh-CN",
      "occurredAt": "2026-10-12T08:00:00Z"
    }
  ]
}
```

| 字段         | 含义                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `eventId`    | 项目内唯一事件 ID；重试及重新导入时必须保持不变                           |
| `visitorId`  | 匿名统计标识，与认证 token 无关                                           |
| `sessionId`  | 统计会话标识，服务端负责划分会话                                          |
| `type`       | `pageview`（默认）或 `event`                                              |
| `path`       | 以 `/` 开头的站内路径；服务端丢弃 query 与 fragment                       |
| `name`       | 自定义事件必填，1–80 字符                                                 |
| `referrer`   | 可选；只保存 HTTP(S) 来源主机名                                           |
| `language`   | 可选，最长 32 字符                                                        |
| `occurredAt` | 可选 ISO 8601 时间，默认接收时间；只接受保留期内且不超过未来 5 分钟的事件 |
| `userAgent`  | 服务端接入可选，仅保存解析出的浏览器/系统/设备，不保留原文                |

三个标识字段长度 1–128，可用字符为 `a-z A-Z 0-9 _ . : @ -`。不要在这些字段放邮箱、密码、认证会话等敏感数据。

成功返回 HTTP 202：`{"accepted":1,"duplicates":0}`。相同项目内的 `eventId` 唯一；请求重试不会增加数据。整批校验并原子写入，任何非法事件使整批返回 400。401 表示密钥失效/项目暂停；429 表示限流；5xx 可重试。浏览器接口只接受单条事件，时间和 UA 由服务端确定。

附带两个无额外依赖的服务端客户端，均复用 eventId 重试网络错误、429 和 5xx，带超时，100 条自动分批：

```js
import { sendEvents } from './sdk/node.mjs'
await sendEvents({
  url: process.env.VISORA_URL,
  key: process.env.VISORA_SERVER_KEY,
  events: [{ eventId: 'visit-12345', visitorId: 'v-42', sessionId: 's-1', path: '/dashboard' }],
})
```

```python
import os
from sdk.python import send_events
send_events(os.environ['VISORA_URL'], os.environ['VISORA_SERVER_KEY'], [
    {'eventId': 'visit-12345', 'visitorId': 'v-42', 'sessionId': 's-1', 'path': '/dashboard'}
])
```

将上报放在异步任务或队列，避免阻塞业务请求。客户端默认最多尝试 3 次；需要保证最终送达时，使用本地持久化 outbox/队列保存原始事件 ID，再逐批投递。自动生成的 ID 只保证一次 `sendEvents` 调用内部的重试幂等；跨任务重试需要调用方提供稳定 ID。当前浏览器脚本采取尽力发送，无离线持久化队列。

## new-api / grok-iq 的迁移路径

当前实现没有修改这些业务项目。可以分项目逐步切换：

- **新流量快速接入**：在 HTML 入口添加脚本，验证页面访问后再停用旧采集路径，防止同一访问被不同 ID 重复上报。
- **保留已有采集逻辑**：在已有访问记录成功写入后，通过后台任务转发给 Visora。使用数据库记录主键派生稳定的 `eventId`，不需要 Visora 直连业务数据库。
- **历史迁移**：按表结构将记录转换成统一事件，分批调用同一个服务端接口。new-api 可映射 `ID → eventId`（加前缀）、`Visitor → visitorId`、`Session → sessionId`、`Page → path`、Unix 秒 `CreatedAt → occurredAt`。grok-iq 可映射 `visitor_id`、`path`、`visited_at`，会话需要按同访客 30 分钟无访问规则从原始明细重建；不能从只有聚合计数的报表精确还原 UV 和会话。

新脚本生成的访客 ID 与旧系统不自动一致。需要保持迁移前后身份连续时，应持续使用已有采集逻辑转发，或者显式做身份映射。历史导入前按需增大保留天数，过期已删除的数据无法通过修改配置找回。事件幂等记录随明细一起过期。

## 统计口径与运维边界

- PV、UV、会话只由 `pageview` 计算；自定义事件有单独次数与去重访客。活跃访客指最近 5 分钟发出任意事件的访客，独立于日期筛选。
- UV 是范围内去重的访客数量，不是每日 UV 求和；聚合 UV 按项目隔离，同一个人访问两个项目计为两个项目访客，不做跨站追踪。
- 浏览器访客 ID 保存在本站 localStorage，会话保存在 sessionStorage，30 分钟无事件后轮换；不同标签页有各自会话。存储不可用时回退到内存，重新载入可能成为新访客。
- 日期范围包含起止两天，按 UTC 零点划分，空日期自动补零。上一周期是前一个等长的完整日期范围；当天数据尚未结束，对比时需考虑此差异。单次最多查询 366 天。
- 页面、来源与环境排行显示前 10 项，自定义事件前 20 项。CSV 最多 10,000 条，超出会明确拒绝，需缩小范围。
- 默认保留 90 天，启动和每小时清理；`VISORA_RETENTION_DAYS` 可配置 1–3650 天。保留期外数据和过期会话会永久删除。
- 访客及会话以项目隔离的带盐 HMAC 保存，不存 IP、完整 UA、页面 query/hash 或来源路径。认证 Cookie HttpOnly + SameSite=Strict；管理接口需会话、变更请求校验来源；管理密码使用 scrypt，服务端密钥与会话 token 仅保存哈希。
- 默认全局每 IP 每分钟 1000 次，浏览器每 IP/站点每分钟 120 次，服务端每 IP 每分钟 300 次，登录每 IP 每分钟 5 次。分别通过 `VISORA_RATE_LIMIT`、`VISORA_BROWSER_RATE_LIMIT`、`VISORA_SERVER_RATE_LIMIT`、`VISORA_LOGIN_RATE_LIMIT` 配置；专用路由限额覆盖默认限额。大规模 NAT/网关或集中批量导入应按容量调整，并在代理层配合限流。当前计数器为进程内，多副本需要网关或共享限流存储。
- SQLite 是单实例架构，不应多个容器同时共享同一数据库文件。当前统计实时查询明细，PostgreSQL/MySQL 也需要按实际数据量评估查询容量。数据增长后可拆开采集与查询，增加持久化队列和日级聚合；ClickHouse 需要独立统计仓储适配，不能直接作为现有 ORM 方言切换。统一事件协议可保持接入端兼容。

## 验证

```sh
pnpm test                       # 隔离 SQLite、API、迁移与配置测试（需后续执行）
pnpm build                      # 生成路由、生产构建与 TypeScript 检查
pnpm lint                       # 前端 ESLint
pnpm --dir front exec playwright install chromium # 本机首次运行浏览器测试时
pnpm test:e2e                   # 真实跨域脚本、SPA、看板、导出、登录退出、隐私信号
```

本轮未执行上述命令。后端测试使用隔离内存或临时 SQLite，显式忽略本机数据库环境变量。端到端测试使用独立内存数据库和本机 4317/4318 端口，不写入工作数据库。模板的原始组件保留供复用，产品入口仅开放 Visora 的页面。

前端基于 [shadcn-admin](https://github.com/satnaing/shadcn-admin)，原 MIT 许可见 `front/LICENSE`。
