import { buildCharacterArt, createCharacter } from './characters.js'
import { packFigureArt } from './figureTransfer.js'

self.onmessage = ({ data: { profile, job, actor, knownTextures } }) => {
  try {
    const art = buildCharacterArt(profile, job)
    const { packet, transfers } = packFigureArt(art, new Set(knownTextures))
    if (job === 'lute') {
      // The first performance fits the instrument to the actual deck, shoes
      // and posed garment. The same fitted seat is reused until any contact changes.
      const figure = createCharacter(profile, job, art)
      figure.update({ t: 0, phase: 0, job, actor, scale: actor?.size, walking: false })
      Object.assign(packet.model.equipment.fit, art.equipment.fit)
      figure.dispose()
    }
    self.postMessage({ packet }, transfers)
  } catch (error) {
    self.postMessage({ error: String(error?.stack ?? error) })
  }
}
