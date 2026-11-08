// 08115 珍贵记忆（来自后世，Precious Memento · From a Future Life）
// 卡面：每个牌库仅限 1 张珍贵记忆(来自后世)。
// [reaction] 你在一次技能检定中失败且低于难度 2 点或更多后，横置珍贵记忆：治愈其 1 点恐惧。
// [reaction] 你在一次技能检定中成功且超过难度 2 点或更多后，横置珍贵记忆：治愈其 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 08114 同模板、治愈类型互换（来源：EotE 参考实现 PreciousMementoFromAFutureLife4.hs）。
const code = '08115'

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testEnds',
      label: '失败且低于难度 2+ 后横置：治愈自身 1 点恐惧',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => {
        const result = context?.result
        return context?.seat === inv.seat
          && result?.success === false
          && (result.difficulty - result.value) >= 2
          && (source?.horror || 0) > 0
      }],
      resolve: ({ inv, source, api }) => {
        api.healAsset(source, { horror: 1, owner: inv })
        api.info(`💗 「珍贵记忆（来自后世）」：${inv.name} 治愈其 1 点恐惧。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'testEnds',
      label: '成功且超过难度 2+ 后横置：治愈自身 1 点伤害',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => {
        const result = context?.result
        return context?.seat === inv.seat
          && result?.success === true
          && (result.value - result.difficulty) >= 2
          && (source?.damage || 0) > 0
      }],
      resolve: ({ inv, source, api }) => {
        api.healAsset(source, { damage: 1, ownerSeat: inv.seat })
        api.info(`💗 「珍贵记忆（来自后世）」：${inv.name} 治愈其 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
