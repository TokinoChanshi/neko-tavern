export const VALID_PROTOCOLS = ['deepseek', 'openai', 'anthropic']

export function normalizeBaseUrl(rawUrl, protocol) {
  let url = String(rawUrl || '')
    .trim()
    .replace(/\/+$/, '')
  if (protocol === 'openai') {
    url = url.replace(/\/chat\/completions$/i, '')
  } else if (protocol === 'anthropic') {
    url = url.replace(/\/v1\/messages$/i, '/v1').replace(/\/messages$/i, '')
  } else if (protocol === 'deepseek') {
    url = url.replace(/\/anthropic\/v1\/messages$/i, '')
  }
  return url.replace(/\/+$/, '')
}

export const endpoint = (config, suffix) =>
  `${normalizeBaseUrl(config.baseUrl, config.protocol)}${suffix}`

export function chatEndpoint(config) {
  const base = normalizeBaseUrl(config.baseUrl, config.protocol)
  if (config.protocol === 'deepseek') {
    return `${base}/anthropic/v1/messages`
  }
  if (config.protocol === 'anthropic') {
    return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`
  }
  return `${base}/chat/completions`
}

export function modelsEndpoint(config) {
  const base = normalizeBaseUrl(config.baseUrl, config.protocol)
  if (config.protocol === 'anthropic') {
    return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
  }
  return `${base}/models`
}

export function buildProviderHeaders(config) {
  const headers = {}
  const base = String(config.baseUrl || '').toLowerCase()
  if (config.protocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey
      headers.Authorization = `Bearer ${config.apiKey}`
    }
  } else if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  if (base.includes('api.cline.bot')) {
    headers['X-Response-Format'] = 'openai'
    headers['HTTP-Referer'] = 'https://cline.bot'
    headers['X-Title'] = 'Neko Tavern'
  } else if (base.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'http://127.0.0.1:8765'
    headers['X-Title'] = 'Neko Tavern'
  }
  return headers
}

const extractTextContent = (content) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
      : ''

export function toOpenAIRequest(body, model, baseUrl = '') {
  const resolvedModel =
    String(baseUrl).toLowerCase().includes('opencode.ai/zen') &&
    String(model).startsWith('opencode/')
      ? String(model).slice('opencode/'.length)
      : model

  const messages = [{ role: 'system', content: body.system || 'You are a helpful assistant.' }]
  for (const message of body.messages ?? []) {
    if (!['user', 'assistant'].includes(message.role)) continue
    const content = extractTextContent(message.content)
    if (content) messages.push({ role: message.role, content })
  }
  // OpenAI 推理系模型（gpt-5 及以后、o 系列）只认 max_completion_tokens，且只接受默认 temperature。
  const reasoningFamily = /^(gpt-([5-9]|\d{2,})|o\d)/i.test(String(resolvedModel))
  const tokenKey = reasoningFamily ? 'max_completion_tokens' : 'max_tokens'
  return {
    model: resolvedModel,
    messages,
    stream: true,
    ...(body.temperature === undefined || reasoningFamily ? {} : { temperature: body.temperature }),
    ...(body.max_tokens === undefined ? {} : { [tokenKey]: body.max_tokens }),
  }
}

export function toAnthropicRequest(body, model) {
  const messages = []
  for (const message of body.messages ?? []) {
    if (!['user', 'assistant'].includes(message.role)) continue
    const content = extractTextContent(message.content)
    if (!content) continue
    const prev = messages.at(-1)
    if (prev && prev.role === message.role) {
      prev.content = `${prev.content}\n\n${content}`
    } else {
      messages.push({ role: message.role, content })
    }
  }
  if (!messages.length || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: '你好' })
  }
  const clampedTemp =
    typeof body.temperature === 'number' && Number.isFinite(body.temperature)
      ? Math.min(1, Math.max(0, body.temperature))
      : undefined
  return {
    model,
    max_tokens: body.max_tokens || 4096,
    ...(body.system ? { system: body.system } : {}),
    messages,
    stream: true,
    ...(clampedTemp === undefined ? {} : { temperature: clampedTemp }),
  }
}

export async function* readSSE(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let lines = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let index
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index).replace(/\r$/, '')
        pending = pending.slice(index + 1)
        if (!line) {
          if (lines.length) yield lines.join('\n')
          lines = []
        } else if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''))
      }
      if (done) break
      if (pending.length > 4 * 1024 * 1024) throw new Error('模型返回的单条数据过大。')
    }
    if (pending.startsWith('data:')) lines.push(pending.slice(5).trimStart())
    if (lines.length) yield lines.join('\n')
  } finally {
    reader.releaseLock()
  }
}

export async function* convertOpenAIStream(chunks, model) {
  yield {
    type: 'message_start',
    message: {
      model,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  }
  let index = -1
  let kind = ''
  let finished = false
  let reason = 'end_turn'
  let usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
  for await (const data of chunks) {
    if (data === '[DONE]') {
      finished = true
      break
    }
    const chunk = JSON.parse(data)
    if (chunk.error) throw new Error(chunk.error.message || '模型请求失败。')
    if (chunk.usage)
      usage = {
        ...usage,
        input_tokens: chunk.usage.prompt_tokens ?? 0,
        output_tokens: chunk.usage.completion_tokens ?? 0,
      }
    const choice = chunk.choices?.[0]
    if (!choice) continue
    if (choice.delta?.tool_calls) throw new Error('当前聊天连接不支持客户端工具调用。')
    for (const [type, value] of [
      ['thinking', choice.delta?.reasoning_content ?? choice.delta?.reasoning],
      ['text', choice.delta?.content],
    ]) {
      if (typeof value !== 'string' || !value) continue
      if (kind !== type) {
        if (index >= 0) yield { type: 'content_block_stop', index }
        index++
        kind = type
        yield {
          type: 'content_block_start',
          index,
          content_block:
            type === 'thinking' ? { type, thinking: '', signature: '' } : { type, text: '' },
        }
      }
      yield {
        type: 'content_block_delta',
        index,
        delta:
          type === 'thinking'
            ? { type: 'thinking_delta', thinking: value }
            : { type: 'text_delta', text: value },
      }
    }
    if (choice.finish_reason) {
      finished = true
      reason =
        choice.finish_reason === 'length'
          ? 'max_tokens'
          : choice.finish_reason === 'content_filter'
            ? 'refusal'
            : 'end_turn'
    }
  }
  if (!finished) throw new Error('连接提前结束，请重试。')
  if (index >= 0) yield { type: 'content_block_stop', index }
  yield { type: 'message_delta', delta: { stop_reason: reason }, usage }
  yield { type: 'message_stop' }
}

export async function fetchModelsList(config, signal) {
  const upstream = await fetch(modelsEndpoint(config), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...buildProviderHeaders(config),
    },
    signal,
  })
  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel()
    throw new Error(`鉴权失败（${upstream.status}），请先填写正确的 API Key。`)
  }
  if (!upstream.ok) {
    await upstream.body?.cancel()
    throw new Error(
      `该渠道暂不支持自动拉取模型列表（HTTP ${upstream.status}），请点选下方推荐模型或手动输入。`
    )
  }
  const raw = await upstream.json()
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.models)
        ? raw.models
        : []
  const ids = []
  const seen = new Set()
  for (const item of items) {
    const rawId =
      typeof item === 'string'
        ? item
        : typeof item?.id === 'string'
          ? item.id
          : typeof item?.name === 'string'
            ? item.name.replace(/^models\//, '')
            : ''
    const trimmed = rawId.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      ids.push(trimmed)
    }
    if (ids.length >= 300) break
  }
  return ids
}

export async function testConnection(config, signal) {
  const headers = buildProviderHeaders(config)
  const modelsResp = await fetch(modelsEndpoint(config), {
    method: 'GET',
    headers: { Accept: 'application/json', ...headers },
    signal,
  })
  if (modelsResp.ok) {
    await modelsResp.body?.cancel()
    return { ok: true, mode: 'models' }
  }
  await modelsResp.body?.cancel()
  if (modelsResp.status === 401 || modelsResp.status === 403) {
    throw new Error(`鉴权未通过（${modelsResp.status}），请检查 API Key 密钥是否有效。`)
  }

  // 部分渠道（如火山 Coding 专线、MiniMax、部分 Anthropic/Cline 路由）不提供 GET /models，回退轻量对话探测
  const probeBody =
    config.protocol === 'openai'
      ? toOpenAIRequest(
          { system: 'Reply briefly.', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
          config.model,
          config.baseUrl
        )
      : config.protocol === 'anthropic'
        ? toAnthropicRequest(
            { messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
            config.model
          )
        : {
            model: config.model,
            system: 'Reply briefly.',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
            stream: true,
          }

  const chatResp = await fetch(chatEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...headers,
    },
    body: JSON.stringify(probeBody),
    signal,
  })
  if (!chatResp.ok) {
    const detail = (await chatResp.text())
      .slice(0, 300)
      .replaceAll(config.apiKey || '\0', '[redacted]')
    throw new Error(
      `连接失败（${chatResp.status}）${detail ? `：${detail}` : '，请检查接口地址、模型名称和密钥。'}`
    )
  }
  await chatResp.body?.cancel()
  return { ok: true, mode: 'chat' }
}

export async function streamChat(config, body, response, signal) {
  const openai = config.protocol === 'openai'
  const anthropic = config.protocol === 'anthropic'
  const payload = openai
    ? toOpenAIRequest(body, config.model, config.baseUrl)
    : anthropic
      ? toAnthropicRequest(body, config.model)
      : { ...body, model: config.model, stream: true }
  if (!openai && !anthropic) delete payload.temperature

  const upstream = await fetch(chatEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...buildProviderHeaders(config),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!upstream.ok) {
    const detail = (await upstream.text())
      .slice(0, 2000)
      .replaceAll(config.apiKey || '\0', '[redacted]')
    response.writeHead(upstream.status, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({ error: { message: detail || `模型接口返回 ${upstream.status}` } })
    )
    return
  }
  if (!upstream.body || !upstream.headers.get('content-type')?.includes('text/event-stream'))
    throw new Error('模型接口未返回流式响应，请检查接口地址和模型。')
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  })
  try {
    if (openai) {
      for await (const event of convertOpenAIStream(readSSE(upstream.body), config.model))
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    } else {
      for await (const chunk of upstream.body) response.write(chunk)
    }
  } catch (error) {
    if (!signal.aborted)
      response.write(
        `event: error\ndata: ${JSON.stringify({ error: { message: error.message } })}\n\n`
      )
  }
  response.end()
}
