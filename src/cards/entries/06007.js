// 06007 低级错误
// 卡面：显现 - 弃掉你控制的有伤害和/或恐惧的所有支援。如果没有支援通过本效果被弃掉，
//       将低级错误混洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 结算：走弱点描述子的 resolve（src/engine/weakness.js 的唯一入口）；
// 「洗回牌库」用 api.scheduleWeaknessShuffle（抽牌段读 inv.shuffleWeaknessAfterResolution）。

export default {
  code: '06007',
  abilities: [
    {
      kind: 'weakness',
      label: '弃掉有伤害/恐惧的支援',
      weakness: { type: 'custom' },
      resolve: ({ inv, api }) => {
        const targets = (inv.assets || []).filter(asset => (asset.damage || 0) + (asset.horror || 0) > 0)
        for (const asset of targets) api.discardAsset(inv.seat, asset)
        if (targets.length) {
          api.info(`「低级错误」：${inv.name} 弃掉了 ${targets.length} 个带伤害/恐惧的支援。`)
          return
        }
        api.scheduleWeaknessShuffle('06007')
        api.info(`「低级错误」：没有支援被弃掉，${inv.name} 将它洗回牌库。`)
      },
    },
  ],
  modifiers: [],
}
