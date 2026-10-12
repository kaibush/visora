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

每个系统只负责发送统一的事件，无需再实现统计数据库、聚合逻辑、图表和管理页面。项目有独立站点 ID、来源白名单和密钥，可以单独暂停、恢复或删除。删除会同时清除该项目的访问记录。看板支持全部项目与单项目筛选。

已实现：首次创建唯一管理员、管理登录、项目创建/编辑/删除、密钥查看/复制与轮换、网页 SPA 与控件交互自动采集、匿名访客 IP、批量服务端采集、幂等去重、PV/UV/会话、最近 5 分钟活跃访客、按天趋势、页面/来源/设备/浏览器/系统/语言排行、自定义事件、业务用户身份上报与筛选、访问明细分页、CSV 导出和自动清理。

后端使用 Node.js 24 + Fastify + Sequelize ORM，按业务模块划分 routes / services / repositories。默认 SQLite WAL，适合个人项目、单实例部署与中小流量；可通过配置选择 PostgreSQL 或 MySQL。前端使用 React、TypeScript、TanStack Query/Router、shadcn/ui、Recharts。默认部署无需外部数据库、Redis 或 SaaS。未实现组织多租户、跨站身份拼接、地理定位或任意旧数据库自动同步。

目录职责、数据模型、迁移策略和扩展方式见 [后端架构说明](server/README.md)。

## 本地运行

需要 Node.js **24+**、Corepack / pnpm。

```sh
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

打开 `http://127.0.0.1:5173`。数据库还没有管理员时，页面会要求创建唯一的管理员账号和至少 12 位密码，创建成功后立即登录；之后使用这个账号和密码登录。没有默认密码，也不能通过环境变量预置。开发时 Vite 将 `/api` 和 `/tracker.js` 代理至 `127.0.0.1:3001`。默认 SQLite 数据库自动创建于 `data/visora.sqlite`，初始没有示例项目或虚构流量。

生产构建与启动：

```sh
pnpm build
pnpm start
```

打开 `http://127.0.0.1:3001`，同一服务同时提供前端、API、采集脚本。**整个平台应部署在域名根路径**，例如 `https://visora.example.com`。设置 HTTPS 反向代理后，将 `VISORA_SECURE_COOKIE=true`；仅在直接入口受限制且代理可信时设置 `VISORA_TRUST_PROXY=true`，并让代理传递原始 Host、X-Forwarded-Proto 和 X-Forwarded-For。

后端无法启动时不会启用无鉴权模式。管理员只有一个，由首次访问的浏览器创建，没有默认密码。会话有效期 7 天，并绑定当前密码指纹；密码指纹变化后旧会话失效。

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

URL 非空时优先于 `VISORA_DATABASE` 文件路径。远程数据库默认不自动建表，需要在启动应用前由单个进程执行 `pnpm db:migrate`。该命令使用同一套连接配置，不需要管理员凭据，也不会启动 HTTP 或清理任务。数据库和账号需提前创建，迁移只管理 Visora 的表、索引与版本。

SQLite 默认在启动时自动迁移；可以同样设置 `VISORA_AUTO_MIGRATE=false`，改用显式迁移。已有业务表不使用自动 `sync alter/force` 修改。迁移为向前执行，升级前需备份；MySQL DDL 会隐式提交，迁移按可重入方式处理。多实例只允许一个迁移任务，应用副本仅检查版本。

切换连接配置不会自动搬迁 SQLite 数据。迁移已有记录时需保留项目映射和 `settings.identity_salt`，否则访客身份无法连续。运行中的数据库与其他应用应独立，接入 new-api / grok-iq 通过事件 API 完成，不需要 Visora 访问其业务数据库。

SQLite 的 ORM、API 和迁移已通过隔离测试。未连接本机现有 PostgreSQL/MySQL；这两个数据库的兼容性仍需在独立环境中验证。

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

## 最简单接入：一段脚本自动采集（推荐）

new-api、grok-iq 和其他网站统一按新项目接入。只改前端的 HTML 入口，页面访问、SPA 路由和常见控件交互由脚本自动采集；关联登录用户时才需要在统一用户状态处同步，无需开发统计接口或统计表。

1. 在 Visora 创建项目，配置目标网站的准确来源（协议、域名、端口），复制公开站点 ID。
2. 在目标网站的 HTML `<head>` 加载下方脚本。Visora 地址必须能被访客浏览器访问，HTTPS 网站使用 HTTPS 地址。

```html
<script defer
  src="https://visora.example.com/tracker.js"
  data-site="v_项目站点ID">
</script>
```

3. **可选：关联登录用户**。将 [sdk/browser.mjs](sdk/browser.mjs) 复制为目标前端的 `src/lib/visora.js`。TypeScript 项目同时将 [sdk/browser.d.ts](sdk/browser.d.ts) 复制为 `src/lib/visora.d.ts`。在统一的用户状态更新处调用：

```js
import { syncVisoraUser } from './lib/visora'

// 在现有登录状态更新逻辑中执行，在路由跳转之前同步。
// currentUser 来自自己的登录接口；名称字段按实际项目调整。
syncVisoraUser(currentUser ? {
  id: currentUser.id,
  name: currentUser.name ?? currentUser.username,
  email: currentUser.email,
} : null)
```

登录状态恢复、登录成功、切换账号和退出时均调用这个函数；`undefined` 表示状态尚未确定（不更新身份），`null` 表示已确认匿名/退出。退出时也用 `syncVisoraUser(null)`，保证脚本尚未加载时不会留下旧身份。模块只保留最新的用户快照，不持久存储用户信息；脚本先加载、用户先返回都可正常工作。

默认立即采集匿名访问和 IP，用户同步只影响后续事件。首屏必须携带登录身份时，可选添加 `data-wait-for-user="true"`，它会等第一次有效 `identify(user)` 或 `identify(null)/reset()` 后，自动记录**当时的当前页面**，此后继续自动监听路由，无需调用 `pageview()`。身份未确定期间不记录或补发页面/自定义事件；一直不提供用户或匿名状态就不会有数据。重复同步用户不增加 PV，刷新页面后必须重新同步。Hash 路由添加 `data-hash="true"`。

打开目标网站后，在 Visora「访问明细」即可看到访问时间、页面路径、来源站点、浏览器、设备、操作系统、语言，以及主动提供的用户 ID、名称和邮箱。支持按项目、日期、用户 ID 筛选和导出。默认自动采集按钮、链接、标签页、菜单点击，选择框与开关变更，以及表单提交尝试；明细展示操作、控件标签、结构位置、IP、访客和会话标识。通过 document 事件委托支持 React/Vue 动态控件，无需逐页埋点。交互不增加 PV。

- 不读取输入值、密码、表单内容、链接参数或任意 data 属性。短控件文案和 aria-label 会采集；含业务敏感文案的区域添加 `data-visora-ignore`（或 `visora-ignore` class），该区域及子元素均排除。
- 无语义自定义控件可选添加 `data-visora-event="操作名"`，也可用于稳定命名。普通控件无需改动。常见邮箱、长数字和 token 样式标签会省略，但不能自动识别所有敏感文本。
- 添加 `data-autocapture="false"` 关闭交互采集；`data-auto="false"` 关闭全部自动采集。每页每分钟最多 60 次自动交互，不记录程序合成事件。
- 点击只代表操作，表单提交只代表尝试，不代表业务成功。支付成功、任务完成等结果仍用 `window.visora?.track('事件名')` 上报。跨域 iframe、封闭 Shadow DOM、canvas 内部操作无法通用识别。
- 浏览器 IP 取自服务端请求，不信任浏览器载荷中的 IP。服务器转发可提供可选 `ip` 字段，否则为空，避免将转发服务器误认作访客。本机测试通常显示 `127.0.0.1` / `::1`，无法推导访客公网 IP；历史记录不补写。
- 反向代理默认不受信任。只有采集服务仅能经受控代理访问、代理覆盖客户端转发头时，才启用 `VISORA_TRUST_PROXY=true`，否则可能记录伪造 IP。IP 跟随事件保留期删除。

## 仅匿名访问：一段脚本

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

## 关联业务系统的登录用户

Visora 不会自动读取 new-api、grok-iq 等系统的登录状态、Cookie 或用户数据库。各系统可以主动上报用户 ID、名称和邮箱；「访问明细」会显示这些信息以及上报来源，概览、明细和 CSV 均支持按用户 ID 精确筛选。未提供用户信息的事件显示为匿名访客。

推荐使用上面的用户同步模块。已有脚本且需要直接调用 SDK 时，在脚本就绪、业务登录状态恢复后传入身份：

```js
window.visora?.identify({ id: '42', name: '张三', email: 'alice@example.com' })
// 退出登录，在后续路由或事件之前清除身份。
window.visora?.reset()
```

`identify` 仅影响后续事件，不修改历史记录。启用等待模式时，首次有效调用会触发首个自动 pageview；后续调用不增加 PV。有效身份返回 `true`；非法输入返回 `false` 并清除之前的身份，且不会解除首次等待，避免误用旧用户。`identify(null)` 等同于 `reset()`。身份仅保留在当前页面内存，不写入浏览器存储，刷新页面后需要重新同步；匿名访客和统计会话 ID 保持不变。

`visora:ready` 在首次自动 pageview 之前触发，用户同步模块已处理这个时序。首屏需等待身份时用 `data-wait-for-user="true"` 保留自动路由采集。`data-auto="false"` 是独立的完全手动模式：即使身份已就绪，也需要自行调用 `pageview()` 并监听路由。未添加等待属性的旧脚本保持原有的立即匿名采集行为。

服务端接入时，将下方协议中的 `user` 字段与事件一起发送。需要可信的用户归属时，由业务后端从**已验证的登录上下文**取得这些字段，不直接信任客户端提交的用户 ID。浏览器身份只代表客户端声明，明细中会标注「浏览器声明」或「服务端上报」。

用户信息按事件保存快照，账号改名后不会改写以前的记录；匿名历史不自动补全，不同项目相同的用户 ID 也不会合并。查看特定系统的账号时，同时选择项目和用户 ID。ID 必填，名称和邮箱可选；这些主动上报的字段作为可读明细存储，与事件一起按保留期删除，只有管理接口可查询。只发送需要展示的字段，不发送密码、认证令牌或 Cookie。

## 查看和复用服务端密钥

在「项目管理」点击项目卡片的「查看密钥」，即可随时查看和复制完整密钥；刷新页面或重新登录后仍可读取。项目列表只返回密钥前缀，完整密钥通过需要管理员会话的 `GET /api/projects/:id/key` 单独获取，响应禁止缓存。

新创建和轮换的密钥使用 AES-256-GCM 加密保存，同时保留哈希供上报鉴权。升级前仅保存哈希的密钥无法还原：它们继续有效，查看时会提示旧密钥不可回显，可按需手动轮换一次。轮换会立即使旧密钥失效，需同步更新已接入服务。

默认首次启动自动生成 `data/encryption.key`（仅文件所有者可读写）。备份/恢复时同时保留数据库和这个文件，并限制备份访问权限；仅有数据库备份无法解密密钥。也可以通过 `VISORA_ENCRYPTION_KEY` 设置独立的 64 位十六进制主密钥，或用 `VISORA_ENCRYPTION_KEY_FILE` 指定文件位置。多实例必须使用相同的主密钥。该主密钥独立于管理员密码，更换登录密码不影响项目密钥读取。

丢失或更换主密钥后，旧项目的上报鉴权仍可使用哈希，但原有加密副本无法读取；需要恢复原主密钥，或逐项目轮换并更新接入服务。不要把主密钥写入 Git 或前端配置。

## 服务端事件协议

`POST /api/ingest`，请求头 `Authorization: Bearer vs_...` 与 `Content-Type: application/json`。每个密钥绑定一个项目，一次 1–100 条，正文最多 256 KiB。

```json
{
  "events": [
    {
      "eventId": "new-api-visit-12345",
      "visitorId": "analytics-visitor-42",
      "sessionId": "analytics-session-123",
      "user": { "id": "42", "name": "张三", "email": "alice@example.com" },
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
| `ip` | 服务端接入可选 IPv4/IPv6；浏览器采集始终使用请求 IP |
| `interaction` | 可选控件上下文：`action`（click/change/submit）、`target`（最长 512）、`label`（最长 120） |
| `userAgent`  | 服务端接入可选，仅保存解析出的浏览器/系统/设备，不保留原文                |
| `user`       | 可选用户快照，省略或 `null` 表示匿名；仅接收下述三个字段                 |
| `user.id`    | 提供 `user` 时必填；去除首尾空格后 1–128 字符，无控制字符，或非负安全整数（转为字符串） |
| `user.name`  | 可选名称，去除首尾空格后最长 120 字符，可为 `null`                       |
| `user.email` | 可选有效邮箱，去除首尾空格后最长 254 字符，可为空字符串或 `null`        |

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

## 多个项目接入

每个系统各建一个 Visora 项目，使用自己的站点 ID 和来源配置，按「脚本 + 用户同步」安装即可。Visora 统一保存、查询和展示新采集的数据；业务系统只负责从自己的登录状态提供需要展示的用户字段。同一次访问使用一条 Visora 上报路径，避免重复计数。

## 统计口径与运维边界

- PV、UV、会话只由 `pageview` 计算；自定义事件有单独次数与去重访客。活跃访客指最近 5 分钟发出任意事件的访客，独立于日期筛选。
- UV 是范围内去重的访客数量，不是每日 UV 求和；聚合 UV 按项目隔离，同一个人访问两个项目计为两个项目访客，不做跨站追踪。
- 浏览器访客 ID 保存在本站 localStorage，会话保存在 sessionStorage，30 分钟无事件后轮换；不同标签页有各自会话。存储不可用时回退到内存，重新载入可能成为新访客。
- `user.id` 是可选的业务账号标识，不替代匿名访客 ID。用户筛选仅选择带该身份快照的事件，PV/UV/会话仍按原口径计算，不等同于登录账号数；用户姓名和邮箱不会用于跨项目合并。
- 日期范围包含起止两天，看板按上海时间零点划分，空日期自动补零。上一周期是前一个等长的完整日期范围；当天数据尚未结束，对比时需考虑此差异。单次最多查询 366 天。
- 页面、来源与环境排行显示前 10 项，自定义事件前 20 项。CSV 最多 10,000 条，超出会明确拒绝，需缩小范围。
- 默认保留 90 天，启动和每小时清理；`VISORA_RETENTION_DAYS` 可配置 1–3650 天。保留期外数据和过期会话会永久删除。
- 匿名访客及会话以项目隔离的带盐 HMAC 保存，保存请求 IP，不存完整 UA、页面 query/hash 或来源路径。主动提供的业务用户 ID、名称和邮箱保存为可读事件字段。认证 Cookie HttpOnly + SameSite=Strict；管理接口需会话、变更请求校验来源；管理员密码使用 scrypt 和独立盐保存，会话 token 仅保存哈希并绑定当前密码指纹；服务端密钥保留鉴权哈希及 AES-256-GCM 加密副本，登录管理员可单独读取。
- 默认全局每 IP 每分钟 1000 次，浏览器每 IP/站点每分钟 120 次，服务端每 IP 每分钟 300 次，登录每 IP 每分钟 5 次。分别通过 `VISORA_RATE_LIMIT`、`VISORA_BROWSER_RATE_LIMIT`、`VISORA_SERVER_RATE_LIMIT`、`VISORA_LOGIN_RATE_LIMIT` 配置；专用路由限额覆盖默认限额。大规模 NAT/网关或集中批量导入应按容量调整，并在代理层配合限流。当前计数器为进程内，多副本需要网关或共享限流存储。
- SQLite 是单实例架构，不应多个容器同时共享同一数据库文件。当前统计实时查询明细，PostgreSQL/MySQL 也需要按实际数据量评估查询容量。数据增长后可拆开采集与查询，增加持久化队列和日级聚合；ClickHouse 需要独立统计仓储适配，不能直接作为现有 ORM 方言切换。统一事件协议可保持接入端兼容。

## 验证

```sh
pnpm test                       # 隔离 SQLite、API、迁移与配置测试
pnpm build                      # 生成路由、生产构建与 TypeScript 检查
pnpm lint                       # 前端 ESLint
pnpm --dir front exec playwright install chromium # 本机首次运行浏览器测试时
pnpm test:e2e                   # 跨域脚本、SPA、用户身份切换、看板、导出、隐私信号
```

后端测试使用隔离内存或临时 SQLite，显式忽略本机数据库环境变量。端到端测试使用独立内存数据库和本机 4317/4318 端口，不写入工作数据库。模板的原始组件保留供复用，产品入口仅开放 Visora 的页面。

前端基于 [shadcn-admin](https://github.com/satnaing/shadcn-admin)，原 MIT 许可见 `front/LICENSE`。

看板默认使用 Asia/Shanghai（UTC+8），日期边界与 CSV 时间一致。分析 API 可传 `timezone=Asia/Shanghai`；省略时保留 UTC 口径以兼容既有调用。访问明细的「详情」提供完整控件位置、访客和会话标识及用途说明。
