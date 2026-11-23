import { createCharacter } from './characters.js'
import { unpackFigureArt } from './figureTransfer.js'

function figureWorker() {
  if (typeof __FIGURE_WORKER_SOURCE__ !== 'string' || typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined') return null
  let worker
  const textures = new Map()
  function forget(event) {
    const texture = event.target
    textures.delete(texture.uuid)
    texture.removeEventListener('dispose', forget)
  }
  return (profile, job, actor) => new Promise((resolve, reject) => {
    // Keep the advertised CPU buffers alive for this request even if the
    // visitor walks away and the owning figure is evicted while work is in flight.
    const available = new Map(textures)
    if (!worker) {
      const url = URL.createObjectURL(new Blob([__FIGURE_WORKER_SOURCE__], { type: 'text/javascript' }))
      try {
        worker = new Worker(url)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    function clear() {
      worker.onerror = worker.onmessageerror = worker.onmessage = null
    }
    function fail(error) {
      clear()
      worker.terminate()
      reject(error)
    }
    worker.onerror = worker.onmessageerror = fail
    worker.onmessage = ({ data }) => {
      if (data.error) return fail(data.error)
      try {
        const art = unpackFigureArt(data.packet, available)
        const figure = createCharacter(profile, job, art)
        for (const { uuid } of data.packet.textures) {
          if (textures.has(uuid)) continue
          const texture = available.get(uuid)
          textures.set(uuid, texture)
          texture.addEventListener('dispose', forget)
        }
        clear()
        resolve(figure)
      } catch (error) {
        fail(error)
      }
    }
    // Only the musician needs the deck under the shoes when fitting the pipa.
    let seat
    if (job === 'lute' && actor?.ship) {
      const { x, y, z, yaw, size } = actor
      const { kind, length, beam, deck } = actor.ship.spec
      seat = { x, y, z, yaw, size, ship: { spec: { kind, length, beam, deck } } }
    }
    try {
      worker.postMessage({ profile, job, actor: seat, knownTextures: [...available.keys()] })
    } catch (error) {
      fail(error)
    }
  })
}

// One tailor works ahead of the visitor. Keep the closest approaching people
// and recent doorways warm, and never queue an entire street after a camera cut.
export function figurePool(parent, shade, warm) {
  const cached = new Map(), wanted = new Map(), visits = new Map()
  let load = figureWorker(), frame = 0, revision = 0, working = false, queue = []
  const defer = Boolean(load) || typeof window !== 'undefined'
  const keyOf = (profile, job) => profile.id + '/' + job
  function mount(figure) {
    figure.group.matrixAutoUpdate = false
    figure.group.visible = false
    figure.lightWith(shade)
    parent.add(figure.group)
    return figure
  }
  function keep(figure) {
    const entry = { figure, lastSeen: -1, lastUsed: frame }
    cached.set(keyOf(figure.profile, figure.job), entry)
    revision++
    return entry
  }
  function want(profile, job, actor, distance, near = false) {
    if (!defer) return
    const key = keyOf(profile, job), old = wanted.get(key)
    if (!old || distance < old.distance)
      wanted.set(key, { key, profile, job, actor, distance, near })
  }
  async function build(item) {
    if (load) {
      try {
        return await load(item.profile, item.job, item.actor)
      } catch (error) {
        // Restricted documents can reject a blob worker after construction.
        console.warn('Character worker unavailable', error)
        load = null
      }
    }
    await new Promise((resume) => setTimeout(resume, 0))
    return createCharacter(item.profile, item.job)
  }
  async function work() {
    if (working) return
    working = true
    try {
      while (true) {
        const item = [...visits.values(), ...queue].find(({ key }) => !cached.has(key))
        if (!item) break
        const { key } = item
        const figure = await build(item)
        const needed = () => visits.has(key) || queue.some((q) => q.key === key)
        if (needed()) {
          mount(figure)
          try {
            await warm?.(figure.group, item.actor)
          } catch (error) {
            console.warn('Character graphics preparation unavailable', error)
          }
        }
        if (needed()) keep(figure)
        else figure.dispose()
        visits.get(key)?.resolve(figure.group)
        visits.delete(key)
      }
    } finally {
      working = false
    }
  }
  return {
    get revision() { return revision },
    begin() {
      frame++
      wanted.clear()
    },
    want,
    prepare(profile, job, actor) {
      const key = keyOf(profile, job)
      if (cached.has(key)) return Promise.resolve(cached.get(key).figure.group)
      if (visits.has(key)) return visits.get(key).promise
      let resolve
      const promise = new Promise((done) => { resolve = done })
      visits.set(key, { key, profile, job, actor, promise, resolve })
      work()
      return promise
    },
    draw(profile, job, state, matrix, distance) {
      const key = keyOf(profile, job)
      want(profile, job, state.actor, distance, true)
      const entry = cached.get(key) ?? (!defer && keep(mount(createCharacter(profile, job))))
      if (!entry) return null
      entry.lastSeen = entry.lastUsed = frame
      const { figure } = entry
      figure.group.visible = true
      figure.group.matrix.copy(matrix)
      figure.group.matrixWorldNeedsUpdate = true
      figure.update(state)
      return figure
    },
    finish() {
      const ordered = [...wanted.values()].sort((a, b) => a.distance - b.distance)
      const near = ordered.filter((q) => q.near)
      const ahead = ordered.filter((q) => !q.near).slice(0, Math.min(3, Math.max(0, 8 - near.length)))
      queue = [...near, ...ahead]
      const held = new Set([...visits.keys(), ...queue.map((q) => q.key)])
      const idle = []
      for (const [key, entry] of cached) {
        if (entry.lastSeen === frame) continue
        entry.figure.group.visible = false
        if (held.has(key)) entry.lastUsed = frame
        else idle.push([key, entry])
      }
      if (cached.size > 8) {
        idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed)
        for (const [key, entry] of idle.slice(0, cached.size - 8)) {
          cached.delete(key)
          entry.figure.dispose()
        }
      }
      work()
    },
  }
}
