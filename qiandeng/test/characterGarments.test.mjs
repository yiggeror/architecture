import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { buildClothing } from '../src/characterClothes.js'
import { faceAnatomy } from '../src/characterFaceSurface.js'
import { characterProfile, characterVariant } from '../src/characterProfiles.js'
import { createCharacter } from '../src/characters.js'
import { createHumanRig } from '../src/humanRig.js'
import { poseHuman, posePeriod } from '../src/humanPose.js'

const sampleIds = [0, 9, 53, 47, 64, 55]
function fit(profile) {
  const rig = createHumanRig(profile),
    clothing = buildClothing(profile, rig),
    figurine = new T.Group()
  figurine.add(rig.root, clothing)
  figurine.updateMatrixWorld(true)
  return { rig, clothing, figurine }
}
function forSkinWeights(mesh, each) {
  const indices = mesh.geometry.getAttribute('skinIndex'),
    weights = mesh.geometry.getAttribute('skinWeight')
  for (let i = 0; i < indices.count; i++)
    each(
      i,
      [0, 1, 2, 3].map((k) => [indices.getComponent(i, k), weights.getComponent(i, k)])
    )
}

test('six distinct cut patterns bind to actual skeletons with normalized multi-joint sleeves, seat and legs', () => {
  const silhouettes = new Set(),
    swatches = new Set(),
    draws = new Set()
  for (const id of sampleIds) {
    const source = characterProfile(id)
    // The six catalogue cuts are also worn by residents without a named commission.
    const profile = { ...source, id: 1000 + id, design: undefined },
      { rig, clothing } = fit(profile),
      blends = new Set()
    const bones = Object.fromEntries(Object.entries(rig.index).map(([name, i]) => [i, name]))
    let triangles = 0
    for (const mesh of clothing.children) {
      assert(mesh.isSkinnedMesh && mesh.material.isMeshStandardMaterial && mesh.material.vertexColors)
      assert.equal(mesh.skeleton, rig.skeleton)
      const geom = mesh.geometry,
        pos = geom.getAttribute('position'),
        norm = geom.getAttribute('normal')
      for (const attribute of ['uv', 'skinIndex', 'skinWeight', 'normal', 'color'])
        assert.equal(geom.getAttribute(attribute).count, pos.count)
      assert(pos.array.every(Number.isFinite))
      assert(norm.array.every(Number.isFinite))
      assert(geom.getAttribute('uv').array.every(Number.isFinite))
      forSkinWeights(mesh, (i, influences) => {
        assert(Math.abs(influences.reduce((sum, [, weight]) => sum + weight, 0) - 1) < 1e-5)
        const changing = influences.filter(([, w]) => w > 0.085).map(([index]) => bones[index])
        for (const side of ['l', 'r']) {
          for (const [base, outer] of [
            ['UpperArm', 'Forearm'],
            ['Thigh', 'Shin'],
            ['Forearm', 'Hand'],
          ]) {
            if (changing.includes(side + base) && changing.includes(side + outer)) blends.add(side + base)
          }
        }
      })
      if (mesh.material.normalMap) {
        const tangent = geom.getAttribute('tangent')
        assert.equal(tangent.count, pos.count)
        const t = new T.Vector3(),
          n = new T.Vector3()
        for (let i = 0; i < tangent.count; i++) {
          t.fromBufferAttribute(tangent, i)
          n.fromBufferAttribute(norm, i)
          assert(Math.abs(t.lengthSq() - 1) < 0.00001)
          assert(Math.abs(n.lengthSq() - 1) < 0.00001)
          assert(Math.abs(n.dot(t)) < 0.00001)
          assert.equal(Math.abs(tangent.getW(i)), 1)
        }
      }
      triangles += geom.index.count / 3
      if (mesh.material.map) swatches.add(mesh.material.map)
    }
    assert.equal(blends.size, 6)
    draws.add(clothing.children.length)
    silhouettes.add(triangles)
    assert(triangles > 6500 && triangles < 19000)
    assert.equal(clothing.userData.garment, profile.garment)
  }
  assert.equal(silhouettes.size, 6)
  assert.deepEqual([...draws], [3])
  assert.equal(swatches.size, 1)
})

test('the same citizen can try four woven patterns without changing the pattern pieces or the skeleton', () => {
  const original = characterProfile(47),
    seen = new Set()
  const vanilla = fit(original).clothing
  for (const pattern of ['plain', 'reed', 'cloud', 'plum']) {
    const { clothing } = fit(characterVariant(original, { pattern }))
    const patterned = clothing.children[1].geometry
    seen.add(patterned.getAttribute('uv').array.join(','))
    for (const [i, mesh] of clothing.children.entries()) {
      assert.deepEqual(
        mesh.geometry.getAttribute('position').array,
        vanilla.children[i].geometry.getAttribute('position').array
      )
      assert.deepEqual(
        mesh.geometry.getAttribute('skinWeight').array,
        vanilla.children[i].geometry.getAttribute('skinWeight').array
      )
    }
  }
  assert.equal(seen.size, 4)
})

test('height variation scales every sleeve, collar and ankle once', () => {
  const base = characterProfile(64),
    short = fit({ ...base, height: 0.9 }),
    high = fit({ ...base, height: 1.1 }),
    ratio = 1.1 / 0.9
  for (const [i, mesh] of short.clothing.children.entries()) {
    const a = mesh.geometry.getAttribute('position').array,
      b = high.clothing.children[i].geometry.getAttribute('position').array
    for (let v = 0; v < a.length; v++) assert(Math.abs(a[v] * ratio - b[v]) < 0.00001)
  }
})

test('neck ends inside the jaw and visible wrist skin remains connected to the hand during a whole work cycle', () => {
  const point = new T.Vector3(),
    goal = new T.Vector3()
  for (const id of [0, 9, 47, 64, 36, 4]) {
    const profile = characterProfile(id),
      { rig, clothing, figurine } = fit(profile)
    const skin = clothing.children.at(-1),
      position = skin.geometry.getAttribute('position')
    const tips = { l: [], r: [] }
    forSkinWeights(skin, (i, influences) => {
      for (const side of ['l', 'r'])
        if (influences.some(([n, w]) => n === rig.index[side + 'Hand'] && w > 0.97)) tips[side].push(i)
    })
    for (const side of ['l', 'r']) assert(tips[side].length >= 12)
    let highest = -Infinity
    for (let i = 0; i < position.count; i++) highest = Math.max(highest, position.getY(i))
    const head = faceAnatomy(profile)
    const level = (highest - rig.rest.head[1]) / profile.height
    const section = head.dimensions(level)
    assert(level > 0.055 && level < 0.1)
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < highest - 0.00001) continue
      const x = position.getX(i) / profile.height
      const z = (position.getZ(i) - rig.rest.head[2]) / profile.height
      const azimuth = Math.PI - Math.asin(x / section[0])
      assert(
        z > head.point(azimuth, level)[2] + 0.001 && z < head.front(x, level) - 0.001,
        'the top edge of the nape must finish inside the sculpted skull'
      )
    }
    for (const t of [0, 0.42, 0.89, 1.36, 1.97, 2.45]) {
      poseHuman(
        rig,
        profile,
        { job: profile.job, walking: profile.job === 'walk', t, phase: 0.24, loading: 0.86, scale: 1 },
        {}
      )
      figurine.updateMatrixWorld(true)
      for (const side of ['l', 'r']) {
        rig.bones[side + 'Hand'].getWorldPosition(goal)
        const ring = tips[side].map((i) => skin.getVertexPosition(i, point).distanceTo(goal))
        assert(Math.max(...ring) < 0.038 * profile.height)
        assert(Math.min(...ring) > 0.009 * profile.height)
      }
      for (const mesh of clothing.children) {
        const geo = mesh.geometry,
          vertex = new T.Vector3()
        for (let i = 0; i < geo.getAttribute('position').count; i += 19) {
          mesh.getVertexPosition(i, vertex)
          assert(Number.isFinite(vertex.lengthSq()) && vertex.length() < 2.25 * profile.height)
        }
      }
    }
  }
})

test('all six fittings clear the floor in the seated lute and crouched porter poses; lifted fretting wrists clear the cuff', () => {
  const sample = new T.Vector3(),
    wrist = new T.Vector3()
  for (const id of [9, 36]) {
    const original = characterProfile(id)
    for (const garment of ['duan', 'beizi', 'yuanling', 'aoqun', 'changshan', 'banbi']) {
      const profile = characterVariant(original, { garment }),
        { rig, clothing, figurine } = fit(profile)
      if (id === 9) {
        wrist.fromArray(rig.rest.lHand)
        let gap = Infinity
        for (const mesh of clothing.children.filter((m) => m.material.map)) {
          const position = mesh.geometry.getAttribute('position')
          forSkinWeights(mesh, (i, w) => {
            if (w.some(([index, value]) => index === rig.index.lForearm && value > 0.7))
              gap = Math.min(gap, sample.fromBufferAttribute(position, i).distanceTo(wrist))
          })
        }
        // The musician gathers the left sleeve above the curled fretting hand.
        assert(Number.isFinite(gap) && gap > 0.063 * profile.height)
      }
      for (const t of [0, 0.81, 1.46]) {
        poseHuman(
          rig,
          profile,
          { job: profile.job, walking: false, t, phase: 0.22, loading: 1, scale: 1 },
          {}
        )
        figurine.updateMatrixWorld(true)
        for (const mesh of clothing.children) {
          const count = mesh.geometry.getAttribute('position').count
          for (let i = 0; i < count; i += 7) {
            mesh.getVertexPosition(i, sample)
            assert(sample.y > 0.009 && Number.isFinite(sample.lengthSq()))
          }
        }
      }
    }
  }
})

test('four named commissions have independently cut shells and one shared polychrome textile atlas', () => {
  const colours = new Set(),
    threads = new Set(),
    renders = new Set(),
    statures = new Set()
  for (const [id, key] of [
    [47, 'silk'],
    [9, 'lute'],
    [64, 'scholar'],
    [4, 'drummer'],
  ]) {
    const profile = characterProfile(id),
      { clothing } = fit(profile)
    assert.equal(clothing.userData.costume, key)
    assert.equal(clothing.children.length, 4)
    const embroidery = clothing.children.find((m) => m.material.name === '分裁织锦与绣线')
    assert(embroidery?.isSkinnedMesh)
    colours.add(embroidery.material.map)
    const geo = embroidery.geometry
    threads.add(embroidery.material.normalMap)
    const frame = geo.getAttribute('tangent'),
      normal = geo.getAttribute('normal'),
      v = new T.Vector3(),
      n = new T.Vector3()
    assert(embroidery.material.normalMap?.isDataTexture)
    assert.equal(frame.count, normal.count)
    for (let i = 0; i < frame.count; i++) {
      v.fromBufferAttribute(frame, i)
      n.fromBufferAttribute(normal, i)
      assert(
        Math.abs(v.lengthSq() - 1) < 0.00001 &&
          Math.abs(v.dot(n)) < 0.00001 &&
          Math.abs(frame.getW(i)) === 1
      )
    }
    for (const child of clothing.children)
      assert(child.geometry.attributes.color.array.every((c) => c >= 0 && c <= 1))
    assert(geo.index.count / 3 > 6500)
    assert(clothing.children.reduce((n, m) => n + m.geometry.index.count / 3, 0) <= 32500)
    const pos = geo.getAttribute('position')
    let hem = 10,
      shoulder = 0
    for (let i = 0; i < pos.count; i++) {
      hem = Math.min(hem, pos.getY(i))
      if (pos.getY(i) > profile.height * 1.22) shoulder = Math.max(shoulder, Math.abs(pos.getX(i)))
    }
    statures.add((hem / profile.height).toFixed(2) + '/' + (shoulder / profile.height).toFixed(2))
    renders.add(geo.index.count)
    const trial = characterVariant(profile, { garment: profile.garment === 'duan' ? 'aoqun' : 'duan' })
    const ordinary = fit(trial).clothing
    assert.equal(ordinary.children.length, 3)
    assert.equal(ordinary.userData.costume, undefined)
  }
  assert.equal(colours.size, 1)
  assert.equal(threads.size, 1)
  assert.equal(renders.size, 4)
  assert.equal(statures.size, 4)
})

test('the merchant’s standing collar and the player’s low wrapped collar clear their actual animated jaws', () => {
  const point = new T.Vector3(),
    relative = new T.Matrix4(),
    tops = []
  for (const id of [47, 9]) {
    const profile = characterProfile(id),
      actor = createCharacter(profile, profile.job)
    const face = actor.group.getObjectByName('面骨、五官与耳廓'),
      faceTree = new MeshBVH(face.geometry, { indirect: true })
    const clothing = actor.group.children.find((o) => o.userData.garment)
    const fabric = []
    let highest = 0
    for (const mesh of clothing.children) {
      if (mesh.material.userData.skin) continue
      const geometry = mesh.geometry,
        p = geometry.attributes.position,
        source = [],
        indices = [],
        lookup = new Map()
      for (let k = 0; k < geometry.index.count; k += 3) {
        const triangle = [0, 1, 2].map((j) => geometry.index.getX(k + j))
        if (
          !triangle.some(
            (i) => p.getY(i) > 1.368 * profile.height && Math.abs(p.getX(i)) < 0.125 * profile.height
          )
        )
          continue
        for (const i of triangle) {
          if (!lookup.has(i)) {
            lookup.set(i, source.length)
            source.push(i)
            highest = Math.max(highest, p.getY(i) / profile.height)
          }
          indices.push(lookup.get(i))
        }
      }
      if (!indices.length) continue
      const local = new T.BufferGeometry(),
        posed = new T.BufferAttribute(new Float32Array(3 * source.length), 3)
      local.setIndex(indices)
      local.setAttribute('position', posed)
      fabric.push({ mesh, local, source, posed })
    }
    try {
      tops.push(highest)
      const state = {
        job: profile.job,
        walking: profile.job === 'umbrella',
        loading: 1,
        scale: 1,
        phase: 0.18,
      }
      const period = posePeriod(profile, state)
      for (let j = 0; j < 12; j++) {
        actor.update({ ...state, t: (period * j) / 12 })
        actor.group.updateMatrixWorld(true)
        actor.rig.skeleton.update()
        for (const { mesh, local, source, posed } of fabric) {
          for (const [k, i] of source.entries()) {
            mesh.getVertexPosition(i, point)
            posed.setXYZ(k, point.x, point.y, point.z)
          }
          local.computeBoundingBox()
          if (local.boundsTree) local.boundsTree.refit()
          else local.boundsTree = new MeshBVH(local, { indirect: true })
          relative.copy(face.matrixWorld).invert().multiply(mesh.matrixWorld)
          assert.equal(
            faceTree.bvhcast(local.boundsTree, relative, {
              intersectsTriangles: (a, b) => a.intersectsTriangle(b),
            }),
            false
          )
        }
      }
    } finally {
      actor.dispose()
      for (const { local } of fabric) local.dispose()
    }
  }
  assert(tops[0] > 1.439 && tops[1] > 1.408 && tops[0] - tops[1] > 0.013)
})
