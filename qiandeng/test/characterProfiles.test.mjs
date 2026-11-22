import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { characterProfile, characterVariant, studyCast } from '../src/characterProfiles.js'
import { harbourCast } from '../src/characterCast.js'
import { reachResidents } from '../src/reachPeople.js'
import { traffic } from '../src/fleetRoute.js'

test('the twelve studio sitters have real stable counterparts in the town', () => {
  const ships = traffic.map((spec) => ({ spec, group: new T.Group() }))
  const population = [...harbourCast(ships), ...reachResidents()]
  const byId = new Map(population.map((person) => [person.appearance, person]))
  assert.equal(byId.size, 89)
  assert.equal(new Set(studyCast.map((s) => s.name)).size, 12)
  const clothes = new Set(),
    hair = new Set()
  for (const sitter of studyCast) {
    const town = byId.get(sitter.id)
    assert.equal(town.job, sitter.job)
    const profile = characterProfile(town.appearance, town.job)
    assert.deepEqual(profile, characterProfile(sitter.id, sitter.job))
    assert.equal(profile.name, sitter.name)
    clothes.add(profile.garment)
    hair.add(profile.hair)
  }
  assert.equal(clothes.size, 6)
  assert.equal(hair.size, 6)
  const faces = population.map((p) => JSON.stringify(characterProfile(p.appearance, p.job).face))
  assert.equal(new Set(faces).size, population.length)
})

test('a pattern, hairstyle or jaw edit preserves the sitter and the original authored profile', () => {
  const a = characterProfile(47, 'umbrella')
  const b = characterVariant(a, { jaw: -0.9, hair: 'wrapped', garment: 'duan', pattern: 'cloud' })
  assert.equal(b.id, a.id)
  assert.equal(b.seed, a.seed)
  assert.equal(b.height, a.height)
  assert.equal(b.face.jaw, -0.9)
  assert.equal(b.pattern, 'cloud')
  assert.equal(b.garment, 'duan')
  assert.equal(b.hair, 'wrapped')
  assert.notEqual(b.face.width, a.face.width)
  assert.deepEqual(a, characterProfile(47, 'umbrella'))
  assert.deepEqual(characterVariant(a, {}), a)
})
