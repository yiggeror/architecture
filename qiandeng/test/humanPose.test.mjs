import assert from 'node:assert/strict'
import test from 'node:test'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { characterProfile, studyCast } from '../src/characterProfiles.js'
import { createHumanRig, handGrip, solePoints } from '../src/humanRig.js'
import { poseHuman, poseLandmark, posePeriod } from '../src/humanPose.js'
import { buildEquipment } from '../src/characterEquipment.js'
import { buildPortrait, portraitMouth } from '../src/characterPortrait.js'
import { shoes } from '../src/characterFootwear.js'
import { reachResidents, residentPose } from '../src/reachPeople.js'
import { harbourCast, castRoute } from '../src/characterCast.js'
import { traffic } from '../src/fleetRoute.js'
import { courtyardCollision } from '../src/collision.js'
import { materials } from '../src/kit.js'
import { LandBatch, landFinishes } from '../src/land-kit.js'
import { civicStones } from '../src/land-stone.js'

const sides = ['l', 'r']
const v = (point) => new T.Vector3(...point)
const close = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)
function arc(t, out) {
  const a = (t * 0.82) / 2.7
  return Object.assign(out, {
    x: 3 + 2.7 * (1 - Math.cos(a)),
    z: -10 + 2.7 * Math.sin(a),
    yaw: a,
    y: 2.1 + 0.06 * Math.sin(a * 0.5),
  })
}
function toWorld(p, at, scale) {
  const cos = Math.cos(at.yaw),
    sin = Math.sin(at.yaw)
  return new T.Vector3(
    at.x + scale * (cos * p.x + sin * p.z),
    (at.y ?? 0) + p.y * scale,
    at.z + scale * (cos * p.z - sin * p.x),
  )
}
const segments = sides.flatMap((s) => [
  [s + 'UpperArm', s + 'Forearm'],
  [s + 'Forearm', s + 'Hand'],
  [s + 'Thigh', s + 'Shin'],
  [s + 'Shin', s + 'Foot'],
  [s + 'Foot', s + 'Toe'],
])
function rigid(rig, pose) {
  for (const [a, b] of segments)
    close(pose.joints[a].distanceTo(pose.joints[b]), v(rig.rest[a]).distanceTo(v(rig.rest[b])))
}
test('22 named joints bind in actor metres and preserve the specified adult proportions', () => {
  const rig = createHumanRig({})
  assert.equal(rig.skeleton.bones.length, 22)
  assert.deepEqual(rig.rest.head, [0, 1.46, 0.012])
  close(rig.rest.lThigh[1], 0.877)
  close(rig.rest.rUpperArm[0], -0.191)
  close(rig.rest.lToe[2], solePoints.ball[2])
  for (const [name, bone] of Object.entries(rig.bones)) {
    const n = rig.index[name],
      bind = bone.matrixWorld.clone().multiply(rig.skeleton.boneInverses[n])
    assert.ok(bind.equals(new T.Matrix4()))
    assert.ok(bone.getWorldPosition(new T.Vector3()).distanceTo(v(rig.rest[name])) < 1e-12)
  }
  const other = createHumanRig({
    height: 1.04,
    shoulders: 1.1,
    hips: 1.08,
    armLength: 0.95,
    legLength: 1.055,
  })
  close(other.rest.head[1], 1.46 * 1.04)
  close(other.rest.lUpperArm[0], 0.191 * 1.1 * 1.04)
  close((other.rest.lShin[1] - other.rest.lFoot[1]) / (rig.rest.lShin[1] - rig.rest.lFoot[1]), 1.055 * 1.04)
  close(
    v(other.rest.lHand).distanceTo(v(other.rest.lForearm)) /
      v(rig.rest.lHand).distanceTo(v(rig.rest.lForearm)),
    0.95 * 1.04,
  )
})

function walkAudit(profile, route, begin, length, scale) {
  const rig = createHumanRig(profile),
    state = { t: begin, phase: 0.94, walking: true, routeAt: route, scale, job: 'walk' }
  const hold = {},
    summary = { drift: 0, contact: 0, heel: 0, swing: 0, flat: 0, lift: 0, strikes: 0 }
  for (let i = 0; i <= Math.ceil(length * 140); i++) {
    state.t = begin + i / 140
    const pose = poseHuman(rig, profile, state)
    const base = route(state.t, {})
    rigid(rig, pose)
    for (const side of sides) {
      const f = pose.feet[side]
      if (f.stance) {
        const cycle = Math.floor(
          state.t / pose.period + state.phase / (2 * Math.PI) + (side === 'r' ? 0.5 : 0),
        )
        const key = side + cycle + f.support,
          actual = toWorld(f.actual, base, scale)
        if (!hold[key]) {
          hold[key] = actual
          summary.strikes++
        } else summary.drift = Math.max(summary.drift, actual.distanceTo(hold[key]))
        summary.contact = Math.max(summary.contact, f.residual)
        if (f.support === 'heel') summary.heel = Math.max(summary.heel, f.tip.y - f.heel.y)
        if (f.phase > 0.47) summary.lift = Math.max(summary.lift, f.heel.y - f.ball.y)
        if (f.phase > 0.15 && f.phase < 0.42) {
          summary.flat++
          close(f.heel.y, f.ball.y, 1e-6)
          close(f.ball.y, f.tip.y, 1e-6)
        }
      } else summary.swing = Math.max(summary.swing, Math.min(f.heel.y, f.ball.y, f.tip.y))
    }
  }
  return summary
}
test('curved and scaled paths keep the actual heel or forefoot planted through heel strike, roll and toe-off', () => {
  const p = characterProfile(47, 'umbrella'),
    stats = walkAudit(p, arc, 0, 5.3, 0.91)
  assert.ok(stats.strikes > 15 && stats.flat > 200)
  assert.ok(stats.drift < 0.00005 && stats.contact < 0.00005, JSON.stringify(stats))
  assert.ok(stats.heel > 0.045 && stats.lift > 0.065 && stats.swing > 0.075, JSON.stringify(stats))
})
test('an actual hillside route keeps the planted sole still while its walker turns at the end of the street', () => {
  const row = reachResidents()[0],
    p = characterProfile(row.appearance, row.job),
    route = (t, out) => residentPose(row, t, out)
  const turn = ((Math.PI * 0.5 - row.phase) * row.radius) / row.pace
  const stats = walkAudit(p, route, turn - 1.25, 2.5, row.size)
  assert.ok(stats.drift < 0.0001 && stats.contact < 0.0001, JSON.stringify(stats))
})
test('wrist orientation encloses the requested shaft and clavicle travel covers a grip just beyond neutral reach', () => {
  const p = characterProfile(5, 'flute'),
    rig = createHumanRig(p),
    state = { t: 1.46, phase: 0.32, walking: false, job: 'flute' }
  const a = poseHuman(rig, p, state),
    shoulder = a.joints.lUpperArm.clone(),
    arm =
      v(rig.rest.lUpperArm).distanceTo(v(rig.rest.lForearm)) +
      v(rig.rest.lForearm).distanceTo(v(rig.rest.lHand))
  const axis = new T.Vector3(0.82, 0.29, 0.49).normalize(),
    q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), axis)
  const wrist = shoulder.clone().add(new T.Vector3(0, -0.18, 0.98).normalize().multiplyScalar(arm + 0.017))
  const point = wrist.clone().add(v(handGrip).applyQuaternion(q)),
    grips = { l: { point, axis } }
  let pose = poseHuman(rig, p, state, grips)
  assert.ok(pose.hands.l.actual.distanceTo(point) < 0.000001)
  assert.ok(pose.joints.lUpperArm.distanceTo(shoulder) > 0.013)
  assert.ok(new T.Vector3(0, 1, 0).applyQuaternion(pose.orientations.lHand).distanceTo(axis) < 1e-8)
  rigid(rig, pose)
  grips.l.point = point.clone().add(new T.Vector3(0, 0, 0.83))
  pose = poseHuman(rig, p, state, grips)
  assert.ok(pose.hands.l.residual > 0.65 && pose.hands.l.residual < 0.85)
  rigid(rig, pose)
})
test('seat, hips, knees and planted feet support seated/rowing work, and loading flexes the trunk and knees', () => {
  const p = characterProfile(0, 'row'),
    r = createHumanRig(p)
  for (const job of ['sit', 'lute', 'row'])
    for (const t of [0, 0.5, 1.7, 4]) {
      const s = poseHuman(r, p, { job, t, phase: 0 }, { seat: 0.358 })
      close(s.joints.pelvis.y, 0.358 + 0.112 * p.height)
      for (const side of sides) {
        assert.ok(s.joints[side + 'Shin'].z - s.joints[side + 'Thigh'].z > 0.26)
        assert.ok(s.feet[side].residual < 0.00001)
        assert.ok(s.feet[side].heel.y < 0.00001)
      }
      rigid(r, s)
    }
  const rest = poseHuman(r, p, { job: 'porter', t: 0.17, phase: 0, loading: 0 }).joints.head.clone()
  const low = poseHuman(r, p, { job: 'porter', t: 0.17, phase: 0, loading: 1 })
  assert.ok(rest.y - low.joints.head.y > 0.22 && low.joints.head.z - rest.z > 0.13)
  const headLow = low.joints.head.y
  const cart = poseHuman(r, p, { job: 'porter', t: 0.17, phase: 0, loading: 1 }, { torsoLoad: 0.4 })
  assert.ok(cart.joints.head.y > headLow + 0.1 && cart.joints.head.y < rest.y - 0.04)
  rigid(r, cart)
})

test('an instrument can guide the elbow around its rim while the wrist and fingers keep the same grip', () => {
  const profile = characterProfile(9, 'lute'), rig = createHumanRig(profile)
  const state = {job:'lute', t:.42}, equipment = buildEquipment(profile,rig,'lute')
  const grips = equipment.update(state), pole = new T.Vector3(-.89,-.22,.86)
  grips.r.elbowPole=pole
  const pose=poseHuman(rig,profile,state,grips), j=pose.joints
  const reach=j.rHand.clone().sub(j.rUpperArm).normalize()
  const flex=j.rForearm.clone().sub(j.rUpperArm)
  flex.addScaledVector(reach,-flex.dot(reach)).normalize()
  const expected=pole.clone().addScaledVector(reach,-pole.dot(reach)).normalize()
  assert.ok(flex.distanceTo(expected)<1e-8)
  assert.ok(pose.hands.r.residual<1e-8)
  const wrist=j.rHand.clone(), elbow=j.rForearm.clone(), other=j.lForearm.clone()
  grips.r.elbowPole=[-.85,-1,-.62]
  poseHuman(rig,profile,state,grips)
  assert.ok(j.rHand.distanceTo(wrist)<1e-8)
  assert.ok(j.rForearm.distanceTo(elbow)>.045)
  assert.ok(j.lForearm.distanceTo(other)<1e-8)
  rigid(rig,pose)
})

test('the four commissioned sitters carry distinct neck, shoulder, chest and weight lines through their actions', () => {
  function measure(profile, entry) {
    const rig = createHumanRig(profile),
      state = { job: entry.job, walking: entry.walking, phase: 0, t: 0 }
    const forward = new T.Vector3(),
      up = new T.Vector3(),
      rows = []
    for (let i = 0; i < 60; i++) {
      state.t = (i / 60) * posePeriod(profile, state)
      const p = poseHuman(rig, profile, state),
        j = p.joints
      forward.set(0, 0, 1).applyQuaternion(p.orientations.head)
      rows.push({
        gaze: Math.atan2(forward.x, forward.z),
        headLean: up.set(0, 1, 0).applyQuaternion(p.orientations.head).x,
        chest: up.set(0, 1, 0).applyQuaternion(p.orientations.chest).z,
        shoulder: j.rUpperArm.y - j.rClavicle.y,
        ankleWidth: p.feet.l.heel.x - p.feet.r.heel.x,
        shift: j.pelvis.x,
      })
    }
    const mean = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length
    return {
      gaze: mean('gaze'),
      headLean: mean('headLean'),
      chest: mean('chest'),
      shoulder: mean('shoulder'),
      ankleWidth: mean('ankleWidth'),
      shift: Math.max(...rows.map((p) => p.shift)) - Math.min(...rows.map((p) => p.shift)),
    }
  }
  for (const id of [47, 9, 64, 4]) {
    const entry = studyCast.find((actor) => actor.id === id)
    const profile = characterProfile(entry.id, entry.job),
      posed = measure(profile, entry)
    const neutral = measure({ ...profile, design: undefined }, entry)
    if (profile.design === 'silk') assert.ok(posed.gaze < neutral.gaze - 0.17)
    if (profile.design === 'lute') {
      assert.ok(posed.gaze > neutral.gaze + 0.13)
      assert.ok(posed.headLean > neutral.headLean + 0.035)
    }
    if (profile.design === 'scholar') {
      assert.ok(posed.chest < neutral.chest - 0.032)
      assert.ok(posed.shoulder < neutral.shoulder - 0.004)
      assert.ok(posed.gaze < neutral.gaze - 0.075)
    }
    if (profile.design === 'drummer') {
      assert.ok(posed.ankleWidth > neutral.ankleWidth + 0.09)
      assert.ok(posed.shift > neutral.shift + 0.039)
    }
  }
})

test('the musician can turn toward her left hand with physical space between her face, hair and tuning pegs', () => {
  const profile = characterProfile(9, 'lute'),
    rig = createHumanRig(profile),
    portrait = buildPortrait(profile)
  portrait.scale.setScalar(profile.height)
  rig.bones.head.add(portrait)
  const equipment = buildEquipment(profile, rig, 'lute'),
    scene = new T.Group()
  scene.add(rig.root, equipment.group)
  const instrument = equipment.group.children.find((group) => group.name.includes('琵琶'))
  const heads = [],
    parts = []
  portrait.traverse((m) => {
    if (m.isMesh) heads.push([m, new MeshBVH(m.geometry, { indirect: true })])
  })
  instrument.traverse((m) => {
    if (m.isMesh) parts.push(m)
  })
  const prior = parts.map((m) => m.geometry.boundsTree)
  for (const m of parts) m.geometry.boundsTree = new MeshBVH(m.geometry, { indirect: true })
  const relative = new T.Matrix4(),
    scale = new T.Vector3(),
    state = { job: 'lute', phase: 0.81, t: 0 }
  try {
    for (const f of [0, 0.24, 0.48, 0.72, 0.96]) {
      state.t = f * posePeriod(profile, state)
      poseHuman(rig, profile, state, equipment.update(state))
      scene.updateMatrixWorld(true)
      for (const [head, tree] of heads)
        for (const m of parts) {
          relative.copy(head.matrixWorld).invert().multiply(m.matrixWorld)
          const units = head.getWorldScale(scale).x,
            limit = 0.016 / units
          const near = tree.closestPointToGeometry(m.geometry, relative, {}, null, limit, limit)
          assert.ok(!near || near.distance * units >= 0.016, head.name + ' near ' + instrument.name)
        }
    }
  } finally {
    parts.forEach((m, i) => {
      m.geometry.boundsTree = prior[i]
    })
  }
})
test('all study poses loop and scrub deterministically, including numerical actor-local joints under a rotated ship', () => {
  for (const entry of studyCast) {
    const p = characterProfile(entry.id, entry.job),
      rig = createHumanRig(p)
    const actor = new T.Group(),
      ship = new T.Group()
    ship.rotation.set(0.13, 0.39, -0.15)
    ship.position.set(14, 3, 62)
    actor.rotation.y = -0.72
    actor.scale.setScalar(0.93)
    ship.add(actor)
    actor.add(rig.root)
    const state = { job: entry.job, walking: entry.walking, t: 0.489, phase: 1.12 }
    const period = posePeriod(p, state),
      first = poseHuman(rig, p, state)
    const all = Object.keys(rig.bones),
      pos = all.map((n) => first.joints[n].clone()),
      rot = all.map((n) => first.orientations[n].clone())
    poseHuman(rig, p, { ...state, t: 8.213 })
    const final = poseHuman(rig, p, { ...state, t: state.t + period })
    ship.updateMatrixWorld(true)
    for (const [i, n] of all.entries()) {
      assert.ok(pos[i].distanceTo(final.joints[n]) < 1e-8, entry.job + ' ' + n + ' loop')
      assert.ok(1 - Math.abs(rot[i].dot(final.orientations[n])) < 1e-9, entry.job + ' ' + n + ' quaternion')
      assert.ok(
        v([0, 0, 0])
          .setFromMatrixPosition(rig.bones[n].matrixWorld)
          .distanceTo(pos[i].applyMatrix4(actor.matrixWorld)) < 1e-8,
        n + ' external matrix',
      )
    }
    const lip = [0, 0.045 * p.height, 0.079 * p.height],
      expected = v(lip).applyQuaternion(final.orientations.head).add(final.joints.head)
    assert.ok(poseLandmark(rig, p, state, 'head', lip).distanceTo(expected) < 1e-8)
  }
})

test('walking counter-rotates shoulders and hips, swings the opposite arm, and bends the trailing knee', () => {
  const p = characterProfile(64, 'walk'),
    rig = createHumanRig(p),
    state = { job: 'walk', walking: true, phase: 0 }
  const period = posePeriod(p, state),
    chest = [],
    hips = [],
    legs = [],
    arms = []
  let straight = 180,
    folded = 0
  for (let i = 0; i < 120; i++) {
    state.t = (i * period) / 120
    const pose = poseHuman(rig, p, state),
      j = pose.joints,
      q = pose.orientations
    const thigh = j.lShin.clone().sub(j.lThigh).normalize(),
      shin = j.lFoot.clone().sub(j.lShin).normalize()
    const angle = T.MathUtils.radToDeg(thigh.angleTo(shin))
    straight = Math.min(straight, angle)
    folded = Math.max(folded, angle)
    legs.push(j.lFoot.z - j.lThigh.z)
    arms.push(j.lHand.z - j.lUpperArm.z)
    hips.push(new T.Euler().setFromQuaternion(q.pelvis, 'YXZ').y)
    chest.push(new T.Euler().setFromQuaternion(q.chest, 'YXZ').y)
  }
  function correlation(a, b) {
    const mean = (values) => values.reduce((sum, x) => sum + x, 0) / values.length
    const x = mean(a),
      y = mean(b)
    let xx = 0,
      yy = 0,
      xy = 0
    for (let i = 0; i < a.length; i++) {
      const dx = a[i] - x,
        dy = b[i] - y
      xx += dx * dx
      yy += dy * dy
      xy += dx * dy
    }
    return xy / Math.sqrt(xx * yy)
  }
  assert.ok(straight < 16 && folded > 53 && folded < 84)
  assert.ok(correlation(legs, arms) < -0.78)
  assert.ok(correlation(hips, chest) < -0.91)
  for (const boundary of [0, 0.114, 0.435, 0.615, 1]) {
    state.t = period * (boundary - 1e-6)
    const before = poseHuman(rig, p, state),
      ankle = before.joints.lFoot.clone(),
      sole = before.feet.l.tip.clone()
    state.t = period * (boundary + 1e-6)
    const after = poseHuman(rig, p, state)
    assert.ok(ankle.distanceTo(after.joints.lFoot) < 0.00001, 'ankle at ' + boundary)
    assert.ok(sole.distanceTo(after.feet.l.tip) < 0.00001, 'toes at ' + boundary)
  }
})

test('the actual twelve tools and seated study figures keep fixed bone lengths, grasp axes and lip contact for a full cycle', () => {
  let contacts = 0,
    mouthHits = 0
  for (const person of studyCast) {
    const p = characterProfile(person.id, person.job),
      rig = createHumanRig(p),
      equipment = buildEquipment(p, rig, person.job)
    const state = { job: person.job, walking: person.walking, phase: 0.37 },
      period = posePeriod(p, state)
    const lip = person.job === 'flute' ? portraitMouth(p).multiplyScalar(p.height) : null
    for (let i = 0; i <= 72; i++) {
      state.t = (i * period) / 72
      const grips = equipment.update(state),
        pose = poseHuman(rig, p, state, grips)
      rigid(rig, pose)
      for (const side of sides) {
        if (!grips[side]) continue
        const tip = pose.joints[side + 'Hand'],
          q = pose.orientations[side + 'Hand']
        assert.ok(
          v(handGrip).applyQuaternion(q).add(tip).distanceTo(grips[side].point) < 0.0003,
          person.job + ' ' + side,
        )
        assert.ok(
          new T.Vector3(0, 1, 0).applyQuaternion(q).distanceTo(grips[side].axis) < 1e-7,
          person.job + ' shaft',
        )
        contacts++
      }
      if (lip) {
        assert.ok(
          lip.clone().applyQuaternion(pose.orientations.head).add(pose.joints.head).distanceTo(grips.mouth) <
            0.00025,
        )
        mouthHits++
      }
      if (person.job === 'lute')
        assert.ok(pose.joints.lForearm.y < pose.joints.lUpperArm.y, 'fretting elbow rests alongside the body')
    }
  }
  assert.ok(contacts > 1100 && mouthHits === 73)
})

test('skinned cloth shoes, embroidered slippers and boots meet the ground at their actual sole vertices', () => {
  for (const [id, job] of [
    [64, 'walk'],
    [47, 'umbrella'],
    [53, 'watch'],
  ]) {
    const p = characterProfile(id, job),
      rig = createHumanRig(p),
      mesh = shoes(p, rig, job)
    const state = { job, walking: true, phase: 0 },
      period = posePeriod(p, state),
      pos = mesh.geometry.attributes.position,
      point = new T.Vector3()
    const groundVertices = []
    for (let i = 0; i < pos.count; i++)
      if (pos.getX(i) > 0 && pos.getY(i) < 0.0115 * p.height) groundVertices.push(i)
    assert.ok(groundVertices.length > 320)
    for (let i = 0; i <= 90; i++) {
      state.t = (i * period) / 90
      const pose = poseHuman(rig, p, state)
      if (!pose.feet.l.stance) continue
      rig.root.updateMatrixWorld(true)
      let lowest = Infinity
      for (const j of groundVertices) lowest = Math.min(lowest, mesh.getVertexPosition(j, point).y)
      assert.ok(
        Math.abs(lowest) < 0.00055,
        `${mesh.name}, phase ${pose.feet.l.phase}, lowest point ${lowest}`,
      )
    }
    mesh.geometry.dispose()
  }
})

test('the waist lowers for a near-limit foothold and reports a farther target without stretching either leg', () => {
  const p = characterProfile(36, 'porter'),
    r = createHumanRig(p)
  const state = { job: 'porter', t: 0.61, phase: 0.17, loading: 0 }
  const height = poseHuman(r, p, state).joints.pelvis.y
  const grips = { feet: { l: { point: new T.Vector3(0.105, 0, 0.39), yaw: 0.06 } } }
  let pose = poseHuman(r, p, state, grips)
  assert.ok(height - pose.joints.pelvis.y > 0.035)
  assert.ok(pose.feet.l.residual < 0.00001)
  rigid(r, pose)
  grips.feet.l.point.z = 1.05
  pose = poseHuman(r, p, state, grips)
  assert.ok(pose.feet.l.residual > 0.25 && pose.feet.l.residual < 0.68)
  rigid(r, pose)
})

test('an offset on a loaded shoulder follows the current girdle when scrubbing a previous frame', () => {
  const p = characterProfile(51, 'carrier'),
    rig = createHumanRig(p),
    goods = buildEquipment(p, rig, 'carrier')
  const state = { job: 'carrier', walking: true, t: 0.56, phase: 1.22 }
  const firstGrip = goods.update(state).r.point.clone()
  const firstHand = poseHuman(rig, p, state, goods.update(state)).joints.rHand.clone()
  const other = { ...state, t: 1.08 }
  poseHuman(rig, p, other, goods.update(other))
  const returned = goods.update(state)
  assert.ok(returned.r.point.distanceTo(firstGrip) < 1e-10)
  assert.ok(poseHuman(rig, p, state, returned).joints.rHand.distanceTo(firstHand) < 1e-10)
})

test('surveyed footprints keep world support on pavement, reuse readings across frames, and honor a stationary actor matrix', () => {
  const profile = characterProfile(47, 'umbrella'),
    rig = createHumanRig(profile)
  const scale = 0.93,
    phase = 0.51,
    at = (t, out) => Object.assign(out, { x: 8, z: 16 + t * 0.72, y: 1.37, yaw: 0 })
  const level = 1.391
  let calls = 0
  const groundAt = (x, z, y) => {
    calls++
    assert.ok(x > 7 && z >= 15 && y === 1.37)
    return level
  }
  const state = { t: 0, job: 'umbrella', walking: true, routeAt: at, scale, phase, groundAt }
  const tracks = new Map()
  for (let i = 0; i <= 180; i++) {
    state.t = i / 90
    const pose = poseHuman(rig, profile, state),
      base = at(state.t, {})
    for (const side of sides) {
      const f = pose.feet[side]
      if (!f.stance) continue
      const actual = toWorld(f.actual, base, scale)
      close(actual.y, level)
      const key =
        side +
        Math.floor(state.t / pose.period + phase / (2 * Math.PI) + (side === 'r' ? 0.5 : 0)) +
        f.support
      if (tracks.has(key)) assert.ok(actual.distanceTo(tracks.get(key)) < 1e-8)
      else tracks.set(key, actual)
    }
    const currentCalls = calls
    poseHuman(rig, profile, state)
    assert.equal(calls, currentCalls, 'stable equipment/pose requests share the same footprint')
  }
  assert.ok(calls > 2 && calls < 4500, calls + ' rays for 181 frames')
  const m = new T.Matrix4().compose(
    new T.Vector3(17.1, 1.374, 12.8),
    new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.7),
    new T.Vector3(0.94, 0.94, 0.94),
  )
  let count = 0
  const stationary = {
    job: 'porter',
    loading: 0.2,
    walking: false,
    scale: 0.94,
    base: m,
    t: 0.35,
    groundAt(x, z, y) {
      count++
      assert.ok(x > 16 && x < 18 && z > 12 && z < 14)
      close(y, 1.374)
      return 1.367
    },
  }
  const pose = poseHuman(rig, profile, stationary)
  for (const f of Object.values(pose.feet)) close(1.374 + 0.94 * f.actual.y, 1.367)
  const known = count
  poseHuman(rig, profile, { ...stationary, t: 2.6 })
  assert.equal(count, known)
})

// The narrow inset ring can bear against the interior of a sole triangle.
// Comparing vertices alone misreads a perfectly good contact as seven mm of air.
function shoeClearance(mesh, side, at, scale, floor) {
  const original = mesh.geometry,
    posed = new T.BufferGeometry(),
    bound = new T.Box3()
  const coords = new Float32Array(original.attributes.position.count * 3),
    indices = []
  const namedFoot = (i) => original.attributes.position.getX(i) > 0 === (side === 'l')
  const point = new T.Vector3()
  for (let i = 0; i < original.attributes.position.count; i++) {
    if (!namedFoot(i)) continue
    const world = toWorld(mesh.getVertexPosition(i, point), at, scale)
    world.toArray(coords, 3 * i)
    bound.expandByPoint(world)
  }
  const idx = original.index
  for (let i = 0; i < idx.count; i += 3) {
    if (namedFoot(idx.getX(i))) indices.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2))
  }
  posed.setAttribute('position', new T.BufferAttribute(coords, 3))
  posed.setIndex(indices)
  const tree = new MeshBVH(posed),
    ray = new T.Ray(new T.Vector3(), new T.Vector3(0, 1, 0))
  let min = Infinity
  for (let x = bound.min.x; x <= bound.max.x; x += 0.003)
    for (let z = bound.min.z; z <= bound.max.z; z += 0.003) {
      ray.origin.set(x, at.y - 0.18, z)
      const sole = tree.raycastFirst(ray, T.DoubleSide, 0, 0.43)
      if (sole) min = Math.min(min, sole.point.y - floor(x, z, at.y))
    }
  posed.dispose()
  return min
}

test('physical soles cross two raised quay inlays on their real route and actual decorated masonry', () => {
  const city = new T.Scene(),
    mat = materials(),
    batch = new LandBatch(city)
  landFinishes(mat)
  civicStones(batch, mat)
  batch.finish()
  const stone = courtyardCollision(city),
    floor = (x, z, y) => stone.floor(x, z, y + 0.085, 0.195) ?? y
  const cast = harbourCast(traffic.map((spec) => ({ spec, group: new T.Group() })))
  for (const [id, t, side] of [
    [24, 54.753471962564966, 'r'],
    [31, 1.1898390781037755, 'l'],
  ]) {
    const actor = cast.find((p) => p.appearance === id),
      profile = characterProfile(id, actor.job)
    const rig = createHumanRig(profile),
      mesh = shoes(profile, rig, actor.job)
    const state = {
      actor,
      job: actor.job,
      t,
      phase: actor.phase,
      scale: actor.size,
      walking: true,
      routeAt: (at, out) => castRoute(actor, at, out),
    }
    const route = state.routeAt(t, {})
    poseHuman(rig, profile, state)
    rig.root.updateMatrixWorld(true)
    const nominal = shoeClearance(mesh, side, route, actor.size, floor)
    assert.ok(nominal < -0.009, id + ' nominal sole penetration ' + nominal)
    state.groundAt = floor
    poseHuman(rig, profile, state)
    rig.root.updateMatrixWorld(true)
    const clearance = shoeClearance(mesh, side, route, actor.size, floor)
    assert.ok(Math.abs(clearance) < 0.00065, actor.job + ' real sole clearance ' + clearance)
    mesh.geometry.dispose()
  }
})
