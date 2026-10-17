import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { contentRegistry } from '../content/registered.js'
import { chapters, CHAOS_BAGS, recordTypes } from '../content/campaigns/theForgottenAge/shared.js'
import { assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/', import.meta.url)
const storySourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge/', import.meta.url)

// Return To products and their exclusive encounter sets live in the same
// directories as the original cycle; keep them out of the locked source set.
const RETURN_TO_SETS = /CultOfPnakotus|VenomousHate|TemporalHunters|DoomedExpedition/

async function sourceInventory(url = sourceRoot, prefix = '') {
  const entries = await readdir(url, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) result.push(...await sourceInventory(new URL(`${entry.name}/`, url), path))
    else if (entry.isFile() && path.endsWith('.hs') && path.includes('TheForgottenAge')
      && !path.includes('ReturnTo') && !RETURN_TO_SETS.test(path)) result.push(path)
  }
  return result
}

const packageLockedPaths = [
  'Campaign/Campaigns/TheForgottenAge.hs',
  'Campaigns/TheForgottenAge/ChaosBag.hs',
  'Campaigns/TheForgottenAge/CampaignSteps.hs',
  'Campaigns/TheForgottenAge/Key.hs',
  'Campaigns/TheForgottenAge/Supply.hs',
  'Campaigns/TheForgottenAge/Meta.hs',
]
const sources = [...new Set([...packageLockedPaths, ...await sourceInventory()])].sort()
const sourceHashes = await Promise.all(sources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, sourceRoot))).digest('hex'),
})))

const storySources = ['base.json', ...chapters.map(chapter => `scenarios/${chapter.id}.json`)]
const storySourceHashes = await Promise.all(storySources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, storySourceRoot))).digest('hex'),
})))

const packIds = ['tfaCampaign', 'tfaInvestigators', 'tfaPlayer']
const packs = packIds.map(id => {
  const pack = contentRegistry.getPack(id)
  if (!pack) throw new Error(`缺少卡包 ${id}`)
  return pack
})
const packedCodes = packs.flatMap(pack => pack.cards.map(card => card.code))
const duplicated = packedCodes.filter((code, index) => packedCodes.indexOf(code) !== index)
if (duplicated.length) throw new Error(`卡包分区重复：${[...new Set(duplicated)].join(', ')}`)

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^04\d{3}$/.test(code)).sort()
const linkedFaces = Object.keys(ALL_CARDS).filter(code => /^04\d{3}[a-z]$/.test(code)).sort()
const unassigned = mainCodes.filter(code => !packedCodes.includes(code))
if (unassigned.length) throw new Error(`未分区的 04 循环卡：${unassigned.join(', ')}`)
const foreign = packedCodes.filter(code => !mainCodes.includes(code))
if (foreign.length) throw new Error(`卡包登记了非 04 循环卡：${foreign.join(', ')}`)

const chapterItems = []
for (const chapter of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
  const registered = contentRegistry.getScenario(chapter.id)
  if (!registered || registered.campaignId !== 'theForgottenAge') throw new Error(`未注册章节 ${chapter.id}`)
  if (registered.referenceCode !== chapter.code) throw new Error(`${chapter.id} 的原卡号与来源不一致`)
  if (!ALL_CARDS[chapter.code]) throw new Error(`${chapter.id} 的原卡 ${chapter.code} 不在目录中`)
  if (module.manifest.id !== chapter.id || module.behavior.id !== chapter.id) throw new Error(`${chapter.id} 模块身份不一致`)
  if (!registered.catalogReferenceOnly || registered.status !== 'catalog-only') {
    throw new Error(`${chapter.id} 在 M0 必须是 catalog-only 占位`)
  }
  chapterItems.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: 'pending',
    checks: {
      sourceLocked: true,
      identityRegistered: true,
      setupAndZones: false,
      actsAndAgendas: false,
      locationsAndConnections: false,
      encounterBehaviors: false,
      literalCardBehavior: false,
      chaosEffects: false,
      resolutionsAndRecords: false,
      storyText: false,
      saveReplay: false,
      browserAcceptance: false,
    },
    evidence: [
      `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheForgottenAge/${chapter.sourceName}.hs`,
      `games/arkhamhorror/content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`,
    ],
  })
}

const campaign = contentRegistry.getCampaign('theForgottenAge')
let launchable = true
try { contentRegistry.assertLaunchable('theForgottenAge') } catch { launchable = false }
if (launchable) throw new Error('M0 期间失落的时代战役不得可启动')
if (campaign.status !== 'catalog-only') throw new Error('M0 期间战役状态必须是 catalog-only')

const report = {
  schemaVersion: 1,
  milestone: 'M0',
  campaignId: 'theForgottenAge',
  status: campaign.status,
  playable: false,
  launchEnabled: false,
  earlyAccess: false,
  equivalenceCertified: false,
  verifiedScope: '仅完成目录、身份与来源基线：361 条原版卡牌记录按 231/16/91 无重叠分区，十个剧本保留原卡号占位，战役保持 catalog-only，规则、剧情、关键词与规则书均未迁移。',
  catalog: {
    printedRecords: mainCodes.length + linkedFaces.length,
    mainCodes: mainCodes.length,
    linkedFaces: linkedFaces.length,
    campaign: packs[0].cards.length,
    investigatorsAndSignatures: packs[1].cards.length,
    playerCards: packs[2].cards.length,
  },
  chapters: chapters.map(chapter => ({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    pack: chapter.packCodes,
    status: contentRegistry.getScenario(chapter.id).status,
    catalogReferenceOnly: true,
  })),
  chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) => [difficulty, {
    tokens: tokens.length,
    symbols: [...new Set(tokens.filter(token => /^[a-z]/.test(token)))].sort(),
  }])),
  recordSchema: Object.fromEntries(Object.entries(recordTypes).map(([key, type]) => [key, type])),
  sourceRoot: '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
  sources: sourceHashes,
  resources: {
    cardCatalog: 'games/arkhamhorror/src/cards/cards-data.js (04xxx)',
    storySourceRoot: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge',
    storySources: storySourceHashes,
    localImageRoot: 'games/arkhamhorror/web/img',
    imagePaths: ['cards/<code>.avif', 'zh/cards/<code>.avif'],
    imagePolicy: '与核心包、一循环和二循环共用卡图解析、离线库存与远程回退；不建立循环专属图片目录。',
    presentation: '缺少 web/img/campaigns/theForgottenAge 与音频资源，M4 前必须补齐或按缺失登记。',
  },
  confirmations: {
    scenarios: {
      status: 'pending',
      items: chapterItems,
    },
    keywords: {
      status: 'pending',
      items: ['explore', 'vengeance', 'yigsFury', 'supplies', 'poisoned', 'relicOfAges',
        'expeditionLeader', 'elderThing'].map(id => ({
        id,
        status: 'pending',
        checks: {
          sourceInventoried: true,
          engineBehavior: false,
          nodeAcceptance: false,
          rulebookEntry: false,
          cardLinks: false,
        },
        evidence: ['参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Campaigns/TheForgottenAge/Key.hs'],
      })),
    },
    rulebook: {
      status: 'pending',
      checks: {
        campaignOverview: false,
        scenarioMechanics: false,
        keywordEntries: false,
        cardLinks: false,
        desktopBrowser: false,
        mobileBrowser: false,
      },
      evidence: ['games/arkhamhorror/web/rulebook-data.js'],
    },
  },
  tests: ['games/arkhamhorror/tests/tfa-migration.test.mjs'],
  remaining: [
    'M1 调查员：构筑规则、主能力、旧印、专属卡与弱点，逐人验收',
    'M2 玩家卡：91 张逐卡效果与审计账本',
    'M3 剧本：十个注册项的布置、幕／议程、地点、遭遇、混乱标记、结局与跨章记录',
    'M3 机制：探索牌库、复仇、Yig\'s Fury、补给、中毒、古代遗物、领队',
    'M4 关键词与规则书条目、卡牌直达、桌面与移动端浏览器验收',
    'M4 资源：战役展示图与音频目录（web/img/campaigns/theForgottenAge）',
    'M5 大厅、联机与浏览器端到端发布验收',
  ],
}
assertMigrationConfirmations(report, chapters.map(chapter => chapter.id))

const target = new URL('../audit/tfa-migration.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]
if (mode === '--write') await writeFile(target, serialized)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== serialized) {
    throw new Error('失落的时代迁移清单或参考来源已漂移，请审阅后更新')
  }
} else if (mode) throw new Error('使用 --write 或 --check')
else console.log(serialized)

if (mode) console.log(`M0: ${mainCodes.length} main codes = ${packs[0].cards.length} campaign + ${packs[1].cards.length} investigator + ${packs[2].cards.length} player; ${linkedFaces.length} linked faces; campaign launchable=${launchable}`)
