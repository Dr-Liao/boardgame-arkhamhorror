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
  '03025': { abilities: [action('翻译古代雕文', custom('archaicGlyphs'),
    { discardHand: 1, discardHandIcon: 'intellect' })] },
  '03030': { fast: true, reaction: { when: 'wouldSucceedTest' }, event: { type: 'addTestValue', amount: 2 } },
  '03033': { event: custom('uncageTheSoul') },
  '03036': { abilities: [
    action('提灯调查', { type: 'investigate', shroudMod: -1 }),
    action('弃置提灯造成1点伤害', { type: 'dealDamage', amount: 1, target: 'here', noOpportunityAttack: true }, { discardSelf: true }),
  ] },
  '03037': { abilities: [
    action('挖墓人的铲子攻击', fight(2)),
    action('弃置铲子发现1条线索', { type: 'discoverClue', amount: 1 }, { discardSelf: true }),
  ] },
  '03042': { enemyWeakness: { hunter: true, prey: 'bearer', shuffleIntoDeckOnDefeat: true } },

  '03106': { fast: true, reaction: { when: 'enemyAttack', otherInvestigator: true, nonEliteOnly: true },
    event: custom('heroicRescue') },
  '03114': {},

  '03149': { payForItemAtLocation: true, abilities: [{ label: '下一件物品费用-1',
    cost: { action: false, exhaust: true }, effect: custom('charlesRoss') }] },
  '03150': { fast: true, reaction: { when: 'encounterDrawn', nonWeaknessOnly: true, treacheryOnly: true },
    event: custom('forewarned') },
  '03156': { fast: true, reaction: { when: 'encounterDrawn', nonWeaknessOnly: true, treacheryOnly: true },
    event: { type: 'cancelTreachery' }, exileAfterPlay: true },
  '03157': { fast: true, reaction: { when: 'harmDealt' },
    event: { type: 'cancelHarm', maximum: 10 }, exileAfterPlay: true },
  // 03158 求助盟友已迁到能力层（5c-19），见 src/cards/card-abilities.js 的 MIGRATED_ESCAPE_ENTRIES_5C19。

  '03189': { event: custom('illSeeYouInHell'), noOpportunityAttack: true },


  '03263': { fast: true, reaction: { when: 'encounterDrawn', ownMythosOnly: true },
    event: custom('onTheHunt') },
  '03264': { passive: { permanent: true }, setup: custom('stickToThePlan') },
  '03270': { fast: true, reaction: { when: 'encounterDrawn', nonWeaknessOnly: true, anyLocation: true, treacheryOnly: true },
    event: { type: 'sequence', effects: [{ type: 'cancelTreachery' }, { type: 'takeHorror', amount: 1 }] } },

  '03304': { fast: true, reaction: { when: 'activateFirearmFight' }, event: custom('eatLead') },
  '03306': { fast: true, event: custom('eideticMemory'), removeAfterPlay: true },
  '03308': { passive: { permanent: true }, campaign: { charonsObol: true } },
  '03310': { fast: true, reaction: { when: 'wouldDefeat', selfOnly: true }, event: custom('cheatDeath'), removeAfterPlay: true },
  '03311': { fast: true, reaction: { when: 'actionResolvedAtLocation' }, event: custom('timeWarp') },
  // 03315 的离场钩子（弃掉牌库顶 10 张）已迁到能力层（kind: 'leavesPlay'）。
}
