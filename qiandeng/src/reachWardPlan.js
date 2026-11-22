import { generator } from './mesh.js'

// Wall finish, roof glaze, carved timber, festival fabric, lettering, lamplight.
export const streetTrades = {
  silk: { wall: 16, roof: 21, wood: 25, fabric: 28, sign: 40, glow: 0xffab62, light: 0.81, height: 1.06 },
  harbor: { wall: 18, roof: 22, wood: 24, fabric: 30, sign: 44, glow: 0xffb66d, light: 0.58, height: 0.91 },
  market: { wall: 17, roof: 20, wood: 25, fabric: 31, sign: 48, glow: 0xff9e51, light: 0.91, height: 1.02 },
  books: { wall: 16, roof: 22, wood: 24, fabric: 29, sign: 52, glow: 0xffce87, light: 0.61, height: 0.96 },
  guild: { wall: 19, roof: 23, wood: 26, fabric: 30, sign: 56, glow: 0xffbd69, light: 0.74, height: 1.16 },
  metal: { wall: 18, roof: 21, wood: 24, fabric: 31, sign: 60, glow: 0xff9052, light: 0.64, height: 1.0 },
}
const districtTrade = {
  锦浦: 'silk',
  南栈: 'harbor',
  东市: 'market',
  西津: 'harbor',
  书坊: 'books',
  织云: 'silk',
  桂浦: 'books',
  鹿鸣: 'guild',
  玉京: 'guild',
  花津: 'silk',
  铜雀: 'metal',
  岑楼: 'market',
  画桥: 'books',
  星渡: 'guild',
}
export const tradeOf = (t) => districtTrade[t.group] || 'market'
export function streetSeed(value) {
  let n = 2166136261
  for (const letter of String(value)) n = Math.imul(n ^ letter.charCodeAt(0), 16777619)
  return n >>> 0
}
const forms = ['gable', 'hip', 'firewall', 'gallery', 'lantern', 'return', 'guild', 'lodge']
const favorites = {
  silk: [3, 4, 5, 2],
  harbor: [0, 7, 5, 3],
  market: [3, 1, 4, 2],
  books: [2, 0, 5, 7],
  guild: [6, 1, 4, 3],
  metal: [7, 2, 0, 6],
}
export function reachStreetPlan(t) {
  const seed = streetSeed(t.id),
    r = generator(seed),
    trade = tradeOf(t),
    style = streetTrades[trade]
  const lane = t.group === '锦浦' && t.row === 0 ? 2.7 : (r() - 0.5) * Math.min(22, t.width * 0.2)
  const laneWidth = 3.8 + r() * 1.25,
    ends = 2.45,
    address = []
  const sections = [
    [-t.width / 2 + ends, lane - laneWidth / 2],
    [lane + laneWidth / 2, t.width / 2 - ends],
  ]
  for (const [part, [a, z]] of sections.entries()) {
    const n = Math.max(2, Math.round((z - a) / (10.2 + r() * 1.65))),
      weights = [],
      gaps = []
    for (let j = 0; j < n; j++) {
      weights.push(0.72 + r() * 0.63 + (j === Math.floor(n / 2) && n > 3 ? 0.45 : 0))
      if (j < n - 1) gaps.push(0.83 + r() * 0.85 + (j % 4 === 2 ? 0.88 : 0))
    }
    const length = z - a - gaps.reduce((x, y) => x + y, 0),
      total = weights.reduce((x, y) => x + y, 0)
    let x = a
    for (let j = 0; j < n; j++) {
      const width = (length * weights[j]) / total,
        phase = Math.floor(r() * 1e5),
        sig = (j === n - 1 && part === 0) || (j === 1 && part === 1 && n > 3)
      const kind = sig
        ? ['guild', 'lantern', 'return', 'gallery'][(phase + t.row) % 4]
        : forms[r() < 0.69 ? favorites[trade][phase % 4] : phase % 8]
      const face = t.depth / 2 - 2.82 - r() * 1.1 - (j === 0 && part === 1 ? 0.58 : 0)
      const depth = Math.min(face + t.depth / 2 - 1.18, t.depth * (0.52 + r() * 0.23))
      const base = (1.5 + r() * 1.67 + (t.row >= 2 ? 0.44 : 0) + (sig ? 0.7 : 0)) * style.height
      const floors =
        !sig && phase % 13 === 0
          ? 1
          : Math.min(
              6,
              Math.max(
                2,
                Math.round(base) +
                  (sig && ['lantern', 'guild'].includes(kind) ? 1 : 0) +
                  (phase % 11 === 2 && t.row === 2 ? 1 : 0)
              )
            )
      const use = sig
        ? ['banquet', 'gallery', 'home', 'work'][phase % 4]
        : ['shutter', 'home', 'work', 'home', 'gallery', 'shutter', 'work', 'banquet', 'home', 'work'][
            phase % 10
          ]
      const unit = 2.82 + r() * 0.48,
        ground = 3.35 + r() * 0.65
      address.push({
        id: `${t.id}/${part + 1}-${j + 1}`,
        x: x + width / 2,
        z: face - depth / 2,
        width,
        depth,
        front: face,
        phase,
        floors,
        unit,
        ground,
        trade,
        style,
        kind,
        sig,
        use,
        lifted: floors > 1 && ['guild', 'lodge', 'lantern'].includes(kind),
        open: use !== 'shutter' && ((t.row === 0 && phase % 7 !== 4) || sig || phase % 3 === 0),
        court: sig || phase % 7 === 3,
        part,
        j,
      })
      x += width + (gaps[j] || 0)
    }
  }
  const left = address.filter((h) => h.part === 0).at(-1),
    right = address.find((h) => h.part === 1)
  let bridge
  if (left.floors >= 2 && right.floors >= 2 && (t.row % 3 === 1 || seed % 7 === 2)) {
    const z = (left.z + right.z) / 2 - 0.32,
      level = Math.max(4.1, left.ground + 0.22, right.ground + 0.22),
      depth = 1.66 + (seed % 4) * 0.12
    bridge = {
      leftX: left.x + (left.width - 1.28) / 2 + 0.015,
      rightX: right.x - (right.width - 1.28) / 2 - 0.015,
      z,
      level,
      depth,
      covered: seed % 4 !== 2,
      left: left.id,
      right: right.id,
    }
    left.bridge = { side: 1, z: z - left.z, level, depth }
    right.bridge = { side: -1, z: z - right.z, level, depth }
  }
  for (const h of address)
    h.stair = h.open && h.floors >= 2 && (h.sig || h.phase % 5 === 1) && h.width > 7.3
  return { terrace: t, seed, trade, style, lane, laneWidth, address, bridge }
}
