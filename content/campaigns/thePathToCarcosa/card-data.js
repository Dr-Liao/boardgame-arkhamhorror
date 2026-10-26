import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { enemyRuleFor, hiddenRuleFor, threatEffectFor, treacheryRuleFor, doomPerInvestigatorFor } from '../../../src/cards/card-rules.js'

const CARCOSA_PACKS = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`卡尔克萨原卡不存在：${code}`)
  return {
    code,
    originalCode: code,
    name: card.nameZh || card.name,
    text: card.textZh || card.text || '',
    traits: [...(card.traits || [])],
    flavor: card.flavorZh || card.flavor || '',
  }
}

export function location(id, code, connections, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`卡尔克萨地点不存在：${code}`)
  return {
    ...printed(code),
    id,
    shroud: card.shroud,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0,
    connections: [...connections],
    ...extra,
  }
}

export function stages(codes, type) {
  return codes.map((code, index) => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`卡尔克萨${type === 'act' ? '幕' : '议程'}不存在：${code}`)
    return {
      ...printed(code),
      id: `${type}${index + 1}`,
      stage: `${index + 1}a`,
      ...(type === 'agenda' ? { doomThreshold: card.doom } : {}),
      ...(type === 'agenda' && doomPerInvestigatorFor(code)
        ? { doomThresholdPerInvestigator: card.doom } : {}),
      advanceText: card.backTextZh || card.backText || '',
    }
  })
}

export function encounterCards(groups, options = {}) {
  const aliases = { the_stranger: 'stranger' }
  const normalized = groups.map(group => aliases[group] || group)
  // 弱点（subtype `weakness` / `basicweakness`）永不洗入遭遇牌库：
  // 03227「失魂落魄」虽然是 a_phantom_of_truth 组的卡，但它只以玩家弱点的形式
  // 进入每人的牌库（见 aPhantomOfTruth/behavior.js 的 preScenarioSetup）。
  // `includeWeaknesses` 只用于「注册定义」的场景（定义要存在，但不能进牌堆）。
  const isWeakness = card => ['weakness', 'basicweakness'].includes(card.subtype)
  const usable = card => ['enemy', 'treachery'].includes(card.type) && (options.includeWeaknesses || !isWeakness(card))
  const missing = normalized.filter(group => !Object.values(ALL_CARDS).some(card =>
    card.encounterCode === group && usable(card)))
  if (missing.length) throw new Error(`缺少卡尔克萨遭遇组：${missing.join(', ')}`)
  return Object.values(ALL_CARDS).filter(card => normalized.includes(card.encounterCode) && usable(card))
}

function hasPrintedSurge(text = '') {
  const keywords = text.split(/\b(?:Revelation|Forced|Spawn)\s*-/i, 1)[0]
  return /\bSurge\./i.test(keywords)
}

export function encounterDefinitions(cards) {
  const enemies = {}
  const treacheries = {}
  for (const card of cards) {
    const definition = {
      ...printed(card.code),
      rulesPending: false,
      ...(card.type === 'enemy' ? {
        fight: card.fight ?? 0,
        evade: card.evade ?? 0,
        health: card.health ?? 1,
        damage: card.damage ?? 0,
        horror: card.horror ?? 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        hunter: /\bHunter\./i.test(card.text || ''),
        aloof: /\bAloof[. ]/i.test(card.text || ''),
        massive: /\bMassive\./i.test(card.text || ''),
        retaliate: /\bRetaliate\./i.test(card.text || ''),
        alert: /\bAlert\./i.test(card.text || ''),
        ...(enemyRuleFor(card.code)?.prey ? { prey: enemyRuleFor(card.code).prey } : {}),
        victory: card.victory || 0,
        elite: (card.traits || []).includes('Elite'),
      } : {
        surge: hasPrintedSurge(card.text),
        peril: /\bPeril\./i.test(card.text || ''),
        hidden: /\bHidden\./i.test(card.text || ''),
        ...(hiddenRuleFor(card.code) ? { hiddenRule: structuredClone(hiddenRuleFor(card.code)) } : {}),
        ...(threatEffectFor(card.code) ? { threatEffect: structuredClone(threatEffectFor(card.code)) } : {}),
        // 威胁区诡计（01164/01165 等）的持续规则：引擎的 getThreatEffect 读
        // `ALL_TREACHERIES[code].threat`，与 TFA/TCU 的 encounterDefinitions 口径一致。
        // 只搬纯数据字段，`treacheryRule` 里的 attachmentAction/encounterAction 是函数，
        // 不能进入会被 structuredClone 的关卡定义。
        ...(treacheryRuleFor(card.code)?.threat
          ? { threatArea: treacheryRuleFor(card.code).threatArea === true,
              threat: structuredClone(treacheryRuleFor(card.code).threat) }
          : {}),
        effect: { kind: 'campaignRule' },
      }),
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[definition.code] = definition
  }
  return { enemies, treacheries }
}

export function encounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(card.code))
}

export function storyCards(codes) {
  return Object.fromEntries(codes.map(code => [code, printed(code)]))
}

export function identitiesFor(scenario) {
  const categories = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    categories[category] = Object.fromEntries(Object.values(scenario[category] || {}).map(card =>
      [card.id || card.code, { originalCode: card.originalCode }]))
  }
  return categories
}

export function carcosaCards() {
  return Object.values(ALL_CARDS).filter(card => CARCOSA_PACKS.has(card.pack))
}
