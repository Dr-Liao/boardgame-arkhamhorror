// 12009 黑室特工（Black Chamber Operative）· 中立 · 弱点/人形/结社。（特里希·斯卡波罗签名弱点敌人）
//
// 卡面：猎手。猎物（仅对特里希·斯卡波罗）。
//   强制 - 你躲避黑室特工后：将你的 1 个线索放到你所在地点。如果你不能这么做，
//     本敌人重整，与你交战并立即进行一次攻击。
//
// 引擎读点：
//   · 玩家牌组里的敌人弱点：条目 `scope: 'enemy'` + `enemyWeakness`（card-lookup.js#enemyDef
//     把 hunter/prey 合并进敌人定义；weakness.js 的 enemy 分支在承受者地点生成）。
//   · 「你躲避它后」：`evadeSuccess` 窗口（combat.js，context.enemy = 被躲避的敌人）；
//     非玩家实体的强制能力由 openAbilityWindow 的第 3 段（nonPlayerAbilitySources）派发。
//   · 「放 1 个线索到所在地点」= api.spendClueToLocation（唯一「从你线索池放到地点」的原语）；
//     不能时 api.readyEnemy + api.engage + api.enemyAttackByCard（卡牌造成的立即攻击）。

const code = '12009'

export default {
  code,
  scope: 'enemy',
  enemyWeakness: { hunter: true, prey: true },
  abilities: [{
    kind: 'forced',
    trigger: 'evadeSuccess',
    label: '你躲避黑室特工后：将 1 个线索放到所在地点；若不能，它重整、与你交战并立即攻击',
    criteria: [({ context, source }) => Boolean(context?.enemy)
      && (context.enemy === source || context.enemy?.id === source?.id)],
    resolve: ({ inv, source, context, api }) => {
      const seat = Number.isInteger(context?.seat) ? context.seat : inv.seat
      if (api.spendClueToLocation(seat, 1) >= 1) return
      api.readyEnemy(source)
      api.engage(source, seat)
      api.enemyAttackByCard(source, `「${api.cardName(code)}」`, seat)
    },
  }],
  modifiers: [],
}
