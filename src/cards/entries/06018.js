// 06018 渴血之刃
// 卡面：每套牌库仅限1张。作为打出本卡牌的额外费用，你必须查找你的绑定卡牌，找出3张嗜血并将其混洗入你的牌库。
//       [action]：攻击。每附属1张嗜血，你本次攻击得到+1[combat]。本次攻击造成+1伤害。
//       如果本次攻击击败了一个敌人，从供应堆放置1资源到本卡牌上，作为贡品。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06018 渴血之刃：
//   · 额外费用：入场时 api.bonded.retrieve(..., { handCount: 0 }) → 3 张 06019 全部洗入牌库
//     （走 P2.8 绑定原语，绑定关系来自 cards-data 的 bondedCards）。
//   · 贡品：用实例的 uses 记账（usesType: 'resources'），可从 0 累积到任意值；06019 的显现消耗 2 点。
//   · 攻击：combatBonus = 刀上附属的嗜血张数（记在 attachedCards 槽，06019 显现时写入）；
//     +1 伤害；击败敌人 → +1 贡品。
//   · 06019 的 [fast]「攻击时把 1 张嗜血混洗回牌库，本次 +1 伤害」在攻击 resolve 里询问一次
//     （引擎没有攻击成功前的伤害加成窗口；见 06019 note）。
//
// 能力顺序：action/free 描述子放在生命周期描述子之前——assetEffect 的能力 shim 只包含
// action/free（legalMoves/actionPreview 的 abilityIndex 以它为准）。

export default {
  code: '06018',
  // 贡品（从供应堆放到本卡上的资源）：用使用次数记账，不设 discardWhenEmpty。
  uses: 0,
  usesType: 'resources',
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
        const attached = (source.attachedCards || []).filter(code => code === '06019').length
        let damageBonus = 1
        // 06019 的 [fast]：攻击时可以把 1 张附属的嗜血混洗回牌库，本次攻击 +1 伤害（每次攻击最多一次）。
        if (attached > 0) {
          const answer = api.choice({
            kind: 'effect', source: '06018', seat: inv.seat, canSkip: true,
            prompt: '是否将 1 张附属的「嗜血」混洗回牌库，使本次攻击 +1 伤害？（每次攻击最多一次）',
            options: [{ id: 'skip', label: '不混洗' }, { id: 'use', label: '混洗 1 张嗜血（本次 +1 伤害）' }],
          })
          if (answer === 'use') {
            const rest = [...(source.attachedCards || [])]
            rest.splice(rest.indexOf('06019'), 1)
            api.setAttachedCards(source, rest)
            // 被混洗回牌库的那张嗜血：先进入弃牌堆，再移到牌库顶并洗牌（引擎没有「凭空放回牌库」的写入口）。
            api.putIntoDiscard(inv.seat, '06019')
            api.moveCard({ code: '06019', from: 'discard', to: 'deckTop' })
            api.shuffleDeck(inv.seat)
            damageBonus += 1
            api.info(`「嗜血」被混洗回牌库：本次攻击造成 +1 伤害（共 +${damageBonus}）。`)
          }
        }
        const result = api.fight(inv.seat, enemy.id, { combatBonus: attached, damageBonus })
        if (result?.attackResult?.defeated) {
          api.addUses(source, 1)
          api.info(`「渴血之刃」：从供应堆放置 1 资源到本卡上，作为贡品（当前 ${source.uses} 点）。`)
        }
      },
    },
    {
      kind: 'entersPlay',
      label: '额外费用：查找绑定卡牌，将 3 张嗜血混洗入牌库',
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '06018', { handCount: 0 })
      },
    },
  ],
  modifiers: [],
}
