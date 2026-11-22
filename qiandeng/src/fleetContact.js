import * as T from 'three'

const radius = 0.155
const skin = 0.0006
function within(p, b, r) {
  return (
    p.x > b[0] - r && p.x < b[3] + r && p.y > b[1] - r && p.y < b[4] + r && p.z > b[2] - r && p.z < b[5] + r
  )
}
function aboard(ship, p) {
  const d = ship.spec.deck,
    kind = ship.spec.kind
  if (p.y < d + radius - 0.1 || p.y > d + 2.03) return false
  if (
    (kind === 'pavilion' || kind === 'music' || kind === 'covered') &&
    Math.abs(p.x) < ship.spec.beam * 0.36 &&
    Math.abs(p.z - 0.25) < ship.spec.length * 0.22
  ) {
    return p.y < d + (kind === 'covered' ? 1.36 : 1.79)
  }
  // A free camera can fly over open decks. It rides when actually resting
  // on the supporting planks, at the radius of the collision sphere.
  return (
    p.y < d + 0.095 + radius + 0.09 &&
    ship.boxes.some((b) => b[1] < 0 && p.x > b[0] && p.x < b[3] && p.z > b[2] && p.z < b[5])
  )
}

export function protectPassengers(ships) {
  const local = new T.Vector3(),
    oldLocal = new T.Vector3(),
    target = new T.Vector3(),
    sample = new T.Vector3(),
    test = new T.Vector3()
  const exits = Array.from({ length: 6 }, () => ({ p: new T.Vector3(), d: 0 }))
  const protectedAt = new WeakMap()
  function moveTo(eye, end, clearance) {
    const distance = eye.distanceTo(end)
    if (distance < 1e-7) return false
    if (clearance) {
      const n = Math.ceil(distance / 0.078)
      for (let j = 1; j <= n; j++) if (clearance(sample.lerpVectors(eye, end, j / n)) > skin) return false
    }
    eye.copy(end)
    return true
  }
  return function protect(eye, clearance, frame, continuous) {
    const ride = continuous && protectedAt.get(eye) !== frame
    protectedAt.set(eye, frame)
    for (const ship of ships) {
      const g = ship.group,
        r = ship.spec.length * 0.58 + 0.65
      if (
        Math.abs(eye.x - g.position.x) > r ||
        Math.abs(eye.z - g.position.z) > r ||
        eye.y < g.position.y - 0.88 ||
        eye.y > g.position.y + (ship.top ?? 5.15)
      )
        continue
      local.copy(eye).applyMatrix4(ship.inverse)
      const inside = ship.boxes.some((b) => within(local, b, radius))
      if (ride) {
        oldLocal.copy(eye).applyMatrix4(ship.previousInverse)
        // Preserve the old clearance when a sweeping bow overtakes the eye.
        if (
          (inside || aboard(ship, oldLocal)) &&
          !ship.boxes.some((b) => within(oldLocal, b, radius - skin))
        ) {
          target.copy(oldLocal).applyMatrix4(g.matrixWorld)
          if (moveTo(eye, target, clearance)) return true
        }
      }
      if (!inside) continue
      // Find the nearest exit of the union, including overlapping hull
      // strakes. Try another face when a stone pier blocks the shortest exit.
      for (let axis = 0; axis < 3; axis++)
        for (const sign of [-1, 1]) {
          const out = exits[axis * 2 + (sign > 0 ? 1 : 0)]
          test.copy(local)
          for (let i = 0; i <= ship.boxes.length; i++) {
            const overlap = ship.boxes.find((b) => within(test, b, radius))
            if (!overlap) break
            const face = sign > 0 ? overlap[axis + 3] : overlap[axis]
            test.setComponent(axis, face + sign * (radius + skin))
          }
          out.p.copy(test).applyMatrix4(g.matrixWorld)
          out.d = out.p.distanceToSquared(eye)
        }
      exits.sort((a, b) => a.d - b.d)
      for (const out of exits) if (moveTo(eye, out.p, clearance)) return true
    }
    return false
  }
}
