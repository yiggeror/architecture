import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { buildCharacterArt, createCharacter } from '../src/characters.js'
import { packFigureArt, unpackFigureArt } from '../src/figureTransfer.js'
import { characterProfile } from '../src/characterProfiles.js'

test('a transferred musician plays the same notes with the same mesh, skin and instrument', () => {
  const profile = characterProfile(9, 'lute'), job = 'lute'
  const standard = createCharacter(profile, job)
  const art = buildCharacterArt(profile, job)
  const { packet, transfers } = packFigureArt(art, new Set())
  const copy = structuredClone(packet, { transfer: transfers })
  const received = createCharacter(profile, job, unpackFigureArt(copy, new Map()))
  const meshes = (figure) => {
    const found = []
    figure.group.traverse((node) => { if (node.isMesh) found.push(node) })
    return found
  }
  const original = meshes(standard), restored = meshes(received)
  assert.deepEqual(restored.map((m) => m.name), original.map((m) => m.name))
  for (const [i, mesh] of original.entries()) {
    const actual = restored[i]
    assert.deepEqual(actual.geometry.index?.array, mesh.geometry.index?.array)
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes))
      assert.deepEqual(actual.geometry.attributes[name].array, attribute.array)
    for (const [name, morphs] of Object.entries(mesh.geometry.morphAttributes))
      for (const [j, morph] of morphs.entries()) {
        assert.equal(actual.geometry.morphAttributes[name][j].name, morph.name)
        assert.deepEqual(actual.geometry.morphAttributes[name][j].array, morph.array)
      }
    assert.equal(actual.material.name, mesh.material.name)
    assert.equal(actual.material.normalMap?.image.width, mesh.material.normalMap?.image.width)
  }
  for (const t of [0.42, 1.18]) {
    for (const f of [standard, received]) {
      f.update({ t, phase: 0.47, job })
      f.group.updateMatrixWorld(true)
    }
    for (const [i, mesh] of original.entries()) {
      assert.deepEqual(restored[i].morphTargetInfluences, mesh.morphTargetInfluences)
      for (let k = 0; k < 16; k++)
        assert.ok(Math.abs(restored[i].matrixWorld.elements[k] - mesh.matrixWorld.elements[k]) < 1e-9, mesh.name)
    }
  }
  standard.dispose()
  received.dispose()
})

test('two worker requests share one resident texture while transferring independent mesh buffers', () => {
  const bytes = new Uint8Array([17, 83, 114, 255])
  const dye = new T.DataTexture(bytes, 1, 1)
  const material = new T.MeshStandardMaterial({ map: dye })
  const cache = new Map()
  function request() {
    const mesh = new T.Mesh(new T.PlaneGeometry(), material)
    const { packet, transfers } = packFigureArt({ mesh }, new Set(cache.keys()))
    const sent = Object.keys(packet.pixels).length
    const received = unpackFigureArt(structuredClone(packet, { transfer: transfers }), cache)
    assert.equal(mesh.geometry.attributes.position.array.byteLength, 0)
    return { sent, mesh: received.mesh }
  }
  const first = request(), second = request()
  assert.equal(first.sent, 1)
  assert.equal(second.sent, 0)
  assert.equal(first.mesh.material.map, second.mesh.material.map)
  assert.deepEqual(second.mesh.material.map.image.data, bytes)
  assert.notEqual(first.mesh.geometry, second.mesh.geometry)
})
