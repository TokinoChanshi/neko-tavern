import { useState } from 'react'
import { resolveAvatarUrl } from '../../services/tavern/assets.js'

export const Avatar = ({
  name,
  src = '',
  size = 'm',
}: {
  name: string
  src?: string
  size?: 'xs' | 's' | 'm' | 'l' | 'hero' | 'card'
}) => {
  const [failed, setFailed] = useState('')
  const tone = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
  const resolved = resolveAvatarUrl(src, name)
  const showImg = Boolean(resolved && resolved !== failed)

  return (
    <span
      className={`tavern-portrait tavern-portrait-${size} tavern-tone-${tone}`}
      aria-hidden="true"
    >
      {showImg ? (
        <img
          src={resolved}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(resolved)}
        />
      ) : (
        <span className="mn-portrait-monogram">{[...name][0] || '·'}</span>
      )}
    </span>
  )
}
