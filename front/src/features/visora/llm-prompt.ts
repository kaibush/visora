export type UserFieldMapping = {
  userIdField: string
  userNameField: string
  userEmailField: string
}

export type LlmPromptProject = UserFieldMapping & {
  name: string
  siteId: string
  origins: string[]
}

// Keep this aligned with the project field schema on the server.
const fieldPath = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

export function isFieldPath(value: string) {
  return fieldPath.test(value)
}

export function fieldMappingError(mapping: UserFieldMapping) {
  if (!isFieldPath(mapping.userIdField))
    return '用户 ID 需要是字段路径，例如 id 或 userId'
  if (mapping.userNameField && !isFieldPath(mapping.userNameField))
    return '名称路径无效。可填 name、profile.displayName，留空表示不发送'
  if (mapping.userEmailField && !isFieldPath(mapping.userEmailField))
    return '邮箱路径无效。可填 email、profile.email，留空表示不发送'
  return ''
}

export function userSyncCall(mapping: UserFieldMapping) {
  const fields = [`  id: currentUser.${mapping.userIdField},`]
  if (mapping.userNameField)
    fields.push(`  name: currentUser.${mapping.userNameField},`)
  if (mapping.userEmailField)
    fields.push(`  email: currentUser.${mapping.userEmailField},`)
  return `import { syncVisoraUser } from './lib/visora'

syncVisoraUser(currentUser ? {
${fields.join('\n')}
} : null)`
}

export function llmIntegrationPrompt({
  project,
  origin,
  sdkSource,
  typeSource,
}: {
  project: LlmPromptProject
  origin: string
  sdkSource: string
  typeSource: string
}) {
  const origins = project.origins.length
    ? project.origins.map((item) => `- ${item}`).join('\n')
    : '- （尚未配置。接入前必须添加目标网站的完整来源，包含协议和端口，不含路径。）'
  const mapping = [
    `- id ← currentUser.${project.userIdField}（必填，登录账号的稳定标识）`,
    project.userNameField
      ? `- name ← currentUser.${project.userNameField}（可选，显示名称）`
      : '- name：这个项目不发送',
    project.userEmailField
      ? `- email ← currentUser.${project.userEmailField}（可选）`
      : '- email：这个项目不发送',
  ]
  const shown = [
    '用户 ID',
    project.userNameField ? '名称' : '',
    project.userEmailField ? '邮箱' : '',
  ].filter(Boolean)
  return `你是当前前端仓库的编码助手。请把 Visora 访问统计接入项目「${project.name}」。只修改这个网站的前端，不要新建统计接口、统计表或后台账号，也不要调用 Visora 的管理员接口。

Visora 收到的用户只有 id、name、email。每个项目的登录对象字段都不同。这个项目必须使用下面写明的取值路径，不要照搬 user.id、user.name、user.email，也不要猜测或另外扫描后替换字段。

## 项目参数
- 项目名称：${project.name}
- Visora 地址：${origin}
- 采集脚本：${origin}/tracker.js
- 站点 ID：${project.siteId}
- 已允许来源（必须与浏览器地址栏的 origin 完全一致）：
${origins}

## 要完成的修改
1. 把 HTML 放进目标网站每个页面入口的 <head>，位于业务脚本之前。不要改站点 ID、脚本地址和 data-wait-for-user。使用 Hash 路由时再添加 data-hash="true"。
2. 把同步模块原样保存为 src/lib/visora.js。TypeScript 项目再把类型声明原样保存为 src/lib/visora.d.ts。不要改这两份源码。
3. 在现有登录状态的唯一更新处接入「本项目调用」：应用启动后的登录恢复、登录成功、切换账号、退出登录。状态还在加载时不要调用，或传入 undefined；已确认是访客或已退出时传入 null。
4. 不要发送密码、令牌、Cookie、请求头，以及任何没有列出的字段。不要把 Visora 服务端密钥写进浏览器。

## HTML
\`\`\`html
<script defer
  src="${origin}/tracker.js"
  data-site="${project.siteId}"
  data-wait-for-user="true">
</script>
\`\`\`

## 本项目的用户字段
${mapping.join('\n')}

## 本项目调用
\`\`\`js
${userSyncCall(project)}
\`\`\`

调用约定：
- undefined：登录状态尚未确定。不要更新身份，也不要开始采集。
- null：已确认未登录或刚刚退出。必须调用，避免脚本晚加载时留下上一个账号。
- 对象：只包含上面列出的字段。id 去掉首尾空格后为 1 到 128 个字符。
- 每次登录恢复、登录成功、切换账号和退出都要调用。重复同步同一个用户不会额外增加页面浏览；刷新页面后必须重新同步。
- 身份未确定期间不缓存、不补发事件。第一次传入有效用户或 null 之后，脚本记录当时的当前页面，并继续监听单页应用路由。

## 同步模块 src/lib/visora.js
\`\`\`js
${sdkSource.trim()}
\`\`\`

## TypeScript 声明 src/lib/visora.d.ts
\`\`\`ts
${typeSource.trim()}
\`\`\`

## 不要做
- 不要创建统计接口、埋点服务或数据库表。
- 不要读取业务系统的用户表、Cookie，或 Visora 的管理员会话。
- 不要用访客 ID、会话 ID 代替登录用户 ID。
- 不要采集输入框、密码或表单里的具体内容。
- 不要为了接入去修改 Visora 服务端。

完成后，用已允许的来源打开目标网站并登录一次。Visora 的用户列表和访问明细里应出现这个项目的${shown.join('、')}。`
}
