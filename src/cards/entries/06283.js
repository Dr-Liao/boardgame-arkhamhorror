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
//     上下文带刚生成的敌人，按卡号条件结算；没有猎犬时把敌人返回绑定场外集合。
//   · 被放到一边的受召猎犬进入 state.setAside（不是 06282 的绑定集合）。

export default {
  code: '06283',
  scope: 'enemy',
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
        const hounds = state.investigators
          .flatMap(owner => (owner.assets || []).map(item => ({ owner, asset: item })))
          .filter(item => item.asset.code === '06282')
        if (!hounds.length) {
          api.returnEnemyToBonded(beast, { ownerSeat: beast.bearerSeat ?? state.currentSeat })
          api.info(`🐾 场上没有「受召猎犬」：「${api.cardName('06283')}」被放在一边，位于场外。`)
          return
        }
        const chosenId = hounds.length === 1 ? hounds[0].asset.id : api.choice({
          kind: 'target', source: '06283', seat: beast.bearerSeat ?? state.currentSeat,
          prompt: '选择一张在场的「受召猎犬」放到一边。',
          options: hounds.map(({ owner, asset }) => ({
            id: asset.id, cardCode: '06282', label: `${owner.name} 的「受召猎犬」`,
          })),
        })
        const hound = hounds.find(item => item.asset.id === chosenId) || hounds[0]
        api.moveCard({ id: hound.asset.id, from: 'play', to: 'setAside', ownerSeat: hound.owner.seat })
        api.moveEnemy(beast, hound.owner.location)
        api.engage(beast, hound.owner.seat)
        api.info(`🐾 「受召猎犬」被放在一边；「${api.cardName('06283')}」生成并与该调查员交战。`)
      },
    },
  ],
  modifiers: [],
}
