import { generator } from './mesh.js'

// Seeds remain attached to an inhabitant when the boats move, a shopkeeper goes
// off camera, or the night watch swaps a lantern for a daytime walk.
const palettes = [
  [0x437d79, 0xe3d4af, 0x536878, 0x354653, 0xa65e45, 0xceae77],
  [0x984e50, 0xf3d5b6, 0x526676, 0x523842, 0x8b7154, 0xddbb8d],
  [0x57758c, 0xd2c7a6, 0x444b57, 0x394354, 0x8b6747, 0xc6a56b],
  [0xb88466, 0xe5ceb1, 0x595d64, 0x654951, 0x8b4f42, 0xcdb98a],
  [0x848568, 0xe6d6b6, 0x545b52, 0x4e4d43, 0x89664a, 0xc6ae79],
  [0xb88a9a, 0xf0d8c6, 0x766477, 0x695466, 0x997253, 0xd9b288],
  [0x6e9096, 0xeedfbf, 0x506877, 0x455269, 0x8b634e, 0xd3ae72],
  [0xb69d75, 0xe1d7bc, 0x6d665b, 0x63564b, 0x835347, 0xb39161],
  [0x50647f, 0xc8c5af, 0x485361, 0x393e4d, 0x9a6249, 0xbca573],
  [0xa96255, 0xe1d5ba, 0x647a7d, 0x775b50, 0x5c4850, 0xd3b76f],
]
const skinTones = [0xd8a987, 0xe7bca0, 0xd5a17b, 0xc08b68, 0xe4b596, 0xd7ac91, 0xbf936f]
const sitterComplexions = { 47: 0xe6b9aa, 9: 0xdfb4aa, 64: 0xd9b2a2, 4: 0xca9580 }
const hairTones = [0x302a2c, 0x37302d, 0x272930, 0x3c3531, 0x4d4440]
const roles = {
  walk: ['changshan', 'beizi', 'banbi'],
  umbrella: ['aoqun', 'beizi', 'banbi'],
  basket: ['banbi', 'aoqun', 'duan'],
  lantern: ['changshan', 'beizi', 'yuanling'],
  watch: ['yuanling', 'duan'],
  carrier: ['duan', 'banbi'],
  porter: ['duan', 'banbi'],
  row: ['duan', 'banbi'],
  drum: ['yuanling', 'duan'],
  flute: ['changshan', 'yuanling'],
  lute: ['aoqun', 'beizi'],
  sit: ['beizi', 'changshan', 'banbi'],
}
const styles = ['coil', 'knot', 'wrapped', 'loop', 'braid', 'half']
const surnames = '沈徐林顾叶周朱方陈季许冯宋阮陶吴陆'
const givenNames = [
  '听禾',
  '微澜',
  '松年',
  '砚清',
  '书衡',
  '阿棠',
  '春岑',
  '立舟',
  '溪平',
  '竹生',
  '素秋',
  '青石',
  '秋声',
  '云乔',
  '昭宁',
  '晚晴',
  '瑞安',
]

// These twelve records are also twelve actual people in the city. The studio
// selects them by the same stable id used to place their on-street counterpart.
const sitters = [
  [47, 'umbrella', '沈青蘅', '锦浦绸庄掌事', 'aoqun', 'loop', 'balanced', 32, 0, 1],
  [0, 'row', '顾长河', '锦鳞舫桨手', 'duan', 'wrapped', 'broad', 53, 4, 3],
  [9, 'lute', '叶素弦', '画舫琵琶师', 'beizi', 'coil', 'lean', 37, 5, 0],
  [53, 'watch', '周守义', '南栈巡更人', 'yuanling', 'knot', 'broad', 58, 8, 5],
  [64, 'walk', '许砚清', '书坊校书人', 'changshan', 'half', 'lean', 29, 6, 0],
  [51, 'carrier', '陈阿满', '南栈挑夫', 'duan', 'wrapped', 'broad', 44, 3, 2],
  [55, 'basket', '方春棠', '东市采买人', 'banbi', 'braid', 'balanced', 23, 9, 4],
  [38, 'lantern', '陆松年', '河埠灯匠', 'changshan', 'knot', 'lean', 66, 7, 5],
  [4, 'drum', '吴照', '锦鳞舫鼓手', 'yuanling', 'half', 'balanced', 25, 1, 2],
  [5, 'flute', '阮竹生', '锦鳞舫笛手', 'changshan', 'knot', 'lean', 39, 2, 1],
  [36, 'porter', '陶立舟', '西埠搬运人', 'duan', 'wrapped', 'balanced', 42, 4, 3],
  [14, 'sit', '宋晚晴', '临水看灯人', 'beizi', 'coil', 'balanced', 59, 6, 4],
]
const byId = new Map(sitters.map((s) => [s[0], s]))
// Individual portrait studies: the cast does not inherit a random nose and
// jaw from a shared face. The values below describe acting silhouettes and
// layered pigments, in the same order for each sitter.
const faceControls = ['width', 'jaw', 'cheek', 'chin', 'nose', 'eyes', 'brow', 'lips']
// Height, shoulder breadth, pelvis breadth, ribcage girth, leg and arm length.
// These are fittings for individuals, and are independent of the rental clothes.
const fittings = {
  47: [
    'silk',
    [1.01, 0.921, 1.025, 0.939, 1.024, 0.982],
    [0x3e7c72, 0xf3d9bd, 0x3c5b61, 0x344c49, 0xa66059, 0xddbd82],
  ],
  9: [
    'lute',
    [0.985, 0.897, 1.008, 0.915, 1.007, 0.967],
    [0xb38191, 0xf2ded0, 0xa48b9b, 0x735164, 0x996777, 0xdfc29b],
  ],
  64: [
    'scholar',
    [1.053, 1.049, 0.971, 0.972, 1.031, 1.018],
    [0x456873, 0xe7e1cf, 0x405361, 0x303e49, 0x6c7266, 0xb9c4a5],
  ],
  4: [
    'drummer',
    [1.037, 1.138, 0.997, 1.091, 1.009, 1.026],
    [0xa7463f, 0xe6c9a8, 0x36404e, 0x462f34, 0x52484f, 0xdfae66],
  ],
  0: [
    'boatman',
    [1.007, 1.102, 1.014, 1.058, 0.989, 1.031],
    [0x787e63, 0xd8c7a6, 0x48545c, 0x464942, 0x87624c, 0xc1aa75],
  ],
  55: [
    'market',
    [0.971, 0.944, 1.048, 0.963, 0.992, 0.978],
    [0xbc6f60, 0xebcfac, 0x526e73, 0x6b4d4d, 0x8a5a52, 0xdab978],
  ],
}
const families = ['silk', 'lute', 'scholar', 'drummer', 'boatman', 'market']
const otherStudies = { 53: 'drummer', 51: 'boatman', 38: 'scholar', 5: 'scholar', 36: 'drummer', 14: 'silk' }
const portraits = new Map([
  //                               cheek wash, vermilion, brow ink
  [47, [[0.12, -0.46, 0.55, 0.18, 0.16, 0.43, 0.27, 0.41], 0xcd827d, 0xb46e72, 0x463435]],
  [0, [[0.06, 0.62, 0.74, -0.05, 0.73, -0.59, 0.48, -0.58], 0xaa775e, 0x956a5e, 0x51443e]],
  [9, [[-0.18, -0.61, 0.49, 0.36, -0.26, 0.72, -0.37, 0.66], 0xcf8a82, 0xac6676, 0x58403e]],
  [53, [[0.19, 0.83, 0.33, 0.44, -0.27, -0.22, 0.66, 0.12], 0xbc8b76, 0x9d6e64, 0x51413c]],
  [64, [[-0.58, -0.35, -0.43, 0.53, 0.55, 0.17, -0.21, -0.33], 0xc78d78, 0xa77972, 0x413b38]],
  [51, [[0.42, 0.53, -0.13, -0.56, -0.24, -0.63, -0.25, 0.27], 0xbb7d61, 0xa46b59, 0x493c32]],
  [55, [[0.49, -0.14, 0.73, -0.58, -0.55, 0.49, 0.3, 0.85], 0xd98b78, 0xbe7068, 0x5b4140]],
  [38, [[-0.67, 0.06, -0.59, 0.58, 0.38, -0.66, 0.54, -0.69], 0xb48270, 0x9d776f, 0x6c6057]],
  [4, [[0.44, -0.12, -0.21, -0.41, 0.03, 0.39, -0.53, 0.42], 0xc78371, 0xac7569, 0x463b35]],
  [5, [[-0.25, -0.62, -0.39, 0.8, 0.47, 0.31, 0.12, -0.14], 0xc38072, 0xac736c, 0x443736]],
  [36, [[0.21, 0.25, 0.38, -0.21, -0.42, -0.17, -0.44, -0.3], 0xa9785e, 0x996d60, 0x4c4035]],
  [14, [[0.22, -0.3, -0.18, 0.31, 0.46, -0.24, -0.19, 0.52], 0xc28878, 0xa97876, 0x67534e]],
])
const collection = [47, 9, 64, 4, 0, 55, 53, 51, 38, 5, 36, 14]
export const studyCast = collection
  .map((id) => byId.get(id))
  .map(([id, job, name, label]) => ({
    id,
    job,
    name,
    label,
    walking: id >= 47 || (id >= 22 && id < 36),
  }))

export function characterProfile(id, birthJob = 'walk') {
  const seed = (Math.imul(id + 17, 2654435761) ^ 0x6bd6315) >>> 0
  const rand = generator(seed),
    select = (arr) => arr[Math.floor(rand() * arr.length)]
  const symmetric = () => rand() + rand() - 1
  const record = byId.get(id),
    job = record?.[1] ?? birthJob
  const name = record?.[2] ?? surnames[Math.floor(rand() * surnames.length)] + select(givenNames)
  const garment = record?.[4] ?? select(roles[job] ?? roles.walk)
  const hair =
    record?.[5] ?? (job === 'row' || job === 'porter' ? select(['wrapped', 'knot', 'half']) : select(styles))
  const frame = record?.[6] ?? select(['lean', 'balanced', 'balanced', 'broad'])
  const age = record?.[7] ?? Math.round(19 + rand() * 48)
  const fitting = fittings[id]
  const palette = fitting?.[2] ?? palettes[record?.[8] ?? Math.floor(rand() * palettes.length)]
  const breadth = frame === 'broad' ? 1.1 : frame === 'lean' ? 0.92 : 1
  const jawBias = frame === 'broad' ? 0.39 : frame === 'lean' ? -0.22 : -0.09
  const face = {
    width: Math.max(-1, Math.min(1, symmetric() * 0.76 + (breadth - 1) * 2.6)),
    jaw: Math.max(-1, Math.min(1, symmetric() * 0.78 + jawBias)),
    cheek: symmetric(),
    chin: symmetric(),
    nose: symmetric(),
    eyes: symmetric(),
    brow: symmetric(),
    lips: symmetric(),
  }
  const portrait = portraits.get(id)
  if (portrait)
    faceControls.forEach((key, i) => {
      face[key] = portrait[0][i]
    })
  const portraitInk = portrait && { cheek: portrait[1], lip: portrait[2], brow: portrait[3] }
  const profile = {
    id,
    seed,
    name,
    job,
    age,
    frame,
    garment,
    hair,
    face,
    portraitInk,
    design: fitting?.[0],
    faceFamily: fitting?.[0] ?? otherStudies[id] ?? families[(seed >>> 13) % families.length],
    height: 1 + symmetric() * 0.063,
    shoulders: breadth + symmetric() * 0.036,
    hips: 0.99 + (breadth - 1) * 0.55 + symmetric() * 0.067,
    girth: breadth + symmetric() * 0.06,
    legLength: 1 + symmetric() * 0.06,
    armLength: 1 + symmetric() * 0.049,
    skin: sitterComplexions[id] ?? skinTones[record?.[9] ?? Math.floor(rand() * skinTones.length)],
    hairColor: age >= 62 ? 0x635b56 : select(hairTones),
    facialHair:
      ['row', 'watch', 'lantern', 'porter', 'carrier', 'flute'].includes(job) &&
      age > 40 &&
      (id % 3 !== 0 || job === 'row'),
    colors: {
      outer: palette[0],
      inner: palette[1],
      lower: palette[2],
      binding: palette[3],
      sash: palette[4],
      motif: palette[5],
    },
  }
  if (fitting)
    [profile.height, profile.shoulders, profile.hips, profile.girth, profile.legLength, profile.armLength] =
      fitting[1]
  return profile
}

// A fitting-room edit leaves the sitter's identity, complexion, proportions
// and animation phase in place. The descriptive fields are the authoring API.
export function characterVariant(profile, changes = {}) {
  const copy = { ...profile, face: { ...profile.face }, colors: { ...profile.colors } }
  if (Number.isFinite(changes.jaw)) {
    const jaw = Math.max(-1, Math.min(1, changes.jaw))
    const delta = jaw - profile.face.jaw
    copy.face.jaw = jaw
    copy.face.width = Math.max(-1, Math.min(1, profile.face.width + 0.35 * delta))
  }
  if (styles.includes(changes.hair)) copy.hair = changes.hair
  if (['duan', 'beizi', 'yuanling', 'aoqun', 'changshan', 'banbi'].includes(changes.garment))
    copy.garment = changes.garment
  if (['reed', 'plum', 'cloud', 'plain'].includes(changes.pattern)) copy.pattern = changes.pattern
  return copy
}
