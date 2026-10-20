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
  // 02008 寻找真相已迁到能力层（kind: 'played'，见 src/cards/card-abilities.js）。
}
export const basicWeaknessEffects = {
  '02037': { startingResources: -2 }, // 负债 Indebted（永久）
// 内伤 Internal Injury
// 时间恐惧症 Chronophobia
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
