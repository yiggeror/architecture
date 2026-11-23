// A ceramic oil reservoir on a beaded bronze foot. Recessed workshops use an
// open wind shield, so the flame is still visible through its front aperture.
export function oilStand(b, m, x, y, z, scale = 1, atlasFace) {
  b.at(x, y, z, 0, () =>
    b.scaleBy(scale, () => {
      const n = 5
      const finish = (part, points, tint = 1) => {
        if (!atlasFace) {
          b.face(m[part], points, tint)
          return
        }
        const wick = part === 'lantern',
          slot = { lantern: 119, bronze: 116, patina: 117, ink: 118, gold: 116 }[part],
          uv = points.map((_, j) =>
            wick
              ? [0.48, 0.47]
              : [
                  [0.2, 0.25],
                  [0.21, 0.75],
                  [0.8, 0.75],
                  [0.8, 0.25],
                ][j % 4]
          )
        atlasFace(b, m.reachDetail, slot, points, tint, uv)
      }
      const ring = (r, h, j) => {
        const a = ((j + 0.5) * Math.PI * 2) / n
        return [r * Math.cos(a), h, r * Math.sin(a)]
      }
      const sections = [
        [0.165, 0],
        [0.053, 0.066],
        [0.039, 0.24],
        [0.101, 0.26],
        [0.169, 0.33],
        [0.14, 0.355],
      ]
      for (let i = 1; i < sections.length; i++) {
        const [r, h] = sections[i - 1],
          [R, H] = sections[i]
        const metal = i === 2 || i === 4 ? 'patina' : 'bronze'
        for (let j = 0; j < n; j++)
          finish(metal, [ring(r, h, j), ring(R, H, j), ring(R, H, j + 1), ring(r, h, j + 1)])
      }
      finish(
        'ink',
        Array.from({ length: n }, (_, j) => ring(0.14, 0.354, n - j))
      )
      // The turned-back copper surrounds the wick on the draught side.
      for (let j = 2; j < 5; j++) {
        finish(
          'bronze',
          [ring(0.143, 0.35, j), ring(0.123, 0.54, j), ring(0.123, 0.54, j + 1), ring(0.143, 0.35, j + 1)],
          0.81
        )
        finish(
          'gold',
          [ring(0.123, 0.54, j), ring(0.149, 0.56, j), ring(0.149, 0.56, j + 1), ring(0.123, 0.54, j + 1)],
          0.93
        )
      }
      const wick = (j, r, h, lean) => {
        const a = (Math.PI * 2 * j) / 4
        return [Math.cos(a) * r + lean, h, Math.sin(a) * r + 0.025]
      }
      for (let j = 0; j < 4; j++) {
        finish(
          'lantern',
          [
            wick(j, 0.014, 0.352, 0),
            wick(j, 0.04, 0.409, -0.005),
            wick(j + 1, 0.04, 0.409, -0.005),
            wick(j + 1, 0.014, 0.352, 0),
          ],
          [1.4, 0.78, 0.42]
        )
        finish(
          'lantern',
          [wick(j, 0.04, 0.409, -0.005), [0.014, 0.55, 0.024], wick(j + 1, 0.04, 0.409, -0.005)],
          [1.8, 1.23, 0.67]
        )
      }
    })
  )
}
