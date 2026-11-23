import * as T from 'three'
import { sculptHand, handMotion } from './characterHandAnatomy.js'
import { joinWrists } from './characterHandWrist.js'
import { shoes } from './characterFootwear.js'

export function buildExtremityArt(profile, rig, job) {
  const hands = ['l', 'r'].map((side) => [side, sculptHand(profile, side, job, !!rig.forearmSkin)])
  joinWrists(rig, hands)
  const group = new T.Group()
  group.name = '鞋履'
  group.add(shoes(profile, rig, job))
  return { group, hands: hands.map(([side, hand]) => [side, hand.mesh]) }
}

export function buildExtremities(profile, rig, job, art = buildExtremityArt(profile, rig, job)) {
  const motions = []
  for (const [side, mesh] of art.hands) {
    rig.bones[side + 'Hand'].add(mesh)
    const hand = handMotion(mesh, profile, side, job)
    if (hand.pickingContact) rig.pickingContact = hand.pickingContact
    if (hand.update) motions.push(hand.update)
  }
  return {
    group: art.group,
    update(state) {
      for (const move of motions) move(state)
    },
  }
}
