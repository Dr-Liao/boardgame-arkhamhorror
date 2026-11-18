// 10125 天命护佑（Providential）· 生存者技能 · 2 经验 · 意志/战斗/百搭
// 卡面：如果本次技能检定成功，你每有 1 点伤害或恐惧（取其中较少者），在混乱袋中加入 1 个 [bless] 标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 投入技能：`kind: 'commit'` 描述子（lifecycle.js#commitProfile）。
//   · 「检定成功后」= 技能档案 `afterTest(ctx)`：tests.js#closeTest 在 ST.8 对每张投入卡调用，
//     ctx.result 是标准检定结果（success / value / difficulty），ctx.inv 是投入者（本卡文字里的「你」）。
//   · 「每有 1 点伤害或恐惧（取较少者）」= min(inv.damage, inv.horror)。
//   · 加入祝福 = `api.chaosTokens.add('bless', n)`（标记池唯一写点，受实体池上限限制）。
//   · 图标：cards-data 的 willpower/combat/wild（无自定义图标逻辑）。
const CODE = '10125'
const BLESS = 'bless'

export default {
  code: CODE,
  name: 'Providential',
  abilities: [
    {
      kind: 'commit',
      label: '若检定成功：按你身上的伤害/恐惧较少者加入等量祝福标记',
      skill: {
        afterTest: ({ inv, result, api }) => {
          if (!result?.success || !inv) return
          const amount = Math.min(Math.max(0, inv.damage || 0), Math.max(0, inv.horror || 0))
          if (amount <= 0) return
          const added = api.chaosTokens.add(BLESS, amount)
          if (added > 0) api.info(`🕯️ 天命护佑：本次检定成功，按你身上的伤害/恐惧加入 ${added} 个祝福标记。`)
        },
      },
    },
  ],
  modifiers: [],
}
