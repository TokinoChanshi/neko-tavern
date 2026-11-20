import type { CSSProperties } from 'react'

const paths = {
  star: 'm12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z',
  book: 'M12 6v15m0-15C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z',
  search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  pin: 'm16 3 5 5-4 1-4 6-1 4-3-3-6 6m6-6-4-4 4-1 6-4 1-4Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  chevronLeft: 'm15 18-6-6 6-6',
  plus: 'M12 4v16M4 12h16',
  link: 'm10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  copy: 'M9 9h12v12H9V9ZM15 5V3H3v12h2',
  edit: 'm14 5 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
  close: 'm6 6 12 12M18 6 6 18',
  cat: 'M5 11 6.5 4l4.2 3.4h2.6L17.5 4 19 11a7.5 7.5 0 0 1-14 0Zm4.2 1.8h.01m5.59 0h.01M10.5 15.6c.8.8 2.2.8 3 0',
  sparkle:
    'M12 3l1.9 4.9L18.8 9.8l-4.9 1.9L12 16.6l-1.9-4.9-4.9-1.9 4.9-1.9L12 3Zm6.5 12 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.4 0 2.5-1.1 2.5-2.5 0-.6-.2-1.2-.6-1.6-.4-.4-.6-1-.6-1.6 0-1.4 1.1-2.5 2.5-2.5H17a4 4 0 0 0 4-4c0-3.3-4-5.8-9-5.8ZM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  heart: 'M12 20.4 4.9 13.6a4.8 4.8 0 0 1 6.8-6.8l.3.3.3-.3a4.8 4.8 0 0 1 6.8 6.8L12 20.4Z',
  image:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 15l-4.5-4.5L7 19',
  panelRight: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm11 0v16',
  maximize:
    'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  quote: 'M10 8H6a2 2 0 0 0-2 2v4h4v4H5m15-10h-4a2 2 0 0 0-2 2v4h4v4h-3',
  classic: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6Z',
  phone: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 15h.01',
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z',
  user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
} as const

export type TavernIconName = keyof typeof paths

export const TavernIcon = ({
  name,
  size = 18,
  filled = false,
  style,
}: {
  name: TavernIconName
  size?: number
  filled?: boolean
  style?: CSSProperties
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={style}
  >
    <path d={paths[name]} />
  </svg>
)
