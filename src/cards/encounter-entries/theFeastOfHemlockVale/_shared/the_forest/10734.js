// 10734 螺旋牡鹿（Cochleal Stag）· 敌人 · 共享遭遇组 the_forest（印刷 1 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Elusive. (Night [night]) Hunter.
//   Each investigator at Cochleal Stag's location and each connecting location gets -2 to all
//   skills during the mythos phase.
//
// 读点（声明即接线）：
//   · 「逃逸」（无条件印刷）= enemyRule.elusive，读点 src/engine/enemy-keyword-movement.js
//     #resolveElusiveAfterAttack（攻击后解除交战 → 移动到连接地点 → 横置；combat.js 与 enemies.js 的
//     攻击结算共用）。
//   · 「黑夜猎手」：encounterDefinitions 从英文正文静态解析关键词（card-data.js）；
//     昼夜差异留给 P8 关键词昼夜读点，条目只记录 nightOnlyKeywords 数据。
//   · 「神话阶段本地与连接地点 -2 技能」：引擎没有敌人光环式的技能修正读点
//     （entityModifierTotal 只覆盖 enemyFight/enemyEvade/enemyHealth），本条只声明数据。
//   · 印刷数值（fight 3 / evade 4 / health 5 / damage 2 / horror 1）由 cards-data 提供，条目只镜像。
export default {
  code: '10734',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    elusive: true,
  },
  flags: {
    encounterGroup: 'the_forest',
    quantity: 1,
    traits: ['Creature', 'Monster', 'Flora', 'Mutated'],
    keywords: ['elusive'],
    nightOnlyKeywords: ['hunter'],
    printedFight: 3,
    printedEvade: 4,
    printedHealth: 5,
    printedDamage: 2,
    printedHorror: 1,
    printedVictory: 0,
    mythosPhaseSkillPenalty: { amount: -2, skills: 'all', scope: 'hereAndConnections', phase: 'mythos' },
  },
  abilities: [],
  note: '逃逸用 enemyRule.elusive（攻击后逃逸的引擎读点）。「本地与连接地点每位调查员在神话阶段'
    + '每项技能 -2」没有引擎读点（没有敌人光环式的技能修正），作为印刷数据留待 P8 章节技能修正读点；'
    + '「黑夜猎手」由 encounterDefinitions 解析，昼夜差异留给 P8 关键词昼夜读点。',
}
