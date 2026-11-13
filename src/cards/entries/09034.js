// 09034 看门狗（Guard Dog）· 守卫者资产（2 级）· 盟友槽 · 生命 4 / 神智 2。
// 卡面：[fast] 横置看门狗：与你所在地点的一个敌人交战。该敌人攻击你。
//       [reaction] 在敌人的攻击对看门狗造成伤害和/或恐惧时：对攻击的敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 免费能力：选同地点敌人 → api.engage 交战 → api.enemyAttackByCard 让它攻击你
//     （卡牌造成的敌人攻击与「不能攻击」开关无关，读点同 5c-32）；
//   · 反应：窗口 enemyAttackDamage（敌人攻击造成伤害后，上下文带 enemy 与 damagedAssetIds）；
//     条件是本次攻击确实伤害/恐惧到这张支援（damagedAssetIds 含本卡 id），效果
//     api.damageEnemy 对攻击者 1 点伤害。卡面没有横置费用（P1-8 复核：旧实现多了 cost.exhaust，
//     会让看门狗横置时该反应不可用）；「每次攻击事件只结算一次」用 limit perWindow（与 05001 同款，
//     否则无费用的反应会在同一窗口的反循环里重复结算到敌人被击败）。
const SOURCE = '09034'
const dogOf = inv => (inv.assets || []).find(card => card.code === SOURCE) || null

export default {
  code: '09034',
  abilities: [
    {
      kind: 'free',
      label: '横置：与同地点一个敌人交战，该敌人攻击你',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => (state.enemies || []).some(enemy => enemy.location === inv.location && !enemy.defeated)],
      resolve: ({ state, inv, api }) => {
        const targets = api.enemiesAt(inv.location)
        if (!targets.length) {
          api.info('看门狗：这里没有可交战的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: SOURCE, seat: inv.seat,
          prompt: '看门狗：选择要交战的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = state.enemies.find(item => item.id === chosen) || targets[0]
        api.engage(enemy, inv.seat)
        api.enemyAttackByCard(enemy, '看门狗：敌人攻击你', inv.seat)
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyAttackDamage',
      label: '看门狗被敌人攻击伤害后：对攻击者造成 1 点伤害',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ inv, context }) => {
        const dog = dogOf(inv)
        if (!dog || !context?.enemy) return false
        return (context.damagedAssetIds || []).includes(dog.id)
      }],
      resolve: ({ state, context, api }) => {
        const enemy = state.enemies.find(item => item.id === context.enemy.id) || context.enemy
        api.damageEnemy(enemy, 1, context.seat ?? state.currentSeat, { code: SOURCE })
        api.info(`看门狗反咬「${enemy.name}」1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
