import type { MessageParam } from '../api/types.js'
import type { AssistantMessage, Message, UserMessage } from '../chat/types.js'
import { getContextRounds, toRequestMessages } from '../chat/reply.js'

type Prompt = { system: string; greeting: string; postHistory: string }
export function roleplayMessages(
  history: Message[],
  question: UserMessage,
  prefix: AssistantMessage | undefined,
  thinking: boolean,
  prompt: Prompt,
  budget: number
): MessageParam[] {
  const rounds = getContextRounds(history)
  const build = () => {
    const messages = toRequestMessages(rounds.flat(), question, prefix, thinking)
    const user = [...messages].reverse().find((m) => m.role === 'user')
    if (user && prompt.postHistory) {
      if (typeof user.content === 'string') {
        user.content += `\n\n[本轮叙事要求]\n${prompt.postHistory}`
      } else {
        user.content = [
          ...user.content,
          { type: 'text', text: `[本轮叙事要求]\n${prompt.postHistory}` },
        ]
      }
    }
    return prompt.greeting
      ? [
          { role: 'user' as const, content: '开始当前场景。' },
          {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: prompt.greeting }],
          },
          ...messages,
        ]
      : messages
  }
  let messages = build()
  while (rounds.length && JSON.stringify(messages).length + prompt.system.length > budget) {
    rounds.shift()
    messages = build()
  }
  if (JSON.stringify(messages).length + prompt.system.length > budget) {
    throw new Error('角色设定或本条消息超出上下文预算，请缩短内容或提高预算。')
  }
  return messages
}
