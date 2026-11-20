import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import {
  isConnectionReady,
  openTavern,
  saveLibrary,
  selectCharacter,
  useConnection,
  useTavern,
} from '../../services/tavern/store.js'
import { findChannelById, inferChannelId } from '../../services/tavern/channels.js'
import { expandMacros, getCharacterGreetings, type Character } from '../../services/tavern/core.js'
import {
  DS_THEMES,
  openAppearanceDrawer,
  setUIMode,
  updateAppearance,
  useAppearance,
} from '../../services/appearance.js'
import { openGuideHandbook } from '../../services/guide.js'
import { setDraftText } from '../../services/chat/drafts.js'
import { selectSession, startCharacterSession, useChatStore } from '../../services/chat/store.js'
import { useTranslate } from '../../i18n/index.js'
import { StageBackdrop } from '../appearance/StageBackdrop.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { Markdown } from '../markdown/Markdown.js'
import { MobileHeader } from './MobileHeader.js'
import { Avatar } from '../tavern/Avatar.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { useTavernText, type TavernTextKey } from '../tavern/text.js'
import { openSettings } from '../settings/settingsDialogState.js'
import styles from './Welcome.module.css'

const getTimeGreetingKey = (): TavernTextKey => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return 'homeMorning'
  }
  if (hour >= 12 && hour < 18) {
    return 'homeAfternoon'
  }
  return 'homeEvening'
}

const splitTags = (text: string): string[] =>
  text
    .split(/[·,，、/|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)

const extractQuoteTeaser = (greeting: string, fallback: string): string => {
  const match = greeting.match(/「([^」]{4,52})」|“([^”]{4,52})”/)
  if (match) {
    return `「${match[1] || match[2]}」`
  }
  const plain = greeting
    .replace(/\*[^*]*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain ? plain.slice(0, 48) : fallback
}

type Icebreaker = { label: string; text: string }

const buildIcebreakers = (character: Character): Icebreaker[] => {
  if (character.name.includes('星回')) {
    return [
      {
        label: '接过热茶轻抿一口',
        text: '*接过温热的白桃乌龙抿了一口，指尖渐渐暖起来* 「你怎么连我晚了几分钟都数着呀？」',
      },
      {
        label: '挠挠三花猫奶盖',
        text: '*伸手轻轻挠了挠吧台边三花猫奶盖的下巴* 「今天确实有点累了，还好酒馆还留着门。」',
      },
      {
        label: '今晚这杯算请客吗',
        text: '「老板特意留门等我，那今晚这杯晚安白桃算不算请客？」',
      },
    ]
  }
  if (character.name.includes('沉渊')) {
    return [
      {
        label: '笑问他耳根怎么红了',
        text: '*乖乖坐到软椅上捧起柑橘热茶，抬头弯起眼睛看他* 「陆老师刚才耳根好像红了哦？」',
      },
      {
        label: '解释忘带雨伞了',
        text: '「雨下得太急忘带伞了……没有打扰你修复星图吧？」',
      },
      {
        label: '轻轻拉住他的衣袖',
        text: '*拉住他的衣袖轻轻晃了一下* 「吹风机我自己来就好，你也快擦擦手别着凉。」',
      },
    ]
  }
  if (character.name.includes('糯米')) {
    return [
      {
        label: '揉揉毛茸茸白猫耳',
        text: '*弯下腰温柔地揉了揉糯米蓬松柔软的白猫耳* 「今天看店辛苦啦，奖励双倍摸头！」',
      },
      {
        label: '收下粉色玻璃弹珠',
        text: '*珍重地收好那颗粉色玻璃弹珠* 「数了三十二朵云呀？今晚给你做小鱼干好不好？」',
      },
      {
        label: '贴着围巾暖暖手',
        text: '*把微凉的手贴在他的围巾边暖了暖* 「怎么一见到我就跑这么急，小心摔着。」',
      },
    ]
  }
  if (character.name.includes('言深')) {
    return [
      {
        label: '在他身旁琴凳坐下',
        text: '*顺着他的力道在琴凳旁坐下，指尖轻轻碰了碰一个白键* 「专门为我熬夜写的？那我可得好好听听。」',
      },
      {
        label: '嘴硬说只是路过',
        text: '「谁躲着偷听了，我明明是光明正大路过！」',
      },
      {
        label: '请他手把手教合奏',
        text: '*偏过头冲他弯起眉眼* 「顾大钢琴家，要不要手把手教我弹完后面那一小节？」',
      },
    ]
  }
  return [
    {
      label: '微笑着打个招呼',
      text: `*抬起眼看向${character.name}，轻轻笑了笑* 「好久不见，今天过得怎么样？」`,
    },
    {
      label: '走近在他身旁坐下',
      text: `*走近半步，在${character.name}身旁坐下* 「刚好路过这里，就想来看看你。」`,
    },
    {
      label: '询问他在想什么',
      text: '「看你好像有心事的样子，愿意和我说说吗？」',
    },
  ]
}

export const Welcome = () => {
  const uiMode = useAppearance((s) => s.uiMode)
  return uiMode === 'ds' ? <DsClassicWelcome /> : <CompanionWelcome />
}

/** 100% 还原原版 DeepSeek 居中极简欢迎页（内置 6 套 DS 极简主题快切圆点） */
const DsClassicWelcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const dsSkin = useAppearance((s) => s.dsSkin)
  const library = useTavern((s) => s.library)
  const character = library.characters.find((c) => c.id === library.selectedId)
  const activeTheme = DS_THEMES.find((item) => item.id === dsSkin) ?? DS_THEMES[0]

  return (
    <div className={styles.dsContainer}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.dsFloatingBar}>
        <div className={styles.dsThemeDots} aria-label="DeepSeek 主题切换">
          {DS_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              title={`DS 主题：${item.name}`}
              aria-pressed={dsSkin === item.id}
              className={clsx(styles.dsDotBtn, dsSkin === item.id && styles.dsDotBtnActive)}
              onClick={() => updateAppearance({ dsSkin: item.id })}
            >
              <i style={{ background: item.dotColor }} />
            </button>
          ))}
          <span className={styles.dsThemeName}>{activeTheme.name}</span>
        </div>

        <div className={styles.modeSegmented}>
          <button type="button" onClick={() => setUIMode('companion')}>
            <TavernIcon name="sparkle" size={12} />
            宽屏酒馆
          </button>
          <button type="button" onClick={() => setUIMode('mobile')}>
            <TavernIcon name="phone" size={12} />
            手机APP
          </button>
          <button type="button" className={styles.modeSegActive} onClick={() => setUIMode('ds')}>
            DS 经典
          </button>
        </div>
        <button
          type="button"
          className={styles.dsToolBtn}
          onClick={openAppearanceDrawer}
          title="外观与装扮工坊"
        >
          <TavernIcon name="palette" size={14} />
          <span>更多主题</span>
        </button>
      </div>

      <div className={styles.dsWelcome}>
        <div className={styles.dsGreeting}>
          {character ? `今天想和 ${character.name} 聊些什么？` : '今天有什么可以帮到你？'}
        </div>
        {character ? (
          <div className={styles.dsRoleHint}>
            <span>当前已选角色：{character.name}</span>
            <button type="button" onClick={() => void selectCharacter(null)}>
              切换为普通对话
            </button>
            <button type="button" onClick={() => openTavern(character.id)}>
              角色库
            </button>
          </div>
        ) : null}
        <ChatInput sessionId={null} />
        {isMobile ? <div className={styles.dsCaveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}

/** 商业级女性向陪伴发现大厅：4 列高定立绘卡 + 底部可展开初见序幕台 */
const CompanionWelcome = () => {
  const t = useTranslate()
  const tt = useTavernText()
  const isMobile = useIsMobile()
  const library = useTavern((s) => s.library)
  const ready = useTavern((s) => s.ready)
  const connection = useConnection()
  const sessions = useChatStore((s) => s.sessions)
  const importing = useChatStore((s) => s.importingHistory)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'fav'>('all')
  const [search, setSearch] = useState('')
  const [prologueExpanded, setPrologueExpanded] = useState(false)
  const [greetingOffsets, setGreetingOffsets] = useState<Record<string, number>>({})

  const characters = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    return [...library.characters]
      .filter((c) => {
        if (filter === 'fav' && !c.favorite) {
          return false
        }
        if (!q) {
          return true
        }
        return `${c.name}\n${c.personality}\n${c.description}`.toLocaleLowerCase().includes(q)
      })
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)))
  }, [library.characters, filter, search])

  const character = library.characters.find((c) => c.id === library.selectedId)
  const allGreetings = useMemo(
    () =>
      character
        ? getCharacterGreetings(character).map((g) =>
            expandMacros(g, character.name, library.persona.name)
          )
        : [],
    [character, library.persona.name]
  )
  const activeGreetingIdx = character
    ? (greetingOffsets[character.id] ?? 0) % Math.max(1, allGreetings.length)
    : 0
  const greeting = allGreetings[activeGreetingIdx] ?? ''
  const scenario = character
    ? expandMacros(character.scenario, character.name, library.persona.name)
    : ''
  const configured = ready && isConnectionReady(connection)
  const activeChannel = findChannelById(inferChannelId(connection))
  const timeGreetingKey = useMemo(getTimeGreetingKey, [])
  const icebreakers = useMemo(() => (character ? buildIcebreakers(character) : []), [character])

  const choose = async (id: string | null) => {
    if (busy || importing) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await selectCharacter(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : tt('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const toggleFavoriteOnCard = async (e: React.MouseEvent, target: Character) => {
    e.stopPropagation()
    if (busy || importing) {
      return
    }
    setBusy(true)
    try {
      await saveLibrary({
        ...library,
        characters: library.characters.map((c) =>
          c.id === target.id ? { ...c, favorite: !c.favorite } : c
        ),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : tt('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.container}>
      <StageBackdrop />
      {isMobile ? <MobileHeader /> : null}

      <div className={styles.scroll}>
        <div className={styles.welcome}>
          {/* 清爽一体的顶部工具栏 */}
          <header className={styles.topBar}>
            <div className={styles.brandHero}>
              <div className={styles.eyebrowRow}>
                <span className={styles.eyebrow}>
                  <TavernIcon name="cat" size={13} />
                  <span>{t('appName')}</span>
                </span>
                <div className={styles.modeSegmented}>
                  <button
                    type="button"
                    className={styles.modeSegActive}
                    onClick={() => setUIMode('companion')}
                  >
                    <TavernIcon name="sparkle" size={12} />
                    宽屏酒馆
                  </button>
                  <button type="button" onClick={() => setUIMode('mobile')}>
                    <TavernIcon name="phone" size={12} />
                    手机APP
                  </button>
                  <button type="button" onClick={() => setUIMode('ds')}>
                    DS 经典
                  </button>
                </div>
              </div>
              <h1>{tt('home')}</h1>
              <p className={styles.subtitle}>{tt(timeGreetingKey)}</p>
            </div>

            <div className={styles.headerControls}>
              <button
                type="button"
                className={styles.studioPill}
                title="新手教程、角色彩蛋与玩法图鉴 (F1 / Ctrl+K)"
                onClick={() => openGuideHandbook('quickstart')}
              >
                <TavernIcon name="book" size={15} />
                <span>新手指南</span>
              </button>
              <button type="button" className={styles.studioPill} onClick={openAppearanceDrawer}>
                <TavernIcon name="palette" size={15} />
                <span>装扮工坊</span>
              </button>
              <button
                type="button"
                className={styles.connection}
                onClick={() => openSettings('connection')}
              >
                <span className={configured ? styles.connectedDot : styles.disconnectedDot} />
                <span>
                  {configured
                    ? `${activeChannel ? `${activeChannel.shortBadge} · ` : ''}${connection.model}`
                    : tt('configure')}
                </span>
              </button>
            </div>
          </header>

          {error ? (
            <p className="tavern-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* 4 列高定竖版角色立绘卡画廊 */}
          <section className={styles.gallerySection} aria-label={tt('yourCharacters')}>
            <div className={styles.galleryToolbar}>
              <div className={styles.filterPills}>
                <button
                  type="button"
                  className={clsx(styles.filterPill, filter === 'all' && styles.filterPillActive)}
                  onClick={() => setFilter('all')}
                >
                  全部角色 <span>{library.characters.length}</span>
                </button>
                <button
                  type="button"
                  className={clsx(styles.filterPill, filter === 'fav' && styles.filterPillActive)}
                  onClick={() => setFilter('fav')}
                >
                  <TavernIcon name="heart" size={12} filled={filter === 'fav'} />
                  特别偏爱
                </button>
              </div>

              <div className={styles.galleryRightTools}>
                {library.characters.length > 2 ? (
                  <label className={styles.inlineSearch}>
                    <TavernIcon name="search" size={13} />
                    <input
                      type="search"
                      placeholder={tt('searchCharacters')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  className={styles.manageBtn}
                  disabled={!ready}
                  onClick={() => openTavern()}
                >
                  <TavernIcon name="plus" size={14} />
                  {tt('browseLibrary')}
                </button>
              </div>
            </div>

            {characters.length ? (
              <div className={styles.portraitGrid}>
                {characters.map((c) => {
                  const selected = c.id === character?.id
                  const tags = splitTags(c.personality)
                  const teaser = extractQuoteTeaser(
                    expandMacros(c.greeting, c.name, library.persona.name),
                    c.description || tt('selectToChat')
                  )
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      className={clsx(styles.portraitCard, selected && styles.portraitCardSelected)}
                      onClick={() => void choose(selected ? null : c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void choose(selected ? null : c.id)
                        }
                      }}
                    >
                      <Avatar name={c.name} src={c.avatar} size="card" />
                      <div className={styles.cardScrim} />

                      {/* 卡片顶部浮标 */}
                      <div className={styles.cardTopRow}>
                        {selected ? (
                          <span className={styles.activeBadge}>✦ 相伴中</span>
                        ) : c.lore.length > 0 ? (
                          <span className={styles.lorePill}>
                            {tt('loreCount', { count: c.lore.length })}
                          </span>
                        ) : (
                          <span />
                        )}
                        <div className={styles.cardQuickBtns}>
                          <button
                            type="button"
                            className={styles.cardIconBtn}
                            title="编辑角色设定"
                            aria-label={`编辑 ${c.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              openTavern(c.id)
                            }}
                          >
                            <TavernIcon name="edit" size={12} />
                          </button>
                          <button
                            type="button"
                            className={clsx(styles.cardIconBtn, c.favorite && styles.cardHeartOn)}
                            title={c.favorite ? tt('unfavorite') : tt('favorite')}
                            aria-label={c.favorite ? tt('unfavorite') : tt('favorite')}
                            onClick={(e) => void toggleFavoriteOnCard(e, c)}
                          >
                            <TavernIcon name="heart" size={13} filled={Boolean(c.favorite)} />
                          </button>
                        </div>
                      </div>

                      {/* 卡片底部立绘信息压字 + 一键开启故事舞台 */}
                      <div className={styles.cardBottomOverlay}>
                        <div className={styles.cardNameLine}>
                          <h3>{c.name}</h3>
                          <button
                            type="button"
                            className={styles.enterRoomBtn}
                            onClick={async (e) => {
                              e.stopPropagation()
                              await choose(c.id)
                              startCharacterSession({
                                character: c,
                                persona: library.persona,
                                preset: library.preset,
                              })
                            }}
                          >
                            进入故事 →
                          </button>
                        </div>
                        {tags.length ? (
                          <div className={styles.cardTagRow}>
                            {tags.slice(0, 2).map((tag) => (
                              <span key={tag}>#{tag}</span>
                            ))}
                          </div>
                        ) : null}
                        <p className={styles.cardQuote}>{teaser}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <button
                type="button"
                className={styles.emptyCard}
                disabled={!ready}
                onClick={() => openTavern()}
              >
                <span className={styles.emptyIcon}>
                  <TavernIcon name="cat" size={28} />
                </span>
                <span>
                  <strong>
                    {search || filter === 'fav' ? tt('noMatches') : tt('browseEmpty')}
                  </strong>
                  <span>{tt('emptyHint')}</span>
                </span>
                <TavernIcon name="arrow" />
              </button>
            )}
          </section>

          {/* 最近故事篇章 */}
          {sessions.length ? (
            <section className={styles.recent} aria-label={tt('recentChats')}>
              <div className={styles.sectionHeaderRow}>
                <h2>
                  {tt('recentChats')} <span>{sessions.length}</span>
                </h2>
              </div>
              <div className={styles.recentList}>
                {sessions.slice(0, 4).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={styles.recentItem}
                    disabled={importing}
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
                        size="s"
                      />
                    ) : (
                      <span className={styles.recentIcon}>
                        <TavernIcon name="book" size={15} />
                      </span>
                    )}
                    <span className={styles.recentBody}>
                      <strong>{s.title || t('untitledChat')}</strong>
                      <small>
                        {s.pinned ? <TavernIcon name="pin" size={11} /> : null}
                        {s.characterName || tt('general')}
                      </small>
                    </span>
                    <span className={styles.continueTag}>继续</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 底部一体化相伴序幕台 + 输入框 */}
      <div className={styles.composer}>
        {!configured && ready ? (
          <div className={styles.setupBanner}>
            <span>{tt('connectFirst')}</span>
            <button type="button" onClick={() => openSettings('connection')}>
              立即连接 <TavernIcon name="arrow" size={12} />
            </button>
          </div>
        ) : null}

        {character ? (
          <div className={styles.stageDock}>
            <div className={styles.dockHeader}>
              <div className={styles.dockAvatarTitle}>
                <Avatar name={character.name} src={character.avatar} size="s" />
                <div className={styles.dockMeta}>
                  <div className={styles.dockNameLine}>
                    <strong>{character.name}</strong>
                    <span className={styles.dockBadge}>初见序幕</span>
                    {scenario ? <small className={styles.dockScenario}>{scenario}</small> : null}
                  </div>
                </div>
              </div>
              <div className={styles.dockActions}>
                {allGreetings.length > 1 ? (
                  <button
                    type="button"
                    className={styles.dockTextBtn}
                    onClick={() => {
                      setPrologueExpanded(true)
                      setGreetingOffsets((prev) => ({
                        ...prev,
                        [character.id]: ((prev[character.id] ?? 0) + 1) % allGreetings.length,
                      }))
                    }}
                  >
                    剧本 {activeGreetingIdx + 1}/{allGreetings.length} ↻
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.dockTextBtn}
                  onClick={() => setPrologueExpanded((v) => !v)}
                >
                  {prologueExpanded ? '收起开场白' : '展开开场白'}
                </button>
                <button
                  type="button"
                  className={styles.dockTextBtn}
                  onClick={() =>
                    startCharacterSession(
                      {
                        character,
                        persona: library.persona,
                        preset: library.preset,
                      },
                      greeting
                    )
                  }
                >
                  进入舞台 →
                </button>
                <button
                  type="button"
                  className={styles.dockTextBtn}
                  disabled={busy || importing}
                  onClick={() => void choose(null)}
                >
                  切回闲聊
                </button>
              </div>
            </div>

            {prologueExpanded ? (
              <div className={styles.dockGreetingFull}>
                <Markdown
                  content={greeting || tt('greetingEmpty')}
                  loading={false}
                  cacheKey={`dock-full-${character.id}-${greeting.length}`}
                  disableLink
                />
              </div>
            ) : (
              <p
                className={styles.dockGreetingCompact}
                onClick={() => setPrologueExpanded(true)}
                title="点击展开完整初见开场白"
              >
                {greeting.replace(/\s+/g, ' ').trim() || tt('greetingEmpty')}
              </p>
            )}

            {icebreakers.length ? (
              <div className={styles.iceRow}>
                <span className={styles.iceHint}>
                  <TavernIcon name="sparkle" size={12} />
                  破冰灵感：
                </span>
                {icebreakers.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.icePill}
                    title={item.text}
                    onClick={() => {
                      setDraftText(null, item.text)
                      requestAnimationFrame(() =>
                        document.querySelector<HTMLTextAreaElement>('textarea')?.focus({
                          preventScroll: true,
                        })
                      )
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <ChatInput sessionId={null} />
        <div className={styles.caveat}>{t('contentCaveat')}</div>
      </div>
    </div>
  )
}
