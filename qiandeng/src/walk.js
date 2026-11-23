import * as T from 'three'
import { stations, framePanorama, updateLens } from './stations.js'

const clamp = T.MathUtils.clamp
const pitchLimit = Math.PI / 2 - 0.005
const lowSpeed = 10
const maxFlightMs = 100
const firstFrameMs = 1000 / 60

function altitudeBonus(y) {
  return clamp((y - 6) * 0.49, 0, 98)
}
const controls = Object.fromEntries([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
].map((code, index) => [code, 1 << index]))
const shiftKeys = controls.ShiftLeft | controls.ShiftRight
const keyAxis = (keys, positive, negative) => Number(Boolean(keys & positive)) - Number(Boolean(keys & negative))
const active = (keys, x, y) => Boolean((keys & ~shiftKeys) || x || y)

function eventTime(event) {
  const now = performance.now()
  // Older WebKit uses epoch milliseconds for DOM events.
  const time = event.timeStamp > 1e12 ? event.timeStamp - performance.timeOrigin : event.timeStamp
  return Number.isFinite(time) && time >= 0 ? Math.min(time, now) : now
}

export function navigation(canvas, camera, world) {
  const nav = document.getElementById('viewpoints')
  const stick = document.getElementById('stick')
  const knob = stick.querySelector('.knob')
  const axis = new T.Vector2()
  const pan = new T.Vector2()
  const wheelSide = new T.Vector3(), wheelForward = new T.Vector3()
  const direction = new T.Vector3(), travel = new T.Vector3(),
    previous = new T.Vector3()
  let selected = -1, viewChanged = false
  let lookPointer = null,
    stickPointer = null
  let held = 0, stickX = 0, stickY = 0
  const spans = []
  let sampledAt = performance.now(), lastFrame = sampledAt, clearedAt = sampledAt, firstPush = null

  const buttons = stations.map(({ label }, i) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.station = String(i)
    button.textContent = label
    button.addEventListener('click', () => jump(i))
    nav.append(button)
    return button
  })

  function select(i) {
    if (selected === i) return
    selected = i
    buttons.forEach((btn, j) => btn.setAttribute('aria-pressed', String(j === i)))
  }

  function orient(yaw, pitch) {
    camera.rotation.set(pitch, -yaw, 0, 'YXZ')
    camera.updateMatrixWorld()
  }

  function turn(horizontal, vertical) {
    const pitch = camera.rotation.x
    const nextPitch = clamp(pitch + vertical, -pitchLimit, pitchLimit)
    if (!horizontal && pitch === nextPitch) return
    orient(-camera.rotation.y + horizontal, nextPitch)
    viewChanged = true
    select(-1)
  }

  function addTravel(side, up, forward, distance, yaw, pitch, limitLength = false) {
    if (!side && !up && !forward) return
    // Gaze supplies all three forward components. Camera right stays level
    // even when looking almost straight up or down.
    const ahead = forward * Math.cos(pitch), sin = Math.sin(yaw), cos = Math.cos(yaw)
    direction.set(ahead * sin + side * cos, up + forward * Math.sin(pitch), -ahead * cos + side * sin)
    if (limitLength) direction.clampLength(0, 1)
    travel.addScaledVector(direction, distance)
  }

  // Close the interval under the old controls and gaze before changing either.
  // A stalled renderer can receive many events; only the newest active spans
  // can fit in one drawable frame. Idle time never erases a completed tap.
  function sample(time) {
    const ms = Math.min(maxFlightMs, time - sampledAt)
    if (ms <= 0 || !active(held, stickX, stickY)) return
    sampledAt = time
    const yaw = -camera.rotation.y, pitch = camera.rotation.x
    const last = spans[spans.length - 1]
    // High-polling pointers can supply several samples in one millisecond.
    // Preserve their time and average their axes before the next sweep.
    if (last && last.held === held && last.stick === stickPointer && last.onset === firstPush && last.ms < 2 && ms < 2) {
      last.ms += ms
      const weight = ms / last.ms
      last.x += (stickX - last.x) * weight
      last.y += (stickY - last.y) * weight
      last.yaw += (yaw - last.yaw) * weight
      last.pitch += (pitch - last.pitch) * weight
      return
    }
    if (spans.length === 64) spans.shift()
    spans.push({ ms, held, x: stickX, y: stickY, stick: stickPointer, onset: firstPush, yaw, pitch })
  }

  function limitSpans(budget, onset) {
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i]
      if (onset && span.onset !== onset) break
      span.ms = active(span.held, span.x, span.y) ? Math.min(span.ms, budget) : 0
      budget -= span.ms
    }
  }

  function change(event, keys, x, y) {
    if (keys === held && x === stickX && y === stickY) return
    const time = eventTime(event), wasActive = active(held, stickX, stickY)
    if (time < clearedAt) return
    sample(time)
    held = keys
    stickX = x
    stickY = y
    if (!active(keys, x, y)) {
      // Once a hold has been shown, a late release should stop close to the
      // last visible position. An entire tap between draws keeps its duration.
      if (wasActive && firstPush === null && time - lastFrame > maxFlightMs) limitSpans(firstFrameMs)
      firstPush = null
    } else if (!wasActive) {
      sampledAt = time
      firstPush = { at: time }
    }
  }

  function step(now = performance.now()) {
    // A press can arrive just before submission. Show up to one frame of
    // the new command immediately, then count only time beyond that sample.
    const lead = Math.min(firstFrameMs, Math.max(0, now - lastFrame))
    sample(firstPush ? Math.max(now, firstPush.at + lead) : now)
    // If a press waited behind the renderer, start at one visible step. Keep
    // completed taps in this batch and resume the held speed from this draw.
    if (firstPush && Math.max(now - lastFrame, now - firstPush.at) > maxFlightMs)
      limitSpans(firstFrameMs, firstPush)
    firstPush = null
    lastFrame = now
    limitSpans(maxFlightMs)
    const bonus = altitudeBonus(camera.position.y), cruise = lowSpeed + bonus
    let turnYaw = 0, turnPitch = 0
    travel.set(0, 0, 0)
    for (const s of spans) {
      if (!s.ms) continue
      const dt = s.ms / 1000
      turnYaw += keyAxis(s.held, controls.ArrowRight, controls.ArrowLeft) * 1.7 * dt
      const pitchChange = keyAxis(s.held, controls.ArrowUp, controls.ArrowDown) * 1.45 * dt
      const pitch = clamp(s.pitch + turnPitch + pitchChange, -pitchLimit, pitchLimit)
      turnPitch = pitch - s.pitch
      const radius = Math.hypot(s.x, s.y), throttle = radius ** 1.75
      // The long-distance speed enters late in the thumb's travel.
      const gain = radius ? (lowSpeed * throttle + bonus * throttle ** 3) / (cruise * radius) : 0
      const side = s.x * gain + keyAxis(s.held, controls.KeyD, controls.KeyA)
      const forward = s.y * gain + keyAxis(s.held, controls.KeyW, controls.KeyS)
      const up = keyAxis(s.held, controls.KeyE, controls.KeyQ)
      addTravel(side, up, forward, dt * cruise * (s.held & shiftKeys ? 2 : 1), s.yaw + turnYaw, pitch, true)
    }
    spans.length = 0
    if (turnYaw || turnPitch) turn(turnYaw, turnPitch)
    const yaw = -camera.rotation.y, pitch = camera.rotation.x
    if (lookPointer?.pan) {
      pan.x += lookPointer.panX
      pan.y += lookPointer.panY
      lookPointer.panX = lookPointer.panY = 0
    }
    if (pan.x || pan.y) {
      const side = clamp(pan.x, -canvas.clientWidth, canvas.clientWidth)
      const up = clamp(pan.y, -canvas.clientHeight, canvas.clientHeight)
      addTravel(side, up, 0, .009, yaw, pitch)
    }
    travel.addScaledVector(wheelSide, cruise / 4.2).addScaledVector(wheelForward, cruise / 4.2)
    pan.set(0, 0)
    wheelSide.set(0, 0, 0)
    wheelForward.set(0, 0, 0)
    if (travel.lengthSq()) {
      previous.copy(camera.position)
      world.move(camera.position, travel.x, travel.y, travel.z, 0)
      if (!previous.equals(camera.position)) {
        camera.updateMatrixWorld()
        world.prefetch?.(camera.position, travel)
        viewChanged = false
        select(-1)
      }
    }
    if (viewChanged) world.prefetch?.(camera.position, camera.getWorldDirection(direction))
    viewChanged = false
  }

  function resetStick() {
    axis.set(0, 0)
    knob.style.transform = ''
    stick.removeAttribute('data-active')
  }

  function stopInputs() {
    held = stickX = stickY = 0
    firstPush = null
    spans.length = 0
    pan.set(0, 0)
    wheelSide.set(0, 0, 0)
    wheelForward.set(0, 0, 0)
    if (lookPointer && canvas.hasPointerCapture(lookPointer.id)) canvas.releasePointerCapture(lookPointer.id)
    if (stickPointer && stick.hasPointerCapture(stickPointer.id)) stick.releasePointerCapture(stickPointer.id)
    lookPointer = stickPointer = null
    canvas.removeAttribute('data-dragging')
    resetStick()
    clearedAt = sampledAt = lastFrame = performance.now()
  }

  function placeStation(station) {
    camera.userData.portraitLens = station.portraitLens
    updateLens(camera, camera.aspect, 1)
    const narrow = camera.aspect < 0.81
    const eye = (narrow && station.portraitEye) || station.eye,
      target = (narrow && station.portraitTarget) || station.target
    camera.position.fromArray(eye)
    if (station.panorama) framePanorama(camera, station)
    const dx = target[0] - eye[0],
      dy = target[1] - eye[1],
      dz = target[2] - eye[2]
    orient(Math.atan2(dx, -dz), clamp(Math.atan2(dy, Math.hypot(dx, dz)), -pitchLimit, pitchLimit))
    viewChanged = false
    world.prefetch?.(camera.position, camera.getWorldDirection(direction))
  }

  function jump(i) {
    stopInputs()
    placeStation(stations[i])
    select(i)
  }

  const court = document.getElementById('court')
  addEventListener('keydown', (e) => {
    const key = controls[e.code]
    if (court.inert || !key || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return
    // Let Shift+Tab and other native focus shortcuts work normally.
    if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') e.preventDefault()
    if (!e.repeat) change(e, held | key, stickX, stickY)
  })
  addEventListener('keyup', (e) => {
    const key = controls[e.code]
    if (held & key) change(e, held & ~key, stickX, stickY)
  })
  addEventListener('blur', stopInputs)
  addEventListener('pagehide', stopInputs)
  document.addEventListener('freeze', stopInputs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopInputs()
  })

  court.addEventListener('contextmenu', (e) => e.preventDefault())
  court.addEventListener('selectstart', (e) => e.preventDefault())
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-keyshortcuts', 'W A S D E Q ArrowUp ArrowDown ArrowLeft ArrowRight')
  canvas.addEventListener('pointerdown', (e) => {
    if (lookPointer || eventTime(e) < clearedAt || (e.button !== 0 && !(e.pointerType === 'mouse' && e.button === 2))) return
    e.preventDefault()
    canvas.focus({ preventScroll: true })
    lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: e.button === 2, panX: 0, panY: 0 }
    canvas.setPointerCapture(e.pointerId)
    canvas.setAttribute('data-dragging', '')
  })
  function readLook(e, scaleX, scaleY) {
    const time = eventTime(e)
    if (time < clearedAt) return
    const dx = e.clientX - lookPointer.x,
      dy = e.clientY - lookPointer.y
    lookPointer.x = e.clientX
    lookPointer.y = e.clientY
    if (!dx && !dy) return
    if (lookPointer.pan) {
      lookPointer.panX += dx
      lookPointer.panY -= dy
    } else {
      sample(time)
      turn(dx * scaleX, -dy * scaleY)
    }
  }
  canvas.addEventListener('pointermove', (e) => {
    if (lookPointer?.id !== e.pointerId || eventTime(e) < clearedAt) return
    const span = e.pointerType === 'touch' ? clamp(Math.min(canvas.clientWidth, canvas.clientHeight), 320, 580) : 0
    const scaleX = span ? 2.05 / span : .004, scaleY = span ? 1.95 / span : .0038
    for (const point of e.getCoalescedEvents?.() ?? []) readLook(point, scaleX, scaleY)
    readLook(e, scaleX, scaleY)
  })

  function onRelease(element, release) {
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      element.addEventListener(event, release)
  }

  onRelease(canvas, (e) => {
    if (lookPointer?.id !== e.pointerId || eventTime(e) < clearedAt) return
    if (e.type === 'pointerup' && lookPointer.pan) {
      pan.x += lookPointer.panX
      pan.y += lookPointer.panY
    }
    lookPointer = null
    canvas.removeAttribute('data-dragging')
  })
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || eventTime(e) < clearedAt) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1
      const side = clamp(e.deltaX * unit * .005, -2, 2), forward = clamp(-e.deltaY * unit * .009, -2, 2)
      const yaw = -camera.rotation.y
      wheelSide.addScaledVector(direction.set(Math.cos(yaw), 0, Math.sin(yaw)), side).clampLength(0, 2)
      wheelForward.addScaledVector(camera.getWorldDirection(direction), forward).clampLength(0, 2)
    },
    { passive: false },
  )

  function readStickPoint(e, rect, travel) {
    axis.set(
      (e.clientX - rect.left - rect.width / 2) / travel,
      (rect.top + rect.height / 2 - e.clientY) / travel,
    )
    // A small axial dead zone lets a thumb fly straight without pixel precision.
    if (Math.abs(axis.x) < 0.1) axis.x = 0
    if (Math.abs(axis.y) < 0.1) axis.y = 0
    axis.clampLength(0, 1)
    change(e, held, axis.x, axis.y)
  }
  function readStick(e) {
    const rect = stick.getBoundingClientRect(), travel = rect.width * 0.31
    if (!travel) return change(e, held, 0, 0)
    for (const point of e.getCoalescedEvents?.() ?? []) readStickPoint(point, rect, travel)
    readStickPoint(e, rect, travel)
    knob.style.transform = 'translate(' + axis.x * travel + 'px, ' + -axis.y * travel + 'px)'
  }
  stick.addEventListener('pointerdown', (e) => {
    if (stickPointer !== null || e.button !== 0 || eventTime(e) < clearedAt) return
    e.preventDefault()
    stickPointer = { id: e.pointerId }
    stick.setPointerCapture(e.pointerId)
    stick.setAttribute('data-active', '')
    readStick(e)
  })
  stick.addEventListener('pointermove', (e) => {
    if (stickPointer?.id !== e.pointerId || eventTime(e) < clearedAt) return
    readStick(e)
  })
  onRelease(stick, (e) => {
    if (stickPointer?.id !== e.pointerId || eventTime(e) < clearedAt) return
    change(e, held, 0, 0)
    if (e.type !== 'pointerup') {
      for (const span of spans) if (span.stick === stickPointer) span.x = span.y = 0
    }
    stickPointer = null
    resetStick()
  })

  jump(0)
  return {
    step,
    hasInput() {
      return Boolean(active(held, stickX, stickY) || spans.length || viewChanged ||
        wheelForward.lengthSq() || wheelSide.lengthSq() || pan.lengthSq() || lookPointer?.panX || lookPointer?.panY)
    },
    arrive(eye, target) {
      stopInputs()
      placeStation({ eye, target })
      select(-1)
    },
    resize() {
      const s = stations[selected]
      if (s?.panorama || s?.portraitEye) placeStation(s)
    },
  }
}
