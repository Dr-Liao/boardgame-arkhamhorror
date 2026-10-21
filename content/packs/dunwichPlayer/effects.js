const fight = (bonus, damage = 0, extra = {}) => ({ type: 'fight', combatBonus: bonus, damageBonus: damage, ...extra })
const action = (label, effect, cost = {}) => ({ label, cost: { action: true, ...cost }, effect })
const sequence = (...effects) => ({ type: 'sequence', effects })
const talent = (skills, cost, bonus) => ({ freeTriggers: skills.map(skill => ({ skill, cost: { resources: cost }, bonus })) })

// Only completed effects enter the playable pool; the manifest also inventories
// the rest of the cycle with an explicit dependency gate.
export const effects = {
  // 02105 已迁到能力层（kind: 'played'，见 src/cards/card-abilities.js）。
  '02114': { abilities: [action('灭火器攻击（战斗 +1）', fight(1)),
    action('流放灭火器：敏捷 +3 躲避，成功时躲避所有其他交战敌人',
      { type: 'evade', bonus: 3, evadeOthersOnSuccess: true }, { exileSelf: true })] },
  // 02150/02194/02268/02299 已迁到能力层（kind: 'commit' / 'played'，见 src/cards/card-abilities.js）。
  '02152': { fast: true, abilities: [action('战斗 +2；成功至少 2 点时伤害 +1', fight(2, 1, { successBy: 2 }))] },
  // 02186 已迁到能力层（kind: 'played' + playCondition，见 src/cards/card-abilities.js）。
  // 02110 适应性已迁到能力层（5b-9），见 MIGRATED_PASSIVE_ENTRIES_5B9。
  '02111': { event: { type: 'drawEncounterAll' }, addToVictory: true },
  // 02113 / 02115 / 02153 / 02225 / 02261 / 02307 已迁到能力层（6e-8：快速反应事件 →
  // kind: 'played' + fast + trigger），见 src/cards/card-abilities.js。
  '02305': { phaseControl: true },
  // 02310 戴红手套的男子已迁到能力层（5b-8），见 MIGRATED_PASSIVE_ENTRIES_5B8。
}
