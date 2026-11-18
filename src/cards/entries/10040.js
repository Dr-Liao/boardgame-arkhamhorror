// 10040 化学品套装（Chemistry Set）· 探寻者支援 · 饰品槽 · [[道具]]/[[工具]]/[[科学]]
// 卡面：
//   [action] 横置化学品套装：调查。如果你……
//   - ……检定失败且低于难度正好 2 点，弃掉化学品套装。
//   - ……检定成功且等于难度，获得 2 资源。
//   - ……检定成功且超过难度正好 2 点，抽取 1 张卡牌。
//   - ……检定成功且超过难度正好 4 点，发现你所在地点额外 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · [action] + 横置 = 描述子 cost { action: true, exhaust: true }；「调查。」= countsAs: 'investigate'。
//   · 真实调查检定 = api.investigate（actions.js#runInvestigate 的唯一内容层入口），返回值是
//     performTest 的标准结果（success / value / difficulty），差值口径与卡面一致：
//     margin = value - difficulty。
//   · 失败差值 2 → api.discardAsset（leaveAsset 唯一入口，触发离场钩子后进弃牌堆）。
//   · 成功 0 / 2 / 4 → api.gainResources / api.drawCards / api.discoverClue（额外 1 个线索）。
export default {
  code: '10040',
  name: '化学品套装',
  abilities: [
    {
      kind: 'action',
      id: 'chemistrySetInvestigate',
      label: '横置：调查；失败差值 2 弃掉本卡 / 成功差值 0 得 2 资源 / 2 抽 1 张 / 4 额外 1 线索',
      cost: { action: true, exhaust: true },
      countsAs: 'investigate',
      resolve: ({ inv, source, api }) => {
        const result = api.investigate(inv.seat)
        if (!result) return
        const margin = Number(result.value || 0) - Number(result.difficulty || 0)
        if (result.success) {
          if (margin === 0) {
            api.gainResources(inv.seat, 2)
            api.info(`🧪 「化学品套装」：正好成功，${inv.name} 获得 2 资源。`)
          } else if (margin === 2) {
            api.drawCards(inv.seat, 1)
            api.info(`🧪 「化学品套装」：成功 2 点，${inv.name} 抽取 1 张卡牌。`)
          } else if (margin === 4) {
            api.discoverClue(inv.seat, 1, inv.location)
            api.info(`🧪 「化学品套装」：成功 4 点，${inv.name} 额外发现 1 个线索。`)
          }
          return
        }
        if (margin !== -2) return
        const card = (inv.assets || []).find(asset => asset.id === source?.id)
        if (!card) return
        api.discardAsset(inv.seat, card)
        api.info('🧪 「化学品套装」：检定失败 2 点，弃掉这张支援。')
      },
    },
  ],
  modifiers: [],
}
