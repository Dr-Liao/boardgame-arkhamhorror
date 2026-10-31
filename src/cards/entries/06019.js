// 06019 嗜血
// 卡面：绑定(渴血之刃)。
//       显现 - 移除渴血之刃的2贡品，以附属嗜血到渴血之刃上。如果你不能这么做，受到1点恐惧并将嗜血混洗回你的牌库。
//       [free]用渴血之刃进行攻击时，将嗜血混洗回你的牌库：你在本次攻击中造成+1伤害。(每次攻击最多一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06019 嗜血（显式简化，见 simplified/note）：
//   · 显现：渴血之刃上贡品 ≥2 时，扣 2 贡品并把「附属的嗜血张数」记到刀的 attachedCards 槽
//     （api.setAttachedCards；与 02007 用 attachedEnemy sentinel 阻止自动弃置同一口径）；
//     否则受到 1 点恐惧并把这张牌洗回牌库（api.scheduleWeaknessShuffle）。
//   · [free] +1 伤害在 06018 的攻击 resolve 里结算（引擎没有「攻击检定成功前的伤害加成窗口」，
//     该时机只能在持有者自己的攻击结算内询问；见 06018 注释）。
//
// 无法表达的部分（显式简化）：
//   引擎没有「弱点揭示时把牌本身附属到玩家支援」的原语（弱点类型只有 attachedEnemy/attachedLocation
//   两个 sentinel，且揭示中的牌不在任何区域、没有 attach-resolving-card API）。因此本实现把外围状态
//   （刀上 N 张嗜血）记在通用附属槽 attachedCards 里，被抽到的实体牌本身不进入任何区域——
//   对局可见状态（刀的加值/贡品消耗/可用嗜血张数）与卡面一致。

export default {
  code: '06019',
  simplified: true,
  note: '未实现：弱点揭示时附属到玩家支援的完整物理形态（引擎无 attachedAsset 弱点类型/attach-resolving-card API），'
    + '改为在渴血之刃的 attachedCards 槽记录附属张数；[fast] +1 伤害由 06018 的攻击 resolve 结算。',
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
          api.setAttachedCards(blade, [...(blade.attachedCards || []), '06019'])
          api.info(`「嗜血」：从「渴血之刃」移除 2 点贡品，嗜血附属到其上（已附属 ${(blade.attachedCards || []).length} 张）。`)
          return
        }
        api.harm(inv.seat, { horror: 1, direct: true })
        api.scheduleWeaknessShuffle(inv.seat, '06019')
        api.info(`「嗜血」：无法移除 2 点贡品，${inv.name} 受到 1 点恐惧，嗜血洗回牌库。`)
      },
    },
  ],
  modifiers: [],
}
