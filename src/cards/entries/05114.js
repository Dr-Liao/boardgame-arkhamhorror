// 05114 切肉刀
// 卡面：[action]：攻击。你本次攻击得到+1[combat](如果你剩余神智值不超过3，改为+2[combat])。
// 如果本次攻击击败了敌人，你可以治愈1点恐惧。
// 作为发动本能力的额外费用，你可以受到1点恐惧以使本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：[action] 攻击走 api.fight({ combatBonus, damageBonus })；条件加值与「可选的额外费用」
// 在 resolve 里结算（引擎没有 optionalCost 通道），击败后的治愈读 api.testResult()/敌人是否离场。

export default {
  code: '05114',
  abilities: [
    {
      kind: 'action', label: '攻击（剩余神智≤3 时 +2 战斗；可受 1 恐惧换 +1 伤害）',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ state, inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        // 「剩余神智值」走修正后的神智上限（api.maxSanity → getMaxSanity，含支援/威胁修正）。
        const maxSanity = typeof api.maxSanity === 'function' ? api.maxSanity(inv.seat) : (inv.maxSanity ?? inv.sanity ?? 0)
        const remainingSanity = maxSanity - (inv.horror || 0)
        const combatBonus = remainingSanity <= 3 ? 2 : 1
        let damageBonus = 0
        // 「作为发动本能力的额外费用，你可以受到 1 点恐惧」——可选，先付再攻击。
        const answer = api.choice({ kind: 'effect', source: '05114', seat: inv.seat, canSkip: true,
          prompt: '切肉刀：是否受到 1 点恐惧，使本次攻击伤害 +1？',
          options: [{ id: 'skip', label: '不受恐惧' }, { id: 'horror', label: '受到 1 点恐惧（伤害 +1）' }] })
        if (answer === 'horror') {
          api.horror(inv.seat, 1)
          damageBonus = 1
        }
        // api.fight 的包装会把来源支援实例作为 assetId 传入（攻击流程读同一份来源）。
        api.fight(inv.seat, enemy.id, { combatBonus, damageBonus })
        const result = api.testResult()
        const stillInPlay = state.enemies.includes(enemy)
        if (result?.success && !stillInPlay) {
          const heal = api.choice({ kind: 'effect', source: '05114', seat: inv.seat, canSkip: true,
            prompt: '切肉刀击败了敌人：是否治愈 1 点恐惧？',
            options: [{ id: 'skip', label: '不治愈' }, { id: 'heal', label: '治愈 1 点恐惧' }] })
          if (heal === 'heal') api.healHorror(inv.seat, 1)
        }
      },
    },
  ],
  modifiers: [],
}
