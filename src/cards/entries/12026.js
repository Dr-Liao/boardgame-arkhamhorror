// 12026 反手一击
// 卡面：快速。在一个敌人攻击你所在地点的一位调查员时(在该次攻击结算前)打出。
// 卡面：取消该次攻击，对该敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「快速。在……时（结算前）打出」= played 描述子 fast + trigger:'enemyAttack'
//     （enemyAttack 是 interrupt 窗口：src/engine/enemies.js#enemyAttack 在放置伤害之前开窗）；
//   · 取消攻击 = api.cancelCurrentAttack(context)（把 cancelled 写回窗口上下文，引擎据该字段跳过
//     伤害结算；与 08021/08026 同一读点）；
//   · 对攻击者造成伤害 = api.damageEnemy(enemy, 1, seat, source)（canDamageEnemy 先判合法性）。
//
// 口径说明：参考实现 Counterattack1.hs 把时机限定为「另一名与你同地点的调查员被攻击」
// （affectsOthers），而本批卡面数据（workers/w2.json）写的是「你所在地点的一位调查员」。
// 这里按卡面数据实现（包含你自己）；若核对官方卡面后确认是「另一位调查员」，只需在 criteria 里
// 追加 `ctx.seat !== inv.seat`。

const CODE = '12026'
const DAMAGE = 1

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttack',
      label: '取消该次攻击，并对该敌人造成 1 点伤害',
      criteria: [
        ({ inv, context }) => {
          const ctx = context?.context || context || {}
          if (!ctx.enemy || ctx.cancelled === true) return false
          // 被攻击的调查员必须在你所在地点（含你自己）。
          return ctx.location === inv.location
        },
      ],
      resolve: ({ inv, api }) => {
        const raw = api.reactionContext()
        const context = raw?.context || raw
        const enemy = context?.enemy
        if (!context || !enemy) return
        api.cancelCurrentAttack(context)
        api.info(`「反手一击」：取消了「${enemy.name}」的这次攻击。`)
        if (api.canDamageEnemy(enemy, inv.seat, { code: CODE })) {
          api.damageEnemy(enemy, DAMAGE, inv.seat, { code: CODE })
          api.info(`「反手一击」：对「${enemy.name}」造成 ${DAMAGE} 点伤害。`)
        }
      },
    },
  ],
  modifiers: [
  ],
}
