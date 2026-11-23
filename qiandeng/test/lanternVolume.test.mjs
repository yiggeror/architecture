import test from 'node:test'
import assert from 'node:assert/strict'
import { Color } from 'three'
import { bakeLanternVolume } from '../src/lanternVolume.js'

test('overlapping lamp colours and directions remain continuous across the eight-slice baking boundary', () => {
  const size = [8, 5, 19]
  const origin = [-4, -2, -13], step = 1.25
  const lamps = [
    { p: [-2, .5, -3.4], color: 0xff8b43, range: 6.2, power: 20 },
    { p: [.25, 1.4, -1.7], color: 0x9ae5e8, range: 4.7, power: 18 },
    { p: [2, 2.2, 16], color: 0xb77a55, range: 6, power: 26 },
  ]
  const { energy, dirs } = bakeLanternVolume(lamps, { size, origin, step })
  for (let z = 0; z < size[2]; z++) for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) {
    const radiance = new Float32Array(3), direction = new Float32Array(3)
    let sum = 0
    for (const lamp of lamps) {
      const delta = [x, y, z].map((i, j) => lamp.p[j] - origin[j] - i * step)
      const d2 = delta.reduce((s, a) => s + a * a, 0)
      const strength = lamp.power * Math.max(0, 1 - d2 / lamp.range ** 2) ** 2 / (2.2 + d2)
      const color = new Color(lamp.color).toArray()
      for (let c = 0; c < 3; c++) {
        radiance[c] += color[c] * strength
        direction[c] += delta[c] * strength / Math.sqrt(.19 + d2)
      }
      sum = Math.fround(sum + strength)
    }
    const i = ((z * size[1] + y) * size[0] + x) * 4
    assert.deepEqual(Array.from(energy.slice(i, i + 4)),
      [...Array.from(radiance, v => Math.round(255 * Math.min(1, Math.sqrt(v / 12)))), 255])
    assert.deepEqual(Array.from(dirs.slice(i, i + 4)),
      [...Array.from(direction, v => Math.round(127.5 * (1 + v / Math.max(.0001, sum)))), 255])
  }
})
