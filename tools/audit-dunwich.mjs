import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { contentRegistry } from '../content/registered.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { missingMechanics } from '../content/mechanics.js'
import { chapters } from '../content/campaigns/theDunwichLegacy/shared.js'
import { abilityLayerCodes } from '../content/packs/dunwichPlayer/manifest.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'

const sources = [
  'Campaign/Campaigns/TheDunwichLegacy.hs',
  'Campaigns/TheDunwichLegacy/ChaosBag.hs', 'Campaigns/TheDunwichLegacy/Key.hs',
  'Scenario/Scenarios/TheDunwichLegacy/ExtracurricularActivity.hs',
  'Scenario/Scenarios/TheDunwichLegacy/TheHouseAlwaysWins.hs',
  'Location/CardDefs/TheDunwichLegacy/ExtracurricularActivity.hs',
  'Location/CardDefs/TheDunwichLegacy/TheHouseAlwaysWins.hs',
  ...chapters.slice(2).flatMap(chapter => {
    const name = chapter.id[0].toUpperCase() + chapter.id.slice(1)
    return [`Scenario/Scenarios/TheDunwichLegacy/${name}.hs`, `Location/CardDefs/TheDunwichLegacy/${name}.hs`]
  }),
]
// Resolve from tools/ to the repository root, then into the checked-in reference.
const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/', import.meta.url)
const sourceHashes = await Promise.all(sources.map(async path => ({ path,
  sha256: createHash('sha256').update(await readFile(new URL(path, sourceRoot))).digest('hex'),
})))
const treacheries = new Map(chapters.flatMap(chapter =>
  Object.values(contentRegistry.getScenarioData(chapter.id).treacheries || {})).map(card => [card.code, card]))
const pendingTreacheries = [...treacheries.values()].filter(card => card.rulesPending).map(card => card.code).sort()
// 一卡一文件之后，「遭遇处理器」的事实源是条目声明的 encounterResolve，不再读
// encounter-rules.js 的手写卡号集合（那次重构已删除该导出）。
const sharedEncounterHandlers = NON_PLAYER_ABILITY_ENTRIES
  .filter(entry => /^02\d{3}[a-z]?$/.test(entry.code) && typeof entry.encounterResolve === 'function')
  .map(entry => entry.code)
  .sort()
const report = {
  schemaVersion: 1, milestone: 'D11', campaignId: 'theDunwichLegacy',
  status: contentRegistry.getCampaign('theDunwichLegacy').status,
  playable: true, equivalenceCertified: false,
  verifiedScope: 'D11 开放大厅战役入口；八章、五位调查员、专属卡与弱点、91 张敦威治玩家卡、遭遇与混乱标记规则均已接入。仍属于本 Mod 的简化规则实现，不声明与原版逐条等价。',
  // 一卡一文件后 effects.js 只剩注释；可玩玩家卡的唯一来源是包清单的 abilityLayerCodes。
  newlyPlayablePlayerCards: [...abilityLayerCodes],
  sharedEncounterHandlers,
  encounterRuleCoverage: { total: treacheries.size, implemented: treacheries.size - pendingTreacheries.length,
    pending: pendingTreacheries },
  investigators: { mainAbilities: ['02001', '02002', '02003', '02004', '02005'],
    selectable: ['02001', '02002', '02003', '02004', '02005'], remaining: null },
  sourceRoot: '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham', sources: sourceHashes,
  tests: ['games/arkhamhorror/tests/dunwich-migration.test.mjs', 'games/arkhamhorror/tests/dunwich-rules.test.mjs'],
  chapters: chapters.map(chapter => {
    const manifest = contentRegistry.getScenario(chapter.id)
    return { ...chapter, status: manifest.status,
      catalogReferenceOnly: !!manifest.catalogReferenceOnly,
      missingMechanics: missingMechanics(manifest.requiredMechanicIds),
      ...(manifest.catalogReferenceOnly ? {} : {
        zones: manifest.zones,
        conservation: scenarioZoneReport(contentRegistry.getScenarioData(chapter.id), manifest),
        ...(contentRegistry.getBehavior(chapter.id).setupPlan ? { setupVariants: [false, true].map(second => {
          const scenario = contentRegistry.getScenarioData(chapter.id)
          const other = chapter.id === 'extracurricularActivity' ? 'theHouseAlwaysWins' : 'extracurricularActivity'
          return { order: second ? 'second' : 'first', ...contentRegistry.getBehavior(chapter.id).setupPlan({
            scenario, campaign: { scenarioResults: second ? [{ scenarioId: other }] : [] },
          }) }
        }) } : {}),
      }),
    }
  }),
  remaining: ['持续补充八关全路线、联机与浏览器回归；不阻塞当前简化模式入口'],
}
const target = new URL('../audit/dunwich-migration.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]
if (mode === '--write') await writeFile(target, serialized)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== serialized) throw new Error('敦威治迁移清单或参考来源已漂移，请审阅后更新')
} else if (mode) throw new Error('使用 --write 或 --check')
else console.log(serialized)
if (mode) console.log(`D11: ${report.chapters.length} playable chapters; ${report.encounterRuleCoverage.implemented}/${report.encounterRuleCoverage.total} treacheries handled; ${report.newlyPlayablePlayerCards.length} player cards; 5 investigators; campaign playable=true`)
