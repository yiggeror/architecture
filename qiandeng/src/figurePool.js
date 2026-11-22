import { createCharacter } from './characters.js'

// Only inhabitants approached on foot or by boat need articulated geometry.
// Retain recent figures so crossing the same doorway does not rebuild their atlases.
export function figurePool(parent, shade) {
  const cached = new Map()
  let frame = 0
  return {
    begin() {
      frame++
    },
    draw(profile, job, state, matrix) {
      let entry = cached.get(profile.id)
      if (!entry || entry.figure.job !== job) {
        entry?.figure.dispose()
        const figure = createCharacter(profile, job)
        figure.group.matrixAutoUpdate = false
        figure.lightWith(shade)
        parent.add(figure.group)
        entry = { figure, lastSeen: frame }
        cached.set(profile.id, entry)
      }
      entry.lastSeen = frame
      const { figure } = entry
      figure.group.visible = true
      figure.group.matrix.copy(matrix)
      figure.group.matrixWorldNeedsUpdate = true
      figure.update(state)
      return figure
    },
    finish() {
      const idle = []
      for (const entry of cached.values()) {
        if (entry.lastSeen === frame) continue
        entry.figure.group.visible = false
        idle.push(entry)
      }
      if (cached.size > 8) {
        idle.sort((a, b) => a.lastSeen - b.lastSeen)
        for (const entry of idle.slice(0, cached.size - 8)) {
          cached.delete(entry.figure.profile.id)
          entry.figure.dispose()
        }
      }
    },
  }
}
