import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { pipaVolumes } from './pipaVolumes.mjs'
import { buildEquipment } from '../src/characterEquipment.js'
import { createCharacter } from '../src/characters.js'
import { fanGrip } from '../src/characterPropFan.js'
import { harbourCast, castRoute, figurePlacement } from '../src/characterCast.js'
import { characterProfile, studyCast } from '../src/characterProfiles.js'
import { crewFixtures, strokePose, sweepPoint } from '../src/characterPropCrew.js'
import { buildPortrait, portraitMouth } from '../src/characterPortrait.js'
import { buildVessel, dockWork } from '../src/fleetBoats.js'
import { carpSilk } from '../src/fleetCarp.js'
import { cutPaper } from '../src/fleetOrnaments.js'
import { traffic, locate } from '../src/fleetRoute.js'
import { createHumanRig, handGrip } from '../src/humanRig.js'
import { poseHuman, posePeriod } from '../src/humanPose.js'
import { materials } from '../src/kit.js'
import { reachResidents } from '../src/reachPeople.js'

const walking = new Set(['umbrella', 'walk', 'lantern', 'watch', 'basket', 'carrier'])
const seated = new Set(['row', 'sit', 'lute'])
const grip = new T.Vector3(...handGrip),
  up = new T.Vector3(0, 1, 0)
let cast, ships, quay
before(() => {
  const scene = new T.Scene(),
    m = materials(),
    silk = carpSilk(),
    panels = cutPaper(m)
  ships = traffic.map((spec, index) => ({ ...buildVessel(scene, m, spec, silk, panels), spec, index }))
  const dock = new T.Scene()
  dockWork(dock, m)
  quay = []
  dock.traverse((o) => {
    if (o.isMesh) quay.push(o)
  })
  cast = harbourCast(ships)
})
function figure(id, job, birthJob = job) {
  const profile = characterProfile(id, birthJob),
    rig = createHumanRig(profile)
  return { profile, rig, equipment: buildEquipment(profile, rig, job) }
}
function animate(boat, t) {
  const p = locate(boat.spec, t, {})
  boat.group.position.set(p.x, 0.026 * Math.sin(1.42 * t), p.z)
  boat.group.rotation.set(
    0.018 * Math.sin(t * 1.36),
    Math.atan2(p.dx, p.dz),
    0.013 * Math.cos(t * 1.67),
    'YXZ',
  )
  for (const o of boat.oars) strokePose(o.pivot, o.station, boat.index, t)
  boat.group.updateMatrixWorld(true)
}
function update(c, state) {
  const grips = c.equipment.update(state)
  poseHuman(c.rig, c.profile, state, grips)
  c.rig.root.updateMatrixWorld(true)
  for (const side of ['l', 'r']) {
    const requested = grips[side]
    if (!requested) continue
    const mat = c.rig.bones[side + 'Hand'].matrixWorld,
      actual = grip.clone().applyMatrix4(mat)
    assert.ok(
      actual.distanceTo(requested.point) < 0.0015,
      'missed ' +
        state.job +
        ' ' +
        side +
        ' grip at ' +
        state.t +
        ' by ' +
        actual.distanceTo(requested.point),
    )
    assert.ok(
      up.clone().transformDirection(mat).dot(requested.axis) > 0.9999,
      'wrist does not follow the shaft',
    )
  }
  return grips
}
const trees = new WeakMap()
function tree(mesh) {
  if (!trees.has(mesh.geometry)) trees.set(mesh.geometry, new MeshBVH(mesh.geometry, { indirect: true }))
  return trees.get(mesh.geometry)
}
function surfaceDistance(group, point) {
  let min = Infinity
  const local = new T.Vector3(),
    inv = new T.Matrix4()
  group.updateMatrixWorld(true)
  group.traverseVisible((o) => {
    if (!o.isMesh) return
    local.copy(point).applyMatrix4(inv.copy(o.matrixWorld).invert())
    const hit = tree(o).closestPointToPoint(local)
    if (hit) min = Math.min(min, hit.distance)
  })
  return min
}

test('all twelve trades use reachable contacts on rendered fittings throughout a full cycle', () => {
  for (const { id, job } of studyCast) {
    const c = figure(id, job),
      state = { job, t: 0, phase: 0.21, walking: walking.has(job), day: true, scale: 1 },
      cycle = posePeriod(c.profile, state)
    for (let k = 0; k < 23; k++) {
      state.t = (k * cycle) / 23
      state.loading = 0.5 - 0.5 * Math.cos((k * 2 * Math.PI) / 23)
      const g = update(c, state)
      for (const side of ['l', 'r'])
        if (g[side]) {
          const radius = g[side].radius,
            d = surfaceDistance(c.equipment.group, g[side].point)
          assert.ok(d <= radius + 0.006, job + ' ' + side + ' has no handle at the palm: ' + d)
        }
      if (job === 'flute') {
        const mouth = portraitMouth(c.profile)
          .multiplyScalar(c.profile.height)
          .applyMatrix4(c.rig.bones.head.matrixWorld)
        const pipe = c.equipment.group.getObjectByName('缠丝竹笛'),
          hole = new T.Vector3(0, 0, 0.0107).applyMatrix4(pipe.matrixWorld)
        assert.ok(mouth.distanceTo(hole) < 0.0018, 'embouchure misses the lip')
      }
      if (job === 'walk') {
        assert.ok(!g.l)
        assert.equal(g.r?.kind, c.profile.design === 'scholar' ? 'fan' : undefined)
      }
    }
    function readAt(t) {
      state.t = t
      state.loading = 0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / cycle)
      const result = update(c, state)
      return ['l', 'r'].flatMap((side) =>
        result[side] ? [result[side].point.clone(), result[side].axis.clone()] : [],
      )
    }
    const start = readAt(0)
    readAt(cycle * 0.373)
    const repeated = readAt(0)
    for (let k = 0; k < start.length; k++)
      assert.ok(start[k].distanceTo(repeated[k]) < 1e-7, job + ' grip depends on the previous scrub time')
    if (job === 'lantern' || job === 'watch') {
      const wick = c.equipment.lamp
      assert.equal(wick, c.equipment.group.getObjectByName('灯芯'))
      assert.equal(wick.color.getHex(), 0xffb56d)
      assert.equal(wick.intensity, 0.03)
      assert.equal(wick.castShadow, false)
      assert.equal(wick.decay, 2)
      assert.equal(wick.distance, 2.65)
      state.day = false
      update(c, state)
      assert.equal(wick.intensity, 0.64)
      const centre = wick.parent.localToWorld(new T.Vector3(0, -0.263, 0))
      assert.ok(wick.getWorldPosition(new T.Vector3()).distanceTo(centre) < 1e-7)
    }
  }
})
test('the bookseller holds the outer guard while the painted leaf and inner slips clear his hand and costume', () => {
  const citizen = figure(25, 'walk'),
    otherJob = figure(64, 'lantern', 'walk')
  assert.ok(citizen.equipment.group.getObjectByName('行旅竹符'))
  for (const e of [citizen.equipment, otherJob.equipment])
    assert.equal(e.group.getObjectByName('听竹斋双面折扇'), undefined)

  const profile = characterProfile(64, 'walk'),
    human = createCharacter(profile, 'walk'),
    fan = human.group.getObjectByName('听竹斋双面折扇'),
    paper = fan.getObjectByName('竹影双面折纸').children[0],
    slips = fan.getObjectByName('十一枚竹心细骨').children[0],
    guard = fan.getObjectByName('乌木双护骨与菊头铆钉'),
    hand = human.group.getObjectByName('右手'),
    state = { t: 0, phase: 0.21, job: 'walk', walking: true },
    period = posePeriod(profile, state),
    point = new T.Vector3(),
    target = new T.Vector3(),
    relative = new T.Matrix4()
  assert.equal(hand.userData.gesture, 'fan')
  assert.equal(human.group.getObjectByName('左手').userData.gesture, 'relaxed')
  assert.ok(paper.material.map.isDataTexture)
  const fabric = []
  human.group.traverse((o) => {
    if (!o.isSkinnedMesh) return
    const positions = new T.Float32BufferAttribute(
        new Float32Array(o.geometry.attributes.position.count * 3),
        3,
      ),
      mesh = {
        geometry: new T.BufferGeometry().setAttribute('position', positions).setIndex(o.geometry.index),
      }
    fabric.push({ o, mesh, positions })
  })
  const blades = [paper, slips, ...guard.children],
    first = new T.Vector3(),
    swing = new T.Vector3()
  try {
    for (let i = 0; i < 24; i++) {
      state.t = (period * i) / 24
      human.update(state)
      human.group.updateMatrixWorld(true)
      human.rig.skeleton.update()
      target.copy(fanGrip).applyMatrix4(fan.matrixWorld)
      assert.ok(point.copy(grip).applyMatrix4(hand.matrixWorld).distanceTo(target) < 0.00001)
      if (i === 0) first.copy(target)
      if (i === 6) swing.copy(target)
      relative.copy(hand.matrixWorld).invert().multiply(fan.matrixWorld)
      for (const blade of [paper, slips])
        assert.equal(
          tree(hand).bvhcast(tree(blade), relative, {
            intersectsTriangles: (a, b) => a.intersectsTriangle(b),
          }),
          false,
        )
      const lip = human.rig.bones.head.getWorldPosition(point).y,
        leaf = paper.geometry.attributes.position
      for (let j = 0; j < leaf.count; j++)
        assert.ok(point.fromBufferAttribute(leaf, j).applyMatrix4(paper.matrixWorld).y < lip - 0.095)
      for (const { o, mesh, positions } of fabric) {
        for (let j = 0; j < positions.count; j++) {
          o.getVertexPosition(j, point)
          positions.setXYZ(j, point.x, point.y, point.z)
        }
        mesh.geometry.computeBoundingBox()
        const clothTree = tree(mesh)
        clothTree.refit()
        relative.copy(o.matrixWorld).invert().multiply(fan.matrixWorld)
        for (const blade of blades)
          assert.equal(
            clothTree.bvhcast(tree(blade), relative, {
              intersectsTriangles: (a, b) => a.intersectsTriangle(b),
            }),
            false,
            'the bookseller’s ' + o.name + ' enters ' + blade.parent.name + ' at phase ' + i,
          )
      }
    }
    assert.ok(first.distanceTo(swing) > 0.012, 'fan remains fixed during the walk')
  } finally {
    for (const { mesh } of fabric) mesh.geometry.dispose()
    human.dispose()
  }
})

test('the six fitted protagonists keep their hair, ears and brows clear of the props they carry or play', () => {
  const box = new T.Box3(),
    nearby = new T.Box3(),
    relative = new T.Matrix4()
  for (const { id, job } of studyCast) {
    if (!characterProfile(id, job).design) continue
    const c = figure(id, job)
    const head = buildPortrait(c.profile),
      features = [],
      parts = [],
      state = { job, t: 0, walking: walking.has(job), phase: 0.2 },
      period = posePeriod(c.profile, state)
    c.rig.bones.head.add(head)
    head.scale.multiplyScalar(c.profile.height)
    for (const [group, items] of [
      [head, features],
      [c.equipment.group, parts],
    ])
      group.traverseVisible((mesh) => {
        if (mesh.isMesh) {
          mesh.geometry.computeBoundingBox()
          items.push(mesh)
        }
      })
    for (let i = 0; i < 16; i++) {
      state.t = (period * i) / 16
      update(c, state)
      c.equipment.group.updateMatrixWorld(true)
      for (const a of features) {
        box.copy(a.geometry.boundingBox).applyMatrix4(a.matrixWorld)
        for (const b of parts) {
          if (!box.intersectsBox(nearby.copy(b.geometry.boundingBox).applyMatrix4(b.matrixWorld))) continue
          relative.copy(b.matrixWorld).invert().multiply(a.matrixWorld)
          assert.equal(
            tree(b).bvhcast(tree(a), relative, { intersectsTriangles: (x, y) => x.intersectsTriangle(y) }),
            false,
            c.profile.name + ' ' + a.name + ' touches ' + b.parent.name + ' at ' + state.t,
          )
        }
      }
    }
  }
})

test('all shore workers follow their own modelled tools around the actual scaled street routes', () => {
  const records = [...cast.filter((p) => !p.ship), ...reachResidents()]
  for (const p of records) {
    for (const job of new Set([p.job, p.dayJob ?? p.job])) {
      const c = figure(p.appearance, job, p.job),
        routeAt = (t, out) => castRoute(p, t, out)
      for (const t of [0, 0.49, 2.13, 5.7, 12.36, 23.88]) {
        const place = routeAt(t, {}),
          base = figurePlacement(p, place, new T.Matrix4())
        const state = {
          t,
          phase: p.phase,
          job,
          walking: !!(p.streetId || p.side),
          routeAt,
          scale: p.size,
          speed: p.pace,
          actor: p,
          base,
          loading: (0.5 + 0.5 * Math.sin(t * 0.9 + p.phase)) * (p.streetId ? place.pause : 1),
        }
        const g = update(c, state)
        for (const side of ['l', 'r'])
          if (g[side]) {
            const hand = grip
              .clone()
              .applyMatrix4(c.rig.bones[side + 'Hand'].matrixWorld)
              .applyMatrix4(base)
            assert.ok(
              hand.distanceTo(g[side].point.clone().applyMatrix4(base)) < 0.0016,
              p.appearance + ' misgrips ' + job + ' on route',
            )
          }
      }
    }
  }
})
test('each mallet actually touches a drum skin on its own beat and clears it during the rebound', () => {
  const ray = new T.Raycaster(),
    vn = new T.Vector3(),
    down = new T.Vector3(0, -1, 0)
  for (const record of cast.filter((p) => p.job === 'drum')) {
    const c = figure(record.appearance, record.job),
      ship = record.ship,
      meshes = ship.group.children.filter((o) => o.isMesh),
      period = posePeriod(c.profile, { job: 'drum' })
    for (let side = 0; side < 2; side++)
      for (const beat of [0, Math.PI]) {
        const t = (period * (2 * Math.PI + beat / 2 - (side * Math.PI) / 2 - record.phase)) / (2 * Math.PI)
        animate(ship, t)
        const base = figurePlacement(record, castRoute(record, t, {}), new T.Matrix4()),
          state = {
            t,
            phase: record.phase,
            job: record.job,
            walking: false,
            actor: record,
            base,
            scale: record.size,
          }
        const g = update(c, state),
          target = g.strikes[side].clone()
        c.equipment.group.updateMatrixWorld(true)
        ray.set(
          target.clone().addScaledVector(up, 0.018).applyMatrix4(base),
          down.clone().transformDirection(base),
        )
        ray.far = 0.03
        const skin = ray.intersectObjects(meshes, false)[0]
        assert.ok(skin && skin.object.material.name === 'pearl', 'grip references an empty drum position')
        const stick = c.equipment.group.children.filter((p) => p.name === '缠绳鼓槌')[side]
        let low = Infinity
        for (const mesh of stick.children) {
          const v = mesh.geometry.attributes.position
          for (let i = 0; i < v.count; i++) {
            vn.fromBufferAttribute(v, i).applyMatrix4(mesh.matrixWorld)
            low = Math.min(low, vn.y)
          }
        }
        const gap = low - target.y
        assert.ok(
          beat ? gap > 0.25 : gap > -0.0002 && gap < 0.0012,
          record.appearance + ' mallet clearance ' + gap,
        )
      }
  }
})
test('all seven moving hulls keep every occupied seat, deck and real sweep in the actor frame', () => {
  const ray = new T.Raycaster(),
    down = new T.Vector3(0, -1, 0)
  for (const p of cast.filter((p) => p.ship)) {
    const c = figure(p.appearance, p.job),
      ship = p.ship,
      spec = ship.spec,
      fixture = crewFixtures(spec)
    const mesh = ship.group.children.filter((o) => o.isMesh)
    for (let i = 0; i < 38; i++) {
      const t = (i * 4.08) / 37
      animate(ship, t)
      const base = figurePlacement(p, castRoute(p, t, {}), new T.Matrix4()),
        relative = ship.group.matrixWorld.clone().invert().multiply(base)
      const state = { t, phase: p.phase, job: p.job, walking: false, actor: p, base, scale: p.size }
      const g = update(c, state)
      assert.ok(
        c.equipment.group.children.every(
          (part) => !['榫合坐板', '架上的仪节鼓'].includes(part.name) || !part.visible,
        ),
        'duplicate boat fitting',
      )
      if (seated.has(p.job)) {
        const hip = new T.Vector3(0, g.seat, -0.025).applyMatrix4(relative)
        assert.ok(Math.abs(hip.y - fixture.seatY) < 0.001)
        const start = hip.clone().addScaledVector(up, 0.025).applyMatrix4(ship.group.matrixWorld)
        ray.set(start, down.clone().transformDirection(ship.group.matrixWorld))
        ray.far = 0.04
        const h = ray.intersectObjects(mesh, false)[0]
        assert.ok(h && Math.abs(h.distance - 0.025) < 0.0015, p.job + ' seat misses its board')
      }
      for (const side of ['l', 'r']) {
        const foot = g.feet[side].point.clone().applyMatrix4(relative),
          start = foot.clone().addScaledVector(up, 0.021).applyMatrix4(ship.group.matrixWorld)
        ray.set(start, down.clone().transformDirection(ship.group.matrixWorld))
        ray.far = 0.041
        const hit = ray.intersectObjects(mesh, false)[0]
        assert.ok(hit && Math.abs(hit.distance - 0.021) < 0.011, p.appearance + ' foot misses ship deck')
      }
      if (p.job === 'row') {
        for (const [hand, k] of [
          ['l', p.sweep.side < 0 ? 1 : 0],
          ['r', p.sweep.side < 0 ? 0 : 1],
        ]) {
          const shaft = sweepPoint(p.sweep, p.sweep.grips[k]).applyMatrix4(p.oar.pivot.matrixWorld)
          assert.ok(
            g[hand].point.clone().applyMatrix4(base).distanceTo(shaft) < 1e-7,
            'hands differ from the moving vessel oar',
          )
        }
      }
    }
  }
})
// Include the entire hanging cuff, even where its rest position reaches below
// the waist. Long hems and the underside of a seated coat may touch the seat.
function upperGarment(mesh, rig, height) {
  const input = mesh.geometry,
    { position, skinIndex, skinWeight } = input.attributes,
    indices = new Set(
      ['l', 'r'].flatMap((s) => ['Clavicle', 'UpperArm', 'Forearm', 'Hand'].map((k) => rig.index[s + k])),
    ),
    selected = new Uint8Array(position.count)
  for (let i = 0; i < position.count; i++) {
    let arm = 0
    for (let k = 0; k < 4; k++)
      if (indices.has(skinIndex.getComponent(i, k))) arm += skinWeight.getComponent(i, k)
    selected[i] = Number(arm > 0.05 || position.getY(i) > 0.98 * height)
  }
  const remap = new Map(),
    source = [],
    index = []
  for (let i = 0; i < input.index.count; i += 3) {
    const ids = [input.index.getX(i), input.index.getX(i + 1), input.index.getX(i + 2)]
    if (!ids.some((k) => selected[k])) continue
    for (const k of ids) {
      if (!remap.has(k)) {
        remap.set(k, source.length)
        source.push(k)
      }
      index.push(remap.get(k))
    }
  }
  if (!index.length) return null
  const geo = new T.BufferGeometry(),
    pos = new T.Float32BufferAttribute(new Float32Array(source.length * 3), 3)
  return {
    sourceMesh: mesh,
    source,
    positions: pos,
    geometry: geo.setAttribute('position', pos).setIndex(index),
  }
}

test('the crew’s posed heads, hair and every sleeve clear cabins, lanterns and the moving oar shafts', () => {
  const bounds = new T.Box3(),
    fixtureBounds = new T.Box3(),
    v = new T.Vector3(),
    partToWorld = new T.Matrix4(),
    mat = new T.Matrix4()
  for (const p of cast.filter((p) => p.ship)) {
    const c = createCharacter(characterProfile(p.appearance, p.job), p.job),
      parts = []
    c.rig.bones.head.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox()
        parts.push({ sourceMesh: o, geometry: o.geometry })
      }
    })
    c.group.traverse((o) => {
      if (o.isSkinnedMesh) {
        const sleeve = upperGarment(o, c.rig, c.profile.height)
        if (sleeve) parts.push(sleeve)
      }
    })
    const hull = []
    p.ship.group.traverseVisible((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox()
        hull.push(o)
      }
    })
    for (let i = 0; i < 8; i++) {
      const t = i * 0.57
      animate(p.ship, t)
      const base = figurePlacement(p, castRoute(p, t, {}), new T.Matrix4())
      c.update({ t, phase: p.phase, job: p.job, walking: false, actor: p, base, scale: p.size })
      c.group.updateMatrixWorld(true)
      c.rig.skeleton.update()
      for (const part of parts) {
        const mesh = part.sourceMesh
        if (part.source) {
          for (let j = 0; j < part.source.length; j++) {
            mesh.getVertexPosition(part.source[j], v)
            part.positions.setXYZ(j, v.x, v.y, v.z)
          }
          part.geometry.computeBoundingBox()
          tree(part).refit()
        }
        partToWorld.multiplyMatrices(base, mesh.matrixWorld)
        bounds.copy(part.geometry.boundingBox).applyMatrix4(partToWorld)
        for (const item of hull) {
          if (
            !bounds.intersectsBox(
              fixtureBounds.copy(item.geometry.boundingBox).applyMatrix4(item.matrixWorld),
            )
          )
            continue
          mat.copy(item.matrixWorld).invert().multiply(partToWorld)
          assert.equal(
            tree(item).bvhcast(tree(part), mat, { intersectsTriangles: (a, b) => a.intersectsTriangle(b) }),
            false,
            p.ship.spec.name +
              ' ' +
              p.appearance +
              ' ' +
              mesh.name +
              ' intersects ' +
              item.material.name +
              ' at ' +
              t,
          )
        }
      }
    }
    for (const part of parts) if (part.source) part.geometry.dispose()
    for (const part of parts) if (part.source) part.geometry.dispose()
    c.dispose()
  }
})
test('the working shafts clear the silk panels, handrails, rope rails and timber mounting plates', () => {
  const ray = new T.Raycaster(),
    a = new T.Vector3(),
    b = new T.Vector3(),
    off = new T.Vector3(),
    dir = new T.Vector3()
  for (const ship of ships) {
    const objects = ship.group.children.filter((o) => o.isMesh)
    for (let i = 0; i < 37; i++) {
      animate(ship, (i * 2 * Math.PI) / (37 * 1.73))
      for (const o of ship.oars)
        for (const [lo, hi] of [
          [0.12, 0.878],
          [-0.17, -1.53],
        ]) {
          sweepPoint(o.station, lo, a).applyMatrix4(o.pivot.matrixWorld)
          sweepPoint(o.station, hi, b).applyMatrix4(o.pivot.matrixWorld)
          dir.copy(b).sub(a).normalize()
          off.crossVectors(up, dir).normalize()
          ray.far = a.distanceTo(b)
          for (const edge of [-0.017, 0, 0.017]) {
            ray.set(a.clone().addScaledVector(off, edge), dir)
            assert.equal(
              ray.intersectObjects(objects, false).length,
              0,
              ship.spec.name + ' shaft catches a fixture at ' + i,
            )
          }
        }
    }
  }
})
test('every cupped wooden blade enters the water on its stroke and lifts free on recovery', () => {
  const v = new T.Vector3()
  for (const ship of ships) {
    const ranges = ship.oars.map(() => [Infinity, -Infinity])
    for (let i = 0; i < 62; i++) {
      animate(ship, (i * 2 * Math.PI) / (62 * 1.73))
      for (const [k, oar] of ship.oars.entries()) {
        let depth = Infinity
        for (const mesh of oar.pivot.children) {
          const p = mesh.geometry.attributes.position
          for (let j = 0; j < p.count; j++) {
            v.fromBufferAttribute(p, j).applyMatrix4(mesh.matrixWorld)
            depth = Math.min(depth, v.y)
          }
        }
        ranges[k][0] = Math.min(ranges[k][0], depth)
        ranges[k][1] = Math.max(ranges[k][1], depth)
      }
    }
    for (const [low, high] of ranges)
      assert.ok(low < -0.065 && high > 0.16, ship.spec.name + ' oar waterline range ' + [low, high])
  }
})
test('both dock workers lower their parcels against the existing loads without penetrating the carts', () => {
  for (const p of cast.filter((p) => p.job === 'porter')) {
    const c = figure(p.appearance, p.job),
      root = c.equipment.group,
      parcel = root.getObjectByName('双耳榫接篾筐'),
      rel = new T.Matrix4()
    for (let i = 0; i <= 42; i++) {
      const t = i * 0.13,
        load = i / 42,
        base = figurePlacement(p, castRoute(p, t, {}), new T.Matrix4())
      update(c, {
        t,
        phase: p.phase,
        job: p.job,
        walking: false,
        actor: p,
        base,
        scale: p.size,
        loading: load,
      })
      root.matrixAutoUpdate = false
      root.matrix.copy(base)
      root.updateMatrixWorld(true)
      for (const plank of parcel.children)
        for (const cart of quay) {
          rel.copy(cart.matrixWorld).invert().multiply(plank.matrixWorld)
          const cut = tree(cart).bvhcast(tree(plank), rel, {
            intersectsTriangles: (a, b) => a.intersectsTriangle(b),
          })
          assert.equal(cut, false, 'parcel penetrates cart at ' + load)
        }
      if (i === 42) {
        const point = parcel.localToWorld(new T.Vector3(0, -0.262, 0)),
          ray = new T.Raycaster(point, new T.Vector3(0, -1, 0), 0, 0.024)
        assert.ok(ray.intersectObjects(quay, false).length, 'cart does not support parcel at set-down')
      }
    }
  }
})

test('the pear-shaped soundbox, neck, fingerboard and frets each enclose their rendered volume', () => {
  const instrument = figure(9, 'lute').equipment.group.getObjectByName('螺钿四弦琵琶')
  for (const names of [
    ['桐木面板', '梨腹背板', '琴身侧沿与封口'],
    ['琵琶半圆木颈'],
    ['乌木指板'],
    ['指板上的竹相与象牙品'],
  ]) {
    const edges = new Map()
    for (const name of names) {
      const { attributes, index } = instrument.getObjectByName(name).children[0].geometry
      const positions = attributes.position,
        points = []
      for (let i = 0; i < positions.count; i++) {
        const vertex = [positions.getX(i), positions.getY(i), positions.getZ(i)]
        points.push(vertex.map((x) => Math.round(x * 1e7)).join(','))
      }
      for (let i = 0; i < index.count; i += 3)
        for (let k = 0; k < 3; k++) {
          const a = points[index.getX(i + k)],
            b = points[index.getX(i + ((k + 1) % 3))]
          const key = a < b ? a + '|' + b : b + '|' + a
          const record = edges.get(key) ?? { uses: 0, winding: 0 }
          record.uses++
          record.winding += a < b ? 1 : -1
          edges.set(key, record)
        }
    }
    for (const record of edges.values())
      assert.deepEqual(record, { uses: 2, winding: 0 }, names.join(' + ') + ' has an unpaired edge')
  }
})

test('the fretting index stays on the third string while her thumb supports the carved neck', () => {
  const profile = characterProfile(9, 'lute'),
    figure = createCharacter(profile, 'lute'),
    group = figure.group.getObjectByName('螺钿四弦琵琶'),
    neck = group.getObjectByName('琵琶半圆木颈').children[0],
    strings = group.getObjectByName('四根丝弦').children[0],
    hand = figure.group.getObjectByName('左手'),
    index = hand.userData.distalSkin[0],
    thumb = hand.userData.distalSkin[4],
    p = new T.Vector3(),
    relative = new T.Matrix4(),
    state = { job: 'lute', walking: false, phase: 0.43 },
    loop = posePeriod(profile, state),
    low = new T.Vector3(),
    high = new T.Vector3()
  function nearest(bounds, target, thirdString = false) {
    let min = Infinity
    for (let i = bounds[0]; i < bounds[1]; i++) {
      hand.getVertexPosition(i, p).applyMatrix4(relative)
      const hit = tree(target).closestPointToPoint(p)
      if (thirdString && (hit.point.x < 0.002 || hit.point.x > 0.005)) continue
      min = Math.min(min, hit.distance)
    }
    return min
  }
  try {
    let start
    for (let i = 0; i <= 22; i++) {
      state.t = (loop * i) / 22
      figure.update(state)
      figure.group.updateMatrixWorld(true)
      relative.copy(group.matrixWorld).invert().multiply(hand.matrixWorld)
      assert.ok(nearest(index, strings, true) < 0.0002, 'the index lost its stopped note')
      assert.ok(nearest(thumb, neck) < 0.0013, 'the left thumb lost the back of the neck')
      if (i === 0) {
        start = [...hand.morphTargetInfluences]
        low.copy(figure.rig.bones.lHand.getWorldPosition(p))
      } else if (i === 6) high.copy(figure.rig.bones.lHand.getWorldPosition(p))
      if (i === 22) {
        for (const [i, w] of hand.morphTargetInfluences.entries()) assert.ok(Math.abs(w - start[i]) < 1e-8)
      }
    }
    assert.ok(low.distanceTo(high) > 0.008, 'the fretting hand does not change position')
  } finally {
    figure.dispose()
  }
})

test('the lute clears both clothed arms and rests on the actual skirt, through an entire performance', () => {
  const musician = cast.find((record) => record.job === 'lute')
  assert.equal(musician.appearance, 9)
  const cases = [9, 1, 2, 7, 11, 13].map((id) => ({ id }))
  cases.push({ id: musician.appearance, record: musician })
  for (const { id, record } of cases) {
    const profile = characterProfile(id, 'lute'),
      figure = createCharacter(profile, 'lute'),
      scope = pipaVolumes(figure, true),
      state = {
        job: 'lute',
        walking: false,
        phase: record?.phase ?? profile.seed % 6.28,
        actor: record,
        scale: record?.size ?? 1,
        day: true,
      },
      period = posePeriod(profile, state),
      phases = Array.from({ length: 22 }, (_, i) => i / 22)
    // This is the close-up that originally showed fingertips protruding
    // from the soundboard, with the heel of the hand and wrist hidden inside.
    phases.push(0.63)
    try {
      for (const fraction of phases) {
        state.t = period * fraction
        if (record) {
          animate(record.ship, state.t)
          state.base = figurePlacement(record, castRoute(record, state.t, {}), new T.Matrix4())
          figure.group.matrixAutoUpdate = false
          figure.group.matrix.copy(state.base)
        }
        const { joints } = figure.update(state)
        if (profile.design === 'lute')
          assert.ok(
            joints.lForearm.y < joints.lUpperArm.y - 0.006,
            'her fretting elbow lifts above the shoulder',
          )
        const intersections = scope.sample()
        assert.deepEqual(
          intersections,
          [],
          profile.name + ' at ' + fraction + ' on ' + (record ? 'moving vessel' : 'studio bench'),
        )
        assert.ok(
          scope.touchesLapWhenLowered(0.0018),
          'unsupported bowl at ' + fraction + ' for ' + profile.name,
        )
        if (id !== 9 || record || fraction !== 0.63) continue
        const wrist = figure.rig.bones.rHand,
          elbow = figure.rig.bones.rForearm,
          aim = wrist.localToWorld(new T.Vector3(0, -0.067, 0.024)),
          dir = new T.Vector3(
            Math.sin(-0.46) * Math.cos(0.047),
            Math.sin(0.047),
            Math.cos(-0.46) * Math.cos(0.047),
          ),
          eye = aim.clone().addScaledVector(dir, 0.3 / 0.89),
          palm = wrist.localToWorld(new T.Vector3(...handGrip)),
          lowerArm = wrist
            .getWorldPosition(new T.Vector3())
            .lerp(elbow.getWorldPosition(new T.Vector3()), 0.36)
        assert.ok(scope.clearSightline(eye, palm), 'wood hides the palm in the original camera')
        assert.ok(scope.clearSightline(eye, lowerArm), 'wood hides the forearm in the original camera')
      }
      if (record) continue
      const strings = scope.instrument.getObjectByName('四根丝弦'),
        actual = new T.Vector3()
      for (let i = 0; i < 6; i++) {
        const phase = (i * Math.PI) / 3
        state.t = ((phase - state.phase) * period) / (2 * Math.PI)
        figure.update(state)
        figure.group.updateMatrixWorld(true)
        figure.rig.pickingContact(phase, actual).applyMatrix4(figure.rig.bones.rHand.matrixWorld)
        assert.ok(
          surfaceDistance(strings, actual) < 0.00025,
          'active fingertip misses the silk on stroke ' + i,
        )
      }
    } finally {
      scope.dispose()
      figure.dispose()
    }
  }
})
