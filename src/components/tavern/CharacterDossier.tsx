import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveAvatarUrl } from '../../services/tavern/assets.js'
import { expandMacros } from '../../services/tavern/core.js'
import { openTavern } from '../../services/tavern/store.js'
import { downloadStoryMarkdown } from '../../services/tavern/storyExport.js'
import { toggleDossier } from '../../services/appearance.js'
import type { Session } from '../../services/chat/types.js'
import { IconDownloadOutline16 } from '../base/icons.js'
import { Avatar } from './Avatar.js'
import { TavernIcon } from './TavernIcon.js'
import { useTavernText } from './text.js'
import styles from './CharacterDossier.module.css'

const splitTraits = (text: string): string[] =>
  text
    .split(/[·,，、/|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)

/** 商业级右侧角色档案抽屉：支持立绘高清灯箱欣赏、剧本珍藏导出、世界书触发词与心事手札速览 */
export const CharacterDossier = ({
  session,
  onOpenMemory,
}: {
  session: Session
  onOpenMemory: () => void
}) => {
  const tt = useTavernText()
  const [zoomOpen, setZoomOpen] = useState(false)
  const context = session.tavern
  const character = context?.character
  const personaName = context?.persona.name || '我'

  useEffect(() => {
    if (!zoomOpen) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomOpen])

  if (!character) {
    return (
      <aside className={styles.dossier} aria-label={tt('library')}>
        <div className={styles.topRow}>
          <span>会话档案</span>
          <button
            type="button"
            className={styles.iconClose}
            aria-label="收起档案栏"
            onClick={toggleDossier}
          >
            <TavernIcon name="close" size={15} />
          </button>
        </div>
        <div className={styles.emptyBox}>
          <TavernIcon name="cat" size={32} />
          <strong>{tt('general')}</strong>
          <p>当前为自由对话，绑定角色后可在此查看角色立绘、场景与世界书词条。</p>
          <button type="button" className={styles.actionBtn} onClick={() => openTavern()}>
            选择并绑定角色
          </button>
          {session.messages.length > 0 ? (
            <button
              type="button"
              className={styles.exportStoryBtn}
              onClick={() => downloadStoryMarkdown(session)}
            >
              <IconDownloadOutline16 />
              导出对话纪念 (.md)
            </button>
          ) : null}
        </div>
      </aside>
    )
  }

  const traits = splitTraits(character.personality)
  const scenario = expandMacros(character.scenario, character.name, personaName)
  const activeLore = character.lore.filter((e) => e.enabled)
  const fullPortraitUrl = resolveAvatarUrl(character.avatar)

  return (
    <aside className={styles.dossier} aria-label={character.name}>
      <div className={styles.topRow}>
        <span>角色羁绊档案</span>
        <button
          type="button"
          className={styles.iconClose}
          aria-label="收起档案栏"
          onClick={toggleDossier}
        >
          <TavernIcon name="close" size={15} />
        </button>
      </div>

      <div className={styles.scroll}>
        <div className={styles.heroCard}>
          <div
            className={styles.portraitWrap}
            role={fullPortraitUrl ? 'button' : undefined}
            tabIndex={fullPortraitUrl ? 0 : undefined}
            title={fullPortraitUrl ? '点击欣赏高清角色立绘' : undefined}
            onClick={() => {
              if (fullPortraitUrl) {
                setZoomOpen(true)
              }
            }}
            onKeyDown={(e) => {
              if (fullPortraitUrl && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                setZoomOpen(true)
              }
            }}
          >
            <Avatar name={character.name} src={character.avatar} size="card" />
            {fullPortraitUrl ? <span className={styles.zoomHint}>高清立绘</span> : null}
          </div>
          <div className={styles.heroBody}>
            <div className={styles.nameRow}>
              <h3>{character.name}</h3>
              {character.favorite ? (
                <span className={styles.favBadge}>
                  <TavernIcon name="heart" size={12} filled />
                </span>
              ) : null}
            </div>
            {traits.length ? (
              <div className={styles.tags}>
                {traits.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => openTavern(character.id)}
              >
                <TavernIcon name="edit" size={12} />
                编辑设定
              </button>
              <button
                type="button"
                className={styles.editLink}
                title="将本场故事导出为轻小说 Markdown 文档珍藏"
                onClick={() => downloadStoryMarkdown(session)}
              >
                <IconDownloadOutline16 />
                珍藏剧本
              </button>
            </div>
          </div>
        </div>

        {scenario ? (
          <section className={styles.cardSection}>
            <div className={styles.cardHeader}>
              <TavernIcon name="sparkle" size={13} />
              <span>当前故事场景</span>
            </div>
            <p className={styles.cardText}>{scenario}</p>
          </section>
        ) : null}

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <TavernIcon name="book" size={13} />
            <span>{tt('memory')}</span>
            <button type="button" className={styles.miniBtn} onClick={onOpenMemory}>
              编辑
            </button>
          </div>
          <p className={styles.cardText}>
            {session.memory?.trim()
              ? session.memory.trim()
              : '尚未记录羁绊事件或专属约定，点击右上角「编辑」随时补充。'}
          </p>
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <TavernIcon name="star" size={13} />
            <span>世界书设定 ({activeLore.length})</span>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => openTavern(character.id, 'lore')}
            >
              管理
            </button>
          </div>
          {activeLore.length ? (
            <div className={styles.loreChips}>
              {activeLore.map((entry) => (
                <span key={entry.id} className={styles.loreChip}>
                  {entry.constant
                    ? '常驻设定'
                    : entry.keys.filter(Boolean).slice(0, 2).join(' / ') || '未设关键词'}
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.cardMuted}>暂无启用的世界书词条</p>
          )}
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <TavernIcon name="heart" size={13} />
            <span>当前身份：{personaName}</span>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => openTavern(character.id, 'persona')}
            >
              修改
            </button>
          </div>
          {context.persona.description ? (
            <p className={styles.cardText}>{context.persona.description}</p>
          ) : (
            <p className={styles.cardMuted}>可在酒馆名册 →「我的人设」中完善你的身份背景</p>
          )}
        </section>
      </div>

      {zoomOpen && fullPortraitUrl
        ? createPortal(
            <div className={styles.lightbox} onClick={() => setZoomOpen(false)}>
              <div className={styles.lightboxCard} onClick={(e) => e.stopPropagation()}>
                <img src={fullPortraitUrl} alt={character.name} />
                <div className={styles.lightboxFooter}>
                  <div>
                    <strong>{character.name}</strong>
                    {character.personality ? <span>{character.personality}</span> : null}
                  </div>
                  <button type="button" onClick={() => setZoomOpen(false)}>
                    关闭欣赏
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </aside>
  )
}
