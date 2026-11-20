import { getVisibleMessages } from '../chat/branches.js'
import type { Session, TextPart } from '../chat/types.js'
import { expandMacros } from './core.js'

/** 将当前会话可见剧情分支导出为排版优美的轻小说纪念 Markdown 文档 */
export function buildStoryMarkdown(session: Session): string {
  const character = session.tavern?.character
  const personaName = session.tavern?.persona.name || '我'
  const charName = character?.name || 'AI'
  const title = session.title || (character ? `与 ${character.name} 的故事篇章` : '对话记录')
  const dateText = new Date(session.updatedAt || Date.now()).toLocaleString('zh-CN', {
    hour12: false,
  })

  const lines: string[] = [`# ${title}`, '', `> 珍藏时间：${dateText}`]
  if (character) {
    lines.push(
      `> 相伴角色：**${character.name}**${character.personality ? `（${character.personality}）` : ''}`
    )
    lines.push(`> 我的身份：**${personaName}**`)
  }
  lines.push('')

  if (character?.scenario) {
    const scenario = expandMacros(character.scenario, character.name, personaName).trim()
    if (scenario) {
      lines.push('## ✦ 初遇场景', '', scenario, '')
    }
  }

  if (session.memory?.trim()) {
    lines.push('## ✦ 心事手札', '', session.memory.trim(), '')
  }

  lines.push('## ✦ 故事正文', '')

  if (session.greeting?.trim()) {
    lines.push(`### ${charName}`, '', session.greeting.trim(), '', '---', '')
  }

  for (const msg of getVisibleMessages(session)) {
    if (msg.role === 'user') {
      if (msg.content.trim()) {
        lines.push(`### ${personaName}`, '', msg.content.trim(), '', '---', '')
      }
    } else {
      const text = msg.blocks
        .filter((b): b is TextPart => b.type === 'text' && !b.isTemplate)
        .map((b) => b.text.trim())
        .filter(Boolean)
        .join('\n\n')
      if (text) {
        lines.push(`### ${charName}`, '', text, '', '---', '')
      }
    }
  }

  return lines.join('\n')
}

export function downloadStoryMarkdown(session: Session): void {
  const markdown = buildStoryMarkdown(session)
  const rawTitle = (session.title || session.tavern?.character.name || '故事纪念').replace(
    /[\\/:*?"<>|]+/g,
    '_'
  )
  const datePart = new Date().toISOString().slice(0, 10)
  const filename = `${rawTitle}-${datePart}.md`
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
