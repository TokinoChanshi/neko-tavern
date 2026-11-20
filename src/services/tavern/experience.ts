import type { SessionSummary } from '../chat/types.js'
import type { Character } from './core.js'

export const MEMORY_LIMIT = 20000

export const cloneCharacter = (character: Character, name: string): Character => ({
  ...structuredClone(character),
  id: crypto.randomUUID(),
  name,
  favorite: false,
  lore: structuredClone(character.lore).map((entry) => ({ ...entry, id: crypto.randomUUID() })),
})

export const filterSessions = (sessions: SessionSummary[], query: string, characterId = '') => {
  const search = query.trim().toLocaleLowerCase()
  return sessions.filter((session) => {
    const matchesCharacter =
      !characterId ||
      (characterId === 'general' ? !session.characterId : session.characterId === characterId)
    return (
      matchesCharacter &&
      (!search ||
        `${session.title}\n${session.characterName ?? ''}`.toLocaleLowerCase().includes(search))
    )
  })
}

export const withStoryMemory = <T extends { system: string }>(prompt: T, memory = ''): T => {
  if (memory.length > MEMORY_LIMIT) {
    throw new Error(`故事记忆最多 ${MEMORY_LIMIT} 字符。`)
  }
  const text = memory.trim()
  return text ? { ...prompt, system: `${prompt.system}\n\n[故事记忆 · 用户记录]\n${text}` } : prompt
}

export const isRasterAvatar = (value: string) =>
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)

export const isAllowedAvatar = (value: string) => {
  if (!value) {
    return true
  }
  if (isRasterAvatar(value) || /^preset:[a-z0-9-]+$/.test(value)) {
    return true
  }
  if (value.length > 2048 || /[\s"'<>]/.test(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export async function readAvatar(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('头像不能超过 2 MB。')
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 PNG、JPEG 或 WebP 图片。')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp =
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  if (
    !(
      (file.type === 'image/png' && png) ||
      (file.type === 'image/jpeg' && jpeg) ||
      (file.type === 'image/webp' && webp)
    )
  ) {
    throw new Error('图片内容与格式不符，请重新选择。')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return `data:${file.type};base64,${btoa(binary)}`
}
