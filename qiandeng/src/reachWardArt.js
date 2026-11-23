import * as T from 'three'
import { generator } from './mesh.js'
import { roomArt } from './reachWardRooms.js'
import { drawLampSilk, paperLight } from './wardLampPaint.js'
const sz = 128,
  cols = 8,
  rows = 15
const wood = ['#432f2b', '#773e32', '#3c514d', '#a48053']
const wall = ['#d9c5a7', '#bba98c', '#736d6b', '#bfb7a1']
const glaze = ['#3e6462', '#465962', '#4a5159', '#48605a']
const silk = ['#a14c49', '#385c75', '#357066', '#aa713e']
const wardNames = [
  '锦浦织坊',
  '南栈船行',
  '东市灯街',
  '西津茶埠',
  '书坊刻肆',
  '织云罗市',
  '桂浦香街',
  '鹿鸣社馆',
  '玉京会馆',
  '花津绣里',
  '铜雀窑行',
  '岑楼灯巷',
  '画桥墨市',
  '星渡夜航',
  '临江长廊',
  '顺风归棹',
]
export function wardPlaque(group) {
  const index = wardNames.findIndex((name) => name.startsWith(group))
  return 96 + (index < 0 ? 14 : index)
}
const brands = [
  '云锦庄',
  '罗衣坊',
  '彩云织',
  '双鸾绣',
  '万艘行',
  '南货栈',
  '松江船行',
  '水驿茶棚',
  '永安号',
  '灯火集',
  '江上春',
  '五味行',
  '澹墨斋',
  '松筠书肆',
  '砚山堂',
  '听雨楼',
  '叙德会馆',
  '同善堂',
  '长乐社',
  '延宾楼',
  '铜花局',
  '陶然窑',
  '瑞丰茶器',
  '秋水轩',
]
function line(g, x, y, X, Y, w, col) {
  g.strokeStyle = col
  g.lineWidth = w
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(X, Y)
  g.stroke()
}
function field(g, c) {
  g.fillStyle = c
  g.fillRect(0, 0, sz, sz)
}
function windows(g, id, light) {
  const k = id % 8,
    room = id < 8,
    wall = k % 4 < 2 ? '#87624c' : '#6d6858',
    jamb = light ? '#100a05' : '#432e28'
  field(g, light ? 'black' : wall)
  const top = 8,
    bottom = 91,
    x = 8,
    w = 112
  const c = room
    ? ['#ffdc94', '#ffc577', '#f9d79d', '#f6ca8a', '#ffd798', '#efbb7e', '#f2d5a5', '#ffe3a5'][k]
    : ['#9c7959', '#746f62', '#998169', '#6f7470', '#998466', '#717473', '#84785b', '#968068'][k]
  const soft = g.createRadialGradient(32 + 8 * (k % 6), 57, 2, 65, 57, 78)
  soft.addColorStop(0, light ? (room ? c : '#513826') : c)
  soft.addColorStop(0.64, light ? (room ? '#dda36a' : '#352d24') : c)
  soft.addColorStop(1, light ? (room ? '#412a23' : '#12110f') : '#694e40')
  g.fillStyle = soft
  g.fillRect(x, top, w, bottom - top)
  if (room && light) {
    g.save()
    g.translate(x, top)
    g.scale(w / 128, (bottom - top) / 128)
    paperLight(g, k)
    g.restore()
  }
  for (const xx of [x, x + w / 2, x + w]) line(g, xx, top, xx, bottom, xx === x + w / 2 ? 3.3 : 4, jamb)
  for (const yy of [top, top + 13, bottom - 13, bottom])
    line(g, x, yy, x + w, yy, yy === top || yy === bottom ? 4 : 2, jamb)
  for (let col = 0; col < 4; col++) {
    const l = x + (col * w) / 4,
      r = l + w / 4,
      mid = (l + r) / 2
    line(g, l, top + 3, l, bottom - 3, 2.3, jamb)
    if (k % 3 === 0) {
      line(g, l, 53, mid, 29, 2, jamb)
      line(g, mid, 29, r, 53, 2, jamb)
      line(g, l, 53, mid, 74, 2, jamb)
      line(g, mid, 74, r, 53, 2, jamb)
    } else if (k % 3 === 1) {
      line(g, l, 35, r, 35, 2, jamb)
      line(g, l, 66, r, 66, 2, jamb)
      line(g, mid, 21, mid, 35, 1.8, jamb)
      line(g, mid, 66, mid, 79, 1.8, jamb)
    } else {
      line(g, l + 5, 23, l + 5, 31, 2, jamb)
      line(g, l + 5, 31, r - 4, 31, 2, jamb)
      line(g, r - 4, 31, r - 4, 23, 2, jamb)
      line(g, mid, 31, mid, 72, 2, jamb)
      line(g, l + 5, 72, r - 4, 72, 2, jamb)
    }
  }
  if (!light) {
    g.fillStyle = '#543d34'
    g.fillRect(4, 94, 120, 6)
    g.strokeStyle = '#a18360'
    g.lineWidth = 2
    for (let j = 0; j < 3; j++) g.strokeRect(9 + j * 39, 103, 31, 17)
    g.fillStyle = '#75624d'
    g.fillRect(0, 123, 128, 5)
  }
}
function tile(g, id, light, r) {
  if (id >= 116) {
    // Turned bronze and darker weathered copper share the existing atlas.
    // Their faces catch the flame. Only the wick has a transmission plate.
    if (light) {
      field(g, id === 119 ? '#ffe7a3' : '#010101')
      return
    }
    if (id === 118 || id === 119) {
      field(g, id === 119 ? '#efc67f' : '#292822')
      return
    }
    const copper = id === 117,
      polish = g.createLinearGradient(0, 18, 128, 63)
    const colours = copper
      ? ['#45524a', '#838473', '#4c6156', '#74816f', '#435146']
      : ['#816441', '#ccb58a', '#96774b', '#cfb485', '#836942']
    for (let i = 0; i < colours.length; i++) polish.addColorStop([0, 0.19, 0.44, 0.76, 1][i], colours[i])
    g.fillStyle = polish
    g.fillRect(0, 0, 128, 128)
    for (let j = 0; j < 320; j++) {
      const x = r() * 128,
        y = r() * 128
      line(
        g,
        x,
        y,
        x + 2 + r() * 11,
        y + r() * 0.43,
        0.58,
        j % 3 ? 'rgba(42,49,35,.065)' : 'rgba(244,224,169,.12)'
      )
    }
    return
  }
  if (id >= 112) {
    // Window lining, sill and the board under the lamp arm have different
    // depth axes. Their inner arrises catch the same spill as the paper.
    const lining = id === 112 || id === 113,
      deck = id === 115
    if (!light) {
      tile(g, deck ? 33 : lining ? 24 : 27, false, r)
      return
    }
    field(g, '#040303')
    const wash = g.createRadialGradient(
      lining ? 129 : 64,
      lining ? 63 : deck ? -18 : -6,
      2,
      lining ? 135 : 64,
      lining ? 62 : 0,
      deck ? 168 : 153
    )
    wash.addColorStop(0, id === 113 ? '#986540' : deck ? '#855331' : '#c18850')
    wash.addColorStop(0.3, id === 113 ? '#65432a' : '#956139')
    wash.addColorStop(0.72, '#533824')
    wash.addColorStop(1, '#161716')
    g.fillStyle = wash
    g.fillRect(0, 0, 128, 128)
    if (deck) {
      for (const y of [42, 85, 125]) line(g, 0, y, 128, y, 2.2, '#372c22')
      for (let j = 0; j < 3; j++)
        line(g, 32 + 50 * (j % 2), 42 * j, 32 + 50 * (j % 2), 42 * (j + 1), 1.5, '#39291d')
    }
    return
  }
  if (id === 36 || id === 37) {
    drawLampSilk(g, id === 37 ? 0 : 1, light)
    return
  }
  if (id >= 64 && id < 96) {
    roomArt(g, id, light)
    return
  }
  if (id < 16) {
    windows(g, id, light)
    return
  }
  field(g, 'black')
  if (id >= 40) {
    const bg = ['#43352f', '#314846', '#593935', '#374248'][id % 4]
    field(g, light ? '#030201' : bg)
    const ink = light ? '#805222' : '#edcd87'
    g.strokeStyle = light ? '#201505' : '#a38555'
    g.lineWidth = 2
    g.strokeRect(4, 9, 120, 110)
    g.lineWidth = 1
    g.strokeRect(8, 15, 112, 98)
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = 'bold 25px "Noto Serif CJK SC","Songti SC",serif'
    g.save()
    g.translate(64, 64)
    g.scale(1, 2.35)
    g.fillText(id < 64 ? brands[id - 40] : wardNames[id - 96], 0, 0, 109)
    g.restore()
    if (!light) {
      g.fillStyle = '#ab483c'
      g.fillRect(111, 96, 6, 12)
    }
    return
  }
  if (light) {
    if (id === 39) field(g, '#967449')
    return
  }
  if (id < 20) {
    field(g, wall[id - 16])
    for (let i = 0; i < 300; i++) {
      g.fillStyle = i % 2 ? 'rgba(80,66,55,.075)' : 'rgba(255,240,202,.095)'
      g.fillRect(r() * 128, r() * 128, 1 + r() * 9, 0.4 + r() * 2)
    }
    if (id < 18) {
      const damp = g.createLinearGradient(0, 0, 0, 128)
      damp.addColorStop(0, 'rgba(72,64,51,.22)')
      damp.addColorStop(0.16, 'rgba(88,81,66,.025)')
      damp.addColorStop(0.72, 'rgba(246,220,169,.045)')
      damp.addColorStop(1, 'rgba(78,74,61,.14)')
      g.fillStyle = damp
      g.fillRect(0, 0, 128, 128)
      for (let j = 0; j < 14; j++) {
        const x = r() * 128
        line(g, x, 0, x + 0.8 + (r() - 0.5) * 5, 8 + r() * 38, 0.4 + r() * 1.4, 'rgba(85,77,62,.13)')
      }
    }
    if (id === 18 || id === 19)
      for (let j = 0; j < 9; j++) {
        line(g, 0, j * 15, 128, j * 15, 1.5, '#655b55')
        for (let i = -1; i < 4; i++)
          line(g, i * 42 + (j % 2) * 21, j * 15, i * 42 + (j % 2) * 21, j * 15 + 15, 1, '#75685d')
      }
  } else if (id < 24) {
    field(g, glaze[id - 20])
    for (let i = 0; i <= 13; i++) {
      const x = i * 10
      line(g, x, 0, x, 128, 2.8, '#243b40')
      line(g, x + 2, 0, x + 2, 128, 1.3, '#91a3a0')
      for (let j = 0; j < 6; j++)
        line(g, x + 2, j * 26 + (i & 1) * 6, x + 10, j * 26 + (i & 1) * 6, 1, '#263e45')
    }
  } else if (id < 28) {
    field(g, wood[id - 24])
    for (let j = 0; j < 64; j++) {
      const y = r() * 128
      line(g, 0, y, 128, y + (r() - 0.5) * 9, 0.5 + r() * 1.6, j % 2 ? '#785b459b' : '#332e2b57')
    }
  } else if (id < 32) {
    field(g, silk[id - 28])
    for (let j = -1; j < 7; j++)
      for (let i = -1; i < 7; i++) {
        const x = i * 26 + (j % 2) * 13,
          y = j * 24
        g.strokeStyle = '#d7af73'
        g.lineWidth = 1.1
        g.beginPath()
        g.moveTo(x - 9, y)
        g.quadraticCurveTo(x - 2, y - 10, x, y - 7)
        g.quadraticCurveTo(x + 7, y - 11, x + 9, y - 1)
        g.quadraticCurveTo(x + 2, y + 8, x, y + 9)
        g.closePath()
        g.stroke()
      }
  } else if (id === 32 || id === 33) {
    field(g, id === 32 ? '#5c4b3e' : '#777471')
    for (let j = 0; j < 6; j++) {
      line(g, 0, j * 25, 128, j * 25, 2, '#413c38')
      line(g, (j * 33) % 128, j * 25, (j * 33) % 128, j * 25 + 24, 1.5, '#514b46')
    }
  } else if (id === 34) {
    field(g, '#564438')
    for (let j = 0; j < 14; j++) {
      line(g, 0, j * 10, 128, j * 10, 3, '#987b5a')
      line(g, 0, j * 10 + 3, 128, j * 10 + 3, 2.4, '#383331')
    }
  } else if (id === 35) {
    field(g, '#675346')
    for (let y = 8; y < 128; y += 23)
      for (let x = 5; x < 128; x += 30) {
        g.strokeStyle = '#bda37b'
        g.strokeRect(x, y, 25, 18)
        g.fillStyle = '#c9ac70'
        g.fillRect(x + 10, y + 8, 5, 3)
      }
  } else {
    field(g, id === 38 ? '#6a928c' : '#b58f57')
    for (let j = 0; j < 6; j++) line(g, 0, j * 23, 128, j * 23, 1.2, '#816746')
  }
}
function atlas(light) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = sz * cols
  c.height = sz * rows
  const g = c.getContext('2d'),
    r = generator(62574)
  for (let i = 0; i < rows * cols; i++) {
    g.save()
    g.translate((i % 8) * sz, Math.floor(i / 8) * sz)
    g.beginPath()
    g.rect(0, 0, sz, sz)
    g.clip()
    tile(g, i, light, r)
    g.restore()
  }
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 4
  return t
}
export function reachMaterials(m) {
  if (m.reachFrame) return
  const map = atlas(false),
    em = atlas(true)
  let silk = null
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = 'rgba(210,177,113,.35)'
    g.fillRect(0, 0, 128, 128)
    for (let k = 0; k <= 4; k++) {
      line(g, 32 * k, 0, 32 * k, 128, 3, '#574433')
      line(g, 0, 32 * k, 128, 32 * k, 1.5, '#937249')
    }
    for (let k = 0; k < 7; k++) {
      line(g, 0, k * 21, 128, k * 21 + 23, 0.6, 'rgba(216,190,152,.4)')
    }
    silk = new T.CanvasTexture(c)
    silk.colorSpace = T.SRGBColorSpace
  }
  m.reachGlazing = new T.MeshStandardMaterial({
    name: '坊间透绢',
    color: 0xeac796,
    emissive: 0x7c612d,
    emissiveIntensity: 0.45,
    map: silk,
    vertexColors: true,
    side: T.DoubleSide,
    roughness: 0.83,
    transparent: true,
    depthWrite: false,
  })
  m.reachGlazing.userData.noCollision = true
  m.reachGlazing.userData.cast = false
  m.reachFrame = new T.MeshStandardMaterial({
    name: '江城街坊',
    map,
    emissiveMap: em,
    emissive: 0xffdd9a,
    emissiveIntensity: 2.38,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.67,
    side: T.DoubleSide,
  })
  // Keep only occupied window quads at every projected size. Structural
  // triangles on the same facade retain the normal screen-space reduction.
  m.reachPaper = m.reachFrame.clone()
  m.reachPaper.name = '灯下人家窗纸'
  m.reachPaper.emissive.set(0xffe4be)
  m.reachPaper.emissiveIntensity = 2.73
  m.reachDetail = m.reachFrame.clone()
  m.reachDetail.name = '街坊木作丝帘'
  m.reachDetail.emissiveIntensity = 1.72
  m.reachDetail.userData.noCollision = true
  m.reachLights = m.reachFrame.clone()
  m.reachLights.name = '灯市绢面'
  m.reachLights.emissiveIntensity = 3.8
  m.reachLights.userData.noCollision = true
  m.reachLights.userData.cast = false
}
export function reachFace(b, mat, slot, points, tint = 1, uv = null) {
  const u = (slot % 8) / 8,
    v = 1 - (Math.floor(slot / 8) + 1) / rows
  const pad = 0.009
  const coords = uv || [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]
  b.face(
    mat,
    points,
    tint,
    points.map((_, j) => [
      u + (pad + coords[j][0] * (1 - 2 * pad)) / 8,
      v + (pad + coords[j][1] * (1 - 2 * pad)) / rows,
    ])
  )
}
