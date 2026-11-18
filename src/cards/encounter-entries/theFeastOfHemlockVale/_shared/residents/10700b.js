// 10700b 希奥·彼得斯 · 敌人（希奥·彼得斯的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Elusive. Alert.
//   [action] Discard 3 cards at random from your hand: Parley. Set Theo Peters aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10700 的背面）。
//
// 印刷数值（战斗 3 / 躲避 3 / 生命 3 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性）由 cards-data 提供；
// Alert 由章节 encounterDefinitions 从英文正文解析，Elusive 没有解析入口，因此在 enemyRule 里声明
// （引擎读点：resolveElusive / resolveElusiveAfterAttack）。
// 读点：
//   · 谈判 = abilities 的 action/parley：「弃掉 3 张手牌」走引擎的弃手牌费用 cost.discardHand
//     （discardChosenCards，玩家自选；印刷写「随机」，差异在 note 披露）；成功后 api.scenario.setEnemyAside。
const CODE = '10700b'
const RESIDENT = 'theoPeters'
const NAME = '希奥·彼得斯'

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
  enemyRule: { elusive: true },
  flags: {
    resident: RESIDENT,
    assetCode: '10700',
    keywords: ['elusive', 'alert'],
    victory: 0,
    parleySetAside: { skill: null, difficulty: 0, discardHand: 3 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：弃掉 3 张手牌，把希奥·彼得斯放到一边',
    cost: { action: 1, discardHand: 3 },
    resolve: ({ source, api }) => setAside(source, api),
  }],
  note: '近似：印刷是「随机弃 3 张」，引擎通用的弃手牌费用是 discardChosenCards（玩家自选），本条目用既有费用键，'
    + '随机/自选的差异在此披露（费用数值 3 与合法性判定一致）。逃逸用 enemyRule.elusive 声明。',
}
