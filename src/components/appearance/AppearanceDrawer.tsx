import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import {
  clearCustomWallpaper,
  closeAppearanceDrawer,
  DS_THEMES,
  resetAppearance,
  setUIMode,
  updateAppearance,
  uploadCustomWallpaper,
  useAppearance,
  type AmbienceEffect,
  type BubbleMaterial,
  type ChatWidth,
  type FontScale,
  type FontStyle,
  type SkinId,
  type StageLayout,
  type WallpaperId,
} from '../../services/appearance.js'
import { setThemePreference, useSettings, type ThemePreference } from '../../services/settings.js'
import { WALLPAPER_IMAGES } from '../../services/tavern/assets.js'
import { IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16 } from '../base/icons.js'
import { TavernIcon } from '../tavern/TavernIcon.js'
import styles from './AppearanceDrawer.module.css'

const SKINS: {
  id: SkinId
  name: string
  tag: string
  previewClass: string
}[] = [
  { id: 'sakura', name: '樱雾白桃', tag: '甜美晶透 · 玫瑰金', previewClass: 'skin_sakura' },
  { id: 'starlight', name: '深空星夜', tag: '极光雾紫 · 宿命感', previewClass: 'skin_starlight' },
  { id: 'salon', name: '丝绒红茶', tag: '复古猫咖 · 暖琥珀', previewClass: 'skin_salon' },
  { id: 'celadon', name: '森屿青提', tag: '烟雨青瓷 · 氧气感', previewClass: 'skin_celadon' },
  { id: 'obsidian', name: '黑曜玫瑰', tag: '高定暗夜 · 丝绒绯金', previewClass: 'skin_obsidian' },
  { id: 'ds-native', name: 'DS 清透蓝', tag: '科技蓝白 · 陪伴舞台', previewClass: 'skin_ds' },
]

const STAGE_LAYOUTS: { id: StageLayout; name: string; desc: string }[] = [
  { id: 'bubbles', name: '心动气泡', desc: '陪伴感精致角色头像与气泡' },
  { id: 'novel', name: '轻小说剧场', desc: '居中沉浸书页与文学行距' },
  { id: 'minimal', name: '纯净流式', desc: '无边框清爽流式排版' },
]

const MATERIALS: { id: BubbleMaterial; name: string }[] = [
  { id: 'glass', name: '晶透毛玻璃' },
  { id: 'soft', name: '温润奶油卡' },
  { id: 'minimal', name: '极简轻描边' },
]

const AMBIENCES: { id: AmbienceEffect; name: string }[] = [
  { id: 'none', name: '关闭特效' },
  { id: 'bokeh', name: '微醺流光' },
  { id: 'petals', name: '落樱微风' },
  { id: 'stars', name: '星河微尘' },
  { id: 'rain', name: '听雨窗影' },
]

const WALLPAPERS: { id: Exclude<WallpaperId, 'custom'>; name: string }[] = [
  { id: 'none', name: '纯净无壁纸' },
  { id: 'greenhouse', name: '暮色花房' },
  { id: 'clocktower', name: '星穹钟楼' },
  { id: 'tavern', name: '暖灯酒馆' },
  { id: 'courtyard', name: '晨雾茶庭' },
]

const FONTS: { id: FontStyle; name: string; sample: string }[] = [
  { id: 'sans', name: '现代清秀黑体', sample: '今夜月色很美' },
  { id: 'serif', name: '文学书卷宋体', sample: '今夜月色很美' },
  { id: 'kai', name: '温柔手写楷体', sample: '今夜月色很美' },
]

const SCALES: { id: FontScale; name: string }[] = [
  { id: 'sm', name: '小巧 (14px)' },
  { id: 'md', name: '舒适 (15.5px)' },
  { id: 'lg', name: '舒展 (17px)' },
]

const WIDTHS: { id: ChatWidth; name: string }[] = [
  { id: 'standard', name: '标准居中' },
  { id: 'wide', name: '宽屏剧场' },
]

const LIGHTING: { id: ThemePreference; name: string; icon: React.ReactNode }[] = [
  { id: 'light', name: '白昼', icon: <IconLightOutline16 /> },
  { id: 'dark', name: '夜色', icon: <IconDarkOutline16 /> },
  { id: 'system', name: '自动', icon: <IconFollowsystemOutline16 /> },
]

export const AppearanceDrawer = () => {
  const open = useAppearance((s) => s.drawerOpen)
  if (!open) {
    return null
  }
  return <DrawerBody />
}

const DrawerBody = () => {
  const app = useAppearance()
  const themePreference = useSettings((s) => s.themePreference)
  const [tab, setTab] = useState<'skin' | 'stage' | 'type'>('skin')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAppearanceDrawer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isDs = app.uiMode === 'ds'

  return (
    <>
      <div className={styles.mask} onClick={closeAppearanceDrawer} />
      <aside className={styles.drawer} aria-label="外观与装扮工坊">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>
              <TavernIcon name="palette" size={16} />
            </span>
            <div>
              <h2>外观与装扮工坊</h2>
              <p>三端形态切换 · 陪伴与 DS 双套主题体系</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="关闭装扮工坊"
            onClick={closeAppearanceDrawer}
          >
            <TavernIcon name="close" size={16} />
          </button>
        </header>

        {/* 三端形态切换器：宽屏陪伴 / 手机 APP / DS 原版 */}
        <div className={styles.modeSwitchCard}>
          <div className={styles.modeLabel}>界面总形态（点击即刻切换）</div>
          <div className={styles.modeButtons}>
            <button
              type="button"
              className={clsx(styles.modeBtn, app.uiMode === 'companion' && styles.modeBtnActive)}
              onClick={() => setUIMode('companion')}
            >
              <TavernIcon name="sparkle" size={15} />
              <strong>宽屏酒馆</strong>
              <span>桌面立绘大厅</span>
            </button>
            <button
              type="button"
              className={clsx(styles.modeBtn, app.uiMode === 'mobile' && styles.modeBtnActive)}
              onClick={() => setUIMode('mobile')}
            >
              <TavernIcon name="phone" size={15} />
              <strong>手机 APP</strong>
              <span>四栏竖屏陪伴</span>
            </button>
            <button
              type="button"
              className={clsx(styles.modeBtn, app.uiMode === 'ds' && styles.modeBtnActive)}
              onClick={() => setUIMode('ds')}
            >
              <TavernIcon name="classic" size={15} />
              <strong>DS 经典</strong>
              <span>原版极简界面</span>
            </button>
          </div>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'skin'}
            onClick={() => setTab('skin')}
          >
            {isDs ? 'DS 专属主题' : '陪伴皮肤'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stage'}
            onClick={() => setTab('stage')}
          >
            舞台与壁纸
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'type'}
            onClick={() => setTab('type')}
          >
            字体与排版
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'skin' ? (
            <>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>明暗光效</div>
                <div className={styles.segmented3}>
                  {LIGHTING.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={clsx(
                        styles.segBtn,
                        themePreference === item.id && styles.segBtnActive
                      )}
                      onClick={() => setThemePreference(item.id)}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {isDs ? (
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>DeepSeek 原版界面专属主题（6 款）</div>
                  <div className={styles.skinGrid}>
                    {DS_THEMES.map((dsItem) => {
                      const selected = app.dsSkin === dsItem.id
                      return (
                        <button
                          key={dsItem.id}
                          type="button"
                          className={clsx(styles.skinCard, selected && styles.skinCardActive)}
                          onClick={() => updateAppearance({ dsSkin: dsItem.id })}
                        >
                          <div className={clsx(styles.skinPreview, styles[dsItem.previewClass])}>
                            <span className={styles.mockBar} />
                            <span className={styles.mockBubbleLeft} />
                            <span className={styles.mockBubbleRight} />
                          </div>
                          <div className={styles.skinInfo}>
                            <strong>{dsItem.name}</strong>
                            <span>{dsItem.tag}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : (
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>猫猫酒馆高定陪伴皮肤（6 款）</div>
                  <div className={styles.skinGrid}>
                    {SKINS.map((skin) => {
                      const selected = app.skin === skin.id
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          className={clsx(styles.skinCard, selected && styles.skinCardActive)}
                          onClick={() => updateAppearance({ skin: skin.id })}
                        >
                          <div className={clsx(styles.skinPreview, styles[skin.previewClass])}>
                            <span className={styles.mockBar} />
                            <span className={styles.mockBubbleLeft} />
                            <span className={styles.mockBubbleRight} />
                          </div>
                          <div className={styles.skinInfo}>
                            <strong>{skin.name}</strong>
                            <span>{skin.tag}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          ) : null}

          {tab === 'stage' ? (
            <>
              {isDs ? (
                <div className={styles.dsNotice}>
                  <span>
                    DS
                    经典模式默认保持极简无背景画布；点击下方任一舞台或壁纸将自动切入陪伴视图展示。
                  </span>
                </div>
              ) : null}

              <section className={styles.section}>
                <div className={styles.sectionTitle}>对话舞台模式</div>
                <div className={styles.stackList}>
                  {STAGE_LAYOUTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={clsx(
                        styles.listOption,
                        !isDs && app.stageLayout === item.id && styles.listOptionActive
                      )}
                      onClick={() =>
                        updateAppearance({
                          uiMode: isDs ? 'companion' : app.uiMode,
                          stageLayout: item.id,
                        })
                      }
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.desc}</span>
                      </div>
                      <i className={styles.radioDot} />
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>气泡卡片材质</div>
                <div className={styles.segmented3}>
                  {MATERIALS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={clsx(
                        styles.segBtn,
                        !isDs && app.bubbleMaterial === item.id && styles.segBtnActive
                      )}
                      onClick={() =>
                        updateAppearance({
                          uiMode: isDs ? 'companion' : app.uiMode,
                          bubbleMaterial: item.id,
                        })
                      }
                    >
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>动态氛围光影</div>
                <div className={styles.chipWrap}>
                  {AMBIENCES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={clsx(
                        styles.chipBtn,
                        !isDs && app.ambience === item.id && styles.chipBtnActive
                      )}
                      onClick={() =>
                        updateAppearance({
                          uiMode: isDs ? 'companion' : app.uiMode,
                          ambience: item.id,
                        })
                      }
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <span>场景背景壁纸</span>
                  <button
                    type="button"
                    className={styles.uploadLink}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    <TavernIcon name="image" size={13} />
                    {uploading ? '上传中…' : '上传本地壁纸'}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) {
                      return
                    }
                    setUploading(true)
                    setUploadError('')
                    try {
                      await uploadCustomWallpaper(file)
                      if (isDs) {
                        updateAppearance({ uiMode: 'companion' })
                      }
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
                {uploadError ? <p className={styles.errorText}>{uploadError}</p> : null}

                <div className={styles.wallpaperGrid}>
                  {WALLPAPERS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={clsx(
                        styles.wallpaperItem,
                        !isDs && app.wallpaper === w.id && styles.wallpaperActive
                      )}
                      onClick={() =>
                        updateAppearance({
                          uiMode: isDs ? 'companion' : app.uiMode,
                          wallpaper: w.id,
                        })
                      }
                    >
                      <span
                        className={clsx(styles.wpThumb, styles[`wp_${w.id}`])}
                        style={
                          w.id !== 'none'
                            ? { backgroundImage: `url("${WALLPAPER_IMAGES[w.id]}")` }
                            : undefined
                        }
                      />
                      <small>{w.name}</small>
                    </button>
                  ))}
                  {app.customWallpaperUrl ? (
                    <button
                      type="button"
                      className={clsx(
                        styles.wallpaperItem,
                        !isDs && app.wallpaper === 'custom' && styles.wallpaperActive
                      )}
                      onClick={() =>
                        updateAppearance({
                          uiMode: isDs ? 'companion' : app.uiMode,
                          wallpaper: 'custom',
                        })
                      }
                    >
                      <span
                        className={styles.wpThumb}
                        style={{ backgroundImage: `url("${app.customWallpaperUrl}")` }}
                      />
                      <small>自定义壁纸</small>
                    </button>
                  ) : null}
                </div>

                {app.customWallpaperUrl ? (
                  <button
                    type="button"
                    className={styles.clearWpBtn}
                    onClick={() => void clearCustomWallpaper()}
                  >
                    移除已上传的自定义壁纸
                  </button>
                ) : null}

                {app.wallpaper !== 'none' && !isDs ? (
                  <div className={styles.sliders}>
                    <label className={styles.sliderField}>
                      <div>
                        <span>背景景深模糊</span>
                        <em>{app.wallpaperBlur}px</em>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={app.wallpaperBlur}
                        onChange={(e) =>
                          updateAppearance({ wallpaperBlur: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.sliderField}>
                      <div>
                        <span>文字底色柔和度</span>
                        <em>{app.wallpaperDim}%</em>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={88}
                        value={app.wallpaperDim}
                        onChange={(e) => updateAppearance({ wallpaperDim: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {tab === 'type' ? (
            <>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>阅读字体风格（全模式通用）</div>
                <div className={styles.stackList}>
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={clsx(
                        styles.listOption,
                        app.fontStyle === f.id && styles.listOptionActive
                      )}
                      onClick={() => updateAppearance({ fontStyle: f.id })}
                    >
                      <div>
                        <strong>{f.name}</strong>
                        <span className={styles[`fontSample_${f.id}`]}>{f.sample}</span>
                      </div>
                      <i className={styles.radioDot} />
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>字号大小</div>
                <div className={styles.segmented3}>
                  {SCALES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={clsx(styles.segBtn, app.fontScale === s.id && styles.segBtnActive)}
                      onClick={() => updateAppearance({ fontScale: s.id })}
                    >
                      <span>{s.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>对话阅读宽度</div>
                <div className={styles.segmented2}>
                  {WIDTHS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={clsx(styles.segBtn, app.chatWidth === w.id && styles.segBtnActive)}
                      onClick={() => updateAppearance({ chatWidth: w.id })}
                    >
                      <span>{w.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {!isDs ? (
                <section className={styles.section}>
                  <label className={styles.switchRow}>
                    <div>
                      <strong>台词与动作神态分色高亮</strong>
                      <span>自动突出「对话台词」，柔和淡化 *神态动作旁白*</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={app.dialogueHighlight}
                      onChange={(e) =>
                        updateAppearance({
                          dialogueHighlight: e.target.checked,
                        })
                      }
                    />
                  </label>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.resetBtn} onClick={resetAppearance}>
            恢复默认装扮
          </button>
          <button type="button" className={styles.doneBtn} onClick={closeAppearanceDrawer}>
            完成
          </button>
        </footer>
      </aside>
    </>
  )
}
