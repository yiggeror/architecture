// The soundboard carries one asymmetric design: a blue kingfisher at the
// tip of an old plum bough, with petals drifting toward the opposite rim.
// Coordinates are millimetres in the instrument's own front elevation.
export function paintPipa(ctx, width, height) {
  ctx.save()
  ctx.translate(width / 2, height)
  ctx.scale(width / 350, -height / 480)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const path = (d, fill, stroke, weight = 0.45) => {
    const p = new Path2D(d)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fill(p)
    }
    if (stroke) {
      ctx.lineWidth = weight
      ctx.strokeStyle = stroke
      ctx.stroke(p)
    }
  }
  const dot = (x, y, rx, ry, col) => {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.fill()
  }
  const nacre = (x, y, dx, dy, tones) => {
    const g = ctx.createLinearGradient(x, y, x + dx, y + dy)
    for (const [i, col] of tones.entries()) g.addColorStop(i / (tones.length - 1), col)
    return g
  }
  // Lacquer in hairline incisions, with little flecks of exposed amber wood.
  path(
    'M141 74 Q131 90 123 97 C115 107 119 112 107 123 C96 132 86 143 91 157 C94 166 103 172 102 182 C102 190 98 194 98 199 L98 187 Q100 174 91 166 C77 153 83 140 91 129 C96 124 100 121 104 117 Q115 109 115 103 L119 99 Q129 92 141 74Z',
    '#816346',
  )
  path('M132 85 C120 100 113 102 113 112 Q94 133 90 139 M90 148 Q85 155 92 162', null, '#c4a46e', 0.95)
  path(
    'M90 146 C86 150 71 153 66 163 Q63 168 59 169 M92 138 C86 145 79 147 76 146 M114 111 C122 120 132 121 135 136 Q138 151 143 157 M127 122 Q127 131 123 135 M135 137 Q142 139 147 145 M99 186 Q89 193 89 206 M101 182 Q112 188 112 195 M99 197 Q104 203 103 211 M106 120 Q111 131 111 138',
    null,
    '#836b4a',
    1.15,
  )
  path(
    'M67 161 Q76 155 83 155 M93 158 Q95 165 99 167 M124 99 L125 95 M117 111 Q116 117 119 120',
    null,
    '#a88b62',
    0.5,
  )
  function flower(x, y, r, roll, side) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(roll)
    ctx.scale(r, r)
    if (side) ctx.scale(0.7, 1)
    const shell = nacre(-1, -0.7, 2, 1.2, ['#b98877', '#e1bd9f', '#eee1c8', '#bbcebc', '#f6edd8'])
    for (let i = 0; i < 5; i++) {
      ctx.save()
      ctx.rotate((i * 2 * Math.PI) / 5)
      path(
        'M-.09 -.02 Q-.43 .18 -.48 .56 C-.61 .88 -.41 1.03 -.26 .97 Q-.12 1.08 -.015 .97 Q.19 1.04 .31 .89 Q.44 .73 .29 .49 Q.26 .21 .06 .04Z',
        shell,
        '#9a745d',
        0.046,
      )
      path('M-.02 .12 Q-.22 .47 -.19 .71 M-.02 .21 Q.12 .53 .12 .72', null, '#bd9682', 0.034)
      ctx.restore()
    }
    dot(0, 0, 0.125, 0.125, '#ac8058')
    for (let j = 0; j < 11; j++) {
      const a = j * 2.4,
        r = 0.17 + (j % 3) * 0.052,
        ex = r * Math.cos(a),
        ey = r * Math.sin(a)
      path('M0 0L' + ex + ' ' + ey, null, '#b99056', 0.026)
      dot(ex, ey, 0.047, 0.039, '#ba8751')
    }
    ctx.restore()
  }
  function bud(x, y, r, roll) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(roll)
    ctx.scale(r, r)
    path(
      'M-.11 -.68 Q-.7 -.42 -.53 .28 C-.57 .89 .17 1.1 .44 .54 Q.77 -.11 .17 -.64Z',
      '#d6ab9a',
      '#9e795f',
      0.075,
    )
    path('M-.46 -.30 Q-.14 -.63 .32 -.46 L.13 -.71 L.08 -.86 L-.16 -.73Z', '#94745a')
    ctx.restore()
  }
  for (const [x, y, r, a, s] of [
    [89, 204, 4.8, 0.37, 0],
    [97, 199, 5.7, 1.7, 0],
    [111, 193, 4.4, 1.24, 1],
    [142, 157, 5.5, 1.6, 0],
    [134, 136, 4.5, 1, 0],
    [121, 133, 4, 0.6, 1],
    [64, 163, 4, 1.4, 1],
    [76, 148, 3.1, 0.8, 0],
  ])
    flower(x, y, r, a, s)
  for (const [x, y, r, a] of [
    [103, 211, 2.6, 0.37],
    [146, 145, 3.2, -0.84],
    [144, 162, 2.2, 0.45],
    [119, 136, 2.3, 0.78],
    [59, 170, 2.4, 0.97],
    [62, 169, 1.45, -0.18],
    [91, 209, 1.8, 0.67],
    [111, 138, 2, 0.23],
  ])
    bud(x, y, r, a)

  // Kingfisher perched on the left fork, turning its head toward the strings.
  ctx.save()
  ctx.translate(78, 157)
  ctx.rotate(-0.19)
  const jade = nacre(-10, 6, 21, 15, ['#435f62', '#698f8b', '#a3baac', '#517c7c', '#829e98'])
  const pearl = nacre(-9, 6, 15, 8, ['#be976c', '#dac19b', '#f0e6cc', '#bbc7b4'])
  path('M5 8 Q10 8 14 2 L26 -7 19 -8 Q13 -4 8 1 L4 3Z', jade, '#56716c', 0.45)
  path(
    'M1 6 Q-7 8 -9 14 Q-10 19 -7 21 Q-4 24 0 20 C6 19 10 13 11 7 Q12 5 15 1 Q8 0 3 2Z',
    pearl,
    '#807963',
    0.48,
  )
  path('M-3 18 Q2 21 6 17 Q10 14 14 9 Q15 6 18 3 C14 2 8 4 4 6 Q.4 8 -1 13Z', jade, '#526d6b', 0.45)
  for (let i = 0; i < 5; i++) {
    const x = 1.8 + i * 1.29,
      y = 15.6 - i * 0.55
    path(
      'M' + x + ' ' + y + ' Q' + (x + 2) + ' ' + (y - 4) + ' ' + (x + 8.4) + ' ' + (y - 8.1),
      null,
      i % 2 ? '#a7bdb0' : '#66848a',
      0.48,
    )
  }
  path(
    'M-7.2 14.9 C-12.2 15.4 -13.2 19.2 -11.5 22.1 Q-9.4 25 -5.6 24.2 Q-1.3 23.6 -.5 19.6 Q-1.7 20 -3.4 18.2 Q-5.3 18.7 -7.2 14.9Z',
    jade,
    '#4d6865',
    0.4,
  )
  path('M-7.9 17.3 Q-5.9 18.7 -3.8 18.5 Q-4.9 16.1 -7.2 15 Q-8.8 14.8 -9.3 16.2Z', '#efe1c0')
  path('M-11.7 21.1 L-25.5 22.8 L-11.5 19.7Z', '#647674')
  path('M-24.8 22.5L-11.8 20.4', null, '#c3b49b', 0.35)
  dot(-9.6, 21.2, 0.92, 0.86, '#453f35')
  dot(-9.9, 21.5, 0.27, 0.24, '#eee3cc')
  for (let i = 0; i < 8; i++)
    dot(-9 + (i % 4) * 1.45, 23.3 - (i >> 2) * 1.01 + 0.25 * Math.sin(i), 0.45, 0.2, '#bdc5b0')
  path(
    'M.7 5 Q1.1 3 0 1.2 Q-2.2 2.3 -4.1 1.5 M-.3 1.2 Q.3 .4 2.6 -.4 M5 3 Q5.5 2 4.8 .8 Q3.4 .9 2.2 .5 M4.9 .8 Q6.8 .5 7.6 -.3',
    null,
    '#8d7657',
    0.64,
  )
  ctx.restore()
  // A few small fallen petals continue the image across the empty soundboard.
  for (const [x, y, r, a] of [
    [-99, 162, 3.6, 1.6],
    [-101, 150, 2.1, 0.55],
    [-113, 139, 2.85, -0.7],
    [-94, 129, 1.7, 0.3],
  ]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a)
    ctx.scale(r, r)
    path(
      'M0 -1 C-.86 -.41 -.83 .56 -.28 .68 Q-.01 .95 .22 .73 Q.88 .75 .67 .14 Q.45 -.41 0 -1Z',
      '#ebcfb5',
      '#bd9e83',
      0.1,
    )
    ctx.restore()
  }
  ctx.restore()
}
