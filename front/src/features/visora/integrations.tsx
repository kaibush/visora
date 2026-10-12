import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import browserUserSource from '../../../../sdk/browser.mjs?raw'
import { browserSnippet, CodeBlock } from './code-block'
import { VisoraPage } from './shared'

const switches = [
  ['data-hash="true"', '页面使用 Hash 路由时打开。'],
  ['data-wait-for-user="true"', '等第一次传入用户或 null 后再开始采集。'],
  ['data-auto="false"', '关闭自动页面采集，改为调用 pageview()。'],
  ['data-autocapture="false"', '只关闭点击、变更和提交尝试。'],
  ['data-visora-ignore', '排除该区域及其中的控件。'],
  ['data-visora-event="名称"', '给没有可见文案的控件命名。'],
] as const

const references = [
  [
    '访客 ID',
    '识别同一浏览器的重复访问，用来计算 UV。不是登录账号，换浏览器或清除存储后会变化。',
  ],
  [
    '会话 ID',
    '把一段连续操作归在一起。超过 30 分钟没有活动会更新，不是登录会话。',
  ],
  [
    '统计口径',
    'PV 只计算页面访问。交互和自定义事件单独计数，看板日期按上海时间。',
  ],
  [
    '来源、密钥与保留',
    '网页上报要匹配允许来源。可信的用户归属用服务端密钥上报。事件默认保留 90 天。',
  ],
] as const

export function VisoraIntegrations() {
  const origin = window.location.origin
  const curl = `curl '${origin}/api/ingest' \\
  -H "Authorization: Bearer $VISORA_SERVER_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"events":[{
    "eventId":"order-completed-1001",
    "visitorId":"anonymous-visitor-42",
    "sessionId":"session-2026-01",
    "type":"event",
    "name":"order_completed",
    "path":"/checkout"
  }]}'`

  return (
    <VisoraPage
      title='接入指南'
      description='所有项目共用这一份指南。站点 ID、允许来源和服务端密钥在项目管理中配置。'
      action={
        <Button asChild>
          <Link to='/projects'>
            去项目管理
            <ArrowUpRight className='size-4' />
          </Link>
        </Button>
      }
    >
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>网页接入</CardTitle>
          <CardDescription>
            React、Vue、静态页面和单页应用都使用这一段脚本，不用按项目改写指南。
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <ol className='space-y-3 text-sm leading-6'>
            <li className='flex gap-3'>
              <StepIndex>1</StepIndex>
              <p>
                在
                <Link
                  to='/projects'
                  className='mx-1 font-medium text-foreground underline-offset-4 hover:underline'
                >
                  项目管理
                </Link>
                创建项目，添加允许来源，并复制站点
                ID。项目上的「接入代码」会直接填好脚本。
              </p>
            </li>
            <li className='flex gap-3'>
              <StepIndex>2</StepIndex>
              <p>
                把脚本放进目标网站 HTML 的 {'<head>'}。从本页复制时，将
                <code className='mx-1 text-xs'>站点ID</code>
                换成项目中的值。
              </p>
            </li>
            <li className='flex gap-3'>
              <StepIndex>3</StepIndex>
              <p>打开目标网站，再回到「访问明细」查看页面、操作和 IP。</p>
            </li>
          </ol>
          <CodeBlock
            label='HTML · 放入 <head>'
            code={browserSnippet('站点ID')}
          />
          <div className='grid gap-4 text-sm sm:grid-cols-2'>
            <RecordList
              title='会自动记录'
              items={[
                '页面访问，以及单页应用的路由变化',
                '按钮、链接、菜单和标签页点击',
                '选择框、开关变更，以及表单提交尝试',
                'IP、访客标识和会话标识',
              ]}
            />
            <RecordList
              title='不会记录'
              items={[
                '输入内容、密码和表单数据',
                '网址参数和来源地址中的路径',
                '支付成功、任务完成等业务结果',
              ]}
            />
          </div>
          <p className='text-xs leading-6 text-muted-foreground'>
            允许来源必须与浏览器地址完全一致，包含协议和端口。本机访问通常显示
            127.0.0.1 或 ::1，已经产生的历史记录不会补写 IP。
          </p>
        </CardContent>
      </Card>

      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>按需补充</CardTitle>
          <CardDescription>
            下面三项都不是接入前提。大多数网站只安装上面的脚本。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuideSection
            title='登录用户'
            description='Visora 不读取其他系统的登录状态。需要在明细中显示账号时，保存同步模块，并在登录恢复、登录、切换账号和退出时调用一次。刷新后要重新同步。'
          >
            <CodeBlock
              label='JavaScript · 用户状态变化时调用'
              code={`import { syncVisoraUser } from './lib/visora'

syncVisoraUser(currentUser ? {
  id: currentUser.id,
  name: currentUser.name ?? currentUser.username,
  email: currentUser.email,
} : null)`}
            />
            <details className='rounded-lg border'>
              <summary className='cursor-pointer px-4 py-3 text-sm'>
                展开同步模块源码，保存为 src/lib/visora.js
              </summary>
              <div className='border-t p-4'>
                <CodeBlock
                  label='JavaScript · 保存为 src/lib/visora.js'
                  code={browserUserSource.trim()}
                />
              </div>
            </details>
            <p className='text-xs leading-6 text-muted-foreground'>
              未确定登录状态时不要调用；确认未登录传
              null。默认立即记录匿名访问，身份只影响后续事件。首屏必须带身份时，给脚本添加
              data-wait-for-user="true"。TypeScript 项目同时复制
              sdk/browser.d.ts。
            </p>
          </GuideSection>
          <GuideSection
            title='业务结果'
            description='自动采集只能说明用户操作了哪个控件，不能判断业务是否成功。'
          >
            <CodeBlock
              label='JavaScript · 业务成功后调用'
              code={`window.visora?.track('order_completed')`}
            />
            <p className='text-xs leading-6 text-muted-foreground'>
              可选链保证脚本未加载时不影响原功能。需要用户同意后才统计的网站，应在同意后再加载脚本。
            </p>
          </GuideSection>
          <GuideSection
            title='服务端上报'
            description='已有后端统计、导入历史，或需要可信用户归属时，使用项目管理中的服务端密钥。浏览器脚本不调用这个接口。'
          >
            <CodeBlock label='Shell · 先设置 VISORA_SERVER_KEY' code={curl} />
            <p className='text-xs leading-6 text-muted-foreground'>
              一次最多 100 条。重试时保持相同
              eventId，避免重复计数。用户字段由业务后端从已验证的登录上下文填入，不要发送密码或令牌。
            </p>
          </GuideSection>
        </CardContent>
      </Card>

      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>开关与口径</CardTitle>
          <CardDescription>
            只有和默认行为不同时才需要这些属性。
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-6 lg:grid-cols-2'>
          <ul className='space-y-3'>
            {switches.map(([name, detail]) => (
              <li key={name}>
                <code className='text-xs break-all'>{name}</code>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                  {detail}
                </p>
              </li>
            ))}
          </ul>
          <dl className='space-y-4'>
            {references.map(([title, detail]) => (
              <div key={title}>
                <dt className='text-sm font-medium'>{title}</dt>
                <dd className='mt-1 text-xs leading-5 text-muted-foreground'>
                  {detail}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </VisoraPage>
  )
}

function StepIndex({ children }: { children: string }) {
  return (
    <span className='mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'>
      {children}
    </span>
  )
}

function RecordList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className='rounded-lg bg-muted/40 p-4'>
      <p className='mb-2 text-sm font-medium'>{title}</p>
      <ul className='list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground'>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function GuideSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className='space-y-3 border-t pt-6 first:border-t-0 first:pt-0'>
      <div>
        <h3 className='text-sm font-medium'>
          {title}
          <span className='ml-2 font-normal text-muted-foreground'>可选</span>
        </h3>
        <p className='mt-1 text-sm leading-6 text-muted-foreground'>
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}
