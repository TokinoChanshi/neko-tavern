import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useAppearance } from '../../services/appearance.js'
import {
  buildMessageVersions,
  getVisibleMessages,
  type MessageVersions,
} from '../../services/chat/branches.js'
import { selectMessageVersion, switchSessionGreeting } from '../../services/chat/store.js'
import { expandMacros, getCharacterGreetings } from '../../services/tavern/core.js'
import type { Message, Session } from '../../services/chat/types.js'
import { Markdown } from '../markdown/Markdown.js'
import { closeSearchPanel } from '../search/searchPanelState.js'
import { Avatar } from '../tavern/Avatar.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { useTavernText } from '../tavern/text.js'
import { AssistantMessage } from './AssistantMessage.js'
import { ScrollToBottomContext } from './scrollContext.js'
import { UserMessage } from './UserMessage.js'
import styles from './MessageList.module.css'

const getUploadRetryId = (messages: Message[], streaming: boolean) => {
  const last = messages.at(-1)
  return !streaming &&
    last?.role === 'assistant' &&
    last.status === 'error' &&
    last.error?.kind === 'upload' &&
    last.error.retryable
    ? last.id
    : null
}

const STICKY_THRESHOLD = 40
const EMPTY_VERSIONS: MessageVersions = { ids: [], index: -1 }

export const MessageList = ({
  session,
  streaming,
  footer,
}: {
  session: Session
  streaming: boolean
  footer: React.ReactNode
}) => {
  const isMobile = useIsMobile()
  const uiMode = useAppearance((s) => s.uiMode)
  const isCompact = isMobile || uiMode === 'mobile'
  const tt = useTavernText()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef(true)
  const scrollTopRef = useRef(0)
  const [showJumpBottom, setShowJumpBottom] = useState(false)
  const restoreScrollRef = useRef<{ messageId: string; top: number } | null>(null)
  const messages = getVisibleMessages(session)
  const [previousVersions, setPreviousVersions] = useState(() =>
    buildMessageVersions(session, new Map())
  )
  const versions = useMemo(
    () => buildMessageVersions(session, previousVersions),
    [session, previousVersions]
  )
  if (versions !== previousVersions) {
    setPreviousVersions(versions)
  }
  const lastMessageId = messages.at(-1)?.id
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el && stickyRef.current) {
      el.scrollTop = el.scrollHeight
      scrollTopRef.current = el.scrollTop
    }
  }, [])

  useLayoutEffect(() => {
    const content = contentRef.current
    const scroll = scrollRef.current
    if (!content || !scroll) {
      return
    }
    const observer = new ResizeObserver(scrollToBottom)
    observer.observe(content)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [isCompact, scrollToBottom])

  useLayoutEffect(() => {
    const anchor = restoreScrollRef.current
    const scroll = scrollRef.current
    if (anchor && scroll) {
      const switcher = scroll.querySelector<HTMLElement>(
        `[data-message-version="${CSS.escape(anchor.messageId)}"]`
      )
      if (switcher) {
        scroll.scrollTop += switcher.getBoundingClientRect().top - anchor.top
      }
      restoreScrollRef.current = null
      return
    }
    stickyRef.current = true
    scrollToBottom()
  }, [session.id, lastMessageId, scrollToBottom])

  useEffect(closeSearchPanel, [session.id, lastMessageId])

  const selectVersion = useCallback(
    (messageId: string, anchorTop: number) => {
      if (streaming) {
        return
      }
      restoreScrollRef.current = { messageId, top: anchorTop }
      stickyRef.current = false
      closeSearchPanel()
      selectMessageVersion(session.id, messageId)
    },
    [session.id, streaming]
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    if (stickyRef.current) {
      scrollToBottom()
    } else {
      el.scrollTop = scrollTopRef.current
    }
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      const nearBottom = distance < STICKY_THRESHOLD
      if (nearBottom) {
        stickyRef.current = true
      } else if (el.scrollTop < scrollTopRef.current) {
        stickyRef.current = false
      }
      setShowJumpBottom(distance > 220)
      scrollTopRef.current = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isCompact, scrollToBottom])

  const lastIndex = messages.length - 1
  const uploadRetryId = getUploadRetryId(messages, streaming)
  const character = session.tavern?.character
  const personaName = session.tavern?.persona.name ?? '我'
  const scenario =
    character && session.tavern ? expandMacros(character.scenario, character.name, personaName) : ''
  const expandedGreetings = useMemo(
    () =>
      character
        ? getCharacterGreetings(character).map((g) => expandMacros(g, character.name, personaName))
        : [],
    [character, personaName]
  )
  const greetingIndex = session.greeting ? expandedGreetings.indexOf(session.greeting) : -1
  const canSwipeGreeting =
    messages.length === 0 && !streaming && expandedGreetings.length > 1 && character !== undefined

  return (
    <ScrollToBottomContext.Provider value={scrollToBottom}>
      <div ref={isCompact ? undefined : scrollRef} className={styles.container}>
        <div ref={isCompact ? scrollRef : undefined} className={styles.scroll}>
          <div ref={contentRef} className={styles.column}>
            {/* 商业陪伴风居中场景序幕条 */}
            {scenario ? (
              <div className="tavern-scene-curtain">
                <span className="tavern-scene-badge">
                  <TavernIcon name="sparkle" size={11} />
                  {tt('prologueBadge')}
                </span>
                <p>{scenario}</p>
              </div>
            ) : null}

            {/* 角色第一条开场白（采用真实左右头像+气泡排版） */}
            {session.greeting ? (
              <div className="tavern-greeting">
                {character ? (
                  <div className="tavern-greeting-avatar">
                    <Avatar name={character.name} src={character.avatar} size="m" />
                  </div>
                ) : null}
                <div className="tavern-greeting-body">
                  {character ? (
                    <div className="tavern-greeting-title">
                      <strong>{character.name}</strong>
                      <span>初见开场</span>
                      {canSwipeGreeting ? (
                        <button
                          type="button"
                          className="tavern-greeting-swipe"
                          onClick={() => {
                            const nextIdx =
                              greetingIndex >= 0
                                ? (greetingIndex + 1) % expandedGreetings.length
                                : 1
                            switchSessionGreeting(session.id, expandedGreetings[nextIdx])
                          }}
                        >
                          剧本 {(greetingIndex >= 0 ? greetingIndex : 0) + 1}/
                          {expandedGreetings.length} · 换一幕 ↻
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="tavern-greeting-bubble">
                    <Markdown
                      content={session.greeting}
                      loading={false}
                      cacheKey={`${session.id}-greeting`}
                      disableLink
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {messages.map((message, index) =>
              message.role === 'user' ? (
                <UserMessage
                  key={message.id}
                  sessionId={session.id}
                  message={message}
                  roleplay={Boolean(character)}
                  retryUploadId={uploadRetryId}
                  isFirst={index === 0 && !session.greeting && !scenario}
                  isLast={index === lastIndex || index === lastIndex - 1}
                  busy={streaming}
                  versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                  onSelectVersion={selectVersion}
                />
              ) : (
                <AssistantMessage
                  key={message.id}
                  sessionId={session.id}
                  message={message}
                  characterName={character?.name}
                  characterAvatar={character?.avatar}
                  isLast={index === lastIndex}
                  streaming={streaming && index === lastIndex}
                  busy={streaming}
                  versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                  onSelectVersion={selectVersion}
                />
              )
            )}
          </div>
        </div>
        {showJumpBottom ? (
          <div className={styles.jumpBottomWrap}>
            <button
              type="button"
              className={styles.jumpBottomBtn}
              onClick={() => {
                stickyRef.current = true
                setShowJumpBottom(false)
                scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: 'smooth',
                })
              }}
            >
              ↓ 回到最新回应
            </button>
          </div>
        ) : null}
        {footer}
      </div>
    </ScrollToBottomContext.Provider>
  )
}
