import type { Connection } from '../../services/tavern/store.js'
import { Select } from '../base/Select.js'
import { useTavernText } from './text.js'

export const ProtocolSelect = ({
  value,
  disabled,
  onChange,
}: {
  value: Connection['protocol']
  disabled: boolean
  onChange: (value: Connection['protocol']) => void
}) => {
  const t = useTavernText()
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={onChange}
      ariaLabel={t('protocol')}
      className="tavern-protocol-select"
      options={[
        { value: 'deepseek', label: 'DeepSeek 原生扩展协议' },
        { value: 'openai', label: t('openaiCompatible') },
        { value: 'anthropic', label: t('anthropicCompatible') },
      ]}
    />
  )
}
