import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import {
  openAppearanceDrawer,
  setMobileTab,
  setUIMode,
  updateAppearance,
  useAppearance,
  type MobileTab,
  type SkinId,
  type WallpaperId,
} from '../../services/appearance.js'
import { setDraftText } from '../../services/chat/drafts.js'
import {
  newChat,
  removeSession,
  selectSession,
  startCharacterSession,
  useChatStore,
} from '../../services/chat/store.js'
import type { Session } from '../../services/chat/types.js'
import { setThemePreference, useSettings } from '../../services/settings.js'
import { appIconImg, WALLPAPER_IMAGES } from '../../services/tavern/assets.js'
import { expandMacros, getCharacterGreetings, type Character } from '../../services/tavern/core.js'
import { filterSessions } from '../../services/tavern/experience.js'
import { findChannelById, inferChannelId } from '../../services/tavern/channels.js'
import { openGuideHandbook } from '../../services/guide.js'
import {
  isConnectionReady,
  openTavern,
  selectCharacter,
  useConnection,
  useTavern,
} from '../../services/tavern/store.js'
import { useTranslate } from '../../i18n/index.js'
import { StageBackdrop } from '../appearance/StageBackdrop.js'
import { IconDownloadOutline16, IconTrashOutline16 } from '../base/icons.js'
import { downloadStoryMarkdown } from '../../services/tavern/storyExport.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { Markdown } from '../markdown/Markdown.js'
import { MessageList } from '../messages/MessageList.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { Avatar } from '../tavern/Avatar.js'
import { MemoryDialog } from '../tavern/MemoryDialog.js'
import { TavernIcon, type TavernIconName } from '../tavern/TavernIcon.js'
import { useTavernText } from '../tavern/text.js'
import styles from './MobileAppShell.module.css'

const SKINS: { id: SkinId; name: string; color: string }[] = [
  { id: 'sakura', name: '樱雾白桃', color: 'linear-gradient(135deg,#f8b4cb,#f7d6c4)' },
  { id: 'starlight', name: '深空星夜', color: 'linear-gradient(135deg,#5e56c2,#8bb6f8)' },
  { id: 'salon', name: '丝绒红茶', color: 'linear-gradient(135deg,#b5754c,#f2d2ad)' },
  { id: 'celadon', name: '森屿青提', color: 'linear-gradient(135deg,#5fa388,#cfe6c8)' },
  { id: 'obsidian', name: '黑曜玫瑰', color: 'linear-gradient(135deg,#1f1521,#cf5c80)' },
  { id: 'ds-native', name: 'DS 原生蓝', color: 'linear-gradient(135deg,#3964fe,#bfd4ff)' },
]

const WALLS: { id: Exclude<WallpaperId, 'custom'>; name: string }[] = [
  { id: 'greenhouse', name: '暮色花房' },
  { id: 'clocktower', name: '星穹钟楼' },
  { id: 'tavern', name: '暖灯酒馆' },
  { id: 'courtyard', name: '晨雾茶庭' },
  { id: 'none', name: '纯色底' },
]

const TABS: { id: MobileTab; label: string; icon: TavernIconName }[] = [
  { id: 'discover', label: '酒馆', icon: 'compass' },
  { id: 'chats', label: '消息', icon: 'chat' },
  { id: 'cast', label: '名册', icon: 'book' },
  { id: 'me', label: '我的', icon: 'user' },
]

const splitTags = (text: string): string[] =>
  text
    .split(/[·,，、/|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)

const formatClock = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** 商业陪伴手机 APP 模式外壳：电脑宽屏呈现精致无边框旗舰手机壳，手机/小窗自动全屏铺满 */
export const MobileAppShell = ({
  session,
  streaming,
  isNarrowViewport,
}: {
  session: Session | undefined
  streaming: boolean
  isNarrowViewport: boolean
}) => {
  const t = useTranslate()
  const tt = useTavernText()
  const tab = useAppearance((s) => s.mobileTab)
  const skin = useAppearance((s) => s.skin)
  const wallpaper = useAppearance((s) => s.wallpaper)
  const themePreference = useSettings((s) => s.themePreference)
  const library = useTavern((s) => s.library)
  const connection = useConnection()
  const sessions = useChatStore((s) => s.sessions)
  const activeId = useChatStore((s) => s.activeId)

  const [clock, setClock] = useState(formatClock)
  const [previewChar, setPreviewChar] = useState<Character | null>(null)
  const [sheetGreetingIdx, setSheetGreetingIdx] = useState(0)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [chatQuery, setChatQuery] = useState('')
  const [freeChatMode, setFreeChatMode] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 30_000)
    return () => clearInterval(id)
  }, [])

  const characters = useMemo(
    () =>
      [...library.characters].sort(
        (a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))
      ),
    [library.characters]
  )

  const filteredSessions = useMemo(
    () => filterSessions(sessions, chatQuery, ''),
    [sessions, chatQuery]
  )

  const configured = isConnectionReady(connection)
  const activeChannel = findChannelById(inferChannelId(connection))

  const launchCharacterRoom = async (target: Character, customGreeting?: string) => {
    setPreviewChar(null)
    setFreeChatMode(false)
    await selectCharacter(target.id)
    startCharacterSession(
      {
        character: target,
        persona: library.persona,
        preset: library.preset,
      },
      customGreeting
    )
  }

  const launchFreeChat = async () => {
    await selectCharacter(null)
    newChat()
    setFreeChatMode(true)
  }

  const inConversation = activeId !== null || freeChatMode

  const renderConversationScreen = () => {
    const activeChar = session?.tavern?.character
    const title = activeChar?.name || session?.title || tt('general')
    const subTitle = activeChar ? session?.title || '在线相伴中' : '自由对话'
    const hasMemory = Boolean(session?.memory?.trim())

    return (
      <div className={styles.chatScreen}>
        <StageBackdrop />
        <header className={styles.chatTopBar}>
          <button
            type="button"
            className={styles.backBtn}
            aria-label="返回"
            onClick={() => {
              setFreeChatMode(false)
              newChat()
            }}
          >
            <TavernIcon name="chevronLeft" size={20} />
          </button>

          <button
            type="button"
            className={styles.chatIdentity}
            onClick={() => openTavern(activeChar?.id ?? null)}
          >
            <Avatar name={activeChar?.name || '＋'} src={activeChar?.avatar} size="s" />
            <div className={styles.chatIdentityText}>
              <strong>{title}</strong>
              <span>
                <i className={styles.onlineDot} />
                {subTitle}
              </span>
            </div>
          </button>

          <div className={styles.chatTopTools}>
            {session && session.messages.length > 0 ? (
              <button
                type="button"
                className={styles.topIconBtn}
                title="珍藏导出剧本 (.md)"
                onClick={() => downloadStoryMarkdown(session)}
              >
                <IconDownloadOutline16 />
              </button>
            ) : null}
            {session ? (
              <button
                type="button"
                className={clsx(styles.topIconBtn, hasMemory && styles.topIconActive)}
                title={tt('memory')}
                onClick={() => setMemoryOpen(true)}
              >
                <TavernIcon name="book" size={16} />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.topIconBtn}
              title="外观装扮"
              onClick={openAppearanceDrawer}
            >
              <TavernIcon name="palette" size={16} />
            </button>
          </div>
        </header>

        <div className={styles.chatStageArea}>
          {session ? (
            <MessageList
              session={session}
              streaming={streaming}
              footer={
                <div className={styles.mobileInputDock}>
                  {session.messages.length === 0 && activeChar ? (
                    <div className={styles.quickPrompts}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftText(
                            session.id,
                            `*抬眼望向${activeChar.name}，弯起眉眼轻轻笑了笑* 「等很久了吗？」`
                          )
                        }
                      >
                        ✦ 弯眼微笑打招呼
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftText(
                            session.id,
                            `*走近半步在${activeChar.name}身边坐下* 「今天发生好多事，想讲给你听。」`
                          )
                        }
                      >
                        ✦ 在他身旁坐下
                      </button>
                    </div>
                  ) : null}
                  <ChatInput sessionId={session.id} />
                </div>
              }
            />
          ) : (
            <div className={styles.freeChatEmpty}>
              <div className={styles.freeChatGreeting}>
                <img src={appIconImg} alt="" className={styles.freeChatLogo} />
                <h3>自由闲聊</h3>
                <p>不绑定特定角色卡，直接发送消息开始一段新对话。</p>
              </div>
              <div className={styles.mobileInputDock}>
                <ChatInput sessionId={null} />
              </div>
            </div>
          )}
        </div>

        {memoryOpen && session ? (
          <MemoryDialog key={session.id} session={session} onClose={() => setMemoryOpen(false)} />
        ) : null}
      </div>
    )
  }

  return (
    <div className={clsx(styles.outerStage, isNarrowViewport && styles.outerFullscreen)}>
      {!isNarrowViewport ? (
        <>
          <StageBackdrop variant="ambient" />
          <div className={styles.desktopFloatingSwitch}>
            <button type="button" onClick={() => setUIMode('companion')}>
              切换至电脑宽屏版
            </button>
            <button type="button" onClick={() => setUIMode('ds')}>
              DS 经典版
            </button>
            <button type="button" onClick={openAppearanceDrawer}>
              <TavernIcon name="palette" size={14} />
              装扮工坊
            </button>
          </div>
        </>
      ) : null}

      <div className={clsx(styles.phoneFrame, isNarrowViewport && styles.phoneFullscreen)}>
        {/* 桌面模拟器顶部仿真状态栏 */}
        {!isNarrowViewport ? (
          <div className={styles.statusBar} aria-hidden="true">
            <span className={styles.statusClock}>{clock}</span>
            <span className={styles.dynamicIsland} />
            <span className={styles.statusRight}>5G · 100%</span>
          </div>
        ) : null}

        {inConversation ? (
          renderConversationScreen()
        ) : (
          <div className={styles.tabScreen}>
            <StageBackdrop />

            {/* Tab 1: 酒馆发现 */}
            {tab === 'discover' ? (
              <div className={styles.tabScroll}>
                <header className={styles.appHeader}>
                  <div>
                    <h1>猫猫酒馆</h1>
                    <p>推开木门，邂逅只属于你的心动篇章</p>
                  </div>
                  <div className={styles.appHeaderBtns}>
                    <button
                      type="button"
                      className={styles.pillMini}
                      onClick={openAppearanceDrawer}
                    >
                      <TavernIcon name="palette" size={14} />
                      装扮
                    </button>
                    {isNarrowViewport ? (
                      <button
                        type="button"
                        className={styles.pillMini}
                        onClick={() => setUIMode('ds')}
                      >
                        DS版
                      </button>
                    ) : null}
                  </div>
                </header>

                {/* 在线角色快启星环栏 */}
                {characters.length > 0 ? (
                  <div className={styles.storyRings}>
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={styles.ringItem}
                        onClick={() => void launchCharacterRoom(c)}
                      >
                        <span className={styles.ringBorder}>
                          <Avatar name={c.name} src={c.avatar} size="m" />
                        </span>
                        <small>{c.name}</small>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={styles.ringItem}
                      onClick={() => void launchFreeChat()}
                    >
                      <span className={clsx(styles.ringBorder, styles.ringPlus)}>
                        <TavernIcon name="plus" size={18} />
                      </span>
                      <small>自由聊</small>
                    </button>
                  </div>
                ) : null}

                {!configured ? (
                  <button
                    type="button"
                    className={styles.connectCard}
                    onClick={() => openSettings('connection')}
                  >
                    <span>尚未连接模型服务，点击配置后即可对话</span>
                    <TavernIcon name="arrow" size={14} />
                  </button>
                ) : null}

                {/* 双列竖版角色海报流 */}
                <div className={styles.mobileCardGrid}>
                  {characters.map((c) => {
                    const tags = splitTags(c.personality)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={styles.mobilePosterCard}
                        onClick={() => {
                          setSheetGreetingIdx(0)
                          setPreviewChar(c)
                        }}
                      >
                        <Avatar name={c.name} src={c.avatar} size="card" />
                        <div className={styles.posterShade} />
                        {c.favorite ? (
                          <span className={styles.posterFav}>
                            <TavernIcon name="heart" size={12} filled />
                          </span>
                        ) : null}
                        <div className={styles.posterBottom}>
                          <strong>{c.name}</strong>
                          {tags[0] ? <span>#{tags[0]}</span> : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Tab 2: 消息列表 */}
            {tab === 'chats' ? (
              <div className={styles.tabScroll}>
                <header className={styles.appHeader}>
                  <div>
                    <h1>消息篇章</h1>
                    <p>共珍藏 {sessions.length} 段互动回忆</p>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryMiniBtn}
                    onClick={() => void launchFreeChat()}
                  >
                    <TavernIcon name="plus" size={13} />
                    新对话
                  </button>
                </header>

                <label className={styles.mobileSearch}>
                  <TavernIcon name="search" size={14} />
                  <input
                    type="search"
                    placeholder="搜索对话标题或角色名字…"
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                  />
                </label>

                {filteredSessions.length ? (
                  <div className={styles.imList}>
                    {filteredSessions.map((s) => (
                      <div key={s.id} className={styles.imRow}>
                        <button
                          type="button"
                          className={styles.imMain}
                          onClick={() => selectSession(s.id)}
                        >
                          {s.characterName ? (
                            <Avatar
                              name={s.characterName}
                              src={
                                s.characterAvatar ||
                                library.characters.find(
                                  (c) => c.id === s.characterId || c.name === s.characterName
                                )?.avatar
                              }
                              size="m"
                            />
                          ) : (
                            <span className={styles.imBookAvatar}>
                              <TavernIcon name="chat" size={17} />
                            </span>
                          )}
                          <div className={styles.imText}>
                            <div className={styles.imTitleLine}>
                              <strong>{s.title || t('untitledChat')}</strong>
                              {s.pinned ? <TavernIcon name="pin" size={11} /> : null}
                            </div>
                            <span>
                              {s.characterName ? `相伴角色 · ${s.characterName}` : tt('general')}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={styles.imDelBtn}
                          aria-label="删除会话"
                          onClick={() => void removeSession(s.id)}
                        >
                          <IconTrashOutline16 />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <TavernIcon name="chat" size={34} />
                    <p>
                      {chatQuery
                        ? '没有匹配的会话记录'
                        : '还没有消息记录，去「酒馆」挑一位角色开启初遇吧'}
                    </p>
                    <button type="button" onClick={() => setMobileTab('discover')}>
                      前往酒馆挑选角色
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Tab 3: 角色名册与人设 */}
            {tab === 'cast' ? (
              <div className={styles.tabScroll}>
                <header className={styles.appHeader}>
                  <div>
                    <h1>名册与人设</h1>
                    <p>定制你的身份与专属角色卡</p>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryMiniBtn}
                    onClick={() => openTavern()}
                  >
                    <TavernIcon name="plus" size={13} />
                    管理 / 导入
                  </button>
                </header>

                <div
                  className={styles.personaCard}
                  onClick={() => openTavern(library.selectedId, 'persona')}
                >
                  <div className={styles.personaHead}>
                    <span className={styles.personaTag}>{'我的人设 ({{user}})'}</span>
                    <TavernIcon name="edit" size={14} />
                  </div>
                  <strong>{library.persona.name || '我'}</strong>
                  <p>
                    {library.persona.description ||
                      '点击设置你在故事中的名字、性格与身份背景，所有角色都会据此称呼和回应你。'}
                  </p>
                </div>

                <div className={styles.castList}>
                  {characters.map((c) => (
                    <div key={c.id} className={styles.castRow}>
                      <Avatar name={c.name} src={c.avatar} size="m" />
                      <div className={styles.castMeta}>
                        <strong>{c.name}</strong>
                        <span>{c.personality || c.description}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.castEditBtn}
                        onClick={() => openTavern(c.id)}
                      >
                        设定
                      </button>
                      <button
                        type="button"
                        className={styles.castChatBtn}
                        onClick={() => void launchCharacterRoom(c)}
                      >
                        对话
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Tab 4: 我的与装扮设置 */}
            {tab === 'me' ? (
              <div className={styles.tabScroll}>
                <div className={styles.meProfileCard}>
                  <img src={appIconImg} alt="猫猫酒馆" className={styles.meAppLogo} />
                  <div>
                    <h2>猫猫酒馆 · 伴你左右</h2>
                    <p>
                      {configured
                        ? `已连接：${activeChannel ? `${activeChannel.name} · ` : ''}${connection.model}`
                        : '未配置模型连接'}
                    </p>
                  </div>
                  <button type="button" onClick={() => openSettings('connection')}>
                    接口配置
                  </button>
                </div>

                <section className={styles.meSection}>
                  <h3>界面模式切换</h3>
                  <div className={styles.meModeGrid}>
                    <button type="button" onClick={() => setUIMode('companion')}>
                      <strong>电脑宽屏酒馆</strong>
                      <span>大屏立绘与档案栏</span>
                    </button>
                    <button type="button" onClick={() => setUIMode('ds')}>
                      <strong>DeepSeek 原版</strong>
                      <span>极简界面与 6 套主题</span>
                    </button>
                  </div>
                </section>

                <section className={styles.meSection}>
                  <h3>主题皮肤</h3>
                  <div className={styles.meSkinGrid}>
                    {SKINS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={clsx(styles.meSkinBtn, skin === s.id && styles.meSkinActive)}
                        onClick={() => updateAppearance({ skin: s.id })}
                      >
                        <i style={{ background: s.color }} />
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.meSection}>
                  <h3>实景插画壁纸</h3>
                  <div className={styles.meWallRow}>
                    {WALLS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={clsx(
                          styles.meWallItem,
                          wallpaper === w.id && styles.meSkinActive
                        )}
                        onClick={() => updateAppearance({ wallpaper: w.id })}
                      >
                        <span
                          className={styles.meWallThumb}
                          style={
                            w.id !== 'none'
                              ? { backgroundImage: `url("${WALLPAPER_IMAGES[w.id]}")` }
                              : undefined
                          }
                        />
                        <small>{w.name}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.meSection}>
                  <h3>明暗光效与高级装扮</h3>
                  <div className={styles.meLightingRow}>
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={clsx(themePreference === mode && styles.meSkinActive)}
                        onClick={() => setThemePreference(mode)}
                      >
                        {mode === 'light' ? '浅色白昼' : mode === 'dark' ? '微醺夜色' : '跟随系统'}
                      </button>
                    ))}
                  </div>
                  <div className={styles.meBottomLinks}>
                    <button type="button" onClick={() => openGuideHandbook('quickstart')}>
                      <TavernIcon name="book" size={15} />
                      新手教程、角色隐藏彩蛋与玩法图鉴
                    </button>
                    <button type="button" onClick={openAppearanceDrawer}>
                      <TavernIcon name="palette" size={15} />
                      打开完整装扮工坊（自定义壁纸 / 字体 / 气泡）
                    </button>
                    <button type="button" onClick={() => openSettings('data')}>
                      <TavernIcon name="link" size={15} />
                      备份导出、导入与通用设置
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {/* 底部四栏 APP 原生导航 */}
            <nav className={styles.tabBar} aria-label="手机应用主导航">
              {TABS.map((item) => {
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={clsx(styles.tabBtn, active && styles.tabBtnActive)}
                    onClick={() => setMobileTab(item.id)}
                  >
                    <TavernIcon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* 点击角色海报弹出的初遇详情底栏 Sheet */}
            {previewChar ? (
              <div className={styles.sheetMask} onClick={() => setPreviewChar(null)}>
                <div className={styles.characterSheet} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const sheetGreetings = getCharacterGreetings(previewChar).map((g) =>
                      expandMacros(g, previewChar.name, library.persona.name)
                    )
                    const currentGreeting =
                      sheetGreetings[sheetGreetingIdx % Math.max(1, sheetGreetings.length)] ||
                      tt('greetingEmpty')
                    return (
                      <>
                        <div className={styles.sheetBanner}>
                          <Avatar name={previewChar.name} src={previewChar.avatar} size="card" />
                          <div className={styles.sheetBannerShade} />
                          <button
                            type="button"
                            className={styles.sheetClose}
                            onClick={() => setPreviewChar(null)}
                          >
                            <TavernIcon name="close" size={15} />
                          </button>
                          <div className={styles.sheetTitleOverlay}>
                            <h2>{previewChar.name}</h2>
                            <div className={styles.sheetTags}>
                              {splitTags(previewChar.personality).map((tag) => (
                                <span key={tag}>#{tag}</span>
                              ))}
                              {sheetGreetings.length > 1 ? (
                                <button
                                  type="button"
                                  style={{
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    background: 'rgba(0,0,0,0.38)',
                                    color: '#fff',
                                    borderRadius: 999,
                                    padding: '2px 9px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() =>
                                    setSheetGreetingIdx((idx) => (idx + 1) % sheetGreetings.length)
                                  }
                                >
                                  剧本 {(sheetGreetingIdx % sheetGreetings.length) + 1}/
                                  {sheetGreetings.length} · 换一幕 ↻
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className={styles.sheetBody}>
                          {previewChar.scenario ? (
                            <p className={styles.sheetScenario}>
                              {expandMacros(
                                previewChar.scenario,
                                previewChar.name,
                                library.persona.name
                              )}
                            </p>
                          ) : null}
                          <div className={styles.sheetGreeting}>
                            <Markdown
                              content={currentGreeting}
                              loading={false}
                              cacheKey={`sheet-${previewChar.id}-${sheetGreetingIdx}`}
                              disableLink
                            />
                          </div>
                          <div className={styles.sheetActions}>
                            <button
                              type="button"
                              className={styles.sheetSecondary}
                              onClick={() => {
                                const id = previewChar.id
                                setPreviewChar(null)
                                openTavern(id)
                              }}
                            >
                              角色设定
                            </button>
                            <button
                              type="button"
                              className={styles.sheetPrimary}
                              onClick={() => void launchCharacterRoom(previewChar, currentGreeting)}
                            >
                              ✦ 立即开启故事
                            </button>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
