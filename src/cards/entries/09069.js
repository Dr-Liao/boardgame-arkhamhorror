// 09069 逃生通道（Quick Getaway）· 游荡者（Rogue）事件 · 0 经验 · 技巧。
//
// 卡面：快速。在敌人攻击你时打出。
//       躲避。尝试躲避攻击的敌人。如果你检定成功，取消该敌人的攻击。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 触发时机 → enemyAttack 窗口（enemies.js 在结算敌人攻击前开窗；窗口后的 `context.cancelled`
//     会取消这次攻击，05230/03068b 等卡共用同一读点）。
//   · 躲避 → api.evade（combat.js#doEvade，`onSuccess` 是「躲避成功后由调用方接管额外效果」的既有入口）。
const CODE = '09069'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttack',
      countsAs: 'evade',
      label: '快速：躲避攻击你的敌人；成功后取消这次攻击',
      criteria: [({ inv, context }) => Boolean(context?.enemy)
        && context.seat === inv.seat
        && context.cancelled !== true],
      resolve: ({ inv, api, context }) => {
        const enemy = context?.enemy
        if (!enemy) return
        api.evade(inv.seat, {
          enemyId: enemy.id,
          onSuccess: () => {
            context.cancelled = true
            api.info(`🏃 「逃生通道」：躲避「${enemy.name}」成功，取消它的这次攻击。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
