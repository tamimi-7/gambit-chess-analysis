import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Thin wrapper around the browser's built-in Web Speech API
 * (`speechSynthesis`) — no network call, no API key, works offline.
 *
 * Voice lists load asynchronously and are empty on the first call in most
 * browsers, so the Arabic voice is picked lazily via `voiceschanged` rather
 * than once at mount.
 */
export default function useSpeech(lang = 'ar-SA') {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef(null)

  useEffect(() => {
    if (!supported) return

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      voiceRef.current =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang?.startsWith('ar')) ??
        null
    }

    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [supported, lang])

  // Leaving the page mid-sentence should not leave the synthesiser talking
  // to a closed tab.
  useEffect(() => () => window.speechSynthesis?.cancel(), [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return
      window.speechSynthesis.cancel() // one utterance at a time

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      window.speechSynthesis.speak(utterance)
    },
    [supported, lang],
  )

  return { speak, stop, speaking, supported }
}
