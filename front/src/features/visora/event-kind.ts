import { Eye, MousePointer2, Zap } from 'lucide-react'
import { type VisitEvent } from './api'

const actionNames: Record<string, string> = {
  click: '点击',
  change: '控件变更',
  submit: '提交尝试',
}

export function eventKind(event: VisitEvent) {
  if (event.type === 'pageview')
    return {
      label: '页面访问',
      tone: 'info' as const,
      variant: 'info' as const,
      icon: Eye,
    }
  if (event.action)
    return {
      label: actionNames[event.action] || '页面交互',
      tone: 'violet' as const,
      variant: 'violet' as const,
      icon: MousePointer2,
    }
  return {
    label: '业务事件',
    tone: 'amber' as const,
    variant: 'warning' as const,
    icon: Zap,
  }
}
