import * as T from 'three'
import { stations, framePanorama } from './stations.js'

const clamp = T.MathUtils.clamp
const pitchLimit = Math.PI / 2 - 0.005
const lowSpeed = 10

function altitudeBonus(y) {
  return clamp((y - 6) * 0.49, 0, 98)
}
const controls = new Set([
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
])

export function navigation(canvas, camera, world) {
  const nav = document.getElementById('viewpoints')
  const stick = document.getElementById('stick')
  const knob = stick.querySelector('.knob')
  const held = new Set()
  const axis = new T.Vector2()
  const direction = new T.Vector3(),
    previous = new T.Vector3()
  let yaw = 0,
    pitch = 0,
    selected = -1
  let lookPointer = null,
    stickPointer = null
  let lastTime = performance.now()

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

  function orient() {
    camera.rotation.set(pitch, -yaw, 0, 'YXZ')
    camera.updateMatrixWorld()
  }

  function turn(horizontal, vertical) {
    const nextPitch = clamp(pitch + vertical, -pitchLimit, pitchLimit)
    if (!horizontal && pitch === nextPitch) return
    yaw += horizontal
    pitch = nextPitch
    orient()
    world.prefetch?.(camera.position, camera.getWorldDirection(direction))
    select(-1)
  }

  function translate(side, up, forward, distance, limitLength = false) {
    if (!side && !up && !forward) return
    // Gaze supplies all three forward components. Camera right stays level
    // even when looking almost straight up or down.
    camera.getWorldDirection(direction).multiplyScalar(forward)
    direction.x += side * Math.cos(yaw)
    direction.y += up
    direction.z += side * Math.sin(yaw)
    if (limitLength) direction.clampLength(0, 1)
    direction.multiplyScalar(distance)
    previous.copy(camera.position)
    world.move(camera.position, direction.x, direction.y, direction.z, 0)
    if (!previous.equals(camera.position)) {
      camera.updateMatrixWorld()
      world.prefetch?.(camera.position, direction)
      select(-1)
    }
  }

  function step(now) {
    // A long foreground render still counts as held input. A hidden or
    // suspended document clears its inputs before the next visible frame.
    const dt = Math.max(0, (now - lastTime) / 1000)
    lastTime = Math.max(lastTime, now)
    if (!dt || (!held.size && !axis.lengthSq())) return
    const key = (code) => Number(held.has(code))
    turn((key('ArrowRight') - key('ArrowLeft')) * 1.7 * dt, (key('ArrowUp') - key('ArrowDown')) * 1.45 * dt)
    const bonus = altitudeBonus(camera.position.y)
    const cruise = lowSpeed + bonus
    const radius = axis.length()
    // The long-distance speed enters late in the thumb's travel. Half a throw
    // still lets someone follow a parapet or approach an upper-storey window.
    const throttle = radius ** 1.75
    const stickGain = radius ? (lowSpeed * throttle + bonus * throttle ** 3) / (cruise * radius) : 0
    const side = axis.x * stickGain + key('KeyD') - key('KeyA')
    const forward = axis.y * stickGain + key('KeyW') - key('KeyS')
    const vertical = key('KeyE') - key('KeyQ')
    const fast = held.has('ShiftLeft') || held.has('ShiftRight')
    translate(side, vertical, forward, dt * cruise * (fast ? 2 : 1), true)
  }

  function resetStick() {
    axis.set(0, 0)
    knob.style.transform = ''
    stick.removeAttribute('data-active')
  }

  function stopInputs() {
    held.clear()
    if (lookPointer && canvas.hasPointerCapture(lookPointer.id)) canvas.releasePointerCapture(lookPointer.id)
    if (stickPointer !== null && stick.hasPointerCapture(stickPointer))
      stick.releasePointerCapture(stickPointer)
    lookPointer = stickPointer = null
    canvas.removeAttribute('data-dragging')
    resetStick()
    lastTime = performance.now()
  }

  function placeStation(station) {
    const narrow = camera.aspect < 0.81
    const eye = (narrow && station.portraitEye) || station.eye,
      target = (narrow && station.portraitTarget) || station.target
    camera.position.fromArray(eye)
    if (station.panorama) framePanorama(camera, station)
    const dx = target[0] - eye[0],
      dy = target[1] - eye[1],
      dz = target[2] - eye[2]
    yaw = Math.atan2(dx, -dz)
    pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -pitchLimit, pitchLimit)
    orient()
    world.prefetch?.(camera.position, camera.getWorldDirection(direction))
  }

  function jump(i) {
    stopInputs()
    placeStation(stations[i])
    select(i)
  }

  addEventListener('resize', () =>
    requestAnimationFrame(() => {
      // The renderer updates the perspective lens during the resize event.
      const station = stations[selected]
      if (station?.panorama || station?.portraitEye) placeStation(station)
    }),
  )

  addEventListener('keydown', (e) => {
    if (!controls.has(e.code) || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return
    // Let Shift+Tab and other native focus shortcuts work normally.
    if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') e.preventDefault()
    if (!e.repeat && !held.has(e.code)) {
      step(performance.now())
      held.add(e.code)
    }
  })
  addEventListener('keyup', (e) => {
    if (!held.has(e.code)) return
    step(performance.now())
    held.delete(e.code)
  })
  addEventListener('blur', stopInputs)
  addEventListener('pagehide', stopInputs)
  document.addEventListener('freeze', stopInputs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopInputs()
  })

  const court = document.getElementById('court')
  court.addEventListener('contextmenu', (e) => e.preventDefault())
  court.addEventListener('selectstart', (e) => e.preventDefault())
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-keyshortcuts', 'W A S D E Q ArrowUp ArrowDown ArrowLeft ArrowRight')
  canvas.addEventListener('pointerdown', (e) => {
    if (lookPointer || (e.button !== 0 && !(e.pointerType === 'mouse' && e.button === 2))) return
    e.preventDefault()
    canvas.focus({ preventScroll: true })
    lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: e.button === 2 }
    canvas.setPointerCapture(e.pointerId)
    canvas.setAttribute('data-dragging', '')
  })
  canvas.addEventListener('pointermove', (e) => {
    if (lookPointer?.id !== e.pointerId) return
    step(performance.now())
    const dx = e.clientX - lookPointer.x,
      dy = e.clientY - lookPointer.y
    lookPointer.x = e.clientX
    lookPointer.y = e.clientY
    if (lookPointer.pan) {
      translate(dx, -dy, 0, 0.009)
    } else if (e.pointerType === 'touch') {
      const span = clamp(Math.min(canvas.clientWidth, canvas.clientHeight), 320, 580)
      turn((dx * 2.05) / span, (-dy * 1.95) / span)
    } else {
      turn(dx * 0.004, -dy * 0.0038)
    }
  })

  function onRelease(element, release) {
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      element.addEventListener(event, release)
  }

  onRelease(canvas, (e) => {
    if (lookPointer?.id !== e.pointerId) return
    lookPointer = null
    canvas.removeAttribute('data-dragging')
  })
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return
      e.preventDefault()
      step(performance.now())
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1
      const side = clamp(e.deltaX * unit * 0.005, -2, 2)
      const forward = clamp(-e.deltaY * unit * 0.009, -2, 2)
      translate(side, 0, forward, (lowSpeed + altitudeBonus(camera.position.y)) / 4.2)
    },
    { passive: false },
  )

  function readStick(e) {
    const rect = stick.getBoundingClientRect()
    const travel = rect.width * 0.31
    axis.set(
      (e.clientX - rect.left - rect.width / 2) / travel,
      (rect.top + rect.height / 2 - e.clientY) / travel,
    )
    // A small axial dead zone lets a thumb fly straight without pixel precision.
    if (Math.abs(axis.x) < 0.1) axis.x = 0
    if (Math.abs(axis.y) < 0.1) axis.y = 0
    axis.clampLength(0, 1)
    knob.style.transform = 'translate(' + axis.x * travel + 'px, ' + -axis.y * travel + 'px)'
  }
  stick.addEventListener('pointerdown', (e) => {
    if (stickPointer !== null || e.button !== 0) return
    e.preventDefault()
    step(performance.now())
    stickPointer = e.pointerId
    stick.setPointerCapture(e.pointerId)
    stick.setAttribute('data-active', '')
    readStick(e)
  })
  stick.addEventListener('pointermove', (e) => {
    if (stickPointer !== e.pointerId) return
    step(performance.now())
    readStick(e)
  })
  onRelease(stick, (e) => {
    if (stickPointer !== e.pointerId) return
    step(performance.now())
    stickPointer = null
    resetStick()
  })

  jump(0)
  return {
    step,
    resize() {
      const s = stations[selected]
      if (s?.panorama || s?.portraitEye) placeStation(s)
    },
  }
}
