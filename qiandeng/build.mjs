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
const [city, studio, arrival, cityShell, studioShell, ...licenses] = await Promise.all([
  bundle('src/main.js'),
  bundle('src/characterStudio.js'),
  bundle('src/arrival.js'),
  readFile('shell.html', 'utf8'),
  readFile('studio-shell.html', 'utf8'),
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
      .replace('/* ARRIVAL */', () => arrival)
      .replace('/* COURTYARD */', () => city),
  ),
  writeFile(
    'studio.html',
    credit(studioShell).replace('/* CHARACTER_STUDIO */', () => studio),
  ),
])
