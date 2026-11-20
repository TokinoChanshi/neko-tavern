import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import {
  openAppearanceDrawer,
  setUIMode,
  toggleInnerMonologue,
  useAppearance,
} from '../../services/appearance.js'
import { newChat, startCharacterSession, useChatStore } from '../../services/chat/store.js'
import {
  closeCommandPalette,
  openGuideHandbook,
  openOnboardingTour,
  toggleCommandPalette,
  useGuide,
} from '../../services/guide.js'
import { openTavern, selectCharacter, useTavern } from '../../services/tavern/store.js'
import { downloadStoryMarkdown } from '../../services/tavern/storyExport.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { TavernIcon, type TavernIconName } from '../tavern/TavernIcon.js'
import styles from './CommandPalette.module.css'

type CommandItem = {
  id: string
  group: string
  icon: TavernIconName
  title: string
  keywords: string
  run: () => void | Promise<void>
}

export const CommandPalette = () => {
  const open = useGuide((s) => s.commandPaletteOpen)
  const guideOpen = useGuide((s) => s.open)

  // 全局绑定 Ctrl/⌘+K（快捷指令台）与 F1 / Ctrl+/（玩法图鉴手册）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleCommandPalette()
        return
      }
      if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault()
        if (guideOpen) {
          useGuide.setState({ open: false })
        } else {
          openGuideHandbook('quickstart')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [guideOpen])

  if (!open) {
    return null
  }

  return <PaletteBody />
}

const PaletteBody = () => {
  const library = useTavern((s) => s.library)
  const innerMonologue = useAppearance((s) => s.innerMonologue)
  const activeSession = useChatStore((s) =>
    s.activeId !== null ? s.sessionCache[s.activeId] : undefined
  )
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const commands = useMemo<CommandItem[]>(() => {
    const charCommands: CommandItem[] = library.characters.map((c) => ({
      id: `char-${c.id}`,
      group: '开启故事',
      icon: 'heart',
      title: `与「${c.name}」开启 / 进入故事舞台`,
      keywords: `${c.name} ${c.personality} 角色 对话`,
      run: async () => {
        await selectCharacter(c.id)
        startCharacterSession({
          character: c,
          persona: library.persona,
          preset: library.preset,
        })
      },
    }))

    const coreCommands: CommandItem[] = [
      {
        id: 'guide-handbook',
        group: '新手与攻略',
        icon: 'book',
        title: '打开「玩法图鉴与角色彩蛋手册」(F1)',
        keywords: '指南 教程 攻略 帮助 世界书 彩蛋 guide help',
        run: () => openGuideHandbook('quickstart'),
      },
      {
        id: 'guide-tour',
        group: '新手与攻略',
        icon: 'sparkle',
        title: '重播「5 步互动迎宾新手向导」',
        keywords: '新手引导 教程 入门 onboarding tour',
        run: () => openOnboardingTour(0),
      },
      {
        id: 'toggle-monologue',
        group: '互动魔法',
        icon: 'heart',
        title: innerMonologue
          ? '关闭「💭 角色读心小剧场」'
          : '开启「💭 角色读心小剧场」（偷看心声与心率）',
        keywords: '读心 心声 心率 内心独白 os',
        run: () => {
          toggleInnerMonologue()
          showToast(innerMonologue ? '已关闭角色读心小剧场' : '已开启角色读心小剧场！')
        },
      },
      {
        id: 'edit-persona',
        group: '养成设定',
        icon: 'user',
        title: '定制「我的人设 ({{user}})」与身份模板',
        keywords: '人设 我的名字 user 身份 模板',
        run: () => openTavern(library.selectedId, 'persona'),
      },
      {
        id: 'edit-preset',
        group: '养成设定',
        icon: 'edit',
        title: '切换「叙事文风预设」（日常/拉扯/微信秒回/哄睡/古风）',
        keywords: '文风 预设 温度 微信 小说 preset',
        run: () => openTavern(library.selectedId, 'preset'),
      },
      {
        id: 'edit-lore',
        group: '养成设定',
        icon: 'book',
        title: '管理当前角色「世界书词条 (Lorebook)」',
        keywords: '世界书 设定 触发词 lorebook',
        run: () => openTavern(library.selectedId ?? library.characters[0]?.id, 'lore'),
      },
      {
        id: 'create-char-tpl',
        group: '养成设定',
        icon: 'plus',
        title: '新建 / 导入角色卡（含白予、苏晚等灵感模板）',
        keywords: '新建 导入 角色卡 png json 模板 白予 苏晚',
        run: () => openTavern(null, 'characters'),
      },
      {
        id: 'api-channels',
        group: '连接与存档',
        icon: 'link',
        title: '配置 19 款预设 API 模型渠道（火山/OpenCode/Cline/DS）',
        keywords: 'api key 模型 连接 渠道 火山 opencode cline deepseek ollama',
        run: () => openSettings('connection'),
      },
      {
        id: 'appearance',
        group: '界面与装扮',
        icon: 'palette',
        title: '打开「外观与装扮工坊」（皮肤 / 壁纸 / 字体 / 气泡）',
        keywords: '主题 皮肤 壁纸 外观 装扮 字体',
        run: () => openAppearanceDrawer(),
      },
      {
        id: 'mode-companion',
        group: '界面与装扮',
        icon: 'sparkle',
        title: '切换至「电脑宽屏沉浸酒馆」模式',
        keywords: '宽屏 桌面 电脑模式',
        run: () => setUIMode('companion'),
      },
      {
        id: 'mode-mobile',
        group: '界面与装扮',
        icon: 'phone',
        title: '切换至「手机陪伴 APP」模式',
        keywords: '手机 app 竖屏 小窗',
        run: () => setUIMode('mobile'),
      },
      {
        id: 'mode-ds',
        group: '界面与装扮',
        icon: 'classic',
        title: '切换至「DeepSeek 经典极简」模式（含 6 款专属主题）',
        keywords: 'ds deepseek 经典 原版 极简',
        run: () => setUIMode('ds'),
      },
      {
        id: 'free-chat',
        group: '开启故事',
        icon: 'chat',
        title: '返回首页 / 开启自由闲聊',
        keywords: '首页 新对话 自由闲聊',
        run: () => newChat(),
      },
      {
        id: 'backup-data',
        group: '连接与存档',
        icon: 'link',
        title: '导出完整酒馆 JSON 备份 / 导入历史存档',
        keywords: '备份 导出 导入 存档 json zip',
        run: () => openSettings('data'),
      },
    ]

    if (activeSession && activeSession.messages.length > 0) {
      coreCommands.splice(3, 0, {
        id: 'export-story-md',
        group: '连接与存档',
        icon: 'book',
        title: `珍藏导出当前剧本《${activeSession.title || '当前故事'}》(.md)`,
        keywords: '导出 剧本 小说 md markdown 纪念',
        run: () => downloadStoryMarkdown(activeSession),
      })
    }

    return [...coreCommands.slice(0, 3), ...charCommands, ...coreCommands.slice(3)]
  }, [library, innerMonologue, activeSession])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return commands
    }
    return commands.filter((item) =>
      `${item.title} ${item.group} ${item.keywords}`.toLowerCase().includes(q)
    )
  }, [commands, query])

  const safeIndex = filtered.length ? Math.min(activeIndex, filtered.length - 1) : 0

  const execute = (item: CommandItem) => {
    closeCommandPalette()
    void item.run()
  }

  return (
    <div className={styles.mask} onClick={closeCommandPalette}>
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="酒馆全局快捷指令台"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.searchBar}>
          <TavernIcon name="search" size={16} />
          <input
            autoFocus
            type="search"
            placeholder="输入角色名或想执行的操作（如：读心、人设、文风、火山、指南…）"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                closeCommandPalette()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (filtered.length) {
                  setActiveIndex((i) => (i + 1) % filtered.length)
                }
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (filtered.length) {
                  setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
                }
              } else if (e.key === 'Enter' && filtered[safeIndex]) {
                e.preventDefault()
                execute(filtered[safeIndex])
              }
            }}
          />
          <kbd>ESC</kbd>
        </div>

        <div className={styles.list} role="listbox">
          {filtered.length ? (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={idx === safeIndex}
                className={clsx(styles.item, idx === safeIndex && styles.itemActive)}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => execute(item)}
              >
                <span className={styles.itemLeft}>
                  <TavernIcon name={item.icon} size={15} />
                  <strong>{item.title}</strong>
                </span>
                <span className={styles.groupBadge}>{item.group}</span>
              </button>
            ))
          ) : (
            <div className={styles.empty}>没有找到匹配的指令，换个关键词试试吧</div>
          )}
        </div>

        <footer className={styles.footer}>
          <span>↑↓ 选择指令 · Enter 立即执行</span>
          <span>F1 玩法图鉴 · Ctrl+K 随时唤出</span>
        </footer>
      </div>
    </div>
  )
}
