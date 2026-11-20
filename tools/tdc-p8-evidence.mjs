import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const modRoot = fileURLToPath(new URL('../', import.meta.url))
export const hallRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const artifactRoot = join(hallRoot, 'artifacts/migration/tdc/p8')
export const sha256 = value => createHash('sha256').update(value).digest('hex')

function filesIn(relative) {
  return readdirSync(join(modRoot, relative), { withFileTypes: true }).flatMap(entry => {
    const path = `${relative}/${entry.name}`
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

export function browserSources(scenarios) {
  const files = [
    ...filesIn('content/campaigns/theDrownedCity'),
    ...filesIn('src/cards/encounter-entries/theDrownedCity'),
    ...scenarios.flatMap(({ id }) => [`content/scenario-guide-sources/${id}.json`, `web/scenario-guides/${id}.json`]),
    'content/packs/tdcCampaign/manifest.js', 'content/registered.js', 'content/registry.js', 'index.js',
    'src/engine/engine.js', 'src/engine/campaign-flow.js', 'src/engine/setup.js', 'src/engine/encounter.js', 'src/engine/moves.js',
    'src/campaign/campaign-flow.js', 'web/scenario-setup-view.js',
    'src/integration/observation.js', 'src/integration/hall-integration.js', 'web/hub.js', 'web/game-ui.js',
    'tools/run-tdc-release-browser.mjs', 'tools/tdc-p8-evidence.mjs',
  ]
  return Object.fromEntries(files.sort().map(file => [file, sha256(readFileSync(join(modRoot, file)))]))
}
