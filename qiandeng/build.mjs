import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'

async function bundle(entry) {
  const result = await build({
    entryPoints: [entry],
    format: 'iife',
    bundle: true,
    minify: true,
    write: false,
    legalComments: 'inline',
    target: ['es2020'],
    define: { __CITY_REVIEW__: 'false' },
  })
  return result.outputFiles[0].text.replace(/[\t ]+$/gm, '').replace(/<\/script/gi, '<\\/script')
}
async function arrivalCovers(shape) {
  const [night, day] = await Promise.all([
    readFile('cover-' + shape + '.webp'),
    readFile('cover-day-' + shape + '.webp'),
  ])
  return (
    '.arrival{background-image:url("data:image/webp;base64,' +
    night.toString('base64') +
    '")}' +
    '[data-mode="day"] .arrival{background-image:url("data:image/webp;base64,' +
    day.toString('base64') +
    '")}'
  )
}
const [city, studio, cityShell, studioShell, wide, tall, ...licenses] = await Promise.all([
  bundle('src/main.js'),
  bundle('src/characterStudio.js'),
  readFile('shell.html', 'utf8'),
  readFile('studio-shell.html', 'utf8'),
  arrivalCovers('wide'),
  arrivalCovers('tall'),
  ...['three', 'three-mesh-bvh'].map(
    async (name) => name + '\n' + (await readFile('node_modules/' + name + '/LICENSE', 'utf8')),
  ),
])
function credit(html) {
  return html.replace('</head>', () => `<!-- ${licenses.join('\n')} -->\n</head>`)
}
await Promise.all([
  writeFile(
    'index.html',
    credit(cityShell)
      .replace('/* ARRIVAL_PHOTOS */', () => wide + '@media(max-aspect-ratio:4/5){' + tall + '}')
      .replace('/* COURTYARD */', () => city),
  ),
  writeFile(
    'studio.html',
    credit(studioShell).replace('/* CHARACTER_STUDIO */', () => studio),
  ),
])
