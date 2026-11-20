import { localRequest } from '../local.js'
import type { Session, SessionSummary } from './types.js'

export type StoredFile = { id: string; blob: Blob }
type EncodedFile = { id: string; data: string; type: string }
let queue: Promise<unknown> = Promise.resolve()
const operation = <T>(name: string, args: unknown = {}): Promise<T> => {
  const next = queue.then(() => localRequest<T>('storage', { operation: name, args }))
  queue = next.catch(() => {})
  return next
}
const command = async (name: string, args: unknown = {}): Promise<void> => {
  await operation<null>(name, args)
}
const encode = async ({ id, blob }: StoredFile): Promise<EncodedFile> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return { id, data: btoa(binary), type: blob.type }
}
const write = (
  name: string,
  args: Record<string, unknown>,
  files: StoredFile[] = []
): Promise<void> => {
  const next = queue.then(async () =>
    localRequest<null>('storage', {
      operation: name,
      args: { ...args, files: await Promise.all(files.map(encode)) },
    }).then(() => {})
  )
  queue = next.catch(() => {})
  return next
}
export const loadSessionSummaries = () => operation<SessionSummary[]>('loadSessionSummaries')
export const loadSession = (id: string) => operation<Session | undefined>('loadSession', { id })
export const saveSession = (session: Session, files: StoredFile[] = []) =>
  write('saveSession', { session }, files)
export const renameSession = (id: string, title: string) => command('renameSession', { id, title })
export const deleteSession = (id: string) => command('deleteSession', { id })
export const saveFiles = (files: StoredFile[]) => write('saveFiles', {}, files)
export const loadFile = async (id: string): Promise<Blob | undefined> => {
  const file = await operation<{ data: string; type: string } | null>('loadFile', { id })
  return file
    ? new Blob([Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))], { type: file.type })
    : undefined
}
export const clearStaging = () => command('clearStaging')
export const addStagingSession = (session: Session) => command('addStagingSession', { session })
export const saveStagingFiles = (files: StoredFile[]) => write('saveStagingFiles', {}, files)
export const updateStagingFileTypes = (types: ReadonlyMap<string, string>) =>
  command('updateStagingFileTypes', { types: [...types] })
export const commitStaging = (mode: 'append' | 'replace' = 'replace') =>
  operation<SessionSummary[]>('commitStaging', { mode })
export const reportStorageError = (action: string) => (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(`[storage] ${action}`, error)
}
