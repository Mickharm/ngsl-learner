/**
 * One audio-session category for the whole app (iOS / iPadOS Safari).
 *
 * Speech synthesis is rendered as `playback`. Web Audio (the game sounds in
 * sfx.js) is rendered under the default `auto` session, which Safari treats as
 * `ambient`. Every time an answer chime ran, the page's session flipped
 * between the two categories, and speech that followed came out at a
 * different level from speech that did not — the "same device volume,
 * suddenly much louder" report (v5.2.1). WebKit also documents speech
 * synthesis ducking Web Audio on iOS (bugs 278598, 218815).
 *
 * Declaring `playback` once puts both on the same category, same volume
 * control. Trade-off: game sounds now play with the silent switch on, like
 * speech always did; the Settings sound switch still turns them off.
 *
 * Only Safari implements navigator.audioSession; everywhere else this is a
 * no-op.
 */
let claimed = false
export function claimPlaybackSession () {
  if (claimed || typeof navigator === 'undefined') return
  claimed = true
  try {
    const s = navigator.audioSession
    if (s && s.type !== 'playback') s.type = 'playback'
  } catch { /* unsupported or locked — nothing to do */ }
}
