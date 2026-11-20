import { create } from 'zustand'
import { localRequest } from './local.js'
import { setConnection, type Connection } from './tavern/store.js'

export type GuideViewMode = 'tour' | 'handbook'

export type GuideTabId = 'quickstart' | 'roleplay' | 'systems' | 'cast' | 'channels' | 'shortcuts'

type GuideState = {
  open: boolean
  mode: GuideViewMode
  tourStep: number
  activeTab: GuideTabId
  commandPaletteOpen: boolean
  onboardingCompleted: boolean
}

const ONBOARDING_STORAGE_KEY = 'neko-tavern:onboarding-v1'

const readOnboardingDone = (): boolean => {
  if (typeof localStorage === 'undefined') {
    return true
  }
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const persistOnboardingDone = () => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export const useGuide = create<GuideState>(() => ({
  open: false,
  mode: 'handbook',
  tourStep: 0,
  activeTab: 'quickstart',
  commandPaletteOpen: false,
  onboardingCompleted: readOnboardingDone(),
}))

export const openOnboardingTour = (step = 0) =>
  useGuide.setState({ open: true, mode: 'tour', tourStep: step, commandPaletteOpen: false })

export const openGuideHandbook = (tab: GuideTabId = 'quickstart') =>
  useGuide.setState({ open: true, mode: 'handbook', activeTab: tab, commandPaletteOpen: false })

export const closeGuide = () => {
  persistOnboardingDone()
  useGuide.setState({ open: false, onboardingCompleted: true })
}

export const markOnboardingDone = () => {
  persistOnboardingDone()
  useGuide.setState({ onboardingCompleted: true })
}

export const setTourStep = (tourStep: number) => useGuide.setState({ tourStep })
export const setGuideTab = (activeTab: GuideTabId) => useGuide.setState({ activeTab })

export const toggleCommandPalette = () =>
  useGuide.setState((prev) => ({ commandPaletteOpen: !prev.commandPaletteOpen, open: false }))

export const closeCommandPalette = () => useGuide.setState({ commandPaletteOpen: false })

/** 为纯新手一键启用 OpenCode Zen 免密公共体验通道（立即可对话） */
export async function enableQuickTrialConnection(): Promise<Connection> {
  const connection = await localRequest<Connection>(
    'connection',
    {
      channelId: 'opencode',
      protocol: 'openai',
      baseUrl: 'https://opencode.ai/zen/v1',
      model: 'x-preview-f-free',
      apiKey: 'public',
    },
    'PUT'
  )
  setConnection(connection)
  return connection
}

/** 老玩家私藏：高阶防卡文 / 防 OOC / 剧情导演指令库（支持一键填入输入框或复制） */
export const ADVANCED_RP_PROMPTS: readonly {
  id: string
  category: string
  title: string
  usage: string
  prompt: string
}[] = [
  {
    id: 'fix-ooc',
    category: '人设校准',
    title: '温和纠正角色 OOC（偏离性格）',
    usage: '当觉得角色突然变得太油腻、太话痨或不像本人时发送',
    prompt:
      '（导演校准：请立刻回溯 {{char}} 的核心性格设定——保持他原有的克制分寸感与说话习惯，不要说油腻套话，重新自然接续刚才的情境。）',
  },
  {
    id: 'no-godmoding',
    category: '边界控制',
    title: '禁止替「我」说话或做决定',
    usage: '当模型不小心连你的反应也一起写了时附加在句末',
    prompt:
      '（叙事边界提醒：本轮请只描写他自己的神态、动作与台词，在关键互动处停下等待我的回应，绝不要替我说话或决定我的动作。）',
  },
  {
    id: 'slow-burn',
    category: '节奏调控',
    title: '放慢感情节奏 · 强化细节推拉',
    usage: '希望多写环境光影、微表情与暧昧试探，避免进展过快',
    prompt:
      '（节奏引导：请放慢当前叙事节奏，重点描写空气中的光影气味、指尖与视线的细微停顿，用欲言又止的潜台词代替直白表白。）',
  },
  {
    id: 'jealous-test',
    category: '修罗场升温',
    title: '接到别人打来的电话（吃醋反应测试）',
    usage: '制造一点点危机感，观察高冷或温柔角色的独占欲',
    prompt:
      '*包里的手机忽然震动起来，屏幕亮起一个陌生又亲昵的备注，我走到窗边小声接起聊了两句才挂断回头* 「不好意思呀，朋友临时约我周末出去一趟。」',
  },
  {
    id: 'flashback',
    category: '记忆闪回',
    title: '触发一段旧日共同回忆',
    usage: '适合深化宿命感或让竹马/旧识流露隐藏深情',
    prompt:
      '*看着眼前这一幕忽然有些出神，轻声开口* 「这个场景……总觉得和我们很久以前某次在一起的时候一模一样，你还记得吗？」',
  },
  {
    id: 'care-sick',
    category: '温柔照顾',
    title: '淋雨受凉轻微发烧（触发护短照顾）',
    usage: '解锁角色最温柔体贴的反差面',
    prompt:
      '*强撑着精神坐在旁边，声音却带着一点鼻音和沙哑，裹紧外套轻轻咳了一声，脸颊因为低烧微微发烫* 「我没事，休息一会儿就好啦……」',
  },
  {
    id: 'time-skip',
    category: '自然转场',
    title: '镜头自然切换到新场景',
    usage: '当前话题聊完，想丝滑开启下一幕约会或次日剧情',
    prompt: '*——时光悄然流转，转眼到了约定好的周末傍晚，暮色微醺的街角路灯次第亮起——*',
  },
  {
    id: 'summary-check',
    category: '手札提炼',
    title: '请角色帮我总结「心事手札」备忘',
    usage: '聊了二三十轮后，提炼关键约定粘贴进顶栏「心事手札」永久保存',
    prompt:
      '（系统助手请求：请暂时跳出角色，用 150 字以内的条目清单帮我梳理截至目前我们之间发生的【关系变化、专属昵称、重要约定与关键事件】，方便我存入心事手札。）',
  },
]

/** 馆藏主角互动攻略与隐藏世界书彩蛋图鉴 */
export const STARTER_CAST_GUIDES: readonly {
  name: string
  avatar: string
  archetype: string
  recommendedStyle: string
  tips: string
  secretKeywords: readonly { word: string; effect: string }[]
  parallelScenes: readonly string[]
}[] = [
  {
    name: '沈星回',
    avatar: 'preset:shen-xinghui',
    archetype: '温柔腹黑 · 读心系猫咖调酒师',
    recommendedStyle: '电影感细腻日常 / 深夜哄睡树洞',
    tips: '他非常擅长看穿你的「口是心非」。越是在他面前嘴硬说自己没事，越容易触发他绕出吧台、近距离温声拆穿你的偏心照顾。',
    secretKeywords: [
      { word: '奶盖 / 三花猫', effect: '唤醒酒馆团宠三花猫设定，还会触发沈星回吃小猫醋的微表情' },
      {
        word: '特调 / 白桃 / 酒单',
        effect: '解锁不对外公开、只为你一人研发的隐藏无酒精饮品「晚安白桃」',
      },
      { word: '二楼 / 阁楼 / 休息室', effect: '解锁带观星天窗与橙花羊绒毯的私人起居阁楼场景' },
    ],
    parallelScenes: [
      '① 深夜打烊 · 留门与热白桃乌龙',
      '② 老街停电 · 烛光双人沙发',
      '③ 二楼阁楼 · 低烧守夜哄睡',
    ],
  },
  {
    name: '陆沉渊',
    avatar: 'preset:lu-chenyuan',
    archetype: '清冷禁欲 · 细节控古籍修复师',
    recommendedStyle: '微醺暧昧拉扯 / 轻小说沉浸剧场',
    tips: '典型的「嘴上克制、耳朵先红」。主动靠近半步或调侃他耳根泛红，再开启「💭 读心」，能看到极其强烈的表面镇定与内心慌乱反差！',
    secretKeywords: [
      { word: '怀表 / 钟表 / 星图', effect: '唤醒工作台暗格里刻着你名字缩写的银质月相怀表秘密' },
      {
        word: '手札 / 笔记本 / 备忘',
        effect: '揭晓他随身皮质手札后半本密密麻麻记满关于你喜好的备忘录',
      },
    ],
    parallelScenes: ['① 钟楼工坊 · 骤雨烘干毛巾', '② 观星露台 · 流星雨与月相怀表'],
  },
  {
    name: '糯米',
    avatar: 'preset:nuomi',
    archetype: '直球治愈 · 异瞳化形白猫少年',
    recommendedStyle: '电影感细腻日常 / 手机气泡秒回风',
    tips: '百分百依赖你的小太阳年下。夸奖他乖、顺毛摸头或投喂小甜点会让他开心得冒出尾巴；冷落或逗他则会委屈巴巴拽衣角。',
    secretKeywords: [
      {
        word: '猫耳 / 尾巴 / 摸头',
        effect: '触发顺毛超过五秒彻底软成一滩、控制不住冒出长尾巴的设定',
      },
      { word: '宝物 / 铁盒 / 弹珠', effect: '解锁壁炉下曲奇铁盒里珍藏你送的糖纸与发圈的小秘密' },
    ],
    parallelScenes: ['① 星星露台 · 玻璃弹珠献宝求摸头', '② 雷雨深夜 · 抱猫咪枕头敲门求收留'],
  },
  {
    name: '顾言深',
    avatar: 'preset:gu-yanshen',
    archetype: '慵懒矜贵 · 阔别重逢钢琴家竹马',
    recommendedStyle: '微醺暧昧拉扯',
    tips: '拥有三年重逢的往事张力。既可以和他像熟稔竹马一样互怼拉扯，也可以提起三年前的旧事，瞬间卸下他漫不经心的伪装。',
    secretKeywords: [
      { word: '钢琴 / 曲子 / 琴谱', effect: '唤醒他巡演行李箱里珍藏三年的泛黄未完手写琴谱初稿' },
      { word: '项链 / 吊坠 / 礼物', effect: '解锁他颈间银链下贴身藏着的音符素戒设定' },
    ],
    parallelScenes: ['① 午夜酒馆 · 为你熬夜写的无名夜曲', '② 独奏会后台 · 反锁化妆间的偏爱'],
  },
]
