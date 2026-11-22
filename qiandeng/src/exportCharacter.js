import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createCharacter } from './characters.js'
import { posePeriod } from './humanPose.js'

// Bake the solved joints, cloth corrections, prop pivots and expression
// weights together. The engine loading the GLB does not have to run our IK.
function bakeAction(figure, state, startTime) {
  const duration = posePeriod(figure.profile, state)
  const frames = Math.ceil(duration * 24)
  const times = new Float32Array(frames + 1)
  const channels = []
  function channel(node, key, size, type) {
    channels.push({ node, key, size, type, values: new Float32Array(times.length * size) })
  }
  figure.group.traverse((node) => {
    channel(node, 'position', 3, T.VectorKeyframeTrack)
    channel(node, 'quaternion', 4, T.QuaternionKeyframeTrack)
    channel(node, 'scale', 3, T.VectorKeyframeTrack)
    if (node.morphTargetInfluences?.length)
      channel(node, 'morphTargetInfluences', node.morphTargetInfluences.length, T.NumberKeyframeTrack)
  })
  function pose(t) {
    state.t = startTime + t
    if (state.job === 'porter')
      state.loading = 0.5 - 0.5 * Math.cos(state.phase + (2 * Math.PI * state.t) / duration)
    figure.update(state)
    figure.group.updateMatrixWorld(true)
  }
  for (let frame = 0; frame <= frames; frame++) {
    times[frame] = (frame * duration) / frames
    pose(frame === frames ? 0 : times[frame])
    for (const { node, key, size, values } of channels) {
      const offset = frame * size
      if (key === 'morphTargetInfluences') values.set(node[key], offset)
      else node[key].toArray(values, offset)
      if (key === 'quaternion' && frame > 0) {
        let dot = 0
        for (let i = 0; i < 4; i++) dot += values[offset + i] * values[offset - 4 + i]
        if (dot < 0) for (let i = 0; i < 4; i++) values[offset + i] *= -1
      }
    }
    // A glance or blink has its own rhythm. Cross-fade the expression into
    // the preceding part of the starting instant, preserving its seam velocity.
    const fraction = frame / frames
    if (fraction > 0.82 && frame < frames) {
      pose(times[frame] - duration)
      const blend = T.MathUtils.smoothstep(fraction, 0.82, 1)
      for (const { node, key, size, values } of channels) {
        if (key !== 'morphTargetInfluences') continue
        for (let i = 0; i < size; i++) {
          const index = frame * size + i
          values[index] = T.MathUtils.lerp(values[index], node[key][i], blend)
        }
      }
    }
  }
  const tracks = []
  for (const { node, key, size, type, values } of channels) {
    if (values.some((value, i) => Math.abs(value - values[i % size]) > 0.000001))
      tracks.push(new type(node.uuid + '.' + key, times, values).optimize())
  }
  return new T.AnimationClip(figure.profile.name + ' · ' + state.job, duration, tracks)
}

export async function exportCharacterGLB(profile, job = profile.job, options = {}) {
  const figure = createCharacter(profile, job)
  const exportMaterials = []
  try {
    const state = {
      t: 0,
      phase: options.phase ?? profile.seed % (2 * Math.PI),
      scale: options.scale ?? 1,
      speed: 0.78,
      walking: options.walking ?? job === 'walk',
      day: options.day ?? true,
      job,
    }
    const action = bakeAction(figure, state, options.startTime ?? 0)
    // A glTF weights key contains every target on its mesh. The standalone
    // blink closes only the named lids, with every other expression at rest.
    const eyelids = figure.group.getObjectByName('上下眼睑')
    const blinkTimes = [0, 0.032, 0.068, 0.087, 0.105, 0.142, 0.185, 0.23]
    const closure = [0, 0.19, 0.82, 1, 0.97, 0.61, 0.16, 0]
    const count = eyelids.morphTargetInfluences.length
    const blinkIndex = eyelids.morphTargetDictionary['闭眼']
    const weights = new Float32Array(blinkTimes.length * count)
    for (const [i, amount] of closure.entries()) weights[i * count + blinkIndex] = amount
    const blink = new T.AnimationClip('眨眼', 0.23, [
      new T.NumberKeyframeTrack(eyelids.uuid + '.morphTargetInfluences', blinkTimes, weights),
    ])
    const scene = new T.Scene()
    scene.name = profile.name
    scene.add(figure.group)
    // glTF skin transforms are driven by the joint hierarchy. Keep the
    // bound geometry at scene root so an importer never applies its parent twice.
    const bound = []
    figure.group.traverse((node) => {
      if (node.isSkinnedMesh) bound.push(node)
      const source = node.material
      if (source?.roughnessMap?.isDataTexture && !source.metalnessMap && source.metalness === 0) {
        // glTF stores G roughness and B metalness together. On a dielectric
        // the metalness factor is already zero, so the original bytes suffice.
        const material = source.clone()
        material.metalnessMap = source.roughnessMap
        node.material = material
        exportMaterials.push(material)
      }
    })
    for (const mesh of bound) scene.attach(mesh)
    const exporter = new GLTFExporter()
    try {
      return await exporter.parseAsync(scene, { binary: true, animations: [action, blink], trs: true })
    } finally {
      for (const mesh of bound) figure.group.add(mesh)
    }
  } finally {
    for (const material of exportMaterials) material.dispose()
    figure.dispose()
  }
}
