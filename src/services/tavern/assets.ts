import appIconImg from '../../assets/app-icon.jpg'
import baiYuImg from '../../assets/characters/bai-yu.jpg'
import guYanshenImg from '../../assets/characters/gu-yanshen.jpg'
import luChenyuanImg from '../../assets/characters/lu-chenyuan.jpg'
import nuomiImg from '../../assets/characters/nuomi.jpg'
import shenXinghuiImg from '../../assets/characters/shen-xinghui.jpg'
import suWanImg from '../../assets/characters/su-wan.jpg'

import clocktowerBg from '../../assets/wallpapers/clocktower.jpg'
import courtyardBg from '../../assets/wallpapers/courtyard.jpg'
import greenhouseBg from '../../assets/wallpapers/greenhouse.jpg'
import tavernBg from '../../assets/wallpapers/tavern.jpg'
import type { WallpaperId } from '../appearance.js'

export { appIconImg }

export const PRESET_PORTRAITS = [
  { id: 'preset:shen-xinghui', label: '沈星回 · 调酒师', src: shenXinghuiImg },
  { id: 'preset:lu-chenyuan', label: '陆沉渊 · 修复师', src: luChenyuanImg },
  { id: 'preset:nuomi', label: '糯米 · 猫耳少年', src: nuomiImg },
  { id: 'preset:gu-yanshen', label: '顾言深 · 钢琴家', src: guYanshenImg },
  { id: 'preset:su-wan', label: '苏晚 · 调香花艺', src: suWanImg },
  { id: 'preset:bai-yu', label: '白屿 · 暖阳烘焙', src: baiYuImg },
] as const

const PORTRAIT_MAP: Record<string, string> = Object.fromEntries(
  PRESET_PORTRAITS.map((item) => [item.id, item.src])
)

export const WALLPAPER_IMAGES: Record<Exclude<WallpaperId, 'none' | 'custom'>, string> = {
  greenhouse: greenhouseBg,
  clocktower: clocktowerBg,
  tavern: tavernBg,
  courtyard: courtyardBg,
}

/** 解析角色立绘地址：支持内置高清插画、用户本地 Base64、HTTPS 网络图片及按角色名智能匹配 */
export const resolveAvatarUrl = (avatar = '', name = ''): string => {
  const trimmed = avatar.trim()
  if (trimmed && PORTRAIT_MAP[trimmed]) {
    return PORTRAIT_MAP[trimmed]
  }
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed
  }
  if (name.includes('星回')) {
    return shenXinghuiImg
  }
  if (name.includes('沉渊')) {
    return luChenyuanImg
  }
  if (name.includes('糯米')) {
    return nuomiImg
  }
  if (name.includes('言深')) {
    return guYanshenImg
  }
  if (name.includes('苏晚')) {
    return suWanImg
  }
  if (name.includes('白屿')) {
    return baiYuImg
  }
  return ''
}
