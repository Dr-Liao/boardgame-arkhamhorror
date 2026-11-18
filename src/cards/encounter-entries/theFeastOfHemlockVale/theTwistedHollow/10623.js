// 10623 惊惧潜伏 · 诡计（牌库 2 张）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：显现 - 检定[agility](3)。如果你所在地点有[[黑暗]]特性，本次检定难度 +2（=5）。
//     如果你失败，你必须选择一项：受到 2 点伤害；或找出攻击值最高且处于追击中的敌人，将其生成并与你交战。

export default {
  code: '10623',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('theTwistedHollowTreachery', { seat: inv.seat, code: this.code }) === true
  },
  flags: {
    "lurkingFear": true,
    "test": {
      "skill": "agility",
      "difficulty": 3,
      "darkDifficulty": 5
    },
    "failChoice": [
      "take2Damage",
      "spawnHighestFightPursuitEngaged"
    ]
  },
  note: "近似：同上；追击敌人生成用 behavior.spawnFromPursuit（enemyZones.restore + engageSeat）。",
  abilities: [],
}
