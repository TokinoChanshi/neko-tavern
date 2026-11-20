import clsx from 'clsx'
import { memo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconEditOutline16, IconEllipsisOutline16, IconTrashOutline16 } from '../base/icons.js'
import { renameSession, selectSession, setSessionPinned } from '../../services/chat/store.js'
import { useAppearance } from '../../services/appearance.js'
import { useTavern } from '../../services/tavern/store.js'
import { Avatar } from '../tavern/Avatar.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { useTavernText } from '../tavern/text.js'
import { showToast } from '../base/toastState.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  onDelete: () => void
}) {
  const t = useTranslate()
  const tt = useTavernText()
  const uiMode = useAppearance((s) => s.uiMode)
  const avatar = useTavern(
    (s) =>
      session.characterAvatar ||
      (session.characterId
        ? s.library.characters.find((c) => c.id === session.characterId)?.avatar
        : undefined) ||
      (session.characterName
        ? s.library.characters.find((c) => c.name === session.characterName)?.avatar
        : undefined)
  )
  const [editing, setEditing] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const displayTitle = session.title || t('untitledChat')

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        aria-label={t('sessionItemMenuRenameOption')}
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <div className={clsx(styles.item, active && styles.active)}>
      <button
        type="button"
        className={styles.select}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          selectSession(session.id)
          closeMobileSider()
        }}
      >
        {uiMode === 'ds' ? (
          <span className={styles.title}>{displayTitle}</span>
        ) : (
          <>
            {session.characterName ? (
              <Avatar name={session.characterName} src={avatar} size="xs" />
            ) : (
              <span className={styles.generalIcon}>
                <TavernIcon name="book" size={13} />
              </span>
            )}
            <span className={styles.body}>
              <span className={styles.title}>{displayTitle}</span>
              <span className={styles.character}>
                {session.pinned ? <TavernIcon name="pin" size={10} /> : null}
                {session.characterName || tt('general')}
              </span>
            </span>
          </>
        )}
      </button>
      <div className={styles.action} onClick={(event) => event.stopPropagation()}>
        <Menu
          options={[
            {
              key: 'pin',
              label: tt(session.pinned ? 'unpin' : 'pin'),
              icon: <TavernIcon name="pin" size={16} />,
              onSelect: () => {
                if (pinBusy) {
                  return
                }
                setPinBusy(true)
                void setSessionPinned(session.id, !session.pinned)
                  .then((ok) => {
                    if (!ok) {
                      showToast(tt('saveFailed'))
                    }
                  })
                  .finally(() => setPinBusy(false))
              },
            },
            {
              key: 'rename',
              label: t('sessionItemMenuRenameOption'),
              icon: <IconEditOutline16 />,
              onSelect: () => setEditing(true),
            },
            {
              key: 'delete',
              label: t('delete'),
              icon: <IconTrashOutline16 />,
              danger: true,
              onSelect: onDelete,
            },
          ]}
        >
          {({ toggle }) => (
            <IconButton
              icon={<IconEllipsisOutline16 />}
              aria-label={`${t('more')} · ${displayTitle}`}
              disabled={pinBusy}
              onClick={toggle}
            />
          )}
        </Menu>
      </div>
    </div>
  )
})
