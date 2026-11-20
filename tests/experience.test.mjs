import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createStorage } from '../server/storage.mjs'
import {
  readCharacter,
  emptyLibrary,
  compilePrompt,
  exportCharacter,
  getCharacterGreetings,
} from '../src/services/tavern/core.ts'
import {
  starterLibrary,
  mergeStarterCharacters,
  CHARACTER_TEMPLATES,
  WRITING_STYLE_PRESETS,
  PERSONA_PRESETS,
  DIRECTOR_INSPIRATIONS,
} from '../src/services/tavern/presets.ts'
import { validateLibrary } from '../src/services/tavern/validate.ts'
import { toSessionSummary } from '../src/services/chat/types.ts'
import { readNativeBackup } from '../src/services/chat/history/native.ts'
import { buildStoryMarkdown } from '../src/services/tavern/storyExport.ts'
import { openTavern, closeTavern, useTavern } from '../src/services/tavern/store.ts'
import {
  ADVANCED_RP_PROMPTS,
  closeGuide,
  openGuideHandbook,
  openOnboardingTour,
  STARTER_CAST_GUIDES,
  toggleCommandPalette,
  useGuide,
} from '../src/services/guide.ts'
import { roleplayMessages } from '../src/services/tavern/request.ts'
import {
  cloneCharacter,
  filterSessions,
  withStoryMemory,
  readAvatar,
  isAllowedAvatar,
} from '../src/services/tavern/experience.ts'
import {
  DS_THEMES,
  resetAppearance,
  setMobileTab,
  setUIMode,
  toggleInnerMonologue,
  updateAppearance,
  useAppearance,
} from '../src/services/appearance.ts'

test('copying a character isolates identity and lore; old libraries accept missing favorite', () => {
  const original = readCharacter({
    name: '林舟',
    character_book: { entries: [{ content: '旧书店', constant: true }] },
  })
  original.favorite = true
  const copy = cloneCharacter(original, '林舟 · 副本')
  assert.notEqual(copy.id, original.id)
  assert.notEqual(copy.lore[0].id, original.lore[0].id)
  assert.equal(copy.favorite, false)
  copy.lore[0].content = '咖啡馆'
  assert.equal(original.lore[0].content, '旧书店')
  const library = emptyLibrary()
  const old = readCharacter({ name: '旧角色' })
  delete old.favorite
  library.characters.push(old)
  assert.equal(validateLibrary(library).characters[0].favorite, false)
})

test('summaries retain pinned state and deleted-library character identity without copying messages', () => {
  const session = {
    id: 's',
    title: '雨天',
    createdAt: 1,
    updatedAt: 2,
    pinned: true,
    memory: '约好明天见',
    messages: [],
    tavern: { character: { id: 'c', name: '林舟' } },
  }
  const summary = toSessionSummary(session)
  assert.equal(summary.characterName, '林舟')
  assert.equal(summary.characterId, 'c')
  assert.equal(summary.pinned, true)
  assert.equal(summary.messages, undefined)
  assert.equal(summary.memory, undefined)
  assert.deepEqual(filterSessions([summary], '林', 'c'), [summary])
  assert.deepEqual(filterSessions([summary], '咖啡', 'c'), [])
  assert.deepEqual(filterSessions([summary], '', 'general'), [])
})

test('story memory enters the prompt, counts toward budget and never silently removes the latest question', () => {
  const base = { system: '扮演林舟', greeting: '', postHistory: '' }
  const prompt = withStoryMemory(base, '我们约好明天去书店。')
  assert.match(prompt.system, /我们约好明天去书店/)
  assert.equal(base.system, '扮演林舟')
  const question = { id: 'q', role: 'user', content: '明天去哪？', files: [], createdAt: 1 }
  assert.match(
    JSON.stringify(roleplayMessages([], question, undefined, false, prompt, 1000)),
    /明天去哪/
  )
  assert.throws(
    () =>
      roleplayMessages(
        [],
        question,
        undefined,
        false,
        withStoryMemory(base, '约定'.repeat(1000)),
        1000
      ),
    /预算/
  )
  assert.throws(() => withStoryMemory(base, 'x'.repeat(20001)), /20000/)
})

test('avatar upload accepts raster signatures and rejects scripts, spoofed files and oversized images', async () => {
  const png = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'avatar.png', {
    type: 'image/png',
  })
  assert.match(await readAvatar(png), /^data:image\/png;base64,/)
  await assert.rejects(
    readAvatar(new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' })),
    /PNG|JPEG|WebP/
  )
  await assert.rejects(
    readAvatar(new File(['<script/>'], 'avatar.png', { type: 'image/png' })),
    /图片/
  )
  await assert.rejects(
    readAvatar(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })),
    /2 MB/
  )
})

test('full backup preserves memory, favorites and pins; append restore remaps character references consistently', async () => {
  await mkdir('tmp', { recursive: true })
  const dir = await mkdtemp(join('tmp', 'experience-'))
  try {
    let db = await createStorage(dir)
    const library = emptyLibrary()
    const character = readCharacter({ name: '林舟' })
    character.favorite = true
    library.characters = [character]
    library.selectedId = character.id
    await db.setTavern(library)
    const session = {
      id: 'story',
      title: '雨夜',
      createdAt: 1,
      updatedAt: 2,
      messages: [],
      pinned: true,
      memory: '约好周五一起看书',
      tavern: { character, persona: library.persona, preset: library.preset },
    }
    await db.run('saveSession', { session })
    db = await createStorage(dir)
    assert.equal((await db.run('loadSessionSummaries'))[0].characterName, '林舟')
    const backup = await readNativeBackup(
      new File([JSON.stringify(await db.run('exportBackup'))], 'backup.json')
    )
    assert.equal(backup.sessions[0].memory, session.memory)
    assert.equal(backup.sessions[0].pinned, true)
    assert.equal(backup.tavern.characters[0].favorite, true)
    await db.run('addStagingSession', { session: backup.sessions[0] })
    await db.run('stageTavern', { library: backup.tavern })
    const summaries = await db.run('commitStaging', { mode: 'append' })
    const added = summaries.find((s) => s.id !== 'story')
    const imported = await db.run('loadSession', { id: added.id })
    assert.notEqual(imported.tavern.character.id, character.id)
    assert.ok(db.getTavern().characters.some((c) => c.id === imported.tavern.character.id))
    assert.equal(imported.memory, session.memory)
    backup.sessions[0].memory = { invalid: true }
    await assert.rejects(readNativeBackup(new File([JSON.stringify(backup)], 'invalid.json')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('starter library validates cleanly, compiles lore triggers, and merges without duplicating existing names', () => {
  const starters = validateLibrary(starterLibrary())
  assert.ok(starters.characters.length >= 3)
  assert.equal(starters.selectedId, starters.characters[0].id)
  const bartender = starters.characters[0]
  const compiled = compilePrompt(
    {
      character: bartender,
      persona: { name: '小夏', description: '插画师' },
      preset: starters.preset,
    },
    [{ role: 'user', content: '我想喝晚安白桃特调，顺便看看奶盖' }]
  )
  assert.match(compiled.system, /晚安白桃/)
  assert.match(compiled.system, /奶盖/)
  assert.match(compiled.greeting, /\*.*\*|「.*」/)
  const mergedOnce = mergeStarterCharacters(starters.characters)
  assert.equal(mergedOnce.length, starters.characters.length)
  const partial = mergeStarterCharacters([starters.characters[0]])
  assert.equal(partial.length, starters.characters.length)
  assert.equal(isAllowedAvatar('preset:shen-xinghui'), true)
  assert.equal(isAllowedAvatar('https://images.unsplash.com/photo-123?w=400'), true)
  assert.equal(isAllowedAvatar('javascript:alert(1)'), false)
  assert.equal(isAllowedAvatar('http://insecure.example.com/a.jpg'), false)
})

test('appearance store supports companion, mobile app, and 6 dedicated original DeepSeek themes', () => {
  assert.equal(DS_THEMES.length, 6)
  assert.deepEqual(
    DS_THEMES.map((item) => item.id),
    ['ds-blue', 'ds-claude', 'ds-rose', 'ds-emerald', 'ds-violet', 'ds-oled']
  )
  resetAppearance()
  assert.equal(useAppearance.getState().uiMode, 'companion')
  assert.equal(useAppearance.getState().dsSkin, 'ds-blue')

  setUIMode('ds')
  updateAppearance({ dsSkin: 'ds-claude' })
  assert.equal(useAppearance.getState().uiMode, 'ds')
  assert.equal(useAppearance.getState().dsSkin, 'ds-claude')

  setUIMode('mobile')
  setMobileTab('cast')
  assert.equal(useAppearance.getState().uiMode, 'mobile')
  assert.equal(useAppearance.getState().mobileTab, 'cast')

  resetAppearance()
  assert.equal(useAppearance.getState().uiMode, 'companion')
  assert.equal(useAppearance.getState().dsSkin, 'ds-blue')
  assert.equal(useAppearance.getState().innerMonologue, false)
  toggleInnerMonologue()
  assert.equal(useAppearance.getState().innerMonologue, true)
  resetAppearance()
})

test('alternate greetings, character/persona/style presets, and session portrait summaries work cleanly', () => {
  const card = readCharacter({
    spec: 'chara_card_v2',
    data: {
      name: '测试角色',
      first_mes: '第一幕初见',
      alternate_greetings: ['第二幕雨夜', '  ', '第三幕清晨'],
    },
  })
  assert.deepEqual(getCharacterGreetings(card), ['第一幕初见', '第二幕雨夜', '第三幕清晨'])
  const exported = exportCharacter(card)
  assert.deepEqual(exported.data.alternate_greetings, ['第二幕雨夜', '第三幕清晨'])

  const starters = starterLibrary()
  assert.ok(getCharacterGreetings(starters.characters[0]).length >= 3)

  assert.ok(CHARACTER_TEMPLATES.length >= 4)
  const baiYu = CHARACTER_TEMPLATES[0].create()
  assert.equal(baiYu.avatar, 'preset:bai-yu')

  assert.ok(WRITING_STYLE_PRESETS.length >= 6)
  assert.ok(PERSONA_PRESETS.length >= 6)
  assert.ok(DIRECTOR_INSPIRATIONS.length >= 8)

  const summaryWithAvatar = toSessionSummary({
    id: 's-av',
    title: '初遇',
    createdAt: 1,
    updatedAt: 2,
    messages: [],
    tavern: {
      character: starters.characters[0],
      persona: starters.persona,
      preset: starters.preset,
    },
  })
  assert.equal(summaryWithAvatar.characterAvatar, 'preset:shen-xinghui')

  const md = buildStoryMarkdown({
    id: 's-md',
    title: '雨夜白桃',
    createdAt: 1,
    updatedAt: 2,
    greeting: '*递过热茶*「欢迎光临。」',
    memory: '他叫我小常客',
    messages: [
      { id: 'u1', role: 'user', content: '*接过茶杯*「谢谢。」', files: [], createdAt: 3 },
      {
        id: 'a1',
        role: 'assistant',
        createdAt: 4,
        model: null,
        prefix: false,
        status: 'done',
        blocks: [{ type: 'text', text: '*微微一笑*「慢点喝。」' }],
      },
    ],
    tavern: {
      character: starters.characters[0],
      persona: { name: '小夏', description: '插画师' },
      preset: starters.preset,
    },
  })
  assert.match(md, /# 雨夜白桃/)
  assert.match(md, /心事手札/)
  assert.match(md, /### 小夏/)
  assert.match(md, /慢点喝/)
})

test('onboarding tour, handbook tabs, command palette, and tavern tab deep-linking work cleanly', () => {
  assert.ok(ADVANCED_RP_PROMPTS.length >= 8)
  assert.equal(STARTER_CAST_GUIDES.length, 4)

  openOnboardingTour(2)
  assert.equal(useGuide.getState().open, true)
  assert.equal(useGuide.getState().mode, 'tour')
  assert.equal(useGuide.getState().tourStep, 2)

  openGuideHandbook('cast')
  assert.equal(useGuide.getState().mode, 'handbook')
  assert.equal(useGuide.getState().activeTab, 'cast')

  toggleCommandPalette()
  assert.equal(useGuide.getState().commandPaletteOpen, true)
  assert.equal(useGuide.getState().open, false)
  toggleCommandPalette()
  assert.equal(useGuide.getState().commandPaletteOpen, false)

  closeGuide()
  assert.equal(useGuide.getState().open, false)
  assert.equal(useGuide.getState().onboardingCompleted, true)

  openTavern('char-1', 'lore')
  assert.equal(useTavern.getState().open, true)
  assert.equal(useTavern.getState().editingId, 'char-1')
  assert.equal(useTavern.getState().initialTab, 'lore')
  closeTavern()
  assert.equal(useTavern.getState().initialTab, undefined)
})
