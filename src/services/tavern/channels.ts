export type ProtocolType = 'deepseek' | 'openai' | 'anthropic'

export type ChannelCategory = 'featured' | 'agent' | 'domestic' | 'global' | 'local'

export type ChannelEndpointOption = {
  label: string
  baseUrl: string
  protocol?: ProtocolType
}

export type ChannelPreset = {
  id: string
  name: string
  shortBadge: string
  badgeBg: string
  category: Exclude<ChannelCategory, 'featured'>
  featured?: boolean
  tag: string
  protocol: ProtocolType
  baseUrl: string
  defaultModel: string
  recommendedModels: readonly string[]
  endpoints?: readonly ChannelEndpointOption[]
  keylessAllowed?: boolean
  keyPlaceholder?: string
  hint: string
}

export const CHANNEL_CATEGORIES: readonly { id: ChannelCategory; label: string }[] = [
  { id: 'featured', label: '推荐常用' },
  { id: 'agent', label: 'Agent / 聚合' },
  { id: 'domestic', label: '国内直连' },
  { id: 'global', label: '海外 / 中转' },
  { id: 'local', label: '本地免密' },
]

export const API_CHANNEL_PRESETS: readonly ChannelPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    shortBadge: 'DS',
    badgeBg: 'linear-gradient(135deg, #3964fe 0%, #5b8cff 100%)',
    category: 'domestic',
    featured: true,
    tag: '原生流式 · 深度思考',
    protocol: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-flash'],
    endpoints: [
      {
        label: 'DeepSeek 原生扩展协议（支持语音/附件）',
        baseUrl: 'https://api.deepseek.com',
        protocol: 'deepseek',
      },
      {
        label: 'OpenAI 兼容接口 (/v1)',
        baseUrl: 'https://api.deepseek.com/v1',
        protocol: 'openai',
      },
    ],
    hint: '官方直连支持深度思考（R1）与角色扮演；原生协议额外支持语音朗读与附件扩展。',
  },
  {
    id: 'volcengine',
    name: '火山引擎 · 方舟',
    shortBadge: '火山',
    badgeBg: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)',
    category: 'domestic',
    featured: true,
    tag: '豆包 Seed · 满血 DS',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-2.0-pro',
    recommendedModels: [
      'doubao-seed-2.0-pro',
      'doubao-seed-2.0-lite',
      'deepseek-v3-250324',
      'deepseek-r1-250528',
      'doubao-1-5-pro-32k-250115',
    ],
    endpoints: [
      {
        label: '火山方舟标准 API (北京 v3)',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        protocol: 'openai',
      },
      {
        label: '火山 Coding Plan 专线 (/api/coding/v3)',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        protocol: 'openai',
      },
    ],
    keyPlaceholder: '填写火山方舟 API Key',
    hint: '可直接填写模型 Model ID（如 doubao-seed-2.0-pro、deepseek-v3-250324）或控制台推理接入点 ID（ep-xxxx），支持一键拉取可用模型。',
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    shortBadge: 'OC',
    badgeBg: 'linear-gradient(135deg, #18181b 0%, #52525b 100%)',
    category: 'agent',
    featured: true,
    tag: 'Zen 网关 · 含免费模型',
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'claude-sonnet-4-5',
    recommendedModels: [
      'claude-sonnet-4-5',
      'deepseek-v3',
      'gemini-2.5-pro',
      'gpt-4.1',
      'x-preview-f-free',
    ],
    endpoints: [
      {
        label: 'Zen 标准网关 (/zen/v1)',
        baseUrl: 'https://opencode.ai/zen/v1',
        protocol: 'openai',
      },
      {
        label: 'OpenCode Go 订阅网关 (/zen/go/v1)',
        baseUrl: 'https://opencode.ai/zen/go/v1',
        protocol: 'openai',
      },
    ],
    keylessAllowed: true,
    keyPlaceholder: '填写 OpenCode API Key（体验免费模型可填 public）',
    hint: 'OpenCode 官方聚合网关；免费体验模型可将 API Key 填为 public 并点击「拉取可用模型」查看当前限免列表。',
  },
  {
    id: 'cline',
    name: 'Cline 官方渠道',
    shortBadge: 'CL',
    badgeBg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    category: 'agent',
    featured: true,
    tag: 'Claude / Gemini 聚合',
    protocol: 'openai',
    baseUrl: 'https://api.cline.bot/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4-6',
    recommendedModels: [
      'anthropic/claude-sonnet-4-6',
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-chat',
      'openai/gpt-4.1',
    ],
    keyPlaceholder: '填写 app.cline.bot 获取的 Cline API Key',
    hint: 'Cline 官方统一 OpenAI 兼容网关（api.cline.bot/api/v1），模型标识采用「供应商/模型名」格式。',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    shortBadge: '硅基',
    badgeBg: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    category: 'agent',
    featured: true,
    tag: '高速满血 DeepSeek/Qwen',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    recommendedModels: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Pro/deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen3-235B-A22B',
      'Qwen/Qwen2.5-72B-Instruct',
    ],
    hint: '国内高并发推理聚合平台，支持 Pro 高速通道与多款免费开源小模型，点击「拉取可用模型」可浏览完整目录。',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    shortBadge: 'OR',
    badgeBg: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
    category: 'agent',
    featured: true,
    tag: '全球全模型酒馆首选',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    recommendedModels: [
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro-preview',
      'deepseek/deepseek-chat-v3-0324:free',
      'x-ai/grok-3-beta',
    ],
    hint: '全球角色扮演玩家最常用的多模型聚合路由，含大量 :free 免费后缀模型与无审查创作模型。',
  },
  {
    id: 'aliyun',
    name: '阿里云百炼 · 千问',
    shortBadge: '百炼',
    badgeBg: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
    category: 'domestic',
    featured: true,
    tag: 'Qwen3 / 百炼 DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    recommendedModels: [
      'qwen-max-latest',
      'qwen-plus',
      'qwen3-235b-a22b',
      'deepseek-v3',
      'deepseek-r1',
    ],
    hint: '阿里云 DashScope OpenAI 兼容端点，新账号享百万免费额度，支持通义千问全系列与托管版 DeepSeek。',
  },
  {
    id: 'minimax',
    name: 'MiniMax 稀宇',
    shortBadge: 'MM',
    badgeBg: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    category: 'domestic',
    featured: true,
    tag: '女性向细腻陪伴热门',
    protocol: 'openai',
    baseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax-Text-01',
    recommendedModels: ['MiniMax-Text-01', 'MiniMax-M1', 'abab6.5s-chat'],
    endpoints: [
      { label: 'MiniMax 国内站', baseUrl: 'https://api.minimaxi.com/v1', protocol: 'openai' },
      { label: 'MiniMax 国际站', baseUrl: 'https://api.minimax.io/v1', protocol: 'openai' },
    ],
    hint: '超长上下文（百万 Token）与极其细腻自然的人物对话情绪表现，非常适合长篇陪伴与多轮记忆互动。',
  },
  {
    id: 'stepfun',
    name: '阶跃星辰 StepFun',
    shortBadge: '阶跃',
    badgeBg: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)',
    category: 'domestic',
    tag: '文学感与角色张力出众',
    protocol: 'openai',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-2-16k',
    recommendedModels: ['step-2-16k', 'step-2-mini', 'step-1-32k', 'step-r1-v-mini'],
    hint: '中文网文语感、心理拉扯与人物神态描写表现极佳，深受女性向角色卡玩家喜爱。',
  },
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    shortBadge: 'Kimi',
    badgeBg: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    category: 'domestic',
    tag: 'Kimi K2 · 长文本记忆',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-0711-preview',
    recommendedModels: [
      'kimi-k2-0711-preview',
      'kimi-latest',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
    ],
    hint: 'Kimi K2 在中文叙事、口语自然度与超长世界书上下文保持方面表现优异。',
  },
  {
    id: 'zhipu',
    name: '智谱清言 GLM',
    shortBadge: '智谱',
    badgeBg: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
    category: 'domestic',
    tag: 'GLM-4.5 · 含免费 Flash',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    recommendedModels: ['glm-4.5', 'glm-4-plus', 'glm-4-air-250414', 'glm-4-flash-250414'],
    endpoints: [
      {
        label: '智谱标准网关 (/api/paas/v4)',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        protocol: 'openai',
      },
      {
        label: '智谱 Coding 专线 (/api/coding/paas/v4)',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        protocol: 'openai',
      },
    ],
    hint: '智谱开放平台直连；其中 glm-4-flash 系列支持免费调用，适合快速测试角色卡与世界书触发。',
  },
  {
    id: 'tencent',
    name: '腾讯云 · 混元/DS',
    shortBadge: '腾讯',
    badgeBg: 'linear-gradient(135deg, #0052d9 0%, #366ef4 100%)',
    category: 'domestic',
    tag: '知识引擎满血 DS / 混元',
    protocol: 'openai',
    baseUrl: 'https://api.lkeap.cloud.tencent.com/v1',
    defaultModel: 'deepseek-v3',
    recommendedModels: ['deepseek-v3', 'deepseek-r1', 'hunyuan-turbos-latest', 'hunyuan-t1-latest'],
    endpoints: [
      {
        label: '腾讯云知识引擎 DeepSeek',
        baseUrl: 'https://api.lkeap.cloud.tencent.com/v1',
        protocol: 'openai',
      },
      {
        label: '腾讯混元原生兼容接口',
        baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
        protocol: 'openai',
      },
    ],
    hint: '腾讯云专线稳定低延迟，支持知识引擎托管的 DeepSeek-V3/R1 与混元 TurboS。',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    shortBadge: 'CC',
    badgeBg: 'linear-gradient(135deg, #c96442 0%, #e08b67 100%)',
    category: 'global',
    featured: true,
    tag: '原生 Messages 协议',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    recommendedModels: [
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
    ],
    hint: '采用原生 Anthropic /v1/messages 协议（自动携带 x-api-key 与 anthropic-version），同样适用于各类 Claude 专属中转站。',
  },
  {
    id: 'openai',
    name: 'OpenAI 官方',
    shortBadge: 'GPT',
    badgeBg: 'linear-gradient(135deg, #10a37f 0%, #059669 100%)',
    category: 'global',
    tag: 'GPT-4.1 / GPT-4o',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1',
    recommendedModels: ['gpt-4.1', 'gpt-4o', 'gpt-4.1-mini', 'chatgpt-4o-latest', 'o4-mini'],
    hint: 'OpenAI 官方标准接口，需海外网络环境或修改为你的自定义反代域名。',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortBadge: 'G',
    badgeBg: 'linear-gradient(135deg, #4285f4 0%, #9b72cb 100%)',
    category: 'global',
    tag: 'Gemini 2.5 Pro · 大窗口',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-pro',
    recommendedModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    keyPlaceholder: '填写 Google AI Studio 获取的 Gemini API Key',
    hint: '通过 Google 官方 OpenAI 兼容层直连 Gemini 2.5 Pro / Flash，百万上下文非常适合超长故事书。',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    shortBadge: 'X',
    badgeBg: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
    category: 'global',
    tag: 'Grok 3 · 鲜活幽默文风',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-beta',
    recommendedModels: ['grok-3-beta', 'grok-3-mini-beta'],
    hint: 'xAI 官方兼容接口，角色对白风格鲜活大胆、互动感强。',
  },
  {
    id: 'oneapi',
    name: '通用中转 / NewAPI',
    shortBadge: '中转',
    badgeBg: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    category: 'global',
    featured: true,
    tag: 'OneAPI / NewAPI / 公益站',
    protocol: 'openai',
    baseUrl: 'https://api.example.com/v1',
    defaultModel: 'claude-3-7-sonnet-20250219',
    recommendedModels: [
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-4-20250514',
      'deepseek-chat',
      'gemini-2.5-pro',
      'gpt-4o',
    ],
    endpoints: [
      {
        label: 'OpenAI 兼容协议 (/v1/chat/completions)',
        baseUrl: 'https://api.example.com/v1',
        protocol: 'openai',
      },
      {
        label: 'Anthropic 原生协议 (/v1/messages)',
        baseUrl: 'https://api.example.com/v1',
        protocol: 'anthropic',
      },
    ],
    hint: '适用于所有基于 NewAPI、OneAPI、VoAPI、AiHubMix 等搭建的商业中转站或酒馆公益站；填好站点地址与 Key 后可直接「拉取可用模型」。',
  },
  {
    id: 'ollama',
    name: 'Ollama 本地模型',
    shortBadge: 'OL',
    badgeBg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    category: 'local',
    featured: true,
    tag: '本机离线 · 免 API Key',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen3:8b',
    recommendedModels: ['qwen3:8b', 'qwen2.5:14b', 'deepseek-r1:14b', 'gemma3:12b'],
    keylessAllowed: true,
    hint: '连接本机运行的 Ollama 服务（11434 端口），完全离线私密且无需填写 API Key，可一键拉取本机已下载的模型。',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio 本地',
    shortBadge: 'LM',
    badgeBg: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    category: 'local',
    tag: 'GGUF 本地推理 · 免密',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    recommendedModels: ['local-model'],
    keylessAllowed: true,
    hint: '在 LM Studio 开启 Local Server（默认 1234 端口）后即可免密直连，适合运行酒馆微调 GGUF 角色扮演模型。',
  },
]

export const findChannelById = (id?: string): ChannelPreset | undefined =>
  API_CHANNEL_PRESETS.find((item) => item.id === id)

export const inferChannelId = (input: {
  channelId?: string
  protocol: ProtocolType
  baseUrl: string
}): string => {
  if (input.channelId && findChannelById(input.channelId)) {
    return input.channelId
  }
  const normalized = input.baseUrl.trim().toLowerCase().replace(/\/+$/, '')
  for (const preset of API_CHANNEL_PRESETS) {
    if (preset.id === 'oneapi') {
      continue
    }
    if (preset.baseUrl.toLowerCase() === normalized) {
      return preset.id
    }
    if (preset.endpoints?.some((ep) => ep.baseUrl.toLowerCase() === normalized)) {
      return preset.id
    }
  }
  if (normalized.includes('volces.com')) {
    return 'volcengine'
  }
  if (normalized.includes('opencode.ai')) {
    return 'opencode'
  }
  if (normalized.includes('cline.bot')) {
    return 'cline'
  }
  if (normalized.includes('siliconflow')) {
    return 'siliconflow'
  }
  if (normalized.includes('openrouter.ai')) {
    return 'openrouter'
  }
  if (normalized.includes('dashscope.aliyuncs.com')) {
    return 'aliyun'
  }
  if (normalized.includes('minimaxi.com') || normalized.includes('minimax.io')) {
    return 'minimax'
  }
  if (normalized.includes('stepfun.com')) {
    return 'stepfun'
  }
  if (normalized.includes('moonshot.cn')) {
    return 'moonshot'
  }
  if (normalized.includes('bigmodel.cn')) {
    return 'zhipu'
  }
  if (normalized.includes('cloud.tencent.com')) {
    return 'tencent'
  }
  if (normalized.includes('deepseek.com')) {
    return 'deepseek'
  }
  if (normalized.includes('anthropic.com')) {
    return 'anthropic'
  }
  if (normalized.includes('generativelanguage.googleapis.com')) {
    return 'gemini'
  }
  if (normalized.includes('api.x.ai')) {
    return 'xai'
  }
  if (normalized.includes('11434')) {
    return 'ollama'
  }
  if (normalized.includes('1234')) {
    return 'lmstudio'
  }
  return 'oneapi'
}
