import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { createContentRegistry, campaignListForUi } from '../content/registry.js'
import { scenarioZoneReport, countZone } from '../content/scenario-manifest.js'
import { packs } from '../content/packs/manifests.js'
import { sharedEncounterIdentities } from '../content/packs/shared-identities.js'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'
import * as masks from '../content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/index.js'
import * as devourer from '../content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/index.js'
import * as minimal from './fixtures/minimal-scenario.mjs'

const entries = [gathering, masks, devourer]

test('P1 三关使用同一注册 API 和可启动依赖', () => {
  assert.deepEqual(contentRegistry.listScenarios('nightOfTheZealot').map(entry => entry.id),
    ['theGathering', 'theMidnightMasks', 'theDevourerBelow'])
  assert.equal(contentRegistry.assertLaunchable('nightOfTheZealot').id, 'nightOfTheZealot')
  for (const entry of entries) {
    assert.equal(contentRegistry.getScenarioData(entry.manifest.id), entry.scenario)
    assert.equal(contentRegistry.getBehavior(entry.manifest.id), entry.behavior)
    const report = scenarioZoneReport(entry.scenario, entry.manifest, sharedEncounterIdentities)
    assert.deepEqual(report.unresolvedAliases, [])
    assert.deepEqual(report.duplicateActiveZoneCodes, [])
    assert.ok(report.checkedCatalogCodes > 0)
  }
})

test('P1 缺牌、别名歧义、重复区域与超过目录张数立即失败', () => {
  assert.throws(() => countZone(gathering.scenario, ['unknownAlias']), /缺少目录原卡/)
  assert.throws(() => countZone(gathering.scenario, ['ghoulPriest'], { ghoulPriest: '01117' }), /不唯一/)
  const collided = structuredClone(masks.manifest)
  collided.zones.encounterDeck.push({ cardCode: '01137', count: 1 })
  assert.throws(() => scenarioZoneReport(masks.scenario, collided, sharedEncounterIdentities), /重复入牌/)
  const over = structuredClone(gathering.manifest)
  over.zones.encounterDeck.find(entry => entry.cardCode === '01159').count = 4
  assert.throws(() => scenarioZoneReport(gathering.scenario, over, sharedEncounterIdentities), /目录只有/)
})

test('P1 新增最小关卡仅需内容模块和注册项，UI 列表自动包含它', async () => {
  const campaign = structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
  campaign.scenarioIds.push(minimal.manifest.id)
  campaign.unlock[minimal.manifest.id] = ['theDevourerBelow']
  const registry = createContentRegistry({ packs, campaigns: [campaign], scenarios: [...entries, minimal] })
  assert.equal(registry.getScenario('minimalScenario').name, '注册契约测试关')
  assert.equal(registry.getBehavior('minimalScenario').setupLocations()[0], 'start')
  assert.equal(campaignListForUi(registry)[0].scenarios.at(-1).id, 'minimalScenario')
  const ui = await readFile(fileURLToPath(new URL('../web/game-ui.js', import.meta.url)), 'utf8')
  const engine = await readFile(fileURLToPath(new URL('../src/engine/engine.js', import.meta.url)), 'utf8')
  assert.doesNotMatch(ui, /theGathering|theMidnightMasks|theDevourerBelow|minimalScenario/)
  assert.doesNotMatch(engine, /theGathering|theMidnightMasks|theDevourerBelow|minimalScenario/)
})
