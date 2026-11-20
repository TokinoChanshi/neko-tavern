import type { Session } from '../types.js'
import { normalizeSession } from '../branches.js'
import * as db from '../db.js'
import { localRequest } from '../../local.js'
import { validateContext, validateLibrary } from '../../tavern/validate.js'
import type { Library } from '../../tavern/core.js'
import { MEMORY_LIMIT } from '../../tavern/experience.js'

type NativeBackup = {
  format: 'mengnan-backup' | 'neko-tavern-backup'
  version: 1
  sessions: Session[]
  files: { id: string; type: string; data: string }[]
  tavern: Library | null
}
export async function readNativeBackup(file: File): Promise<NativeBackup> {
  if (file.size > 128 * 1024 * 1024) {
    throw new Error('备份超过 128 MB，请改用数据目录迁移。')
  }
  const value = JSON.parse(await file.text()) as NativeBackup
  if (
    !['mengnan-backup', 'neko-tavern-backup'].includes(value?.format) ||
    value.version !== 1 ||
    !Array.isArray(value.sessions) ||
    !Array.isArray(value.files)
  ) {
    throw new Error('不是有效的猫猫酒馆备份文件。')
  }
  const ids = new Set<string>()
  for (const session of value.sessions) {
    if (
      !session ||
      typeof session.id !== 'string' ||
      !session.id ||
      ids.has(session.id) ||
      typeof session.title !== 'string' ||
      !Number.isFinite(session.createdAt) ||
      !Number.isFinite(session.updatedAt) ||
      !Array.isArray(session.messages)
    ) {
      throw new Error('备份中的会话不完整。')
    }
    ids.add(session.id)
    if (
      (session.pinned !== undefined && typeof session.pinned !== 'boolean') ||
      (session.memory !== undefined &&
        (typeof session.memory !== 'string' || session.memory.length > MEMORY_LIMIT))
    ) {
      throw new Error('备份中的置顶或故事记忆格式不正确。')
    }
    const messages = new Map<string, string>()
    for (const msg of session.messages) {
      if (
        typeof msg.id !== 'string' ||
        messages.has(msg.id) ||
        !Number.isFinite(msg.createdAt) ||
        !['user', 'assistant'].includes(msg.role)
      ) {
        throw new Error('备份中的消息不正确。')
      }
      if (
        msg.parentId &&
        (!messages.has(msg.parentId) || messages.get(msg.parentId) === msg.role)
      ) {
        throw new Error('备份中的分支不正确。')
      }
      messages.set(msg.id, msg.role)
      if (msg.role === 'user') {
        if (typeof msg.content !== 'string' || !Array.isArray(msg.files)) {
          throw new Error('备份中的提问不正确。')
        }
        for (const f of msg.files) {
          if (
            typeof f.id !== 'string' ||
            typeof f.name !== 'string' ||
            !Number.isFinite(f.size) ||
            typeof f.isImage !== 'boolean' ||
            typeof f.mimeType !== 'string'
          ) {
            throw new Error('备份中的附件不正确。')
          }
        }
      } else {
        if (
          !Array.isArray(msg.blocks) ||
          !['pending', 'streaming', 'done', 'stopped', 'error'].includes(msg.status)
        ) {
          throw new Error('备份中的回答不正确。')
        }
        for (const block of msg.blocks) {
          if (
            !block ||
            typeof block.type !== 'string' ||
            (block.type === 'text' && typeof block.text !== 'string') ||
            (block.type === 'thinking' && typeof block.thinking !== 'string')
          ) {
            throw new Error('备份中的回答内容不正确。')
          }
        }
      }
    }
    for (const m of session.messages) {
      if (m.selectedChildId && !messages.has(m.selectedChildId)) {
        throw new Error('备份中的分支缺失。')
      }
    }
    if (session.rootMessageId && !messages.has(session.rootMessageId)) {
      throw new Error('备份中的起始消息缺失。')
    }
    if (session.greeting !== undefined && typeof session.greeting !== 'string') {
      throw new Error('开场白格式不正确。')
    }
    if (session.tavern) {
      session.tavern = validateContext(session.tavern)
    }
  }
  for (const f of value.files) {
    if (
      !f ||
      typeof f.id !== 'string' ||
      typeof f.type !== 'string' ||
      typeof f.data !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)
    ) {
      throw new Error('备份中的文件不正确。')
    }
  }
  value.tavern = value.tavern ? validateLibrary(value.tavern) : null
  return value
}
export async function stageNativeBackup(backup: NativeBackup) {
  for (const session of backup.sessions) {
    await db.addStagingSession(normalizeSession(session))
  }
  for (const f of backup.files) {
    await db.saveStagingFiles([
      {
        id: f.id,
        blob: new Blob([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], { type: f.type }),
      },
    ])
  }
  if (backup.tavern) {
    await localRequest('storage', { operation: 'stageTavern', args: { library: backup.tavern } })
  }
}
