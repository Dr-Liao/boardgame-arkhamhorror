// 10019 御守（Ancestral Token）· 守卫者资产 · 0 经验 · 饰品槽
// 卡面：[reaction] 你击败一个敌人后，横置御守：在混乱袋中加入 [bless] 标记，数量等于该敌人的
//       印刷生命值（最多 5 个）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 反应时机：`defeatEnemy` 窗口（enemies.js#defeatEnemy 在敌人离场后开窗，
//     context = { when, seat: 击败者, location, enemy }）；「你击败」= context.seat === inv.seat。
//   · 横置费用：描述子 `cost: { exhaust: true }`（引擎统一付费/可用性读点 payAbilityCost）。
//   · 印刷生命值：cards-data 的 `health`（印刷值，不是按人数/加成算好的实例上限）。场景敌人
//     不在玩家卡表时回落到实例 `enemy.health`，再退化为 0。
//   · 加入祝福：`api.chaosTokens.add('bless', n)`（token-pool 的唯一写点，超过标记池上限时
//     只加入实际可用数量；返回实际加入数）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10019'
const BLESS = 'bless'
const MAX_BLESS = 5

const printedHealthOf = enemy => {
  const def = ALL_CARDS[enemy?.originalCode || enemy?.code]
  const printed = Number(def?.health)
  if (Number.isFinite(printed) && printed > 0) return printed
  const own = Number(enemy?.health)
  return Number.isFinite(own) && own > 0 ? own : 0
}

export default {
  code: CODE,
  name: 'Ancestral Token',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      label: '横置：按敌人印刷生命值加入祝福标记（最多 5 个）',
      criteria: [({ inv, context }) => Boolean(context?.enemy) && context?.seat === inv.seat],
      cost: { exhaust: true },
      resolve: ({ context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        const health = printedHealthOf(enemy)
        const amount = Math.min(MAX_BLESS, health)
        if (amount <= 0) {
          api.info('⛩️ 御守：该敌人没有印刷生命值，不加入祝福标记。')
          return
        }
        const added = api.chaosTokens.add(BLESS, amount)
        api.info(`⛩️ 御守：横置，加入 ${added} 个祝福标记（「${enemy.name || enemy.code}」印刷生命值 ${health}，上限 ${MAX_BLESS}）。`)
      },
    },
  ],
  modifiers: [],
}
