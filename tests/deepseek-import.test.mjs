import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { createStorage } from '../server/storage.mjs'
import { checkArchiveFormat, importArchive } from '../src/services/chat/history/importArchive.ts'
import { getVisibleMessages } from '../src/services/chat/branches.ts'
import { toRequestMessages } from '../src/services/chat/reply.ts'

const date = '2026-11-17T01:00:00Z'
const message = (id, parent_id, role, content) => ({
  id,
  parent_id,
  role,
  status: 'FINISHED',
  thinking_enabled: false,
  search_enabled: false,
  accumulated_token_usage: 0,
  inserted_at: date,
  fragments: [{ type: role === 'USER' ? 'REQUEST' : 'RESPONSE', content }],
})
const fixture = (bad = false) => {
  const session = {
    id: 'ds-session',
    title: '从 DS 导入',
    current_message_id: 3,
    inserted_at: date,
    updated_at: date,
    messages: [
      message(1, null, 'USER', '你叫什么名字？'),
      message(2, 1, 'ASSISTANT', '分支甲'),
      message(3, 1, 'ASSISTANT', '分支乙'),
    ],
  }
  if (bad) session.messages[2].parent_id = 99
  return new File(
    [
      zipSync({
        'manifest.json': strToU8(JSON.stringify({ export_format_version: 3 })),
        'chat_sessions/ds-session.json': strToU8(JSON.stringify(session)),
        'chat_session_index.json': strToU8(
          JSON.stringify([
            {
              id: session.id,
              title: session.title,
              message_count: 3,
              inserted_at: date,
              updated_at: date,
            },
          ])
        ),
      }),
    ],
    'deepseek_data.zip'
  )
}
test('real DS ZIP parser preserves branches, allows follow-up context, and rolls back malformed imports', async () => {
  await mkdir('tmp', { recursive: true })
  const dir = await mkdtemp(join(process.cwd(), 'tmp', 'ds-import-'))
  const db = await createStorage(dir)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const { operation, args } = JSON.parse(init.body)
    return Response.json(await db.run(operation, args))
  }
  try {
    await db.run('saveSession', {
      session: { id: 'old', title: 'keep', createdAt: 1, updatedAt: 1, messages: [] },
    })
    await checkArchiveFormat(fixture())
    await importArchive(fixture())
    await db.run('commitStaging', { mode: 'append' })
    const imported = await db.run('loadSession', { id: 'ds-session' })
    assert.equal(imported.messages.length, 3)
    assert.equal(getVisibleMessages(imported).at(-1).blocks[0].text, '分支乙')
    const question = {
      id: 'next',
      role: 'user',
      content: '接着说',
      files: [],
      createdAt: Date.now(),
    }
    const request = toRequestMessages(getVisibleMessages(imported), question)
    assert.equal(request.at(-1).content, '接着说')
    assert.ok(JSON.stringify(request).includes('分支乙'))
    assert.ok(!JSON.stringify(request).includes('分支甲'))
    await db.run('clearStaging')
    await assert.rejects(importArchive(fixture(true)))
    await db.run('clearStaging')
    assert.equal((await db.run('loadSessionSummaries')).length, 2)
  } finally {
    globalThis.fetch = originalFetch
    await rm(dir, { recursive: true, force: true })
  }
})
