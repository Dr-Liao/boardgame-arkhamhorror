// 06283 脱缰野兽
// 卡面：绑定 (受召猎犬)。猎物 - 承受者。猎手。反击。
//       显现 - 如果场上没有受召猎犬，将脱缰野兽放在一边，位于场外。
//       否则，将一位调查员的受召猎犬放在一边，位于场外，且脱缰野兽生成并与该调查员交战。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06283 脱缰野兽（玩家弱点·敌人形态，绑定 06282 受召猎犬）：
//   · 敌人数值/特性来自 cards-data；猎手/反击/猎物由条目级 enemyWeakness 声明
//     （读点 src/engine/card-lookup.js 的 enemyDef——弱化敌人从注册条目合并 hunter/retaliate/prey）；
//   · 显现的「生成」由 resolveWeakness 的敌人型弱点分支完成（scope:'enemy' 条目不能声明 weakness
//     描述子——注册期校验只允许 constant/reaction/forced/elderSign）；
//   · 「否则把一张受召猎犬放到一边」与「没有猎犬时不生成、放在一边」写在 enemySpawn 强制描述子里：
//     上下文带刚生成的敌人，按卡号条件结算；没有猎犬时把刚生成的敌人移出（= 放在一边、位于场外）。
//   · 显式简化：多张受召猎犬时取第一张（引擎没有「选择承受者」的弱点显现读点）；被放到一边的
//     受召猎犬进入 state.setAside（不是 06282 的绑定集合）。

export default {
  code: '06283',
  scope: 'enemy',
  simplified: true,
  note: '未实现：多张受召猎犬在场时由玩家选择哪一张被放到一边（现取第一张）；「放到一边」进入 setAside'
    + '（不是 06282 的绑定集合）；无猎犬时的「不生成」用移除刚生成敌人的方式近似。'
    + '主要分支（有猎犬→猎犬离场、脱缰野兽与猎犬持有者交战）已实现。',
  enemyWeakness: { hunter: true, retaliate: true, prey: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'enemySpawn',
      id: 'unboundBeastRevelation',
      label: '显现：有受召猎犬则把它放到一边并让脱缰野兽与其持有者交战；没有则放在一边、位于场外',
      criteria: [({ context }) => (context?.enemy?.originalCode || context?.enemy?.code) === '06283'],
      resolve: ({ state, context, api }) => {
        const beast = context?.enemy
        if (!beast) return
        const hound = state.investigators
          .flatMap(owner => (owner.assets || []).map(item => ({ owner, asset: item })))
          .find(item => item.asset.code === '06282')
        if (!hound) {
          api.removeEnemy(beast)
          api.info(`🐾 场上没有「受召猎犬」：「${api.cardName('06283')}」被放在一边，位于场外。`)
          return
        }
        api.moveCard({ code: '06282', from: 'play', to: 'setAside', ownerSeat: hound.owner.seat })
        api.moveEnemy(beast, hound.owner.location)
        api.engage(beast, hound.owner.seat)
        api.info(`🐾 「受召猎犬」被放在一边；「${api.cardName('06283')}」生成并与该调查员交战。`)
      },
    },
  ],
  modifiers: [],
}
