// 04033 临时武器
// 卡面：你可以从你的弃牌堆中打出临时武器。如果你这么做，结算效果后将其洗入你的牌库。
// 卡面：攻击。被攻击敌人本次攻击得到-1攻击值。(如果你从弃牌堆中打出了临时武器，本次攻击造成+1伤害。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04033 临时武器：攻击同地点敌人（敌人战斗值 -1）；从弃牌堆打出时 +1 伤害，然后洗回牌库。

export default {
  code: '04033',
  playableFromDiscard: true,
  shuffleBackAfterPlay: true,
  abilities: [
    {
      kind: 'played', label: '临时武器',
      // 卡面「攻击。」= Fight 行动：打出按攻击结算，不引发借机攻击。
      countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04033'
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04033', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.fight(inv.seat, chosen, { enemyFightMod: -1, damageBonus: fromDiscard ? 1 : 0 })
      },
    },
  ],
  modifiers: [

  ],
}
