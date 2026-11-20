import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { normalizeBaseUrl, VALID_PROTOCOLS } from './provider.mjs'

const own = (obj, key) => Object.hasOwn(obj, key)
const summary = ({ id, title, createdAt, updatedAt, pinned, tavern }) => {
  const rawAvatar = tavern?.character?.avatar
  return {
    id,
    title,
    createdAt,
    updatedAt,
    pinned: pinned ?? false,
    characterId: tavern?.character?.id,
    characterName: tavern?.character?.name,
    ...(typeof rawAvatar === 'string' && rawAvatar.length > 0 && rawAvatar.length <= 512
      ? { characterAvatar: rawAvatar }
      : {}),
  }
}
const blank = () => ({ version: 1, sessions: {}, files: {}, tavern: null })
const defaults = {
  channelId: 'deepseek',
  protocol: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  apiKey: '',
  profiles: {},
}
const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}
const atomicJson = async (file, value) => {
  const temp = `${file}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 })
  await rename(temp, file)
}
const idCheck = (id) => {
  if (
    typeof id !== 'string' ||
    !id ||
    id.length > 256 ||
    ['__proto__', 'constructor', 'prototype'].includes(id)
  )
    throw new Error('Invalid record ID')
  return id
}
const validSession = (s) => {
  idCheck(s?.id)
  if (
    !Array.isArray(s.messages) ||
    typeof s.title !== 'string' ||
    !Number.isFinite(s.createdAt) ||
    !Number.isFinite(s.updatedAt) ||
    (s.pinned !== undefined && typeof s.pinned !== 'boolean') ||
    (s.memory !== undefined && (typeof s.memory !== 'string' || s.memory.length > 20000))
  )
    throw new Error('Invalid conversation')
  return structuredClone(s)
}

export async function createStorage(directory) {
  await mkdir(join(directory, 'blobs'), { recursive: true })
  const statePath = join(directory, 'state.json')
  const configPath = join(directory, 'connection.json')
  let state = await readJson(statePath, blank())
  if (state.version !== 1 || !state.sessions || !state.files)
    throw new Error('Unsupported local database')
  let connection = await readJson(configPath, defaults)
  let staging = { sessions: {}, files: {} }
  let queue = Promise.resolve()
  const enqueue = (work) => {
    const task = queue.then(work)
    queue = task.catch(() => {})
    return task
  }
  const saveFiles = async (target, files = []) => {
    for (const file of files) {
      idCheck(file.id)
      if (typeof file.data !== 'string' || typeof file.type !== 'string')
        throw new Error('Invalid attachment')
      const bytes = Buffer.from(file.data, 'base64')
      const hash = createHash('sha256').update(bytes).digest('hex')
      await writeFile(join(directory, 'blobs', hash), bytes, { mode: 0o600 })
      target[file.id] = { hash, type: file.type }
    }
  }
  const run = (operation, args = {}) =>
    enqueue(async () => {
      if (operation === 'exportBackup') {
        const files = []
        for (const [id, file] of Object.entries(state.files))
          files.push({
            id,
            type: file.type,
            data: (await readFile(join(directory, 'blobs', file.hash))).toString('base64'),
          })
        return {
          format: 'mengnan-backup',
          version: 1,
          sessions: Object.values(state.sessions),
          files,
          tavern: state.tavern,
        }
      }
      if (operation === 'loadSessionSummaries') return Object.values(state.sessions).map(summary)
      if (operation === 'loadSession')
        return own(state.sessions, args.id) ? structuredClone(state.sessions[args.id]) : null
      if (operation === 'loadFile') {
        if (!own(state.files, args.id)) return null
        const file = state.files[args.id]
        return {
          data: (await readFile(join(directory, 'blobs', file.hash))).toString('base64'),
          type: file.type,
        }
      }
      if (operation === 'clearStaging') {
        staging = { sessions: {}, files: {} }
        return null
      }
      if (operation === 'addStagingSession') {
        const s = validSession(args.session)
        if (own(staging.sessions, s.id)) throw new Error('Duplicate staged conversation')
        staging.sessions[s.id] = s
        return null
      }
      if (operation === 'saveStagingFiles') {
        await saveFiles(staging.files, args.files)
        return null
      }
      if (operation === 'stageTavern') {
        staging.tavern = structuredClone(args.library)
        return null
      }
      if (operation === 'updateStagingFileTypes') {
        const types = new Map(args.types)
        for (const session of Object.values(staging.sessions)) {
          for (const msg of session.messages) {
            for (const f of msg.files ?? []) if (types.has(f.id)) f.mimeType = types.get(f.id)
          }
        }
        return null
      }
      const next = structuredClone(state)
      let result = null
      switch (operation) {
        case 'saveSession': {
          const s = validSession(args.session)
          await saveFiles(next.files, args.files)
          next.sessions[s.id] = s
          break
        }
        case 'renameSession':
          if (own(next.sessions, args.id) && typeof args.title === 'string')
            next.sessions[args.id].title = args.title
          break
        case 'deleteSession':
          delete next.sessions[args.id]
          break
        case 'saveFiles':
          await saveFiles(next.files, args.files)
          break
        case 'commitStaging': {
          const characterIds = new Map()
          if (staging.tavern && next.tavern) {
            for (const character of staging.tavern.characters)
              characterIds.set(character.id, randomUUID())
          }
          if (args.mode !== 'append') {
            next.sessions = {}
            next.files = {}
          }
          const fileIds = new Map()
          for (const s of Object.values(staging.sessions))
            for (const m of s.messages)
              for (const f of m.files ?? []) {
                if (!fileIds.has(f.id)) fileIds.set(f.id, randomUUID())
              }
          for (const [oldId, file] of Object.entries(staging.files))
            next.files[fileIds.get(oldId) ?? randomUUID()] = file
          for (const item of Object.values(staging.sessions)) {
            const s = structuredClone(item)
            if (own(next.sessions, s.id)) s.id = randomUUID()
            if (s.tavern && characterIds.has(s.tavern.character.id)) {
              s.tavern.character.id = characterIds.get(s.tavern.character.id)
            }
            for (const m of s.messages)
              for (const f of m.files ?? []) {
                f.id = fileIds.get(f.id)
                f.serverId = null
              }
            next.sessions[s.id] = s
          }
          if (staging.tavern) {
            if (!next.tavern) next.tavern = staging.tavern
            else {
              const additions = staging.tavern.characters.map((c) => ({
                ...c,
                id: characterIds.get(c.id),
              }))
              next.tavern.characters.push(...additions)
            }
          }
          result = Object.values(next.sessions).map(summary)
          break
        }
        default:
          throw new Error('Unknown storage operation')
      }
      if (operation === 'deleteSession' || operation === 'commitStaging') {
        const referenced = new Set(
          Object.values(next.sessions).flatMap((s) =>
            s.messages.flatMap((m) => (m.files ?? []).map((f) => f.id))
          )
        )
        next.files = Object.fromEntries(
          Object.entries(next.files).filter(([id]) => referenced.has(id))
        )
      }
      await atomicJson(statePath, next)
      const retained = new Set(
        [...Object.values(next.files), ...Object.values(staging.files)].map((f) => f.hash)
      )
      for (const file of Object.values(state.files)) {
        if (!retained.has(file.hash) && /^[a-f0-9]{64}$/.test(file.hash))
          await unlink(join(directory, 'blobs', file.hash)).catch(() => {})
      }
      state = next
      if (operation === 'commitStaging') staging = { sessions: {}, files: {} }
      return result
    })
  return {
    run,
    config: () => ({ ...connection }),
    publicConfig: () => {
      const rawProfiles =
        connection.profiles && typeof connection.profiles === 'object' ? connection.profiles : {}
      const currentChannel = connection.channelId || 'deepseek'
      const mergedProfiles = {
        ...rawProfiles,
        [currentChannel]: {
          protocol: connection.protocol,
          baseUrl: connection.baseUrl,
          model: connection.model,
          apiKey: connection.apiKey,
        },
      }
      return {
        channelId: currentChannel,
        protocol: connection.protocol,
        baseUrl: connection.baseUrl,
        model: connection.model,
        hasApiKey: Boolean(connection.apiKey),
        profiles: Object.fromEntries(
          Object.entries(mergedProfiles).map(([id, p]) => [
            id,
            {
              protocol: p.protocol,
              baseUrl: p.baseUrl,
              model: p.model,
              hasApiKey: Boolean(p.apiKey),
            },
          ])
        ),
      }
    },
    resolveDraftConfig: (input) => {
      const url = new URL(input.baseUrl)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('接口地址必须是 HTTP(S) URL，且不能包含密码或查询参数。')
      if (!VALID_PROTOCOLS.includes(input.protocol)) throw new Error('请选择有效的接口协议。')
      const cleanBaseUrl = normalizeBaseUrl(url.href, input.protocol)
      let apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''
      if (!apiKey) {
        const currentChannel = connection.channelId || 'deepseek'
        const channelId =
          typeof input.channelId === 'string' && input.channelId ? input.channelId : currentChannel
        const candidate =
          connection.profiles?.[channelId] ?? (channelId === currentChannel ? connection : null)
        if (candidate?.apiKey && candidate?.baseUrl) {
          try {
            if (new URL(cleanBaseUrl).origin === new URL(candidate.baseUrl).origin) {
              apiKey = candidate.apiKey
            }
          } catch {
            // ignore
          }
        }
      }
      return {
        protocol: input.protocol,
        baseUrl: cleanBaseUrl,
        model: typeof input.model === 'string' ? input.model.trim() : '',
        apiKey,
      }
    },
    setConfig: (input) =>
      enqueue(async () => {
        const url = new URL(input.baseUrl)
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error('接口地址必须是 HTTP(S) URL，且不能包含密码或查询参数。')
        if (
          !VALID_PROTOCOLS.includes(input.protocol) ||
          typeof input.model !== 'string' ||
          !input.model.trim() ||
          input.model.length > 256
        )
          throw new Error('请填写有效的协议和模型名称。')
        const currentChannel = connection.channelId || 'deepseek'
        const channelId =
          typeof input.channelId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(input.channelId)
            ? input.channelId
            : currentChannel
        const prevProfiles =
          connection.profiles && typeof connection.profiles === 'object' ? connection.profiles : {}
        const savedProfile = prevProfiles[channelId]
        const fallbackKey = savedProfile
          ? savedProfile.apiKey
          : channelId === currentChannel
            ? connection.apiKey
            : ''
        const cleanBaseUrl = normalizeBaseUrl(url.href, input.protocol)
        const nextProfile = {
          protocol: input.protocol,
          baseUrl: cleanBaseUrl,
          model: input.model.trim(),
          apiKey: typeof input.apiKey === 'string' ? input.apiKey.trim() : fallbackKey,
        }
        const next = {
          channelId,
          ...nextProfile,
          profiles: {
            ...prevProfiles,
            [channelId]: nextProfile,
          },
        }
        await atomicJson(configPath, next)
        connection = next
      }),
    getTavern: () => structuredClone(state.tavern),
    setTavern: (value) =>
      enqueue(async () => {
        if (
          !value ||
          value.version !== 1 ||
          !Array.isArray(value.characters) ||
          !value.persona ||
          !value.preset
        )
          throw new Error('Invalid character library')
        const next = { ...state, tavern: structuredClone(value) }
        await atomicJson(statePath, next)
        state = next
      }),
  }
}
