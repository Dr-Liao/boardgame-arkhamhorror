// 10698b 基甸·米兹拉克 · 敌人（基甸·米兹拉克的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Retaliate.
//   Forced - After Gideon Mizrah attacks you: Discard 1 card at random from your hand.
//   [action] [action] [action]: Parley. Set Gideon Mizrah aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10698 的背面）。
//
// 印刷数值（战斗 2 / 躲避 1 / 生命 3 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性）由 cards-data 提供，
// Retaliate 由章节 encounterDefinitions 从英文正文解析。
// 读点：
//   · 「攻击你后随机弃 1 张手牌」= enemyRule.discardRandomOnAttack（enemies.js#enemyAttack 读点，唯一入口；
//     无手牌时该读点令本次攻击伤害与恐惧各 +1，与印刷的「随机弃 1 张」同源）；
//   · 谈判 = abilities 的 action/parley：「[action][action][action] 谈判」无检定，只有 cost.action 3；
//     成功后 api.scenario.setEnemyAside。
const CODE = '10698b'
const RESIDENT = 'gideonMizrah'
const NAME = '基甸·米兹拉克'

// 「放到一边，位于场外」= 引擎 api.scenario.setEnemyAside（唯一读点：scenario-runtime.js）。
const setAside = (enemy, api) => {
  const removed = api.scenario?.setEnemyAside?.(enemy)
  api.info?.(removed ? `「${NAME}」被放到一边（场外）。` : `「${NAME}」不在场上，无需放到一边。`)
  return Boolean(removed)
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyRule: { discardRandomOnAttack: true },
  flags: {
    resident: RESIDENT,
    assetCode: '10698',
    keywords: ['retaliate'],
    victory: 0,
    parleySetAside: { skill: null, difficulty: 0, actions: 3 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判（3 个行动）：把基甸·米兹拉克放到一边',
    cost: { action: 3 },
    resolve: ({ source, api }) => setAside(source, api),
  }],
  note: '「攻击你后随机弃 1 张手牌」用 enemyRule.discardRandomOnAttack（引擎在该敌人攻击结算前弃掉随机 1 张；'
    + '无手牌时伤害与恐惧各 +1 是引擎同一读点的既有口径）。谈判无检定、3 个行动。',
}
