const fight = (bonus, damage = 0, extra = {}) => ({ type: 'fight', combatBonus: bonus, damageBonus: damage, ...extra })
const action = (label, effect, cost = {}) => ({ label, cost: { action: true, ...cost }, effect })
const sequence = (...effects) => ({ type: 'sequence', effects })
const talent = (skills, cost, bonus) => ({ freeTriggers: skills.map(skill => ({ skill, cost: { resources: cost }, bonus })) })

// Only completed effects enter the playable pool; the manifest also inventories
// the rest of the cycle with an explicit dependency gate.
export const effects = {
  // 02105 已迁到能力层（kind: 'played'，见 src/cards/card-abilities.js）。
  // 02114 已迁到能力层（kind: 'action'，见 6e-14）。
  // 02150/02194/02268/02299 已迁到能力层（kind: 'commit' / 'played'，见 src/cards/card-abilities.js）。
  // 02152 已迁到能力层（kind: 'action'，见 6e-14）。
  // 02186 已迁到能力层（kind: 'played' + playCondition，见 src/cards/card-abilities.js）。
  // 02110 适应性已迁到能力层（5b-9），见 MIGRATED_PASSIVE_ENTRIES_5B9。
  // 02111 已迁到能力层（6e-15：条目级规则字段 / played 描述子）。
  // 02113 / 02115 / 02153 / 02225 / 02261 / 02307 已迁到能力层（6e-8：快速反应事件 →
  // kind: 'played' + fast + trigger），见 src/cards/card-abilities.js。
  // 02305 已迁到能力层（6e-15：条目级规则字段 / played 描述子）。
  // 02310 戴红手套的男子已迁到能力层（5b-8），见 MIGRATED_PASSIVE_ENTRIES_5B8。
}
