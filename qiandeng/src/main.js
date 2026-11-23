import * as T from 'three'
import { finishGpu } from './gpuFence.js'
import { clockworkContact } from './clockwork.js'
import { scenicDetail } from './detail.js'
import { Mason } from './mesh.js'
import { materials } from './kit.js'
import { stations, updateLens } from './stations.js'
import { visibleLight } from './visibleLight.js'
import { lightRegistry, lightCity } from './lighting.js'
import { characterUpload } from './characterUpload.js'
import { characterStreetLight } from './characterStreetLight.js'
import { navigation } from './walk.js'
import { courtyardCollision } from './collision.js'
import { river } from './river.js'
import { lowerRiver } from './reachWater.js'
import { film } from './film.js'
import { garden, gardenBasin } from './garden.js'
import { headwater, headwaterMotion } from './headwater.js'
import { harbor } from './harbor.js'
import { land, landMotion } from './land.js'
import { wards } from './wards.js'
import { reachWards } from './reachWards.js'
import { reachRoofline } from './reachRoofline.js'
import { reachLand } from './reachLand.js'
import { reachBridges } from './reachBridges.js'
import { ridgePalaces } from './ridgePalaces.js'
import { watergate } from './watergate.js'
import { summit, summitMotion } from './summit.js'
import { festivalSky, launchQuays } from './festivalSky.js'
import { weather } from './weather.js'
import { procession } from './procession.js'
import { reachFerries } from './reachFerries.js'
const root = document.querySelector('#court')
const phaseButtons = document.querySelectorAll('button[data-mode]')
let applyLighting
function mode(day) {
  const phase = day ? 'day' : 'night'
  document.documentElement.dataset.mode = phase
  for (const button of phaseButtons)
    button.setAttribute('aria-pressed', String(button.dataset.mode === phase))
  applyLighting?.(day)
}
for (const button of phaseButtons) button.addEventListener('click', () => mode(button.dataset.mode === 'day'))
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
// Yield a paint between construction stages so the frontispiece can report real progress.
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
// The city has many opaque streets behind its near riverfront. Fill depth in
// distance bands and still batch materials within a band. Explicit renderOrder
// continues to govern skies, layered paint and post-processing.
function opaqueOrder(a, b) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder
  const bandA = Math.floor(Math.log2(Math.max(.00001, 1 - a.z)))
  const bandB = Math.floor(Math.log2(Math.max(.00001, 1 - b.z)))
  return bandB - bandA || a.material.id - b.material.id || a.z - b.z || a.id - b.id
}
async function openCity() {
  let renderer
  try {
    renderer = new T.WebGLRenderer({ antialias: false, depth: false, powerPreference: 'high-performance' })
  } catch (error) {
    console.error(error)
    window.showLoadingError('浏览器未能建立 WebGL 2 绘图环境。请在支持 WebGL 2 的浏览器中打开灯城。')
    return
  }
  const gl = renderer.getContext(),
    info = gl.getExtension('WEBGL_debug_renderer_info')
  const software = Boolean(
    info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)),
  )
  renderer.setOpaqueSort(opaqueOrder)
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', '千灯渡，雨夜灯会江城，可沿视线自由飞行')
  canvas.setAttribute('aria-describedby', 'travel-hint')
  canvas.tabIndex = 0
  canvas.style.width = canvas.style.height = '100%'
  root.prepend(canvas)
  const scene = new T.Scene(),
    statics = new T.Scene(),
    moving = new T.Group()
  scene.add(statics, moving)
  const camera = new T.PerspectiveCamera(56, 1, 0.075, 990)
  camera.layers.enable(1)
  const world = lightRegistry()
  const initialDay = document.documentElement.dataset.mode === 'day'
  const sky = festivalSky(scene, world, initialDay)
  const m = materials()
  const regionStats = []
  const districts = [
    [land, '云崖'],
    [reachLand, '沿江山城'],
    [reachBridges, '长桥'],
    [watergate, '水关'],
    [wards, '灯市'],
    [reachWards, '沿江百坊'],
    [reachRoofline, '江岸层楼'],
    [ridgePalaces, '山城金阙'],
    [headwater, '天瀑'],
    [highPalace, '云阙'],
    [harbor, '码头'],
    [garden, '雨庭'],
    [launchQuays, '放灯埠'],
  ]
  const totalStages = districts.length + 6
  let stage = 0
  async function advance(label) {
    window.updateLoading(label, stage++, totalStages)
    await nextPaint()
  }
  for (const [build, label] of districts) {
    await advance(label)
    const b = new Mason(statics),
      first = statics.children.length
    build(b, m, world)
    b.finish()
    if (typeof __CITY_REVIEW__ !== 'undefined' && __CITY_REVIEW__) {
      const meshes = []
      for (const object of statics.children.slice(first)) {
        object.traverse((mesh) => {
          if (mesh.isMesh) meshes.push(mesh)
        })
      }
      regionStats.push({
        name: label,
        meshes: meshes.length,
        faces: meshes.reduce(
          (n, o) => n + (o.geometry.index?.count || o.geometry.attributes.position.count) / 3,
          0,
        ),
      })
    }
  }
  await advance('灯舟与浑仪')
  const northFalls = headwaterMotion(moving, m, world)
  const dais = new T.Group()
  dais.position.set(palaceEast, palaceRise, 0)
  moving.add(dais)
  const fleet = procession(moving, m, world),
    ferries = reachFerries(moving, m, world),
    palace = summitMotion(dais, m, world),
    cliffs = landMotion(moving, m, world)
  await advance('江城灯影')
  const lighting = await lightCity(renderer, statics, world, () => advance('白昼投影')),
    water = river(scene, statics, renderer, lighting.common, software)
  const gardenWater = river(scene, statics, renderer, lighting.common, software, gardenBasin())
  const valleyWater = river(scene, statics, renderer, lighting.common, software, lowerRiver())
  const waters = [water, gardenWater, valleyWater]
  await advance('水面与雨幕')
  const air = weather(
    scene,
    world,
    statics,
    waters.map((surface) => surface.mesh),
    lighting.common,
  )
  const gears = clockworkContact(dais)
  const collision = courtyardCollision(
    statics,
    waters.map((surface) => surface.mesh),
    (a, b, r) => fleet.block(a, b, r) || ferries.block(a, b, r) || gears.block(a, b, r),
  )
  await advance('街巷与屋脊')
  const detail = scenicDetail(statics)
  // Roofs, streets and LOD proxies have permanent world transforms. All views,
  // including water and shadow passes, can share them with the moving fleet.
  statics.updateMatrixWorld(true)
  statics.traverse((object) => {
    object.matrixAutoUpdate = false
    object.matrixWorldAutoUpdate = false
  })
  scene.matrixWorldAutoUpdate = false
  world.characterFloor = (x, z, nominalY) => collision.floor(x, z, nominalY + 0.085, 0.195) ?? nominalY
  const portraitLight = characterStreetLight(renderer, world, lighting.common)
  world.shadeCharacter = portraitLight.shade
  const upload = characterUpload(renderer, scene, camera)
  world.warmCharacter = async (group, actor) => {
    await upload(group)
    await portraitLight.prepare(group)
    statics.userData.trackFigure(group, actor?.ship)
  }
  lighting.shade(statics)
  lighting.shade(moving, software)
  statics.userData.visibleLight = visibleLight(renderer, statics, lighting.common)
  const cinema = film(renderer, scene, statics, camera, software, lighting.common),
    walk = navigation(canvas, camera, collision)
  let day = false,
    pinned = false
  const size = new T.Vector2()
  let previousWidth = 0,
    previousHeight = 0
  function resize() {
    const changed = previousWidth !== innerWidth || previousHeight !== innerHeight
    // Keep one stable physical sampling grid during travel. On phones with a GPU,
    // a high-density display gets up to 2.25 samples per CSS pixel on each axis.
    const budgetRatio = Math.sqrt(2800000 / (innerWidth * innerHeight))
    const ratio = software ? 1 : Math.max(1, Math.min(devicePixelRatio, 2.25, budgetRatio))
    if (!changed && renderer.getPixelRatio() === ratio) return
    updateLens(camera, innerWidth, innerHeight)
    if (changed) {
      walk.resize()
      previousWidth = innerWidth
      previousHeight = innerHeight
    }
    renderer.setDrawingBufferSize(innerWidth, innerHeight, ratio)
    renderer.getDrawingBufferSize(size)
    camera.userData.viewportHeight = size.y
    cinema.size(size.x, size.y)
    for (const surface of waters) surface.invalidate()
  }
  applyLighting = (next) => {
    day = Boolean(next)
    scene.background = new T.Color(day ? 0xb6c9c5 : 0x101b2e)
    scene.fog = new T.FogExp2(day ? 0x98aeb1 : 0x142032, day ? 0.00188 : 0.0023)
    lighting.mode(day)
    cinema.mode(day)
    sky.mode(day)
    air.mode(day)
    for (const surface of waters) surface.invalidate()
  }
  scene.addEventListener('sky-painted', () => {
    for (const surface of waters) surface.invalidate()
  })
  resize()
  await sky.ready
  mode(initialDay)
  let elapsed = 0,
    started = false,
    last = performance.now()
  const cityCentre = new T.Vector3(65, 71, -217)
  function visitFigure() {
    const params = new URLSearchParams(location.hash.slice(1)),
      key = params.get('person')
    if (!key || !/^\d+$/.test(key)) return
    const subject = fleet.subject(Number(key), elapsed)
    if (!subject) return
    if (params.has('light')) mode(params.get('light') === 'day')
    const vertical = new T.Vector3(0, 1, 0)
    const { focus, forward, job } = subject
    // The seated musician plays across the lap. Give the neck of the pipa
    // room at the edge and choose the open side of the moving pavilion.
    const portraits = {
      umbrella: { angles: [.42, -.37], distance: 1.40, lift: .065 },
      lute: { angles: [-.39, .95], distance: 1.31, lift: .045 },
      scholar: { angles: [-.37, .46], distance: 1.46, lift: .075 },
      drum: { angles: [-.54, .39], distance: 1.46, lift: .065 },
    }
    const portrait = portraits[subject.design] ?? portraits[job] ?? { angles: [.39, -.48], distance: 1.74, lift: .09 }
    focus.y += job === 'lute' ? .045 : .038
    const start = focus.clone()
    let eye = start, best = 0
    for (const angle of [...portrait.angles, .83, -.93, 1.35, -1.45, 2.65]) {
      const offset = forward.clone().applyAxisAngle(vertical, angle).multiplyScalar(portrait.distance)
      offset.y += portrait.lift
      const sample = start.clone()
      collision.move(sample, offset.x, offset.y, offset.z)
      const distance = sample.distanceTo(start)
      if (distance > best && collision.clearance(sample) < 0.001) {
        eye = sample
        best = distance
      }
      if (best >= portrait.distance - .035) break
    }
    if (best > 0.33) walk.arrive(eye.toArray(), focus.toArray())
    return fleet.prepareSubject(Number(key), day)
  }
  await visitFigure()
  addEventListener('hashchange', visitFigure)
  const coarsePointer = window.matchMedia('(pointer: coarse)')
  let refinementTurn = 0
  const refinement = (statics.userData.refinement = { main: true, used: false })
  function draw(t) {
    refinement.main = refinementTurn++ % 3 !== 2
    refinement.used = false
    northFalls.update(t, day)
    sky.update(t, day)
    fleet.update(t, day, camera)
    ferries.update(t, day, camera)
    palace.update(t, day)
    cliffs.update(t, day)
    air.update(t, day)
    lighting.update(t)
    const sitter = portraitLight.update(t, camera)
    gears.update()
    if (
      fleet.protect(camera.position, collision.clearance) ||
      ferries.protect(camera.position, collision.clearance) ||
      gears.protect(camera.position, collision.clearance)
    )
      camera.updateMatrixWorld()
    const far = Math.max(990, 2 ** Math.ceil(Math.log2(camera.position.distanceTo(cityCentre) + 590)))
    if (far !== camera.far) {
      camera.far = far
      camera.updateProjectionMatrix()
    }
    cinema.focus(sitter)
    detail.update(camera, size.y, software || coarsePointer.matches)
    // Three uses the same moving transforms in every river view and the main view.
    for (const object of scene.children) if (object.matrixWorldAutoUpdate) object.updateMatrixWorld()
    const stamp = t * 1000
    for (const surface of waters) surface.reflect(camera, stamp)
    cinema.draw(stamp)
  }
  // Keep input from queueing several obsolete camera views behind a busy GPU.
  // The very first fence also keeps the frontispiece up until the gate, boats
  // and mirrors have actually finished drawing at festival time zero.
  let pending = null, submittedAt = 0
  function frame(now) {
    let inputTurn = false
    if (pending && gl.clientWaitSync(pending, 0, 0) !== gl.TIMEOUT_EXPIRED) {
      gl.deleteSync(pending)
      pending = null
      scene.userData.slowFrame = performance.now() - submittedAt > 78
      // During a long presentation Chromium can deliver a waiting pointer just
      // after rAF. Give it a turn before committing another idle camera view.
      inputTurn = scene.userData.slowFrame &&
        (!walk.hasInput() || navigator.scheduling?.isInputPending?.({ includeContinuous: true }))
    }
    if (!document.hidden && !pinned && !gl.isContextLost()) {
      if (started && !document.documentElement.dataset.ready) {
        if (!pending) {
          window.updateLoading('水关初照', totalStages, totalStages)
          window.finishLoading()
          last = now
        }
      } else if (!pending && !inputTurn) {
        if (started) elapsed += Math.min(.23, Math.max(0, now - last) / 1000)
        resize()
        walk.step(performance.now())
        try {
          draw(elapsed)
        } catch (error) {
          console.error(error)
          window.showLoadingError('场景绘制遇到问题，请重新打开灯城。')
          return
        }
        pending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        if (pending) {
          submittedAt = performance.now()
          gl.flush()
        }
        started = true
        last = now
      }
    } else {
      last = now
    }
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
      subject: fleet.subject,
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
        resize()
        for (const surface of waters) surface.invalidate()
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
        return renderer.getPixelRatio()
      },
    }
  }
  await advance('水关初照')
  await fleet.prepareOpening(camera, day, 0)
  // Compile the moving camera's surface and mirror paths and upload nearby
  // distance levels while the frontispiece still owns the screen.
  const opening = camera.position.clone()
  const ahead = camera.getWorldDirection(new T.Vector3()).multiplyScalar(.84)
  detail.update(camera, size.y, software || coarsePointer.matches)
  collision.move(camera.position, ahead.x, ahead.y, ahead.z)
  camera.updateMatrixWorld()
  statics.userData.preparingFlight = true
  try {
    draw(0)
    await finishGpu(gl)
  } finally {
    statics.userData.preparingFlight = false
    camera.position.copy(opening)
    camera.updateMatrixWorld()
    detail.settle()
    cinema.invalidate()
    for (const surface of waters) surface.invalidate()
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    openCity().catch((e) => {
      console.error(e)
      window.showLoadingError('灯城准备过程中断，请重新打开页面。')
    }),
  ),
)
