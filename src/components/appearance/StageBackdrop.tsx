import clsx from 'clsx'
import { useAppearance } from '../../services/appearance.js'
import { WALLPAPER_IMAGES } from '../../services/tavern/assets.js'
import styles from './StageBackdrop.module.css'

/** 商业级实景插画壁纸 + 景深柔焦遮罩 + 动态微粒子氛围层 */
export const StageBackdrop = ({ variant = 'stage' }: { variant?: 'stage' | 'ambient' }) => {
  const uiMode = useAppearance((s) => s.uiMode)
  const wallpaper = useAppearance((s) => s.wallpaper)
  const customUrl = useAppearance((s) => s.customWallpaperUrl)
  const blur = useAppearance((s) => s.wallpaperBlur)
  const dim = useAppearance((s) => s.wallpaperDim)
  const ambience = useAppearance((s) => s.ambience)

  if (uiMode === 'ds' || (wallpaper === 'none' && ambience === 'none')) {
    return null
  }

  const imageUrl =
    wallpaper === 'custom' ? customUrl : wallpaper !== 'none' ? WALLPAPER_IMAGES[wallpaper] : ''
  const effectiveBlur = variant === 'ambient' ? Math.max(16, blur + 12) : blur
  const showParticles = ambience !== 'none' && variant === 'stage'

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {imageUrl ? (
        <div
          className={styles.wallpaperImage}
          style={{
            backgroundImage: `url("${imageUrl}")`,
            filter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
          }}
        />
      ) : null}

      {imageUrl ? (
        <div
          className={styles.scrim}
          style={{
            opacity: Math.min(0.92, Math.max(0.12, (variant === 'ambient' ? dim + 8 : dim) / 100)),
          }}
        />
      ) : null}

      {showParticles ? (
        <div className={clsx(styles.particles, styles[`ambience_${ambience}`])}>
          {Array.from({ length: 12 }).map((_, idx) => (
            <i key={idx} style={{ '--i': idx } as React.CSSProperties} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
