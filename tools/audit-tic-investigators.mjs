import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, emit, json, readJson, sha } from './tic-migration-lib.mjs'
import { currentEvidence } from './tic-evidence.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { canSelectInvestigator, getAvailability, TIC_INVESTIGATOR_CODES, SIGNATURES_BY_INVESTIGATOR } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { manifest } from '../content/packs/ticInvestigators/manifest.js'
const behaviorTitles = {
  '07001': ['玛丽：', '信仰危机', '守护天使'],
  '07002': ['阿曼达轮换', '阿曼达每次检定', '晦涩研究', '阿曼达公开下方牌'],
  '07003': ['特里希发现线索', '特里希旧印', '潜于阴影'],
  '07004': ['戴克斯特主动能力', '戴克斯特旧印', '表演技巧由放置入场', '戴克斯特不能弃永久'],
  '07005': ['赛拉斯收回', '鱼叉和渔网真实行动', '塞壬呼唤：'],
}
export function buildInvestigatorAudit() {
  const node = currentEvidence('node-acceptance'), browser = currentEvidence('interactions-browser')
  const replay = currentEvidence('investigator-replay'), regression = currentEvidence('interaction-regression')
  const baseline = readJson(join(MOD, 'audit/tic-p5-baseline.json'))
  const passed = text => !!node?.testTitles?.some(title => title.startsWith('P5 ') && title.includes(text))
  const browserPassed = title => !!browser?.tests.some(row => row.file === 'tests/tic-investigators.browser.mjs'
    && row.status === 'passed' && row.title.includes(title))
  const items = TIC_INVESTIGATOR_CODES.map(code => {
    const signatures = SIGNATURES_BY_INVESTIGATOR[code].map(sig => ({ code: sig,
      name: ALL_CARDS[sig].nameZh || ALL_CARDS[sig].name, file: `src/cards/entries/${sig}.js`,
      registered: !!registeredEntry(sig), dependencyOnly: getAvailability(sig).dependencyOnly,
      implemented: !registeredEntry(sig)?.simplified, sha256: sha(readFileSync(join(MOD, `src/cards/entries/${sig}.js`))) }))
    let decks = false
    try {
      const automatic = buildDeck(INVESTIGATORS[code], { seed: `tic-p5-audit-${code}` })
      const manual = buildDeckFromList(INVESTIGATORS[code], automatic.playerCards, { seed: `tic-p5-manual-${code}` })
      decks = automatic.playerCards.length === INVESTIGATORS[code].deckRequirements.size
        && manual.playerCards.length === automatic.playerCards.length
        && signatures.every(sig => [...automatic.signatureCards, ...automatic.signatureWeaknesses].includes(sig.code))
    } catch {}
    const checks = { registered: !!registeredEntry(code), elderSign: !!registeredEntry(code)?.elderSign,
      signatures: signatures.every(sig => sig.registered && sig.implemented && sig.dependencyOnly),
      deckConstruction: decks && passed(code), behaviors: behaviorTitles[code].every(passed),
      desktop: browserPassed(`P5 desktop ${code}`), mobile: browserPassed(`P5 mobile ${code}`),
      selectable: canSelectInvestigator(code), sourceCurrent: !!node && !!browser && !!replay && !!regression }
    return { code, name: ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
      file: `src/cards/entries/${code}.js`, signatures, checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      evidence: ['tests/tic-investigators.test.mjs', 'audit/tic-node-acceptance.json', 'audit/tic-interactions-browser.json'] }
  })
  const checks = { investigators: items.every(item => item.status === 'verified'),
    packBoundary: manifest.status === 'playable' && manifest.cards.every(card => card.rulesImplemented),
    dexterCardEntry: ['desktop', 'mobile'].every(viewport => browserPassed(`P5 ${viewport} 戴克斯特`)),
    jsonAndMultiplayer: passed('JSON 恢复') && passed('赛拉斯收回') && passed('戴克斯特主动能力'),
    originalBaselinePreserved: baseline.replaySha256 === sha(readFileSync(join(MOD, baseline.replayFile))),
    replayExact: !!replay && replay.replay.exitCode === 0,
    fastZeroFailures: !!regression && regression.fast.exitCode === 0 && regression.fast.failures.length === 0 }
  return { schemaVersion: 1, cycle: 'tic', phase: 'P5', generatedBy: 'tools/audit-tic-investigators.mjs',
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending', items,
    reprints: { '98016': { canonical: '07004', registered: !!registeredEntry('98016'), selectable: canSelectInvestigator('98016') },
      '98013': { note: '同能力的书附版本未独立开放；替换专属卡不在本批范围，未复制行为文件。' } },
    boundary: 'P5 certifies five TIC investigators and eleven signature dependencies. Ordinary player cards are separately certified by P6; the campaign remains catalog-only. Existing AI random and automatic card pools are unchanged.',
    evidence: ['audit/tic-node-acceptance.json', 'audit/tic-interactions-browser.json', 'audit/tic-investigator-replay.json',
      'audit/tic-interaction-regression.json', 'audit/tic-p5-baseline.json'], gates: checks }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('investigators', buildInvestigatorAudit())
