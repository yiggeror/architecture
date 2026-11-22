import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createCharacter } from './characters.js'
import { characterProfile, characterVariant, studyCast } from './characterProfiles.js'
import { posePeriod } from './humanPose.js'
import { exportCharacterGLB } from './exportCharacter.js'
import { studioWindows } from './characterStudioLight.js'

const $ = (id) => document.getElementById(id)
const paper = document.documentElement
const garmentNames = {
  duan: '短褐',
  beizi: '褙子',
  yuanling: '圆领袍',
  aoqun: '袄裙',
  changshan: '长衫',
  banbi: '半臂',
}
const hairNames = {
  coil: '盘髻',
  knot: '束髻',
  wrapped: '包巾',
  loop: '环髻',
  braid: '编辫',
  half: '半束发',
}
const patternNames = { '': '原裁片', reed: '细竹', plum: '折梅', cloud: '云水', plain: '素织' }
const roleNames = {
  umbrella: '持伞',
  row: '操舟',
  lute: '琵琶',
  watch: '巡更',
  walk: '行旅',
  carrier: '挑担',
  basket: '采买',
  lantern: '持灯',
  drum: '击鼓',
  flute: '吹笛',
  porter: '搬运',
  sit: '观灯',
}
const pigmentNames = {
  outer: '外衣',
  inner: '里衣',
  lower: '下裳',
  binding: '滚边',
  sash: '腰带',
  motif: '纹样',
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0')
const up = new T.Vector3(0, 1, 0)

function paperGrain() {
  const c = document.createElement('canvas')
  c.width = c.height = 152
  const ctx = c.getContext('2d'),
    p = ctx.createImageData(c.width, c.height)
  let s = 34781
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < p.data.length; i += 4) {
    p.data[i] = 42
    p.data[i + 1] = 54
    p.data[i + 2] = 35
    p.data[i + 3] = Math.floor(rand() * 26)
  }
  ctx.putImageData(p, 0, 0)
  for (let i = 0; i < 135; i++) {
    const x = rand() * 152,
      y = rand() * 152
    ctx.strokeStyle = `rgba(87,78,58,${0.025 + 0.036 * rand()})`
    ctx.lineWidth = 0.46
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 1 + rand() * 4, y + 0.3 - rand() * 0.7)
    ctx.stroke()
  }
  paper.style.setProperty('--fiber', `url("${c.toDataURL()}")`)
}
function groundShadow() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d'),
    gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(39,44,35,.70)')
  gradient.addColorStop(0.3, 'rgba(39,44,34,.33)')
  gradient.addColorStop(0.7, 'rgba(39,44,34,.08)')
  gradient.addColorStop(1, 'rgba(39,44,34,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const map = new T.CanvasTexture(c)
  map.colorSpace = T.SRGBColorSpace
  const shadow = new T.Mesh(
    new T.PlaneGeometry(1.55, 0.91),
    new T.MeshBasicMaterial({ map, transparent: true, opacity: 0.4, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.0007
  return shadow
}
function cityFile() {
  let name = location.pathname.split('/').at(-1)
  try {
    name = decodeURIComponent(name)
  } catch {}
  return name === '千灯渡-人物图录.html' ? '千灯渡.html' : 'index.html'
}
function initialSitter() {
  const value =
    new URLSearchParams(location.hash.slice(1)).get('person') ??
    new URLSearchParams(location.search).get('person')
  const index =
    value !== null && /^\d+$/.test(value) ? studyCast.findIndex((s) => s.id === Number(value)) : -1
  return index < 0
    ? Math.max(
        0,
        studyCast.findIndex((s) => s.id === 47),
      )
    : index
}
function buildCatalog(profiles, choose) {
  const dialog = $('catalog'),
    list = $('cast-list'),
    filter = $('role-filter')
  const jobs = new Set()
  studyCast.forEach((s, i) => {
    if (!jobs.has(s.job)) {
      jobs.add(s.job)
      filter.add(new Option(roleNames[s.job] ?? s.label, s.job))
    }
    const li = document.createElement('li'),
      button = document.createElement('button'),
      tone = document.createElement('span'),
      line = document.createElement('span'),
      name = document.createElement('b'),
      job = document.createElement('small'),
      check = document.createElement('em')
    li.dataset.job = s.job
    button.className = 'cast-row'
    button.type = 'button'
    button.dataset.cast = String(s.id)
    tone.className = 'cast-tone'
    tone.ariaHidden = 'true'
    tone.style.setProperty('--tone', hex(profiles[i].colors.outer))
    name.textContent = s.name
    job.textContent = s.label
    check.ariaHidden = 'true'
    line.append(name, job)
    button.append(tone, line, check)
    li.append(button)
    list.append(li)
    button.addEventListener('click', () => {
      choose(i)
      dialog.close()
    })
  })
  function applyFilter() {
    for (const li of list.children) li.hidden = filter.value !== 'all' && filter.value !== li.dataset.job
  }
  filter.addEventListener('change', applyFilter)
  $('catalog-open').addEventListener('click', () => {
    filter.value = 'all'
    applyFilter()
    dialog.showModal()
    dialog.querySelector('[aria-current="true"]')?.focus({ preventScroll: true })
  })
  $('catalog-close').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return
    const r = dialog.getBoundingClientRect()
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close()
  })
  dialog.addEventListener('close', () => $('catalog-open').focus({ preventScroll: true }))
  return (id) => {
    for (const item of list.querySelectorAll('button')) {
      const active = Number(item.dataset.cast) === id
      item.setAttribute('aria-current', String(active))
      item.lastChild.textContent = active ? '✓' : ''
    }
  }
}
function selectButtons(selector, key, active) {
  for (const el of document.querySelectorAll(selector))
    el.setAttribute('aria-pressed', String(el.dataset[key] === active))
}

function studio() {
  paperGrain()
  const mount = $('mount'),
    canvas = $('figure'),
    loader = $('loading'),
    scrub = $('scrub'),
    play = $('playback')
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0, 0)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = .98
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(32, 1, 0.012, 36),
    controls = new OrbitControls(camera, canvas)
  scene.environment = studioWindows()
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.16
  controls.zoomSpeed = 0.86
  controls.rotateSpeed = 0.77
  controls.minPolarAngle = 0.045
  controls.maxPolarAngle = Math.PI - 0.045
  const hemi = new T.HemisphereLight(0xfff7df, 0xb8baa2, 1.3),
    key = new T.DirectionalLight(0xffdfaf, 2.55),
    fill = new T.DirectionalLight(0xc4dad4, 0.72),
    rim = new T.DirectionalLight(0xffecd3, 1.05)
  scene.add(hemi, key, key.target, fill, rim)
  key.castShadow = true
  key.shadow.mapSize.set(1536, 1536)
  key.shadow.normalBias = 0.0026
  key.shadow.bias = -0.00027
  Object.assign(key.shadow.camera, {
    left: -1.42,
    right: 1.42,
    top: 1.47,
    bottom: -1.45,
    near: 0.35,
    far: 10,
  })
  key.shadow.camera.updateProjectionMatrix()
  key.target.position.y = 0.91
  const floor = new T.Mesh(
    new T.PlaneGeometry(13, 13),
    new T.ShadowMaterial({ color: 0x38483a, opacity: 0.16, depthWrite: false }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.002
  floor.receiveShadow = true
  scene.add(floor, groundShadow())
  const actors = studyCast.map((s) => characterProfile(s.id, s.job))
  let current = null,
    which = -1,
    time = 0,
    period = 1,
    view = 'portrait',
    light = 'day',
    hand = 'r',
    dirty = true,
    tracking = false
  let trial = {}
  let clayStudy = false
  let headFinishes = []
  const claySkin = new T.MeshStandardMaterial({ color: 0xaca99c, roughness: .86, side: T.DoubleSide })
  const claySclera = claySkin.clone(), clayIris = claySkin.clone()
  claySclera.color.setHex(0xb9b7a9)
  clayIris.color.setHex(0x817e71)
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches,
    last = performance.now(),
    lastPaint = -1
  const state = { t: 0, phase: 0, job: '', walking: false, speed: 0.78, scale: 1, day: true }
  const focus = new T.Vector3(),
    change = new T.Vector3(),
    outward = new T.Vector3(),
    spherical = new T.Spherical(),
    bounds = new T.Box3(),
    fullTarget = new T.Vector3(),
    size = new T.Vector3()
  let lastWidth = 0,
    lastHeight = 0,
    baseDistance = 0,
    markCatalog

  function lighting(next) {
    light = next
    const day = next === 'day'
    scene.environmentIntensity = day ? 0.31 : 0.22
    hemi.color.set(day ? 0xc9d9e2 : 0x9babcb)
    hemi.groundColor.set(day ? 0xb79c8d : 0x81665f)
    hemi.intensity = day ? 0.76 : 0.55
    key.color.set(day ? 0xffead8 : 0xffc38e)
    key.intensity = day ? 2.53 : 2.63
    key.position.set(day ? -3.25 : 2.4, day ? 3.08 : 2.63, day ? 4.05 : 2.78)
    fill.color.set(day ? 0xc5d6de : 0xaac9e1)
    fill.intensity = day ? 0.65 : 0.55
    fill.position.set(day ? 3.05 : -2.65, 1.62, 3.18)
    rim.color.set(day ? 0xffe3c0 : 0xb9cada)
    rim.intensity = day ? 1.60 : 1.48
    rim.position.set(day ? 1.65 : -2.1, 3.12, -2.55)
    floor.material.opacity = day ? 0.105 : 0.17
    state.day = day
    if (current) actorPose()
    paper.dataset.light = next
    selectButtons('[data-light-choice]', 'lightChoice', next)
    dirty = true
  }
  function actorPose() {
    state.t = time
    if (state.job === 'porter')
      state.loading = 0.5 - 0.5 * Math.cos(state.phase + (Math.PI * 2 * time) / period)
    else delete state.loading
    current.update(state)
    current.group.updateWorldMatrix(true, true)
    renderer.shadowMap.needsUpdate = true
  }
  function frameTarget() {
    if (view === 'full') return focus.copy(fullTarget)
    const p = current.profile,
      bones = current.rig.bones
    if (view === 'hand')
      return bones[hand + 'Hand'].localToWorld(focus.set(0, -0.058 * p.height, 0.025 * p.height))
    return bones.head.localToWorld(focus.set(0, 0.083 * p.height, 0.022 * p.height))
  }
  function fittedDistance(direction) {
    const half = Math.tan(T.MathUtils.degToRad(camera.fov / 2))
    const h = current.profile.height
    if (view !== 'full') {
      const field = view === 'hand' ? 0.255 : 0.458
      return (field * h) / (2 * half * Math.min(1, camera.aspect / 0.83))
    }
    const right = new T.Vector3().crossVectors(up, direction).normalize(),
      vertical = new T.Vector3().crossVectors(direction, right).normalize()
    const pad = 0.82,
      delta = new T.Vector3()
    let distance = 0.15
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          delta.set(x, y, z).sub(fullTarget)
          distance = Math.max(
            distance,
            delta.dot(direction) +
              Math.max(
                Math.abs(delta.dot(right)) / (half * camera.aspect * pad),
                Math.abs(delta.dot(vertical)) / (half * pad),
              ),
          )
        }
    return distance
  }
  function measure() {
    bounds.setFromObject(current.group, true)
    bounds.getSize(size)
    if (bounds.isEmpty() || !Number.isFinite(size.length())) throw new Error('人物模型缺少有效的几何边界')
    bounds.getCenter(fullTarget)
  }
  function frame(reset) {
    if (!current) return
    const target = frameTarget()
    if (reset || !baseDistance) {
      const portraitYaw = { 47: -0.43, 9: -0.51, 64: 0.34, 4: -0.38 }[current.profile.id] ?? -0.52
      const yaw = view === 'hand' ? (hand === 'l' ? 0.56 : -0.57) : view === 'full' ? 0.23 : portraitYaw
      outward
        .set(Math.sin(yaw), view === 'hand' ? 0.24 : view === 'full' ? 0.065 : 0.066, Math.cos(yaw))
        .normalize()
      controls.enableDamping = false
      controls.update()
      controls.enableDamping = true
    } else outward.copy(camera.position).sub(controls.target).normalize()
    const zoom = reset || !baseDistance ? 1 : camera.position.distanceTo(controls.target) / baseDistance
    baseDistance = fittedDistance(outward)
    const distance = baseDistance * zoom
    controls.minDistance = view === 'hand' ? 0.095 : view === 'portrait' ? 0.2 : 0.49
    controls.maxDistance = Math.max(7, baseDistance * 3.3)
    camera.position
      .copy(target)
      .addScaledVector(outward, T.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance))
    controls.target.copy(target)
    controls.update()
    dirty = true
  }
  function follow() {
    if (!current || view === 'full') return
    frameTarget()
    change.copy(focus).sub(controls.target)
    camera.position.add(change)
    controls.target.copy(focus)
  }
  function previousNext(step) {
    select((which + step + studyCast.length) % studyCast.length)
  }
  function toggle(next) {
    playing = next
    paper.dataset.playing = String(playing)
    $('play-text').textContent = playing ? '暂停' : '播放'
    play.setAttribute('aria-label', playing ? '暂停动作' : '播放动作')
    last = performance.now()
    dirty = true
  }
  function timeDisplay() {
    const f = time === period && !playing ? 1 : (time % period) / period,
      value = Math.round(f * 1000)
    if (value === lastPaint) return
    lastPaint = value
    scrub.value = String(value)
    scrub.style.setProperty('--progress', (100 * f).toFixed(2) + '%')
    const label = (period * f).toFixed(2) + ' / ' + period.toFixed(2) + ' 秒'
    $('timecode').textContent = label
    scrub.setAttribute('aria-valuetext', label)
  }
  function updateSheet(s, profile) {
    $('person-name').textContent = s.name
    $('person-role').textContent = `${s.label} · ${profile.age} 岁`
    const signature = current.group.children.find((o) => o.userData.costume)
    const outfits = { silk: '玉兰比甲', lute: '莲瓣披帛', scholar: '竹石氅衣', drummer: '双鱼紧袖' }
    const coiffures = { silk: '朝云髻', lute: '水纹低髻', scholar: '束发文冠', drummer: '额帛翻髻' }
    const costume = outfits[signature?.userData.costume] ?? garmentNames[profile.garment]
    const hair = (profile.hair === actors[which].hair && coiffures[profile.design]) || hairNames[profile.hair]
    $('clothing').textContent = costume + ' · ' + hair
    $('position').textContent = `${String(which + 1).padStart(2, '0')} / ${studyCast.length}`
    const swatches = Object.entries(pigmentNames).map(([k, n]) => {
      const sw = document.createElement('i')
      sw.className = 'swatch'
      sw.style.backgroundColor = hex(profile.colors[k])
      sw.title = n + ' ' + hex(profile.colors[k])
      return sw
    })
    $('pigments').replaceChildren(...swatches)
    $('pigments').setAttribute('aria-label', swatches.map((x) => x.title).join('，'))
    $('city-link').setAttribute('href', `${cityFile()}#person=${s.id}`)
    $('city-link').setAttribute('aria-label', `到千灯渡城中寻访${s.name}`)
    document.title = `${s.name} · 千灯渡人物图录`
    paper.dataset.person = String(s.id)
    markCatalog(s.id)
  }
  function updateJawLabel() {
    const value = Number($('trial-jaw').value)
    const label = value < -0.36 ? '清瘦' : value > 0.36 ? '宽阔' : '适中'
    $('jaw-value').textContent = label
    $('trial-jaw').setAttribute('aria-valuetext', label + ' ' + value.toFixed(2))
  }
  function showTrial() {
    const profile = current.profile,
      changed = Object.keys(trial).length > 0
    $('trial-jaw').value = String(profile.face.jaw)
    updateJawLabel()
    $('trial-hair').value = profile.hair
    $('trial-garment').value = profile.garment
    $('trial-pattern').value = profile.pattern ?? ''
    $('trial-reset').disabled = !changed
    $('trial-status').textContent = changed ? '试样中' : '原样'
  }
  function showHeadSurface() {
    for (const part of headFinishes) {
      part.mesh.visible = part.visible && (!clayStudy || Boolean(part.clay))
      part.mesh.material = clayStudy && part.clay ? part.clay : part.finish
    }
    $('clay-face').setAttribute('aria-pressed', clayStudy ? 'true' : 'false')
    renderer.shadowMap.needsUpdate = true
    dirty = true
  }
  function mountCharacter(profile) {
    const next = createCharacter(profile, studyCast[which].job)
    current?.dispose()
    current = next
    current.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !o.material?.transparent || o.material?.alphaTest > 0
        o.receiveShadow = true
        // The outer skin faces share an edge at the eyelids and nose. Use
        // the back of the shell to cast, keeping the face free of depth stripes.
        if (o.material?.userData.skin) o.material.shadowSide = T.BackSide
      }
    })
    const portrait = current.group.getObjectByName('面容·' + profile.name)
    headFinishes = []
    portrait.traverse((mesh) => {
      if (!mesh.isMesh) return
      const clay = /面骨|上下眼睑/.test(mesh.name) ? claySkin :
        mesh.name.includes('巩膜') ? claySclera : mesh.name.startsWith('虹膜') ? clayIris : null
      headFinishes.push({ mesh, clay, finish: mesh.material, visible: mesh.visible })
    })
    showHeadSurface()
    scene.add(current.group)
    actorPose()
    measure()
  }
  function fitTrial(changes) {
    const offset = camera.position.clone().sub(controls.target),
      base = actors[which]
    trial = changes
    mountCharacter(Object.keys(trial).length ? characterVariant(base, trial) : base)
    // Keep the two silhouettes registered while comparing a cut or hairstyle,
    // including a full view whose new geometrical centre has shifted.
    if (view === 'full') fullTarget.copy(controls.target)
    baseDistance = fittedDistance(offset.normalize())
    last = performance.now()
    dirty = true
    updateSheet(studyCast[which], current.profile)
    showTrial()
  }
  function bindTrials() {
    const actions = { hair: hairNames, garment: garmentNames, pattern: patternNames }
    for (const [key, names] of Object.entries(actions)) {
      const input = $('trial-' + key)
      for (const [value, label] of Object.entries(names)) input.add(new Option(label, value))
    }
    for (const key of ['jaw', ...Object.keys(actions)]) {
      const input = $('trial-' + key)
      input.addEventListener('change', () => {
        const base = actors[which],
          changes = { ...trial },
          value = key === 'jaw' ? Number(input.value) : input.value
        const original = key === 'jaw' ? Number(base.face.jaw.toFixed(2)) : (base[key] ?? '')
        if (value === original) delete changes[key]
        else changes[key] = value
        fitTrial(changes)
      })
    }
    $('clay-face').addEventListener('click', () => {
      clayStudy = !clayStudy
      showHeadSurface()
    })
    $('trial-jaw').addEventListener('input', updateJawLabel)
    $('trial-reset').addEventListener('click', () => fitTrial({}))
    $('export-figure').addEventListener('click', downloadFigure)
  }
  async function downloadFigure() {
    const button = $('export-figure'),
      status = $('export-status')
    if (button.disabled) return
    const profile = current.profile,
      entry = studyCast[which]
    const options = {
      walking: entry.walking,
      day: state.day,
      phase: state.phase,
      startTime: time,
      scale: 1,
    }
    const filename = profile.name + '-' + roleNames[entry.job] + '.glb'
    button.disabled = true
    status.textContent = '正在导出' + profile.name + '…'
    // Let the pressed state paint before gathering the animation tracks.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      const bytes = await exportCharacterGLB(profile, entry.job, options)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      status.textContent = profile.name + '已导出'
    } catch (error) {
      console.error(error)
      status.textContent = '导出未完成，请重试'
    } finally {
      button.disabled = false
    }
  }
  function select(i, write = true) {
    if (i === which) return
    const s = studyCast[i],
      profile = actors[i]
    which = i
    time = 0
    lastPaint = -1
    state.job = s.job
    state.phase = profile.seed % 6.28
    state.walking = s.walking
    state.speed = 0.78
    hand = s.job === 'umbrella' ? 'l' : 'r'
    selectButtons('[data-hand]', 'hand', hand)
    trial = {}
    if (!$('export-figure').disabled) $('export-status').textContent = ''
    period = posePeriod(profile, state)
    mountCharacter(profile)
    frame(true)
    updateSheet(s, profile)
    showTrial()
    timeDisplay()
    last = performance.now()
    if (write) {
      try {
        const url = new URL(location.href)
        url.hash = 'person=' + s.id
        history.replaceState(null, '', url)
      } catch {
        location.hash = 'person=' + s.id
      }
    }
    dirty = true
  }
  function setView(next) {
    view = next
    paper.dataset.view = next
    selectButtons('[data-view-choice]', 'viewChoice', next)
    $('hand-choice').hidden = next !== 'hand'
    if (next === 'full') measure()
    frame(true)
  }
  function zoom(by) {
    if (!current) return
    outward.copy(camera.position).sub(controls.target)
    const d = T.MathUtils.clamp(outward.length() * by, controls.minDistance, controls.maxDistance)
    camera.position.copy(controls.target).add(outward.setLength(d))
    controls.update()
    dirty = true
  }
  function orbit(dx, dy) {
    outward.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(outward)
    spherical.theta += dx
    spherical.phi = T.MathUtils.clamp(spherical.phi + dy, controls.minPolarAngle, controls.maxPolarAngle)
    camera.position.copy(controls.target).add(outward.setFromSpherical(spherical))
    controls.update()
    dirty = true
  }
  function resize() {
    const w = Math.max(1, mount.clientWidth),
      h = Math.max(1, mount.clientHeight)
    if (w === lastWidth && h === lastHeight) return
    lastWidth = w
    lastHeight = h
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, Math.sqrt(1900000 / (w * h))))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    frame(false)
  }
  markCatalog = buildCatalog(actors, (i) => select(i))
  bindTrials()
  resize()
  lighting(light)
  select(initialSitter(), false)
  toggle(playing)
  paper.dataset.ready = 'true'
  loader.hidden = true
  controls.addEventListener('change', () => {
    dirty = true
  })
  controls.addEventListener('start', () => {
    tracking = true
    dirty = true
  })
  controls.addEventListener('end', () => {
    tracking = false
    dirty = true
  })
  $('previous').addEventListener('click', () => previousNext(-1))
  $('next').addEventListener('click', () => previousNext(1))
  for (const b of document.querySelectorAll('[data-view-choice]'))
    b.addEventListener('click', () => setView(b.dataset.viewChoice))
  for (const b of document.querySelectorAll('[data-light-choice]'))
    b.addEventListener('click', () => lighting(b.dataset.lightChoice))
  for (const b of document.querySelectorAll('[data-hand]'))
    b.addEventListener('click', () => {
      hand = b.dataset.hand
      selectButtons('[data-hand]', 'hand', hand)
      frame(true)
    })
  for (const b of document.querySelectorAll('[data-zoom]'))
    b.addEventListener('click', () => zoom(b.dataset.zoom === 'in' ? 0.82 : 1 / 0.82))
  $('reset-view').addEventListener('click', () => {
    if (view === 'full') measure()
    frame(true)
  })
  play.addEventListener('click', () => toggle(!playing))
  scrub.addEventListener('input', () => {
    toggle(false)
    time = (period * Number(scrub.value)) / 1000
    actorPose()
    follow()
    timeDisplay()
    dirty = true
  })
  canvas.addEventListener('keydown', (e) => {
    const map = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }
    if (map[e.key]) {
      e.preventDefault()
      orbit(...map[e.key])
    } else if (['+', '=', '-', ' '].includes(e.key)) {
      e.preventDefault()
      if (e.key === ' ') toggle(!playing)
      else zoom(e.key === '-' ? 1.12 : 1 / 1.12)
    }
  })
  addEventListener('hashchange', () => select(initialSitter(), false))
  new ResizeObserver(resize).observe(mount)
  document.addEventListener('visibilitychange', () => {
    last = performance.now()
    dirty = true
  })
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    loader.textContent = '正在恢复三维画面…'
    loader.hidden = false
  })
  canvas.addEventListener('webglcontextrestored', () => {
    loader.hidden = true
    renderer.shadowMap.needsUpdate = true
    dirty = true
    last = performance.now()
  })
  function draw(now) {
    requestAnimationFrame(draw)
    if (document.hidden || !current || renderer.getContext().isContextLost()) return
    if (playing) {
      time += Math.min(0.14, Math.max(0, (now - last) / 1000))
      actorPose()
      follow()
      timeDisplay()
      dirty = true
    }
    last = now
    controls.update()
    if (dirty || tracking) {
      renderer.render(scene, camera)
      dirty = false
    }
  }
  renderer.render(scene, camera)
  requestAnimationFrame(draw)
}
try {
  studio()
} catch (error) {
  console.error(error)
  const loader = $('loading')
  loader.textContent = /webgl|context/i.test(String(error))
    ? '三维显示启动失败，请启用 WebGL 2 后刷新页面。'
    : '人物载入失败，请刷新页面后重试。'
  loader.hidden = false
}
