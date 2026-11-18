// 10699b 朱迪斯·帕克 · 敌人（朱迪斯·帕克的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Hunter. Retaliate.
//   [action] Spend 5 resources: Parley. Set Judith Park aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10699 的背面）。
//
// 印刷数值（战斗 5 / 躲避 2 / 生命 3 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性）由 cards-data 提供；
// Hunter / Retaliate 由章节 encounterDefinitions 从英文正文解析。
// 读点：
//   · 谈判 = abilities 的 action/parley：「花费 5 资源」走引擎的费用管线 cost.resources（合法性、预览与
//     扣费同一口径，含资源池/寄存口径）；无检定，成功后 api.scenario.setEnemyAside。
const CODE = '10699b'
const RESIDENT = 'judithPark'
const NAME = '朱迪斯·帕克'

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
  flags: {
    resident: RESIDENT,
    assetCode: '10699',
    keywords: ['hunter', 'retaliate'],
    victory: 0,
    parleySetAside: { skill: null, difficulty: 0, resources: 5 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：花费 5 资源，把朱迪斯·帕克放到一边',
    cost: { action: 1, resources: 5 },
    resolve: ({ source, api }) => setAside(source, api),
  }],
  note: '「花费 5 资源」走引擎的费用管线（cost.resources；资源不足时该谈判不进入合法行动）；无检定。',
}
