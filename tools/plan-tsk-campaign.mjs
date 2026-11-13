#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P7 战役分片计划 / 逐卡条目清单 / worker 输入。
//
//   node tools/plan-tsk-campaign.mjs --write   → audit/tsk-campaign-plan.json + 运行目录 worker 输入
//   node tools/plan-tsk-campaign.mjs --check   只读复算
//
// 事实源：audit/tsk-scope.json（P0 锁定的 chapters/gatherSets/encounterGroups/cards）、
//          audit/tsk-mechanism-scan.json（P1 机制）、content/campaigns/theScarletKeys/story-text.js（P7 正文）。
// 约定（与 EotE P7 同口径）：战役卡除 `type='scenario'` 的参考卡外，每张都要一个 encounter-entry 文件；
//   章专属组 → src/cards/encounter-entries/theScarletKeys/<chapterId>/<code>.js
//   共享组   → src/cards/encounter-entries/theScarletKeys/_shared/<encounterCode>/<code>.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TSK_STORY_TEXT } from '../content/campaigns/theScarletKeys/story-text.js'
import {
  CHAPTER_ENCOUNTER_GROUPS, ENCOUNTER_GROUPS, ENCOUNTER_GROUP_CODES, chapters as chapterDefs,
} from '../content/campaigns/theScarletKeys/shared.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = fileURLToPath(new URL('../../../artifacts/migration/tsk/', import.meta.url))
const SCOPE_PATH = join(MOD, 'audit/tsk-scope.json')
const PLAN_PATH = join(MOD, 'audit/tsk-campaign-plan.json')
const REFERENCE_ONLY_TYPES = new Set(['scenario'])
// 跨章共享剧情资产（归属算法：同战役多关卡命中 → _shared/<encounterCode>/）：
// 09584 艾婕·萨辛同时被 dealingsInTheDark（本章）与 congressOfTheKeys（同谋支援）使用。
const SHARED_STORY_ASSET_GROUPS = Object.freeze({ '09584': 'dealings_in_the_dark' })
const ENTRY_ROOT = 'src/cards/encounter-entries/theScarletKeys'

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const rel = path => path.replaceAll('\\', '/').replace(`${MOD.replaceAll('\\', '/')}/`, '')
const camelToSnake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const snakeToCamel = value => String(value).replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const setKey = value => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()

export function buildCampaignPlan() {
  const scope = readJson(SCOPE_PATH)
  const cards = scope.cards || []
  const cardByCode = new Map(cards.map(card => [card.code, card]))
  const groupByKey = new Map()
  for (const group of scope.encounterGroups || []) {
    groupByKey.set(setKey(group.nameEn), group)
    groupByKey.set(setKey(group.id), group)
    groupByKey.set(setKey(group.encounterCode), group)
  }
  const chapterGroupIds = new Set(Object.values(CHAPTER_ENCOUNTER_GROUPS))
  const chapterByGroup = Object.fromEntries(Object.entries(CHAPTER_ENCOUNTER_GROUPS).map(([chapterId, group]) => [group, chapterId]))
  const chapterCards = new Map(chapterDefs.map(chapter => [chapter.id, []]))
  const sharedGroupCards = new Map(ENCOUNTER_GROUPS.filter(group => !chapterGroupIds.has(group)).map(group => [group, []]))
  const unassigned = []
  const scenarioCards = []
  const sharedStoryCards = []
  for (const code of scope.packs.find(pack => pack.id === 'tskCampaign').cards) {
    const card = cardByCode.get(code)
    if (!card) { unassigned.push({ code, reason: 'missing-scope-card' }); continue }
    if (REFERENCE_ONLY_TYPES.has(card.type)) { scenarioCards.push(code); continue }
    if (SHARED_STORY_ASSET_GROUPS[code]) { sharedStoryCards.push(code); continue }
    const group = snakeToCamel(card.encounterCode || '')
    const chapterId = chapterByGroup[group]
    if (chapterId) chapterCards.get(chapterId).push(code)
    else if (sharedGroupCards.has(group)) sharedGroupCards.get(group).push(code)
    else unassigned.push({ code, reason: `unknown-group:${card.encounterCode}`, type: card.type })
  }
  const entryPathOf = (node, code) => node.kind === 'chapter'
    ? `${ENTRY_ROOT}/${node.id}/${code}.js`
    : `${ENTRY_ROOT}/_shared/${node.encounterCode || node.id}/${code}.js`
  const nodes = [
    ...chapterDefs.map(chapter => ({
      kind: 'chapter', id: chapter.id, name: chapter.name, nameEn: chapter.nameEn,
      referenceCode: chapter.referenceCode, encounterCode: chapter.encounterCode || camelToSnake(chapter.id),
      scenarioDir: `content/campaigns/theScarletKeys/scenarios/${chapter.id}`,
      testFile: `tests/tsk-scenario-${chapter.id}.test.mjs`,
      guideFile: `web/scenario-guides/${chapter.id}.json`,
      cards: [...(chapterCards.get(chapter.id) || [])].sort(),
    })),
    ...[...sharedGroupCards.entries()].map(([group, codes]) => ({
      kind: 'shared', id: group, encounterCode: ENCOUNTER_GROUP_CODES[group],
      testFile: 'tests/tsk-shared-encounters-a.test.mjs', cards: [...codes].sort(),
    })),
    ...sharedStoryCards.map(code => ({
      kind: 'sharedStory', id: SHARED_STORY_ASSET_GROUPS[code],
      encounterCode: SHARED_STORY_ASSET_GROUPS[code], cards: [code],
    })),
  ]
  for (const node of nodes) {
    node.entries = node.cards.map(code => ({ code, path: entryPathOf(node, code), exists: existsSync(join(MOD, entryPathOf(node, code))) }))
    node.missingEntries = node.entries.filter(entry => !entry.exists).map(entry => entry.code)
    node.entryCount = node.entries.length
    node.implemented = node.entryCount === node.entryCount - node.missingEntries.length
    if (node.kind === 'chapter') {
      node.scenarioFiles = ['definition.js', 'layout.js', 'behavior.js', 'chaos.js', 'index.js']
        .map(file => ({ file: `${node.scenarioDir}/${file}`, exists: existsSync(join(MOD, node.scenarioDir, file)) }))
      node.scenarioImplemented = node.scenarioFiles.every(row => row.exists)
      node.guide = { path: node.guideFile, exists: existsSync(join(MOD, node.guideFile)) }
      node.test = { path: node.testFile, exists: existsSync(join(MOD, node.testFile)) }
      node.story = TSK_STORY_TEXT.chapters[node.id]?.summary || null
    }
  }
  const allCampaignCards = [...nodes.flatMap(node => node.cards)]
  const campaignCodes = scope.packs.find(pack => pack.id === 'tskCampaign').cards
  const allExpectedEntries = nodes.flatMap(node => node.entries)
  const gates = {
    chapterCount: nodes.filter(node => node.kind === 'chapter').length === 10,
    sharedGroupCount: nodes.filter(node => node.kind === 'shared').length === 16,
    noOverlap: new Set(allCampaignCards).size === allCampaignCards.length,
    coversCampaignCards: allCampaignCards.length + scenarioCards.length === campaignCodes.length,
    scenarioCardsExcluded: scenarioCards.length === 10,
    noUnassigned: unassigned.length === 0,
    entriesCovered: allExpectedEntries.every(entry => entry.exists),
    chapterScenariosPresent: nodes.filter(node => node.kind === 'chapter').every(node => node.scenarioImplemented),
    chapterTestsPresent: nodes.filter(node => node.kind === 'chapter').every(node => node.test.exists),
    guidesPresent: nodes.filter(node => node.kind === 'chapter').every(node => node.guide.exists),
    storyComplete: Object.values(TSK_STORY_TEXT.chapters).every(chapter => (chapter.chineseGaps || []).length === 0),
  }
  const status = Object.values(gates).every(Boolean) ? 'planned' : 'in-progress'
  const summary = {
    campaignCards: campaignCodes.length,
    scenarioReferenceCards: scenarioCards.length,
    assignedCards: allCampaignCards.length,
    chapters: nodes.filter(node => node.kind === 'chapter').map(node => ({
      id: node.id, cards: node.entryCount, missingEntries: node.missingEntries.length,
      scenarioImplemented: node.scenarioImplemented, test: node.test.exists, guide: node.guide.exists,
    })),
    sharedGroups: nodes.filter(node => node.kind === 'shared').map(node => ({
      id: node.id, cards: node.entryCount, missingEntries: node.missingEntries.length,
    })),
    entriesMissing: allExpectedEntries.filter(entry => !entry.exists).length,
    entriesExpected: allExpectedEntries.length,
    workspace: {
      scenarioDirs: nodes.filter(node => node.kind === 'chapter').map(node => node.scenarioDir),
      entryRoot: ENTRY_ROOT,
    },
  }
  return {
    schemaVersion: 1,
    cycle: 'tsk',
    phase: 'P7',
    generatedBy: 'tools/plan-tsk-campaign.mjs',
    status,
    gates,
    summary,
    scenarioCards,
    unassigned,
    nodes,
    queue: allExpectedEntries.filter(entry => !entry.exists).map(entry => ({ code: entry.code, path: entry.path, status: 'pending' })),
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = buildCampaignPlan()
  const body = JSON.stringify(plan, null, 2) + '\n'
  if (process.argv.includes('--write')) {
    writeFileSync(PLAN_PATH, body)
    mkdirSync(join(RUN, 'workers'), { recursive: true })
    writeFileSync(join(RUN, 'campaign-plan.json'), body)
    for (const node of plan.nodes.filter(item => item.kind === 'chapter')) {
      writeFileSync(join(RUN, 'workers', `campaign-${node.id}.input.json`), JSON.stringify({
        kind: node.kind, chapterId: node.id, name: node.name, nameEn: node.nameEn,
        referenceCode: node.referenceCode, encounterCode: node.encounterCode,
        scenarioDir: node.scenarioDir, testFile: node.testFile, guideFile: node.guideFile,
        cards: node.cards, entryPaths: Object.fromEntries(node.entries.map(entry => [entry.code, entry.path])),
        storySummary: node.story,
      }, null, 2) + '\n')
    }
    console.log(`tsk campaign plan: 已写入（status=${plan.status}，卡 ${plan.summary.assignedCards}/${plan.summary.campaignCards}，缺条目 ${plan.summary.entriesMissing}）`)
    console.log(JSON.stringify(plan.gates))
    if (plan.status !== 'planned') process.exitCode = 0 // 进行中：先写盘，门禁由审计阶段强制
  } else if (process.argv.includes('--check')) {
    if (!existsSync(PLAN_PATH)) throw new Error('缺少 audit/tsk-campaign-plan.json：先 --write')
    if (readFileSync(PLAN_PATH, 'utf8') !== body) throw new Error('audit/tsk-campaign-plan.json 与复算不一致：审阅后 --write')
    console.log(`tsk campaign plan: 复算一致（status=${plan.status}）`)
  } else {
    console.log(body)
  }
}
