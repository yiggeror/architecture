import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { characterProfile } from '../src/characterProfiles.js'
import { buildExtremities } from '../src/characterHands.js'
import { createCharacter } from '../src/characters.js'
import { finishes } from '../src/characterPropCraft.js'
import { scholarFan, fanGrip } from '../src/characterPropFan.js'
import { createHumanRig, handGrip, solePoints } from '../src/humanRig.js'

function model(id, job) {
  const profile = characterProfile(id, job),
    rig = createHumanRig(profile)
  const parts = buildExtremities(profile, rig, job)
  const group = new T.Group()
  group.add(rig.root, parts.group)
  group.updateMatrixWorld(true)
  return {
    profile,
    rig,
    parts,
    shoe: parts.group.children[0],
    left: rig.bones.lHand.children[0],
    right: rig.bones.rHand.children[0],
  }
}
const norm = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]))

test('the bare forearm and palm share one skin edge, joint transform, pigment and normal in every wrist pose', () => {
  const point = new T.Vector3(), other = new T.Vector3(), origin = new T.Vector3()
  for (const [id, job] of [[9, 'lute'], [47, 'umbrella'], [64, 'walk'], [0, 'row']]) {
    const profile = characterProfile(id, job)
    const person = createCharacter(profile, job), { rig } = person
    const forearm = rig.forearmSkin.mesh, sleeve = forearm.geometry.attributes
    for (const side of ['l', 'r']) {
      const hand = rig.bones[side + 'Hand'].children.find((o) => o.isMesh), skin = hand.geometry.attributes
      const edge = rig.forearmSkin[side].at(-1).indices
      origin.fromArray(rig.rest[side + 'Hand'])
      const match = rig.forearmSkin[side].at(-1).handEdge
      edge.forEach((i, k) => {
        const found = match[k]
        point.fromBufferAttribute(sleeve.position, i).sub(origin)
        assert.ok(other.fromBufferAttribute(skin.position, found).distanceTo(point) < 0.000001)
        assert.ok(point.fromBufferAttribute(skin.normal, found).dot(other.fromBufferAttribute(sleeve.normal, i)) > 0.9998)
        assert.ok(point.fromBufferAttribute(skin.color, found).distanceTo(other.fromBufferAttribute(sleeve.color, i)) < 0.00001)
      })
      // The end ring follows the exact hand joint, including deep flexion on
      // a string and the maximum pronation of the oarsman's recovery stroke.
      for (const t of [0, 0.47, 1.41, 2.3]) {
        person.update({ t, phase: 0.28, job, walking: job === 'walk' || job === 'umbrella' })
        person.group.updateMatrixWorld(true)
        for (let i = 0; i < match.length; i++) {
          forearm.getVertexPosition(edge[i], point).applyMatrix4(forearm.matrixWorld)
          hand.getVertexPosition(match[i], other).applyMatrix4(hand.matrixWorld)
          assert.ok(point.distanceTo(other) < 0.000001)
        }
      }
    }
    person.dispose()
  }
})

test('four physical, individually proportioned three-phalanx fingers surround the same handle in both palms', () => {
  const { left, right, shoe } = model(0, 'row')
  const physical = [
    [0.037, 0.023, 0.018],
    [0.041, 0.026, 0.0195],
    [0.038, 0.024, 0.018],
    [0.03, 0.019, 0.015],
  ]
  let count = 0
  for (const mesh of [left, right]) {
    assert.equal(mesh.userData.gesture, 'grip')
    assert.equal(mesh.userData.digitJoints.length, 5)
    for (let i = 0; i < 4; i++) {
      const finger = mesh.userData.digitJoints[i]
      assert.equal(finger.length, 4)
      for (let j = 0; j < 3; j++)
        assert.ok(Math.abs(norm(finger[j], finger[j + 1]) - physical[i][j]) < 0.0015)
    }
    const { position, normal, uv } = mesh.geometry.attributes
    assert.equal(position.count, uv.count)
    let closest = Infinity,
      contact = 0
    for (const index of new Set(mesh.geometry.index.array)) {
      const radius = Math.hypot(position.getX(index) - handGrip[0], position.getZ(index) - handGrip[2])
      closest = Math.min(closest, radius)
      if (radius < mesh.userData.gripRadius + 0.00055) contact++
      assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(normal, index).length() - 1) < 0.0001)
    }
    assert.ok(closest >= mesh.userData.gripRadius - 0.00001)
    assert.ok(contact > 45)
    count += mesh.geometry.index.count / 3
  }
  assert.ok(count + shoe.geometry.index.count / 3 < 21000)
  assert.ok(left.isMesh && right.isMesh && shoe.isSkinnedMesh)
  for (let j = 0; j < 5; j++)
    for (let k = 0; k < 4; k++) {
      const a = left.userData.digitJoints[j][k],
        b = right.userData.digitJoints[j][k]
      assert.deepEqual(a, [-b[0], b[1], b[2]])
    }
})

test('six flute pads close the actual bamboo holes, and playback animates named GLB morph targets', () => {
  const { left, right, parts } = model(5, 'flute')
  const named = ['食指', '中指', '无名指']
  for (const [hand, center, holes] of [
    [left, 0.143, [0.174, 0.145, 0.116]],
    [right, 0.235, [0.263, 0.235, 0.208]],
  ]) {
    const g = hand.geometry
    assert.ok(g.morphTargetsRelative)
    assert.equal(g.morphAttributes.position.length, 3)
    assert.equal(g.morphAttributes.normal.length, 3)
    for (const [i, term] of named.entries()) {
      assert.ok(Object.keys(hand.morphTargetDictionary).some((name) => name.includes(term)))
      const hole = [0, handGrip[1] + holes[i] - center, handGrip[2] + 0.0105]
      let nearest = Infinity
      const p = g.attributes.position
      for (let j = 0; j < p.count; j++)
        nearest = Math.min(nearest, norm([p.getX(j), p.getY(j), p.getZ(j)], hole))
      assert.ok(nearest < 0.0035, hand.name + ' ' + term + ' ' + nearest)
    }
  }
  const initial = left.geometry.attributes.position.array.slice()
  parts.update({ t: 0.1, phase: 0.2 })
  const first = [...left.morphTargetInfluences]
  parts.update({ t: 0.85, phase: 0.2 })
  assert.notDeepEqual(left.morphTargetInfluences, first)
  assert.deepEqual(left.geometry.attributes.position.array, initial)
  const lute = model(9, 'lute')
  const tip = lute.right.userData.digitJoints[0][3]
  assert.ok(norm(tip, handGrip) < 0.0015)
  assert.ok(Object.keys(lute.right.morphTargetDictionary).some((name) => name.includes('拇指')))
})

test('the radial thumb web presents uninterrupted front-facing skin at the scholar portrait angle', () => {
  const { right } = model(64, 'walk')
  const tree = new MeshBVH(right.geometry, { indirect: true })
  const origin = new T.Vector3(-0.180713, 0.073632, 0.221150)
  const direction = new T.Vector3(0.578881, -0.374187, -0.724486).normalize()
  const across = new T.Vector3().crossVectors(direction, new T.Vector3(0, 1, 0)).normalize()
  const up = new T.Vector3().crossVectors(across, direction).normalize()
  const ray = new T.Ray(origin.clone(), direction)
  for (let y = -2; y <= 2; y++) {
    for (let x = -4; x <= 4; x++) {
      ray.origin.copy(origin).addScaledVector(across, x * 0.0015).addScaledVector(up, y * 0.0012)
      const outer = tree.raycastFirst(ray, T.FrontSide)
      const nearest = tree.raycastFirst(ray, T.DoubleSide)
      assert.ok(outer && nearest && Math.abs(outer.distance - nearest.distance) < 0.00002)
    }
  }
})

test('pipa picking alternates real outer index and thumb pads while the curled fingers clear the strings', () => {
  const { rig, right, parts } = model(9, 'lute')
  const n = new T.Vector3(-0.82, 0.48, -0.31).normalize(),
    target = new T.Vector3(), sample = new T.Vector3()
  const pads = right.userData.pickingPads
  const skin = right.geometry.attributes.position
  const thumbMorph = right.geometry.morphAttributes.position[right.morphTargetDictionary['右手拇指奏指']]
  const seams = new Map(), shift = new T.Vector3()
  for (let i = 0; i < skin.count; i++) {
    const key = sample.fromBufferAttribute(skin, i).toArray().map((v) => Math.round(v * 1e7)).join(',')
    if (seams.has(key)) {
      assert.ok(shift.fromBufferAttribute(thumbMorph, i).distanceTo(sample.fromBufferAttribute(thumbMorph, seams.get(key))) < 0.000001)
    } else seams.set(key, i)
  }
  for (const finger of right.userData.digitJoints.slice(1, 4)) {
    const joints = finger.map((point) => new T.Vector3(...point))
    const bones = joints.slice(1).map((point, i) => point.clone().sub(joints[i]))
    const proximal = T.MathUtils.radToDeg(bones[0].angleTo(bones[1]))
    const distal = T.MathUtils.radToDeg(bones[1].angleTo(bones[2]))
    assert.ok(proximal >= 55 && proximal <= 80 && distal >= 40 && distal <= 68)
  }
  for (let frame = 0; frame <= 48; frame++) {
    const phase = (frame / 48) * Math.PI * 2
    parts.update({ t: 0, phase })
    rig.pickingContact(phase, target)
    if (frame % 8 === 0) {
      const active = frame % 16 === 0 ? pads.index : pads.thumb
      assert.ok(right.getVertexPosition(active, sample).distanceTo(target) < 0.00001)
    }
    for (let i = 0; i < right.geometry.attributes.position.count; i++) {
      const clearance = right.getVertexPosition(i, sample).sub(target).dot(n)
      assert.ok(clearance > -0.0008, `${frame} ${i} ${clearance}`)
    }
    for (const [start, end] of right.userData.distalSkin.slice(1, 4)) {
      for (let i = start; i < end; i++) {
        assert.ok(right.getVertexPosition(i, sample).sub(target).dot(n) > 0.003)
      }
    }
  }
})

test('the scholar rests an extended index on the outer wooden fan guard and keeps the little finger open', () => {
  const { right, profile } = model(64, 'walk')
  const material = finishes(profile, 'walk'),
    { fan } = scholarFan(material)
  const guard = fan
    .getObjectByName('乌木双护骨与菊头铆钉')
    .children.find((o) => o.material === material.matte)
  const wood = new MeshBVH(guard.geometry, { indirect: true })
  const slips = new MeshBVH(fan.getObjectByName('十一枚竹心细骨').children[0].geometry, { indirect: true })
  const offset = fanGrip.clone().sub(new T.Vector3(...handGrip)),
    skin = right.geometry.attributes.position,
    sample = new T.Vector3()
  const distances = right.userData.distalSkin.map(([start, end], digit) => {
    let nearest = Infinity
    for (let i = start; i < end; i++) {
      sample.fromBufferAttribute(skin, i).add(offset)
      nearest = Math.min(nearest, wood.closestPointToPoint(sample).distance)
      if (digit === 3) nearest = Math.min(nearest, slips.closestPointToPoint(sample).distance)
    }
    return nearest
  })
  const tip = new T.Vector3(...right.userData.digitJoints[0].at(-1)).add(offset)
  assert.ok(wood.closestPointToPoint(tip).distance < 0.0018, 'index tip falls short of the outer guard')
  for (const digit of [0, 1, 2, 4]) assert.ok(distances[digit] < 0.0012, `${digit} ${distances[digit]}`)
  assert.ok(distances[3] > 0.002 && distances[3] < 0.014)
})

test('the relaxed hand opens, the boot and cloth uppers differ, and all exported shoe skin channels are valid', () => {
  const pedestrian = model(64, 'walk'),
    parasol = model(47, 'umbrella')
  assert.equal(pedestrian.left.userData.gesture, 'relaxed')
  assert.equal(pedestrian.right.userData.gesture, 'fan')
  assert.equal(pedestrian.right.userData.gripRadius, 0.0095)
  const guard = pedestrian.right.userData.digitJoints[0].at(-1)
  assert.ok(
    guard[1] > handGrip[1] + 0.025 && Math.abs(Math.hypot(guard[0], guard[2] - handGrip[2]) - 0.0095) < 0.001,
  )
  assert.equal(model(27, 'walk').right.userData.gesture, 'relaxed')
  assert.equal(parasol.left.userData.gesture, 'grip')
  assert.equal(parasol.right.userData.gesture, 'relaxed')
  const tips = pedestrian.left.userData.digitJoints.map((d) => d.at(-1))
  assert.ok(tips[1][1] < tips[0][1] && tips[0][1] < tips[3][1])
  const a = pedestrian.left.geometry.boundingBox
  assert.ok(a.max.y - a.min.y > 0.174 && a.max.y - a.min.y < 0.207)
  const outfits = [model(0, 'row'), model(9, 'lute'), model(53, 'watch')]
  assert.deepEqual(
    outfits.map((x) => x.shoe.userData.shoeStyle),
    ['work', 'slipper', 'boot'],
  )
  const ray = new T.Raycaster()
  for (const { rig, profile, shoe } of outfits) {
    const g = shoe.geometry,
      weights = g.attributes.skinWeight,
      indices = g.attributes.skinIndex
    let toe = 0,
      shin = 0
    for (let i = 0; i < weights.count; i++) {
      const start = i * 4
      let sum = 0
      for (let j = 0; j < 4; j++) {
        const w = weights.array[start + j],
          bone = indices.array[start + j]
        sum += w
        assert.ok(w >= 0 && w <= 1)
        if (w === 0) assert.equal(bone, 0)
        if (w > 0.9 && bone === rig.index.lToe) toe++
        if (w > 0.6 && bone === rig.index.lShin) shin++
      }
      assert.ok(Math.abs(sum - 1) < 0.000001)
    }
    assert.ok(toe > 15 && shin > 15)
    // Intersect the actual, skinned underside with an upward ray at each
    // actor-space heel, ball and tip surveyed by the gait solver.
    for (const landmark of Object.values(solePoints)) {
      ray.set(new T.Vector3(rig.rest.lFoot[0], -0.04, landmark[2] * profile.height), new T.Vector3(0, 1, 0))
      const hit = ray.intersectObject(shoe, false)[0]
      assert.ok(hit && Math.abs(hit.point.y) < 0.00015)
    }
  }
})

test('gait samples each shoe’s actual inner and outer outsole vertices in height-normalized coordinates', () => {
  for (const [id, job] of [
    [0, 'row'],
    [9, 'lute'],
    [53, 'watch'],
  ]) {
    const { profile, rig, shoe } = model(id, job)
    const vertex = shoe.geometry.attributes.position
    const where = new Set()
    const key = (x, y, z) => [x, y, z].map(Math.fround).join(',')
    for (let i = 0; i < vertex.count; i++) where.add(key(vertex.getX(i), vertex.getY(i), vertex.getZ(i)))
    const out = new T.Vector3(),
      ray = new T.Raycaster()
    for (const side of ['l', 'r']) {
      const footX = rig.rest[side + 'Foot'][0],
        h = profile.height
      for (const z of [-0.093, -0.075, -0.042, -0.015, 0.008, 0.031, 0.089, 0.153, 0.192, 0.202]) {
        for (const fraction of [-1, -0.75, -0.5, 0, 0.5, 0.75, 1]) {
          assert.equal(rig.soleSurface(side, z, fraction, out), out)
          assert.equal(out.z, z)
          assert.ok(where.has(key(footX + out.x * h, out.y * h, out.z * h)), [side, z, fraction].join('/'))
        }
      }
      for (const sign of [-1, 1]) {
        const bottom = rig.soleSurface(side, 0.18, sign, out).clone()
        assert.ok(rig.soleSurface(side, 0.18, sign * 1.000001, out).distanceTo(bottom) < 0.000001)
      }
      // The raised stone braid touches the flared sidewall outside the flat
      // sole. Compare its predicted bearing height with an upward mesh ray.
      for (const z of [-0.081, 0.013, 0.074, 0.133, 0.18]) {
        for (const fraction of [-1.147, -1.1, -1.045, 1.045, 1.1, 1.14]) {
          rig.soleSurface(side, z, fraction, out)
          ray.set(new T.Vector3(footX + out.x * h, -0.03, out.z * h), new T.Vector3(0, 1, 0))
          const hit = ray.intersectObject(shoe, false)[0]
          assert.ok(hit && Math.abs(hit.point.y - out.y * h) < 0.00022, [side, z, fraction].join('/'))
        }
      }
    }
    const inner = rig.soleSurface('l', 0.008, -1, out).clone()
    const outer = rig.soleSurface('l', 0.008, 1, out).clone()
    assert.ok(inner.y > outer.y + 0.001)
    assert.ok(Math.abs(inner.x) < outer.x)
  }
})
