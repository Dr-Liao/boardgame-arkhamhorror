// 06019 嗜血
// 卡面：绑定(渴血之刃)。
//       显现 - 移除渴血之刃的2贡品，以附属嗜血到渴血之刃上。如果你不能这么做，受到1点恐惧并将嗜血混洗回你的牌库。
//       [free]用渴血之刃进行攻击时，将嗜血混洗回你的牌库：你在本次攻击中造成+1伤害。(每次攻击最多一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06019 嗜血：
//   · 显现：渴血之刃上贡品 ≥2 时，扣 2 贡品并把弱点实体附属到刀上；
//     否则受到 1 点恐惧并把这张牌洗回牌库（api.scheduleWeaknessShuffle）。
//   · [free] +1 伤害在 06018 的攻击 resolve 里询问并处理真实附件。

export default {
  code: '06019',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：移除 2 贡品附属到渴血之刃，否则受到 1 恐惧并洗回牌库',
      weakness: { type: 'attachedEnemy' },
      resolve: ({ state, inv, api }) => {
        const blade = (state.investigators || [])
          .flatMap(owner => owner.assets || [])
          .find(asset => asset.code === '06018')
        if (blade && (blade.uses || 0) >= 2) {
          api.setAssetUses(blade, Math.max(0, (blade.uses || 0) - 2))
          api.attachPlayerCardToAsset('06019', blade, { ownerSeat: inv.seat })
          api.info(`「嗜血」：从「渴血之刃」移除 2 点贡品，嗜血附属到其上（已附属 ${(blade.attachments || []).filter(card => card.code === '06019').length} 张）。`)
          return
        }
        api.harm(inv.seat, { horror: 1 })
        api.scheduleWeaknessShuffle(inv.seat, '06019')
        api.info(`「嗜血」：无法移除 2 点贡品，${inv.name} 受到 1 点恐惧，嗜血洗回牌库。`)
      },
    },
  ],
  modifiers: [],
}
