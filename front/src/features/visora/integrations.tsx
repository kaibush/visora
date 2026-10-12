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
      description='几分钟完成接入，让不同技术栈共享同一套统计能力。'
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
            <Tabs defaultValue='browser'>
              <TabsList className='mb-6'>
                <TabsTrigger value='browser'>浏览器脚本</TabsTrigger>
                <TabsTrigger value='server'>服务端 API</TabsTrigger>
                <TabsTrigger value='custom'>自定义事件</TabsTrigger>
              </TabsList>
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
                  使用创建项目时保存的服务端密钥，放入服务端环境变量
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
                  IP、查询参数、URL fragment 或完整来源地址。
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
            统计口径与现有项目迁移
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
            <h3 className='mb-2 font-medium'>接入 new-api / grok-iq</h3>
            <p className='text-muted-foreground'>
              可直接安装网页脚本，也可在已有访问记录写入后异步转发到服务端
              API。同一事件选择一种采集路径；导入历史数据时映射
              visitor、session、page、created_at 等字段，并使用稳定的 eventId
              去重。
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
