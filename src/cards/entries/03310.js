// 03310 死里逃生
// 卡面：快速。在你将要被击败时打出。
// 卡面：和与你交战的每个敌人解除交战，弃掉你威胁区域中的全部卡牌，治愈2点恐惧和2点伤害，并移动到任意一个没有敌人的已揭示地点。如果现在是你的回合，结束你的回合。将死里逃生从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03310 死里逃生：将要被击败时快速打出——解除所有交战、丢掉威胁区、回 2 伤害 2 恐惧、
// 移动到没有敌人的已揭示地点、结束本回合；这张牌移出游戏。

export default {
  code: '03310',
  removeAfterPlay: true,
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'wouldDefeat',
      criteria: { selfOnly: true },
      label: '免于一死：解除交战、丢掉威胁、回 2/2、转移到安全地点并结束回合',
      resolve: ({ inv, api }) => {
        api.disengageAll(inv.seat)
        api.discardAllThreats(inv.seat)
        api.healDamage(inv.seat, 2)
        api.healHorror(inv.seat, 2)
        const safe = api.locationsWithoutEnemies()
        if (safe.length) {
          const destination = api.choice({ kind: 'location', source: '03310', seat: inv.seat,
            prompt: '选择没有敌人的已揭示地点。',
            options: safe.map(location => ({ id: location.id, label: api.locName(location.id) })) })
          if (destination) api.moveInvestigator(inv.seat, destination)
        }
        api.softEndTurn(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
