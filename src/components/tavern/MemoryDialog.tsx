import { useState } from 'react'
import type { Session } from '../../services/chat/types.js'
import { saveSessionMemory, useChatStore } from '../../services/chat/store.js'
import { MEMORY_LIMIT } from '../../services/tavern/experience.js'
import { MEMORY_SNIPPET_TEMPLATES } from '../../services/tavern/presets.js'
import { Modal } from '../base/Modal.js'
import { Button } from '../base/Button.js'
import { UnsavedDialog, useUnsavedWarning } from './UnsavedDialog.js'
import { useTavernText } from './text.js'

export const MemoryDialog = ({ session, onClose }: { session: Session; onClose: () => void }) => {
  const t = useTavernText()
  const [memory, setMemory] = useState(session.memory ?? '')
  const [saved, setSaved] = useState(session.memory ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const blocked = useChatStore((s) => Boolean(s.streaming[session.id]) || s.importingHistory)
  const dirty = memory !== saved
  useUnsavedWarning(dirty)
  const close = () => {
    if (!busy) {
      if (dirty) {
        setClosing(true)
      } else {
        onClose()
      }
    }
  }
  const save = async (exit = false) => {
    if (busy || blocked) {
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!(await saveSessionMemory(session.id, memory))) {
        throw new Error(t('saveFailed'))
      }
      setSaved(memory)
      if (exit) {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Modal
        title={t('memory')}
        closable
        className="tavern-memory-dialog"
        onClose={close}
        footer={
          <>
            <span className="tavern-save-state" role="status">
              {blocked
                ? t('stopToEdit')
                : busy
                  ? t('busy')
                  : dirty
                    ? t('unsaved')
                    : saved.trim()
                      ? t('memoryPresent')
                      : ''}
            </span>
            <Button disabled={busy || blocked || !dirty} onClick={() => void save()}>
              {t('save')}
            </Button>
          </>
        }
      >
        <p className="tavern-muted">{t('memoryHint')}</p>
        <div className="tavern-memory-snippets">
          {MEMORY_SNIPPET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              disabled={busy || blocked}
              onClick={() =>
                setMemory((prev) => {
                  const sep = prev.trim() ? '\n' : ''
                  return `${prev}${sep}${tpl.snippet}`.slice(0, MEMORY_LIMIT)
                })
              }
            >
              {tpl.label}
            </button>
          ))}
        </div>
        <label className="tavern-field">
          <span>{session.title || t('memory')}</span>
          <textarea
            autoFocus
            rows={12}
            value={memory}
            maxLength={MEMORY_LIMIT}
            disabled={busy || blocked}
            placeholder={t('memoryPlaceholder')}
            onChange={(e) => setMemory(e.target.value)}
          />
        </label>
        <div className="tavern-memory-count">{t('memoryCount', { count: memory.length })}</div>
        {error ? (
          <p className="tavern-error" role="alert">
            {error}
          </p>
        ) : null}
      </Modal>
      {closing ? (
        <UnsavedDialog
          busy={busy || blocked}
          error={error}
          onCancel={() => setClosing(false)}
          onDiscard={onClose}
          onSave={() => void save(true)}
        />
      ) : null}
    </>
  )
}
