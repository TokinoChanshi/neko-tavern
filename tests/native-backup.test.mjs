import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readNativeBackup } from '../src/services/chat/history/native.ts'
import { readCharacter, defaultPreset } from '../src/services/tavern/core.ts'
import { roleplayMessages } from '../src/services/tavern/request.ts'

test('native backup preserves roleplay snapshot and rejects broken messages before staging', async () => {
  const context = {
    character: readCharacter({ name: '林川' }),
    persona: { name: '我', description: '' },
    preset: defaultPreset,
  }
  const session = {
    id: 'chat',
    title: 'story',
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    tavern: context,
    greeting: '你好。',
  }
  const backup = {
    format: 'mengnan-backup',
    version: 1,
    sessions: [session],
    files: [],
    tavern: null,
  }
  const parsed = await readNativeBackup(new File([JSON.stringify(backup)], 'backup.json'))
  assert.equal(parsed.sessions[0].tavern.character.name, '林川')
  assert.equal(parsed.sessions[0].greeting, '你好。')
  session.messages = [
    {
      id: 'broken',
      role: 'assistant',
      parentId: 'missing',
      createdAt: 1,
      blocks: [],
      status: 'done',
    },
  ]
  await assert.rejects(readNativeBackup(new File([JSON.stringify(backup)], 'backup.json')))
})

test('roleplay prompt keeps greeting and latest instruction while trimming complete old rounds', () => {
  const user = { id: 'u', role: 'user', content: 'old'.repeat(1000), files: [], createdAt: 1 }
  const assistant = {
    id: 'a',
    role: 'assistant',
    status: 'done',
    blocks: [{ type: 'text', text: 'old answer' }],
    createdAt: 2,
  }
  const question = { ...user, id: 'new', content: 'next' }
  const messages = roleplayMessages(
    [user, assistant],
    question,
    undefined,
    false,
    { system: 'system', greeting: '你好', postHistory: '简短回复' },
    1000
  )
  assert.equal(messages[1].content[0].text, '你好')
  assert.match(messages.at(-1).content, /next.*\n.*简短回复/s)
  assert.ok(!JSON.stringify(messages).includes('old answer'))
})
