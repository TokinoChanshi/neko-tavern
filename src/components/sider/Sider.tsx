import clsx from 'clsx'
import { openTavern, useTavern } from '../../services/tavern/store.js'
import { openAppearanceDrawer, setUIMode, useAppearance } from '../../services/appearance.js'
import { openGuideHandbook } from '../../services/guide.js'
import { useTavernText } from '../tavern/text.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { filterSessions } from '../../services/tavern/experience.js'
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconPanelLeftOutline16, IconSettingsOutline16, NewChatIcon } from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import { newChat, removeSession, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Select } from '../base/Select.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

/** 侧边栏：自动适配「原版 DeepSeek 经典侧栏」与「商业级猫猫酒馆陪伴侧栏」 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const tt = useTavernText()
  const uiMode = useAppearance((s) => s.uiMode)
  const tavernReady = useTavern((s) => s.ready)
  const characterCount = useTavern((s) => s.library.characters.length)
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [characterId, setCharacterId] = useState('')

  const filtered = useMemo(
    () => (uiMode === 'ds' ? sessions : filterSessions(sessions, query, characterId)),
    [uiMode, sessions, query, characterId]
  )
  const pinned = uiMode === 'ds' ? [] : filtered.filter((session) => session.pinned)
  const groups = useMemo(
    () =>
      groupSessions(
        uiMode === 'ds' ? filtered : filtered.filter((session) => !session.pinned),
        now,
        t
      ),
    [uiMode, filtered, now, t]
  )
  const characterOptions = useMemo(
    () => [
      ...new Map(
        sessions.flatMap((s) =>
          s.characterId ? [[s.characterId, s.characterName ?? ''] as const] : []
        )
      ).entries(),
    ],
    [sessions]
  )
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div className={clsx(styles.sider, uiMode === 'ds' && styles.dsSider, mobile && styles.mobile)}>
      {uiMode === 'ds' ? (
        <>
          <div className={styles.dsTop}>
            <div className={styles.dsAppName}>deepseek</div>
            <IconButton
              size="m"
              icon={<IconPanelLeftOutline16 />}
              tooltip={t('collapseSiderbarButton')}
              tooltipPlacement="bottom"
              onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
            />
          </div>
          <button
            type="button"
            className={styles.dsNewChat}
            onClick={() => {
              newChat()
              closeMobileSider()
            }}
          >
            <span className={styles.newChatIcon}>
              <NewChatIcon />
            </span>
            开启新对话
          </button>
        </>
      ) : (
        <>
          <div className={styles.top}>
            <button
              type="button"
              className={styles.brandButton}
              onClick={() => {
                newChat()
                closeMobileSider()
              }}
            >
              <span className={styles.brandBadge}>
                <TavernIcon name="cat" size={16} />
              </span>
              <span className={styles.appName}>{t('appName')}</span>
            </button>
            <IconButton
              size="m"
              icon={<IconPanelLeftOutline16 />}
              tooltip={t('collapseSiderbarButton')}
              tooltipPlacement="bottom"
              onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
            />
          </div>

          <div className={styles.primaryActions}>
            <button
              type="button"
              className={styles.newChat}
              onClick={() => {
                newChat()
                closeMobileSider()
              }}
            >
              <span className={styles.newChatIcon}>
                <NewChatIcon />
              </span>
              {t('newChat')}
            </button>
            <div className={styles.dualQuickRow}>
              <button
                type="button"
                className={styles.quickCard}
                disabled={!tavernReady}
                onClick={() => {
                  closeMobileSider()
                  openTavern()
                }}
              >
                <TavernIcon name="sparkle" size={14} />
                <span>{tt('library')}</span>
                {tavernReady ? <em>{characterCount}</em> : null}
              </button>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => {
                  closeMobileSider()
                  openAppearanceDrawer()
                }}
              >
                <TavernIcon name="palette" size={14} />
                <span>装扮工坊</span>
              </button>
            </div>
          </div>
        </>
      )}

      <div className={styles.listWrap}>
        {uiMode === 'companion' && (sessions.length > 0 || query || characterId) ? (
          <div className={styles.filters}>
            <label className={styles.search}>
              <TavernIcon name="search" size={14} />
              <input
                type="search"
                aria-label={tt('searchChats')}
                placeholder={tt('searchChats')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {characterOptions.length > 0 || characterId ? (
              <Select
                ariaLabel={tt('allCharacters')}
                className={styles.characterFilter}
                value={characterId}
                onChange={setCharacterId}
                options={[
                  { value: '', label: tt('allCharacters') },
                  { value: 'general', label: tt('general') },
                  ...characterOptions.map(([id, name]) => ({ value: id, label: name })),
                ]}
              />
            ) : null}
          </div>
        ) : null}

        <div className={styles.list}>
          {pinned.length ? (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <TavernIcon name="pin" size={11} />
                {tt('pinned')}
              </div>
              {pinned.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ) : null}
          {groups.map((group) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>{group.label}</div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ))}
          {uiMode === 'companion' && !filtered.length ? (
            <div className={styles.empty}>
              {query || characterId ? (
                <>
                  <span>{tt('noMatches')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setCharacterId('')
                    }}
                  >
                    {tt('resetFilters')}
                  </button>
                </>
              ) : (
                <span>{tt('noRecent')}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.bottom}>
        <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
          <span className={styles.settingsIcon}>
            <IconSettingsOutline16 />
          </span>
          <span className={styles.settingsLabel}>{uiMode === 'ds' ? '设置' : t('settings')}</span>
        </button>
        <button
          type="button"
          className={styles.modeQuickSwitch}
          title="打开新手教程与玩法图鉴 (快捷键 F1 / Ctrl+K)"
          onClick={() => {
            closeMobileSider()
            openGuideHandbook('quickstart')
          }}
        >
          指南
        </button>
        <button
          type="button"
          className={styles.modeQuickSwitch}
          title="切换至手机 APP 陪伴模式"
          onClick={() => {
            closeMobileSider()
            setUIMode('mobile')
          }}
        >
          APP
        </button>
        <button
          type="button"
          className={styles.modeQuickSwitch}
          title={uiMode === 'ds' ? '切换至猫猫酒馆陪伴界面' : '切换至原版 DeepSeek 经典界面'}
          onClick={() => setUIMode(uiMode === 'ds' ? 'companion' : 'ds')}
        >
          {uiMode === 'ds' ? '✦ 酒馆' : 'DS'}
        </button>
      </div>

      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
