import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

type CachedMediaQueryList = {
  matchMedia: typeof window.matchMedia
  mediaQueryList: MediaQueryList
}

const mediaQueryListCache = new WeakMap<Window, CachedMediaQueryList>()

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  const cached = mediaQueryListCache.get(window)
  if (cached?.matchMedia === window.matchMedia) {
    return cached.mediaQueryList
  }

  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
  mediaQueryListCache.set(window, {
    matchMedia: window.matchMedia,
    mediaQueryList,
  })
  return mediaQueryList
}

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList()
  if (!mediaQueryList) {
    return () => undefined
  }

  mediaQueryList.addEventListener("change", onStoreChange)
  return () => mediaQueryList.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false
}

function getServerSnapshot(): false {
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )
}
