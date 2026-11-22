import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
const result = await build({
  entryPoints: ['src/main.js'],
  format: 'iife',
  bundle: true,
  minify: true,
  write: false,
  legalComments: 'inline',
  target: ['es2020'],
  define: { __CITY_REVIEW__: 'false' },
})
const shell = await readFile('shell.html', 'utf8')
async function arrivalCovers(shape) {
  const [night, day] = await Promise.all([
    readFile('cover-' + shape + '.webp'),
    readFile('cover-day-' + shape + '.webp'),
  ])
  return (
    '.arrival{background-image:url("data:image/webp;base64,' + night.toString('base64') + '")}' +
    '[data-mode="day"] .arrival{background-image:url("data:image/webp;base64,' + day.toString('base64') + '")}'
  )
}
const [wide, tall] = await Promise.all([arrivalCovers('wide'), arrivalCovers('tall')])
const arrival = wide + '@media(max-aspect-ratio:4/5){' + tall + '}'
const licenses = await Promise.all(
  ['three', 'three-mesh-bvh'].map(
    async (name) => name + '\n' + (await readFile('node_modules/' + name + '/LICENSE', 'utf8'))
  )
)
const script = result.outputFiles[0].text.replace(/[\t ]+$/gm, '').replace(/<\/script/gi, '<\\/script')
await writeFile(
  'index.html',
  shell
    .replace('/* ARRIVAL_PHOTOS */', () => arrival)
    .replace('</head>', () => `<!-- ${licenses.join('\n')} -->\n</head>`)
    .replace('/* COURTYARD */', () => script)
)
