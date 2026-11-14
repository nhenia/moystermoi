import { useEffect, useRef, useState } from "react"

// The opening screen: Nhen's oyster film full-bleed, "Clutched" huge on top, "New Orleans Pearls" under it.
// It never stands between a tourist and a restaurant for long:
//  - tap anywhere (or the Enter button) to go straight in;
//  - it leaves on its own after a few seconds;
//  - it only plays once per visit (sessionStorage), so going back to the app doesn't replay it;
//  - with "reduce motion" on, it shows a still and leaves quickly.
// Automated browsers skip it so the test suites can reach the finder; add ?splash to the URL to force it.

const SEEN_KEY = "clutched-splash"
const STAY_MS = 4800
const STAY_REDUCED_MS = 1600
const LETTERS = "Clutched".split("")

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

function shouldShow() {
  if (typeof window === "undefined") return false
  const forced = new URLSearchParams(window.location.search).has("splash")
  if (forced) return true
  if (navigator.webdriver) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1"
  } catch {
    return true
  }
}

export function Splash() {
  const [show, setShow] = useState(shouldShow)
  const [leaving, setLeaving] = useState(false)
  const enterRef = useRef<HTMLButtonElement>(null)
  const base = import.meta.env.BASE_URL
  const still = reducedMotion()

  const leave = () => {
    if (leaving) return
    try {
      sessionStorage.setItem(SEEN_KEY, "1")
    } catch {
      /* private mode: it'll just play again next time */
    }
    setLeaving(true)
    window.setTimeout(() => setShow(false), still ? 0 : 520)
  }

  useEffect(() => {
    if (!show) return
    enterRef.current?.focus({ preventScroll: true })
    const t = window.setTimeout(leave, still ? STAY_REDUCED_MS : STAY_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") leave()
    }
    window.addEventListener("keydown", onKey)
    document.documentElement.classList.add("cl-splash-on")
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove("cl-splash-on")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  if (!show) return null

  return (
    <div className={`cl-splash${leaving ? " is-leaving" : ""}`} onClick={leave} role="dialog" aria-modal="true" aria-label="Clutched, New Orleans Pearls">
      {still ? (
        <img className="cl-splash-film" src={`${base}art/clutched-splash.jpg`} alt="" />
      ) : (
        <video
          className="cl-splash-film"
          src={`${base}art/clutched-splash.mp4`}
          poster={`${base}art/clutched-splash.jpg`}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
        />
      )}
      <span className="cl-splash-grain" aria-hidden="true" />
      <div className="cl-splash-type">
        <h1 className="cl-splash-word" aria-label="Clutched">
          {LETTERS.map((ch, i) => (
            <span key={i} aria-hidden="true" style={{ ["--i" as string]: i }} data-ch={ch}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="cl-splash-sub">New Orleans Pearls</p>
      </div>
      <button ref={enterRef} type="button" className="cl-splash-enter" onClick={leave}>
        Enter
      </button>
    </div>
  )
}
