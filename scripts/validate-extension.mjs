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
if (manifest.permissions?.includes('<all_urls>')) throw new Error('<all_urls> belongs in host_permissions, not permissions')
if (!manifest.host_permissions?.some((entry) => entry === '<all_urls>' || entry.startsWith('http'))) throw new Error('Manifest has no web page host permission: the extension could not read the active tab')
const scripts = (manifest.content_scripts || []).flatMap((entry) => entry.js || [])
if (!scripts.length) throw new Error('Manifest has no content_scripts: the extension could not read pages')
for (const file of scripts) if (!existsSync(join(packageDir, file))) throw new Error(`Missing content script: ${file}`)
console.log(`Validated installable Chrome extension: ${packageDir}`)
