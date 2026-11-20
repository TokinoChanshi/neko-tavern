import clsx from 'clsx'
import { useRef, useState, type ReactNode } from 'react'
import {
  IconDarkOutline16,
  IconDataOutline16,
  IconDownloadOutline16,
  IconFollowsystemOutline16,
  IconLightOutline16,
  IconSettingsOutline16,
  IconUploadOutline14,
} from '../base/icons.js'
import {
  BackupError,
  clearHistory,
  exportHistory,
  exportNativeHistory,
  importHistory,
} from '../../services/chat/backup.js'
import { ConnectionFields, useConnectionEditor } from '../tavern/ConnectionFields.js'
import { downloadJson } from '../tavern/TavernDialog.js'
import { UnsavedDialog, useUnsavedWarning } from '../tavern/UnsavedDialog.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import { useTavernText } from '../tavern/text.js'
import { useChatStore } from '../../services/chat/store.js'
import { regionCodes, getRegionName, provinces } from '../../services/location.js'
import {
  DS_THEMES,
  openAppearanceDrawer,
  setUIMode,
  updateAppearance,
  useAppearance,
  type SkinId,
} from '../../services/appearance.js'
import {
  isChineseBrowser,
  setLocale,
  setLocation,
  setThemePreference,
  setTtsVoice,
  useSettings,
  type ThemePreference,
} from '../../services/settings.js'
import { useTranslate, type TranslationKey, type TranslationMessage } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { Select } from '../base/Select.js'
import { showToast } from '../base/toastState.js'
import { closeSettings, useSettingsDialog, type SettingsSection } from './settingsDialogState.js'
import styles from './Settings.module.css'

/**
 * 设置弹窗：分「外观与通用」（多主题配色、明暗模式、语言、朗读音色、位置）、「模型连接」与「备份与数据」。
 */
export const SettingsDialog = () => {
  const open = useSettingsDialog((state) => state.open)
  return open ? <SettingsContent /> : null
}

const sections: { value: SettingsSection; label: TranslationKey; icon: ReactNode }[] = [
  {
    value: 'general',
    label: 'settingDialogAsideGeneralOptionLabel',
    icon: <IconSettingsOutline16 />,
  },
  {
    value: 'connection',
    label: 'settingDialogAsideConnectionOptionLabel',
    icon: <TavernIcon name="link" size={16} />,
  },
  { value: 'data', label: 'settingDialogAsideDataOptionLabel', icon: <IconDataOutline16 /> },
]

const SettingsContent = () => {
  const t = useTranslate()
  const [section, setSection] = useState(() => useSettingsDialog.getState().section)
  const connectionEditor = useConnectionEditor()
  const [closing, setClosing] = useState(false)
  useUnsavedWarning(connectionEditor.dirty)
  const historyImport = useHistoryImport()
  const historyDelete = useHistoryDelete()
  const replacingHistory = useChatStore((state) => state.importingHistory)
  const historyBusy = historyImport.busy || historyDelete.busy || replacingHistory
  return (
    <>
      <Modal
        title={t('settings')}
        closable
        className={styles.dialog}
        mainClassName={styles.dialogMain}
        onClose={() => {
          if (!historyDelete.busy && !connectionEditor.busy) {
            if (connectionEditor.dirty) {
              setClosing(true)
            } else {
              closeSettings()
            }
          }
        }}
      >
        <div role="tablist" className={styles.navigation}>
          {sections.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={section === item.value}
              className={clsx(styles.navItem, section === item.value && styles.navItemActive)}
              onClick={() => setSection(item.value)}
            >
              {item.icon}
              {t(item.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className={styles.content}>
          {section === 'general' ? (
            <>
              <PaletteSetting />
              <ThemeSetting />
              <LocaleSetting />
              <TtsVoiceSetting />
              <LocationSetting />
            </>
          ) : section === 'connection' ? (
            <ConnectionFields editor={connectionEditor} />
          ) : (
            <>
              <ImportHistory historyImport={historyImport} disabled={historyBusy} />
              <NativeBackup disabled={historyBusy} />
              <ExportHistory disabled={historyBusy} />
              <SettingCell
                label={t('deleteAllSessions')}
                status={null}
                action={
                  <Button
                    variant="dangerOutlined"
                    size="m"
                    className={styles.cellButton}
                    disabled={historyBusy}
                    onClick={historyDelete.open}
                  >
                    {t('delete')}
                  </Button>
                }
              />
            </>
          )}
        </div>
      </Modal>
      {closing ? (
        <UnsavedDialog
          busy={connectionEditor.busy || connectionEditor.streaming}
          error={connectionEditor.error}
          onCancel={() => setClosing(false)}
          onDiscard={closeSettings}
          onSave={() => {
            void connectionEditor.save(false).then((ok) => {
              if (ok) {
                closeSettings()
              }
            })
          }}
        />
      ) : null}
      {historyImport.file ? <ImportConfirm historyImport={historyImport} /> : null}
      {historyDelete.opened ? <DeleteAllConfirm historyDelete={historyDelete} /> : null}
    </>
  )
}

const PALETTE_ITEMS: {
  value: SkinId
  name: string
  desc: string
  preview: string
}[] = [
  { value: 'sakura', name: '樱雾白桃', desc: '甜美晶透 · 玫瑰金', preview: 'preview_rose' },
  { value: 'starlight', name: '深空星夜', desc: '极光雾紫 · 宿命感', preview: 'preview_lilac' },
  { value: 'salon', name: '丝绒红茶', desc: '复古猫咖 · 暖琥珀', preview: 'preview_latte' },
  { value: 'celadon', name: '森屿青提', desc: '烟雨青瓷 · 氧气感', preview: 'preview_celadon' },
]

/** 设置内的快捷主题与装扮工坊入口 */
const PaletteSetting = () => {
  const activeSkin = useAppearance((state) => state.skin)
  const dsSkin = useAppearance((state) => state.dsSkin)
  const uiMode = useAppearance((state) => state.uiMode)
  return (
    <div className={styles.paletteSection}>
      <div className={styles.row} style={{ marginBottom: 12 }}>
        <div className={styles.text} style={{ paddingRight: 12 }}>
          <div className={styles.label}>外观与装扮工坊（三端形态 / DS 专属主题 / 壁纸 / 气泡）</div>
          <div className={styles.description}>
            支持一键切换「宽屏酒馆」「手机 APP 模式」与「DS 经典原版 UI（含 6 款专属主题）」
          </div>
        </div>
        <Button
          size="m"
          onClick={() => {
            closeSettings()
            openAppearanceDrawer()
          }}
        >
          打开装扮工坊
        </Button>
      </div>

      <div className={styles.themeOptions} style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={clsx(styles.themeOption, uiMode === 'companion' && styles.themeOptionSelected)}
          style={{ height: 52, padding: '8px 12px' }}
          onClick={() => setUIMode('companion')}
        >
          宽屏沉浸酒馆
        </button>
        <button
          type="button"
          className={clsx(styles.themeOption, uiMode === 'mobile' && styles.themeOptionSelected)}
          style={{ height: 52, padding: '8px 12px' }}
          onClick={() => {
            closeSettings()
            setUIMode('mobile')
          }}
        >
          手机 APP 模式
        </button>
        <button
          type="button"
          className={clsx(styles.themeOption, uiMode === 'ds' && styles.themeOptionSelected)}
          style={{ height: 52, padding: '8px 12px' }}
          onClick={() => setUIMode('ds')}
        >
          DS 原版经典 UI
        </button>
      </div>

      {uiMode === 'ds' ? (
        <div className={styles.paletteGrid}>
          {DS_THEMES.map((item) => {
            const selected = dsSkin === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={clsx(styles.paletteCard, selected && styles.paletteCardSelected)}
                onClick={() => updateAppearance({ dsSkin: item.id })}
              >
                <span className={styles.palettePreview} style={{ background: item.dotColor }} />
                <span className={styles.paletteMeta}>
                  <strong>{item.name}</strong>
                  <small>{item.tag}</small>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className={styles.paletteGrid}>
          {PALETTE_ITEMS.map((item) => {
            const selected = activeSkin === item.value
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={clsx(styles.paletteCard, selected && styles.paletteCardSelected)}
                onClick={() => updateAppearance({ skin: item.value })}
              >
                <span className={clsx(styles.palettePreview, styles[item.preview])} />
                <span className={styles.paletteMeta}>
                  <strong>{item.name}</strong>
                  <small>{item.desc}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 删除确认保留在设置之上；失败可重试，成功只关闭确认弹窗。 */
const DeleteAllConfirm = ({
  historyDelete,
}: {
  historyDelete: ReturnType<typeof useHistoryDelete>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('deleteAllSessionsModalTitle')}
      className={styles.deleteConfirm}
      onClose={historyDelete.cancel}
      footer={
        <div className={styles.deleteActions} aria-busy={historyDelete.busy}>
          <Button
            variant="outlined"
            autoFocus
            disabled={historyDelete.busy}
            onClick={historyDelete.cancel}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={historyDelete.busy}
            onClick={() => void historyDelete.confirm()}
          >
            {t(historyDelete.busy ? 'historyDeleting' : 'deleteAllSessions')}
          </Button>
        </div>
      }
    >
      {t('deleteAllSessionsModalDescription')}
    </Modal>
  )
}

const useHistoryDelete = () => {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const deleting = useRef(false)

  const confirm = async () => {
    if (deleting.current) {
      return
    }
    deleting.current = true
    setBusy(true)
    try {
      await clearHistory()
      setOpened(false)
      showToast({ key: 'historyDeleted' })
    } catch {
      showToast({ key: 'historyDeleteFailed', type: 'error' })
    } finally {
      deleting.current = false
      setBusy(false)
    }
  }

  return {
    opened,
    busy,
    open: () => setOpened(true),
    cancel: () => {
      if (!deleting.current) {
        setOpened(false)
      }
    },
    confirm,
  }
}

const LocationSetting = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const location = useSettings((state) => state.location)
  const province =
    location?.region === 'CN'
      ? provinces.find((item) => item.code === location.province)
      : undefined

  return (
    <SettingCell
      label={t('settingsLocation')}
      status={null}
      className={styles.locationCell}
      action={
        <div className={styles.locationSelectors}>
          {isChineseBrowser() ? (
            <>
              <Select
                ariaLabel={t('settingsLocationProvince')}
                className={styles.provinceSelect}
                value={province?.code ?? ''}
                placeholder={t('settingsLocationProvince')}
                options={provinces.map((item) => ({ value: item.code, label: item.name }))}
                onChange={(value) => {
                  if (value !== province?.code) {
                    setLocation({ region: 'CN', province: value })
                  }
                }}
              />
              <Select
                ariaLabel={t('settingsLocationCity')}
                className={styles.citySelect}
                value={province ? (location?.city ?? '') : ''}
                disabled={!province?.cities.length}
                placeholder={t('settingsLocationCity')}
                options={
                  province?.cities.map((item) => ({ value: item.code, label: item.name })) ?? []
                }
                onChange={(value) => {
                  if (province) {
                    setLocation({ region: 'CN', province: province.code, city: value })
                  }
                }}
              />
            </>
          ) : (
            <Select
              ariaLabel={t('settingsLocationRegion')}
              className={styles.regionSelect}
              value={location?.region ?? ''}
              placeholder={t('settingsLocationRegion')}
              options={regionCodes
                .map((code) => ({ value: code, label: getRegionName(code, locale) }))
                .sort((a, b) => a.label.localeCompare(b.label, locale))}
              onChange={(value) => setLocation({ region: value })}
            />
          )}
        </div>
      }
    />
  )
}

const LocaleSetting = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  return (
    <SettingCell
      label={t('settingsLocalePreference')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsLocalePreference')}
          value={locale}
          options={[
            { value: 'zh-CN', label: t('settingsLocaleZhCN'), lang: 'zh-CN' },
            { value: 'en-US', label: t('settingsLocaleEnUS'), lang: 'en' },
          ]}
          onChange={setLocale}
        />
      }
    />
  )
}

/** 朗读音色：stella（海星，女声）/ tide（暗潮，男声） */
const TtsVoiceSetting = () => {
  const t = useTranslate()
  const ttsVoice = useSettings((state) => state.ttsVoice)
  return (
    <SettingCell
      label={t('settingsTtsVoice')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsTtsVoice')}
          value={ttsVoice}
          options={[
            { value: 'stella', label: t('settingsTtsVoiceStella') },
            { value: 'tide', label: t('settingsTtsVoiceTide') },
          ]}
          onChange={setTtsVoice}
        />
      }
    />
  )
}

/** 覆盖导入的二次确认，叠在设置弹窗上 */
const ImportConfirm = ({
  historyImport,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('historyImportConfirmTitle')}
      className={styles.importConfirm}
      onClose={historyImport.cancel}
      footer={
        <>
          <Button variant="outlined" size="m" autoFocus onClick={historyImport.cancel}>
            {t('cancel')}
          </Button>
          <Button size="m" onClick={() => void historyImport.confirm()}>
            {t('historyImportConfirm')}
          </Button>
        </>
      }
    >
      <div className={styles.importConfirmText}>{t('historyImportConfirmDescription')}</div>
    </Modal>
  )
}

const themeOptions: { value: ThemePreference; label: TranslationKey; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'avatarMenuSettingsDialogThemeSelectLightOption',
    icon: <IconLightOutline16 />,
  },
  {
    value: 'dark',
    label: 'avatarMenuSettingsDialogThemeSelectDarkOption',
    icon: <IconDarkOutline16 />,
  },
  {
    value: 'system',
    label: 'avatarMenuSettingsDialogThemeSelectSystemOption',
    icon: <IconFollowsystemOutline16 />,
  },
]

const ThemeSetting = () => {
  const t = useTranslate()
  const themePreference = useSettings((state) => state.themePreference)
  const label = t('avatarMenuSettingsDialogThemeItemLabel')
  return (
    <div className={styles.theme}>
      <div className={styles.sectionHeading}>
        <span>{label}</span>
      </div>
      <div role="radiogroup" aria-label={label} className={styles.themeOptions}>
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={themePreference === option.value}
            className={clsx(
              styles.themeOption,
              themePreference === option.value && styles.themeOptionSelected
            )}
            onClick={() => setThemePreference(option.value)}
          >
            {option.icon}
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** `reason` 为失败原因的文案 key，展示时按当前语言翻译后填入 `message` 参数。 */
type Status = (TranslationMessage & { error?: boolean; reason?: TranslationKey }) | null

/** 导出失败附带原因：预期的错误用对应文案作原因，其他错误用错误信息。 */
const errorStatus = (key: TranslationKey, error: unknown): Status => ({
  key,
  ...(error instanceof BackupError
    ? { reason: error.key }
    : { params: { message: error instanceof Error ? error.message : String(error) } }),
  error: true,
})

const SettingCell = ({
  label,
  description,
  status,
  action,
  className,
}: {
  label: string
  description?: string
  status: Status
  action: ReactNode
  className?: string
}) => {
  const t = useTranslate()
  return (
    <div className={clsx(styles.cell, styles.row, className)}>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
        {status || description ? (
          <div className={clsx(styles.description, status?.error && styles.error)}>
            {status
              ? t(status.key, status.reason ? { message: t(status.reason) } : status.params)
              : description}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

const useHistoryImport = () => {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const importing = useRef(false)

  const confirm = async () => {
    if (!file || importing.current) {
      return
    }
    importing.current = true
    setFile(null)
    setBusy(true)
    setStatus(null)
    try {
      const count = await importHistory(file)
      setStatus({ key: count === 1 ? 'historyImportedOne' : 'historyImported', params: { count } })
    } catch (error) {
      setStatus(errorStatus('historyImportFailed', error))
    } finally {
      importing.current = false
      setBusy(false)
    }
  }

  return { file, busy, status, select: setFile, cancel: () => setFile(null), confirm }
}

const ImportHistory = ({
  historyImport,
  disabled,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
  disabled: boolean
}) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <SettingCell
      label={t('historyImport')}
      description={t('historyImportDescription')}
      status={historyImport.status}
      action={
        <>
          <Button
            variant="outlined"
            size="m"
            className={clsx(styles.cellButton, styles.uploadButton)}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <IconUploadOutline14 />
            {t('upload')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                historyImport.select(file)
              }
            }}
          />
        </>
      }
    />
  )
}

const NativeBackup = ({ disabled }: { disabled: boolean }) => {
  const tt = useTavernText()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  return (
    <SettingCell
      label={tt('backup')}
      description={tt('backupDescription')}
      status={status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true)
            setStatus(null)
            try {
              downloadJson(
                `neko-tavern-backup-${new Date().toISOString().slice(0, 10)}.json`,
                await exportNativeHistory()
              )
            } catch (error) {
              setStatus(errorStatus('historyExportFailed', error))
            } finally {
              setBusy(false)
            }
          }}
        >
          <IconDownloadOutline16 />
          {tt('backupDownload')}
        </Button>
      }
    />
  )
}

/** 将全部会话及图片导出为 ZIP 文件并下载 */
const ExportHistory = ({ disabled }: { disabled: boolean }) => {
  const t = useTranslate()
  const empty = useChatStore((state) => state.sessions.length === 0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const onExport = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const { name, blob } = await exportHistory()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (error) {
      setStatus(errorStatus('historyExportFailed', error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingCell
      label={t('exportAllLabel')}
      description={t('historyExportDescription')}
      status={status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          disabled={disabled || busy || empty}
          onClick={() => void onExport()}
        >
          <IconDownloadOutline16 />
          {t('exportAllDownload')}
        </Button>
      }
    />
  )
}
