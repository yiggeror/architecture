import { firmament } from './firmament.js'
import { launchSites, skyLanterns } from './skyLanterns.js'
import { festivalKites } from './skyKites.js'

export function festivalSky(scene, world) {
  const sky = firmament(scene)
  const procession = skyLanterns(scene)
  const kites = festivalKites(scene, world)
  function mode(day) {
    sky.mode(day)
    procession.mode(day)
    kites.mode(day)
  }
  function update(t, day) {
    sky.update(t, day)
    procession.update(t, day)
    kites.update(t, day)
  }
  return { mode, update }
}

// Four moored platforms. The loading edge and the rolled paper stay inside the
// quay margin, clear of the lamp boats rounding the northern turning basin.
export function launchQuays(b, m, world) {
  for (const site of launchSites) {
    const [x, , z] = site,
      sign = Math.sign(x)
    b.at(x, 0, z, 0, () => {
      for (let k = 0; k < 6; k++) {
        const xx = (k - 2.5) * 0.179,
          tip = (k % 3) * 0.065
        b.tube(m.reed, [xx, 0.205, -1.96 + tip], [xx, 0.205, 2.0 - tip], 0.1, 0.095, 8, 0.79 + 0.04 * (k % 3))
      }
      for (const zz of [-1.77, -1.24, -0.47, 0.35, 1.11, 1.76]) {
        b.beam(m.darkwood, [-0.5, 0.27, zz], [0.5, 0.27, zz], 0.095, 0.084)
        for (const xx of [-0.45, 0.45])
          b.tube(m.rope, [xx, 0.17, zz - 0.022], [xx, 0.17, zz + 0.022], 0.125, 0.125, 8, 0.78)
      }
      for (let k = 0; k < 15; k++)
        b.box(m.wood, 0, 0.346, -1.74 + k * 0.246, 1.06, 0.069, 0.231, 0.78 + 0.11 * (k % 3))
      // Side ladder and a mooring loop up to the stone quay.
      for (const zz of [-1.13, -0.58]) {
        b.tube(m.wood, [sign * 0.37, 0.385, zz], [sign * 0.54, 1.37, zz], 0.031, 0.033, 7)
        b.tube(m.bronze, [sign * 0.52, 1.23, zz], [sign * 0.53, 1.3, zz], 0.04, 0.04, 7)
      }
      for (let j = 0; j < 4; j++)
        b.beam(
          m.wood,
          [sign * (0.4 + j * 0.043), 0.55 + j * 0.22, -1.13],
          [sign * (0.4 + j * 0.043), 0.55 + j * 0.22, -0.58],
          0.068,
          0.06
        )
      b.tube(m.bronze, [sign * 0.4, 0.36, 1.72], [sign * 0.4, 0.63, 1.72], 0.068, 0.053, 9)
      b.tube(m.rope, [sign * 0.4, 0.55, 1.72], [sign * 0.67, 0.86, 1.97], 0.018, 0.02, 6)
      b.tube(m.rope, [sign * 0.67, 0.86, 1.97], [sign * 0.79, 1.35, 2.15], 0.02, 0.019, 6)
      const spoolX = -sign * 0.38
      for (const dz of [-0.16, 0.16]) {
        b.beam(m.timber, [spoolX, 0.37, -1.16 + dz * 1.45], [spoolX, 1.72, -1.16 + dz], 0.052, 0.052)
        b.tube(
          m.bronze,
          [spoolX, 1.67, -1.16 + dz - 0.025],
          [spoolX, 1.67, -1.16 + dz + 0.025],
          0.095,
          0.095,
          8
        )
      }
      b.tube(m.reed, [spoolX, 1.66, -1.299], [spoolX, 1.66, -1.02], 0.077, 0.077, 12)
      for (let j = -4; j <= 4; j++)
        b.tube(
          m.rope,
          [spoolX, 1.66, -1.16 + j * 0.026],
          [spoolX, 1.66, -1.15 + j * 0.026],
          0.08,
          0.08,
          8,
          0.93
        )
      // An unfolded burner rests in this fork until the paper swells and lifts.
      for (const xx of [-0.19, 0.19]) {
        for (const zz of [-0.21, 0.21]) b.beam(m.reed, [xx * 0.78, 0.38, zz], [xx, 1.055, zz], 0.03, 0.03)
        b.beam(m.darkwood, [xx, 1.055, -0.21], [xx, 1.055, 0.21], 0.037, 0.035)
      }
      // The standing silk envelope sits on an open bamboo stool.
      for (const xx of [-0.225, 0.225])
        for (const zz of [0.82, 1.29]) b.beam(m.timber, [xx, 0.38, zz], [xx * 0.89, 0.75, zz], 0.061, 0.061)
      b.box(m.wood, 0, 0.775, 1.05, 0.58, 0.078, 0.6, 0.92)
      for (let i = 0; i < 3; i++)
        b.tube(
          i === 1 ? m.paper : m.reed,
          [-0.365, 0.45, -0.23 + i * 0.118],
          [0.33, 0.45, -0.23 + i * 0.118],
          0.054,
          0.051,
          7,
          0.88
        )
      for (const k of [-1, 1]) b.beam(m.rope, [k * 0.2, 0.51, -0.285], [k * 0.2, 0.51, 0.069], 0.022, 0.022)
      // A lidded, basket-woven fuel pot waits at the bow.
      b.tube(m.ink, [0, 0.385, -1.56], [0, 0.585, -1.56], 0.161, 0.172, 10)
      b.tube(m.bronze, [0, 0.585, -1.56], [0, 0.618, -1.56], 0.179, 0.158, 10)
      b.tube(m.darkwood, [0, 0.615, -1.56], [0, 0.661, -1.56], 0.045, 0.039, 8)
    })
    world.lamp?.(x, 1.14, z + 1.05, 0xffa755, 4.7, 4.1)
  }
}
