// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P3 关键词与规则书身份（纯数据模块）。
//
// 口径见 docs/campaign/theFeastOfHemlockVale/README.md §3 P3 与 audit/fhv-mechanism-scan.json：
//   · 本文件登记 P3 需要逐项确认的 6 个关键词机制（逃逸／昼夜／法典／巡逻／警戒／祝福诅咒），
//     mechanismId 指向 P1 机制扫描账本里的对应行（keyword.elusive 等），顺序与 P3 清单一致；
//   · cardCodes 的语料与 P1 扫描器一致：只扫描卡牌正文、背面正文、定制栏与特质（不含卡名／副名），
//     由 patterns 复算，不手写卡号；测试与审计逐张比对 audit/fhv-mechanism-scan.json；
//   · origin：new = 本循环新增关键词（逃逸、昼夜、法典），existing = 已有通用关键词/标记在本循环的适用性确认；
//   · primitives = 该关键词在 P2 原语计划中的权威原语 id；engine 列出可被 Node 测试导入的引擎读点；
//   · ruleId 指向 web/fhv-rules.js（本循环条目）或已注册的通用条目（tskPatrol / alert）。
// 本文件只登记身份与规则入口，不实现行为；行为由 P2 原语与 P3 节点测试共同验收。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CYCLE_CODES } from './shared.js'

// [id, zh, ruleId, kind, origin, mechanismId, patterns, primitives, engine]
const definitions = [
  {
    id: 'elusive', zh: '逃逸', ruleId: 'fhvElusive', kind: 'keyword', origin: 'new',
    mechanismId: 'keyword.elusive', patterns: ['\\belusive\\b'], primitives: ['enemies.elusive'],
    engine: [{ module: 'src/engine/enemy-keyword-movement.js', names: ['setEnemyKeywords', 'resolveElusive', 'resolveElusiveAfterAttack'] }],
  },
  {
    id: 'dayNight', zh: '昼夜标记', ruleId: 'fhvDayNight', kind: 'keyword', origin: 'new',
    mechanismId: 'keyword.dayNight', patterns: ['\\[(?:day|night)\\]'],
    primitives: ['campaign.time', 'cards.bondedFaces'],
    engine: [
      { module: 'src/engine/scenario-calendar.js', names: ['setScenarioDate', 'scenarioPeriod', 'validateCalendarSave'] },
      { module: 'src/engine/matcher.js', names: ['duringPeriod'] },
    ],
  },
  {
    id: 'codex', zh: '铁杉谷法典', ruleId: 'fhvCodex', kind: 'keyword', origin: 'new',
    mechanismId: 'rulebook.codex', patterns: ['\\[codex\\]', 'relationship level'],
    primitives: ['campaign.codex', 'campaign.residents'],
    engine: [
      { module: 'src/engine/scenario-calendar.js', names: ['normalizeCodex', 'resolveCodex'] },
      { module: 'src/engine/resident-record.js', names: ['changeRelationship', 'changeResidentNote', 'crossOutResident'] },
    ],
  },
  {
    id: 'patrol', zh: '巡逻', ruleId: 'tskPatrol', kind: 'keyword', origin: 'existing',
    mechanismId: 'keyword.patrol', patterns: ['\\bpatrol\\b'], primitives: ['enemies.patrol'],
    engine: [{ module: 'src/engine/enemy-keyword-movement.js', names: ['normalizePatrolTarget', 'resolvePatrol'] }],
  },
  {
    id: 'alert', zh: '警戒', ruleId: 'alert', kind: 'keyword', origin: 'existing',
    mechanismId: 'keyword.alert', patterns: ['\\balert\\b'], primitives: ['enemies.alert'],
    engine: [
      { module: 'src/engine/enemy-keyword-movement.js', names: ['enemyHasAttackKeyword'] },
      { module: 'src/engine/combat.js', names: ['createCombat'] },
    ],
  },
  {
    id: 'blessCurse', zh: '祝福／诅咒', ruleId: 'fhvBlessCurse', kind: 'token', origin: 'existing',
    mechanismId: 'keyword.blessCurse', patterns: ['\\[(?:bless|curse)\\]'], primitives: ['chaos.blessCurse'],
    engine: [{
      module: 'src/engine/chaos-token-pool.js',
      names: ['rankedBagTokens', 'payMixedPoolTokens', 'replaceCampaignNumericTokens'],
    }],
  },
]

// 与 tools/scan-fhv-mechanisms.mjs 相同的卡文语料（只含正文与特质，不含卡名／副名）；
// 关键词卡面命中集合由 patterns 复算，保证与 P1 扫描账本逐张一致。
const corpusOf = card => [
  card.text || '', card.backText || '', card.customizationText || '', card.customizationChange || '',
  (card.traits || []).join(' '),
].join('\n')

const matches = (definition, card) =>
  definition.patterns.some(pattern => new RegExp(pattern, 'i').test(corpusOf(card)))

export const FHV_KEYWORDS = Object.freeze(definitions.map(definition => Object.freeze({
  ...definition,
  patterns: Object.freeze(definition.patterns),
  primitives: Object.freeze(definition.primitives),
  engine: Object.freeze(definition.engine.map(entry => Object.freeze({ ...entry, names: Object.freeze(entry.names) }))),
  cardCodes: Object.freeze(CYCLE_CODES.filter(code => matches(definition, ALL_CARDS[code]))),
})))

export const FHV_KEYWORD_IDS = Object.freeze(FHV_KEYWORDS.map(keyword => keyword.id))
export const FHV_SCANNED_KEYWORD_MECHANISMS = Object.freeze(FHV_KEYWORDS.map(keyword => keyword.mechanismId))
