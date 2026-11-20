import { useEffect } from 'react'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { useTavernText } from './text.js'

export const useUnsavedWarning = (dirty: boolean) => {
  useEffect(() => {
    if (!dirty) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}

export const UnsavedDialog = ({
  busy,
  error,
  onSave,
  onDiscard,
  onCancel,
}: {
  busy: boolean
  error?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) => {
  const t = useTavernText()
  return (
    <Modal
      title={t('unsavedTitle')}
      onClose={() => !busy && onCancel()}
      footer={
        <div className="tavern-unsaved-actions">
          <Button variant="outlined" disabled={busy} onClick={onCancel}>
            {t('keepEditing')}
          </Button>
          <Button variant="outlined" disabled={busy} onClick={onDiscard}>
            {t('discard')}
          </Button>
          <Button disabled={busy} onClick={onSave}>
            {t(busy ? 'busy' : 'saveAndClose')}
          </Button>
        </div>
      }
    >
      <p>{t('unsavedDescription')}</p>
      {error ? (
        <p className="tavern-error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}
