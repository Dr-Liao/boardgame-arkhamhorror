#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（FHV）P7 战役分片计划 / 逐卡条目清单 / worker 输入。
//
//   node tools/plan-fhv-campaign.mjs --write   写 audit/fhv-campaign-plan.json + artifacts/migration/fhv/workers/
//   node tools/plan-fhv-campaign.mjs --check   只读复算
//
// 事实源：audit/fhv-scope.json（P0 锁定：12 场景身份、chapterGroups/sharedGroups、301 战役记录）、
//         参考实现 .hs（逐卡/逐场景来源索引）、content/.../story-text.js（P7 正文）。
// 约定（与 TSK P7 同口径）：
//   · 除 `type=scenario` 的参考卡（10 张，不建条目）外，每张战役卡一个 encounter-entry 文件；
//   · 章专属卡 → src/cards/encounter-entries/theFeastOfHemlockVale/<chapterId>/<code>.js
//   · 跨章共享组 → .../_shared/<encounterGroup>/<code>.js
//   · 每个场景（4 序曲 + 8 章）一个模块目录 content/campaigns/theFeastOfHemlockVale/scenarios/<id>/
//     与一份章验收测试 tests/fhv-scenario-<id>.test.mjs、一份指南 web/scenario-guides/<id>.json。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_ID, GUIDE_FILE_BY_SCENARIO, ENTRY_ROOT, MOD, PLAN_PATH, RUN, SCOPE_PATH, WORKERS,
  buildReferenceIndex, camelToSnake, enGuidePath, entryPathOf, guideFileOf, json, readJson, referencePaths,
  scenarioDirOf, scenarioReferenceFiles, scenarioTestFile,
} from './fhv-campaign-lib.mjs'

const REFERENCE_ONLY_TYPES = new Set(['scenario'])
const chapters = (await import('../content/campaigns/theFeastOfHemlockVale/shared.js')).chapters
const SETTING_NAMES = Object.freeze({
  welcomeToHemlockVale: '欢迎来到铁杉谷', writtenInRock: '岩间密语', hemlockHouse: '汉姆洛克庄园',
  theSilentHeath: '寂静荒野', theLostSister: '消失的姐妹', theThingInTheDepths: '深淖之物',
  theTwistedHollow: '扭曲空洞', dawnOfTheSecondDay: '第二日黎明', theLongestNight: '最长一夜',
  dawnOfTheFinalDay: '最终日黎明', preludeTheFinalEvening: '最终之夜', fateOfTheVale: '山谷的命运',
})

export function buildCampaignPlan() {
  const scope = readJson(SCOPE_PATH)
  const referenceIndex = buildReferenceIndex()
  const campaignCodes = (scope.partitions?.fhvCampaign || []).slice().sort()
  const cardByCode = new Map(campaignCodes.map(code => [code, ALL_CARDS[code]]))
  const scenarioCards = campaignCodes.filter(code => REFERENCE_ONLY_TYPES.has(ALL_CARDS[code]?.type))
  const assignable = campaignCodes.filter(code => !REFERENCE_ONLY_TYPES.has(ALL_CARDS[code]?.type))

  const usable = codes => [...codes].filter(code => !REFERENCE_ONLY_TYPES.has(ALL_CARDS[code]?.type)).sort()
  const chapterOfCard = new Map()
  for (const [chapterId, codes] of Object.entries(scope.chapterGroups || {})) {
    for (const code of usable(codes)) chapterOfCard.set(code, chapterId)
  }
  const sharedOfCard = new Map()
  for (const [group, codes] of Object.entries(scope.sharedGroups || {})) {
    for (const code of usable(codes)) sharedOfCard.set(code, group)
  }
  const unassigned = assignable.filter(code => !chapterOfCard.has(code) && !sharedOfCard.has(code))
    .map(code => ({ code, type: cardByCode.get(code)?.type, name: cardByCode.get(code)?.name }))

  const cardRow = code => {
    const card = cardByCode.get(code)
    return {
      code, name: card?.name || code, nameZh: card?.nameZh || card?.name || code,
      type: card?.type || null, encounterCode: card?.encounterCode || null,
      references: (referenceIndex.get(code) || []).map(item => ({
        path: item.path.replaceAll('\\', '/').replace(join(MOD, '..', '..').replaceAll('\\', '/') + '/', ''),
        line: item.line,
      })),
    }
  }

  const scenarioById = new Map((scope.scenarios || []).map(row => [row.id, row]))
  const chapterNodes = chapters.map(chapter => {
    const scopeScenario = scenarioById.get(chapter.id) || null
    const codes = usable(scope.chapterGroups?.[chapter.id] || [])
    const kind = codes.length ? 'chapter' : 'prelude'
    return {
      kind, id: chapter.id, name: SETTING_NAMES[chapter.id] || chapter.name,
      nameEn: (chapter.name || chapter.id), referenceCode: chapter.referenceCodes?.[0] || chapter.stepCode,
      encounterCode: chapter.group || camelToSnake(chapter.id),
      scenarioDir: scenarioDirOf(chapter.id),
      testFile: scenarioTestFile(chapter.id),
      guideFile: guideFileOf(chapter.id),
      guideKeyFile: chapter.referenceCodes?.[0] || null,
      guidePath: enGuidePath(GUIDE_FILE_BY_SCENARIO[chapter.id] || 'base.json').replaceAll('\\', '/'),
      guideKeys: scopeScenario?.guideKeys || [],
      chaosSymbols: scopeScenario?.chaosSymbols || null,
      stepCode: chapter.stepCode || null,
      cards: codes.map(cardRow),
    }
  })
  for (const node of chapterNodes) {
    node.entryPaths = Object.fromEntries(node.cards.map(card => [card.code, entryPathOf(node.kind, node.id, card.code)]))
    node.referenceFiles = scenarioReferenceFiles(node.id).map(path => path.replaceAll('\\', '/').replace(join(MOD, '..', '..').replaceAll('\\', '/') + '/', ''))
    node.scenarioFiles = ['definition.js', 'layout.js', 'behavior.js', 'chaos.js', 'index.js']
      .map(file => ({ file: `${node.scenarioDir}/${file}`, exists: existsSync(join(MOD, node.scenarioDir, file)) }))
    node.scenarioImplemented = node.scenarioFiles.every(row => row.exists)
    node.storyKey = node.kind === 'prelude' ? `prelude.${camelToSnake(node.id).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` : node.id
    if (!node.cards.length) node.cards = []
  }
  const sharedNodes = Object.entries(scope.sharedGroups || {}).map(([group, codes]) => ({
    kind: 'shared', id: group, encounterCode: group,
    cards: usable(codes).map(cardRow),
    entryPaths: Object.fromEntries(usable(codes).map(code => [code, entryPathOf('shared', group, code)])),
  }))
  const nodes = [...chapterNodes, ...sharedNodes]
  const allCards = nodes.flatMap(node => node.cards.map(card => card.code))
  const allEntries = nodes.flatMap(node => Object.entries(node.entryPaths))
  const missingEntries = allEntries.filter(([, path]) => !existsSync(join(MOD, path))).map(([code]) => code)

  const gates = {
    chapterCount: chapterNodes.filter(node => node.kind === 'chapter').length === 8,
    preludeCount: chapterNodes.filter(node => node.kind === 'prelude').length === 4,
    scenarioReferenceCards: scenarioCards.length === 10,
    noOverlap: new Set(allCards).size === allCards.length,
    coversAssignableCards: allCards.length + scenarioCards.length === campaignCodes.length,
    noUnassigned: unassigned.length === 0,
    entriesCovered: missingEntries.length === 0,
    scenariosComplete: chapterNodes.every(node => node.scenarioImplemented),
    chapterTestsPresent: chapterNodes.every(node => existsSync(join(MOD, node.testFile))),
    guidesPresent: chapterNodes.every(node => existsSync(join(MOD, node.guideFile))),
    storyReadable: true,
  }
  const status = Object.values(gates).every(Boolean) ? 'planned' : 'in-progress'
  const summary = {
    campaignCards: campaignCodes.length,
    scenarioReferenceCards: scenarioCards.length,
    assignableCards: assignable.length,
    expectedEntries: allEntries.length,
    missingEntries: missingEntries.length,
    scenarios: chapterNodes.map(node => ({
      id: node.id, kind: node.kind, cards: node.cards.length,
      scenarioImplemented: node.scenarioImplemented,
      test: existsSync(join(MOD, node.testFile)),
      guide: existsSync(join(MOD, node.guideFile)),
      entryMissing: node.cards.filter(card => !existsSync(join(MOD, node.entryPaths[card.code]))).length,
    })),
    sharedGroups: sharedNodes.map(node => ({ id: node.id, cards: node.cards.length })),
    unassigned,
  }
  return {
    schemaVersion: 1, cycle: 'fhv', phase: 'P7', campaignId: CAMPAIGN_ID,
    generatedBy: 'tools/plan-fhv-campaign.mjs', status, gates, summary,
    scenarioCards: scenarioCards.map(cardRow), nodes,
    queue: allEntries.filter(([, path]) => !existsSync(join(MOD, path)))
      .map(([code, path]) => ({ code, path, status: 'pending' })),
  }
}

export function campaignWorkerInputs(plan) {
  const referencePathsByScenario = Object.fromEntries(plan.nodes
    .filter(node => node.kind !== 'shared')
    .map(node => [node.id, { ...referencePaths(node.id), files: node.referenceFiles }]))
  return [
    ...plan.nodes.filter(node => node.kind !== 'shared').map(node => ({
      kind: node.kind, scenarioId: node.id, name: node.name, nameEn: node.nameEn,
      referenceCode: node.referenceCode, encounterCode: node.encounterCode,
      scenarioDir: node.scenarioDir, testFile: node.testFile, guideFile: node.guideFile,
      storyKey: node.storyKey, stepCode: node.stepCode, guidePath: node.guidePath,
      guideKeys: node.guideKeys, chaosSymbols: node.chaosSymbols,
      cards: node.cards, entryPaths: node.entryPaths, referenceFiles: node.referenceFiles,
      sharedReference: referencePathsByScenario[node.id],
      contract: 'artifacts/migration/fhv/workers/p7-scenario-contract.md',
    })),
    ...plan.nodes.filter(node => node.kind === 'shared').map(node => ({
      kind: 'shared', group: node.id, encounterCode: node.encounterCode,
      cards: node.cards, entryPaths: node.entryPaths,
      referenceFiles: node.cards.flatMap(card => card.references.map(item => item.path)),
      contract: 'artifacts/migration/fhv/workers/p7-shared-contract.md',
    })),
  ]
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = buildCampaignPlan()
  const body = json(plan)
  if (process.argv.includes('--write')) {
    mkdirSync(WORKERS, { recursive: true })
    writeFileSync(PLAN_PATH, body)
    writeFileSync(join(RUN, 'campaign-plan.json'), body)
    for (const input of campaignWorkerInputs(plan)) {
      const name = input.kind === 'shared' ? `campaign-shared-${input.group}.input.json` : `campaign-${input.scenarioId}.input.json`
      writeFileSync(join(WORKERS, name), json(input))
    }
    console.log(`fhv campaign plan: 已写入（status=${plan.status}，战役卡 ${plan.summary.campaignCards}，可分配 ${plan.summary.assignableCards}，期望条目 ${plan.summary.expectedEntries}，缺 ${plan.summary.missingEntries}）`)
    console.log(json(plan.gates))
    if (plan.summary.unassigned.length) console.log('未分配：' + json(plan.summary.unassigned))
  } else if (process.argv.includes('--check')) {
    if (!existsSync(PLAN_PATH)) throw new Error('缺少 audit/fhv-campaign-plan.json：先 --write')
    if (readFileSync(PLAN_PATH, 'utf8') !== body) throw new Error('audit/fhv-campaign-plan.json 与复算不一致：审阅后 --write')
    console.log(`fhv campaign plan: 复算一致（status=${plan.status}，缺条目 ${plan.summary.missingEntries}）`)
  } else {
    console.log(body)
  }
}
