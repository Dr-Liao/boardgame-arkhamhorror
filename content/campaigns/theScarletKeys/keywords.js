// 八循环《绯红密钥》（The Scarlet Keys）关键词与规则书身份（P3，纯数据模块）。
//
// 口径见 docs/campaign/theScarletKeys/README.md §3 P3 与 audit/tsk-mechanism-scan.json：
//   · 29 个关键词 = P1 机制扫描里 type=keyword 的全部机制，顺序与 id 与扫描账本一致；
//   · cardCodes 语料 = 卡名 + 副名 + 正文 + 背面正文 + 定制栏 + 定制变更 + 特质（与扫描器同一语料），
//     由 patterns / fields 复算，不手写卡号；
//   · kind：keyword（印刷关键词）、token（毁灭/标记类）、trait（以特性呈现：[[Stable]]/[[Unstable]]/[[Otherworld]]）；
//   · primitives = 该关键词机制在 P1 扫描里的 candidatePrimitives（原语事实源是 audit/tsk-primitive-plan.json）；
//   · ruleId 指向 web/tsk-rules.js；既有通用关键词复用基础规则条目，本循环新规则使用 tsk 前缀条目。
// 本文件只登记身份与规则入口，不实现行为；关键词引擎行为由 P2 原语与 P3 规则层共同验收。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CYCLE_CODES } from './shared.js'

// [id, zh, ruleId, kind, patterns, primitives, fields?]
const definitions = [
  ['hunter', '猎手', 'hunter', 'keyword', ['\\bHunter\\b'], ['core.enemy']],
  ['aloof', '冷漠', 'aloof', 'keyword', ['\\bAloof\\b'], ['core.enemy']],
  ['massive', '庞大', 'massive', 'keyword', ['\\bMassive\\b'], ['core.enemy']],
  ['retaliate', '反击', 'retaliate', 'keyword', ['\\bRetaliate\\b'], ['core.enemy']],
  ['alert', '警戒', 'alert', 'keyword', ['\\bAlert\\b'], ['core.enemy']],
  ['surge', '涌动', 'surge', 'keyword', ['\\bSurge\\b'], ['core.encounter']],
  ['peril', '险境', 'peril', 'keyword', ['\\bPeril\\b'], ['core.encounter']],
  ['hidden', '隐藏', 'hidden', 'keyword', ['\\bHidden\\b'], ['core.hiddenInfo']],
  ['revelation', '显现', 'revelation', 'keyword', ['\\bRevelation\\b'], ['core.encounter']],
  ['victoryKeyword', '胜利点', 'victory', 'keyword', ['\\bVictory\\b'], ['core.victory']],
  ['objective', '目标', 'tskObjective', 'keyword', ['\\bObjective\\b'], ['core.effects']],
  ['prey', '猎物', 'prey', 'keyword', ['\\bPrey\\b'], ['core.enemy']],
  ['spawn', '生成', 'spawn', 'keyword', ['\\bSpawn\\b'], ['core.enemy']],
  ['parley', '谈判', 'parley', 'keyword', ['\\bParley\\b'], ['core.parley', 'core.choices']],
  ['resign', '撤退', 'tskResign', 'keyword', ['\\bResign\\b'], ['core.effects', 'core.actions']],
  ['fast', '快速', 'fast', 'keyword', ['\\[fast\\]', '\\bFast\\b'], ['core.actions']],
  ['permanent', '永久', 'permanent', 'keyword', ['\\bPermanent\\b'], ['core.deck']],
  ['exceptional', '卓越', 'upgrade', 'keyword', ['\\bExceptional\\b'], ['core.deck']],
  ['elite', '精英', 'elite', 'keyword', ['\\bElite\\b'], ['core.enemy']],
  ['bonded', '绑定', 'tskBonded', 'keyword', ['\\bBonded\\b'], ['core.bonded']],
  ['usesKeyword', '使用次数', 'uses', 'keyword', ['\\bUses \\('], ['core.uses']],
  ['doomToken', '毁灭标记', 'doom', 'token', ['\\bdoom\\b'], ['core.effects', 'core.enemy']],
  ['concealed', '隐匿', 'tskConcealed', 'keyword', ['\\bConcealed \\d', 'concealed keyword'],
    ['new.concealedEntity', 'new.concealedDistribution', 'new.concealedIdentityProjection', 'extend.hiddenInfo']],
  ['shift', '变换', 'tskShift', 'keyword', ['\\bShift\\b', 'Flip this key'],
    ['new.scarletKeyEntity', 'new.keyShift', 'new.keyBinding', 'extend.physicalFaces']],
  ['hollow', '空洞', 'tskHollow', 'keyword', ['\\bhollow', 'set-aside hollows'],
    ['new.hollowZone', 'new.hollowCount', 'new.hollowRecall', 'extend.cardCounters']],
  ['customizable', '定制升级', 'tskCustomizable', 'keyword', [],
    ['new.customizableCard', 'new.customizationUpgrade', 'extend.costDiscount'], ['customizationText']],
  ['patrol', '巡逻', 'tskPatrol', 'keyword', ['\\bPatrol\\b'], ['new.patrolKeyword', 'core.enemy']],
  ['otherworld', '异界', 'tskOtherworld', 'trait', ['\\[\\[Otherworld\\]\\]', 'Otherworld'],
    ['extend.scenarioDecks', 'core.scenarioDecks', 'core.hiddenInfo']],
  ['stableUnstable', '稳定面／动荡面', 'tskKeys', 'trait', ['\\[\\[Stable\\]\\]', '\\[\\[Unstable\\]\\]'],
    ['new.scarletKeyEntity', 'extend.physicalFaces']],
]

// 与 tools/scan-tsk-mechanisms.mjs 相同的扫描语料（P1 口径），保证 cardCodes 与账本逐条一致。
const corpusOf = card => [
  card.name || '', card.subname || '', card.text || '', card.backText || '',
  card.customizationText || '', card.customizationChange || '', (card.traits || []).join(' '),
].join('\n')

const matches = (definition, card) => {
  const [id, , , , patterns, , fields] = definition
  if (fields && fields.some(field => String(card[field] || '').trim())) return true
  void id
  return patterns.some(pattern => new RegExp(pattern, 'i').test(corpusOf(card)))
}

export const TSK_KEYWORDS = Object.freeze(definitions.map(([id, zh, ruleId, kind, patterns, primitives, fields]) => Object.freeze({
  id, zh, ruleId, kind, patterns, primitives, ...(fields ? { fields } : {}),
  cardCodes: Object.freeze(CYCLE_CODES.filter(code => matches([id, zh, ruleId, kind, patterns, primitives, fields], ALL_CARDS[code]))),
})))

export const TSK_KEYWORD_IDS = Object.freeze(TSK_KEYWORDS.map(keyword => keyword.id))
