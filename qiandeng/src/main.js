import * as T from 'three'
import { clockworkContact } from './clockwork.js'
import { scenicDetail } from './detail.js'
import { Mason } from './mesh.js'
import { materials } from './kit.js'
import { stations, updateLens } from './stations.js'
import { lightRegistry, lightCity } from './lighting.js'
import { navigation } from './walk.js'
import { courtyardCollision } from './collision.js'
import { river } from './river.js'
import { film } from './film.js'
import { garden, gardenBasin } from './garden.js'
import { headwater, headwaterMotion } from './headwater.js'
import { harbor } from './harbor.js'
import { land, landMotion } from './land.js'
import { wards } from './wards.js'
import { watergate } from './watergate.js'
import { summit, summitMotion } from './summit.js'
import { festivalSky, launchQuays } from './festivalSky.js'
import { weather } from './weather.js'
import { procession } from './procession.js'
const root = document.querySelector('#court'),
  status = document.querySelector('#loading')
const palaceRise = 25.2,
  palaceEast = 3.8
function highPalace(b, m, world) {
  const elevated = {
    ...world,
    lamp(x, y, z, ...args) {
      return world.lamp(x + palaceEast, y + palaceRise, z, ...args)
    },
  }
  b.at(palaceEast, palaceRise, 0, 0, () => summit(b, m, elevated))
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
async function openCity() {
  const renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  const gl = renderer.getContext(),
    info = gl.getExtension('WEBGL_debug_renderer_info')
  const software = Boolean(
    info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
  )
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', '千灯渡，雨夜灯会江城，可沿视线自由飞行')
  canvas.setAttribute('aria-describedby', 'travel-hint')
  canvas.tabIndex = 0
  root.prepend(canvas)
  const scene = new T.Scene(),
    statics = new T.Scene(),
    moving = new T.Group()
  scene.add(statics, moving)
  const camera = new T.PerspectiveCamera(56, 1, 0.075, 990)
  camera.layers.enable(1)
  const m = materials(),
    world = lightRegistry()
  const sky = festivalSky(scene, world)
  const regionStats = []
  for (const [build, label] of [
    [land, '云崖'],
    [watergate, '水关'],
    [wards, '灯市'],
    [headwater, '天瀑'],
    [highPalace, '云阙'],
    [harbor, '码头'],
    [garden, '雨庭'],
    [launchQuays, '放灯埠'],
  ]) {
    status.textContent = '正在展开' + label + '…'
    await tick()
    const b = new Mason(statics),
      first = statics.children.length
    build(b, m, world)
    b.finish()
    const meshes = statics.children.slice(first)
    regionStats.push({
      name: label,
      meshes: meshes.length,
      faces: meshes.reduce(
        (n, o) => n + (o.geometry?.index?.count ?? o.geometry?.attributes.position.count ?? 0) / 3,
        0
      ),
    })
  }
  status.textContent = '正在点亮灯火…'
  await tick()
  const air = weather(scene, world)
  const northFalls = headwaterMotion(moving, m, world)
  const dais = new T.Group()
  dais.position.set(palaceEast, palaceRise, 0)
  moving.add(dais)
  const fleet = procession(moving, m, world),
    palace = summitMotion(dais, m, world),
    cliffs = landMotion(moving, m, world)
  const lighting = lightCity(renderer, statics, world),
    water = river(scene, statics, renderer, lighting.common, software)
  const gardenWater = river(scene, statics, renderer, lighting.common, software, gardenBasin())
  water.mesh.updateMatrixWorld(true)
  const gears = clockworkContact(dais)
  const collision = courtyardCollision(
    statics,
    water.mesh,
    (a, b, r) => fleet.block(a, b, r) || gears.block(a, b, r)
  )
  const detail = scenicDetail(statics)
  lighting.shade(statics, software)
  lighting.shade(moving, false, software)
  const cinema = film(renderer, scene, statics, camera, software, lighting.common),
    walk = navigation(canvas, camera, collision)
  let day = false,
    quality = software ? 0.77 : 1,
    pinned = false
  const size = new T.Vector2()
  let previousWidth = 0,
    previousHeight = 0
  function resize() {
    updateLens(camera, innerWidth, innerHeight)
    if (previousWidth !== innerWidth || previousHeight !== innerHeight) {
      walk.resize()
      previousWidth = innerWidth
      previousHeight = innerHeight
    }
    const limit = software ? 1 : Math.min(1.65, Math.sqrt(2190000 / (innerWidth * innerHeight)))
    renderer.setPixelRatio(Math.min(devicePixelRatio, Math.max(0.66, limit)) * quality)
    renderer.setSize(innerWidth, innerHeight)
    renderer.getDrawingBufferSize(size)
    cinema.size(size.x, size.y)
    water.invalidate()
    gardenWater.invalidate()
  }
  function mode(next) {
    day = Boolean(next)
    scene.background = new T.Color(day ? 0xb6c9c5 : 0x303b58)
    scene.fog = new T.FogExp2(day ? 0xb5c5bb : 0x485571, day ? 0.00365 : 0.0052)
    lighting.mode(day)
    cinema.mode(day)
    sky.mode(day)
    air.mode(day)
    water.invalidate()
    gardenWater.invalidate()
    document.documentElement.dataset.mode = day ? 'day' : 'night'
    for (const btn of document.querySelectorAll('button[data-mode]'))
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === (day ? 'day' : 'night')))
  }
  for (const button of document.querySelectorAll('button[data-mode]'))
    button.addEventListener('click', () => mode(button.dataset.mode === 'day'))
  addEventListener('resize', resize)
  scene.addEventListener('sky-painted', () => {
    water.invalidate()
    gardenWater.invalidate()
  })
  resize()
  mode(false)
  let elapsed = 0,
    started = false,
    last = performance.now(),
    measure = 0,
    total = 0
  const lastEye = camera.position.clone(),
    lastRotation = camera.quaternion.clone()
  let lastMotion = -1e5,
    swift = false
  function draw(t) {
    northFalls.update(t, day)
    sky.update(t, day)
    fleet.update(t, day, camera)
    palace.update(t, day)
    cliffs.update(t, day)
    air.update(t, day)
    lighting.update(t)
    gears.update()
    if (
      fleet.protect(camera.position, collision.clearance) ||
      gears.protect(camera.position, collision.clearance)
    )
      camera.updateMatrixWorld()
    const far = Math.max(990, 2 ** Math.ceil(Math.log2(camera.position.length() + 180)))
    if (far !== camera.far) {
      camera.far = far
      camera.updateProjectionMatrix()
    }
    if (software) {
      const now = performance.now(),
        moved = !lastEye.equals(camera.position) || lastRotation.angleTo(camera.quaternion) > 0.0001
      if (moved) {
        lastMotion = now
        lastEye.copy(camera.position)
        lastRotation.copy(camera.quaternion)
      }
      const next = !pinned && now - lastMotion < 240
      if (next !== swift) {
        swift = next
        lighting.fast(swift)
        cinema.invalidate()
        water.invalidate()
        gardenWater.invalidate()
      }
    }
    detail.update(camera, size.y, software || window.matchMedia('(pointer: coarse)').matches)
    const stamp = t * 1000
    water.reflect(camera, stamp)
    gardenWater.reflect(camera, stamp)
    cinema.draw(stamp)
  }
  function frame(now) {
    if (started && !pinned && !document.hidden) elapsed += Math.min(0.23, Math.max(0, now - last) / 1000)
    started = true
    if (!pinned) {
      walk.step(now)
      draw(elapsed)
      if (document.documentElement.dataset.ready && !document.hidden) {
        const dt = now - last
        if (dt < 3500) {
          measure++
          total += dt
        }
        if (measure >= (software ? 7 : 15)) {
          const avg = total / measure
          if (avg > 54 && quality > (software ? 0.62 : 0.69)) {
            quality = Math.max(software ? 0.62 : 0.69, quality - 0.085)
            resize()
          } else if (avg < 24 && quality < 0.99) {
            quality = Math.min(1, quality + 0.045)
            resize()
          }
          measure = 0
          total = 0
        }
      }
      if (!document.documentElement.dataset.ready) {
        document.documentElement.dataset.ready = 'true'
        root.setAttribute('aria-busy', 'false')
        status.remove()
      }
    }
    last = now
    requestAnimationFrame(frame)
  }
  if (typeof __CITY_REVIEW__ !== 'undefined' && __CITY_REVIEW__) {
    window.cityReview = {
      scene,
      statics,
      moving,
      camera,
      collision,
      world,
      stations,
      regionStats,
      water,
      lighting,
      renderer,
      pick(x, y) {
        const ray = new T.Raycaster()
        ray.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), camera)
        return ray
          .intersectObjects(statics.children)
          .slice(0, 6)
          .map((h) => ({ name: h.object.material.name, p: h.point.toArray(), tri: h.faceIndex }))
      },
      pin(t = 0) {
        pinned = true
        quality = 1
        resize()
        water.invalidate()
        gardenWater.invalidate()
        draw(t)
      },
      pose(p, q, t = 0) {
        camera.position.fromArray(p)
        camera.lookAt(...q)
        camera.updateMatrixWorld()
        this.pin(t)
      },
      mode,
      draw,
      play() {
        pinned = false
        last = performance.now()
      },
      get day() {
        return day
      },
      get quality() {
        return quality
      },
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    openCity().catch((e) => {
      console.error(e)
      root.setAttribute('aria-busy', 'false')
      status.textContent = '场景启动遇到问题。请启用 WebGL 2 硬件加速后重新打开。'
    })
  )
)
