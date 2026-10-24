// 05154 鹰眼折叠相机
// 卡面：[reaction]你所在地点的最后一个线索被发现后：在本卡牌上放置1个资源(从供应堆拿取)，
// 作为证据。(每场游戏每个地点仅限一次。)
// 卡面：鹰眼折叠相机上有……
// - ……至少1个证据时，你得到+1[willpower]。
// - ……至少2个证据时，你得到+1[intellect]。
// - ……至少3个证据时，你得到+1神智值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：证据数量用支援实例的 uses 计数（引擎的「来源使用次数」读点 sourceUsesAtLeast，
// 与 addUses 同一份数据；卡面没有印刷使用次数，两者不冲突）。
// 「每场游戏每个地点仅限一次」用实例上的 evidenceLocations 记账（没有按地点计的上限作用域）。

export default {
  code: '05154',
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered',
      label: '最后线索被发现：放 1 个资源作为证据',
      criteria: [({ inv, context }) => {
        if (!context || context.lastClue !== true || context.location !== inv.location) return false
        const camera = (inv.assets || []).find(asset => asset.code === '05154')
        if (!camera) return false
        return !(camera.evidenceLocations || []).includes(context.location)
      }],
      resolve: ({ inv, context, api }) => {
        const camera = (inv.assets || []).find(asset => asset.code === '05154')
        if (!camera) return
        camera.evidenceLocations = [...(camera.evidenceLocations || []), context.location]
        api.addUses(camera, 1)
        // 第三条加成是「神智值 +1」：神智上限读 inv.maxSanity + assetPassiveBonus + asset.sanityModifier
        // （stats.js 的 getMaxSanity），声明式 maxSanity 修正目前没有读点，因此写实例字段维护它。
        camera.sanityModifier = (camera.uses || 0) >= 3 ? 1 : 0
        api.info(`鹰眼折叠相机：「${api.locName(context.location)}」的证据已记录（当前 ${camera.uses || 0} 个证据）。`)
      },
    },
  ],
  modifiers: [
    { target: 'skill:willpower', amount: 1, condition: { sourceUsesAtLeast: 1 } },
    { target: 'skill:intellect', amount: 1, condition: { sourceUsesAtLeast: 2 } },
  ],
}
