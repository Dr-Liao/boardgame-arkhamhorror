#!/usr/bin/env node
// 八循环《绯红密钥》P5 调查员账本：逐人能力/旧印/构筑/专属依赖/浏览器验收。
//
//   node tools/audit-tsk-investigators.mjs --write   生成 audit/tsk-investigators.json
//   node tools/audit-tsk-investigators.mjs --check   逐字节复算（结论漂移即失败）
//   node tools/audit-tsk-investigators.mjs           打印账本 JSON（不写盘）
//
// 本工具只读证据：Node 验收（audit/tsk-node-acceptance.json 的 investigators 段）、调查员浏览器验收
// （audit/tsk-investigators-browser.json）、回归（audit/tsk-regression.json）与 P0 基线
// （audit/tsk-baseline.json 的 replay sha256）；逐人结论由实跑产物与当前源码复算，不复制冻结数字。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, emit, json, readJson, sha } from './tsk-migration-lib.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { canSelectInvestigator, getAvailability, SIGNATURE_CARD_CODES_BY_INVESTIGATOR } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { manifest as investigatorManifest } from '../content/packs/tskInvestigators/manifest.js'
import { manifest as campaignManifest } from '../content/packs/tskCampaign/manifest.js'
import { manifest as playerManifest } from '../content/packs/tskPlayer/manifest.js'
import { INVESTIGATOR_CODES as TSK_INVESTIGATOR_CODES } from '../content/campaigns/theScarletKeys/shared.js'
import { TSK_BONUS_XP } from '../content/campaigns/theScarletKeys/investigator-data.js'

const INVESTIGATOR_CODES = Object.freeze([...TSK_INVESTIGATOR_CODES])
const readMaybe = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)
const passTitles = report => (Array.isArray(report?.tests) ? report.tests : [])
const nodeTitle = (report, code) => (report?.investigators?.titles || []).some(title => String(title).startsWith(`P5 ${code} `))
const browserTitle = (report, viewport, code) => passTitles(report).some(test => test.status === 'passed'
  && String(test.file || '').endsWith('tsk-investigators.browser.mjs')
  && String(test.title || '').startsWith(`P5 ${viewport} ${code} `))

export function buildInvestigatorAudit() {
  const node = readMaybe('audit/tsk-node-acceptance.json')
  const browser = readMaybe('audit/tsk-investigators-browser.json')
  const regression = readMaybe('audit/tsk-regression.json')
  const baseline = readMaybe('audit/tsk-baseline.json')
  const baselineReplaySha = baseline?.replaySha256 || baseline?.replayFileSha256 || null
  const currentReplaySha = fileSha('tests/fixtures/replay/tsk-baseline.json')
  const items = INVESTIGATOR_CODES.map(code => {
    const card = ALL_CARDS[code]
    const file = `src/cards/entries/${code}.js`
    const signatureCodes = [...(SIGNATURE_CARD_CODES_BY_INVESTIGATOR[code] || [])]
    const signatures = signatureCodes.map(sigCode => ({
      code: sigCode, name: ALL_CARDS[sigCode]?.nameZh || ALL_CARDS[sigCode]?.name || sigCode,
      file: `src/cards/entries/${sigCode}.js`, registered: !!registeredEntry(sigCode),
      dependencyOnly: getAvailability(sigCode).dependencyOnly === true,
      implemented: !!registeredEntry(sigCode) && registeredEntry(sigCode).simplified !== true,
      sha256: fileSha(`src/cards/entries/${sigCode}.js`),
    }))
    let deckConstruction = false
    try {
      // 基玛尼开局多 5 经验：自动构筑内部计入，手动构筑复核时传同一经验预算。
      const auditXp = Number(TSK_BONUS_XP[code]) || 0
      const automatic = buildDeck(INVESTIGATORS[code], { seed: `tsk-p5-audit-${code}`, xp: auditXp })
      const manual = buildDeckFromList(INVESTIGATORS[code], automatic.playerCards, { seed: `tsk-p5-manual-${code}`, xpBudget: auditXp })
      const requiredSignatures = [...(INVESTIGATORS[code].deckRequirements.signatureCards || [])]
      deckConstruction = automatic.playerCards.length === 30 && manual.playerCards.length === automatic.playerCards.length
        && requiredSignatures.every(sig => [...automatic.signatureCards, ...automatic.signatureWeaknesses].includes(sig))
    } catch {
      deckConstruction = false
    }
    const checks = {
      registered: !!registeredEntry(code),
      elderSign: !!registeredEntry(code)?.elderSign,
      signatures: signatures.length > 0 && signatures.every(signature => signature.registered && signature.dependencyOnly && signature.implemented),
      deckConstruction,
      behaviors: nodeTitle(node, code),
      desktop: browserTitle(browser, 'desktop', code),
      mobile: browserTitle(browser, 'mobile', code),
      selectable: canSelectInvestigator(code) && getAvailability(code).selectable === true,
      sourceCurrent: Boolean(node && browser),
    }
    return {
      code, name: card?.nameZh || card?.name || code, file, sha256: fileSha(file),
      signatures, checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: ['tests/tsk-investigator-*.test.mjs', 'audit/tsk-node-acceptance.json', 'audit/tsk-investigators-browser.json'],
    }
  })
  const frozen = Array.isArray(baseline?.fastFailures) ? baseline.fastFailures : []
  const fastTitles = Array.isArray(regression?.fast?.titles) ? regression.fast.titles : []
  const additions = Array.isArray(regression?.fast?.additionsSinceInitialBaseline) ? regression.fast.additionsSinceInitialBaseline : []
  const checks = {
    nodeAcceptance: node?.investigators?.pass === true,
    browserAcceptance: browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true,
    investigatorsAllVerified: items.every(item => item.status === 'verified'),
    packBoundary: investigatorManifest.status === 'playable'
      && investigatorManifest.cards.length === 20
      && investigatorManifest.cards.every(card => card.cataloged === true && card.rulesImplemented === true && card.deckbuilding === false)
      && investigatorManifest.cards.every(card => card.investigator === true || card.dependencyOnly === true),
    otherPacksCatalogOnly: campaignManifest.status === 'catalog-only' && playerManifest.status === 'catalog-only'
      && [...campaignManifest.cards, ...playerManifest.cards].every(card => card.rulesImplemented === false && card.deckbuilding === false),
    originalBaselinePreserved: Boolean(baselineReplaySha) && currentReplaySha === baselineReplaySha,
    replayZeroDrift: regression?.status === 'passed' && regression?.replay?.matches === true,
    fastNoNewFailures: additions.length === 0 && fastTitles.length === frozen.length
      && fastTitles.every(title => frozen.includes(title)),
    docsPresent: existsSync(join(MOD, 'docs/campaign/theScarletKeys/investigators.md')),
  }
  const sources = [
    'audit/tsk-node-acceptance.json', 'audit/tsk-investigators-browser.json', 'audit/tsk-regression.json',
    'audit/tsk-baseline.json', 'content/packs/tskInvestigators/manifest.js', 'src/deck/availability.js',
    'src/deck/deckbuilding.js', 'web/deck-rules.js', 'content/campaigns/theScarletKeys/investigator-data.js',
    ...INVESTIGATOR_CODES.map(code => `src/cards/entries/${code}.js`),
    ...INVESTIGATOR_CODES.flatMap(code => (SIGNATURE_CARD_CODES_BY_INVESTIGATOR[code] || []).map(sig => `src/cards/entries/${sig}.js`)),
  ].filter((path, index, list) => list.indexOf(path) === index && existsSync(join(MOD, path))).sort()
  const status = Object.values(checks).every(Boolean) ? 'verified' : 'pending'
  return {
    schemaVersion: 1, cycle: 'tsk', phase: 'P5', generatedBy: 'tools/audit-tsk-investigators.mjs',
    status, items, checks, gates: checks,
    deliveredInvestigators: items.every(item => item.status === 'verified') ? [...INVESTIGATOR_CODES] : [],
    boundary: 'P5 只认证 6 位 TSK 调查员与 14 张专属依赖；一般玩家卡（09021–09128）与战役（09501+）仍 catalog-only，AI 随机选人池与既有 replay 行为不变（重采基线原因见 docs/campaign/theScarletKeys/investigators.md）。',
    sources: sources.map(path => ({ path, sha256: fileSha(path) })),
    evidence: ['audit/tsk-node-acceptance.json', 'audit/tsk-investigators-browser.json', 'audit/tsk-regression.json', 'audit/tsk-baseline.json'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildInvestigatorAudit()
  const body = json(report)
  const target = join(MOD, 'audit/tsk-investigators.json')
  if (process.argv.includes('--write')) {
    emit('investigators', report)
    console.log(`tsk investigators: 已写入 ${target}（status=${report.status}，verified ${report.items.filter(item => item.status === 'verified').length}/${report.items.length}）`)
    console.log(json({ checks: report.checks, pending: report.items.filter(item => item.status !== 'verified').map(item => item.code) }))
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target)) throw new Error('audit/tsk-investigators.json 不存在：先 --write')
    const disk = readFileSync(target, 'utf8')
    if (disk !== body) throw new Error('audit/tsk-investigators.json 与当前证据不一致：审阅后显式 --write')
    if (report.status !== 'verified') throw new Error(`tsk investigators 门禁未全真：${json(report.checks)}`)
    console.log('tsk investigators: 复算一致')
  } else {
    console.log(body)
    if (report.status !== 'verified') throw new Error(`tsk investigators 门禁未全真：${json(report.checks)}`)
  }
}
