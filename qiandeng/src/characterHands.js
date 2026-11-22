import * as T from 'three'
import { sculptHand } from './characterHandAnatomy.js'
import { joinWrists } from './characterHandWrist.js'
import { shoes } from './characterFootwear.js'

export function buildExtremities(profile, rig, job) {
  const group = new T.Group()
  group.name = '鞋履'
  const hands = ['l', 'r'].map((side) => {
    const hand = sculptHand(profile, side, job, !!rig.forearmSkin)
    rig.bones[side + 'Hand'].add(hand.mesh)
    if (hand.pickingContact) rig.pickingContact = hand.pickingContact
    return hand
  })
  joinWrists(rig, [['l', hands[0]], ['r', hands[1]]])
  group.add(shoes(profile, rig, job))
  const playing = hands.filter((hand) => hand.update)
  return {
    group,
    update(state) {
      for (const hand of playing) hand.update(state)
    },
  }
}
