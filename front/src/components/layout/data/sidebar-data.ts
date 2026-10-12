import {
  Activity,
  ChartNoAxesCombined,
  Code2,
  FolderKanban,
  LayoutDashboard,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: { name: '管理员', email: 'Visora 工作空间', avatar: '' },
  teams: [
    { name: 'Visora', logo: ChartNoAxesCombined, plan: '统一访问统计平台' },
  ],
  navGroups: [
    {
      title: '数据分析',
      items: [
        { title: '访问概览', url: '/', icon: LayoutDashboard },
        { title: '访问明细', url: '/events', icon: Activity },
      ],
    },
    {
      title: '工作空间',
      items: [
        { title: '项目管理', url: '/projects', icon: FolderKanban },
        { title: '接入指南', url: '/integrations', icon: Code2 },
      ],
    },
  ],
}
