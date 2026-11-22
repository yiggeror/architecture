import * as T from 'three'
import { poseLandmark, posePeriod } from './humanPose.js'
import {
  pipaFingerOffset,
  pipaFingerRotation,
  pipaWristRotation,
  portraitPerformance,
  stridePeriod,
} from './characterActing.js'
import { handGrip } from './humanRig.js'
import { fittedPipa } from './characterPropPipaRest.js'
import { portraitMouth } from './characterPortrait.js'
import { finishes, tau } from './characterPropCraft.js'
import { scholarFan, fanGrip, fanGripRadius } from './characterPropFan.js'
import {
  parasol,
  lanternPiece,
  clapper,
  marketBasket,
  carryingCrate,
  yoke,
  loadBasket,
  travelTag,
} from './characterPropGoods.js'
import {
  flute,
  mallet,
  malletLength,
  malletTip,
  studyDrum,
  studySeat,
  stageSweep,
  pipa,
  pipaStringPoint,
  booklet,
} from './characterPropMusic.js'
import { crewFixtures, seatBoardTop, strokePose, sweepPoint, deckAt } from './characterPropCrew.js'
export { placeCrew } from './characterPropCrew.js'

const up = new T.Vector3(0, 1, 0),
  front = new T.Vector3(0, 0, 1),
  horizontal = new T.Vector3(1, 0, 0),
  towardButt = new T.Vector3(0, -1, 0),
  origin = new T.Vector3()
const reference = (kind, radius) => ({
  kind,
  radius,
  point: new T.Vector3(),
  axis: new T.Vector3(),
  forward: new T.Vector3(),
})
function fromGroup(object, root, target) {
  target.identity()
  for (let node = object; node && node !== root; node = node.parent) {
    node.updateMatrix()
    target.premultiply(node.matrix)
  }
  return target
}
function localShip(state, record, out) {
  if (state.base) return out.copy(state.base).invert().multiply(record.ship.group.matrixWorld)
  const o = new T.Object3D()
  o.position.set(record.x, record.y, record.z)
  o.rotation.y = record.yaw
  o.scale.setScalar(state.scale ?? record.size ?? 1)
  o.updateMatrix()
  return out.copy(o.matrix).invert()
}
export function buildEquipment(profile, rig, job) {
  const group = new T.Group()
  group.name = '器用·' + job
  const m = finishes(profile, job),
    h = profile.height ?? 1,
    grips = {}
  const a = new T.Vector3(),
    v = new T.Vector3(),
    w = new T.Vector3(),
    f = new T.Vector3(),
    axis = new T.Vector3(),
    point = new T.Vector3()
  const transform = new T.Matrix4(),
    shipMatrix = new T.Matrix4(),
    basis = new T.Matrix4(),
    neutral = new T.Object3D()
  const owner = (part) => {
    group.add(part)
    return part
  }
  const held = (side, kind, radius) => (grips[side] = reference(kind, radius))
  function bind(held, node, pos, shaft = up, facing = front) {
    const t = fromGroup(node, group, transform)
    held.point.copy(pos).applyMatrix4(t)
    held.axis.copy(shaft).transformDirection(t)
    held.forward.copy(facing).transformDirection(t)
    return held
  }
  function shoulder(state, side, dy) {
    const clavicle = rig.rest[side + 'Clavicle'],
      joint = rig.rest[side + 'UpperArm']
    a.set(joint[0] - clavicle[0], joint[1] - clavicle[1] + dy, joint[2] - clavicle[2])
    return poseLandmark(rig, profile, state, side + 'Clavicle', a, point)
  }
  const updates = []
  const feet = { l: { point: new T.Vector3() }, r: { point: new T.Vector3() } }
  updates.push((state) => {
    const actor = state.actor
    if (!actor?.ship) {
      delete grips.feet
      return
    }
    const seated = ['row', 'lute', 'sit'].includes(job),
      scale = state.scale ?? actor.size ?? 1
    for (const [side, sign] of [
      ['l', 1],
      ['r', -1],
    ]) {
      const x = rig.rest[side + 'Foot'][0] * (seated ? 1.25 : 1.05),
        z =
          h * (seated ? (job === 'row' ? 0.3 : 0.27) + 0.035 * sign : (job === 'drum' ? 0.07 : 0.026) * sign)
      const onShip = actor.z + scale * (-Math.sin(actor.yaw) * x + Math.cos(actor.yaw) * z)
      feet[side].point.set(x, (deckAt(actor.ship.spec, onShip) - actor.y) / scale, z)
    }
    grips.feet = feet
  })
  let seat,
    lamp = null
  if (['row', 'lute', 'sit'].includes(job)) {
    seat = owner(studySeat(m))
    updates.push((state) => {
      const record = state.actor
      seat.visible = !record?.ship
      grips.seat = record?.ship
        ? (crewFixtures(record.ship.spec).seatY - record.y) / (state.scale ?? record.size ?? 1)
        : seatBoardTop
    })
  }
  if (job === 'umbrella') {
    const cover = owner(parasol(m)),
      l = held('l', 'grip', 0.0118)
    updates.push((state, ph) => {
      cover.position.copy(shoulder(state, 'l', 0)).add(a.set(0.048, -0.247, 0.189).multiplyScalar(h))
      const acting = portraitPerformance(profile, state)
      const step = acting && state.walking
        ? (tau * (state.t ?? 0)) / stridePeriod(profile) + (state.phase ?? 0)
        : ph
      const load = acting?.body ?? 0
      cover.position.x += h * 0.022 * load
      cover.position.z += 0.024 * Math.sin(step) + h * 0.021 * load
      cover.rotation.set(
        -0.117 + 0.019 * Math.cos(step),
        0.03 * Math.sin(ph) - 0.083 * load,
        0.198 + 0.027 * Math.sin(step) - 0.067 * load,
      )
      bind(l, cover, origin)
    })
  } else if (job === 'lantern' || job === 'watch' || job === 'basket') {
    const light = job !== 'basket',
      handProp = owner(light ? lanternPiece(m, job === 'watch') : marketBasket(m)),
      r = held('r', 'grip', 0.0105)
    const baton = job === 'watch' ? owner(clapper(m)) : null,
      l = baton ? held('l', 'grip', 0.01) : null
    if (light) {
      lamp = new T.PointLight(0xffb56d, 0.64, 2.65, 2)
      lamp.name = '灯芯'
      lamp.position.set(0, -0.263, 0)
      handProp.add(lamp)
    }
    updates.push((state, ph) => {
      const wave = Math.sin(ph),
        hold = shoulder(state, 'r', 0)
      handProp.position
        .copy(hold)
        .add(a.set(-0.105, -(light ? 0.298 : 0.362), 0.085 + 0.076 * wave).multiplyScalar(h))
      handProp.rotation.set(0.092 * Math.cos(ph), -0.28, 0.043 * Math.sin(ph))
      bind(r, handProp, origin, horizontal)
      if (baton) {
        baton.position
          .copy(shoulder(state, 'l', 0))
          .add(a.set(0.035, -0.287, 0.139 - 0.043 * wave).multiplyScalar(h))
        baton.rotation.set(0.59 + 0.15 * wave, 0.18, -0.28)
        bind(l, baton, origin)
      }
      if (light) {
        m.glow.emissiveIntensity = state.day ? 0.1 : 0.54
        lamp.intensity = state.day ? 0.03 : 0.64
      }
    })
  } else if (job === 'carrier') {
    const pole = owner(yoke(m)),
      baskets = [-1, 1].map((s) => {
        const b = loadBasket(m, s)
        pole.add(b)
        b.position.set(0, -0.089, s * 0.573)
        return b
      }),
      r = held('r', 'grip', 0.018)
    updates.push((state, ph) => {
      pole.position.copy(shoulder(state, 'r', 0.025 * h))
      pole.position.x += 0.028 * h
      pole.rotation.set(0.045 * Math.cos(ph), -0.075, 0.024 * Math.sin(ph))
      for (const [i, b] of baskets.entries())
        b.rotation.set(
          -pole.rotation.x + 0.072 * Math.sin(ph + 0.35 * i),
          0,
          -pole.rotation.z + 0.04 * Math.cos(ph - i * 0.3),
        )
      bind(r, pole, a.set(0, -0.022, 0.217), front, up)
    })
  } else if (job === 'porter') {
    const crate = owner(carryingCrate(m)),
      l = held('l', 'grip', 0.01),
      r = held('r', 'grip', 0.01)
    updates.push((state, ph) => {
      const load = state.loading ?? 0.5 - 0.5 * Math.cos(ph),
        factor = state.walking ? 0.46 : 1
      // Hand-over height at the dock leaves the carried parcel above the existing cart load.
      const record = state.actor,
        atCart = record && !record.ship && !record.streetId && Number.isFinite(record.x) && !record.side
      grips.torsoLoad = atCart ? 0.4 * load : load
      if (atCart) {
        crate.position.set(
          0.012 * Math.sin(ph) * (1 - load),
          1.141 + 0.0595 * load + 0.112 * Math.sin(Math.PI * load),
          0.229 + 0.316 * load,
        )
        crate.rotation.set(0.028 * (1 - load), 0, 0.016 * Math.sin(ph) * (1 - load))
      } else {
        crate.position.set(0.011 * Math.sin(ph) * h, (1.045 - 0.22 * load * factor) * h, 0.255 + 0.08 * load)
        crate.rotation.set(0.035 + 0.03 * load, 0, 0.025 * Math.sin(ph))
      }
      axis.set(0, 0, -1)
      bind(l, crate, a.set(0.207, 0, 0), axis, up)
      bind(r, crate, a.set(-0.207, 0, 0), axis, up)
    })
  } else if (job === 'row') {
    const study = stageSweep(m)
    owner(study.group)
    const l = held('l', 'grip', 0.018),
      r = held('r', 'grip', 0.018)
    updates.push((state) => {
      const record = state.actor,
        sweep = record?.sweep ?? study.station,
        real = record?.oar
      study.group.visible = !record?.ship
      if (record?.ship) {
        localShip(state, record, shipMatrix)
        if (real) {
          real.pivot.updateMatrix()
          transform.multiplyMatrices(shipMatrix, real.pivot.matrix)
          grips.stroke = (real.pivot.rotation.y * sweep.side - 0.095) / 0.29
        } else {
          neutral.position.fromArray(sweep.pin)
          strokePose(neutral, sweep, record.shipIndex ?? 0, state.t)
          neutral.updateMatrix()
          transform.multiplyMatrices(shipMatrix, neutral.matrix)
          grips.stroke = (neutral.rotation.y * sweep.side - 0.095) / 0.29
        }
      } else {
        strokePose(study.pivot, sweep, 0, state.t + (state.phase ?? 0) / 1.73)
        fromGroup(study.pivot, group, transform)
        grips.stroke = (study.pivot.rotation.y * sweep.side - 0.095) / 0.29
      }
      for (const [hand, index] of [
        [l, sweep.side < 0 ? 1 : 0],
        [r, sweep.side < 0 ? 0 : 1],
      ]) {
        sweepPoint(sweep, sweep.grips[index], hand.point).applyMatrix4(transform)
        hand.axis.fromArray(sweep.inward).transformDirection(transform)
        if (hand.axis.x < 0) hand.axis.negate()
        hand.forward.set(0, 0.9, 0.42)
      }
    })
  } else if (job === 'drum') {
    const drum = owner(studyDrum(m)),
      mallets = [owner(mallet(m, 1)), owner(mallet(m, -1))]
    const handles = [held('l', 'grip', 0.011), held('r', 'grip', 0.011)]
    grips.strikes = [new T.Vector3(), new T.Vector3()]
    updates.push((state, ph) => {
      const record = state.actor,
        fixture = record?.ship ? crewFixtures(record.ship.spec).drum : null
      drum.visible = !fixture
      if (fixture) localShip(state, record, shipMatrix)
      for (let i = 0; i < 2; i++) {
        const s = i ? -1 : 1,
          theta = ph * 2 + i * Math.PI,
          beat = T.MathUtils.euclideanModulo(theta / tau, 1)
        // A practiced stroke bounces early, pauses at the top and comes down
        // swiftly. The moment of impact stays fixed on the drum's real skin.
        const lift = profile.design === 'drummer'
          ? T.MathUtils.smoothstep(beat, 0, 0.36) - T.MathUtils.smoothstep(beat, 0.65, 1)
          : 0.5 - 0.5 * Math.cos(theta)
        const g = handles[i],
          stick = mallets[i]
        if (fixture) {
          v.set(fixture.x - s * fixture.r * 0.36, fixture.y, fixture.z + fixture.r * 0.53).applyMatrix4(
            shipMatrix,
          )
        } else v.set(s * 0.114, 0.55, 0.706 - 0.365 * 0.5)
        grips.strikes[i].copy(v)
        axis.set(-s * 0.056, -0.74 - 0.19 * lift, 0.674 + 0.07 * lift).normalize()
        v.y += Math.hypot(malletTip * axis.y, 0.017 * Math.sqrt(1 - axis.y * axis.y)) + 0.266 * lift
        v.z -= 0.054 * lift
        stick.quaternion.setFromUnitVectors(up, axis)
        stick.position.copy(v).addScaledVector(axis, -malletLength)
        bind(g, stick, origin, towardButt)
      }
    })
  } else if (job === 'flute') {
    const pipe = owner(flute(m)),
      l = held('l', 'flute', 0.0105),
      r = held('r', 'flute', 0.0105),
      lip = portraitMouth(profile).multiplyScalar(h)
    grips.mouth = new T.Vector3()
    updates.push((state, ph) => {
      poseLandmark(rig, profile, state, 'head', lip, grips.mouth)
      // +Y runs to the finger holes; +Z is the upper wall of the bamboo.
      axis.set(-0.915, -0.243 - 0.021 * Math.sin(ph), 0.257).normalize()
      f.set(0, 0.54, -0.84).addScaledVector(axis, -f.dot(axis)).normalize()
      w.crossVectors(axis, f).normalize()
      pipe.quaternion.setFromRotationMatrix(basis.makeBasis(w, axis, f))
      pipe.position.copy(grips.mouth).addScaledVector(f, -0.0107)
      bind(l, pipe, a.set(0, 0.143, 0), up, front)
      bind(r, pipe, a.set(0, 0.235, 0), up, front)
    })
  } else if (job === 'lute') {
    const lute = owner(pipa(m, profile.design)),
      seatInstrument = fittedPipa(rig, profile, lute),
      l = held('l', 'strings', 0.0205),
      r = held('r', 'pluck', 0),
      pluckingAxis = new T.Vector3(-0.862693, 0.158454, 0.480264),
      pluckingForward = new T.Vector3(0.001941, 0.950679, -0.310171),
      handBasis = new T.Matrix4().makeBasis(
        new T.Vector3().crossVectors(pluckingAxis, pluckingForward),
        pluckingAxis,
        pluckingForward,
      ),
      normalGrip = new T.Vector3(...handGrip),
      melody = [2, 1, 3, 2, 0, 1],
      leftHand = rig.bones.lHand.getObjectByName('左手'),
      refitted = profile.id === 9 && (!leftHand || leftHand.userData.reseatedFret),
      frettingRotation = refitted
        ? new T.Quaternion(...pipaWristRotation)
        : new T.Quaternion().setFromEuler(new T.Euler(-0.2, -0.6, -0.3, 'ZXY')),
      frettingAxis = up.clone().applyQuaternion(frettingRotation),
      frettingForward = front.clone().applyQuaternion(frettingRotation),
      indexPad = new T.Vector3(0.007, -0.049, 0.0472)
    if (refitted && !leftHand)
      indexPad.applyQuaternion(new T.Quaternion(...pipaFingerRotation)).add(v.fromArray(pipaFingerOffset))
    if (leftHand) {
      const [start, end] = leftHand.userData.distalSkin[0]
      let frontmost = Infinity
      for (let i = start; i < end; i++) {
        leftHand.getVertexPosition(i, a)
        const z = v.copy(a).applyQuaternion(frettingRotation).z
        if (z < frontmost) {
          frontmost = z
          indexPad.copy(a)
        }
      }
    }
    // A stopped string bears on the index pulp. Use the measured pad as the
    // hand-local socket so the solved contact stays on the rendered string.
    l.localContact = indexPad
    grips.pluckPoint = new T.Vector3()
    r.elbowPole = new T.Vector3(-0.66, 0, 1.5)
    l.elbowPole = new T.Vector3(0.6, -1.2, 1.6)
    updates.push((state, ph) => {
      seatInstrument(state, grips, ph)
      pipaStringPoint(2, 0.544 + 0.007 * Math.sin(ph), a)
      a.z += 0.000996
      bind(l, lute, a, frettingAxis, frettingForward)
      // Two alternating digits play six strokes across all four silk strings.
      // The point on the touching pad, not the wrist origin, follows the silk.
      const beat = (3 * ph) / Math.PI,
        stroke = Math.floor(beat),
        f = beat - stroke,
        k = ((stroke % melody.length) + melody.length) % melody.length,
        t = f * f * (3 - 2 * f),
        strand = melody[k] * (1 - t) + melody[(k + 1) % melody.length] * t,
        y = 0.202 + 0.013 * Math.sin(2 * ph + 0.2)
      pipaStringPoint(strand, y, a)
      a.z += 0.000996 + 0.0034 * Math.sin(Math.PI * f) ** 2
      grips.pluckPoint.copy(a)
      if (rig.pickingContact) a.add(w.copy(normalGrip).sub(rig.pickingContact(ph, v)).applyMatrix4(handBasis))
      bind(r, lute, a, pluckingAxis, pluckingForward)
      grips.pluckPoint.applyMatrix4(transform)
    })
  } else if (job === 'sit') {
    const book = owner(booklet(m)),
      l = held('l', 'grip', 0.009),
      r = held('r', 'grip', 0.009)
    updates.push((state, ph) => {
      book.position.set(0.007, grips.seat + 0.249 * h, 0.263 * h)
      book.rotation.set(0.54 + 0.044 * Math.cos(ph), 0.105, 0.034 * Math.sin(ph))
      bind(l, book, a.set(0.112, 0.007, -0.014))
      bind(r, book, a.set(-0.112, 0.007, -0.014))
    })
  } else if (job === 'walk' && profile.design === 'scholar') {
    const { fan, tassel } = scholarFan(m),
      r = held('r', 'fan', fanGripRadius)
    owner(fan)
    updates.push((state) => {
      const acting = portraitPerformance(profile, state)
      const footfall = tau * (state.t ?? 0) / stridePeriod(profile) + (state.phase ?? 0)
      const step = Math.sin(footfall), lift = Math.cos(footfall)
      // The leaf travels with the ribs. He lowers the wrist and tips the
      // paper away from his eyes as his attention rises to street level.
      const lower = acting ? 0.55 * acting.turn + 0.45 * acting.body : 0
      fan.rotation.set(
        0.226 + 0.039 * step + 0.148 * lower,
        -0.178 + 0.058 * Math.sin(footfall - 0.37) - 0.19 * lower,
        0.224 + 0.041 * lift + 0.104 * lower,
        'YXZ',
      )
      fan.position
        .copy(shoulder(state, 'r', 0))
        .add(a.set(
          -0.005 - 0.056 * lower + 0.008 * step,
          -0.244 - 0.111 * lower + 0.01 * lift,
          0.253 + 0.043 * lower + 0.026 * step,
        ).multiplyScalar(h))
        .sub(v.copy(fanGrip).applyQuaternion(fan.quaternion))
      neutral.rotation.set(0.046 + 0.10 * Math.sin(footfall - 0.62), 0, -0.038 + 0.058 * lift)
      tassel.quaternion.copy(fan.quaternion).invert().multiply(neutral.quaternion)
      bind(r, fan, fanGrip)
    })
  } else if (job === 'walk') {
    const tag = owner(travelTag(m))
    updates.push((state, ph) => {
      tag.position.copy(
        poseLandmark(rig, profile, state, 'pelvis', a.set(0.146 * h, 0.021 * h, -0.035 * h), point),
      )
      tag.rotation.set(0.13 * Math.cos(ph), 0.42, 0.103 * Math.sin(ph))
    })
  }
  return {
    group,
    lamp,
    update(state) {
      const phase = ((state.t ?? 0) * tau) / posePeriod(profile, state) + (state.phase ?? 0)
      for (const motion of updates) motion(state, phase)
      return grips
    },
  }
}
