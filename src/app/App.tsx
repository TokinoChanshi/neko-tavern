import { useEffect } from 'react'
import { initTavern, useTavern } from '../services/tavern/store.js'
import { TavernDialog } from '../components/tavern/TavernDialog.js'
import { AppearanceDrawer } from '../components/appearance/AppearanceDrawer.js'
import { CommandPalette } from '../components/guide/CommandPalette.js'
import { GuideModal } from '../components/guide/GuideModal.js'
import { MobileAppShell } from '../components/mobile/MobileAppShell.js'
import { useAppearance } from '../services/appearance.js'
import { useTranslate } from '../i18n/index.js'
import { useSettings } from '../services/settings.js'
import { useIsMobile, useMobileViewport, usePreventPageScroll } from './viewport.js'
import {
  bindChatPersistence,
  initChat,
  retrySaveSessions,
  selectSession,
  useChatStore,
} from '../services/chat/store.js'
import { SearchPanel } from '../components/search/SearchPanel.js'
import { closeSearchPanel } from '../components/search/searchPanelState.js'
import { SessionView } from '../components/session/SessionView.js'
import { MobileHeader } from '../components/session/MobileHeader.js'
import { Welcome } from '../components/session/Welcome.js'
import { SettingsDialog } from '../components/settings/SettingsDialog.js'
import { Toast } from '../components/base/Toast.js'
import { showToast } from '../components/base/toastState.js'
import { onUploadNotice } from '../services/attachments.js'
import { Button } from '../components/base/Button.js'
import { stopReadAloud } from '../services/speech/readAloud.js'
import { CollapsedSider } from '../components/sider/CollapsedSider.js'
import { closeMobileSider } from '../components/sider/mobileSiderState.js'
import { MobileSider, Sider } from '../components/sider/Sider.js'
import styles from './App.module.css'

export const App = () => {
  const t = useTranslate()
  const tavernError = useTavern((state) => state.error)
  const isMobile = useIsMobile()
  const locale = useSettings((state) => state.locale)
  const uiMode = useAppearance((state) => state.uiMode)
  const zenMode = useAppearance((state) => state.zenMode && state.uiMode === 'companion')

  // 真机窄屏下（非 DS 经典模式）或桌面主动开启「手机 APP 模式」时，进入原生四栏陪伴 APP 外壳
  const useMobileAppShell = uiMode === 'mobile' || (isMobile && uiMode === 'companion')
  const siderCollapsed = (useSettings((state) => state.siderCollapsed) || zenMode) && !isMobile

  const ready = useChatStore((state) => state.ready)
  const initError = useChatStore((state) => state.initError)
  const saveError = useChatStore((state) => Object.values(state.sessionSaveErrors).some(Boolean))
  const importingHistory = useChatStore((state) => state.importingHistory)
  const session = useChatStore((state) =>
    state.activeId !== null && Object.hasOwn(state.sessionCache, state.activeId)
      ? state.sessionCache[state.activeId]
      : undefined
  )
  const sessionLoadError = useChatStore((state) =>
    state.activeId === null ? false : state.sessionLoadErrors[state.activeId] === true
  )
  const frameRef = useMobileViewport(isMobile)
  const streaming = useChatStore((state) =>
    state.activeId === null ? false : Object.hasOwn(state.streaming, state.activeId)
  )
  const activeId = useChatStore((state) => state.activeId)

  usePreventPageScroll(isMobile)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => onUploadNotice(showToast), [])
  useEffect(bindChatPersistence, [])

  useEffect(closeSearchPanel, [activeId])
  useEffect(stopReadAloud, [activeId])
  useEffect(closeMobileSider, [activeId, isMobile])

  useEffect(() => {
    void initChat()
    void initTavern()
  }, [])

  return (
    <>
      <div ref={frameRef} className={styles.frame}>
        {useMobileAppShell ? null : isMobile ? <MobileSider /> : siderCollapsed ? null : <Sider />}
        <main className={styles.main}>
          {tavernError ? (
            <div className={styles.saveError} role="alert">
              {tavernError}
              <Button onClick={() => void initTavern()}>{t('retry')}</Button>
            </div>
          ) : null}
          {saveError ? (
            <div className={styles.saveError} role="alert">
              <span>{t('sessionSaveFailed')}</span>
              <Button
                variant="outlined"
                size="s"
                disabled={importingHistory}
                onClick={retrySaveSessions}
              >
                {t('retry')}
              </Button>
            </div>
          ) : null}
          <div className={styles.content}>
            {!useMobileAppShell && siderCollapsed && !zenMode ? <CollapsedSider /> : null}
            {!ready || (activeId !== null && !session) ? (
              <div className={styles.loadingView}>
                {isMobile && !useMobileAppShell ? <MobileHeader /> : null}
                <div className={styles.loadingState} role="status" aria-live="polite">
                  <span>
                    {(!ready ? initError : sessionLoadError)
                      ? t(!ready ? 'sessionListLoadFailed' : 'sessionLoadFailed')
                      : t('sessionLoading')}
                  </span>
                  {(!ready ? initError : sessionLoadError) ? (
                    <Button
                      variant="outlined"
                      size="m"
                      onClick={() => {
                        if (!ready) {
                          void initChat()
                        } else if (activeId !== null) {
                          selectSession(activeId)
                        }
                      }}
                    >
                      {t('retry')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : useMobileAppShell ? (
              <MobileAppShell session={session} streaming={streaming} isNarrowViewport={isMobile} />
            ) : session ? (
              <SessionView
                session={session}
                streaming={streaming}
                siderCollapsed={siderCollapsed}
              />
            ) : (
              <Welcome />
            )}
          </div>
        </main>
        <SearchPanel />
      </div>
      <SettingsDialog />
      <TavernDialog />
      <AppearanceDrawer />
      <GuideModal />
      <CommandPalette />
      <Toast />
    </>
  )
}
