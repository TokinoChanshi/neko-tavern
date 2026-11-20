import { defaultPreset, type Character, type Library, type TavernContext } from './core.js'
import { isAllowedAvatar } from './experience.js'
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('备份格式不正确。')
  }
  return value as Record<string, unknown>
}
const text = (v: unknown) => {
  if (typeof v !== 'string') {
    throw new Error('备份中的文字字段不正确。')
  }
  return v
}
const finite = (v: unknown) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('备份中的数值不正确。')
  }
  return v
}
export const validateCharacter = (v: unknown): Character => {
  const c = object(v)
  for (const key of [
    'id',
    'name',
    'description',
    'personality',
    'scenario',
    'greeting',
    'examples',
    'systemPrompt',
    'postHistory',
    'avatar',
  ]) {
    text(c[key])
  }
  if (
    !c.name ||
    !Array.isArray(c.lore) ||
    (c.avatar && !isAllowedAvatar(String(c.avatar))) ||
    (c.favorite !== undefined && typeof c.favorite !== 'boolean') ||
    (c.alternateGreetings !== undefined &&
      (!Array.isArray(c.alternateGreetings) ||
        !c.alternateGreetings.every((x) => typeof x === 'string')))
  ) {
    throw new Error('备份中的角色不正确。')
  }
  for (const item of c.lore) {
    const e = object(item)
    text(e.id)
    text(e.content)
    finite(e.priority)
    if (
      !Array.isArray(e.keys) ||
      !e.keys.every((x) => typeof x === 'string') ||
      typeof e.enabled !== 'boolean' ||
      typeof e.constant !== 'boolean'
    ) {
      throw new Error('备份中的世界书不正确。')
    }
  }
  return { ...structuredClone(c), favorite: c.favorite ?? false } as Character
}
export const validateContext = (v: unknown): TavernContext => {
  const c = object(v)
  const persona = object(c.persona)
  const preset = object(c.preset)
  text(persona.name)
  text(persona.description)
  text(preset.system)
  text(preset.postHistory)
  for (const key of ['contextBudget', 'loreBudget', 'scanDepth', 'maxTokens', 'temperature']) {
    if (finite(preset[key]) < 0) {
      throw new Error('预设参数不能为负数。')
    }
  }
  if (
    Number(preset.contextBudget) < 1000 ||
    Number(preset.scanDepth) < 1 ||
    Number(preset.maxTokens) < 1 ||
    Number(preset.temperature) > 2
  ) {
    throw new Error('预设参数超出范围。')
  }
  return {
    character: validateCharacter(c.character),
    persona: persona as TavernContext['persona'],
    preset: { ...defaultPreset, ...preset } as TavernContext['preset'],
  }
}
export const validateLibrary = (v: unknown): Library => {
  const data = object(v)
  if (
    data.version !== 1 ||
    !Array.isArray(data.characters) ||
    !(data.selectedId === null || typeof data.selectedId === 'string')
  ) {
    throw new Error('角色库格式不正确。')
  }
  const characters = data.characters.map(validateCharacter)
  const placeholder: Character = {
    id: 'check',
    name: 'check',
    description: '',
    personality: '',
    scenario: '',
    greeting: '',
    examples: '',
    systemPrompt: '',
    postHistory: '',
    avatar: '',
    lore: [],
  }
  const { persona, preset } = validateContext({
    character: placeholder,
    persona: data.persona,
    preset: data.preset,
  })
  return { version: 1, characters, selectedId: data.selectedId as string | null, persona, preset }
}
