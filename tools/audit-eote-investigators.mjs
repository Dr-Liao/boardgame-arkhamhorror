#!/usr/bin/env node
// 七循环《地球边缘》P5 调查员账本：逐人能力/构筑/专属依赖/浏览器验收。
//
//   node tools/audit-eote-investigators.mjs --write   生成 audit/eote-investigators.json
//   node tools/audit-eote-investigators.mjs --check   逐字节复算（结论漂移即失败）
//   node tools/audit-eote-investigators.mjs           打印账本 JSON（不写盘）
//
// 本工具只读证据：node 验收（audit/eote-node-acceptance.json）、调查员浏览器验收
// （audit/eote-investigators-browser.json）、回归（audit/eote-regression.json）与 P0 基线
// （audit/eote-baseline.json 的 replay sha256）；逐人结论由实跑产物与当前源码复算，不复制冻结数字。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, emit, json, readJson, sha } from './eote-migration-lib.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { canSelectInvestigator, getAvailability, SIGNATURE_CARD_CODES_BY_INVESTIGATOR } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { eoteInvestigatorBuildRules } from '../content/campaigns/edgeOfTheEarth/investigator-data.js'
import { manifest } from '../content/packs/eoteInvestigators/manifest.js'

const EOTE_INVESTIGATORS = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
const PARALLEL_VERSIONS = Object.freeze([
  { code: '98007', name: '诺曼·威瑟斯（平行）', replacement: ['98008', '98009'] },
  { code: '90062', name: '蒙特雷·杰克（平行）', replacement: ['90063', '90064'] },
])
const readMaybe = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)

const doctorTitles = report => (Array.isArray(report?.tests) ? report.tests : [])
const nodeTitle = (report, code) => doctorTitles(report).some(title => String(title).startsWith(`P5 ${code} `))
const browserTitle = (report, viewport, code) => doctorTitles(report).some(test => test.status === 'passed'
  && String(test.file || '').endsWith('eote-investigators.browser.mjs') && String(test.title || '').startsWith(`P5 ${viewport} ${code} `))

export function buildInvestigatorAudit() {
  const node = readMaybe('audit/eote-node-acceptance.json')
  const browser = readMaybe('audit/eote-investigators-browser.json')
  const regression = readMaybe('audit/eote-regression.json')
  const baseline = readMaybe('audit/eote-baseline.json')
  const baselineReplaySha = baseline?.replaySha256 || baseline?.replayFileSha256 || null
  const currentReplaySha = fileSha('tests/fixtures/replay/eote-baseline.json')
  const items = EOTE_INVESTIGATORS.map(code => {
    const card = ALL_CARDS[code]
    const file = `src/cards/entries/${code}.js`
    const buildRules = eoteInvestigatorBuildRules(code)
    const signatureCodes = [...(SIGNATURE_CARD_CODES_BY_INVESTIGATOR[code] || []), ...(buildRules?.disciplineCodes || [])]
    const signatures = signatureCodes.map(sigCode => ({
      code: sigCode, name: ALL_CARDS[sigCode]?.nameZh || ALL_CARDS[sigCode]?.name || sigCode,
      file: `src/cards/entries/${sigCode}.js`, registered: !!registeredEntry(sigCode),
      dependencyOnly: getAvailability(sigCode).dependencyOnly === true,
      implemented: !registeredEntry(sigCode)?.simplified && !!registeredEntry(sigCode),
      sha256: fileSha(`src/cards/entries/${sigCode}.js`),
    }))
    let deckConstruction = false
    try {
      const automatic = buildDeck(INVESTIGATORS[code], { seed: `eote-p5-audit-${code}`, xp: 0 })
      const manual = buildDeckFromList(INVESTIGATORS[code], automatic.playerCards, { seed: `eote-p5-manual-${code}`, xp: 0 })
      const requiredSignatures = [...(INVESTIGATORS[code].deckRequirements.signatureCards || [])]
      deckConstruction = automatic.playerCards.length === 30 && manual.playerCards.length === automatic.playerCards.length
        && requiredSignatures.every(sig => [...automatic.signatureCards, ...automatic.signatureWeaknesses].includes(sig))
        && (buildRules ? automatic.signatureCards.some(sig => buildRules.disciplineCodes.includes(sig))
          && automatic.signatureWeaknesses.filter(sig => sig === buildRules.burdenCode).length === automatic.signatureCards.filter(sig => buildRules.disciplineCodes.includes(sig)).length
          : true)
    } catch (error) {
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
      selectable: canSelectInvestigator(code),
      sourceCurrent: Boolean(node && browser && regression),
    }
    return {
      code, name: card?.nameZh || card?.name || code, file, sha256: fileSha(file),
      signatures, checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: ['tests/eote-investigator-*.test.mjs', 'audit/eote-node-acceptance.json', 'audit/eote-investigators-browser.json'],
    }
  })
  const fastFailures = Array.isArray(regression?.fast?.failures) ? regression.fast.failures : []
  const frozen = Array.isArray(baseline?.fastFailures) ? baseline.fastFailures : []
  const checks = {
    nodeAcceptance: node?.status === 'passed',
    browserAcceptance: browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true,
    investigatorsAllVerified: items.every(item => item.status === 'verified'),
    packBoundary: manifest.status === 'playable'
      && manifest.cards.length === 22
      && manifest.cards.every(card => card.cataloged === true && card.rulesImplemented === true && card.deckbuilding === false)
      && manifest.cards.every(card => card.investigator === true || card.dependencyOnly === true),
    parallelVersionsOutOfScope: PARALLEL_VERSIONS.every(entry => !canSelectInvestigator(entry.code)
      && !registeredEntry(entry.code) && entry.replacement.every(code => !canSelectInvestigator(code))),
    originalBaselinePreserved: Boolean(baselineReplaySha) && currentReplaySha === baselineReplaySha,
    replayZeroDrift: regression?.status === 'passed' && regression?.replay?.matches === true,
    fastNoNewFailures: fastFailures.length === frozen.length && fastFailures.every(title => frozen.includes(title))
      && Array.isArray(regression?.fast?.additionsSinceInitialBaseline) && regression.fast.additionsSinceInitialBaseline.length === 0,
    docsPresent: existsSync(join(MOD, 'docs/edgeOfTheEarth/investigators.md')),
  }
  const sources = [
    'audit/eote-node-acceptance.json', 'audit/eote-investigators-browser.json', 'audit/eote-regression.json',
    'audit/eote-baseline.json', 'content/packs/eoteInvestigators/manifest.js', 'src/deck/availability.js',
    'src/deck/deckbuilding.js', 'content/campaigns/edgeOfTheEarth/investigator-data.js',
    ...EOTE_INVESTIGATORS.map(code => `src/cards/entries/${code}.js`),
    ...EOTE_INVESTIGATORS.flatMap(code => (SIGNATURE_CARD_CODES_BY_INVESTIGATOR[code] || []).map(sig => `src/cards/entries/${sig}.js`)),
    ...EOTE_INVESTIGATORS.flatMap(code => (eoteInvestigatorBuildRules(code)?.disciplineCodes || []).map(sig => `src/cards/entries/${sig}.js`)),
  ].filter((path, index, list) => list.indexOf(path) === index && existsSync(join(MOD, path))).sort()
  return {
    schemaVersion: 1, cycle: 'eote', phase: 'P5', generatedBy: 'tools/audit-eote-investigators.mjs',
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    items, checks, gates: checks,
    deliveredInvestigators: items.every(item => item.status === 'verified') ? [...EOTE_INVESTIGATORS] : [],
    reprints: {
      parallelVersions: PARALLEL_VERSIONS.map(entry => ({ ...entry, canonical: entry.code === '98007' ? '08004' : '08007',
        inScope: false, note: '平行调查员版本（iotv/rop）与替换专属卡不在本循环 403 条记录内，保持 catalog-only；本批只验收 08004/08007 及其专属卡。' })),
      signatureAlternates: [
        { code: '98008', canonical: '08005' }, { code: '98009', canonical: '08006' },
        { code: '90063', canonical: '08008' }, { code: '90064', canonical: '08009' },
      ].map(entry => ({ ...entry, inScope: false, note: 'deckRequirements.card 的替换映射用于数据核对；替换专属卡不随本批开放。' })),
    },
    boundary: 'P5 只认证 5 位 EotE 调查员与 17 张专属依赖；一般玩家卡见 P6，八章与战役流程仍属 P7–P8。AI 随机选人池与既有 replay 基线不变。',
    sources: sources.map(path => ({ path, sha256: fileSha(path) })),
    evidence: ['audit/eote-node-acceptance.json', 'audit/eote-investigators-browser.json', 'audit/eote-regression.json', 'audit/eote-baseline.json'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildInvestigatorAudit()
  const body = json(report)
  const target = join(MOD, 'audit/eote-investigators.json')
  if (process.argv.includes('--write')) {
    emit('investigators', report)
    console.log(`eote investigators: 已写入 ${target}（status=${report.status}）`)
    console.log(json({ checks: report.checks, verified: report.items.filter(item => item.status === 'verified').length }))
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target)) throw new Error('audit/eote-investigators.json 不存在：先 --write')
    const disk = readFileSync(target, 'utf8')
    if (disk !== body) throw new Error('audit/eote-investigators.json 与当前证据不一致：审阅后显式 --write')
    if (report.status !== 'verified') throw new Error(`eote investigators 门禁未全真：${json(report.checks)}`)
    console.log('eote investigators: 复算一致')
  } else {
    console.log(body)
    if (report.status !== 'verified') throw new Error(`eote investigators 门禁未全真：${json(report.checks)}`)
  }
}
