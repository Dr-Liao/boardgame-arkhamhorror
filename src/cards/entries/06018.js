// 06018 渴血之刃
// 卡面：每套牌库仅限1张。作为打出本卡牌的额外费用，你必须查找你的绑定卡牌，找出3张嗜血并将其混洗入你的牌库。
//       [action]：攻击。每附属1张嗜血，你本次攻击得到+1[combat]。本次攻击造成+1伤害。
//       如果本次攻击击败了一个敌人，从供应堆放置1资源到本卡牌上，作为贡品。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06018 渴血之刃：
//   · 额外打出费用：bondedShufflePlayCost 在付行动/资源和入场前洗入 3 张 06019；
//     直接放置入场不支付这项打出费用。
//   · 贡品：用实例的 uses 记账（usesType: 'resources'），可从 0 累积到任意值；06019 的显现消耗 2 点。
//   · 攻击：combatBonus = 刀上实际附属的嗜血张数；
//     +1 伤害；击败敌人 → +1 贡品。
//   · 06019 的 [fast]「攻击时把 1 张嗜血混洗回牌库，本次 +1 伤害」在攻击 resolve 里询问一次。
//
// 能力顺序：action/free 描述子放在生命周期描述子之前——assetEffect 的能力 shim 只包含
// action/free（legalMoves/actionPreview 的 abilityIndex 以它为准）。

export default {
  code: '06018',
  // 贡品（从供应堆放到本卡上的资源）：用使用次数记账，不设 discardWhenEmpty。
  uses: 0,
  usesType: 'resources',
  bondedShufflePlayCost: { count: 3 },
  abilities: [
    {
      kind: 'action',
      label: '攻击：每附属 1 张嗜血 +1[combat]，+1 伤害；击败敌人放 1 贡品',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy', label: '同地点的敌人' },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy || !source) return
        const bloodlusts = (source.attachments || []).filter(card => card.code === '06019')
        let damageBonus = 1
        // 06019 的 [fast]：攻击时可以把 1 张附属的嗜血混洗回牌库，本次攻击 +1 伤害（每次攻击最多一次）。
        if (bloodlusts.length > 0) {
          const answer = api.choice({
            kind: 'effect', source: '06018', seat: inv.seat, canSkip: true,
            prompt: '是否将 1 张附属的「嗜血」混洗回牌库，使本次攻击 +1 伤害？（每次攻击最多一次）',
            options: [{ id: 'skip', label: '不混洗' }, { id: 'use', label: '混洗 1 张嗜血（本次 +1 伤害）' }],
          })
          if (answer === 'use') {
            const attachment = bloodlusts[0]
            const ownerSeat = attachment.ownerSeat ?? inv.seat
            api.moveCard({ id: attachment.id, from: 'attached', to: 'deckTop', ownerSeat })
            api.shuffleDeck(ownerSeat)
            damageBonus += 1
            api.info(`「嗜血」被混洗回牌库：本次攻击造成 +1 伤害（共 +${damageBonus}）。`)
          }
        }
        const attached = (source.attachments || []).filter(card => card.code === '06019').length
        const result = api.fight(inv.seat, enemy.id, { combatBonus: attached, damageBonus })
        if (result?.attackResult?.defeated) {
          api.addUses(source, 1)
          api.info(`「渴血之刃」：从供应堆放置 1 资源到本卡上，作为贡品（当前 ${source.uses} 点）。`)
        }
      },
    },
  ],
  modifiers: [],
}
