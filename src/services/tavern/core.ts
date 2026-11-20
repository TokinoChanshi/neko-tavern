export type LoreEntry = {
  id: string
  keys: string[]
  content: string
  enabled: boolean
  constant: boolean
  priority: number
  caseSensitive?: boolean
  secondaryKeys?: string[]
  selective?: boolean
  raw?: Record<string, unknown>
}
export type Character = {
  favorite?: boolean
  id: string
  name: string
  description: string
  personality: string
  scenario: string
  greeting: string
  alternateGreetings?: string[]
  examples: string
  systemPrompt: string
  postHistory: string
  avatar: string
  lore: LoreEntry[]
  raw?: Record<string, unknown>
}
export type Persona = { name: string; description: string }
export type Preset = {
  system: string
  postHistory: string
  contextBudget: number
  loreBudget: number
  scanDepth: number
  maxTokens: number
  temperature: number
}
export type TavernContext = { character: Character; persona: Persona; preset: Preset }
export type Library = {
  version: 1
  characters: Character[]
  selectedId: string | null
  persona: Persona
  preset: Preset
}
export const defaultPreset: Preset = {
  system:
    '你正在参与沉浸式虚构角色互动。请细腻扮演 {{char}}，始终贴合其性格、过往、说话语气与情感温度；用户扮演 {{user}}。善用生动的神态、光影、动作细节（可用 *星号* 包裹动作与心理描写）与自然对白推进故事，只描写 {{char}} 与周围环境，绝不替 {{user}} 决定行动、情绪或台词。',
  postHistory: '',
  contextBudget: 24000,
  loreBudget: 3000,
  scanDepth: 12,
  maxTokens: 2048,
  temperature: 0.9,
}
export const emptyLibrary = (): Library => ({
  version: 1,
  characters: [],
  selectedId: null,
  persona: { name: '我', description: '' },
  preset: { ...defaultPreset },
})
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
const number = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
export const expandMacros = (text: string, character: string, user: string) =>
  text.replace(/\{\{(char|user)\}\}/gi, (_, key: string) =>
    key.toLowerCase() === 'char' ? character : user
  )

export const getCharacterGreetings = (
  c: Pick<Character, 'greeting' | 'alternateGreetings'>
): string[] => {
  const extras = (c.alternateGreetings ?? []).filter((item) => item.trim().length > 0)
  return c.greeting ? [c.greeting, ...extras] : extras
}

export const readCharacter = (value: unknown): Character => {
  const root = record(value)
  const data = root.spec ? record(root.data) : root
  if (!str(data.name).trim()) {
    throw new Error('角色卡缺少名称。')
  }
  if (root.spec && !['chara_card_v2', 'chara_card_v3'].includes(str(root.spec))) {
    throw new Error('不支持的角色卡格式。')
  }
  const book = record(data.character_book)
  const entries = Array.isArray(book.entries) ? book.entries : []
  const altGreetings = strings(data.alternate_greetings).filter((item) => item.trim().length > 0)
  return {
    id: crypto.randomUUID(),
    name: str(data.name).trim(),
    description: str(data.description),
    personality: str(data.personality),
    scenario: str(data.scenario),
    greeting: str(data.first_mes),
    ...(altGreetings.length ? { alternateGreetings: altGreetings } : {}),
    examples: str(data.mes_example),
    systemPrompt: str(data.system_prompt),
    postHistory: str(data.post_history_instructions),
    avatar: '',
    raw: data,
    lore: entries.map((value): LoreEntry => {
      const e = record(value)
      return {
        id: crypto.randomUUID(),
        keys: strings(e.keys),
        content: str(e.content),
        enabled: e.enabled !== false,
        constant: e.constant === true,
        priority: number(e.priority, number(e.insertion_order, 0)),
        caseSensitive: e.case_sensitive === true,
        secondaryKeys: strings(e.secondary_keys),
        selective: e.selective === true,
        raw: e,
      }
    }),
  }
}
export const exportCharacter = (c: Character) => ({
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    creator_notes: '',
    tags: [],
    creator: '',
    character_version: '1.0',
    extensions: {},
    ...c.raw,
    name: c.name,
    description: c.description,
    personality: c.personality,
    scenario: c.scenario,
    first_mes: c.greeting,
    alternate_greetings: (c.alternateGreetings ?? strings(c.raw?.alternate_greetings)).filter(
      (item) => item.trim().length > 0
    ),
    mes_example: c.examples,
    system_prompt: c.systemPrompt,
    post_history_instructions: c.postHistory,
    character_book: {
      ...record(c.raw?.character_book),
      extensions: record(record(c.raw?.character_book).extensions),
      entries: c.lore.map((e) => ({
        ...e.raw,
        keys: e.keys,
        content: e.content,
        enabled: e.enabled,
        constant: e.constant,
        priority: e.priority,
        insertion_order: number(e.raw?.insertion_order, e.priority),
        case_sensitive: e.caseSensitive ?? false,
        secondary_keys: e.secondaryKeys ?? [],
        selective: e.selective ?? false,
        extensions: record(e.raw?.extensions),
      })),
    },
  },
})

export function compilePrompt(
  context: TavernContext,
  history: { role: string; content: string }[]
) {
  const { character: c, persona, preset } = context
  const expand = (text: string) => expandMacros(text, c.name, persona.name)
  const scanned = history
    .slice(-Math.max(1, preset.scanDepth))
    .map((x) => x.content)
    .join('\n')
  let budget = Math.max(0, preset.loreBudget)
  const lore: string[] = []
  for (const e of [...c.lore].sort((a, b) => b.priority - a.priority)) {
    const haystack = e.caseSensitive ? scanned : scanned.toLowerCase()
    const match = (keys: string[]) =>
      keys.some(
        (k) => k.trim() && haystack.includes(e.caseSensitive ? expand(k) : expand(k).toLowerCase())
      )
    if (
      !e.enabled ||
      (!e.constant && (!match(e.keys) || (e.selective && !match(e.secondaryKeys ?? []))))
    ) {
      continue
    }
    const content = expand(e.content)
    if (content.length > budget) {
      continue
    }
    lore.push(content)
    budget -= content.length
  }
  const system = [
    expand(
      c.systemPrompt ? c.systemPrompt.replaceAll('{{original}}', preset.system) : preset.system
    ),
    `角色：${c.name}`,
    c.description,
    c.personality && `性格：${c.personality}`,
    c.scenario && `场景：${c.scenario}`,
    `用户：${persona.name}\n${persona.description}`,
    c.examples && `对话示例：\n${c.examples}`,
    lore.length ? `世界设定：\n${lore.join('\n\n')}` : '',
  ]
    .filter(Boolean)
    .map(expand)
    .join('\n\n')
  return {
    system,
    greeting: expand(c.greeting),
    postHistory: expand(
      c.postHistory
        ? c.postHistory.replaceAll('{{original}}', preset.postHistory)
        : preset.postHistory
    ),
  }
}

export async function readCardFile(file: File): Promise<Character> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('角色卡不能超过 20 MB。')
  }
  if (!file.name.toLowerCase().endsWith('.png')) {
    return readCharacter(JSON.parse(await file.text()))
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x)) {
    throw new Error('不是有效的 PNG 角色卡。')
  }
  const view = new DataView(bytes.buffer)
  const decode = new TextDecoder()
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const length = view.getUint32(offset)
    if (offset + 12 + length > bytes.length) {
      throw new Error('PNG 角色卡不完整。')
    }
    const type = decode.decode(bytes.subarray(offset + 4, offset + 8))
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'tEXt' || type === 'iTXt') {
      const separator = chunk.indexOf(0)
      if (
        separator > 0 &&
        ['chara', 'ccv3'].includes(decode.decode(chunk.subarray(0, separator)).toLowerCase())
      ) {
        let payloadSlice = chunk.subarray(separator + 1)
        if (type === 'iTXt') {
          // iTXt: keyword \0 compressionFlag(1) compressionMethod(1) languageTag \0 translatedKeyword \0 text
          const afterFlags = payloadSlice.subarray(2)
          const langEnd = afterFlags.indexOf(0)
          if (langEnd >= 0) {
            const afterLang = afterFlags.subarray(langEnd + 1)
            const transEnd = afterLang.indexOf(0)
            if (transEnd >= 0) {
              payloadSlice = afterLang.subarray(transEnd + 1)
            }
          }
        }
        const encodedText = decode.decode(payloadSlice).trim()
        const jsonText = encodedText.startsWith('{')
          ? encodedText
          : decode.decode(
              Uint8Array.from(atob(encodedText.replace(/\s+/g, '')), (c) => c.charCodeAt(0))
            )
        const card = readCharacter(JSON.parse(jsonText))
        const reader = new FileReader()
        card.avatar = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return card
      }
    }
    offset += length + 12
  }
  throw new Error('图片中没有找到角色卡数据，请导入 JSON 角色卡。')
}
