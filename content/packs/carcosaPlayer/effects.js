const fight = (combatBonus = 0, damageBonus = 0, extra = {}) =>
  ({ type: 'fight', combatBonus, damageBonus, ...extra })
const action = (label, effect, cost = {}) => ({ label, cost: { action: true, ...cost }, effect })
const free = (skill, extra = {}) => ({ skill, cost: { resources: 1 }, bonus: 1, ...extra })
const custom = (action, extra = {}) => ({ type: 'carcosaPlayer', action, ...extra })

// Original Carcosa player-card runtime contracts. Card-specific effects use one
// dispatcher so choices and randomness share the engine's save/replay path.
//
// Phase 2（C1–C4 / B2–B6）已迁出 9 张卡：03112 / 03152 / 03155 / 03191 / 03198 /
// 03236 / 03239 / 03265 / 03271 现在写在 src/cards/card-abilities.js 的描述子里，
// 本表的对应条目与 engine.js 的 carcosaPlayer 分支同时删除（行为不变）。
//
// Phase 5（5c 首批）再迁出 6 张：03026 / 03038 / 03040 / 03148 / 03199 / 03232。
export const effects = {
  // 03025 古代雕文已迁到能力层（5c-29），见 MIGRATED_ESCAPE_ENTRIES_5C29。
  '03030': { fast: true, reaction: { when: 'wouldSucceedTest' }, event: { type: 'addTestValue', amount: 2 } },
  // 03033 解锢灵魂已迁到能力层（5c-21），见 MIGRATED_ESCAPE_ENTRIES_5C21。
  '03036': { abilities: [
    action('提灯调查', { type: 'investigate', shroudMod: -1 }),
    action('弃置提灯造成1点伤害', { type: 'dealDamage', amount: 1, target: 'here', noOpportunityAttack: true }, { discardSelf: true }),
  ] },
  '03037': { abilities: [
    action('挖墓人的铲子攻击', fight(2)),
    action('弃置铲子发现1条线索', { type: 'discoverClue', amount: 1 }, { discardSelf: true }),
  ] },
  '03042': { enemyWeakness: { hunter: true, prey: 'bearer', shuffleIntoDeckOnDefeat: true } },

  // 03106 英勇救援已迁到能力层（5c-32），见 MIGRATED_ESCAPE_ENTRIES_5C32。
  '03114': {},

  // 03150 预警已迁到能力层（5c-22），见 MIGRATED_ESCAPE_ENTRIES_5C22。
  '03156': { fast: true, reaction: { when: 'encounterDrawn', nonWeaknessOnly: true, treacheryOnly: true },
    event: { type: 'cancelTreachery' }, exileAfterPlay: true },
  '03157': { fast: true, reaction: { when: 'harmDealt' },
    event: { type: 'cancelHarm', maximum: 10 }, exileAfterPlay: true },
  // 03158 求助盟友已迁到能力层（5c-19），见 src/cards/card-abilities.js 的 MIGRATED_ESCAPE_ENTRIES_5C19。



  // 03263 追猎已迁到能力层（5c-23），见 MIGRATED_ESCAPE_ENTRIES_5C23。
  '03264': { passive: { permanent: true }, setup: custom('stickToThePlan') },
  '03270': { fast: true, reaction: { when: 'encounterDrawn', nonWeaknessOnly: true, anyLocation: true, treacheryOnly: true },
    event: { type: 'sequence', effects: [{ type: 'cancelTreachery' }, { type: 'takeHorror', amount: 1 }] } },

  // 03304 吃子弹已迁到能力层（5c-33），见 MIGRATED_ESCAPE_ENTRIES_5C33。
  '03306': { fast: true, event: custom('eideticMemory'), removeAfterPlay: true },
  '03308': { passive: { permanent: true }, campaign: { charonsObol: true } },
  // 03310 死里逃生已迁到能力层（5c-36）。
  // 03315 的离场钩子（弃掉牌库顶 10 张）已迁到能力层（kind: 'leavesPlay'）。
}
