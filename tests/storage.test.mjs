import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createStorage } from '../server/storage.mjs'
const tmpdir = () => join(process.cwd(), 'tmp')
await mkdir(tmpdir(), { recursive: true })

const session = (id, text, fileId = 'image') => ({
  id,
  title: text,
  createdAt: 1,
  updatedAt: 2,
  messages: [{ id: 'm1', role: 'user', content: text, files: [{ id: fileId }], createdAt: 1 }],
})

test('append import preserves existing conversations and remaps colliding images', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mengnan-'))
  try {
    const db = await createStorage(dir)
    await db.run('saveSession', {
      session: session('same', 'old'),
      files: [{ id: 'image', data: 'b2xk', type: 'image/png' }],
    })
    await db.run('addStagingSession', { session: session('same', 'new') })
    await db.run('saveStagingFiles', { files: [{ id: 'image', data: 'bmV3', type: 'image/png' }] })
    const result = await db.run('commitStaging', { mode: 'append' })
    assert.equal(result.length, 2)
    assert.equal((await db.run('loadSession', { id: 'same' })).title, 'old')
    const added = result.find((x) => x.id !== 'same')
    const incoming = await db.run('loadSession', { id: added.id })
    assert.notEqual(incoming.messages[0].files[0].id, 'image')
    assert.equal((await db.run('loadFile', { id: 'image' })).data, 'b2xk')
    assert.equal((await db.run('loadFile', { id: incoming.messages[0].files[0].id })).data, 'bmV3')
    const reopened = await createStorage(dir)
    assert.equal((await reopened.run('loadSessionSummaries')).length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('discarding staging preserves saved data; configuration never exposes key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mengnan-'))
  try {
    const db = await createStorage(dir)
    await db.run('saveSession', { session: session('a', 'keep'), files: [] })
    await db.run('addStagingSession', { session: session('b', 'discard') })
    await db.run('clearStaging')
    assert.equal((await db.run('loadSessionSummaries')).length, 1)
    await db.setConfig({
      protocol: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      model: 'local',
      apiKey: 'secret',
    })
    assert.equal(db.publicConfig().apiKey, undefined)
    assert.equal(db.publicConfig().hasApiKey, true)
    await db.setConfig({ ...db.publicConfig(), model: 'another' })
    assert.equal(db.config().apiKey, 'secret')
    assert.ok((await readFile(join(dir, 'state.json'), 'utf8')).includes('keep'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('per-channel connection profiles isolate keys across Volcengine, OpenCode, and Cline without exposing secrets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mengnan-'))
  try {
    const db = await createStorage(dir)
    await db.setConfig({
      channelId: 'volcengine',
      protocol: 'openai',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-seed-2.0-pro',
      apiKey: 'volc-secret',
    })
    await db.setConfig({
      channelId: 'cline',
      protocol: 'openai',
      baseUrl: 'https://api.cline.bot/api/v1',
      model: 'anthropic/claude-sonnet-4-6',
      apiKey: 'cline-secret',
    })
    assert.equal(db.config().channelId, 'cline')
    assert.equal(db.config().apiKey, 'cline-secret')
    assert.equal(db.publicConfig().profiles.volcengine.hasApiKey, true)
    assert.equal(db.publicConfig().profiles.volcengine.apiKey, undefined)

    // Switch back to volcengine without re-sending apiKey: restores volc-secret
    await db.setConfig({
      channelId: 'volcengine',
      protocol: 'openai',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'deepseek-v3-250324',
    })
    assert.equal(db.config().apiKey, 'volc-secret')

    // Draft model fetch only reuses saved key for matching URL origin
    assert.equal(
      db.resolveDraftConfig({
        channelId: 'volcengine',
        protocol: 'openai',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      }).apiKey,
      'volc-secret'
    )
    assert.equal(
      db.resolveDraftConfig({
        channelId: 'volcengine',
        protocol: 'openai',
        baseUrl: 'https://evil.example.com/v1',
      }).apiKey,
      ''
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deleting the last referencing conversation excludes its attachments from backup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mengnan-'))
  try {
    const db = await createStorage(dir)
    await db.run('saveSession', {
      session: session('one', 'with file'),
      files: [{ id: 'image', data: 'b2xk', type: 'image/png' }],
    })
    await db.run('deleteSession', { id: 'one' })
    const backup = await db.run('exportBackup')
    assert.equal(backup.files.length, 0)
    assert.equal(backup.sessions.length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
