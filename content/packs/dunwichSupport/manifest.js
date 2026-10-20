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

// Phase 5：行为迁到能力层描述子后，effects 表里不再有这张卡；构筑许可由本清单放行
// （与 dunwichPlayer / carcosaPlayer 的 abilityLayerCodes 同一约定）。
export const abilityLayerCodes = Object.freeze([
  '02020',
  '02021',
  '02030',
])

export const effects = {
}
