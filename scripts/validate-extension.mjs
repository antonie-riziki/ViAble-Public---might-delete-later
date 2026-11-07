import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const packageDir = resolve(process.argv[2] || 'release/chrome')
const manifestPath = join(packageDir, 'manifest.json')
if (!existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const required = ['index.html', 'options.html', 'background/service-worker.js', 'brand/icon16.png', 'brand/icon32.png', 'brand/icon48.png', 'brand/icon128.png']
for (const file of required) if (!existsSync(join(packageDir, file))) throw new Error(`Missing extension asset: ${file}`)
if (manifest.manifest_version !== 3) throw new Error('Chrome validation requires Manifest V3')
if (manifest.side_panel?.default_path !== 'index.html') throw new Error('Chrome side panel must point to index.html')
if (manifest.permissions?.includes('<all_urls>')) throw new Error('Broad <all_urls> permission is not allowed')
console.log(`Validated installable Chrome extension: ${packageDir}`)
