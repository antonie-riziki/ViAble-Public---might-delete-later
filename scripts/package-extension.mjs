import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const target = process.argv[2] || 'chrome'
const build = spawnSync(process.execPath, [join(root, 'scripts', 'build-extension.mjs'), target], { cwd: root, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status || 1)

const releaseDir = join(root, 'release')
const sourceDir = join(releaseDir, target)
const zipPath = join(releaseDir, `ViAble-${target}.zip`)
mkdirSync(releaseDir, { recursive: true })
rmSync(zipPath, { force: true })
const result = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: sourceDir, stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status || 1)
console.log(`Packaged ${zipPath}`)
