import clsx from 'clsx'
import { useState } from 'react'
import { openTavern } from '../../services/tavern/store.js'
import { downloadStoryMarkdown } from '../../services/tavern/storyExport.js'
import { IconDownloadOutline16 } from '../base/icons.js'
import {
  DS_THEMES,
  openAppearanceDrawer,
  setUIMode,
  toggleDossier,
  toggleZenMode,
  updateAppearance,
  useAppearance,
} from '../../services/appearance.js'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import type { Session } from '../../services/chat/types.js'
import { StageBackdrop } from '../appearance/StageBackdrop.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MessageList } from '../messages/MessageList.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './SessionView.module.css'
import { Avatar } from '../tavern/Avatar.js'
import { CharacterDossier } from '../tavern/CharacterDossier.js'
import { MemoryDialog } from '../tavern/MemoryDialog.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { useTavernText } from '../tavern/text.js'

/** 会话页：支持「原版 DeepSeek 极简页」与「商业级沉浸陪伴舞台 + 右侧角色档案栏」双形态 */
export const SessionView = ({
  session,
  streaming,
  siderCollapsed,
}: {
  session: Session
  streaming: boolean
  siderCollapsed: boolean
}) => {
  const t = useTranslate()
  const tt = useTavernText()
  const uiMode = useAppearance((s) => s.uiMode)
  const dsSkin = useAppearance((s) => s.dsSkin)
  const dossierOpen = useAppearance((s) => s.dossierOpen)
  const zenMode = useAppearance((s) => s.zenMode)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const isMobile = useIsMobile()
  const title = session.title || t('untitledChat')
  const character = session.tavern?.character
  const hasMemory = Boolean(session.memory?.trim())

  if (uiMode === 'ds') {
    return (
      <div className={styles.dsView}>
        {isMobile ? (
          <MobileHeader title={title} />
        ) : (
          <div className={styles.dsHeader}>
            <div className={clsx(styles.dsTitle, siderCollapsed && styles.dsWithCollapsed)}>
              {title}
            </div>
            <div className={styles.dsHeaderTools}>
              <div className={styles.dsMiniDots} aria-label="DeepSeek 主题快切">
                {DS_THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={`DS 主题：${item.name}`}
                    className={clsx(styles.dsMiniDot, dsSkin === item.id && styles.dsMiniDotOn)}
                    onClick={() => updateAppearance({ dsSkin: item.id })}
                  >
                    <i style={{ background: item.dotColor }} />
                  </button>
                ))}
              </div>
              {character ? (
                <button
                  type="button"
                  className={styles.dsSubtleChip}
                  onClick={() => setMemoryOpen(true)}
                >
                  {character.name} · {tt('memory')}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.dsSubtleChip}
                onClick={() => setUIMode('companion')}
              >
                <TavernIcon name="sparkle" size={12} />
                宽屏酒馆
              </button>
              <button
                type="button"
                className={styles.dsSubtleChip}
                onClick={() => setUIMode('mobile')}
              >
                <TavernIcon name="phone" size={12} />
                手机APP
              </button>
              <button type="button" className={styles.dsSubtleChip} onClick={openAppearanceDrawer}>
                <TavernIcon name="palette" size={13} />
              </button>
            </div>
          </div>
        )}
        <MessageList
          session={session}
          streaming={streaming}
          footer={
            <div className={styles.inputContainer}>
              <ChatInput sessionId={session.id} />
              <div className={styles.caveat}>{t('contentCaveat')}</div>
            </div>
          }
        />
        {memoryOpen ? (
          <MemoryDialog key={session.id} session={session} onClose={() => setMemoryOpen(false)} />
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.view}>
      <StageBackdrop />

      {isMobile ? (
        <>
          <MobileHeader title={title} />
          <div className={styles.mobileBar}>
            <button
              type="button"
              className={styles.characterPill}
              onClick={() => openTavern(character?.id ?? null)}
            >
              <Avatar name={character?.name || '＋'} src={character?.avatar} size="xs" />
              <span className={styles.characterPillName}>{character?.name || tt('general')}</span>
              <TavernIcon name="edit" size={12} />
            </button>
            <button
              type="button"
              className={clsx(styles.toolPill, hasMemory && styles.toolPillActive)}
              onClick={() => setMemoryOpen(true)}
            >
              <TavernIcon name="book" size={14} />
              <span>{tt('memory')}</span>
              {hasMemory ? <i /> : null}
            </button>
            <button
              type="button"
              className={styles.iconPill}
              aria-label="外观装扮"
              onClick={openAppearanceDrawer}
            >
              <TavernIcon name="palette" size={15} />
            </button>
          </div>
        </>
      ) : (
        <header className={styles.header}>
          <div
            className={clsx(
              styles.headerInner,
              siderCollapsed && !zenMode && styles.withCollapsedSider
            )}
          >
            <div className={styles.titleGroup}>
              <button
                type="button"
                className={styles.characterPill}
                onClick={() => openTavern(character?.id ?? null)}
              >
                <Avatar name={character?.name || '＋'} src={character?.avatar} size="s" />
                <div className={styles.characterMeta}>
                  <strong>{character?.name || tt('general')}</strong>
                  <span>{title}</span>
                </div>
              </button>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={clsx(styles.toolPill, hasMemory && styles.toolPillActive)}
                onClick={() => setMemoryOpen(true)}
              >
                <TavernIcon name="book" size={14} />
                <span>{tt('memory')}</span>
                {hasMemory ? <i aria-label={tt('memoryPresent')} /> : null}
              </button>
              {session.messages.length > 0 ? (
                <button
                  type="button"
                  className={styles.iconPill}
                  title="将当前故事导出为轻小说 Markdown 文档珍藏"
                  aria-label="导出剧本"
                  onClick={() => downloadStoryMarkdown(session)}
                >
                  <IconDownloadOutline16 />
                </button>
              ) : null}
              <button
                type="button"
                className={styles.toolPill}
                title="切换至手机陪伴 APP 模式"
                onClick={() => setUIMode('mobile')}
              >
                <TavernIcon name="phone" size={14} />
                <span>APP</span>
              </button>
              <button type="button" className={styles.toolPill} onClick={openAppearanceDrawer}>
                <TavernIcon name="palette" size={14} />
                <span>装扮</span>
              </button>
              <button
                type="button"
                className={clsx(styles.iconPill, zenMode && styles.toolPillActive)}
                title={zenMode ? '退出纯净全屏' : '纯净全屏沉浸阅读'}
                aria-label="纯净全屏模式"
                onClick={toggleZenMode}
              >
                <TavernIcon name="maximize" size={14} />
              </button>
              <button
                type="button"
                className={clsx(styles.iconPill, dossierOpen && !zenMode && styles.toolPillActive)}
                title="展开 / 收起角色档案卡"
                aria-label="角色档案栏"
                onClick={toggleDossier}
              >
                <TavernIcon name="panelRight" size={15} />
              </button>
            </div>
          </div>
        </header>
      )}

      <div className={styles.stageBody}>
        <div className={styles.chatPane}>
          <MessageList
            session={session}
            streaming={streaming}
            footer={
              <div className={styles.inputContainer}>
                <ChatInput sessionId={session.id} />
                <div className={styles.caveat}>{t('contentCaveat')}</div>
              </div>
            }
          />
        </div>
        {!isMobile && dossierOpen && !zenMode ? (
          <CharacterDossier session={session} onOpenMemory={() => setMemoryOpen(true)} />
        ) : null}
      </div>

      {memoryOpen ? (
        <MemoryDialog key={session.id} session={session} onClose={() => setMemoryOpen(false)} />
      ) : null}
    </div>
  )
}
