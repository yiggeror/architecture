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
const covers = await Promise.all(
  ['wide', 'tall'].map(async (key) => {
    const data = await readFile('cover-' + key + '.webp')
    return 'url("data:image/webp;base64,' + data.toString('base64') + '")'
  })
)
const arrival =
  '.arrival{background-image:' +
  covers[0] +
  '}@media(max-aspect-ratio:4/5){.arrival{background-image:' +
  covers[1] +
  '}}'
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
