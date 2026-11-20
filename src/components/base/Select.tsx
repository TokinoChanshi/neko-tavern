import clsx from 'clsx'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismiss } from './anchored.js'
import { IconCheckOutline16, IconChevronDownOutline14 } from './icons.js'
import styles from './Select.module.css'

export type SelectOption<T extends string> = { value: T; label: string; lang?: string }

export const Select = <T extends string>({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  className,
  disabled = false,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}) => {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const search = useRef({ text: '', time: 0 })
  const shown = open && !disabled && options.length > 0
  const selected = options.findIndex((option) => option.value === value)
  const current = options[selected]
  const { anchorRef, floatingRef, position } = useAnchoredPosition<
    HTMLButtonElement,
    HTMLDivElement
  >(shown, { align: 'end', offset: 6, maxHeight: 320, minSpace: 160, matchAnchorWidth: true })
  useDismiss(shown, [anchorRef, floatingRef], () => setOpen(false), { captureEscape: true })
  useLayoutEffect(() => {
    if (!shown) {
      return
    }
    const menu = floatingRef.current
    const option = menu?.children[active] as HTMLElement | undefined
    if (!menu || !option) {
      return
    }
    if (option.offsetTop < menu.scrollTop) {
      menu.scrollTop = option.offsetTop
    } else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight
    }
  }, [active, shown, position, floatingRef])
  const expand = () => {
    if (disabled || !options.length) {
      return
    }
    setActive(Math.max(0, selected))
    setOpen(true)
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!disabled && option && option.value !== value) {
      onChange(option.value)
    }
    setOpen(false)
  }
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        role="combobox"
        className={clsx(styles.trigger, className)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={shown}
        aria-controls={shown ? id : undefined}
        aria-activedescendant={shown ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (shown ? setOpen(false) : expand())}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            setOpen(false)
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            if (!shown) {
              expand()
            } else if (event.key === 'Home') {
              setActive(0)
            } else if (event.key === 'End') {
              setActive(options.length - 1)
            } else {
              setActive(
                (index) =>
                  (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
              )
            }
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (shown) {
              choose(active)
            } else {
              expand()
            }
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now()
            search.current = {
              text:
                (now - search.current.time < 700 ? search.current.text : '') +
                event.key.toLocaleLowerCase(),
              time: now,
            }
            const index = options.findIndex((option) =>
              option.label.toLocaleLowerCase().startsWith(search.current.text)
            )
            if (index >= 0) {
              event.preventDefault()
              setActive(index)
              setOpen(true)
            }
          }
        }}
      >
        <span lang={current?.lang} className={!current ? styles.placeholder : undefined}>
          {current?.label ?? placeholder}
        </span>
        <IconChevronDownOutline14 />
      </button>
      {shown
        ? createPortal(
            <div
              ref={floatingRef}
              id={id}
              className={styles.menu}
              style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
              role="listbox"
              aria-label={ariaLabel}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  lang={option.lang}
                  aria-selected={option.value === value}
                  data-active={index === active}
                  className={styles.option}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? <IconCheckOutline16 /> : null}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
