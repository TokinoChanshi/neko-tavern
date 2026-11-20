import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import {
  bindSessionCharacter,
  newChat,
  startCharacterSession,
  useChatStore,
} from '../../services/chat/store.js'
import { toggleInnerMonologue, useAppearance } from '../../services/appearance.js'
import { openGuideHandbook } from '../../services/guide.js'
import { closeTavern, saveLibrary, useTavern } from '../../services/tavern/store.js'
import {
  exportCharacter,
  readCardFile,
  readCharacter,
  type Character,
  type Library,
} from '../../services/tavern/core.js'
import { PRESET_PORTRAITS } from '../../services/tavern/assets.js'
import {
  CHARACTER_TEMPLATES,
  mergeStarterCharacters,
  PERSONA_PRESETS,
  WRITING_STYLE_PRESETS,
} from '../../services/tavern/presets.js'
import { useTavernText } from './text.js'
import { cloneCharacter, readAvatar } from '../../services/tavern/experience.js'
import { Avatar } from './Avatar.js'
import { TavernIcon } from './TavernIcon.js'
import { UnsavedDialog, useUnsavedWarning } from './UnsavedDialog.js'
import './tavern.css'

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="tavern-field">
    <span>{label}</span>
    {children}
  </label>
)

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export const TavernDialog = () => {
  const open = useTavern((s) => s.open)
  return open ? <Editor /> : null
}

const Editor = () => {
  const t = useTavernText()
  const [library, setLibrary] = useState<Library>(() =>
    structuredClone(useTavern.getState().library)
  )
  const [saved, setSaved] = useState(library)
  const [editingId, setEditingId] = useState(() => {
    const requested = useTavern.getState().editingId
    const id = requested === undefined ? library.selectedId : requested
    return library.characters.some((c) => c.id === id) ? id : null
  })
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState<'characters' | 'persona' | 'lore' | 'preset'>(
    () => useTavern.getState().initialTab ?? 'characters'
  )
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const activeId = useChatStore((s) => s.activeId)
  const innerMonologue = useAppearance((s) => s.innerMonologue)
  const boundName = useChatStore((s) =>
    s.activeId ? s.sessionCache[s.activeId]?.tavern?.character.name : undefined
  )
  const blocked = useChatStore(
    (s) => s.importingHistory || Boolean(s.activeId && s.streaming[s.activeId])
  )
  const dirty = library !== saved
  useUnsavedWarning(dirty)

  const requestClose = () => {
    if (busy) {
      return
    }
    if (dirty) {
      setClosing(true)
    } else {
      closeTavern()
    }
  }

  const visibleCharacters = useMemo(
    () =>
      library.characters
        .filter(
          (c) =>
            (!favoritesOnly || c.favorite) &&
            c.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
        )
        .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))),
    [library.characters, favoritesOnly, query]
  )

  const character = library.characters.find((c) => c.id === editingId)

  const updateCharacter = (patch: Partial<Character>) => {
    setStatus('')
    setLibrary((s) => ({
      ...s,
      characters: s.characters.map((c) => (c.id === editingId ? { ...c, ...patch } : c)),
    }))
  }

  const add = (c: Character) => {
    setLibrary((s) => ({ ...s, characters: [...s.characters, c] }))
    setEditingId(c.id)
    setQuery('')
    setFavoritesOnly(false)
    setTab('characters')
    setStatus('')
  }

  const loadStarterCast = () => {
    const merged = mergeStarterCharacters(library.characters)
    if (merged.length === library.characters.length) {
      setStatus(t('startersAllPresent'))
      return
    }
    const firstAdded = merged[library.characters.length]
    setLibrary((s) => ({ ...s, characters: merged }))
    if (firstAdded) {
      setEditingId(firstAdded.id)
    }
    setQuery('')
    setFavoritesOnly(false)
    setTab('characters')
    setStatus(t('startersLoaded'))
  }

  const save = async (action: 'save' | 'start' | 'apply' | 'close') => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      if (library.characters.some((c) => !c.name.trim())) {
        throw new Error(t('unnamedError'))
      }
      const next = action === 'start' ? { ...library, selectedId: character?.id ?? null } : library
      await saveLibrary(next)
      setLibrary(next)
      setSaved(next)
      if (action === 'apply' && activeId) {
        const context = character
          ? { character, persona: library.persona, preset: library.preset }
          : undefined
        if (!(await bindSessionCharacter(activeId, context))) {
          throw new Error(t('applyFailed'))
        }
        setStatus(t('applied'))
      } else if (action === 'start') {
        if (character) {
          startCharacterSession({
            character,
            persona: next.persona,
            preset: next.preset,
          })
        } else {
          newChat()
        }
        closeTavern()
      } else if (action === 'close') {
        closeTavern()
      } else {
        setStatus(t('saved'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const textField = (
    key:
      | 'name'
      | 'description'
      | 'personality'
      | 'scenario'
      | 'greeting'
      | 'examples'
      | 'systemPrompt'
      | 'postHistory',
    label: string,
    placeholder = ''
  ) =>
    character ? (
      <Field label={label}>
        {key === 'name' ? (
          <input
            value={character[key]}
            placeholder={placeholder}
            onChange={(e) => updateCharacter({ [key]: e.target.value })}
          />
        ) : (
          <textarea
            rows={key === 'description' || key === 'greeting' ? 4 : 3}
            value={character[key]}
            placeholder={placeholder}
            onChange={(e) => updateCharacter({ [key]: e.target.value })}
          />
        )}
      </Field>
    ) : null

  return (
    <Modal
      title={t('library')}
      closable
      className="tavern-dialog"
      mainClassName="tavern-main"
      onClose={requestClose}
      footer={
        <div className="tavern-footer">
          <span role="status">{busy ? t('busy') : dirty ? t('unsaved') : status}</span>
          <div className="tavern-actions">
            {activeId ? (
              <Button
                variant="outlined"
                disabled={busy || blocked}
                onClick={() => void save('apply')}
              >
                {t('applyCharacter', {
                  name: character ? character.name.trim() || t('newCharacter') : t('general'),
                })}
              </Button>
            ) : null}
            <Button variant="outlined" disabled={busy} onClick={() => void save('save')}>
              {t('save')}
            </Button>
            <Button disabled={busy || blocked} onClick={() => void save('start')}>
              {character
                ? t('startWith', { name: character.name.trim() || t('newCharacter') })
                : t('start')}
            </Button>
          </div>
        </div>
      }
    >
      {deleting && character ? (
        <Modal
          title={t('remove')}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setDeleting(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setLibrary((s) => ({
                    ...s,
                    selectedId: s.selectedId === character.id ? null : s.selectedId,
                    characters: s.characters.filter((c) => c.id !== character.id),
                  }))
                  setDeleting(false)
                  setEditingId(null)
                }}
              >
                {t('remove')}
              </Button>
            </>
          }
        >
          {t('removeConfirm')}
        </Modal>
      ) : null}
      {closing ? (
        <UnsavedDialog
          busy={busy}
          error={error}
          onCancel={() => setClosing(false)}
          onDiscard={closeTavern}
          onSave={() => void save('close')}
        />
      ) : null}

      <aside className="tavern-rail" aria-label={t('yourCharacters')}>
        <div className="tavern-actions tavern-rail-top-actions">
          <Button
            size="s"
            variant="outlined"
            disabled={busy}
            onClick={() => add(readCharacter({ name: t('newCharacter') }))}
          >
            {t('create')}
          </Button>
          <Button
            size="s"
            variant="outlined"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {t('import')}
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,.png"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) {
              return
            }
            try {
              setBusy(true)
              add(await readCardFile(file))
              setError('')
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(false)
            }
          }}
        />
        <label className="tavern-search">
          <TavernIcon name="search" size={15} />
          <input
            aria-label={t('searchCharacters')}
            placeholder={t('searchCharacters')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tavern-filter-tabs">
          <button
            type="button"
            aria-pressed={!favoritesOnly}
            onClick={() => setFavoritesOnly(false)}
          >
            {t('allCharacters')} <span>{library.characters.length}</span>
          </button>
          <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>
            <TavernIcon name="heart" size={12} filled={favoritesOnly} />
            {t('favorites')}
          </button>
        </div>
        <div className="tavern-character-list">
          {!query && !favoritesOnly ? (
            <button
              type="button"
              disabled={busy}
              className={`tavern-character ${!character ? 'is-selected' : ''}`}
              onClick={() => {
                setEditingId(null)
                setTab('characters')
              }}
            >
              <Avatar name="✦" size="s" />
              <span className="tavern-character-name">{t('general')} · 模板库</span>
            </button>
          ) : null}
          {visibleCharacters.map((c) => (
            <button
              type="button"
              key={c.id}
              disabled={busy}
              className={`tavern-character ${c.id === editingId ? 'is-selected' : ''}`}
              onClick={() => {
                setEditingId(c.id)
                setStatus('')
              }}
            >
              <Avatar name={c.name} src={c.avatar} />
              <span className="tavern-character-name">{c.name.trim() || t('newCharacter')}</span>
              {c.favorite ? <TavernIcon name="heart" size={12} filled /> : null}
            </button>
          ))}
          {!visibleCharacters.length && (query || favoritesOnly) ? (
            <div className="tavern-no-results">
              <p>{t('noMatches')}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setFavoritesOnly(false)
                }}
              >
                {t('resetFilters')}
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="tavern-starter-btn"
          disabled={busy}
          onClick={loadStarterCast}
        >
          <TavernIcon name="sparkle" size={14} />
          <span>{t('loadStarters')}</span>
        </button>
      </aside>

      <section className="tavern-editor">
        {activeId ? (
          <div className="tavern-binding">
            {t('currentCharacter', { name: boundName || t('general') })}
          </div>
        ) : null}
        <div className="tavern-tabs" role="tablist">
          {(['characters', 'persona', 'lore', 'preset'] as const).map((key) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === key}
              key={key}
              onClick={() => setTab(key)}
            >
              {t(key)}
              {key === 'lore' && character?.lore.length ? (
                <em className="tavern-tab-badge">{character.lore.length}</em>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            style={{ marginLeft: 'auto', color: 'var(--dsw-alias-brand-text)' }}
            onClick={() => openGuideHandbook('systems')}
          >
            <TavernIcon name="book" size={13} />
            玩法详解
          </button>
        </div>
        {error ? (
          <div className="tavern-error" role="alert">
            {error}
          </div>
        ) : null}
        <fieldset disabled={busy} className="tavern-fields">
          {tab === 'characters' ? (
            character ? (
              <>
                <div className="tavern-profile">
                  <Avatar name={character.name} src={character.avatar} size="hero" />
                  <div className="tavern-profile-actions">
                    <div className="tavern-actions">
                      <Button
                        size="s"
                        variant="outlined"
                        onClick={() => avatarInput.current?.click()}
                      >
                        {t('uploadAvatar')}
                      </Button>
                      {character.avatar ? (
                        <button
                          type="button"
                          className="tavern-text-button"
                          onClick={() => updateCharacter({ avatar: '' })}
                        >
                          {t('removeAvatar')}
                        </button>
                      ) : null}
                    </div>
                    <span>{t('avatarHint')} · 也可直接选用下方内置立绘或粘贴网络图片 URL</span>
                    <div className="tavern-preset-avatars" aria-label="精选内置立绘">
                      {PRESET_PORTRAITS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          title={item.label}
                          className={`tavern-preset-thumb ${character.avatar === item.id ? 'is-active' : ''}`}
                          onClick={() => updateCharacter({ avatar: item.id })}
                        >
                          <img src={item.src} alt={item.label} />
                        </button>
                      ))}
                    </div>
                    <input
                      className="tavern-url-input"
                      type="url"
                      placeholder="或粘贴免费网络角色图片链接（https://...）"
                      value={character.avatar.startsWith('https://') ? character.avatar : ''}
                      onChange={(e) => updateCharacter({ avatar: e.target.value.trim() })}
                    />
                  </div>
                  <button
                    type="button"
                    className="tavern-favorite-button"
                    aria-pressed={Boolean(character.favorite)}
                    aria-label={t(character.favorite ? 'unfavorite' : 'favorite')}
                    onClick={() => updateCharacter({ favorite: !character.favorite })}
                  >
                    <TavernIcon name="heart" size={19} filled={Boolean(character.favorite)} />
                  </button>
                  <input
                    ref={avatarInput}
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) {
                        return
                      }
                      setBusy(true)
                      try {
                        updateCharacter({ avatar: await readAvatar(file) })
                        setError('')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err))
                      } finally {
                        setBusy(false)
                      }
                    }}
                  />
                </div>
                {textField('name', t('name'), t('namePlaceholder'))}
                {textField('personality', t('personality'), t('personalityPlaceholder'))}
                {textField('description', t('description'), t('descriptionPlaceholder'))}
                {textField('scenario', t('scenario'), t('scenarioPlaceholder'))}
                {textField('greeting', t('greeting'), t('greetingPlaceholder'))}

                {/* 平行初遇开场白剧本（支持在对话前一键翻页切换场景） */}
                <div className="tavern-alt-section">
                  <div className="tavern-alt-head">
                    <span>
                      平行初遇剧本（共 {(character.alternateGreetings?.length ?? 0) + 1}{' '}
                      幕，可在聊天顶栏一键换幕）
                    </span>
                    <button
                      type="button"
                      className="tavern-chip-action"
                      onClick={() =>
                        updateCharacter({
                          alternateGreetings: [...(character.alternateGreetings ?? []), ''],
                        })
                      }
                    >
                      + 新增平行开场白
                    </button>
                  </div>
                  {(character.alternateGreetings ?? []).map((alt, idx) => (
                    <div key={idx} className="tavern-alt-item">
                      <div className="tavern-alt-item-top">
                        <small>平行剧本 #{idx + 2}</small>
                        <button
                          type="button"
                          onClick={() =>
                            updateCharacter({
                              alternateGreetings: (character.alternateGreetings ?? []).filter(
                                (_, n) => n !== idx
                              ),
                            })
                          }
                        >
                          移除此幕
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="写下另一段平行时空或不同情境下的开场白（例如：微醺雨夜篇 / 同居日常篇）…"
                        value={alt}
                        onChange={(e) =>
                          updateCharacter({
                            alternateGreetings: (character.alternateGreetings ?? []).map((v, n) =>
                              n === idx ? e.target.value : v
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <details>
                  <summary>{t('advanced')}</summary>
                  {textField('examples', t('examples'), t('examplesPlaceholder'))}
                  {textField('systemPrompt', t('system'))}
                  {textField('postHistory', t('post'), t('postPlaceholder'))}
                </details>
                <div className="tavern-actions">
                  <Button
                    variant="outlined"
                    onClick={() =>
                      add(cloneCharacter(character, t('copyName', { name: character.name })))
                    }
                  >
                    {t('duplicate')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      downloadJson(`${character.name}.json`, exportCharacter(character))
                    }
                  >
                    {t('export')}
                  </Button>
                  <Button variant="dangerOutlined" onClick={() => setDeleting(true)}>
                    {t('remove')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="tavern-empty-stage">
                <div className="tavern-empty">
                  <TavernIcon name="cat" size={38} />
                  <h3>{t('general')}</h3>
                  <p>{t('generalHint')}</p>
                  <div className="tavern-empty-actions">
                    <Button
                      variant="outlined"
                      onClick={() => add(readCharacter({ name: t('newCharacter') }))}
                    >
                      空白新建角色
                    </Button>
                    <Button variant="outlined" onClick={loadStarterCast}>
                      {t('loadStarters')}
                    </Button>
                  </div>
                </div>

                <div className="tavern-template-section">
                  <div className="tavern-section-caption">
                    ✦ 从馆藏扩展角色或热门人设原型一键创建
                  </div>
                  <div className="tavern-preset-cards">
                    {CHARACTER_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="tavern-preset-card"
                        onClick={() => add(tpl.create())}
                      >
                        <div className="tavern-preset-card-head">
                          <strong>{tpl.title}</strong>
                          <em>{tpl.badge}</em>
                        </div>
                        <span>{tpl.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : null}
          {tab === 'persona' ? (
            <>
              <div className="tavern-template-section">
                <div className="tavern-section-caption">
                  ✦ 快捷身份模板（点击套用后可自由修改名字与细节）
                </div>
                <div className="tavern-preset-cards">
                  {PERSONA_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`tavern-preset-card ${library.persona.name === item.persona.name ? 'is-active' : ''}`}
                      onClick={() => {
                        setStatus('')
                        setLibrary((s) => ({ ...s, persona: { ...item.persona } }))
                      }}
                    >
                      <div className="tavern-preset-card-head">
                        <strong>{item.label}</strong>
                        <em>{item.tag}</em>
                      </div>
                      <span>{item.persona.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label={t('userName')}>
                <input
                  value={library.persona.name}
                  placeholder={t('userNamePlaceholder')}
                  onChange={(e) =>
                    setLibrary((s) => ({ ...s, persona: { ...s.persona, name: e.target.value } }))
                  }
                />
              </Field>
              <Field label={t('userDescription')}>
                <textarea
                  rows={8}
                  value={library.persona.description}
                  placeholder={t('userDescriptionPlaceholder')}
                  onChange={(e) =>
                    setLibrary((s) => ({
                      ...s,
                      persona: { ...s.persona, description: e.target.value },
                    }))
                  }
                />
              </Field>
            </>
          ) : null}
          {tab === 'lore' ? (
            character ? (
              <>
                {character.lore.map((entry, i) => {
                  const edit = (patch: Partial<typeof entry>) =>
                    updateCharacter({
                      lore: character.lore.map((x, n) => (n === i ? { ...x, ...patch } : x)),
                    })
                  return (
                    <div className="tavern-lore" key={entry.id}>
                      <Field label={t('keys')}>
                        <input
                          value={entry.keys.join(', ')}
                          placeholder={t('keysPlaceholder')}
                          onChange={(e) =>
                            edit({ keys: e.target.value.split(/[,，]/).map((x) => x.trim()) })
                          }
                        />
                      </Field>
                      <Field label={t('content')}>
                        <textarea
                          rows={3}
                          value={entry.content}
                          placeholder={t('contentPlaceholder')}
                          onChange={(e) => edit({ content: e.target.value })}
                        />
                      </Field>
                      <div className="tavern-actions">
                        <label className="tavern-check">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => edit({ enabled: e.target.checked })}
                          />
                          {t('enabled')}
                        </label>
                        <label className="tavern-check">
                          <input
                            type="checkbox"
                            checked={entry.constant}
                            onChange={(e) => edit({ constant: e.target.checked })}
                          />
                          {t('constant')}
                        </label>
                        <Field label={t('priority')}>
                          <input
                            type="number"
                            value={entry.priority}
                            onChange={(e) => edit({ priority: Number(e.target.value) })}
                          />
                        </Field>
                        <Button
                          size="s"
                          variant="dangerOutlined"
                          onClick={() =>
                            updateCharacter({
                              lore: character.lore.filter((x) => x.id !== entry.id),
                            })
                          }
                        >
                          {t('deleteEntry')}
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {!character.lore.length ? <p className="tavern-muted">{t('noLore')}</p> : null}
                <Button
                  variant="outlined"
                  onClick={() =>
                    updateCharacter({
                      lore: [
                        ...character.lore,
                        {
                          id: crypto.randomUUID(),
                          keys: [],
                          content: '',
                          enabled: true,
                          constant: false,
                          priority: 0,
                        },
                      ],
                    })
                  }
                >
                  {t('addLore')}
                </Button>
              </>
            ) : (
              <p className="tavern-muted">{t('choose')}</p>
            )
          ) : null}
          {tab === 'preset' ? (
            <>
              <div className="tavern-template-section">
                <div className="tavern-section-caption">
                  ✦ 一键切换叙事文风预设（支持小说感、暧昧拉扯、手机微信短句、深夜哄睡与古风）
                </div>
                <div className="tavern-preset-cards">
                  {WRITING_STYLE_PRESETS.map((styleItem) => {
                    const active = library.preset.system === styleItem.preset.system
                    return (
                      <button
                        key={styleItem.id}
                        type="button"
                        className={`tavern-preset-card ${active ? 'is-active' : ''}`}
                        onClick={() => {
                          setStatus('')
                          setLibrary((s) => ({
                            ...s,
                            preset: { ...s.preset, ...styleItem.preset },
                          }))
                        }}
                      >
                        <div className="tavern-preset-card-head">
                          <strong>{styleItem.name}</strong>
                          <em>{styleItem.badge}</em>
                        </div>
                        <span>{styleItem.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="tavern-monologue-toggle">
                <div>
                  <strong>💭 角色读心小剧场（每轮附带隐秘心声与心率）</strong>
                  <span>开启后，角色每轮回复末尾都会展示此刻未说出口的真实内心 OS 与心动值</span>
                </div>
                <input type="checkbox" checked={innerMonologue} onChange={toggleInnerMonologue} />
              </label>

              <Field label={t('system')}>
                <textarea
                  rows={5}
                  value={library.preset.system}
                  onChange={(e) =>
                    setLibrary((s) => ({ ...s, preset: { ...s.preset, system: e.target.value } }))
                  }
                />
              </Field>
              <Field label={t('post')}>
                <textarea
                  rows={3}
                  value={library.preset.postHistory}
                  placeholder={t('postPlaceholder')}
                  onChange={(e) =>
                    setLibrary((s) => ({
                      ...s,
                      preset: { ...s.preset, postHistory: e.target.value },
                    }))
                  }
                />
              </Field>
              <div className="tavern-grid">
                {(
                  ['contextBudget', 'loreBudget', 'scanDepth', 'maxTokens', 'temperature'] as const
                ).map((key) => (
                  <Field key={key} label={t(key === 'scanDepth' ? 'depth' : key)}>
                    <input
                      type="number"
                      min={
                        key === 'contextBudget'
                          ? 1000
                          : key === 'scanDepth' || key === 'maxTokens'
                            ? 1
                            : 0
                      }
                      max={key === 'temperature' ? 2 : key === 'contextBudget' ? 1000000 : 100000}
                      step={key === 'temperature' ? 0.1 : 1}
                      value={library.preset[key]}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        if (Number.isFinite(value)) {
                          setLibrary((s) => ({ ...s, preset: { ...s.preset, [key]: value } }))
                        }
                      }}
                    />
                  </Field>
                ))}
              </div>
            </>
          ) : null}
        </fieldset>
      </section>
    </Modal>
  )
}
