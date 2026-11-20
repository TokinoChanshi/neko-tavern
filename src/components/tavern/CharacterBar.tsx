import { openTavern, useTavern } from '../../services/tavern/store.js'
import type { Session } from '../../services/chat/types.js'
import { useTavernText } from './text.js'
import { Avatar } from './Avatar.js'
import { TavernIcon } from './TavernIcon.js'
import './tavern.css'
export const CharacterBar = ({ session }: { session?: Session }) => {
  const t = useTavernText()
  const library = useTavern((s) => s.library)
  const character = session
    ? session.tavern?.character
    : library.characters.find((c) => c.id === library.selectedId)
  return (
    <button className="tavern-character-bar" onClick={() => openTavern(character?.id ?? null)}>
      <Avatar name={character?.name || '＋'} src={character?.avatar} size="s" />
      <span>{character?.name || (session ? t('general') : t('choose'))}</span>
      <span className="tavern-bar-action">
        {t('library')} <TavernIcon name="arrow" size={14} />
      </span>
    </button>
  )
}
