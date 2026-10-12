import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Code2, Globe2, Server, ShieldCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import browserUserSource from '../../../../sdk/browser.mjs?raw'
import { projectsQuery } from './api'
import { browserSnippet, CodeBlock } from './code-block'
import { EmptyState, ErrorState, VisoraPage } from './shared'

export function VisoraIntegrations() {
  const { data, error, refetch } = useQuery(projectsQuery)
  const [selected, setSelected] = useState('')
  const project =
    data?.projects.find((p) => p.id === selected) ?? data?.projects[0]
  const origin = window.location.origin
  const curl = `curl '${origin}/api/ingest' \\\n  -H "Authorization: Bearer $VISORA_SERVER_KEY" \\\n  -H 'Content-Type: application/json' \\\n  -d '{"events":[{\n    "eventId":"order-completed-1001",\n    "visitorId":"anonymous-visitor-42",\n    "sessionId":"session-2026-01",\n    "type":"event",\n    "name":"order_completed",\n    "path":"/checkout"\n  }]}'`
  return (
    <VisoraPage
      title='接入指南'
      description='推荐只改前端：安装脚本、同步用户，即可自动查看每次访问的详情。'
    >
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {data && !data.projects.length && (
        <EmptyState
          title='先创建一个项目'
          description='每个项目都有独立的站点 ID 和服务端密钥，创建后即可获得专属接入代码。'
        />
      )}
      <div className='grid gap-4 md:grid-cols-3'>
        {[
          {
            icon: Globe2,
            title: '网页自动采集',
            text: '一段脚本，支持 React、Vue、静态页面与 SPA。',
          },
          {
            icon: Server,
            title: '服务端统一上报',
            text: '标准 HTTP JSON 接口，适配 Go、Python、Node.js。',
          },
          {
            icon: Code2,
            title: '业务事件追踪',
            text: '将注册、点击、任务完成等行为纳入同一看板。',
          },
        ].map((item) => (
          <Card key={item.title} className='gap-3 shadow-none'>
            <CardHeader className='flex flex-row items-center gap-3'>
              <item.icon className='size-5 text-primary' />
              <CardTitle className='text-sm'>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className='text-xs leading-6 text-muted-foreground'>
              {item.text}
            </CardContent>
          </Card>
        ))}
      </div>
      {project && (
        <Card className='shadow-none'>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-4'>
            <div className='space-y-2'>
              <CardTitle className='text-base'>选择项目，开始连接</CardTitle>
              <CardDescription>
                站点 ID：<code className='text-xs'>{project.siteId}</code>
              </CardDescription>
            </div>
            <Select value={project.id} onValueChange={setSelected}>
              <SelectTrigger className='w-52' aria-label='选择接入项目'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data?.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue='quickstart'>
              <TabsList className='mb-6 flex h-auto flex-wrap'>
                <TabsTrigger value='quickstart'>快速接入（推荐）</TabsTrigger>
                <TabsTrigger value='browser'>浏览器脚本</TabsTrigger>
                <TabsTrigger value='server'>服务端 API</TabsTrigger>
                <TabsTrigger value='custom'>自定义事件</TabsTrigger>
                <TabsTrigger value='users'>登录用户</TabsTrigger>
              </TabsList>
              <TabsContent value='quickstart' className='space-y-5'>
                <p className='text-sm leading-7 text-muted-foreground'>
                  new-api、grok-iq
                  及其他网站都按同一种方式接入。只需在前端安装一次脚本，
                  再从现有登录状态传入用户；页面访问与 SPA
                  路由变化自动记录，无需修改业务后端或数据库。
                </p>
                <p className='text-sm font-medium'>
                  1. 在项目管理中添加目标网站的来源，再把脚本放入 HTML 的
                  &lt;head&gt;
                </p>
                <CodeBlock
                  label='HTML · 等待用户状态就绪，自动采集首屏与路由'
                  code={browserSnippet(project.siteId, true)}
                />
                <p className='rounded-md bg-muted/50 p-3 text-xs leading-6 text-muted-foreground'>
                  当前允许来源：
                  {project.origins.join('、') ||
                    '尚未配置，请先在项目管理中添加'}
                  。
                  来源必须包含协议、域名与端口；脚本地址必须能被访客浏览器访问。
                </p>
                <p className='text-sm font-medium'>
                  2. 复制用户同步模块，在统一更新登录状态的位置调用
                </p>
                <CodeBlock
                  label='JavaScript · 保存为 src/lib/visora.js'
                  code={browserUserSource}
                />
                <CodeBlock
                  label='JavaScript · 登录状态恢复 / 登录 / 切换账号 / 退出时调用'
                  code={`import { syncVisoraUser } from './lib/visora'

// 放在现有的用户状态更新逻辑中，在路由跳转之前执行。
// currentUser 来自自己的登录接口，字段名按业务系统调整。
// 等登录状态恢复完成后再调用；确认未登录或退出时传 null。
syncVisoraUser(currentUser ? {
  id: currentUser.id,
  name: currentUser.name ?? currentUser.username,
  email: currentUser.email,
} : null)`}
                />
                <p className='text-xs leading-6 text-muted-foreground'>
                  同步模块兼容脚本先加载、用户先加载，未加载脚本时只保留最新的用户状态。
                  第一次传入有效用户或 null
                  后，自动记录当前页面并继续监听路由；不需要手动调用 pageview。
                  如果一直不传入状态，就不会采集。刷新页面后需要重新同步；重复同步不会增加
                  PV。 TypeScript 项目可同时把 sdk/browser.d.ts 复制为
                  src/lib/visora.d.ts。
                </p>
                <p className='text-sm font-medium'>
                  3. 打开目标网站，再到「访问明细」按项目或用户 ID 查看
                </p>
                <p className='text-sm leading-7 text-muted-foreground'>
                  可看到访问时间、页面路径、来源站点、设备、浏览器、操作系统、语言，以及已传入的用户
                  ID、名称和邮箱， 并按项目、日期、用户 ID
                  筛选和导出。未登录访客显示为匿名。
                </p>
                <p className='text-xs leading-6 text-muted-foreground'>
                  纯匿名网站可以使用「浏览器脚本」页签的一段脚本直接采集。 Hash
                  路由添加 data-hash="true"。浏览器身份来自业务前端声明；用户 ID
                  必填，名称和邮箱可选。
                </p>
              </TabsContent>
              <TabsContent value='browser' className='space-y-5'>
                <p className='text-sm leading-7 text-muted-foreground'>
                  在目标网站的 HTML
                  入口添加以下脚本。每个项目安装一次，脚本自动监听初次加载、pushState、replaceState
                  和浏览器前进后退。
                </p>
                <CodeBlock
                  label='HTML · 放入 <head>'
                  code={browserSnippet(project.siteId)}
                />
                <div className='space-y-2 text-sm'>
                  <p className='flex items-center gap-2'>
                    <Check className='size-4 text-emerald-500' />
                    当前允许来源
                  </p>
                  <p className='rounded-md bg-muted/50 p-3 font-mono text-xs'>
                    {project.origins.join('\n') ||
                      '尚未配置：请在项目管理中添加网站来源'}
                  </p>
                </div>
                <p className='text-xs leading-6 text-muted-foreground'>
                  Hash 路由：在脚本上添加 data-hash="true"。手动路由：添加
                  data-auto="false"，再调用
                  window.visora?.pageview()。同一路径的连续路由通知会去重；查询参数变化不增加
                  PV。
                </p>
              </TabsContent>
              <TabsContent value='server' className='space-y-5'>
                <p className='text-sm leading-7 text-muted-foreground'>
                  在「项目管理 → 查看密钥」复制服务端密钥，放入服务端环境变量
                  VISORA_SERVER_KEY。一次最多上报 100
                  个事件，适合已有统计逻辑转发或定时批量导入。
                </p>
                <CodeBlock
                  label='Shell · 先设置 VISORA_SERVER_KEY'
                  code={curl}
                />
                <div className='rounded-lg border p-4 text-sm leading-7 text-muted-foreground'>
                  eventId
                  是项目内唯一事件标识，重试时保持相同值以避免重复统计。visitorId
                  与 sessionId 使用统计专用标识，切勿发送认证令牌。可传入
                  occurredAt（ISO 8601）导入保留期内的历史事件，以及 userAgent
                  识别设备。
                </div>
                <p className='text-xs text-muted-foreground'>
                  pageview 事件计入 PV / UV / 会话；event
                  事件计入自定义事件。接口返回 accepted 与 duplicates。
                </p>
              </TabsContent>
              <TabsContent value='users' className='space-y-5'>
                <p className='text-sm leading-7 text-muted-foreground'>
                  Visora
                  不会自动读取其他系统的登录状态。请在脚本就绪且业务登录状态恢复后传入用户信息，访问明细即可显示用户
                  ID、名称和邮箱。
                </p>
                <CodeBlock
                  label='JavaScript · 登录 / 恢复会话 / 切换账号后'
                  code={`// currentUser 由你的业务系统登录接口提供
function syncVisoraUser(currentUser) {
  if (currentUser) {
    window.visora?.identify({
      id: String(currentUser.id),
      name: currentUser.name,
      email: currentUser.email,
    })
  } else {
    window.visora?.reset()
  }
}

// 状态恢复后调用；若脚本晚于应用加载，也监听就绪事件
syncVisoraUser(currentUser)
window.addEventListener('visora:ready', () => syncVisoraUser(currentUser))

// 每次登录 / 切换账号后再次调用 syncVisoraUser
// 退出登录时（在后续路由或事件之前）
window.visora?.reset()`}
                />
                <CodeBlock
                  label='JSON · 服务端事件可携带相同的 user 字段'
                  code={JSON.stringify(
                    {
                      events: [
                        {
                          eventId: 'visit-1001',
                          visitorId: 'visitor-42',
                          sessionId: 'session-1',
                          path: '/dashboard',
                          user: {
                            id: '42',
                            name: '演示用户',
                            email: 'demo@example.com',
                          },
                        },
                      ],
                    },
                    null,
                    2
                  )}
                />
                <p className='text-xs leading-6 text-muted-foreground'>
                  user.id 必填，name 和 email 可选。identify
                  只影响后续事件，不补写历史记录，也不增加 PV。
                  身份只保留在当前页面内存，刷新后需由业务系统重新传入。首屏也需关联用户时，
                  使用「快速接入」的 data-wait-for-user="true"，第一次传入用户或
                  null 后自动开始采集。
                </p>
                <p className='text-xs leading-6 text-muted-foreground'>
                  浏览器身份属于客户端声明；需要可信归属的记录，应由业务后端读取已验证的登录上下文后使用项目密钥上报。
                  不同项目相同的用户 ID
                  不会合并。只发送需要展示的用户字段，不传密码、Cookie
                  或登录令牌。
                </p>
              </TabsContent>
              <TabsContent value='custom' className='space-y-5'>
                <p className='text-sm leading-7 text-muted-foreground'>
                  安装网页脚本后，在业务成功时上报事件。可选链确保脚本未加载或用户拒绝追踪时，业务正常运行。
                </p>
                <CodeBlock
                  label='JavaScript'
                  code={`// 注册成功后\nwindow.visora?.track('signup_completed')\n\n// 文件下载成功后\nwindow.visora?.track('file_downloaded')\n\n// 在用户撤回统计授权后停止采集\nif (window.visora) window.visora.disabled = true`}
                />
                <p className='text-xs leading-6 text-muted-foreground'>
                  需要事先征得统计同意的网站，应在用户同意后才加载脚本。默认尊重
                  Do Not Track 和 Global Privacy Control，不采集
                  IP、查询参数、URL fragment
                  或完整来源地址。用户信息仅在主动调用 identify 或通过服务端提供
                  user 时记录。
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <ShieldCheck className='size-5 text-primary' />
            统计口径与接入说明
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-6 text-sm leading-7 md:grid-cols-2'>
          <div>
            <h3 className='mb-2 font-medium'>一致的统计口径</h3>
            <p className='text-muted-foreground'>
              PV 为页面访问次数，UV
              为所选日期内去重的访客数。访客与会话在不同项目之间隔离；聚合 UV
              表示各项目访客之和。网页会话在 30 分钟无事件后更新。所有日期按 UTC
              统计。
            </p>
          </div>
          <div>
            <h3 className='mb-2 font-medium'>所有网站使用同一套接入方式</h3>
            <p className='text-muted-foreground'>
              在 HTML
              入口加载脚本，在统一用户状态更新处同步身份，便能自动记录页面访问。
              业务系统无需实现统计接口或维护统计表；同一次访问使用一条 Visora
              采集路径，避免重复计数。
            </p>
          </div>
          <div>
            <h3 className='mb-2 font-medium'>浏览器来源与服务端密钥</h3>
            <p className='text-muted-foreground'>
              浏览器来源白名单用于约束正常网页上报，公开站点 ID
              不具备秘密凭证的防伪能力。可信业务事件应由服务端密钥上报。每个项目可以独立暂停采集、轮换密钥。
            </p>
          </div>
          <div>
            <h3 className='mb-2 font-medium'>数据与保留期</h3>
            <p className='text-muted-foreground'>
              访客标识经过带盐哈希后保存，默认保留 90
              天，并按小时清理过期事件。路径仍可能包含业务标识，请避免在 URL
              路径和事件名称中放入敏感信息。数据保存在部署时配置的数据库中，默认使用
              SQLite。
            </p>
          </div>
        </CardContent>
      </Card>
    </VisoraPage>
  )
}
