import clsx from 'clsx'
import { DIRECTOR_INSPIRATIONS } from '../../services/tavern/presets.js'
import { useConnection, useTavern } from '../../services/tavern/store.js'
import { toggleInnerMonologue, useAppearance } from '../../services/appearance.js'
import { useTavernText } from '../tavern/text.js'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  IconGlobeLanguageOutline14,
  IconPaperclipOutline16,
  IconSendOutline16,
  IconStopFill16,
  IconThinkOutline14,
} from '../base/icons.js'
import { setSearch, setThinking, useSettings } from '../../services/settings.js'
import { useIsMobile } from '../../app/viewport.js'
import { sendMessage, stopReply, useChatStore } from '../../services/chat/store.js'
import {
  addDraftFiles,
  EMPTY_DRAFT,
  getDraft,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  setDraftText,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { IconButton } from '../base/IconButton.js'
import { Tooltip } from '../base/Tooltip.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { DragMask, useFileDrop } from './DragMask.js'
import { showToast } from '../base/toastState.js'
import { ACCEPT, useUploads } from '../../services/attachments.js'
import { DraftAttachments } from './DraftAttachments.js'
import { useVoiceInput } from './useVoiceInput.js'
import { VoiceButton } from './VoiceButton.js'
import { Spectrum } from './Spectrum.js'
import { useTranslate } from '../../i18n/index.js'
import styles from './ChatInput.module.css'

/** 输入框：自适应高度文本框 + 陪伴模式动作/台词快捷插入 + 深度思考/搜索开关 + 语音 + 发送 */
export const ChatInput = memo(function ChatInput({ sessionId }: { sessionId: string | null }) {
  return <Input key={sessionId === null ? 'new' : `session:${sessionId}`} sessionId={sessionId} />
})

const Input = ({ sessionId }: { sessionId: string | null }) => {
  const t = useTranslate()
  const tt = useTavernText()
  const uiMode = useAppearance((s) => s.uiMode)
  const innerMonologue = useAppearance((s) => s.innerMonologue)
  const [inspireOpen, setInspireOpen] = useState(false)
  const deepseek = useConnection((s) => s.protocol === 'deepseek')
  const tavernReady = useTavern((s) => s.ready)
  const selectedCharacterName = useTavern((s) => {
    const id = s.library.selectedId
    return id ? s.library.characters.find((c) => c.id === id)?.name : undefined
  })
  const boundCharacterName = useChatStore((s) =>
    sessionId ? s.sessionCache[sessionId]?.tavern?.character.name : undefined
  )
  const activeCharacterName = sessionId ? boundCharacterName : selectedCharacterName
  const roleplay = Boolean(activeCharacterName)
  const draft = useDrafts((state) => state.drafts.get(sessionId) ?? EMPTY_DRAFT)
  const { text, attachments } = draft
  const setText = (value: string) => setDraftText(sessionId, value)
  const draftReady = useUploads((state) => prepareDraftMessage(draft, state.tasks) !== null)
  const streaming = useChatStore(
    (state) => sessionId !== null && Object.hasOwn(state.streaming, sessionId)
  )
  const thinking = useSettings((state) => state.thinking)
  const importingHistory = useChatStore((state) => state.importingHistory)
  const isMobile = useIsMobile()
  const search = useSettings((state) => state.search)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const togglesRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const toggles = togglesRef.current
    if (!toggles) {
      return
    }
    const updateLabels = () => {
      toggles.classList.remove(styles.collapsedToggles)
      toggles.classList.toggle(styles.collapsedToggles, toggles.scrollWidth > toggles.clientWidth)
    }
    updateLabels()
    const observer = new ResizeObserver(updateLabels)
    observer.observe(toggles)
    return () => observer.disconnect()
  }, [t, uiMode, roleplay])

  /** 在光标位置包裹或插入符号对（例如 *动作* 或 「台词」） */
  const insertPair = (open: string, close: string) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    const selected = current.slice(start, end)
    const next = current.slice(0, start) + open + selected + close + current.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      const cursor = selected
        ? start + open.length + selected.length + close.length
        : start + open.length
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  const acceptFiles = (files: File[]) => {
    if (!deepseek) {
      return
    }
    if (files.length === 0 || useChatStore.getState().importingHistory || !ensureApiKey()) {
      return
    }
    const error = addDraftFiles(sessionId, files, useSettings.getState().apiKey ?? '')
    if (error) {
      showToast(error)
    }
  }
  const retryFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory && ensureApiKey()) {
        retryDraftAttachment(sessionId, id, useSettings.getState().apiKey ?? '')
      }
    },
    [sessionId]
  )
  const removeFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory) {
        removeDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const dragging = useFileDrop(acceptFiles)

  const voice = useVoiceInput((transcript) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    setText(current.slice(0, start) + transcript + current.slice(end))
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      textarea?.setSelectionRange(start + transcript.length, start + transcript.length)
    })
  })

  const cancelVoice = voice.cancel
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.importingHistory && !previous.importingHistory) {
          cancelVoice()
        }
      }),
    [cancelVoice]
  )

  const recording = voice.status === 'recording'
  const canSend =
    tavernReady && !importingHistory && !streaming && voice.status === 'idle' && draftReady

  const send = () => {
    if (
      useChatStore.getState().importingHistory ||
      !tavernReady ||
      voice.status !== 'idle' ||
      !prepareDraftMessage(getDraft(sessionId), useUploads.getState().tasks)
    ) {
      return
    }
    if (!ensureApiKey() || !sendMessage(sessionId)) {
      return
    }
    stopReadAloud()
    if (isMobile) {
      textareaRef.current?.blur()
    } else {
      textareaRef.current?.focus()
    }
  }

  const placeholder =
    uiMode === 'ds'
      ? '给 DeepSeek 发送消息'
      : activeCharacterName
        ? tt('roleplayPlaceholder', { name: activeCharacterName })
        : t('chatInputPlaceholderChat')

  return (
    <div
      className={clsx(styles.wrapper, sessionId === null ? styles.home : styles.session)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          textareaRef.current?.focus({ preventScroll: true })
        }
      }}
    >
      <DraftAttachments items={attachments} onRetry={retryFile} onRemove={removeFile} />
      {inspireOpen && roleplay && uiMode !== 'ds' ? (
        <div className={styles.inspireDrawer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.inspireHead}>
            <span>✦ 剧情推进 · 导演灵感小纸条（点击填入输入框，可自由微调）</span>
            <button type="button" onClick={() => setInspireOpen(false)}>
              收起
            </button>
          </div>
          <div className={styles.inspireGrid}>
            {DIRECTOR_INSPIRATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.inspireChip}
                onClick={() => {
                  setText(item.text)
                  setInspireOpen(false)
                  requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }))
                }}
              >
                <em>{item.badge}</em>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={clsx(styles.textarea, recording && isMobile && styles.textareaHidden)}
          placeholder={placeholder}
          rows={2}
          autoFocus={!isMobile}
          disabled={importingHistory}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onMouseDown={(event) => {
            if (isMobile && event.button === 0 && document.activeElement !== event.currentTarget) {
              event.preventDefault()
              event.currentTarget.focus({ preventScroll: true })
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files)
            if (files.length > 0) {
              event.preventDefault()
              acceptFiles(files)
            }
          }}
        />
        {recording && isMobile ? <Spectrum getAnalyser={voice.getAnalyser} /> : null}
        <div className={styles.mirror} aria-hidden>
          {`${text}\n`}
        </div>
      </div>
      <div className={styles.functionRow}>
        <div ref={togglesRef} className={styles.toggles}>
          {deepseek ? (
            <Tooltip content={t('deactivatedThinkTooltip')}>
              <button
                type="button"
                className={clsx(styles.toggle, thinking && styles.selected)}
                aria-label={t('thinkingSwitch')}
                aria-pressed={thinking}
                onClick={() => setThinking(!thinking)}
              >
                <IconThinkOutline14 />
                <span className={styles.toggleLabel}>
                  {uiMode === 'ds' ? '深度思考' : t('thinkingSwitch')}
                </span>
              </button>
            </Tooltip>
          ) : null}
          {deepseek && !roleplay ? (
            <Tooltip content={t('deactivatedSearchTooltip')}>
              <button
                type="button"
                className={clsx(styles.toggle, search && styles.selected)}
                aria-label={t('search')}
                aria-pressed={search}
                onClick={() => setSearch(!search)}
              >
                <IconGlobeLanguageOutline14 />
                <span className={styles.toggleLabel}>
                  {uiMode === 'ds' ? '联网搜索' : t('search')}
                </span>
              </button>
            </Tooltip>
          ) : null}
          {uiMode !== 'ds' && roleplay ? (
            <>
              <button
                type="button"
                className={styles.rpHelper}
                title="插入 *动作与神态描写*"
                onClick={() => insertPair('*', '*')}
              >
                <span>*动作*</span>
              </button>
              <button
                type="button"
                className={styles.rpHelper}
                title="插入「对话台词」"
                onClick={() => insertPair('「', '」')}
              >
                <span>「台词」</span>
              </button>
              <button
                type="button"
                className={clsx(styles.rpHelper, inspireOpen && styles.rpHelperActive)}
                title="展开剧情推进与互动灵感小纸条"
                onClick={() => setInspireOpen((v) => !v)}
              >
                <span>✦ 灵感</span>
              </button>
              <button
                type="button"
                aria-pressed={innerMonologue}
                className={clsx(styles.rpHelper, innerMonologue && styles.rpHelperActive)}
                title="开启后，角色每轮回复末尾将附带未说出口的真实心声与心率"
                onClick={toggleInnerMonologue}
              >
                <span>{innerMonologue ? '💭 读心开' : '💭 读心'}</span>
              </button>
            </>
          ) : null}
        </div>
        <div className={styles.right}>
          {deepseek ? (
            <VoiceButton
              status={voice.status}
              disabled={!voice.available}
              seconds={voice.seconds}
              onClick={() => {
                if (
                  voice.status !== 'idle' ||
                  (!useChatStore.getState().importingHistory && ensureApiKey())
                ) {
                  void voice.toggle()
                }
              }}
            />
          ) : null}
          {deepseek || !roleplay ? (
            <IconButton
              size="m"
              tone="primary"
              icon={<IconPaperclipOutline16 />}
              tooltip={deepseek ? t('uploadFile') : tt('attachNotice')}
              disabled={importingHistory || !deepseek}
              aria-label={deepseek ? t('uploadFile') : tt('attachNotice')}
              onClick={() => ensureApiKey() && fileInputRef.current?.click()}
            />
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={ACCEPT}
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          {streaming && sessionId ? (
            <button
              type="button"
              className={styles.sendButton}
              aria-label={t('chatInputStopButtonTooltip')}
              onClick={() => {
                stopReadAloud()
                stopReply(sessionId)
              }}
            >
              <IconStopFill16 />
            </button>
          ) : (
            <button
              type="button"
              className={clsx(styles.sendButton, !canSend && styles.disabled)}
              aria-label={t('send')}
              aria-disabled={!canSend}
              onClick={send}
            >
              <IconSendOutline16 />
            </button>
          )}
        </div>
      </div>
      {dragging ? <DragMask /> : null}
    </div>
  )
}
