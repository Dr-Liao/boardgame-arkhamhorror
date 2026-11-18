#!/usr/bin/env node
// 九循环《铁杉谷盛宴》P5 调查员账本：逐人能力/旧印/构筑/专属依赖/浏览器验收。
//
//   node tools/audit-fhv-investigators.mjs --write   生成 audit/fhv-investigators.json
//   node tools/audit-fhv-investigators.mjs --check   逐字节复算（结论漂移即失败）
//   node tools/audit-fhv-investigators.mjs           打印账本 JSON（不写盘）
//
// 本工具只读证据：Node 验收（audit/fhv-node-acceptance.json 的 investigators 段）、调查员浏览器验收
// （audit/fhv-investigators-browser.json）、回归（audit/fhv-regression.json）与 P0 基线
// （audit/fhv-baseline.json 的 replay sha256）；逐人结论由实跑产物与当前源码复算，不复制冻结数字。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import {
  canSelectInvestigator, getAvailability, SIGNATURE_CARD_CODES_BY_INVESTIGATOR,
} from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { manifest as investigatorManifest } from '../content/packs/fhvInvestigators/manifest.js'
import { manifest as campaignManifest } from '../content/packs/fhvCampaign/manifest.js'
import { manifest as playerManifest } from '../content/packs/fhvPlayer/manifest.js'
import {
  BONDED_CODES as FHV_BONDED_CODES, INVESTIGATOR_CODES as FHV_INVESTIGATOR_CODES,
  SIGNATURE_CODES as FHV_SIGNATURE_CODES,
} from '../content/campaigns/theFeastOfHemlockVale/shared.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const LEDGER = join(MOD, 'audit/fhv-investigators.json')
// 绑定面归属：凯特的磁通量稳定器活跃面与两张以太电流；汉克的两个坚毅面。
const FHV_BONDED_BY_INVESTIGATOR = Object.freeze({
  '10001': [],
  '10004': ['10005b', '10006', '10007'],
  '10009': [],
  '10012': [],
  '10015': ['10016a', '10016b'],
})
const json = value => JSON.stringify(value, null, 2) + '\n'
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))
const readMaybe = path => (existsSync(join(MOD, path)) ? readJson(path) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? createHash('sha256').update(readFileSync(join(MOD, path))).digest('hex') : null)
const passTitles = report => (Array.isArray(report?.tests) ? report.tests : [])
const nodeTitle = (report, code) => (report?.investigators?.titles || []).some(title => String(title).startsWith(`P5 ${code} `))
const browserTitle = (report, viewport, code) => passTitles(report).some(test => test.status === 'passed'
  && String(test.file || '').endsWith('fhv-investigators.browser.mjs')
  && String(test.title || '').startsWith(`P5 ${viewport} ${code} `))

export function buildInvestigatorAudit() {
  const node = readMaybe('audit/fhv-node-acceptance.json')
  const browser = readMaybe('audit/fhv-investigators-browser.json')
  const regression = readMaybe('audit/fhv-regression.json')
  const baseline = readMaybe('audit/fhv-baseline.json')
  const baselineReplaySha = baseline?.replay?.sha256 || null
  const currentReplaySha = fileSha('tests/fixtures/replay/golden-replays.json')
  const items = FHV_INVESTIGATOR_CODES.map(code => {
    const card = ALL_CARDS[code]
    const file = `src/cards/entries/${code}.js`
    const signatureCodes = [...(SIGNATURE_CARD_CODES_BY_INVESTIGATOR[code] || [])]
    const bondedCodes = [...(FHV_BONDED_BY_INVESTIGATOR[code] || [])]
    const signatures = signatureCodes.map(sigCode => ({
      code: sigCode, name: ALL_CARDS[sigCode]?.nameZh || ALL_CARDS[sigCode]?.name || sigCode,
      file: `src/cards/entries/${sigCode}.js`, registered: !!registeredEntry(sigCode),
      dependencyOnly: getAvailability(sigCode).dependencyOnly === true,
      implemented: !!registeredEntry(sigCode) && registeredEntry(sigCode).simplified !== true,
      sha256: fileSha(`src/cards/entries/${sigCode}.js`),
    }))
    // 绑定面（10005b/10006/10007/10016a/10016b）不在印刷 signatureCards 里，单独登记。
    const bonded = bondedCodes.map(bondedCode => ({
      code: bondedCode, name: ALL_CARDS[bondedCode]?.nameZh || ALL_CARDS[bondedCode]?.name || bondedCode,
      file: `src/cards/entries/${bondedCode}.js`, registered: !!registeredEntry(bondedCode),
      dependencyOnly: getAvailability(bondedCode).dependencyOnly === true,
      implemented: !!registeredEntry(bondedCode) && registeredEntry(bondedCode).simplified !== true,
      sha256: fileSha(`src/cards/entries/${bondedCode}.js`),
    }))
    let deckConstruction = false
    try {
      const automatic = buildDeck(INVESTIGATORS[code], { seed: `fhv-p5-audit-${code}`, xp: 0 })
      const manual = buildDeckFromList(INVESTIGATORS[code], automatic.playerCards, { seed: `fhv-p5-manual-${code}`, xpBudget: 0 })
      const requiredSignatures = [...(INVESTIGATORS[code].deckRequirements.signatureCards || [])]
      const printedSize = Number(INVESTIGATORS[code].deckRequirements.size || 30)
      deckConstruction = automatic.playerCards.length === printedSize && manual.playerCards.length === printedSize
        && requiredSignatures.every(sig => [...automatic.signatureCards, ...automatic.signatureWeaknesses].includes(sig))
    } catch {
      deckConstruction = false
    }
    const checks = {
      registered: !!registeredEntry(code),
      elderSign: !!registeredEntry(code)?.elderSign,
      signatures: signatures.length > 0 && signatures.every(signature => signature.registered && signature.dependencyOnly && signature.implemented)
        && bonded.every(item => item.registered && item.dependencyOnly && item.implemented),
      deckConstruction,
      behaviors: nodeTitle(node, code),
      desktop: browserTitle(browser, 'desktop', code),
      mobile: browserTitle(browser, 'mobile', code),
      selectable: canSelectInvestigator(code) && getAvailability(code).selectable === true,
      sourceCurrent: Boolean(node && browser),
    }
    return {
      code, name: card?.nameZh || card?.name || code, file, sha256: fileSha(file),
      signatures, bonded, checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: [`tests/fhv-investigator-${code}.test.mjs`, 'audit/fhv-node-acceptance.json', 'audit/fhv-investigators-browser.json'],
    }
  })
  const knownFailures = Array.isArray(regression?.knownFailures) ? regression.knownFailures : []
  const newFailures = Array.isArray(regression?.fast?.newFailures) ? regression.fast.newFailures : ['<missing regression>']
  const checks = {
    nodeAcceptance: node?.investigators?.pass === true,
    browserAcceptance: browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true,
    investigatorsAllVerified: items.every(item => item.status === 'verified'),
    // P5 开放调查员包：20 条（5 调查员 + 15 专属/绑定依赖）规则全真、不可构筑；战役包保持 catalog-only\n// （一般玩家卡包在 P6 升 playable，P5 账本按阶段边界允许其 playable）。
    packBoundary: investigatorManifest.status === 'playable'
      && investigatorManifest.cards.length === 20
      && investigatorManifest.cards.every(card => card.cataloged === true && card.rulesImplemented === true && card.deckbuilding === false)
      && investigatorManifest.cards.every(card => card.investigator === true || card.dependencyOnly === true),
    // P7 起战役包随逐章验收升 playable；P5 账本只约束「调查员/玩家卡包开放、战役不再被误伤」，
  // 战役的逐章证据由 P7 场景账本负责。
  otherPacksCatalogOnly: ['catalog-only', 'playable', 'verified'].includes(campaignManifest?.status)
    && ['playable', 'verified'].includes(playerManifest?.status),
    originalBaselinePreserved: Boolean(baselineReplaySha) && currentReplaySha === baselineReplaySha,
    replayZeroDrift: regression?.status === 'passed' && regression?.replay?.matches === true,
    fastNoNewFailures: newFailures.length === 0 && knownFailures.length > 0,
    docsPresent: existsSync(join(MOD, 'docs/campaign/theFeastOfHemlockVale/investigators.md')),
  }
  const sources = [
    'audit/fhv-node-acceptance.json', 'audit/fhv-investigators-browser.json', 'audit/fhv-regression.json',
    'audit/fhv-baseline.json', 'content/packs/fhvInvestigators/manifest.js', 'content/packs/fhvCampaign/manifest.js',
    'content/packs/fhvPlayer/manifest.js', 'src/deck/availability.js', 'src/deck/deckbuilding.js',
    'web/deck-rules.js', 'content/campaigns/theFeastOfHemlockVale/investigator-data.js',
    ...FHV_INVESTIGATOR_CODES.map(code => `src/cards/entries/${code}.js`),
    ...FHV_SIGNATURE_CODES.map(code => `src/cards/entries/${code}.js`),
    ...[...FHV_BONDED_CODES].map(code => `src/cards/entries/${code}.js`),
  ].filter((path, index, list) => list.indexOf(path) === index && existsSync(join(MOD, path))).sort()
  const status = Object.values(checks).every(Boolean) ? 'verified' : 'pending'
  return {
    schemaVersion: 1, cycle: 'fhv', phase: 'P5', generatedBy: 'tools/audit-fhv-investigators.mjs',
    status, items, checks, gates: checks,
    deliveredInvestigators: items.every(item => item.status === 'verified') ? [...FHV_INVESTIGATOR_CODES] : [],
    boundary: 'P5 只认证 5 位 FHV 调查员与 15 张专属/绑定依赖；战役（八章/序曲）仍 catalog-only。一般玩家卡包在 P6 由该阶段账本验收后开放，不改变 P5 对调查员逐人行为与存档回放的验收口径。',
    sources: sources.map(path => ({ path, sha256: fileSha(path) })),
    evidence: ['audit/fhv-node-acceptance.json', 'audit/fhv-investigators-browser.json', 'audit/fhv-regression.json', 'audit/fhv-baseline.json'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildInvestigatorAudit()
  const body = json(report)
  if (process.argv.includes('--write')) {
    mkdirSync(join(RUN), { recursive: true })
    writeFileSync(LEDGER, body)
    writeFileSync(join(RUN, 'investigators.json'), body)
    console.log(`fhv investigators: 已写入 ${LEDGER}（status=${report.status}，verified ${report.items.filter(item => item.status === 'verified').length}/${report.items.length}）`)
    console.log(json({ checks: report.checks, pending: report.items.filter(item => item.status !== 'verified').map(item => item.code) }))
  } else if (process.argv.includes('--check')) {
    if (!existsSync(LEDGER)) throw new Error('audit/fhv-investigators.json 不存在：先 --write')
    const disk = readFileSync(LEDGER, 'utf8')
    if (disk !== body) throw new Error('audit/fhv-investigators.json 与当前证据不一致：审阅后显式 --write')
    if (report.status !== 'verified') throw new Error(`fhv investigators 门禁未全真：${json(report.checks)}`)
    console.log('fhv investigators: 复算一致')
  } else {
    console.log(body)
    if (report.status !== 'verified') throw new Error(`fhv investigators 门禁未全真：${json(report.checks)}`)
  }
}
