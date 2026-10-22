// 04276 古旧锈剑
// 卡面：[action]如果古旧锈剑处于重整状态：攻击。你本次攻击得到+2[combat]并造成+1伤害。
// 卡面：[action]横置古旧锈剑：攻击。本次攻击将你的[willpower]加入你的技能值。本次攻击造成+3伤害。如果本次攻击击败了[[精英]]敌人，抽取3张卡牌。(每场游戏最多一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04276 古旧锈剑：挥砍是纯数据效果；蓄力斩加入意志、伤害 3，每局一次（旧 rustedSword）。

export default {
  code: '04276',
  abilities: [
    { kind: 'action', label: '挥砍（战斗 +2，伤害 +1）', cost: { action: true },
    effect: { type: 'fight', combatBonus: 2, damageBonus: 1 } },
    {
      kind: 'action', label: '蓄力斩（加入意志，伤害 +3）', cost: { action: true, exhaust: true },
      countsAs: 'fight', target: { kind: 'enemy' }, limit: 'oncePerGame',
      resolve: ({ target, state, inv, api }) => {
        const enemy = target?.entity
        if (!enemy) { api.info('没有可攻击的敌人。'); return }
        const elite = !!enemy.elite
        api.fight(inv.seat, enemy.id, { addSkill: 'willpower', damageBonus: 3 })
        if (elite && !state.enemies.includes(enemy)) api.drawCards(inv.seat, 3)
      },
    },
  ],
  modifiers: [

  ],
}
