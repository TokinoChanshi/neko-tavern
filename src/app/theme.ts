import { useSyncExternalStore } from 'react'
import { initAppearanceAssets, useAppearance } from '../services/appearance.js'
import { useSettings, type ThemePreference } from '../services/settings.js'

export type Theme = 'light' | 'dark'

const query = window.matchMedia('(prefers-color-scheme: dark)')

const subscribeOsTheme = (listener: () => void) => {
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

const getOsTheme = (): Theme => (query.matches ? 'dark' : 'light')

const resolveTheme = (preference: ThemePreference, osTheme: Theme): Theme =>
  preference === 'system' ? osTheme : preference

export const useTheme = (): Theme => {
  const preference = useSettings((state) => state.themePreference)
  const osTheme = useSyncExternalStore(subscribeOsTheme, getOsTheme)
  return resolveTheme(preference, osTheme)
}

const syncPageBackground = () => {
  const backgroundColor = getComputedStyle(document.body).backgroundColor
  document.documentElement.style.backgroundColor = backgroundColor
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backgroundColor)
}

const syncAppearanceAttributes = () => {
  const body = document.body
  const app = useAppearance.getState()
  const isDs = app.uiMode === 'ds'
  const effectiveSkin = isDs ? app.dsSkin : app.skin
  const osTheme = getOsTheme()
  const theme: Theme =
    effectiveSkin === 'obsidian'
      ? 'dark'
      : resolveTheme(useSettings.getState().themePreference, osTheme)

  body.classList.add('change-theme')
  body.classList.toggle('dark', theme === 'dark')
  body.classList.toggle('light', theme === 'light')
  if (theme === 'dark') {
    body.setAttribute('data-ds-dark-theme', 'dark')
  } else {
    body.removeAttribute('data-ds-dark-theme')
  }

  // mobile 视图下底层对话样式复用 companion 的气泡与主题皮肤
  body.setAttribute('data-mn-ui', isDs ? 'ds' : 'companion')
  body.setAttribute('data-mn-shell', app.uiMode)
  body.setAttribute('data-mn-skin', effectiveSkin)
  body.setAttribute('data-mn-layout', isDs ? 'minimal' : app.stageLayout)
  body.setAttribute('data-mn-material', app.bubbleMaterial)
  body.setAttribute('data-mn-font', app.fontStyle)
  body.setAttribute('data-mn-scale', app.fontScale)
  body.setAttribute('data-mn-width', app.chatWidth)
  body.setAttribute('data-mn-dialogue', !isDs && app.dialogueHighlight ? 'on' : 'off')

  document.documentElement.style.colorScheme = theme
  if (document.readyState === 'complete') {
    syncPageBackground()
  }
  setTimeout(() => {
    body.classList.remove('change-theme')
  }, 0)
}

export const setupTheme = () => {
  syncAppearanceAttributes()
  void initAppearanceAssets()
  if (document.readyState !== 'complete') {
    window.addEventListener('load', syncPageBackground, { once: true })
  }
  query.addEventListener('change', syncAppearanceAttributes)
  useSettings.subscribe(syncAppearanceAttributes)
  useAppearance.subscribe(syncAppearanceAttributes)
}
