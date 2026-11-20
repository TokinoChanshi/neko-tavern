import { openDB } from 'idb'
import { create } from 'zustand'

/** 顶层三态界面：宽屏沉浸陪伴 | 手机 APP 陪伴模式 | 原版 DeepSeek 经典 UI */
export type UIMode = 'companion' | 'mobile' | 'ds'

/** 陪伴模式 6 款高定主题皮肤 */
export type SkinId = 'sakura' | 'starlight' | 'salon' | 'celadon' | 'obsidian' | 'ds-native'

/** 原版 DeepSeek 模式专属 6 款极简主题 */
export type DsSkinId = 'ds-blue' | 'ds-claude' | 'ds-rose' | 'ds-emerald' | 'ds-violet' | 'ds-oled'

export const DS_THEMES: readonly {
  id: DsSkinId
  name: string
  tag: string
  previewClass: string
  dotColor: string
}[] = [
  {
    id: 'ds-blue',
    name: '官方深海蓝',
    tag: '100% 官方原味蓝白',
    previewClass: 'ds_blue',
    dotColor: '#3964fe',
  },
  {
    id: 'ds-claude',
    name: '暖陶书卷',
    tag: 'Claude 羊皮纸护眼风',
    previewClass: 'ds_claude',
    dotColor: '#c96442',
  },
  {
    id: 'ds-rose',
    name: '雾粉微光',
    tag: '温柔冷调玫瑰极简风',
    previewClass: 'ds_rose',
    dotColor: '#c95b7f',
  },
  {
    id: 'ds-emerald',
    name: '松烟墨绿',
    tag: '宣纸薄雾清茶绿',
    previewClass: 'ds_emerald',
    dotColor: '#1f8f6c',
  },
  {
    id: 'ds-violet',
    name: '幻夜紫晶',
    tag: 'Linear 现代极客紫',
    previewClass: 'ds_violet',
    dotColor: '#6e56cf',
  },
  {
    id: 'ds-oled',
    name: '水墨极夜',
    tag: '纯粹黑白 / OLED 护眼',
    previewClass: 'ds_oled',
    dotColor: '#18181b',
  },
]

export type MobileTab = 'discover' | 'chats' | 'cast' | 'me'

export type StageLayout = 'bubbles' | 'novel' | 'minimal'
export type BubbleMaterial = 'glass' | 'soft' | 'minimal'
export type AmbienceEffect = 'none' | 'bokeh' | 'petals' | 'stars' | 'rain'
export type WallpaperId = 'none' | 'greenhouse' | 'clocktower' | 'tavern' | 'courtyard' | 'custom'

export type FontStyle = 'sans' | 'serif' | 'kai'
export type FontScale = 'sm' | 'md' | 'lg'
export type ChatWidth = 'standard' | 'wide'

export type AppearancePrefs = {
  uiMode: UIMode
  skin: SkinId
  dsSkin: DsSkinId
  stageLayout: StageLayout
  bubbleMaterial: BubbleMaterial
  ambience: AmbienceEffect
  wallpaper: WallpaperId
  wallpaperBlur: number
  wallpaperDim: number
  fontStyle: FontStyle
  fontScale: FontScale
  chatWidth: ChatWidth
  dialogueHighlight: boolean
  innerMonologue: boolean
  dossierOpen: boolean
}

type AppearanceState = AppearancePrefs & {
  drawerOpen: boolean
  zenMode: boolean
  mobileTab: MobileTab
  customWallpaperUrl: string
}

const STORAGE_KEY = 'neko-tavern:appearance-v3'
const LEGACY_KEY = 'neko-tavern:appearance-v2'
const DB_NAME = 'neko-tavern-appearance'
const STORE_NAME = 'assets'
const CUSTOM_WALLPAPER_KEY = 'custom-wallpaper'

const DEFAULTS: AppearancePrefs = {
  uiMode: 'companion',
  skin: 'sakura',
  dsSkin: 'ds-blue',
  stageLayout: 'bubbles',
  bubbleMaterial: 'glass',
  ambience: 'bokeh',
  wallpaper: 'greenhouse',
  wallpaperBlur: 2,
  wallpaperDim: 56,
  fontStyle: 'sans',
  fontScale: 'md',
  chatWidth: 'standard',
  dialogueHighlight: true,
  innerMonologue: false,
  dossierOpen: false,
}

const VALID_MODES: readonly UIMode[] = ['companion', 'mobile', 'ds']
const VALID_SKINS: readonly SkinId[] = [
  'sakura',
  'starlight',
  'salon',
  'celadon',
  'obsidian',
  'ds-native',
]
const VALID_DS_SKINS: readonly DsSkinId[] = [
  'ds-blue',
  'ds-claude',
  'ds-rose',
  'ds-emerald',
  'ds-violet',
  'ds-oled',
]
const VALID_LAYOUTS: readonly StageLayout[] = ['bubbles', 'novel', 'minimal']
const VALID_MATERIALS: readonly BubbleMaterial[] = ['glass', 'soft', 'minimal']
const VALID_AMBIENCE: readonly AmbienceEffect[] = ['none', 'bokeh', 'petals', 'stars', 'rain']
const VALID_WALLPAPERS: readonly WallpaperId[] = [
  'none',
  'greenhouse',
  'clocktower',
  'tavern',
  'courtyard',
  'custom',
]
const VALID_FONTS: readonly FontStyle[] = ['sans', 'serif', 'kai']
const VALID_SCALES: readonly FontScale[] = ['sm', 'md', 'lg']
const VALID_WIDTHS: readonly ChatWidth[] = ['standard', 'wide']

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback

const detectUrlModeOverride = (): UIMode | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const mode = new URLSearchParams(window.location.search).get('mode')
    if (mode === 'mobile' || mode === 'ds' || mode === 'companion') {
      return mode
    }
  } catch {
    // ignore
  }
  return null
}

const loadPrefs = (): AppearancePrefs => {
  const urlMode = detectUrlModeOverride()
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      return { ...DEFAULTS, ...(urlMode ? { uiMode: urlMode } : {}) }
    }
    const data = JSON.parse(raw) as Record<string, unknown>
    return {
      uiMode: urlMode ?? pick(data.uiMode, VALID_MODES, DEFAULTS.uiMode),
      skin: pick(data.skin, VALID_SKINS, DEFAULTS.skin),
      dsSkin: pick(data.dsSkin, VALID_DS_SKINS, DEFAULTS.dsSkin),
      stageLayout: pick(data.stageLayout, VALID_LAYOUTS, DEFAULTS.stageLayout),
      bubbleMaterial: pick(data.bubbleMaterial, VALID_MATERIALS, DEFAULTS.bubbleMaterial),
      ambience: pick(data.ambience, VALID_AMBIENCE, DEFAULTS.ambience),
      wallpaper: pick(data.wallpaper, VALID_WALLPAPERS, DEFAULTS.wallpaper),
      wallpaperBlur: clamp(data.wallpaperBlur, 0, 24, DEFAULTS.wallpaperBlur),
      wallpaperDim: clamp(data.wallpaperDim, 0, 88, DEFAULTS.wallpaperDim),
      fontStyle: pick(data.fontStyle, VALID_FONTS, DEFAULTS.fontStyle),
      fontScale: pick(data.fontScale, VALID_SCALES, DEFAULTS.fontScale),
      chatWidth: pick(data.chatWidth, VALID_WIDTHS, DEFAULTS.chatWidth),
      dialogueHighlight:
        typeof data.dialogueHighlight === 'boolean'
          ? data.dialogueHighlight
          : DEFAULTS.dialogueHighlight,
      innerMonologue:
        typeof data.innerMonologue === 'boolean' ? data.innerMonologue : DEFAULTS.innerMonologue,
      dossierOpen: typeof data.dossierOpen === 'boolean' ? data.dossierOpen : DEFAULTS.dossierOpen,
    }
  } catch {
    return { ...DEFAULTS, ...(urlMode ? { uiMode: urlMode } : {}) }
  }
}

const persistPrefs = (state: AppearancePrefs) => {
  try {
    const prefs: AppearancePrefs = {
      uiMode: state.uiMode,
      skin: state.skin,
      dsSkin: state.dsSkin,
      stageLayout: state.stageLayout,
      bubbleMaterial: state.bubbleMaterial,
      ambience: state.ambience,
      wallpaper: state.wallpaper,
      wallpaperBlur: state.wallpaperBlur,
      wallpaperDim: state.wallpaperDim,
      fontStyle: state.fontStyle,
      fontScale: state.fontScale,
      chatWidth: state.chatWidth,
      dialogueHighlight: state.dialogueHighlight,
      innerMonologue: state.innerMonologue,
      dossierOpen: state.dossierOpen,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export const useAppearance = create<AppearanceState>(() => ({
  ...loadPrefs(),
  drawerOpen: false,
  zenMode: false,
  mobileTab: 'discover',
  customWallpaperUrl: '',
}))

export const updateAppearance = (patch: Partial<AppearancePrefs>) => {
  useAppearance.setState((prev) => {
    const next = { ...prev, ...patch }
    persistPrefs(next)
    return next
  })
}

export const resetAppearance = () => {
  useAppearance.setState((prev) => {
    const next = { ...prev, ...DEFAULTS }
    persistPrefs(next)
    return next
  })
}

export const openAppearanceDrawer = () => useAppearance.setState({ drawerOpen: true })
export const closeAppearanceDrawer = () => useAppearance.setState({ drawerOpen: false })
export const setMobileTab = (mobileTab: MobileTab) => useAppearance.setState({ mobileTab })
export const toggleDossier = () =>
  updateAppearance({ dossierOpen: !useAppearance.getState().dossierOpen })
export const toggleInnerMonologue = () =>
  updateAppearance({ innerMonologue: !useAppearance.getState().innerMonologue })
export const toggleZenMode = () => useAppearance.setState((prev) => ({ zenMode: !prev.zenMode }))

export const setUIMode = (uiMode: UIMode) => {
  updateAppearance({ uiMode })
}

const getWallpaperDb = () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })

let currentObjectUrl = ''

const revokeCurrentUrl = () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = ''
  }
}

export const initAppearanceAssets = async () => {
  if (typeof indexedDB === 'undefined') {
    return
  }
  try {
    const db = await getWallpaperDb()
    const blob = (await db.get(STORE_NAME, CUSTOM_WALLPAPER_KEY)) as Blob | undefined
    if (blob instanceof Blob) {
      revokeCurrentUrl()
      currentObjectUrl = URL.createObjectURL(blob)
      useAppearance.setState({ customWallpaperUrl: currentObjectUrl })
    }
  } catch {
    // ignore
  }
}

export const uploadCustomWallpaper = async (file: File): Promise<void> => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('壁纸图片不能超过 10 MB。')
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 PNG、JPEG 或 WebP 格式的壁纸图片。')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp =
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  if (
    !(
      (file.type === 'image/png' && png) ||
      (file.type === 'image/jpeg' && jpeg) ||
      (file.type === 'image/webp' && webp)
    )
  ) {
    throw new Error('图片文件头校验不通过，请换一张图片。')
  }
  const blob = new Blob([bytes], { type: file.type })
  const db = await getWallpaperDb()
  await db.put(STORE_NAME, blob, CUSTOM_WALLPAPER_KEY)
  revokeCurrentUrl()
  currentObjectUrl = URL.createObjectURL(blob)
  useAppearance.setState({ customWallpaperUrl: currentObjectUrl })
  updateAppearance({ wallpaper: 'custom' })
}

export const clearCustomWallpaper = async () => {
  try {
    const db = await getWallpaperDb()
    await db.delete(STORE_NAME, CUSTOM_WALLPAPER_KEY)
  } catch {
    // ignore
  }
  revokeCurrentUrl()
  useAppearance.setState({ customWallpaperUrl: '' })
  if (useAppearance.getState().wallpaper === 'custom') {
    updateAppearance({ wallpaper: 'greenhouse' })
  }
}
