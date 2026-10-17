import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

// A deliberately small real batch, not the entire Dunwich expansion.
export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION, id: 'dunwichSupport', name: '敦威治遗产 · 支援卡试点',
  contentVersion: '1.0.0', minRulesVersion: 'n4.2', status: 'playable', dependencies: ['core'],
  description: '实验室助理、奇异溶液与澄明心智开放构筑；奇异溶液升级需要战役研究记录。',
  cardRanges: [{ from: '02020', to: '02021' }, { from: '02030', to: '02030' }],
  cards: [
    { code: '02020', name: '实验室助理', type: 'player', cataloged: true, imageAvailable: true, rulesImplemented: true, deckbuilding: true, requiredMechanicIds: ['assetEnteredPlay', 'handSizeBonus', 'draw'] },
    { code: '02030', name: '澄明心智', type: 'player', cataloged: true, imageAvailable: true, rulesImplemented: true, deckbuilding: true, requiredMechanicIds: ['targetedEffect', 'heal', 'uses'] },
    { code: '02021', name: '奇异溶液', type: 'player', cataloged: true, imageAvailable: true, rulesImplemented: true, deckbuilding: true, requiredMechanicIds: [] },
  ],
  encounterGroupIds: [], behaviorIds: [],
})

export const effects = {
  '02021': { abilities: [{ label: '研究溶液（智识 4；成功则弃置并抽 2 张牌）', cost: { action: true },
    effect: { type: 'researchSolution' } }] },
  '02020': { passive: { handSizeBonus: 2 }, reactions: [
    { id: 'laboratoryAssistant', when: 'assetEnteredPlay', assetCode: '02020', effect: { type: 'draw', amount: 2 } },
  ] },
  '02030': { uses: 3, usesType: 'charges', abilities: [
    { label: '同地点调查员治疗 1 恐惧', cost: { action: true, uses: 1 },
      effect: { type: 'targetedEffect', target: 'location', effect: { type: 'heal', amount: 1, what: 'horror' } } },
  ] },
}
