import clsx from 'clsx'
import { useEffect, useState } from 'react'
import {
  openAppearanceDrawer,
  setUIMode,
  toggleInnerMonologue,
  useAppearance,
} from '../../services/appearance.js'
import { setDraftText } from '../../services/chat/drafts.js'
import { startCharacterSession, useChatStore } from '../../services/chat/store.js'
import {
  ADVANCED_RP_PROMPTS,
  closeGuide,
  enableQuickTrialConnection,
  openGuideHandbook,
  openOnboardingTour,
  setGuideTab,
  setTourStep,
  STARTER_CAST_GUIDES,
  toggleCommandPalette,
  useGuide,
  type GuideTabId,
} from '../../services/guide.js'
import { appIconImg } from '../../services/tavern/assets.js'
import { defaultPreset } from '../../services/tavern/core.js'
import {
  isConnectionReady,
  openTavern,
  selectCharacter,
  useConnection,
  useTavern,
} from '../../services/tavern/store.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { Avatar } from '../tavern/Avatar.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import styles from './GuideModal.module.css'

const TOUR_STEPS = ['欢迎入馆', '唤醒模型', '演出互动沙盒', '四大核心系统', '推门初遇'] as const

const HANDBOOK_TABS: readonly { id: GuideTabId; label: string }[] = [
  { id: 'quickstart', label: '🚀 新手速通清单' },
  { id: 'roleplay', label: '💬 演出与防卡文咒语' },
  { id: 'systems', label: '📖 名册·世界书·手札' },
  { id: 'cast', label: '💌 角色攻略与彩蛋' },
  { id: 'channels', label: '🔌 19款API选型指南' },
  { id: 'shortcuts', label: '⌨️ 快捷键与存档安全' },
]

export const GuideModal = () => {
  const open = useGuide((s) => s.open)
  const onboardingCompleted = useGuide((s) => s.onboardingCompleted)
  const tavernReady = useTavern((s) => s.ready)
  const chatReady = useChatStore((s) => s.ready)

  // 新玩家首次进入就绪后，自动柔和弹出 5 步迎宾新手引导（仅首次触发，随时可跳过）
  useEffect(() => {
    if (!onboardingCompleted && tavernReady && chatReady) {
      openOnboardingTour(0)
    }
  }, [onboardingCompleted, tavernReady, chatReady])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeGuide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) {
    return null
  }

  return <GuideDialogBody />
}

const GuideDialogBody = () => {
  const mode = useGuide((s) => s.mode)

  return (
    <div className={styles.mask} onClick={closeGuide}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="猫猫酒馆新手教程与玩法图鉴"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <img src={appIconImg} alt="猫猫酒馆" className={styles.headerLogo} />
            <div className={styles.headerTitle}>
              <h2>
                {mode === 'tour'
                  ? '猫猫酒馆 · 3 分钟互动迎宾向导'
                  : '猫猫酒馆 · 玩法图鉴与进阶指南'}
              </h2>
              <p>
                {mode === 'tour'
                  ? '一步一实操，零门槛玩转多主题陪伴、世界书彩蛋与角色读心术'
                  : '随时按 F1 唤出手册 · 按 Ctrl+K 打开全局快捷指令台'}
              </p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.cmdBtn}
              title="打开全局快捷指令台"
              onClick={toggleCommandPalette}
            >
              <span>快捷指令</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className={styles.modeSwitchBtn}
              onClick={() =>
                mode === 'tour' ? openGuideHandbook('quickstart') : openOnboardingTour(0)
              }
            >
              {mode === 'tour' ? '查看完整百科手册' : '重看 5 步迎宾向导'}
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="关闭指南"
              onClick={closeGuide}
            >
              <TavernIcon name="close" size={16} />
            </button>
          </div>
        </header>

        {mode === 'tour' ? <OnboardingWizard /> : <GuideHandbook />}
      </div>
    </div>
  )
}

/** 5 步互动迎宾新手向导（内置沙盒演练与一键免密连接） */
const OnboardingWizard = () => {
  const step = useGuide((s) => s.tourStep)
  const uiMode = useAppearance((s) => s.uiMode)
  const connection = useConnection()
  const library = useTavern((s) => s.library)
  const connected = isConnectionReady(connection)

  const [trialBusy, setTrialBusy] = useState(false)
  const [trialMsg, setTrialMsg] = useState('')
  const [demoAction, setDemoAction] = useState(true)
  const [demoMonologue, setDemoMonologue] = useState(true)
  const [demoSceneIdx, setDemoSceneIdx] = useState(0)

  const handleQuickTrial = async () => {
    if (trialBusy) {
      return
    }
    setTrialBusy(true)
    setTrialMsg('')
    try {
      await enableQuickTrialConnection()
      setTrialMsg('✓ 已为你启用免密公共体验通道！现在可以直接和角色对话啦。')
    } catch (e) {
      setTrialMsg(e instanceof Error ? e.message : '连接失败，请打开设置检查网络。')
    } finally {
      setTrialBusy(false)
    }
  }

  return (
    <div className={styles.tourWrap}>
      <div className={styles.stepDotsRow} role="tablist" aria-label="新手引导步骤">
        {TOUR_STEPS.map((label, idx) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={step === idx}
            className={clsx(styles.stepPill, step === idx && styles.stepPillActive)}
            onClick={() => setTourStep(idx)}
          >
            <em>{idx + 1}</em>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.tourBody}>
        {/* Step 0: 欢迎与三端形态 */}
        {step === 0 ? (
          <>
            <div className={styles.tourHero}>
              <h3>推开木门，欢迎来到只属于你的私密角色互动小馆</h3>
              <p>
                猫猫酒馆融合了<strong>商业级恋爱陪伴体验</strong>与
                <strong>高自由度酒馆角色扮演引擎</strong>。所有对话记录、角色卡、心事手札与密钥均
                <strong>100% 存储在你的电脑本地（.data 目录）</strong>，无任何云端上传或内容窥探。
              </p>
            </div>

            <div className={styles.cardGrid3}>
              <button
                type="button"
                className={clsx(
                  styles.infoCard,
                  styles.infoCardInteractive,
                  uiMode === 'companion' && styles.sandboxToggleOn
                )}
                onClick={() => setUIMode('companion')}
              >
                <strong>
                  <TavernIcon name="sparkle" size={15} />
                  宽屏沉浸酒馆
                  {uiMode === 'companion' ? <i className={styles.badgeTag}>当前</i> : null}
                </strong>
                <span>
                  4 列高清角色海报大厅、动态落樱/星尘壁纸、右侧角色羁绊档案栏，适合电脑沉浸长聊。
                </span>
              </button>

              <button
                type="button"
                className={clsx(
                  styles.infoCard,
                  styles.infoCardInteractive,
                  uiMode === 'mobile' && styles.sandboxToggleOn
                )}
                onClick={() => setUIMode('mobile')}
              >
                <strong>
                  <TavernIcon name="phone" size={15} />
                  手机陪伴 APP 模式
                  {uiMode === 'mobile' ? <i className={styles.badgeTag}>当前</i> : null}
                </strong>
                <span>
                  「酒馆 / 消息 / 名册 / 我的」四栏竖屏陪伴体验，支持电脑手机壳预览与真机 Wi-Fi
                  安装。
                </span>
              </button>

              <button
                type="button"
                className={clsx(
                  styles.infoCard,
                  styles.infoCardInteractive,
                  uiMode === 'ds' && styles.sandboxToggleOn
                )}
                onClick={() => setUIMode('ds')}
              >
                <strong>
                  <TavernIcon name="classic" size={15} />
                  DS 原版经典极简
                  {uiMode === 'ds' ? <i className={styles.badgeTag}>当前</i> : null}
                </strong>
                <span>
                  100% 还原官方极简布局，内置深海蓝、暖陶书卷、雾粉、松烟墨绿等 6 款专属护眼主题。
                </span>
              </button>
            </div>

            <div className={styles.statusCallout}>
              <div>
                <strong>💡 操作省心小贴士</strong>
                <p>
                  无论在哪个界面，随时按下键盘 Ctrl + K
                  即可呼出「全局快捷指令台」，一键跳转任何深层功能！
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={() => {
                  closeGuide()
                  openAppearanceDrawer()
                }}
              >
                试玩装扮工坊 →
              </button>
            </div>
          </>
        ) : null}

        {/* Step 1: 唤醒 AI 模型连接 */}
        {step === 1 ? (
          <>
            <div className={styles.tourHero}>
              <h3>第一步：为角色注入灵魂（3 种方式连接 AI 大模型）</h3>
              <p>
                酒馆里的角色需要连接 AI 模型才能开口回应你。我们已内置{' '}
                <strong>
                  DeepSeek、火山引擎（豆包）、OpenCode、Cline、硅基流动、OpenRouter、MiniMax、本地
                  Ollama 等 19 款主流渠道
                </strong>
                ，且每个渠道的密钥独立记忆、互不覆盖！
              </p>
            </div>

            <div className={styles.statusCallout}>
              <div>
                <strong>
                  {connected
                    ? `✓ 当前模型已就绪（${connection.model}）`
                    : '○ 当前尚未配置 API 密钥，任选下方一种方式即可立刻开聊'}
                </strong>
                <p>
                  {trialMsg ||
                    '还没有购买任何 API Key？点击右侧「一键启用免密体验通道」即可先零门槛免费试玩！'}
                </p>
              </div>
              {!connection.hasApiKey ? (
                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  disabled={trialBusy}
                  onClick={() => void handleQuickTrial()}
                >
                  {trialBusy ? '正在连接…' : '⚡ 一键启用免密体验通道'}
                </button>
              ) : null}
            </div>

            <div className={styles.cardGrid3}>
              <div className={styles.infoCard}>
                <strong>🌟 新手零成本尝鲜</strong>
                <span>
                  选用 <strong>OpenCode Zen</strong>（填 <code>public</code> 免密）或{' '}
                  <strong>智谱 GLM-4-Flash</strong>、<strong>硅基流动</strong> 新客免费额度，5
                  秒开启初遇。
                </span>
              </div>
              <div className={styles.infoCard}>
                <strong>🔥 中文角色拉扯天花板</strong>
                <span>
                  强烈推荐 <strong>DeepSeek V3/R1</strong>、
                  <strong>火山方舟（豆包 Seed 2.0）</strong>、<strong>MiniMax</strong> 与{' '}
                  <strong>阶跃星辰</strong>，中文情感极细腻。
                </span>
              </div>
              <div className={styles.infoCard}>
                <strong>🛡️ 本机离线 100% 私密</strong>
                <span>
                  电脑运行了 <strong>Ollama</strong> 或 <strong>LM Studio</strong>
                  ？选择对应预设无需填 Key 即可断网游玩。
                </span>
              </div>
            </div>

            <div>
              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={() => {
                  closeGuide()
                  openSettings('connection')
                }}
              >
                打开「19 款渠道接入面板」配置我的专属密钥 →
              </button>
            </div>
          </>
        ) : null}

        {/* Step 2: 互动演出语法沙盒 */}
        {step === 2 ? (
          <>
            <div className={styles.tourHero}>
              <h3>第二步：掌握酒馆演出魔法（点击下方开关实时预览效果！）</h3>
              <p>
                和普通问答不同，酒馆支持
                <strong>小说级动作描写、角色读心术、导演灵感纸条与平行剧本换幕</strong>
                。试试点按下面的开关看看对话会发生什么变化：
              </p>
            </div>

            <div className={styles.sandboxBox}>
              <div className={styles.sandboxControls}>
                <span>点按体验：</span>
                <button
                  type="button"
                  className={clsx(styles.sandboxToggle, demoAction && styles.sandboxToggleOn)}
                  onClick={() => setDemoAction((v) => !v)}
                >
                  {demoAction ? '✓ 已加 *神态动作描写*' : '+ 加入 *神态动作描写*'}
                </button>
                <button
                  type="button"
                  className={clsx(styles.sandboxToggle, demoMonologue && styles.sandboxToggleOn)}
                  onClick={() => setDemoMonologue((v) => !v)}
                >
                  {demoMonologue ? '✓ 已开 💭 角色读心术' : '+ 开启 💭 角色读心术'}
                </button>
                <button
                  type="button"
                  className={styles.sandboxToggle}
                  onClick={() => setDemoSceneIdx((v) => (v + 1) % 2)}
                >
                  ↻ 切换平行回应分支 ({demoSceneIdx + 1}/2)
                </button>
              </div>

              <div className={styles.sandboxStage}>
                <div className={styles.demoUserBubble}>
                  {demoAction ? (
                    <>
                      <em style={{ color: 'var(--mn-em-color)', marginRight: 6 }}>
                        捧起温热的白桃乌龙抿了一口，抬头弯起眼睛看他
                      </em>
                      <span className={styles.demoQuote}>「今晚这杯特调，老板算不算请客呀？」</span>
                    </>
                  ) : (
                    '今晚这杯特调算不算请客呀？'
                  )}
                </div>

                <div className={styles.demoCharRow}>
                  <Avatar name="沈星回" src="preset:shen-xinghui" size="s" />
                  <div className={styles.demoCharBubble}>
                    {demoSceneIdx === 0 ? (
                      <>
                        <em>
                          青年擦拭酒杯的指尖微顿，细框眼镜后的琥珀色眼眸漾开三分无奈又纵容的笑意，顺手将草莓大福推到你手边：
                        </em>{' '}
                        <span className={styles.demoQuote}>
                          「只请我们家迟到了十七分钟的小常客——不仅这杯免单，连今晚剩下的时间也一并赔给你。」
                        </span>
                      </>
                    ) : (
                      <>
                        <em>
                          他低笑一声绕出吧台，倾身替你理好微乱的围巾，温热的指腹若有似无擦过你的耳廓：
                        </em>{' '}
                        <span className={styles.demoQuote}>
                          「想让我请客呀？那得看某人今晚愿不愿意留下来陪奶盖玩到打烊了。」
                        </span>
                      </>
                    )}
                    {demoMonologue ? (
                      <div className={styles.demoHeartBox}>
                        💭 <strong>沈星回的心声（心率 108 bpm）</strong>
                        ：她捧着杯子抬头笑的那一秒差点没移开眼……别说一杯白桃乌龙，把整个酒馆的钥匙交出去都甘愿。
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.cardGrid2}>
              <div className={styles.infoCard}>
                <strong>✦ 输入框左下角快捷胶囊</strong>
                <span>
                  无需手打符号！聊天框左下角自带 <code>*动作*</code>、<code>「台词」</code>、
                  <code>✦ 灵感（8种推进剧情纸条）</code> 与 <code>💭 读心</code> 开关。
                </span>
              </div>
              <div className={styles.infoCard}>
                <strong>🔀 不满意随时开平行时间线</strong>
                <span>
                  点击回复下方的「重新生成」或「编辑我的上一句话」，<strong>不会删掉原剧情</strong>
                  ，而是生成可随时左右切换的 <code>&lt; 1/2 &gt;</code> 分支树！
                </span>
              </div>
            </div>
          </>
        ) : null}

        {/* Step 3: 四大进阶核心机制 */}
        {step === 3 ? (
          <>
            <div className={styles.tourHero}>
              <h3>第三步：一图分清酒馆「四大养成系统」</h3>
              <p>
                很多新玩家分不清「角色设定」「世界书」「心事手札」和「文风预设」的区别——其实只要记住下面四句话就能成为高玩：
              </p>
            </div>

            <div className={styles.cardGrid2}>
              <div className={styles.infoCard}>
                <strong>
                  1. 我的人设（<code>{'{{user}}'}</code>）
                  <i className={styles.badgeTag}>全局我是谁</i>
                </strong>
                <span>
                  决定所有角色怎么称呼和认识你（内置夜猫子插画师、反差白领、直球学妹等 6
                  套一键模板）。所有角色卡里的 <code>{'{{user}}'}</code> 都会自动替换成你的名字！
                </span>
              </div>

              <div className={styles.infoCard}>
                <strong>
                  2. 世界书（Lorebook）
                  <i className={styles.badgeTag}>按词触发省预算</i>
                </strong>
                <span>
                  存放隐藏背景与秘密彩蛋！平时不占上下文，
                  <strong>只有对话里提到触发关键词时才自动唤醒</strong>
                  （例如对沈星回提「奶盖」「晚安白桃」会触发专属设定）。
                </span>
              </div>

              <div className={styles.infoCard}>
                <strong>
                  3. 心事手札（聊天顶栏）
                  <i className={styles.badgeTag}>本局长期记忆</i>
                </strong>
                <span>
                  聊了几十轮怕他忘掉约定？在聊天顶栏打开「心事手札」，记下你们的
                  <strong>专属昵称、交往阶段、纪念日</strong>，后续每一轮都会常驻提醒他！
                </span>
              </div>

              <div className={styles.infoCard}>
                <strong>
                  4. 文风与预设
                  <i className={styles.badgeTag}>控制叙事腔调</i>
                </strong>
                <span>
                  不喜欢长篇小说风？可在「名册 → 文风与预设」一键切换为
                  <strong>「手机气泡秒回风（模拟微信短句）」</strong>、
                  <strong>「微醺暧昧拉扯」</strong>或<strong>「深夜哄睡」</strong>！
                </span>
              </div>
            </div>
          </>
        ) : null}

        {/* Step 4: 选择主角带着彩蛋词出发 */}
        {step === 4 ? (
          <>
            <div className={styles.tourHero}>
              <h3>准备就绪！挑选一位心动对象，推开今晚的故事之门吧</h3>
              <p>
                点击下方任意角色，即可直接进入带开场白的专属房间（进入后还可以在开场气泡右上角点击{' '}
                <code>剧本 1/3 · 换一幕 ↻</code> 体验不同平行初遇场景哦！）：
              </p>
            </div>

            <div className={styles.cardGrid2}>
              {STARTER_CAST_GUIDES.map((item) => {
                const targetChar = library.characters.find((c) => c.name === item.name)
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={clsx(styles.infoCard, styles.infoCardInteractive)}
                    onClick={async () => {
                      closeGuide()
                      if (targetChar) {
                        await selectCharacter(targetChar.id)
                        startCharacterSession({
                          character: targetChar,
                          persona: library.persona,
                          preset: library.preset,
                        })
                      } else {
                        openTavern(null, 'characters')
                      }
                    }}
                  >
                    <div className={styles.castGuideHead}>
                      <Avatar name={item.name} src={item.avatar} size="m" />
                      <div className={styles.castGuideMeta}>
                        <strong>{item.name}</strong>
                        <span>{item.archetype}</span>
                      </div>
                    </div>
                    <span>{item.tips}</span>
                    <span style={{ color: 'var(--dsw-alias-brand-text)', fontWeight: 500 }}>
                      🔑 试试在对话里提：
                      {item.secretKeywords.map((k) => k.word.split(' / ')[0]).join(' · ')}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      <footer className={styles.tourFooter}>
        <button type="button" className={styles.skipLink} onClick={closeGuide}>
          跳过引导（随时可在侧栏或顶栏点「新手指南」重看）
        </button>

        <div className={styles.tourNavBtns}>
          {step > 0 ? (
            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={() => setTourStep(step - 1)}
            >
              上一步
            </button>
          ) : null}
          {step < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => setTourStep(step + 1)}
            >
              下一步：{TOUR_STEPS[step + 1]} →
            </button>
          ) : (
            <button type="button" className={styles.primaryActionBtn} onClick={closeGuide}>
              ✦ 完成引导，开始探索酒馆
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

/** 6 大专题全景百科手册（含实时进度检测清单与一键实操跳转） */
const GuideHandbook = () => {
  const activeTab = useGuide((s) => s.activeTab)
  const connection = useConnection()
  const library = useTavern((s) => s.library)
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeId)
  const innerMonologue = useAppearance((s) => s.innerMonologue)
  const skin = useAppearance((s) => s.skin)
  const [trialBusy, setTrialBusy] = useState(false)

  // 实时检测玩家探索进度
  const stepConnected = isConnectionReady(connection)
  const stepPersona =
    library.persona.name.trim() !== '我' || library.persona.description.trim().length > 0
  const stepStartedChat = sessions.length > 0
  const stepTriedMonologue = innerMonologue
  const stepCustomPreset = library.preset.system !== defaultPreset.system
  const stepStyled = skin !== 'sakura'

  const checklistItems = [
    {
      done: stepConnected,
      title: '1. 唤醒首个 AI 模型渠道',
      desc: stepConnected
        ? `当前已连接：${connection.model}`
        : '连接火山引擎、DeepSeek、OpenCode 或本机模型，让角色开口回应你',
      actionLabel: stepConnected ? '管理渠道' : '去连接模型 →',
      onAction: () => {
        closeGuide()
        openSettings('connection')
      },
    },
    {
      done: stepPersona,
      title: '2. 定制「我的人设 ({{user}})」',
      desc: stepPersona
        ? `当前身份：${library.persona.name}`
        : '花 10 秒套用一套身份模板，让所有角色记住你的名字、性格与小习惯',
      actionLabel: '设置我的人设 →',
      onAction: () => {
        closeGuide()
        openTavern(library.selectedId, 'persona')
      },
    },
    {
      done: stepStartedChat,
      title: '3. 开启第一段角色初遇故事',
      desc: '挑选一位馆藏角色开启对话，试试右上角「换一幕 ↻」切换平行初遇剧本',
      actionLabel: '挑选角色开聊 →',
      onAction: async () => {
        const first = library.characters[0]
        closeGuide()
        if (first) {
          await selectCharacter(first.id)
          startCharacterSession({
            character: first,
            persona: library.persona,
            preset: library.preset,
          })
        }
      },
    },
    {
      done: stepTriedMonologue,
      title: '4. 开启「💭 角色读心小剧场」',
      desc: '让角色在每轮回复末尾偷偷附上此刻未说出口的真实心声与心动心率',
      actionLabel: stepTriedMonologue ? '已开启读心' : '一键开启读心',
      onAction: () => {
        if (!innerMonologue) {
          toggleInnerMonologue()
          showToast('已开启「💭 角色读心小剧场」，下一轮回复即可偷看心声！')
        }
      },
    },
    {
      done: stepCustomPreset,
      title: '5. 尝试切换「叙事文风预设」',
      desc: '在电影感日常、微醺暧昧拉扯、手机微信短句秒回、深夜哄睡等 6 种文风间自由切换',
      actionLabel: '切换文风预设 →',
      onAction: () => {
        closeGuide()
        openTavern(library.selectedId, 'preset')
      },
    },
    {
      done: stepStyled,
      title: '6. 装扮专属酒馆氛围与壁纸',
      desc: '体验深空星夜、黑曜玫瑰、丝绒红茶或 DS 专属 6 套主题，自由调节背景柔焦与樱花雨',
      actionLabel: '打开装扮工坊 →',
      onAction: () => {
        closeGuide()
        openAppearanceDrawer()
      },
    },
  ]

  const completedCount = checklistItems.filter((i) => i.done).length
  const progressPct = Math.round((completedCount / checklistItems.length) * 100)

  const injectPromptToChat = (text: string) => {
    setDraftText(activeSessionId, text)
    closeGuide()
    showToast('已填入聊天输入框，可直接发送或按需修改！')
    requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true })
    )
  }

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('指令已复制到剪贴板！')
    } catch {
      injectPromptToChat(text)
    }
  }

  return (
    <div className={styles.handbookLayout}>
      <nav className={styles.handbookNav} aria-label="玩法图鉴章节">
        {HANDBOOK_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx(styles.navTabBtn, activeTab === item.id && styles.navTabActive)}
            onClick={() => setGuideTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.handbookContent}>
        {/* Tab 1: 新手速通清单 */}
        {activeTab === 'quickstart' ? (
          <>
            <div className={styles.progressCard}>
              <div className={styles.progressTop}>
                <strong>
                  酒馆探索完成度（{completedCount} / {checklistItems.length}）
                </strong>
                <span>{progressPct}%</span>
              </div>
              <div className={styles.progressBar}>
                <i style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {!connection.hasApiKey ? (
              <div className={styles.statusCallout}>
                <div>
                  <strong>⚡ 还没有 API Key 想立刻试玩？</strong>
                  <p>点击右侧按钮自动配置 OpenCode 免费公共体验通道，无需注册即可先跟角色聊天。</p>
                </div>
                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  disabled={trialBusy}
                  onClick={async () => {
                    setTrialBusy(true)
                    try {
                      await enableQuickTrialConnection()
                      showToast('已启用免密体验通道！')
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : '连接失败')
                    } finally {
                      setTrialBusy(false)
                    }
                  }}
                >
                  {trialBusy ? '配置中…' : '一键启用免密试玩'}
                </button>
              </div>
            ) : null}

            <div className={styles.checklist}>
              {checklistItems.map((item) => (
                <div key={item.title} className={styles.checkItem}>
                  <div className={styles.checkLeft}>
                    <i className={clsx(styles.checkMark, item.done && styles.checkMarkDone)}>
                      {item.done ? '✓' : ''}
                    </i>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.desc}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => void item.onAction()}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Tab 2: 演出技巧与防卡文咒语库 */}
        {activeTab === 'roleplay' ? (
          <>
            <div className={styles.sectionBlock}>
              <h3>三大黄金演出符号（让回复质感瞬间翻倍）</h3>
              <div className={styles.cardGrid3}>
                <div className={styles.infoCard}>
                  <strong>
                    1. 星号包裹动作 <code>*…*</code>
                  </strong>
                  <span>
                    例如：<code>*垂下眼睫轻抿一口热茶*</code>
                    。系统会自动隐去星号并渲染为优雅斜体，角色也会默契回敬细腻的神态描写。
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <strong>
                    2. 直角引号台词 <code>「…」</code>
                  </strong>
                  <span>
                    例如：<code>「今晚外头风好大呀。」</code>
                    。开启台词高亮后会自动着上专属玫瑰金/星芒紫配色，阅读层次一目了然。
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <strong>
                    3. 括号皮下导演法 <code>（…）</code>
                  </strong>
                  <span>
                    不出戏就能指挥走向！在句末附上 <code>（导演提示：请让他嘴硬但耳根发红）</code>
                    ，模型会立刻领会你的剧本意图。
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <h3>老玩家私藏：8 条防卡文 / 校准人设 / 升温导演咒语</h3>
              <p>点击「填入聊天框」即可直接发送到当前对话，或微调括号里的要求：</p>
              {ADVANCED_RP_PROMPTS.map((item) => (
                <div key={item.id} className={styles.promptCard}>
                  <div className={styles.promptHead}>
                    <strong>{item.title}</strong>
                    <span className={styles.badgeTag}>{item.category}</span>
                  </div>
                  <p className={styles.promptQuote}>{item.prompt}</p>
                  <div className={styles.promptBtns}>
                    <small>适用场景：{item.usage}</small>
                    <div>
                      <button
                        type="button"
                        className={styles.miniPillBtn}
                        onClick={() => void copyPrompt(item.prompt)}
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        className={styles.miniPillBtn}
                        onClick={() => injectPromptToChat(item.prompt)}
                      >
                        填入聊天框 →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Tab 3: 名册·世界书·手札深度拆解 */}
        {activeTab === 'systems' ? (
          <>
            <div className={styles.sectionBlock}>
              <h3>高自由度养成系统深度讲解</h3>
              <p>理解数据是怎么流转的，就能自己捏出不输商业大作的神仙角色卡：</p>
            </div>

            <div className={styles.infoCard}>
              <strong>📌 什么是「会话角色快照」？（为什么改了角色卡旧对话没变？）</strong>
              <span>
                为了保护你珍贵的旧故事不被意外写坏，每当你开启一段新对话时，系统会为该房间保存一份
                <strong>独立的角色设定快照</strong>。如果你在「酒馆名册」修改了角色设定并希望在
                <strong>当前旧对话</strong>里立即生效，只需点击名册底部的
                <strong>「将『角色名』应用到当前对话」</strong>按钮即可同步！
              </span>
            </div>

            <div className={styles.infoCard}>
              <strong>🌍 世界书（Lorebook）怎么填最聪明？</strong>
              <span>
                • <strong>关键词触发</strong>：多个同义词用逗号隔开（如{' '}
                <code>怀表, 钟表, 礼物</code>）。系统会扫描最近 N 轮消息（默认 12
                轮），命中任意一词即自动把该条背景注入本轮提示词，平时完全不耗 Token！
                <br />• <strong>常驻生效（Constant）</strong>
                ：勾选后无论聊什么都会带上，适合存放不可动摇的世界法则。
                <br />• <strong>优先级（Priority）</strong>
                ：数字越大越优先保留，当世界书总字数超过「世界书预算」时，优先保留高优先级词条。
              </span>
              <div>
                <button
                  type="button"
                  className={styles.miniPillBtn}
                  onClick={() => {
                    closeGuide()
                    openTavern(library.selectedId ?? library.characters[0]?.id, 'lore')
                  }}
                >
                  去查看 / 编辑世界书 →
                </button>
              </div>
            </div>

            <div className={styles.infoCard}>
              <strong>📓 心事手札（Story Memory）与世界书怎么配合？</strong>
              <span>
                • <strong>世界书</strong>
                放「角色原本就有的过去与秘密」（跟角色卡走，导出角色卡时会一起打包）。
                <br />• <strong>心事手札</strong>
                放「你们在这段故事里新发生的进展」（跟当前聊天存档走，同一会话的所有平行分支共享）。建议每聊
                20～30 轮，把确定的新昵称、关系进展记入手札，哪怕聊上千轮他也永远记得！
              </span>
            </div>

            <div className={styles.infoCard}>
              <strong>🎴 如何导入外部 SillyTavern（酒馆）PNG / JSON 角色卡？</strong>
              <span>
                打开「酒馆名册」点击左上角<strong>「导入角色卡」</strong>，直接选择社区下载的{' '}
                <code>chara_card_v2 / v3</code> 格式 <code>.png</code>（带内嵌数据的立绘卡）或{' '}
                <code>.json</code> 文件，角色的立绘、性格、多开场白（
                <code>alternate_greetings</code>）与自带世界书都会一键完整解析导入！
              </span>
              <div>
                <button
                  type="button"
                  className={styles.miniPillBtn}
                  onClick={() => {
                    closeGuide()
                    openTavern(null, 'characters')
                  }}
                >
                  打开酒馆名册导入或用模板创建角色 →
                </button>
              </div>
            </div>
          </>
        ) : null}

        {/* Tab 4: 馆藏角色攻略与彩蛋 */}
        {activeTab === 'cast' ? (
          <>
            <div className={styles.sectionBlock}>
              <h3>馆藏四位主角互动指南 & 隐藏世界书触发词</h3>
              <p>
                每位馆藏主角都内置了多幕平行初遇剧本与隐藏世界书彩蛋，点击「携彩蛋开聊」可直接去触发他的秘密反应：
              </p>
            </div>

            {STARTER_CAST_GUIDES.map((item) => {
              const target = library.characters.find((c) => c.name === item.name)
              const firstKeyword = item.secretKeywords[0]?.word.split(' / ')[0] ?? ''
              return (
                <div key={item.name} className={styles.castGuideCard}>
                  <div className={styles.castGuideHead}>
                    <Avatar name={item.name} src={item.avatar} size="m" />
                    <div className={styles.castGuideMeta}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.archetype} · 推荐文风：{item.recommendedStyle}
                      </span>
                    </div>
                    {target ? (
                      <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={async () => {
                          closeGuide()
                          await selectCharacter(target.id)
                          const sid = startCharacterSession({
                            character: target,
                            persona: library.persona,
                            preset: library.preset,
                          })
                          if (sid && firstKeyword) {
                            setDraftText(
                              sid,
                              `*好奇地眨了眨眼睛望向${item.name}* 「对了，刚才就想问你关于${firstKeyword}的事呢？」`
                            )
                          }
                        }}
                      >
                        携彩蛋去找他 →
                      </button>
                    ) : null}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      color: 'var(--dsw-alias-label-secondary)',
                    }}
                  >
                    <strong>相处攻略：</strong>
                    {item.tips}
                  </p>
                  <div className={styles.secretList}>
                    {item.secretKeywords.map((kw) => (
                      <div key={kw.word} className={styles.secretItem}>
                        <code>🔑 {kw.word}</code>
                        <span>{kw.effect}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--dsw-alias-label-tertiary)' }}>
                    内置平行初遇幕：{item.parallelScenes.join(' ｜ ')}
                  </div>
                </div>
              )
            })}
          </>
        ) : null}

        {/* Tab 5: 19款API选型与参数指南 */}
        {activeTab === 'channels' ? (
          <>
            <div className={styles.sectionBlock}>
              <h3>19 款内置渠道怎么选？（按需求对号入座）</h3>
              <p>
                每个渠道在「设置 → 模型连接」中独立保存各自的 API Key，配置一次即可随时一键切换：
              </p>
            </div>

            <div className={styles.cardGrid2}>
              <div className={styles.infoCard}>
                <strong>👑 中文古言/现言拉扯首选</strong>
                <span>
                  • <strong>DeepSeek 官方 / 火山方舟</strong>：<code>deepseek-chat (V3)</code> 与{' '}
                  <code>doubao-seed-2.0-pro</code> 性价比极高，心理与细节描写稳健。
                  <br />• <strong>MiniMax 稀宇</strong>：百万长窗口，情绪极其温柔细腻。
                  <br />• <strong>阶跃星辰 Step-2 / Kimi K2</strong>：中文小说网文感极佳。
                </span>
              </div>

              <div className={styles.infoCard}>
                <strong>🎭 海外顶配文学剧场（Claude 系列）</strong>
                <span>
                  • <strong>Cline 官方 / OpenRouter / OpenCode</strong>：一个 Key 即可畅玩{' '}
                  <code>claude-sonnet-4-5 / 4-6</code> 与 <code>gemini-2.5-pro</code>
                  ，长篇逻辑与人设还原度公认顶级。
                  <br />• <strong>通用中转 / Anthropic 原生</strong>：完美兼容各类酒馆公益站与商业
                  NewAPI 中转站。
                </span>
              </div>
            </div>

            <div className={styles.infoCard}>
              <strong>🎛️ 预设里的数值参数看不懂？一句话讲明白：</strong>
              <span>
                • <strong>创作温度（Temperature，默认 0.9）</strong>
                ：调高（0.95～1.1）文采更灵动多变、更有惊喜；调低（0.6～0.8）逻辑更稳重克制。注意使用
                Anthropic 原生协议时系统会自动安全钳制在 0～1。
                <br />• <strong>上下文总预算（字符，默认 24000）</strong>
                ：每轮发给模型的历史对话最大字数。超出时系统会智能裁掉最早的旧回合，
                <strong>绝不会截断系统人设、开场白、心事手札与你刚发的最新消息</strong>。
                <br />• <strong>单次最大回复 Token（默认 2048）</strong>：想让角色写长篇小说可调至
                3000+；喜欢手机微信短句秒回可调至 500～800。
              </span>
              <div>
                <button
                  type="button"
                  className={styles.miniPillBtn}
                  onClick={() => {
                    closeGuide()
                    openSettings('connection')
                  }}
                >
                  打开多渠道接入工作台 →
                </button>
              </div>
            </div>
          </>
        ) : null}

        {/* Tab 6: 快捷键与存档安全 */}
        {activeTab === 'shortcuts' ? (
          <>
            <div className={styles.sectionBlock}>
              <h3>效率倍增：全局键盘快捷键</h3>
              <div className={styles.checklist}>
                <div className={styles.keyRow}>
                  <span>呼出「酒馆全局快捷指令台」（秒切角色 / 读心 / 文风 / 导出）</span>
                  <kbd>Ctrl / ⌘ + K</kbd>
                </div>
                <div className={styles.keyRow}>
                  <span>随时打开 / 关闭本「玩法图鉴与新手手册」</span>
                  <kbd>F1 或 Ctrl + /</kbd>
                </div>
                <div className={styles.keyRow}>
                  <span>发送消息 / 在输入框内换行</span>
                  <kbd>Enter 发送 · Shift + Enter 换行</kbd>
                </div>
                <div className={styles.keyRow}>
                  <span>关闭任意弹窗、立绘灯箱或装扮抽屉</span>
                  <kbd>Esc</kbd>
                </div>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <h3>三种存档与纪念导出方式对比</h3>
              <div className={styles.cardGrid3}>
                <div className={styles.infoCard}>
                  <strong>📦 酒馆完整备份 (.json)</strong>
                  <span>
                    <strong>最推荐的换机/定期存档方式！</strong>
                    打包全部聊天分支、角色名册、我的人设、世界书、置顶与心事手札（且自动剥离 API Key
                    防泄露）。
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <strong>📜 珍藏轻小说剧本 (.md)</strong>
                  <span>
                    在聊天顶栏或右侧档案卡点击下载图标，将<strong>当前最满意的一条剧情线</strong>
                    导出为排版优美的小说 Markdown 文档留念。
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <strong>🗂️ DeepSeek 兼容归档 (.zip)</strong>
                  <span>支持直接把你在 DeepSeek 官网导出的历史聊天 ZIP 包导入进酒馆继续续写。</span>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  onClick={() => {
                    closeGuide()
                    openSettings('data')
                  }}
                >
                  前往「备份与数据」管理存档 →
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
