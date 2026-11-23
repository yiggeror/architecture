import * as T from 'three'
import { generator } from './mesh.js'

const edge = 512

function clothTexture(paint, readPixels = false) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = edge
  paint(canvas.getContext('2d', { willReadFrequently: readPixels }), generator(37151))
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function gradient(g, stops, y, h) {
  const wash = g.createLinearGradient(0, y, 0, y + h)
  for (const [t, color] of stops) wash.addColorStop(t, color)
  return wash
}

function shadeCloth(lit) {
  return clothTexture((g, random) => {
    // One turn of each lamp shade. The seams close at the two ends of the swatch.
    for (let red = 0; red < 2; red++) {
      const y = red * 256,
        h = 256
      const colors = red
        ? lit
          ? ['#421110', '#9f1d10', '#ff5630', '#ff9b45', '#ce2f16', '#641316']
          : ['#5f2524', '#993c2d', '#bd5840', '#c86847', '#a54533', '#703024']
        : lit
          ? ['#4c1f0d', '#d4641a', '#ffab48', '#ffdc87', '#f69838', '#803611']
          : ['#83572e', '#ba8b51', '#dbaf6b', '#e4be7b', '#ca9f5f', '#987141']
      g.fillStyle = gradient(
        g,
        colors.map((color, i) => [[0, 0.14, 0.37, 0.57, 0.79, 1][i], color]),
        y,
        h
      )
      g.fillRect(0, y, edge, h)
      for (let j = 0; j < 12; j++) {
        const x = (j * edge) / 12,
          w = edge / 12
        const curve = g.createLinearGradient(x, 0, x + w, 0)
        for (const [pos, color] of [
          [0, '#2d160aae'],
          [0.06, '#421f1259'],
          [0.16, '#48201416'],
          [0.4, '#ffe5a109'],
          [0.69, '#ffeabd16'],
          [0.88, '#7740230b'],
          [1, '#3c1b1082'],
        ])
          curve.addColorStop(pos, color)
        g.fillStyle = curve
        g.fillRect(x, y, w + 0.25, h)
      }
      // Fine hoops sit underneath the silk. The copper rims and principal ribs are in the mesh.
      for (let j = 1; j < 15; j++) {
        const yy = y + (j * h) / 15
        g.fillStyle = lit ? '#43181142' : '#523c2937'
        g.fillRect(0, yy, edge, 1.15)
        g.fillStyle = '#ffe7b32e'
        g.fillRect(0, yy + 1.25, edge, 0.75)
      }
      for (const t of [0.13, 0.18, 0.82, 0.87]) {
        g.beginPath()
        for (let x = 0; x <= edge; x += 2) {
          const yy = y + h * t + (t < 0.5 ? 1 : -1) * 3.6 * Math.sin((12 * Math.PI * x) / edge) ** 2
          if (x === 0) g.moveTo(x, yy)
          else g.lineTo(x, yy)
        }
        g.lineWidth = t === 0.18 || t === 0.82 ? 1.2 : 2.25
        g.strokeStyle = red ? '#4e211697' : '#74431a9e'
        g.stroke()
      }
      for (let i = 0; i < 2700; i++) {
        g.fillStyle = i % 2 ? '#fff3c118' : '#2a170d17'
        g.fillRect(random() * edge, y + random() * h, 0.6 + random() * 2, 0.55 + random())
      }
    }
  })
}

// A narrow folding-screen painting. Reflected ink and transmitted lamp light
// share the same fibres, printed reeds and each bay's actual wick position.
function screenCloth(lit) {
  return clothTexture((g, random) => {
    const glow = g.createRadialGradient(163, 350, 6, 160, 344, 409)
    const stops = lit
      ? [
          [0, '#ffd197'],
          [0.14, '#ffc077'],
          [0.34, '#ee943e'],
          [0.56, '#b55c27'],
          [0.81, '#65351f'],
          [1, '#38241d'],
        ]
      : [
          [0, '#e6d4b3'],
          [0.45, '#ddccac'],
          [0.8, '#cdbe9f'],
          [1, '#b6a78e'],
        ]
    for (const [p, c] of stops) glow.addColorStop(p, c)
    g.fillStyle = glow
    g.fillRect(0, 0, edge, edge)
    const shade = g.createLinearGradient(0, 0, 0, 512)
    for (const [p, c] of [
      [0, '#30241785'],
      [0.1, '#38271b1c'],
      [0.23, '#38291c00'],
      [0.84, '#38271b00'],
      [1, '#38271b63'],
    ])
      shade.addColorStop(p, c)
    g.fillStyle = shade
    g.fillRect(0, 0, edge, edge)
    if (lit) {
      // Project the two inner stiles and their crossbar from the wick onto
      // the gauze. The front muntins occlude these shadows in depth.
      const projection = (0.43 - 0.104) / (0.43 - 0.166)
      for (const [u, v, horizontal] of [
        [0.21, 0, false],
        [0.8, 0, false],
        [0, 0.63, true],
      ]) {
        const at = horizontal
          ? edge * (1 - (0.317 + (v - 0.317) * projection))
          : edge * (0.318 + (u - 0.318) * projection)
        const half = edge * (horizontal ? 0.017 : 0.015) * 0.8
        const penumbra = horizontal
          ? g.createLinearGradient(0, at - half, 0, at + half)
          : g.createLinearGradient(at - half, 0, at + half, 0)
        for (const [stop, alpha] of [
          [0, '00'],
          [0.3, '45'],
          [0.66, '54'],
          [1, '00'],
        ])
          penumbra.addColorStop(stop, '#372318' + alpha)
        g.fillStyle = penumbra
        if (horizontal) g.fillRect(0, at - half, edge, 2 * half)
        else g.fillRect(at - half, 0, 2 * half, edge)
      }
    }
    g.lineCap = 'round'
    // Reeds painted at the edge leave the centre of the screen quiet.
    const stalks = [
      [505, 520, 486, 390, 437, 252],
      [476, 530, 436, 449, 371, 363],
      [491, 532, 521, 347, 503, 284],
      [10, 528, 30, 467, 84, 419],
    ]
    function reed(ax, ay, bx, by, cx, cy) {
      g.beginPath()
      g.moveTo(ax, ay)
      g.quadraticCurveTo(bx, by, cx, cy)
      g.lineWidth = 2.3
      g.strokeStyle = lit ? '#341b13a8' : '#645642a6'
      g.stroke()
      for (let j = 1; j <= 4; j++) {
        const t = 0.16 * j,
          q = 1 - t,
          x = q * q * ax + 2 * t * q * bx + t * t * cx,
          y = q * q * ay + 2 * t * q * by + t * t * cy
        const dx = (j % 2 ? -1 : 1) * (11 + 35 * random()),
          dy = -9 - 25 * random()
        g.beginPath()
        g.moveTo(x, y)
        g.quadraticCurveTo(x + 0.46 * dx - 4, y + 0.58 * dy - 4, x + dx, y + dy)
        g.quadraticCurveTo(x + 0.54 * dx + 5, y + 0.61 * dy + 5, x, y)
        g.fillStyle = lit ? '#3d201780' : '#635d497c'
        g.fill()
      }
    }
    for (const p of stalks) reed(...p)
    for (let j = 0; j < 6; j++) {
      const cy = 465 + j * 8
      g.beginPath()
      for (let x = 0; x <= edge; x += 3) {
        const y = cy + 4 * Math.sin(x * 0.041 + j * 0.7) + 2 * Math.sin(x * 0.072 + j * 0.25)
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.strokeStyle = j % 2 ? '#8b73503e' : '#594a3b4a'
      g.lineWidth = 1.45
      g.stroke()
    }
    const hem = lit ? '#4b2a1e88' : '#88735883'
    g.strokeStyle = hem
    g.lineWidth = 2.6
    g.strokeRect(11, 9, 490, 494)
    for (let i = 2; i < 512; i += 3) {
      g.fillStyle = i % 2 ? '#3f311c16' : '#fff5d118'
      g.fillRect(i, 0, 0.72, 512)
      g.fillRect(0, i, 512, 0.55)
    }
    for (let i = 0; i < 5300; i++) {
      g.fillStyle = i % 2 ? '#ffebbb20' : '#53402c1f'
      g.fillRect(random() * edge, random() * edge, 0.8 + random() * 2.2, 0.55 + random() * 1.1)
    }
  })
}

function limestone() {
  const map = clothTexture((g, random) => {
    g.fillStyle = '#bdbdb5'
    g.fillRect(0, 0, edge, edge)
    // Veining, chisel nicks and dark mineral flecks at several scales.
    for (let i = 0; i < 100; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = 12 + random() * 38
      const cloud = g.createRadialGradient(x, y, 1, x, y, r)
      cloud.addColorStop(0, i % 2 ? '#969a9028' : '#dbd5c828')
      cloud.addColorStop(1, '#bcbdb500')
      g.fillStyle = cloud
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const pixels = g.getImageData(0, 0, 512, 512)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const speck = (random() - 0.5) * 16
      for (let c = 0; c < 3; c++) pixels.data[i + c] += speck
    }
    g.putImageData(pixels, 0, 0)
    for (let i = 0; i < 5300; i++) {
      const x = random() * 512,
        y = random() * 512
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + 0.5 + random() * 2.7, y + random() * 1.6 - 0.8)
      g.strokeStyle = i % 3 ? '#575e5844' : '#efead94c'
      g.lineWidth = 0.5 + random()
      g.stroke()
    }
  }, true)
  if (map) map.wrapS = map.wrapT = T.RepeatWrapping
  return map
}

export function gatePalette(source) {
  const m = { ...source }
  const swatch = (key, color, roughness) => {
    const mat = source[key].clone()
    mat.name = 'gate ' + key
    mat.color.set(color)
    mat.roughness = roughness
    m[key] = mat
    return mat
  }
  swatch('darkwood', 0x422b28, 0.69)
  swatch('vermilion', 0x9f3e2b, 0.62).map = source.wood.map
  const rock = limestone()
  for (const [name, col, r] of [
    ['foundation', 0x575b5b, 0.83],
    ['stone', 0x999b92, 0.77],
    ['coping', 0xb4ac94, 0.65],
  ]) {
    const mat = swatch(name, col, r)
    if (rock) mat.map = rock
  }
  const silk = (name, day, warm, power) => {
    const mat = new T.MeshStandardMaterial({
      name,
      vertexColors: true,
      side: T.DoubleSide,
      color: day,
      roughness: 1,
      emissive: warm,
      emissiveIntensity: power,
    })
    mat.userData.cast = false
    return mat
  }
  m.gateLantern = silk('gate ribbed silk lantern', 0xa48772, 0xffefd2, 2.85)
  m.gateLantern.map = shadeCloth(false)
  m.gateLantern.emissiveMap = shadeCloth(true)
  m.gateScreen = silk('gate woven window screen', 0xe2d3b7, 0xffefda, 1.13)
  m.gateScreen.map = screenCloth(false)
  m.gateScreen.emissiveMap = screenCloth(true)
  m.gateWick = silk('gate lamp flame', 0xb47943, 0xffbd65, 3.6)
  return m
}
