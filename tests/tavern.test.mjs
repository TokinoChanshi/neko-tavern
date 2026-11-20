import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compilePrompt, readCharacter, defaultPreset } from '../src/services/tavern/core.ts'

test('character card v2 imports persona and lore; prompt expands macros and matches only supplied history', () => {
  const character = readCharacter({
    spec: 'chara_card_v2',
    data: {
      name: '林川',
      description: '{{char}}是医生',
      first_mes: '你好，{{user}}。',
      character_book: {
        entries: [
          { keys: ['医院'], content: '医院位于海边', enabled: true },
          { keys: ['废弃分支'], content: '不应出现', enabled: true },
        ],
      },
    },
  })
  const result = compilePrompt(
    { character, persona: { name: '小夏', description: '摄影师' }, preset: defaultPreset },
    [{ role: 'user', content: '去医院吧' }]
  )
  assert.match(result.system, /林川是医生/)
  assert.match(result.system, /小夏/)
  assert.match(result.system, /医院位于海边/)
  assert.doesNotMatch(result.system, /不应出现/)
  assert.equal(result.greeting, '你好，小夏。')
})

test('lore obeys enabled flags, priority and budget, rejects malformed cards', () => {
  const character = readCharacter({ name: 'A' })
  character.lore = [
    { id: '1', keys: [], content: 'first', enabled: true, constant: true, priority: 10 },
    { id: '2', keys: [], content: 'never', enabled: false, constant: true, priority: 20 },
    {
      id: '3',
      keys: [],
      content: 'too long for budget',
      enabled: true,
      constant: true,
      priority: 0,
    },
  ]
  const result = compilePrompt(
    {
      character,
      persona: { name: 'U', description: '' },
      preset: { ...defaultPreset, loreBudget: 8 },
    },
    []
  )
  assert.match(result.system, /first/)
  assert.doesNotMatch(result.system, /never|too long/)
  assert.throws(() => readCharacter({ name: 13 }))
})
