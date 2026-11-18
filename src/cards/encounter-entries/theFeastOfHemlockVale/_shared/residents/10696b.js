// 10696b 威廉·汉洛克 · 敌人（威廉·汉洛克的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Elusive.
//   [action]: Parley. Test [intellect] (5). If you succeed, set William Hemlock aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10696 的背面）。
//
// 印刷数值（战斗 1 / 躲避 2 / 生命 3 / 伤害 0 / 恐惧 1 / 胜利 0 / 特性）由 cards-data 提供；
// Elusive 没有 encounterDefinitions 解析入口，因此在 enemyRule 里声明（引擎读点：
// resolveElusive / resolveElusiveAfterAttack）。
const CODE = '10696b'
const RESIDENT = 'williamHemlock'
const NAME = '威廉·汉洛克'

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
    assetCode: '10696',
    keywords: ['elusive'],
    victory: 0,
    parleySetAside: { skill: 'intellect', difficulty: 5 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[智力](5)，成功则把威廉·汉洛克放到一边',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => api.test(inv.seat, 'intellect', 5, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) setAside(source, api) },
    }),
  }],
  note: '逃逸（Elusive）用 enemyRule.elusive 声明（引擎读点）；敌人面谈判成功只放到一边，关系等级由章节法典结算。',
}
