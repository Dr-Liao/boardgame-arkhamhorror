// 10694b 莉亚·阿特伍德 · 敌人（莉亚·阿特伍德的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Retaliate.
//   [action]: Parley. Test [combat] (5). If you succeed, set Leah Atwood aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10694 的背面）。
//
// 印刷数值（战斗 4 / 躲避 2 / 生命 4 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性）由 cards-data 提供，
// Retaliate 由章节 encounterDefinitions 从英文正文解析。
// 读点：
//   · 谈判 = abilities 的 action/parley：引擎 parley.js 枚举同地点的敌人（parleyMovesFor），费用与检定走
//     ability 管线；成功后 api.scenario.setEnemyAside（scenario-runtime 的「放到一边」唯一写点）。
const CODE = '10694b'
const RESIDENT = 'leahAtwood'
const NAME = '莉亚·阿特伍德'

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
    assetCode: '10694',
    keywords: ['retaliate'],
    victory: 0,
    parleySetAside: { skill: 'combat', difficulty: 5 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[战力](5)，成功则把莉亚·阿特伍德放到一边',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => api.test(inv.seat, 'combat', 5, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) setAside(source, api) },
    }),
  }],
  note: '敌人面谈判只做「检定 + 放到一边」（印刷无提高关系等级一句）；放到一边走 api.scenario.setEnemyAside。',
}
