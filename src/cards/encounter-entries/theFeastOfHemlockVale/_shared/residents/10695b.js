// 10695b 席米恩·阿特伍德 · 敌人（席米恩·阿特伍德的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Elusive. Hunter.
//   [action]: Parley. Test [agility] (5). If you succeed, set Simeon Atwood aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10695 的背面）。
//
// 印刷数值（战斗 1 / 躲避 4 / 生命 2 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性）由 cards-data 提供；
// Hunter 由章节 encounterDefinitions 从英文正文解析，Elusive 没有解析入口，因此在 enemyRule 里声明
// （引擎读点：resolveElusive / resolveElusiveAfterAttack，见 enemy-keyword-movement.js）。
const CODE = '10695b'
const RESIDENT = 'simeonAtwood'
const NAME = '席米恩·阿特伍德'

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
    assetCode: '10695',
    keywords: ['elusive', 'hunter'],
    victory: 0,
    parleySetAside: { skill: 'agility', difficulty: 5 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[敏捷](5)，成功则把席米恩·阿特伍德放到一边',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => api.test(inv.seat, 'agility', 5, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) setAside(source, api) },
    }),
  }],
  note: '逃逸（Elusive）用 enemyRule.elusive 声明（引擎 resolveElusive / resolveElusiveAfterAttack 读点；'
    + 'encounterDefinitions 不解析 Elusive），猎手由正文解析。',
}
