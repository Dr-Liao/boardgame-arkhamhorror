// 08082 抵挡
// 卡面：快速。在你所在地点生成一个非[[精英]]敌人时打出。该敌人攻击你。然后，自动躲避该敌人并将抵挡
//       附属到该敌人。被附属的敌人不能重整。
//
// 读点：enemySpawn 窗口（敌人生成时，enemies.js 在生成后开，context 带 enemy/location/seat）；
// 攻击走 api.enemyAttackByCard，躲避 api.autoEvadeEnemy，附属用 eventPlayed 窗口 +
// api.moveCard({from:'discard',to:'attached',attachTo})；「不能重整」由条目 restrainsReady:true
// （phases.js 对敌人附属的 restrainsReady 读点）。
//
// approximation: 打出的瞬间事件卡尚未进弃牌堆，附属改在 eventPlayed 窗口结算，并用
//   「本地点刚被自动躲避（横置、未附属 08082）的非精英敌人」定位目标；正常单目标生成时等价。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08082',
  restrainsReady: true,
  abilities: [
    { kind: 'played', fast: true, trigger: 'enemySpawn',
      label: '非精英敌人生成时：该敌人攻击你，然后自动躲避它',
      criteria: ({ inv, context, state }) => {
        const enemy = context?.enemyId ? state.enemies.find(item => item.id === context.enemyId) : context?.enemy
        return Boolean(enemy) && context.location === inv.location && enemy.elite !== true && enemy.defeated !== true
      },
      resolve: ({ inv, context, state, api }) => {
        const enemy = context.enemyId ? state.enemies.find(item => item.id === context.enemyId) : context.enemy
        if (!enemy) return
        api.enemyAttackByCard(enemy, '抵挡：该敌人的攻击', inv.seat)
        api.autoEvadeEnemy(enemy)
      } },
    { kind: 'reaction', trigger: 'eventPlayed',
      label: '抵挡打出后：附属到刚被自动躲避的非精英敌人',
      criteria: ({ inv, context, state }) => context?.cardCode === '08082' && Boolean(state.enemies.some(enemy =>
        !enemy.elite && !enemy.defeated && enemy.location === inv.location && enemy.exhausted
        && !(enemy.attachments || []).some(card => card.code === '08082'))),
      resolve: ({ inv, state, api }) => {
        const enemy = state.enemies.find(item => !item.elite && !item.defeated
          && item.location === inv.location && item.exhausted
          && !(item.attachments || []).some(card => card.code === '08082'))
        if (!enemy) return
        api.moveCard({ code: '08082', from: 'discard', to: 'attached', attachTo: enemy.id })
      } },
  ],
  modifiers: [],
}
