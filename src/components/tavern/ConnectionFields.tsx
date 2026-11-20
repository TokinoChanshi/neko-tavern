import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Button } from '../base/Button.js'
import { localRequest } from '../../services/local.js'
import {
  API_CHANNEL_PRESETS,
  CHANNEL_CATEGORIES,
  findChannelById,
  inferChannelId,
  type ChannelCategory,
  type ChannelPreset,
} from '../../services/tavern/channels.js'
import {
  isConnectionReady,
  setConnection,
  useConnection,
  type Connection,
} from '../../services/tavern/store.js'
import { useChatStore } from '../../services/chat/store.js'
import { ProtocolSelect } from './ProtocolSelect.js'
import { TavernIcon } from './TavernIcon.js'
import { useTavernText } from './text.js'
import styles from './ConnectionFields.module.css'

type FormState = {
  channelId: string
  protocol: Connection['protocol']
  baseUrl: string
  model: string
  hasApiKey: boolean
  apiKey: string
}

const toFormState = (conn: Connection): FormState => ({
  channelId: inferChannelId(conn),
  protocol: conn.protocol,
  baseUrl: conn.baseUrl,
  model: conn.model,
  hasApiKey: conn.hasApiKey,
  apiKey: '',
})

export const useConnectionEditor = () => {
  const t = useTavernText()
  const [form, setForm] = useState<FormState>(() => toFormState(useConnection.getState()))
  const [baseline, setBaseline] = useState<FormState>(() => toFormState(useConnection.getState()))
  const [clear, setClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const streaming = useChatStore((s) => Object.keys(s.streaming).length > 0)

  const dirty =
    clear ||
    form.channelId !== baseline.channelId ||
    form.protocol !== baseline.protocol ||
    form.baseUrl !== baseline.baseUrl ||
    form.model !== baseline.model ||
    Boolean(form.apiKey)

  const selectChannel = (preset: ChannelPreset) => {
    const saved = useConnection.getState().profiles?.[preset.id]
    setClear(false)
    setError('')
    setStatus('')
    setFetchedModels([])
    if (saved) {
      setForm({
        channelId: preset.id,
        protocol: saved.protocol,
        baseUrl: saved.baseUrl,
        model: saved.model,
        hasApiKey: saved.hasApiKey,
        apiKey: '',
      })
    } else {
      setForm({
        channelId: preset.id,
        protocol: preset.protocol,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
        hasApiKey: false,
        apiKey: '',
      })
    }
  }

  const fetchModels = async () => {
    if (fetchingModels || busy) {
      return
    }
    setFetchingModels(true)
    setError('')
    setStatus('')
    try {
      const res = await localRequest<{ models: string[] }>(
        'connection/models',
        {
          channelId: form.channelId,
          protocol: form.protocol,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        },
        'POST'
      )
      setFetchedModels(res.models)
      setStatus(
        res.models.length
          ? `已从接口获取 ${res.models.length} 个可用模型，点击即可填入`
          : '接口返回成功，但未列出模型，请手动填写模型名'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetchingModels(false)
    }
  }

  const save = async (test: boolean) => {
    if (busy || streaming) {
      return false
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const connection = await localRequest<Connection>(
        'connection',
        {
          channelId: form.channelId,
          protocol: form.protocol,
          baseUrl: form.baseUrl,
          model: form.model,
          ...(clear ? { apiKey: '' } : form.apiKey ? { apiKey: form.apiKey } : {}),
        },
        'PUT'
      )
      setConnection(connection)
      const next = toFormState(connection)
      setForm(next)
      setBaseline(next)
      setClear(false)
      if (test) {
        await localRequest('connection/test', {})
      }
      setStatus(t(test ? 'connected' : 'saved'))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    form,
    setForm,
    clear,
    setClear,
    busy,
    fetchingModels,
    fetchedModels,
    fetchModels,
    selectChannel,
    status,
    error,
    streaming,
    dirty,
    save,
  }
}

export const ConnectionFields = ({
  editor,
}: {
  editor: ReturnType<typeof useConnectionEditor>
}) => {
  const t = useTavernText()
  const activeConnection = useConnection()
  const [category, setCategory] = useState<ChannelCategory>('featured')
  const [channelQuery, setChannelQuery] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [showKey, setShowKey] = useState(false)

  const {
    form,
    setForm,
    clear,
    setClear,
    busy,
    fetchingModels,
    fetchedModels,
    fetchModels,
    selectChannel,
    status,
    error,
    streaming,
    dirty,
    save,
  } = editor

  const activePreset = findChannelById(inferChannelId(activeConnection))
  const currentPreset = findChannelById(form.channelId) ?? API_CHANNEL_PRESETS[0]
  const activeReady = isConnectionReady(activeConnection)
  const savedProfiles = activeConnection.profiles ?? {}
  const savedChannelCount = Object.values(savedProfiles).filter((p) => p.hasApiKey).length

  const visibleChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase()
    return API_CHANNEL_PRESETS.filter((item) => {
      if (q) {
        return `${item.name} ${item.tag} ${item.id} ${item.baseUrl}`.toLowerCase().includes(q)
      }
      if (category === 'featured') {
        return Boolean(item.featured) || item.id === form.channelId
      }
      return item.category === category
    })
  }, [category, channelQuery, form.channelId])

  const filteredFetchedModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase()
    if (!q) {
      return fetchedModels.slice(0, 80)
    }
    return fetchedModels.filter((m) => m.toLowerCase().includes(q)).slice(0, 80)
  }, [fetchedModels, modelFilter])

  return (
    <fieldset className={styles.root} disabled={busy || streaming}>
      {/* 当前生效渠道状态横幅 */}
      <div className={styles.activeBanner}>
        <div className={styles.activeLeft}>
          <span
            className={styles.brandBadge}
            style={{
              background:
                activePreset?.badgeBg ?? 'linear-gradient(135deg, #3964fe 0%, #6366f1 100%)',
            }}
          >
            {activePreset?.shortBadge ?? 'API'}
          </span>
          <div className={styles.activeMeta}>
            <strong>
              <i className={activeReady ? styles.liveDot : styles.idleDot} />
              <span>当前生效：{activePreset?.name ?? '自定义接口'}</span>
            </strong>
            <span>
              模型：{activeConnection.model} · {activeConnection.baseUrl}
            </span>
          </div>
        </div>
        {savedChannelCount > 0 ? (
          <span className={styles.savedCountBadge}>已存 {savedChannelCount} 个渠道密钥</span>
        ) : null}
      </div>

      {/* 渠道分类与搜索 */}
      <div className={styles.filterToolbar}>
        <div className={styles.catTabs}>
          {CHANNEL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={clsx(
                styles.catBtn,
                !channelQuery && category === cat.id && styles.catBtnActive
              )}
              onClick={() => {
                setChannelQuery('')
                setCategory(cat.id)
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <label className={styles.searchBox}>
          <TavernIcon name="search" size={12} />
          <input
            type="search"
            placeholder="搜渠道（火山/OpenCode/Cline…）"
            value={channelQuery}
            onChange={(e) => setChannelQuery(e.target.value)}
          />
        </label>
      </div>

      {/* 19 款主流预设渠道卡片网格（每个渠道独立记忆密钥） */}
      <div className={styles.channelGrid} role="listbox" aria-label="预设模型渠道">
        {visibleChannels.map((item) => {
          const selected = form.channelId === item.id
          const hasSavedKey = Boolean(savedProfiles[item.id]?.hasApiKey)
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={clsx(styles.channelCard, selected && styles.channelCardSelected)}
              onClick={() => selectChannel(item)}
            >
              <span className={styles.cardBadge} style={{ background: item.badgeBg }}>
                {item.shortBadge}
              </span>
              <span className={styles.cardText}>
                <strong>{item.name}</strong>
                <small>{item.tag}</small>
              </span>
              {hasSavedKey ? (
                <i className={styles.keySavedMark} title="该渠道已独立保存 API Key" />
              ) : null}
            </button>
          )
        })}
      </div>

      {/* 选中渠道的参数面板 */}
      <div className={styles.configPanel}>
        <div className={styles.presetHintBox}>
          <div className={styles.presetTitleRow}>
            <strong>{currentPreset.name} · 接入说明</strong>
            {form.hasApiKey ? <span className={styles.savedTag}>● 此渠道已存密钥</span> : null}
          </div>
          <p className={styles.hintText}>{currentPreset.hint}</p>

          {currentPreset.endpoints && currentPreset.endpoints.length > 1 ? (
            <div className={styles.endpointPills}>
              <span className={styles.endpointLabel}>官方端点切换：</span>
              {currentPreset.endpoints.map((ep) => {
                const active =
                  form.baseUrl === ep.baseUrl && (!ep.protocol || form.protocol === ep.protocol)
                return (
                  <button
                    key={`${ep.label}-${ep.protocol ?? ''}`}
                    type="button"
                    className={clsx(styles.endpointBtn, active && styles.endpointBtnActive)}
                    onClick={() =>
                      setForm((s) => ({
                        ...s,
                        baseUrl: ep.baseUrl,
                        protocol: ep.protocol ?? s.protocol,
                      }))
                    }
                  >
                    {ep.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.twoColRow}>
          <div className={styles.fieldBlock}>
            <div className={styles.fieldHeader}>
              <span>{t('protocol')}</span>
            </div>
            <ProtocolSelect
              value={form.protocol}
              disabled={busy || streaming}
              onChange={(protocol) => setForm((s) => ({ ...s, protocol }))}
            />
          </div>

          <label className={styles.fieldBlock}>
            <div className={styles.fieldHeader}>
              <span>{t('address')}</span>
            </div>
            <input
              type="url"
              className={styles.textInput}
              placeholder="https://..."
              value={form.baseUrl}
              onChange={(e) => setForm((s) => ({ ...s, baseUrl: e.target.value }))}
            />
          </label>
        </div>

        {/* 模型名称 + 动态拉取按钮 + 预设推荐胶囊 */}
        <div className={styles.fieldBlock}>
          <div className={styles.fieldHeader}>
            <span>{t('model')}</span>
            <button
              type="button"
              className={styles.inlineActionBtn}
              disabled={fetchingModels || busy || !form.baseUrl.trim()}
              onClick={() => void fetchModels()}
            >
              <TavernIcon name="sparkle" size={12} />
              {fetchingModels ? '正在拉取模型…' : '从接口拉取可用模型'}
            </button>
          </div>
          <input
            className={styles.textInput}
            placeholder={`例如：${currentPreset.defaultModel}`}
            value={form.model}
            onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
          />

          {currentPreset.recommendedModels.length > 0 ? (
            <div className={styles.modelChips}>
              <span className={styles.chipHint}>常用模型快选：</span>
              {currentPreset.recommendedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={clsx(styles.modelChip, form.model === m && styles.modelChipActive)}
                  onClick={() => setForm((s) => ({ ...s, model: m }))}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}

          {fetchedModels.length > 0 ? (
            <div className={styles.fetchedBox}>
              <div className={styles.fetchedTop}>
                <span>接口实测可用模型（共 {fetchedModels.length} 个）：</span>
                {fetchedModels.length > 8 ? (
                  <input
                    type="search"
                    placeholder="过滤模型 ID…"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                  />
                ) : null}
              </div>
              <div className={styles.fetchedList}>
                {filteredFetchedModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={clsx(styles.modelChip, form.model === m && styles.modelChipActive)}
                    onClick={() => setForm((s) => ({ ...s, model: m }))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* API Key 密钥 */}
        <div className={styles.fieldBlock}>
          <div className={styles.fieldHeader}>
            <span>{t('key')}</span>
            {form.channelId === 'opencode' && !form.hasApiKey && !form.apiKey ? (
              <button
                type="button"
                className={styles.inlineActionBtn}
                onClick={() =>
                  setForm((s) => ({ ...s, apiKey: 'public', model: 'x-preview-f-free' }))
                }
              >
                一键填入 public 免密体验
              </button>
            ) : null}
          </div>
          <div className={styles.keyInputWrap}>
            <input
              type={showKey ? 'text' : 'password'}
              className={styles.textInput}
              autoComplete="off"
              placeholder={
                form.hasApiKey ? t('keySaved') : (currentPreset.keyPlaceholder ?? t('keyEmpty'))
              }
              value={form.apiKey}
              onChange={(e) => setForm((s) => ({ ...s, apiKey: e.target.value }))}
            />
            <button
              type="button"
              className={styles.eyeToggle}
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          {form.hasApiKey ? (
            <label className={styles.clearRow}>
              <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} />
              <span>{t('clearKey')}（仅清除当前渠道）</span>
            </label>
          ) : null}
        </div>

        <div className={styles.footerBar}>
          <div className={styles.statusArea}>
            {error ? (
              <p className="tavern-error" role="alert" style={{ margin: 0, padding: 0 }}>
                {error}
              </p>
            ) : (
              <p className={styles.okStatus} role="status">
                {busy ? t('busy') : dirty ? t('unsaved') : status}
              </p>
            )}
          </div>
          <div className={styles.actionBtns}>
            <Button variant="outlined" onClick={() => void save(false)}>
              {t('save')}
            </Button>
            <Button onClick={() => void save(true)}>{t('test')}</Button>
          </div>
        </div>
      </div>
    </fieldset>
  )
}
