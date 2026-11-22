import * as T from 'three'

const panels = { back: [0.005, 0.325], palm: [0.337, 0.657], finger: [0.67, 0.929], nail: [0.941, 0.995] }
export function handUV(panel, u, v) {
  const [a, b] = panels[panel]
  return [a + (b - a) * u, 0.015 + 0.97 * v]
}

// Original low-contrast ink under the skin wash. The extensor tendons fan
// toward four individual knuckles and the creases wrap around the cylinders.
export function makeHandInk() {
  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1024, 512)
      : typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null
  if (!c) return null
  c.width = 1024
  c.height = 512
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  function paint(panel, fn) {
    const [a, b] = panels[panel]
    ctx.save()
    ctx.translate(a * c.width, c.height * (1 - 0.015))
    ctx.scale((b - a) * c.width, -c.height * 0.97)
    ctx.beginPath()
    ctx.rect(0, 0, 1, 1)
    ctx.clip()
    function stroke(points, w, alpha, color = '#997363') {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(...points[0])
      for (let i = 1; i < points.length - 1; i++) {
        const p = points[i],
          n = points[i + 1]
        ctx.quadraticCurveTo(...p, (p[0] + n[0]) * 0.5, (p[1] + n[1]) * 0.5)
      }
      ctx.lineTo(...points.at(-1))
      ctx.stroke()
      ctx.restore()
    }
    function wash(x, y, w, h, color, alpha) {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(w, h)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, color)
      g.addColorStop(0.48, color + 'a0')
      g.addColorStop(1, color + '00')
      ctx.globalAlpha = alpha
      ctx.fillStyle = g
      ctx.fillRect(-1, -1, 2, 2)
      ctx.restore()
    }
    fn(stroke, wash)
    ctx.restore()
  }
  paint('back', (stroke, wash) => {
    for (const [i, x] of [0.145, 0.385, 0.627, 0.864].entries()) {
      const y = 0.91 - 0.045 * Math.abs(i - 1.6)
      wash(x, y, 0.101, 0.115, '#c68c76', 0.24)
      const u = 0.42 + (x - 0.5) * 0.52
      stroke(
        [
          [u, 0.18],
          [u + 0.025, 0.32],
          [x + 0.052, 0.58],
          [x + 0.007, y - 0.03],
        ],
        0.011,
        0.13,
        '#b5a196',
      )
      stroke(
        [
          [u + 0.011, 0.32],
          [x + 0.048, 0.59],
          [x + 0.01, y - 0.075],
        ],
        0.004,
        0.24,
        '#a18878',
      )
      for (let j = 0; j < 2; j++)
        stroke(
          [
            [x - 0.066, y - 0.018 + j * 0.014],
            [x - 0.02, y + j * 0.014],
            [x + 0.031, y + 0.005 + j * 0.014],
            [x + 0.055, y - 0.004 + j * 0.014],
          ],
          0.0044,
          0.26,
        )
    }
    stroke(
      [
        [0.24, 0.23],
        [0.27, 0.4],
        [0.34, 0.48],
        [0.49, 0.58],
        [0.52, 0.69],
      ],
      0.006,
      0.18,
      '#899e94',
    )
    stroke(
      [
        [0.34, 0.47],
        [0.32, 0.56],
        [0.28, 0.62],
      ],
      0.0034,
      0.15,
      '#94a299',
    )
    stroke(
      [
        [0.5, 0.55],
        [0.63, 0.57],
        [0.69, 0.64],
      ],
      0.0032,
      0.16,
      '#899e94',
    )
    for (const y of [0.18, 0.2])
      stroke(
        [
          [0.023, y - 0.012],
          [0.27, y],
          [0.46, y - 0.014],
          [0.74, y],
        ],
        0.003,
        0.16,
      )
  })
  paint('palm', (stroke, wash) => {
    wash(0.78, 0.53, 0.22, 0.3, '#d7a08f', 0.23)
    wash(0.18, 0.5, 0.17, 0.32, '#dbb196', 0.18)
    for (const x of [0.14, 0.38, 0.63, 0.86]) wash(x, 0.82, 0.086, 0.096, '#ce9976', 0.26)
    const folds = [
      [
        [0.06, 0.83],
        [0.22, 0.8],
        [0.33, 0.753],
        [0.5, 0.72],
        [0.61, 0.73],
        [0.73, 0.78],
      ],
      [
        [0.1, 0.59],
        [0.24, 0.62],
        [0.39, 0.65],
        [0.52, 0.66],
        [0.65, 0.7],
        [0.77, 0.74],
      ],
      [
        [0.48, 0.29],
        [0.52, 0.43],
        [0.58, 0.55],
        [0.65, 0.65],
        [0.74, 0.72],
        [0.85, 0.74],
      ],
      [
        [0.1, 0.245],
        [0.27, 0.228],
        [0.47, 0.21],
        [0.66, 0.23],
        [0.79, 0.26],
      ],
    ]
    for (let i = 0; i < folds.length; i++) {
      stroke(folds[i], i === 3 ? 0.009 : 0.012, 0.12)
      stroke(folds[i], i === 3 ? 0.0035 : 0.0048, i === 3 ? 0.3 : 0.48)
    }
    for (const line of [
      [
        [0.28, 0.777],
        [0.24, 0.75],
        [0.2, 0.735],
      ],
      [
        [0.49, 0.659],
        [0.44, 0.69],
        [0.39, 0.704],
      ],
      [
        [0.55, 0.465],
        [0.6, 0.46],
        [0.63, 0.49],
      ],
      [
        [0.64, 0.62],
        [0.66, 0.54],
        [0.7, 0.51],
      ],
      [
        [0.29, 0.586],
        [0.33, 0.56],
        [0.36, 0.54],
      ],
      [
        [0.16, 0.34],
        [0.25, 0.37],
        [0.31, 0.4],
      ],
      [
        [0.48, 0.274],
        [0.52, 0.282],
        [0.58, 0.31],
      ],
    ])
      stroke(line, 0.003, 0.27)
    for (let i = 0; i < 8; i++) {
      const off = i * 0.012
      stroke(
        [
          [0.73 + off, 0.47],
          [0.71 + off, 0.42],
          [0.73 + off, 0.38],
          [0.78 + off, 0.34],
        ],
        0.0019,
        0.14,
      )
    }
  })
  paint('finger', (stroke, wash) => {
    for (const phase of [0, 1])
      for (const [center, n] of [
        [0.337, 3],
        [0.665, 2],
      ]) {
        wash(phase, center, 0.17, 0.062, '#c1917d', 0.21)
        for (let j = 0; j < n; j++) {
          const y = center + (0.017 * j - 0.013)
          stroke(
            [
              [phase - 0.12, y + 0.008],
              [phase - 0.08, y + 0.002],
              [phase - 0.023, y - 0.007],
              [phase + 0.03, y - 0.004],
              [phase + 0.095, y + 0.007],
            ],
            j === 0 ? 0.006 : 0.004,
            j === 0 ? 0.43 : 0.26,
          )
        }
      }
    for (const y of [0.31, 0.332, 0.648, 0.666])
      stroke(
        [
          [0.375, y + 0.009],
          [0.43, y - 0.01],
          [0.49, y],
          [0.55, y - 0.008],
          [0.63, y + 0.006],
        ],
        0.004,
        0.29,
      )
    for (let j = 0; j < 9; j++) {
      const w = 0.04 + j * 0.01,
        h = 0.012 + j * 0.009
      stroke(
        [
          [0.5 - w, 0.826],
          [0.5 - w, 0.851 + h * 0.65],
          [0.5, 0.864 + h],
          [0.5 + w * 0.85, 0.858 + h * 0.3],
          [0.5 + w, 0.82],
        ],
        0.0023,
        0.22,
        '#b58d78',
      )
    }
  })
  paint('nail', (stroke, wash) => {
    wash(0.5, 0.53, 0.56, 0.64, '#f0d6d0', 0.14)
    stroke(
      [
        [0.025, 0.2],
        [0.12, 0.09],
        [0.51, 0.055],
        [0.9, 0.11],
        [0.975, 0.19],
      ],
      0.016,
      0.29,
      '#ad8177',
    )
    for (const x of [0.25, 0.48, 0.69])
      stroke(
        [
          [x, 0.26],
          [x - 0.014, 0.51],
          [x + 0.006, 0.81],
        ],
        0.005,
        0.1,
        '#b79d8a',
      )
  })
  const map = new T.CanvasTexture(c)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  map.name = '掌纹、肌腱与甲床'
  return map
}
