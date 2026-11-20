import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { campaignSource, cardSource, guideRoot, mod, refJson, sha, writeOrCheck } from './scan-tdc-scope.mjs'

const definitions = [
  ['flood', 'primitive', /flood(ed|ing)?\b|flood level/i, ['src/engine/flood.js'], '按卡区分部分和完全淹没及增减条件'],
  ['chaosSeal', 'primitive', /seal(?:ed|ing)?\b|release.*token/i, ['src/engine/chaos-token-pool.js'], '核对密封来源、释放目标、取消及忽略的窗口'],
  ['attachments', 'primitive', /attach(?:ed|ment)?\b|beneath|under (?:this|it|your)|face[ -]down/i, ['src/engine/location-attachments.js', 'src/engine/hosted-assets.js', 'src/engine/play-channels.js'], '按宿主、所有者及查看权限表达卡牌承载区'],
  ['campaignRecords', 'primitive', /campaign log|(?:for|remainder of) the campaign|next scenario|permanently/i, ['src/engine/campaign-flow.js'], '跨章标记和下一章一次性效果需独立验收'],
  ['tasks', 'primitive', /\btask\b|mark (?:off|progress)|erase.*progress/i, ['src/engine/campaign-flow.js'], '调查员独立进度、唯一指派、退场和重试去重'],
  ['glyphs', 'primitive', /glyph|\[tdc_rune_|translate\b/i, ['src/engine/campaign-flow.js'], '集合去重与字形组解锁'],
  ['handoff', 'primitive', /artifact|(?:when|after).*defeat.*investigator|take control/i, ['src/engine/harm-threat.js', 'src/engine/api-misc.js'], '被击败时选择距离最近的幸存者'],
  ['topology', 'primitive', /adjacen|connect(?:ed|ion|ing)|grid|rows?\b|columns?\b|(?:this location.s|above|below) level|level (?:above|below)|great lift|cannot enter/i, ['src/engine/grid-map.js'], '按行相邻并支持位置变更后的即时重算'],
  ['separateDeck', 'primitive', /summit deck|cthulhu deck|separate deck|bottom of (?:the|that).*deck/i, ['src/engine/scenario-decks.js', 'src/engine/encounter.js'], '独立牌库底部取牌及弃置归属'],
  ['multipartEnemy', 'primitive', /\bcthulhu\b|board piece|body part|wrath/i, ['src/engine/targets.js', 'src/engine/enemies.js'], '一个敌人承载多个战斗/躲避目标与敌人阶段合计结算'],
  ['encounterKeywords', 'keyword', /\b(?:alert|patrol|relentless|seal|aloof|hunter|retaliate|massive|surge|peril|prey|myriad|exceptional)\b/i, ['src/engine/enemies.js', 'src/engine/chaos-bag.js'], '警戒、巡逻、无情和封印的印刷卡与验收见 audit/tdc-rules.json'],
  ['scenarioSetup', 'scenario', /\bsetup\b|(?:place|put|enters?)\b.*(?:into )?play|gather|set.*aside|resolution|\b(?:agenda|objective|victory display|otherwise)\b|→\s*R\d|proceed to|^if (?:an |each ).*investigator|\bdeactivat\w*/i, ['src/engine/scenario-runtime.js'], '条件设置、进入与结果逐章验收'],
  ['scenarioRules', 'rulebook', /^(?:Easy|Hard)\s*\/|^\[(?:cultist|tablet|skull|elder_thing|elder_sign)\]/i, ['src/engine/chaos-bag.js'], '按难度和路线区分符号效果'],
  ['selection', 'interaction', /\bchoose\b|select|\bany number\b|must decide/i, ['src/engine/targets.js', 'src/engine/table-decisions.js'], '合法目标、控制权和私人选择由服务端裁定'],
  ['skillTests', 'primitive', /\btest(?:s|ing)?\b|\bcommit(?:ted)?\b|succeed|\bfail(?:ed|ure)?\b/i, ['src/engine/ability.js'], '按窗口、目标、差值和技能替换核对'],
  ['cardZones', 'primitive', /\bdraw\b|\bsearch\b|\bdiscard|\bshuffle\b|out of play|removed? from (?:the )?game|top card|leave play/i, ['src/engine/deck-ops.js', 'src/engine/play-channels.js'], '核对持有者、目的区和私有信息'],
  ['enemyActions', 'primitive', /\b(?:fight|evade|spawn|engag\w*|attacks?|enemy|enemies)\b/i, ['src/engine/enemies.js'], '按印刷攻击、躲避、追猎与目标限制核对'],
  ['economy', 'primitive', /\bcost\b|\bresources?\b|\buses\b|\bammo\b|\bcharges?\b|\bsupply\b|(?:number|additional|loses?|first) \w* ?actions?\b/i, ['src/engine/ability.js', 'src/engine/cost.js'], '核对额外费用、用途与分来源限次'],
  ['harmAndClues', 'primitive', /\b(?:damage|horror|trauma|clues?|defeated|resign(?:s|ed)?|insane)\b/i, ['src/engine/harm-threat.js', 'src/engine/api-clue.js'], '按来源、波及范围、承受与移除的类型区分'],
  ['modifiers', 'primitive', /(?:get|gets|gain|gains) [+-]\d|(?:increas|decreas)e[ds]? by|cannot (?:be|have) |maximum|minimum|^X is/i, ['src/engine/modifiers.js'], '按实体和持续时间验证修正与限制'],
  ['timedEffects', 'primitive', /\blimit\b|\bforced\b|\brevelation\b|\bfast\b|\[reaction\]|\[action\]|until the end|cannot trigger|play only|during your turn/i, ['src/engine/ability.js', 'src/engine/effect-state.js'], '登记实际触发窗口和持续期'],
  ['deckbuilding', 'content', /deck(?:building| size| creation| only)|\bpermanent\b|\bbonded\b|\bexperience\b|purchas|upgrade cards/i, ['src/deck/deckbuilding.js'], '调查员特质选项、共用身份、关联牌与转换门禁在内容阶段核对'],
  ['slots', 'primitive', /(?:hand|arcane|ally|accessory|body) slots?/i, ['src/engine/assets.js'], '按可用槽位和限定特质校验入场与替换'],
  ['physicalFace', 'primitive', /\bflip\b|other side|reverse side/i, ['src/engine/physical-faces.js'], '同实体换面和调查员跨类型转换须分别验收'],
  ['storyText', 'content', /^(?:<blockquote>\s*|<small>\s*)?<i>|card design inspired/i, ['src/cards/cards-data.js'], '保留叙事所在的原文定位，随指南核对可达性'],
  ['printedCard', 'content', /^<hr\s*\/?\s*>$/i, ['src/cards/cards-data.js'], '保留类别、印刷属性和卡文来源，具体行为按条目后续验收'],
]

const stages = {
  flood: 'reuse', chaosSeal: 'reuse', attachments: 'reuse', campaignRecords: 'reuse',
  tasks: 'new', glyphs: 'reuse', handoff: 'new', topology: 'new', separateDeck: 'new', multipartEnemy: 'new',
  skillTests: 'reuse', cardZones: 'reuse', enemyActions: 'reuse', economy: 'reuse', harmAndClues: 'reuse',
  modifiers: 'reuse', timedEffects: 'reuse', slots: 'reuse', physicalFace: 'reuse',
}
const guideUrl = 'https://images-cdn.fantasyflightgames.com/filer_public/c1/3b/c13b0e74-62bb-49bc-bc85-036ab9d1ef10/ahc84_campaign_guide-web_1.pdf'
const faqUrl = 'https://images-cdn.fantasyflightgames.com/filer_public/f9/25/f925d867-e844-48d1-9d41-045ce41f8950/ahc_faq_v24_july_2025.pdf'
const guideDecisions = [
  { id: 'expeditionTokens', source: [{ url: guideUrl, page: 11 }, { file: `${guideRoot}/interludes.json`, path: 'expeditionToRlyeh.westernChaosTokens' },
      { file: campaignSource, search: 'CampaignStep (InterludeStep 2 _)' }],
    decision: '幕间 II 只有西线移除 1 枚石板并加入 1 枚邪教徒，变化持续到战役后续。东线不调整；参考后端的东线 TODO 与印刷指南冲突，西线后端遗漏状态更新。' },
  { id: 'initialBag', source: [{ url: guideUrl, page: 3 }, { file: `${guideRoot}/base.json` }],
    decision: '发行商俄文版 PDF 第 3 页渲染后逐枚核对通过。四档均与参考后端一致，英文网页的文字抽取漏读了部分数字与符号。印刷来源与 SHA-256 见范围账本 printedBagSource。' },
  { id: 'apiarySetup', source: [{ url: faqUrl, search: 'The Apiary, Scenario Setup (v.II)' }],
    decision: '东线布置的第五项包含 The Inescapable 遭遇组。' },
  { id: 'doomPartOneSetup', source: [{ url: faqUrl, search: 'The Doom of Arkham, Scenario Setup - Part I' }],
    decision: '勘误第 5 项将 Randall、所有已获文物和 Horror in Clay 设在一旁。' },
  { id: 'finalSeal', source: [{ url: faqUrl, search: 'Special Agenda 2b' }, { file: `${guideRoot}/theDoomOfArkhamPartII.json`, path: 'errata' }],
    decision: '达到毁灭阈值引起的推进触发败退分支；其他方式推进走另一分支。' },
  { id: 'noPlaceLikeHome', source: [{ url: faqUrl, search: 'No Place Like Home' }],
    decision: '地点被揭示和地点进入场上都应触发任务的首个强制能力。' },
  { id: 'oneLastJobLocations', source: [{ url: guideUrl, page: 4 }],
    decision: '从核心组只取地点；两份 Downtown 按指南随机选，参考后端的固定选择仅作为差异记录。' },
  { id: 'artifactHandoff', source: [{ url: guideUrl, page: 2 }, { file: `${guideRoot}/base.json`, path: 'additionalRulesAndClarifications.artifacts' }],
    decision: '败退时转移同一实物。引擎按地点有向通路计算距离，等距由领队选择；断路距离记为无限。' },
  { id: 'separateActionDeck', source: [{ url: guideUrl, page: 48 }, { file: `${guideRoot}/theDoomOfArkhamPartII.json`, path: 'cthulhuDeck' }],
    decision: '行动牌从独立牌库取出并在结算后回到自身弃牌；用尽时立即重洗，走自有结算过程。' },
]

function leaves(value, path = []) {
  if (typeof value === 'string') return [{ path: path.join('.'), text: value }]
  return Object.entries(value ?? {}).flatMap(([key, child]) => leaves(child, [...path, key]))
}

function guideInventory(scope) {
  const files = scope.guides.english.map(file => ({ file, rows: leaves(refJson(file)) }))
  const indexed = new Map()
  for (const { file, rows } of files) {
    const name = file.split('/').at(-1).slice(0, -5)
    for (const { path, text } of rows) {
      const key = name === 'base' || name === 'interludes' ? path : `${name}.${path}`
      assert(!indexed.has(key), `指南键冲突 ${key}`)
      indexed.set(key, { file, path, text })
    }
  }
  const required = ['sunkenStairway', 'lostPilgrims', 'theHiveMind', 'theVaultCore', 'cosmicOmen', 'hangingShip', 'magneticSpires', 'errata']
  for (const key of required) assert([...indexed.keys()].some(path => path.split('.').includes(key)), `缺少指南小节 ${key}`)
  function resolve(text, visited = new Set()) {
    const targetKey = text.match(/^@:theDrownedCity\.(.+)$/)?.[1]
    if (!targetKey) return null
    const target = indexed.get(targetKey)
    assert(target && !visited.has(targetKey), `指南引用失效 ${targetKey}`)
    visited.add(targetKey)
    return resolve(target.text, visited) || { file: target.file, path: target.path, sha256: sha(target.text) }
  }
  return files.map(({ file, rows }) => ({
    file, scenario: scope.scenarios.find(chapter => chapter.guide === file)?.id ?? null,
    translationFile: `content/campaigns/theDrownedCity/story-source/zh-CN/${file.split('/').at(-1)}`,
    paragraphs: rows.map(({ path, text }) => {
      const targets = [...text.matchAll(/<img\b[^>]*\bsrc=['"]([^'"]+)/gi)].map(match => match[1])
      const group = path.match(/^(?:[^.]*\.)?(specialRules|setup|resolutions?|errata|tasks?|intro\w*|epilogue)(?:\.|$)/i)?.[1] || 'narrative'
      const linked = resolve(text)
      return { path, sha256: sha(text), group, translation: { path, status: 'missing' },
        ...(linked ? { reference: linked } : {}), ...(targets.length ? { diagrams: targets } : {}) }
    }),
  }))
}

const scopeFile = 'audit/tdc-scope.json'
const scope = JSON.parse(readFileSync(join(mod, scopeFile), 'utf8'))
const lookup = new Map(refJson(cardSource).map(card => [card.code, card]))
const ownerByCode = Object.fromEntries(Object.entries(scope.partitions).flatMap(([owner, codes]) => codes.map(code => [code, owner])))
const fields = ['text', 'back_text', 'customization_text', 'customization_change', 'traits', 'deck_options', 'deck_requirements', 'restrictions', 'bonded_cards']
const cardRows = scope.codes.map(code => {
  const source = lookup.get(code)
  assert(source && ALL_CARDS[code], code)
  const units = fields.flatMap(field => {
    const value = source[field]
    const lines = typeof value === 'string' ? value.split(/\r?\n/) : value == null ? [] : [JSON.stringify(value)]
    return lines.flatMap((line, index) => {
      if (!line.trim()) return []
      const text = line.replace(/<[^>]+>/g, '').trim()
      const mechanisms = definitions.filter(([, , pattern]) => pattern?.test(text) || pattern?.test(line)).map(([id]) => id)
      return [{ field, line: index + 1, sha256: sha(line), mechanisms }]
    })
  })
  const mechanisms = [...new Set(units.flatMap(unit => unit.mechanisms))]
  if (source.type_code === 'investigator') mechanisms.push('deckbuilding')
  if (!mechanisms.length) mechanisms.push('printedCard')
  return { code, owner: ownerByCode[code], type: source.type_code, mechanisms: [...new Set(mechanisms)],
    units, behavior: 'pending' }
})
const inventory = guideInventory(scope)
const mechanisms = definitions.map(([id, type, , readPoints, gap]) => {
  for (const file of readPoints) assert(existsSync(join(mod, file)), `机制读点缺失 ${file}`)
  const cards = cardRows.filter(card => card.mechanisms.includes(id)).map(card => card.code)
  const provenance = cards.slice(0, 6).map(code => `${cardSource}#${code}`)
  return { id, type, cards, representativeCards: cards.slice(0, 6), source: provenance, readPoints, gap,
    ...(stages[id] ? { disposition: stages[id] } : {}) }
})
const unclassified = cardRows.filter(card => !card.owner || !card.mechanisms.length).map(card => card.code)
assert.equal(unclassified.length, 0)
const scan = {
  schemaVersion: 1, scope: scopeFile, scopeSha256: sha(JSON.stringify(scope)), cardSource,
  coverage: { cards: cardRows.length, unclassified, guideFiles: inventory.length,
    guideParagraphs: inventory.reduce((sum, entry) => sum + entry.paragraphs.length, 0),
    ruleLinesAwaitingSemanticReview: cardRows.reduce((sum, card) => sum + card.units.filter(unit => !unit.mechanisms.length && unit.field.endsWith('text')).length, 0) },
  cardRows, mechanisms, guides: inventory, decisions: guideDecisions,
}
writeOrCheck('audit/tdc-mechanism-scan.json', scan, process.argv[2])
console.log(`TDC P1 ${process.argv[2]} · ${cardRows.length} 张卡已归类 · ${scan.coverage.guideParagraphs} 个指南段落已登记`)
