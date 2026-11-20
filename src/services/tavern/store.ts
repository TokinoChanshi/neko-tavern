import { create } from 'zustand'
import { localRequest } from '../local.js'
import { setApiKey } from '../settings.js'
import { findChannelById, inferChannelId, type ProtocolType } from './channels.js'
import { emptyLibrary, type Library, type TavernContext } from './core.js'
import { mergeStarterCharacters, starterLibrary } from './presets.js'
import { validateLibrary } from './validate.js'

export type ChannelSavedSummary = {
  protocol: ProtocolType
  baseUrl: string
  model: string
  hasApiKey: boolean
}

export type Connection = {
  channelId?: string
  protocol: ProtocolType
  baseUrl: string
  model: string
  hasApiKey: boolean
  profiles?: Record<string, ChannelSavedSummary>
}

export const isConnectionReady = (
  connection: Pick<Connection, 'channelId' | 'protocol' | 'baseUrl' | 'hasApiKey'>
): boolean => {
  if (connection.hasApiKey) {
    return true
  }
  const preset = findChannelById(inferChannelId(connection))
  if (preset?.keylessAllowed) {
    return true
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(connection.baseUrl)
}

export const useConnection = create<Connection>(() => ({
  channelId: 'deepseek',
  protocol: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  hasApiKey: false,
  profiles: {},
}))
export type TavernEditorTab = 'characters' | 'persona' | 'lore' | 'preset'

export const useTavern = create<{
  library: Library
  ready: boolean
  open: boolean
  error: string
  editingId?: string | null
  initialTab?: TavernEditorTab
}>(() => ({
  library: emptyLibrary(),
  ready: false,
  open: false,
  error: '',
  editingId: undefined,
  initialTab: undefined,
}))
export const openTavern = (characterId?: string | null, initialTab?: TavernEditorTab) =>
  useTavern.setState({ open: true, editingId: characterId, initialTab })
export const closeTavern = () => useTavern.setState({ open: false, initialTab: undefined })
export const setConnection = (connection: Connection) => {
  useConnection.setState(connection)
  setApiKey(isConnectionReady(connection) ? 'local-connection' : null)
}
export const initTavern = async () => {
  try {
    const [savedLibrary, connection] = await Promise.all([
      localRequest<Library | null>('tavern'),
      localRequest<Connection>('connection'),
    ])
    let library = savedLibrary
    if (!library) {
      library = starterLibrary()
      await localRequest('tavern', library, 'PUT')
    } else if (
      library.characters.some((c) => c.name === '沈星回' && !c.alternateGreetings?.length)
    ) {
      // 无损升级旧版默认角色库：自动补齐高清立绘、第 4 位馆藏主角与多套平行初遇剧本
      library = {
        ...library,
        characters: mergeStarterCharacters(library.characters),
      }
      await localRequest('tavern', library, 'PUT')
    }
    useTavern.setState({ library, ready: true, error: '' })
    setConnection(connection)
  } catch (error) {
    useTavern.setState({ error: error instanceof Error ? error.message : '无法加载角色库。' })
  }
}
export const saveLibrary = async (library: Library) => {
  library = validateLibrary(library)
  await localRequest('tavern', library, 'PUT')
  useTavern.setState({ library, ready: true })
}
export const currentContext = (): TavernContext | undefined => {
  const { library } = useTavern.getState()
  const character = library.characters.find((c) => c.id === library.selectedId)
  return character
    ? structuredClone({ character, persona: library.persona, preset: library.preset })
    : undefined
}

export const selectCharacter = async (id: string | null) => {
  const { library } = useTavern.getState()
  if (id !== null && !library.characters.some((character) => character.id === id)) {
    throw new Error('此角色已被删除，请重新选择。')
  }
  await saveLibrary({ ...library, selectedId: id })
}
