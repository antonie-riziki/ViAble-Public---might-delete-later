import { existsSync, mkdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = process.argv[2] === 'all' ? ['chrome', 'edge', 'firefox'] : [process.argv[2] || 'chrome']
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

for (const target of targets) {
  const outputDir = join(root, 'release', target)
  rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })
  const result = spawnSync(process.execPath, [viteBin, 'build', '--outDir', outputDir, '--emptyOutDir'], { cwd: root, stdio: 'inherit', env: { ...process.env, VIABLE_EXTENSION_TARGET: target } })
  if (result.status !== 0) process.exit(result.status || 1)

  const manifest = join(root, 'scripts', 'manifests', `manifest.${target}.json`)
  copyFileSync(manifest, join(outputDir, 'manifest.json'))
  for (const developmentAsset of ['brand/logo-reference.png', 'brand/architecture-board-reference.png']) {
    rmSync(join(outputDir, developmentAsset), { force: true })
  }
  if (target === 'firefox') copyFileSync(join(outputDir, 'index.html'), join(outputDir, 'sidebar.html'))

  const packageManifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8'))
  if (!existsSync(join(outputDir, packageManifest.options_page || 'options.html'))) throw new Error(`${target}: missing options page`)
  writeFileSync(join(outputDir, 'BUILD_TARGET'), `${target}\n`, 'utf8')
  console.log(`Built ${target} extension at ${outputDir}`)
}
