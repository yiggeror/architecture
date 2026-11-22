import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { characterProfile, studyCast } from '../src/characterProfiles.js'
import { buildPortrait, portraitLandmarks, portraitMouth } from '../src/characterPortrait.js'
import { faceAnatomy } from '../src/characterFaceSurface.js'

test('all study sitters have measured facial landmarks, a surfaced mouth and complete finite head buffers', () => {
  const forms = new Set(),
    breadths = [],
    nasal = [],
    jaws = []
  for (const sitter of studyCast) {
    const p = characterProfile(sitter.id, sitter.job),
      g = buildPortrait(p),
      m = portraitLandmarks(p)
    const mm = (a, b) => 1000 * m[a].distanceTo(m[b])
    forms.add(p.hair)
    breadths.push(mm('zygionL', 'zygionR'))
    nasal.push(mm('alareL', 'alareR'))
    jaws.push(mm('gonionL', 'gonionR'))
    const aperture = Math.abs(m.exocanthionL.x - m.endocanthionL.x)
    const gap = m.endocanthionL.x - m.endocanthionR.x
    assert.ok(gap / aperture > 0.96 && gap / aperture < 1.16, p.name)
    if (p.id === 47 || p.id === 9) {
      const orbit = faceAnatomy(p).orbit(1, 0)
      assert.ok(gap > 0.028 && gap < 0.032 && aperture > 0.03 && aperture < 0.034, p.name)
      assert.ok(orbit.top - orbit.bottom > 0.0088 && orbit.top - orbit.bottom < 0.0106, p.name)
    }
    assert.ok(mm('nasion', 'gnathion') > 98 && mm('nasion', 'gnathion') < 125, p.name)
    assert.ok(m.pronasale.z - m.subnasale.z > 0.011 && m.pronasale.z - m.subnasale.z < 0.024, p.name)
    const mouth = portraitMouth(p)
    assert.ok(mouth.z >= m.stomion.z && mouth.z < m.pronasale.z, p.name)
    assert.ok(g.children.length <= 7)
    const tear = g.getObjectByName('泪膜与透明角膜'),
      iris = g.getObjectByName('虹膜、瞳孔与角膜高光')
    assert.ok(tear.material.transparent && tear.material.ior > 1.35 && tear.material.ior < 1.4)
    assert.equal(tear.morphTargetInfluences, iris.morphTargetInfluences)
    for (const mesh of g.children) {
      const a = mesh.geometry.attributes
      assert.ok(a.position.count === a.uv.count && a.normal.count === a.uv.count)
      assert.ok(mesh.geometry.boundingSphere.radius > 0)
      if (mesh.material.userData.skin) {
        const t = new T.Vector3(),
          n = new T.Vector3(),
          target = mesh.geometry.morphAttributes.normal?.[0]
        for (let i = 0; i < a.tangent.count; i++) {
          t.fromBufferAttribute(a.tangent, i)
          n.fromBufferAttribute(a.normal, i)
          assert.ok(Math.abs(t.length() - 1) < 0.00002 && Math.abs(t.dot(n)) < 0.00015)
          assert.ok(Math.abs(a.tangent.getW(i)) === 1)
          if (target) assert.ok(Math.abs(t.dot(n.fromBufferAttribute(target, i))) < 0.0002)
        }
      }
      for (const attr of [a.position, a.normal, a.uv, ...(mesh.geometry.morphAttributes.position ?? [])]) {
        assert.ok(attr.array.every(Number.isFinite), p.name + ' ' + mesh.name)
      }
    }
  }
  assert.equal(forms.size, 6)
  assert.ok(Math.max(...breadths) - Math.min(...breadths) > 12)
  assert.ok(Math.max(...nasal) - Math.min(...nasal) > 5)
  assert.ok(Math.max(...jaws) - Math.min(...jaws) > 11)
})

test('both real eyelids cover each moving iris at closure and open again', () => {
  const ray = new T.Raycaster(),
    eye = new T.Vector3(),
    forward = new T.Vector3(0, 0, -1)
  for (const id of [47, 9, 64, 4, 0, 53]) {
    const p = characterProfile(id),
      a = faceAnatomy(p),
      g = buildPortrait(p)
    const iris = g.getObjectByName('虹膜、瞳孔与角膜高光'),
      lids = g.getObjectByName('上下眼睑'),
      coat = g.getObjectByName('泪膜与透明角膜')
    assert.equal(lids.morphTargetDictionary['闭眼'], 0)
    g.updateMatrixWorld()
    for (const s of [-1, 1]) {
      for (const dx of [-0.65, 0, 0.52])
        for (const dy of [0.2, 0.49, 0.78]) {
          const o = a.orbit(s, dx * 0.48),
            y = T.MathUtils.lerp(o.bottom, o.top, dy)
          ray.set(eye.set(o.x, y, 0.25), forward)
          lids.morphTargetInfluences[0] = 1
          const closed = ray.intersectObjects([lids, iris, coat])[0]
          assert.ok(closed?.object === lids, p.name + ' ' + s + ' ' + dx + ' ' + dy)
        }
      const o = a.orbit(s, 0)
      lids.morphTargetInfluences[0] = 0
      ray.set(eye.set(o.x, o.y, 0.25), forward)
      assert.equal(ray.intersectObjects([lids, iris])[0].object, iris)
    }
    // At the upper crease the iris and its transparent cover used to
    // break through the tarsal plate several millimetres above the rim.
    for (const weights of [
      [0, 0, 0, 0],
      [0.75, 0, 0.68, 0],
      [0, 0.7, 0.72, 0],
    ]) {
      weights.forEach((w, i) => {
        iris.morphTargetInfluences[i] = w
      })
      for (const s of [-1, 1])
        for (const u of [-0.27, -0.12, 0, 0.16, 0.29]) {
          const o = a.orbit(s, u)
          for (const dy of [0.0013, 0.0027, 0.0041, 0.0052]) {
            ray.set(eye.set(o.x, o.top + dy, 0.25), forward)
            const hit = ray.intersectObjects([lids, iris, coat])[0]
            assert.equal(hit?.object, lids, p.name + ' iris occlusion ' + s + ' ' + u + ' ' + dy)
          }
        }
    }
    g.userData.animate(0, 0.3, { job: 'lute' })
    const down = iris.morphTargetInfluences.slice()
    g.userData.animate(0, 0.3, { job: 'watch' })
    assert.ok(down[3] > iris.morphTargetInfluences[3] + 0.2)
    g.userData.animate(6.3, 0.3, { job: 'watch' })
    assert.notDeepEqual(iris.morphTargetInfluences, down)
    assert.equal(lids.material.userData.skin, true)
    assert.equal(iris.material.userData.skin, undefined)
  }
})

test('each original craniofacial family retains a different unpainted sagittal and mandibular section', () => {
  const p = characterProfile(47),
    neutral = Object.fromEntries(Object.keys(p.face).map((k) => [k, 0]))
  const models = Object.fromEntries(
    ['silk', 'lute', 'scholar', 'drummer', 'boatman', 'market'].map((family) => {
      const head = faceAnatomy({
        ...p,
        age: 32,
        face: neutral,
        faceFamily: family,
        design: 'silk',
        portraitInk: undefined,
      })
      return [family, head]
    })
  )
  const sections = Object.values(models).map((a) =>
    [0.018, 0.043, 0.094, 0.151].flatMap((y) => a.dimensions(y)).join(',')
  )
  assert.equal(new Set(sections).size, 6)
  assert.ok(models.drummer.dimensions(0.043)[0] - models.lute.dimensions(0.043)[0] > 0.009)
  assert.ok(models.scholar.dimensions(0.016)[1] - models.lute.dimensions(0.016)[1] > 0.007)
  assert.ok(models.boatman.dimensions(0.151)[3] < models.silk.dimensions(0.151)[3] - 0.01)
  const silk = models.silk.orbit(1, 0),
    scholar = models.scholar.orbit(1, 0)
  assert.ok(silk.top - silk.bottom > scholar.top - scholar.bottom + 0.0013)
  const seen = new Set()
  for (let id = 0; id < 89; id++) {
    const profile = characterProfile(id),
      a = faceAnatomy(profile)
    assert.equal(a.family, profile.faceFamily)
    seen.add(a.family)
    const eye = a.orbit(1, 0)
    assert.ok(eye.top > eye.bottom && a.front(0, a.noseY + 0.005) > a.front(0, a.mouthY))
  }
  assert.equal(seen.size, 6)
})

test('each lip commissure blends into the cheek without a hard reverse ridge', () => {
  for (const id of [47, 9, 64, 4, 0, 38]) {
    const a = faceAnatomy(characterProfile(id))
    for (const s of [-1, 1]) {
      const y = a.lip(s * a.mw).seam
      for (const d of [0, 0.001, -0.001]) {
        const x = s * a.mw * 1.12
        const step = Math.abs(a.front(x + 0.000002, y + d) - a.front(x - 0.000002, y + d))
        assert.ok(step < 0.000025, 'continuous corner ' + id + ' ' + s)
        const shoulder = (a.front(x - 0.0024, y + d) + a.front(x + 0.0024, y + d)) * 0.5
        assert.ok(Math.abs(a.front(x, y + d) - shoulder) < 0.00024, 'corner tangent ' + id + ' ' + s)
      }
    }
  }
})
