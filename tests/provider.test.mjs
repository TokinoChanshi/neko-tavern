import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProviderHeaders,
  chatEndpoint,
  convertOpenAIStream,
  modelsEndpoint,
  normalizeBaseUrl,
  readSSE,
  toAnthropicRequest,
  toOpenAIRequest,
} from '../server/provider.mjs'
import {
  API_CHANNEL_PRESETS,
  findChannelById,
  inferChannelId,
} from '../src/services/tavern/channels.ts'

test('OpenAI payload preserves roleplay and strips DeepSeek-only extensions', () => {
  const result = toOpenAIRequest(
    {
      system: 'You are 林川',
      messages: [
        { role: 'latest_reminder', content: 'today' },
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'private' },
            { type: 'text', text: '你好' },
            { type: 'web_fetch_tool_result', signature: 'opaque' },
          ],
        },
      ],
      tools: [{ name: 'deepseek_read_url' }],
      max_tokens: 512,
    },
    'custom'
  )
  assert.equal(result.model, 'custom')
  assert.equal(result.messages[0].content, 'You are 林川')
  assert.equal(result.messages.at(-1).content, '你好')
  assert.equal(result.messages.length, 3)
  assert.equal(result.tools, undefined)
  assert.equal(result.max_tokens, 512)
})

test('SSE handles split UTF-8 and converts reasoning/text/usage to native events', async () => {
  const data = [
    'data: {"choices":[{"delta":{"reasoning_content":"想"}}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":3}}\n\n',
    'data: [DONE]\n\n',
  ].join('')
  const bytes = new TextEncoder().encode(data)
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7))
      c.close()
    },
  })
  const events = []
  for await (const event of convertOpenAIStream(readSSE(stream), 'model')) events.push(event)
  assert.equal(events.at(-1).type, 'message_stop')
  assert.ok(events.some((e) => e.delta?.text === '你好'))
  assert.ok(events.some((e) => e.delta?.thinking === '想'))
  assert.equal(events.find((e) => e.type === 'message_delta').usage.input_tokens, 10)
})

test('preset channels include OpenCode, Volcengine, Cline and normalize OpenAI/Anthropic endpoints & headers', () => {
  for (const id of [
    'opencode',
    'volcengine',
    'cline',
    'deepseek',
    'siliconflow',
    'openrouter',
    'anthropic',
    'ollama',
  ]) {
    const preset = findChannelById(id)
    assert.ok(preset, `missing preset ${id}`)
    assert.match(preset.baseUrl, /^https?:\/\//)
  }
  assert.ok(API_CHANNEL_PRESETS.length >= 18)

  assert.equal(
    inferChannelId({ protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/' }),
    'volcengine'
  )
  assert.equal(
    inferChannelId({ protocol: 'openai', baseUrl: 'https://opencode.ai/zen/v1' }),
    'opencode'
  )
  assert.equal(
    inferChannelId({ protocol: 'openai', baseUrl: 'https://api.cline.bot/api/v1' }),
    'cline'
  )

  // OpenCode Zen strips optional 'opencode/' prefix on model IDs
  const ocPayload = toOpenAIRequest(
    { system: 'sys', messages: [{ role: 'user', content: 'hi' }] },
    'opencode/claude-sonnet-4-5',
    'https://opencode.ai/zen/v1'
  )
  assert.equal(ocPayload.model, 'claude-sonnet-4-5')

  // Accidental endpoint suffixes pasted by users are normalized cleanly
  assert.equal(
    normalizeBaseUrl('https://ark.cn-beijing.volces.com/api/v3/chat/completions/', 'openai'),
    'https://ark.cn-beijing.volces.com/api/v3'
  )
  assert.equal(
    chatEndpoint({ protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' }),
    'https://api.anthropic.com/v1/messages'
  )
  assert.equal(
    chatEndpoint({ protocol: 'anthropic', baseUrl: 'https://api.anthropic.com' }),
    'https://api.anthropic.com/v1/messages'
  )
  assert.equal(
    modelsEndpoint({ protocol: 'openai', baseUrl: 'https://api.cline.bot/api/v1/' }),
    'https://api.cline.bot/api/v1/models'
  )

  const clineHeaders = buildProviderHeaders({
    protocol: 'openai',
    baseUrl: 'https://api.cline.bot/api/v1',
    apiKey: 'cline-key',
  })
  assert.equal(clineHeaders['X-Response-Format'], 'openai')
  assert.equal(clineHeaders.Authorization, 'Bearer cline-key')

  const anthropicHeaders = buildProviderHeaders({
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant-123',
  })
  assert.equal(anthropicHeaders['x-api-key'], 'sk-ant-123')
  assert.equal(anthropicHeaders['anthropic-version'], '2023-06-01')

  const anthropicPayload = toAnthropicRequest(
    {
      system: '扮演沈星回',
      messages: [
        { role: 'latest_reminder', content: 'skip' },
        { role: 'user', content: '你好' },
        { role: 'user', content: '在吗' },
      ],
      temperature: 1.4,
      max_tokens: 1024,
    },
    'claude-sonnet-4-20250514'
  )
  assert.equal(anthropicPayload.temperature, 1)
  assert.equal(anthropicPayload.messages.length, 1)
  assert.match(anthropicPayload.messages[0].content, /你好\s+在吗/)
})
