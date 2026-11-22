// Timing for the four named performers. One walking scene spans four strides
// so the gaze, thought and gesture can travel separately from the feet.
const tau = 2 * Math.PI

export function stridePeriod(profile) {
  const length = (profile.height ?? 1) * (profile.legLength ?? 1)
  return 1.22 * Math.sqrt(length) * (1 + 0.027 * Math.sin((profile.seed ?? 0) % 113))
}

export function actingPeriod(profile, state) {
  const job = state.job ?? profile.job
  if (profile.design === 'silk' && job === 'umbrella') {
    return (state.walking ?? false) ? 4 * stridePeriod(profile) : 5.1
  }
  if (profile.design === 'scholar' && job === 'walk') return 4 * stridePeriod(profile)
  if (profile.design === 'lute' && job === 'lute') return 3.6
  if (profile.design === 'drummer' && job === 'drum') return 1.84
  return 0
}

function ease(start, end, phase) {
  const t = Math.max(0, Math.min(1, (phase - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

// Rise and release need different lengths: the glance lands before the
// head, the head before the greeting, the exhale after the hand settles.
const cue = (u, a, b, c, d) => ease(a, b, u) - ease(c, d, u)
// Keep full closure through one 24 fps export sample.
const blinkAt = (u, at, seconds) =>
  cue(u, at, at + 0.075 / seconds, at + 0.122 / seconds, at + 0.224 / seconds)

export function portraitPerformance(profile, state = {}, t = state.t ?? 0, phase = state.phase ?? 0) {
  const seconds = actingPeriod(profile, state)
  if (!seconds) return null
  const cycles = t / seconds + phase / tau
  const u = cycles - Math.floor(cycles)
  switch (profile.design) {
    case 'silk': {
      const glance = cue(u, 0.09, 0.112, 0.695, 0.728)
      const turn = cue(u, 0.118, 0.30, 0.755, 0.954)
      const body = cue(u, 0.158, 0.37, 0.786, 0.975)
      const gesture = cue(u, 0.205, 0.435, 0.653, 0.875)
      const present = cue(u, 0.319, 0.515, 0.674, 0.835)
      const breath = cue(u, 0.017, 0.235, 0.315, 0.70)
      const nod = cue(u, 0.345, 0.415, 0.423, 0.533)
      return {
        turn, body, gesture, present, breath, nod,
        // Catch the customer, then recover the eye in its socket as the head arrives.
        eyeX: 0.08 - 0.87 * glance + 0.49 * turn,
        eyeY: -0.21 + 0.34 * glance - 0.1 * nod,
        smile: 0.46 * cue(u, 0.224, 0.387, 0.565, 0.794),
        brow: 0.12 + (0.77 - 0.37 * body) * glance,
        blink: blinkAt(u, 0.731, seconds),
        focus: 0.045 + 0.052 * gesture,
      }
    }
    case 'scholar': {
      const glance = cue(u, 0.16, 0.179, 0.672, 0.71)
      const turn = cue(u, 0.203, 0.389, 0.721, 0.93)
      const body = cue(u, 0.241, 0.457, 0.761, 0.976)
      const breath = cue(u, 0.02, 0.27, 0.42, 0.84)
      return {
        turn, body, breath,
        eyeX: -0.44 + 1.04 * glance - 0.52 * turn,
        eyeY: -0.68 + 1.17 * glance - 0.31 * turn,
        brow: 0.14 + 0.58 * glance,
        smile: 0.035 * body,
        blink: blinkAt(u, 0.704, seconds),
        focus: 0.14 - 0.084 * glance,
      }
    }
    case 'lute': {
      // Two three-note phrases. Her ear follows the first release. The second
      // descends across the strings, and her eyes find the frets before it lands.
      const glance = cue(u, 0.231, 0.258, 0.591, 0.623)
      const turn = cue(u, 0.284, 0.445, 0.651, 0.89)
      const body = cue(u, 0.31, 0.52, 0.68, 0.957)
      const breath = cue(u, 0.007, 0.267, 0.319, 0.775)
      const accent = cue(u, 0.412, 0.497, 0.52, 0.653) + 0.55 * cue(u, 0.753, 0.831, 0.85, 0.97)
      return {
        turn, body, breath, accent,
        eyeX: 0.44 - 1.12 * glance + 0.44 * turn,
        eyeY: -0.53 + 0.98 * glance - 0.33 * turn,
        brow: 0.11 + 0.58 * glance,
        smile: 0.06 + 0.19 * body,
        blink: blinkAt(u, 0.083, seconds),
        focus: 0.11 + 0.1 * accent,
      }
    }
    case 'drummer': {
      // The mallets alternate every quarter bar. Weight leaves the struck
      // side on the rebound and arrives early under the next stroke.
      const slot = u * 4
      const beat = slot - Math.floor(slot)
      const side = Math.floor(slot) % 2 === 0 ? 1 : -1
      const transfer = side * (1 - 2 * ease(0.14, 0.95, beat))
      const eyes = side * (1 - 2 * ease(0.25, 0.43, beat))
      const follow = side * (1 - 2 * ease(0.38, 0.87, beat))
      // Glance up to cue the boat crew once per bar. The hands can play the
      // inner notes by touch, with the neck following only a little of each.
      const cueEyes = cue(u, 0.397, 0.44, 0.726, 0.774)
      const cueHead = cue(u, 0.444, 0.564, 0.77, 0.921)
      const turn = 0.25 * follow - cueHead
      const rebound = cue(beat, 0, 0.24, 0.34, 0.94)
      const accent = u > 0.75 ? ease(0.79, 0.97, u) : 1 - ease(0.025, 0.2, u)
      return {
        turn, transfer, rebound, accent,
        breath: cue(u, 0.24, 0.49, 0.59, 0.92),
        eyeX: 0.22 * eyes - 0.64 * cueEyes + 0.27 * cueHead,
        eyeY: -0.55 + 0.21 * rebound + 0.53 * cueEyes,
        brow: 0.17 + 0.49 * accent + 0.2 * rebound,
        smile: 0,
        exhale: cue(u, 0.013, 0.105, 0.164, 0.375) + 0.46 * cue(u, 0.507, 0.613, 0.663, 0.834),
        blink: 0, focus: 0.086 + 0.08 * accent,
      }
    }
  }
}

// Fretting uses the same stopped-note and thumb-pad pair while the carpus
// sits below the stopped note. These frames are measured on the instrument.
// The finger transform preserves both pad positions when reseating the wrist.
export const pipaWristRotation = Object.freeze([0.6566207985, 0.1707271159, 0.5774078044, -0.4542043663])
export const pipaFingerRotation = Object.freeze([-0.6976304694, -0.0299296839, -0.3360288183, -0.6320605789])
export const pipaFingerOffset = Object.freeze([-0.0622067762, -0.0640412223, 0.0282672751])
