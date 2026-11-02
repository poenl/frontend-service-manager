import Image, { type StaticImageData } from 'next/image'
import type { ProjectType } from '@/lib/project-types'
import viteIcon from '@/assets/icons/vite.svg'
import electronIcon from '@/assets/icons/electron.svg'

// 类型到品牌图标的映射：新增类型漏配图标时 TS 直接报缺少属性
const PROJECT_TYPE_ICONS: Record<ProjectType, StaticImageData> = {
  vite: viteIcon,
  electron: electronIcon
}

interface Props {
  type: ProjectType
  className?: string
}

// 项目类型品牌图标：图标文件存放在 src/assets/icons，此处只按类型查表并统一尺寸
export default function ProjectTypeIcon({ type, className = 'size-3.5' }: Props) {
  return <Image src={PROJECT_TYPE_ICONS[type]} alt="" aria-hidden className={className} />
}
