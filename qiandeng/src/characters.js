import * as T from 'three'
import { createHumanRig } from './humanRig.js'
import { poseHuman } from './humanPose.js'
import { buildPortrait } from './characterPortrait.js'
import { buildClothing } from './characterClothes.js'
import { buildExtremities } from './characterHands.js'
import { buildEquipment } from './characterEquipment.js'

// A studio sitter and a close pedestrian own the identical model. Neighbours
// can share an atlas or piece of geometry until the last of them leaves view.
const owners = new WeakMap()
function retain(resources) {
  for (const item of resources) owners.set(item, (owners.get(item) ?? 0) + 1)
  return () => {
    for (const item of resources) {
      const remaining = owners.get(item) - 1
      if (remaining) owners.set(item, remaining)
      else {
        owners.delete(item)
        item.dispose()
      }
    }
  }
}
function resourcesOf(group, materialsOnly = false) {
  const resources = new Set()
  group.traverse((mesh) => {
    if (!mesh.isMesh) return
    if (!materialsOnly) resources.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material)
      if (!materialsOnly)
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
  })
  return resources
}

export function createCharacter(profile, job = profile.job) {
  const rig = createHumanRig(profile),
    group = new T.Group()
  group.name = '人物·' + profile.name
  group.userData.personId = profile.id
  group.add(rig.root, buildClothing(profile, rig))
  const portrait = buildPortrait(profile)
  portrait.scale.multiplyScalar(profile.height)
  rig.bones.head.add(portrait)
  const extremities = buildExtremities(profile, rig, job)
  if (extremities?.group) group.add(extremities.group)
  const equipment = buildEquipment(profile, rig, job)
  group.add(equipment.group)
  const releaseSource = retain(resourcesOf(group))
  let releaseLighting,
    disposed = false
  function update(state) {
    const grips = equipment.update(state) ?? {}
    const pose = poseHuman(rig, profile, state, grips)
    extremities?.update?.(state, grips)
    portrait.userData.animate?.(state.t, state.phase, state)
    return pose
  }
  return {
    group,
    rig,
    profile,
    job,
    update,
    lamp: equipment.lamp,
    lightWith(shade) {
      if (!shade || releaseLighting) return
      shade(group)
      // These shader materials borrow the city's light fields and shadow maps.
      // The city owns those textures, even after all nearby people leave.
      releaseLighting = retain(resourcesOf(group, true))
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      releaseLighting?.()
      releaseSource()
      rig.skeleton.dispose()
    },
  }
}
