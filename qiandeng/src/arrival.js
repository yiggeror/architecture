// A still ink impression underneath the swinging silk lantern. The print is drawn
// once per size so it takes no animation frames away from the city renderer.
function seededInk(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function printRiver(canvas, lamp) {
  const width = canvas.clientWidth, height = canvas.clientHeight
  if (!width || !height) return
  const density = Math.min(devicePixelRatio || 1, 1.6, 2100 / width, Math.sqrt(2800000 / (width * height)))
  const pixelsWide = Math.round(width * density), pixelsHigh = Math.round(height * density)
  if (canvas.width === pixelsWide && canvas.height === pixelsHigh && canvas.dataset.printed) return
  canvas.width = pixelsWide
  canvas.height = pixelsHigh
  const ink = canvas.getContext('2d')
  if (!ink) return
  canvas.dataset.printed = 'true'
  ink.scale(density, density)
  ink.lineCap = 'round'
  const random = seededInk(619033)
  const lampBox = lamp.getBoundingClientRect()
  const lightX = lampBox.left + lampBox.width / 2
  const waterY = lampBox.top + lampBox.height * .959
  const horizon = waterY - Math.min(height * .16, lampBox.height * .22)
  const depth = height - horizon
  const printScale = Math.min(1.65, Math.max(.68, lampBox.height / 670))
  const plane = ink.createLinearGradient(0, horizon, 0, height)
  plane.addColorStop(0, 'rgba(13,36,46,0)')
  plane.addColorStop(.31, 'rgba(22,49,57,.42)')
  plane.addColorStop(.69, 'rgba(13,39,49,.76)')
  plane.addColorStop(1, 'rgba(7,25,36,.92)')
  ink.fillStyle = plane
  ink.fillRect(0, horizon, width, depth)
  ink.save()
  ink.translate(lightX, waterY + depth * .26)
  ink.scale(Math.min(width * .21, lampBox.height * .37), depth * .65)
  const reflectionWash = ink.createRadialGradient(0, 0, 0, 0, 0, 1)
  reflectionWash.addColorStop(0, 'rgba(186,144,86,.10)')
  reflectionWash.addColorStop(.53, 'rgba(143,142,100,.045)')
  reflectionWash.addColorStop(1, 'rgba(115,125,111,0)')
  ink.fillStyle = reflectionWash
  ink.fillRect(-1, -1, 2, 2)
  ink.restore()

  // Oblique rain catches a little light along the silk and disappears in the sky.
  for (let i = 0; i < Math.min(290, width * .2); i++) {
    const x = random() * width, y = random() * waterY
    const near = Math.exp(-Math.abs(x - lightX) / (width * .29))
    const length = (2 + 11 * random()) * printScale
    ink.strokeStyle = 'rgba(164,189,180,' + (.027 + .105 * near * random()) + ')'
    ink.lineWidth = (.42 + .35 * random()) * printScale
    ink.beginPath()
    ink.moveTo(x, y)
    ink.lineTo(x - length * .24, y + length)
    ink.stroke()
  }

  // Short, staggered incisions follow the perspective of the water surface.
  for (let row = 0; row < 66; row++) {
    const t = ((row + .3 * random()) / 66) ** 1.48
    const y = horizon + t * depth
    for (let x = -30; x < width; ) {
      x += (3 + random() * 54) * printScale
      const length = (4 + random() ** 2 * (48 + 137 * t)) * printScale
      const bend = (random() - .32) * (1.1 + 5 * t) * printScale
      const light = random() > .32
      const opacity = (.065 + .22 * t) * (.32 + random() * .76)
      ink.strokeStyle = (light ? 'rgba(121,157,148,' : 'rgba(2,20,28,') + opacity + ')'
      ink.lineWidth = (.4 + t * .65 + random() * .27) * printScale
      ink.beginPath()
      ink.moveTo(x, y)
      ink.bezierCurveTo(x + length * .32, y + bend, x + length * .69, y + bend * .84, x + length, y - bend * .14)
      ink.stroke()
      x += length
    }
  }

  // Long, shallow eddies interrupt the shorter cuts at the near bank.
  for (let i = 0; i < 72; i++) {
    const t = .14 + .87 * random()
    const x = (random() * 1.12 - .12) * width, y = horizon + depth * t
    const length = (48 + random() * 125) * (t + .28) * printScale
    const lift = (1.3 + random() * 3.2) * t * printScale
    ink.strokeStyle = 'rgba(111,152,145,' + (.09 + .15 * random()) + ')'
    ink.lineWidth = (.56 + .39 * t) * printScale
    ink.beginPath()
    ink.moveTo(x, y)
    ink.bezierCurveTo(x + length * .22, y + lift, x + length * .31, y + lift, x + length * .51, y - lift * .32)
    ink.bezierCurveTo(x + length * .7, y - lift * 1.6, x + length * .78, y + lift * .18, x + length, y - lift * .11)
    ink.stroke()
  }

  // Broken copper and ivory reflections interleave with the blue-green ink.
  for (let i = 0; i < 136; i++) {
    const t = i / 135
    const y = horizon + depth * (.10 + .91 * t ** 1.21)
    const radius = (6 + 108 * t ** .64) * printScale
    const center = lightX + Math.sin(t * 10) * (1.5 + t * 12) * printScale
    const strength = .35 + .65 * Math.exp(-((t - .62) ** 2) / .15)
    const cuts = 2 + Math.floor(random() * 4)
    for (let j = 0; j < cuts; j++) {
      const offset = (random() - random()) * radius
      const x = center + offset
      const length = (2 + random() ** 1.55 * (11 + t * 45)) * printScale
      const alpha = (.13 + .61 * random()) * strength * (1 - .59 * Math.min(1, Math.abs(offset) / radius))
      ink.fillStyle = (random() > .58 ? 'rgba(235,202,136,' : 'rgba(191,144,88,') + alpha + ')'
      const thick = (.52 + t * (.72 + random() * .85)) * printScale
      ink.beginPath()
      ink.moveTo(x - length * .57, y)
      ink.quadraticCurveTo(x - length * .12, y - thick * .92, x + length * .54, y - thick * .26)
      ink.quadraticCurveTo(x, y + thick, x - length * .57, y)
      ink.fill()
    }
  }

  // Interrupt each ring in different places, as an engraver would lift the knife.
  function ring(x, y, radius, ratio, warmth, opacity) {
    let angle = random() - .7
    ink.lineWidth = (.55 + .33 * random()) * printScale
    for (let cut = 0; cut < 4; cut++) {
      const extent = .55 + random() * .78
      ink.strokeStyle = (warmth && cut % 2 ? 'rgba(219,181,116,' : 'rgba(131,171,162,') + opacity + ')'
      ink.beginPath()
      ink.ellipse(x, y, radius, radius * ratio, -.012, angle, angle + extent)
      ink.stroke()
      angle += extent + .16 + random() * .25
    }
  }
  const surfaceScale = Math.min(width * .0018, printScale)
  for (const [index, r] of [10, 19, 32, 51, 76, 107, 149].entries()) {
    ring(lightX, waterY, r * surfaceScale, .137, true, .66 - index * .065)
  }
  const drops = [[.17,.24,.95],[.08,.70,1.1],[.32,.44,.75],[.41,.77,1.4],[.56,.56,.65],[.80,.24,.93],[.9,.69,1.25],[.97,.39,.65],[.69,.91,.81],[.27,.89,.67],[.56,.14,.43]]
  for (const [u, v, size] of drops) {
    const x = width * u, y = horizon + depth * v
    const radius = (7 + 19 * v) * size * surfaceScale
    for (let i = 1; i <= 3; i++) {
      ring(x, y, radius * (.36 + i * .64), .11 + v * .028, false, .28 - i * .045)
    }
  }

  // A few reeds in the near bank keep the foreground in scale.
  ink.save()
  ink.translate(width * .075, height * 1.017)
  const bankScale = Math.min(width * .0014, height * .00125)
  ink.scale(bankScale, bankScale)
  for (let i = 0; i < 17; i++) {
    const foot = random() * 115 - 60
    const rise = 25 + random() ** 1.4 * 104
    const lean = (random() - .42) * 94
    const tip = foot + lean
    ink.fillStyle = i % 3 ? '#142e35' : '#233d41'
    ink.strokeStyle = 'rgba(119,142,121,.36)'
    ink.lineWidth = .75
    ink.beginPath()
    ink.moveTo(foot, 2)
    ink.quadraticCurveTo(foot + lean * .36, -rise * .68, tip, -rise)
    ink.quadraticCurveTo(foot + lean * .28 + 2, -rise * .48, foot + 3, 1)
    ink.fill()
    ink.beginPath()
    ink.moveTo(foot, 1)
    ink.quadraticCurveTo(foot + lean * .36, -rise * .68, tip, -rise)
    ink.stroke()
    if (i % 5 === 0) {
      for (let j = 0; j < 9; j++) {
        const at = j / 9
        const xx = tip - lean * .16 * at, yy = -rise + (18 + rise * .075) * at
        ink.beginPath()
        ink.moveTo(xx, yy + 3)
        ink.quadraticCurveTo(xx - 7, yy - 1, xx - 7.5 - j * .55, yy - 6)
        ink.quadraticCurveTo(xx - 2, yy - 3, xx + .8, yy + 2)
        ink.fill()
        ink.stroke()
      }
    }
  }
  ink.restore()
}

const initialHash = location.hash.slice(1)
const light = new URLSearchParams(initialHash)
document.documentElement.dataset.mode =
  initialHash === 'day' || light.get('light') === 'day' || light.get('mode') === 'day' ? 'day' : 'night'

window.showLoadingError = (message) => {
  const notice = document.getElementById('loading-error')
  notice.textContent = message
  notice.hidden = false
  document.getElementById('court').setAttribute('aria-busy', 'false')
  document.querySelector('.loading-measure')?.setAttribute('hidden', '')
}

function mountArrival() {
  const arrival = document.getElementById('arrival')
  const court = document.getElementById('court')
  const canvas = document.getElementById('river-print')
  const lamp = arrival.querySelector('.arrival-lamp')
  const status = document.getElementById('loading')
  const count = document.getElementById('loading-count')
  const ruler = arrival.querySelector('.loading-ruler')
  let observer

  window.updateLoading = (label, completed, total) => {
    if (label) status.textContent = completed === total ? label : '正在载入' + label + '…'
    if (!(Number.isFinite(completed) && Number.isFinite(total) && total > 0)) return
    const value = Math.max(0, Math.min(total, completed))
    ruler.style.setProperty('--progress', value / total)
    ruler.setAttribute('aria-valuemax', total)
    ruler.setAttribute('aria-valuenow', value)
    count.textContent = String(value).padStart(2, '0') + ' / ' + String(total).padStart(2, '0')
  }
  window.finishLoading = () => {
    if (arrival.hasAttribute('data-leaving')) return
    document.documentElement.dataset.ready = 'true'
    court.setAttribute('aria-busy', 'false')
    court.removeAttribute('inert')
    arrival.setAttribute('aria-hidden', 'true')
    arrival.setAttribute('data-leaving', '')
    observer?.disconnect()
    const release = () => {
      arrival.remove()
      canvas.width = canvas.height = 1
      window.updateLoading = window.finishLoading = () => {}
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      queueMicrotask(release)
    } else {
      const fallback = setTimeout(release, 450)
      arrival.addEventListener('transitionend', (event) => {
        if (event.target !== arrival || event.propertyName !== 'opacity') return
        clearTimeout(fallback)
        release()
      })
    }
  }

  const paint = () => printRiver(canvas, lamp)
  paint()
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(paint)
    observer.observe(arrival)
  }
}
mountArrival()
