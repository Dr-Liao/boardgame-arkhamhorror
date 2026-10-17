import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const investigatorAbilities = {
  '02001': { elderSign: { kind: 'static', bonus: 1, attackDamageBonus: 1 },
    reactions: [{ id: 'zoeyResource', when: 'enemyEngaged', effect: { type: 'gainResource', amount: 1 } }] },
  '02002': { elderSign: { kind: 'rex', bonus: 2 },
    reactions: [{ id: 'rexClue', when: 'investigateSuccess', successByAtLeast: 2, effect: { type: 'discoverClue', amount: 1 } }] },
  '02003': { elderSign: { kind: 'resources' }, upkeepResources: 2 },
  '02004': { elderSign: { kind: 'jim', bonus: 1 }, tokenModifiers: { skull: 0 } },
  '02005': { elderSign: { kind: 'readySignature', bonus: 2, code: '02014' }, startsWith: '02014',
    freeAction: { id: 'peteReady', label: '弃掉 1 张手牌，重整一张支援（每轮一次）',
      cost: { discardHand: 1 }, effect: { type: 'readyAsset' }, limit: 'round' } },
}
export const signatureEffects = {
  '02007': { weakness: { type: 'attachedEnemy' } },
  '02009': { weakness: { type: 'threat', rexCurse: true } },
  '02011': { weakness: { type: 'attachedLocation' } },
  '02006': { reactions: [{ id: 'zoeysCross', when: 'enemyEngaged', cost: { exhaust: true, resources: 1 },
    effect: { type: 'dealDamage', amount: 1 } }] },
  '02008': { event: { type: 'drawPerClue', maximum: 5 } },
  '02010': { uses: 0, usesType: 'ammo', abilities: [{ label: '双枪射击（战斗 +2，伤害 +1）',
    cost: { action: true, uses: 1 }, effect: { type: 'fight', combatBonus: 2, damageBonus: 1 } }] },
  '02012': { reactions: [{ id: 'jimsTrumpet', when: 'skullRevealed', cost: { exhaust: true },
    effect: { type: 'healHorrorNearby', amount: 1 } }] },
  '02014': { abilities: [
    { label: '杜克攻击（基础战斗 4，伤害 +1）', cost: { action: true, exhaust: true },
      effect: { type: 'fight', baseValue: 4, damageBonus: 1 } },
    { label: '杜克调查（可先移动，基础智识 4）', cost: { action: true, exhaust: true },
      effect: { type: 'dukeInvestigate' } },
  ] },
  '02015': { weakness: { type: 'threat', preventReady: true, discardCost: { action: 2 } } },
  '02013': { weakness: { type: 'finalRhapsody' } },
}
export const basicWeaknessEffects = {
  '02037': { startingResources: -2 }, // 负债 Indebted（永久）
  '02038': { weakness: { type: 'threat', forced: { onTurnEnd: { damage: 1 } }, discardCost: { action: 2 } } }, // 内伤 Internal Injury
  '02039': { weakness: { type: 'threat', forced: { onTurnEnd: { horror: 1 } }, discardCost: { action: 2 } } }, // 时间恐惧症 Chronophobia
}
export const investigatorDependencies = {
  '02001': ['zoeysCross', 'smiteTheWicked'], '02002': ['searchForTheTruth', 'rexCurse'],
  '02003': ['jennysTwin45s', 'searchingForIzzie'], '02004': ['jimsTrumpet', 'finalRhapsody'],
  '02005': ['duke', 'wrackedByNightmares'],
}
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION, id: 'dunwichInvestigators', name: '敦威治遗产 · 调查员',
  contentVersion: '1.0.0', minRulesVersion: 'n4.3', status: 'verified', dependencies: ['core'],
  description: '五位调查员的能力、构筑、专属卡与专属弱点已接入战役运行时。',
  cardRanges: [{ from: '02001', to: '02015' }],
  cards: Array.from({ length: 15 }, (_, i) => String(2001 + i).padStart(5, '0')).map(code => ({
    code, name: ALL_CARDS[code].nameZh || ALL_CARDS[code].name, type: 'other',
    cataloged: true, imageAvailable: !!ALL_CARDS[code].imagesrc, rulesImplemented: true, deckbuilding: false,
    requiredMechanicIds: investigatorDependencies[code] || ['dunwichSignatureRules'],
  })), encounterGroupIds: [], behaviorIds: [],
}
