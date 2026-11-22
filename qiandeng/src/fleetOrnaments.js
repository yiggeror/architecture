import * as T from 'three'

// Backlit paper cuts painted in four bays. The hull carries the artwork as a
// proper surface; UVs keep the cut borders registered to the timber joinery.
export function cutPaper(m) {
  if (typeof document === 'undefined') return m.redSilk
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 160
  const g = cv.getContext('2d')
  const path = (d, fill, stroke, w = 1.5) => {
    const p = new Path2D(d)
    if (fill) {
      g.fillStyle = fill
      g.fill(p)
    }
    if (stroke) {
      g.strokeStyle = stroke
      g.lineWidth = w
      g.stroke(p)
    }
  }
  g.lineJoin = 'round'
  g.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    g.save()
    g.translate(i * 256, 0)
    const ground = g.createLinearGradient(0, 0, 0, 160)
    ground.addColorStop(0, '#742734')
    ground.addColorStop(0.52, '#ac3f36')
    ground.addColorStop(1, '#642737')
    g.fillStyle = ground
    g.fillRect(0, 0, 256, 160)
    for (const v of [6, 12]) {
      g.strokeStyle = v === 6 ? '#efc47d' : '#dc9759'
      g.lineWidth = v === 6 ? 2 : 1.3
      g.strokeRect(v, v, 256 - v * 2, 160 - v * 2)
    }
    const gold = '#f8ca78',
      pale = '#ffe0a3',
      dark = '#713243'
    for (const sg of [-1, 1]) {
      g.save()
      if (sg === 1) {
        g.translate(256, 0)
        g.scale(-1, 1)
      }
      path('M18 52V18h50v8H32v15h14v-7h12v15H26v12H18 M18 115v27h46v-7H29v-11h17v7h13v-15H25v-9', gold)
      path(
        'M21 91 C37 78 38 59 58 59 C72 59 77 73 67 77 C59 80 51 72 60 68 M28 98 C45 91 51 78 70 83 C83 86 86 95 82 100',
        null,
        '#dda263',
        3
      )
      g.restore()
    }
    if (i === 0) {
      for (const [dx, rot] of [
        [-20, -0.7],
        [-9, -0.35],
        [0, 0],
        [9, 0.35],
        [20, 0.7],
      ]) {
        g.save()
        g.translate(128 + dx, 108)
        g.rotate(rot)
        path('M0 0 Q-22 -23 0 -65 Q23 -27 0 0Z', gold, dark, 2.8)
        path('M0 -3 Q-4 -26 0 -52', null, '#c67e48', 1.4)
        g.restore()
      }
      path('M76 111q25-8 43 2q10 4 19-1q20-8 46-3 M85 121q28-6 42 0t45-1', null, pale, 2)
    } else if (i === 1) {
      path('M82 89q27-43 64-26q13 5 25 4l20-16-5 22 7 16-23-7q-28 26-56 21q-20-2-32-14z', gold, dark, 2.8)
      path('M119 65q-9-15-17-13q2 10 9 18 M125 96q-1 13-12 15q5-10 7-17', gold, dark, 2.4)
      path('M100 74q14 7 8 24 M122 72q-6 7 0 12m11-16q-6 8 1 13m11-8q-6 7 0 11', null, '#9d5e40', 2.3)
      g.fillStyle = dark
      g.beginPath()
      g.arc(98, 81, 3.2, 0, Math.PI * 2)
      g.fill()
    } else if (i === 2) {
      path('M104 119q25-23 35-52q6-18 23-39 M128 90q-18-2-28-20m28 19q22 4 35-9', null, gold, 4.3)
      for (const [x, y] of [
        [102, 67],
        [145, 51],
        [164, 77],
        [125, 84],
        [157, 30],
      ]) {
        for (let j = 0; j < 5; j++) {
          const a = (j * 2 * Math.PI) / 5
          g.fillStyle = pale
          g.beginPath()
          g.ellipse(x + 5 * Math.cos(a), y + 5 * Math.sin(a), 4.9, 3.7, a, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = '#b36441'
        g.fillRect(x - 2, y - 2, 4, 4)
      }
    } else {
      path(
        'M73 96q13-6 21-18q8-13 21-9q1-21 17-24q15-2 24 12q21-4 27 12q8 20-14 24q-15 2-16-9q1-8 10-6 M76 106q24-6 34-20q8-10 18-6q-4-21 11-24q12-2 16 9 M107 113q13-11 26-11q17 0 25 9q12 7 25 2',
        null,
        gold,
        5
      )
    }
    g.restore()
  }
  const texture = new T.CanvasTexture(cv)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 4
  return new T.MeshStandardMaterial({
    name: '画舷镂纸',
    map: texture,
    emissiveMap: texture,
    emissive: 0xffb676,
    emissiveIntensity: 0.62,
    color: 0xffffff,
    roughness: 0.73,
    side: T.DoubleSide,
    vertexColors: true,
  })
}

export function pennants(ships, m) {
  const list = []
  for (const [boat, x, z, base, span, hue] of [
    [0, -0.68, -5.53, 3.94, 0.77, m.wine],
    [0, 0.69, -5.55, 3.55, 0.63, m.redSilk],
    [1, 0.35, -2.43, 3.28, 0.56, m.vermilion],
  ]) {
    const ship = ships[boat],
      group = ship.group
    const shaft = new T.CylinderGeometry(0.03, 0.041, base - ship.spec.deck, 7)
    const pole = new T.Mesh(shaft, m.bronze)
    pole.position.set(x, (base + ship.spec.deck) * 0.5, z)
    group.add(pole)
    const rows = 9,
      cols = 4,
      pos = new Float32Array((rows + 1) * (cols + 1) * 3),
      colors = [],
      uv = [],
      ix = []
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const u = i / cols,
          v = j / rows
        colors.push(...(j === rows - 1 || j === 1 || i === 0 || i === cols ? [1.28, 1.08, 0.75] : [1, 1, 1]))
        uv.push(u, v)
        if (j < rows && i < cols) {
          let k = j * (cols + 1) + i
          ix.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1)
        }
      }
    const geom = new T.BufferGeometry(),
      pa = new T.BufferAttribute(pos, 3)
    pa.setUsage(T.DynamicDrawUsage)
    geom.setAttribute('position', pa)
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    geom.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
    geom.setIndex(ix)
    const cloth = new T.Mesh(geom, hue)
    cloth.frustumCulled = false
    group.add(cloth)
    const bar = new T.Mesh(new T.CylinderGeometry(0.024, 0.026, span + 0.09, 7), m.gold)
    bar.rotation.x = Math.PI / 2
    bar.position.set(x, base, z - span * 0.5)
    group.add(bar)
    list.push({ geometry: geom, pa, x, z, base, span, rows, cols, boat })
  }
  let stamp = -Infinity
  return function (t) {
    if (t >= stamp && t - stamp < 0.085) return
    stamp = t
    for (const f of list) {
      for (let j = 0; j <= f.rows; j++)
        for (let i = 0; i <= f.cols; i++) {
          const u = i / f.cols,
            v = j / f.rows,
            k = j * (f.cols + 1) + i
          const breeze =
            0.12 * Math.sin(t * 2.12 - v * 5.1 - u * 1.2 + f.z) +
            0.046 * Math.sin(t * 3.7 - v * 7.1 + u * 2.2)
          f.pa.setXYZ(
            k,
            f.x + v * (breeze + 0.12 * u),
            f.base - v * (0.94 + 0.28 * (1 - Math.abs(u - 0.5) * 2)) + 0.051 * v * Math.sin(t * 1.59 + u * 4),
            f.z - u * f.span - 0.23 * v + 0.07 * v * Math.sin(t * 2.17 + u * 6)
          )
        }
      f.pa.needsUpdate = true
      f.geometry.computeVertexNormals()
    }
  }
}

// Hand-folded offerings stay in the slow water along the two margins of the
// procession. Their overlapping petals enclose a separate wick and a low cup.
export function waterOfferings(scene, m) {
  const pos = [],
    colors = [],
    uv = [],
    ix = []
  const add = (a, c, f) => {
    const k = pos.length / 3
    pos.push(...a)
    colors.push(...c)
    uv.push(...f)
    return k
  }
  for (let ring = 0; ring < 2; ring++)
    for (let j = 0; j < 8; j++) {
      const a = ((j + ring * 0.5) * Math.PI) / 4
      const pt = (r, h, side) => [
        Math.cos(a) * r - Math.sin(a) * side,
        h,
        Math.sin(a) * r + Math.cos(a) * side,
      ]
      const root = ring ? 0.08 : 0.063,
        high = ring ? 0.183 : 0.123,
        reach = ring ? 0.154 : 0.247
      const k = add(pt(root, 0.027, 0), [0.69, 0.4, 0.3], [0.5, 0])
      add(pt(reach * 0.78, high * 0.58, -0.06), [1, 0.69, 0.54], [0, 0.5])
      add(pt(reach + 0.007, high, 0.0), [1.12, 0.92, 0.74], [0.5, 1])
      add(pt(reach * 0.78, high * 0.58, 0.061), [1, 0.64, 0.5], [1, 0.5])
      add(pt(reach * 0.69, high * 0.55, 0), [1.06, 0.85, 0.7], [0.5, 0.5])
      ix.push(k, k + 1, k + 4, k + 1, k + 2, k + 4, k + 4, k + 2, k + 3, k, k + 4, k + 3)
    }
  const petals = new T.BufferGeometry()
  petals.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  petals.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  petals.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  petals.setIndex(ix)
  petals.computeVertexNormals()
  function white(g) {
    g.setAttribute(
      'color',
      new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)
    )
    return g
  }
  const places = []
  for (const [x, z, n] of [
    [-13.75, 15.8, 3],
    [-14.15, 37.8, 4],
    [5.6, 28.4, 4],
    [7.2, 52.5, 3],
    [5.3, -29.5, 3],
    [-13.85, -46.7, 3],
  ]) {
    for (let j = 0; j < n; j++) {
      const phase = places.length * 2.39
      places.push({
        x: x + 0.88 * Math.sin(phase),
        z: z + (j - n * 0.42) * 1.62 + 0.53 * Math.cos(phase),
        phase,
        scale: 0.69 + 0.24 * (0.5 + 0.5 * Math.cos(phase * 0.74)),
      })
    }
  }
  const bodies = new T.InstancedMesh(petals, m.paper, places.length)
  const cups = new T.InstancedMesh(
    white(new T.CylinderGeometry(0.123, 0.079, 0.049, 10)),
    m.patina,
    places.length
  )
  const candles = new T.InstancedMesh(white(new T.SphereGeometry(0.042, 8, 6)), m.lantern, places.length)
  for (const q of [bodies, cups, candles]) {
    q.name = '随波荷灯'
    q.frustumCulled = false
    scene.add(q)
  }
  const paint = new T.Color(),
    dummy = new T.Object3D(),
    tones = [0xe98b76, 0xffddad, 0xd2ae86, 0xe9a5a0, 0xf1cc88]
  for (let i = 0; i < places.length; i++) bodies.setColorAt(i, paint.set(tones[i % 5]))
  let last = -Infinity
  return (t) => {
    if (t >= last && t - last < 0.09) return
    last = t
    places.forEach((p, i) => {
      const a = p.phase,
        k = p.scale
      dummy.rotation.set(
        0.038 * Math.sin(t * 0.81 + a),
        a + 0.17 * Math.sin(t * 0.19 + a),
        0.047 * Math.cos(t * 0.72 + a)
      )
      dummy.position.set(
        p.x + 0.37 * Math.sin(t * 0.092 + a),
        0.012 + 0.007 * Math.sin(t * 1.58 + a),
        p.z + 0.58 * Math.sin(t * 0.084 + a)
      )
      dummy.scale.setScalar(k)
      dummy.updateMatrix()
      bodies.setMatrixAt(i, dummy.matrix)
      dummy.position.y += 0.003
      dummy.updateMatrix()
      cups.setMatrixAt(i, dummy.matrix)
      dummy.position.y += k * 0.116
      dummy.scale.set(0.64 * k, (1.45 + 0.14 * Math.sin(t * 5 + a)) * k, 0.65 * k)
      dummy.updateMatrix()
      candles.setMatrixAt(i, dummy.matrix)
    })
    bodies.instanceMatrix.needsUpdate =
      cups.instanceMatrix.needsUpdate =
      candles.instanceMatrix.needsUpdate =
        true
  }
}
