// 10116 出奇制胜（Long Shot）· 潜袭者技能 · 0 经验 · 精通
// 卡面：你可以将出奇制胜投入到对你所在地点或连接地点的敌人进行的攻击或躲避检定。
//       如果本次检定成功，对该敌人造成 1 点伤害。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 印刷没有技能图标（cdSkills = []），引擎的投入候选要求「图标 > 0 或 skill.anySkill」，
//     因此用 anySkill: true 让这张牌进入候选，再用 commitCondition 收窄到
//     「对所在地点/连接地点敌人的攻击或躲避检定」。
//   · 投入限制 = commit 档案的 commitCondition（tests.js#commitCandidates 的唯一读点；
//     ctx = { state, owner, performer, test, baseSkillValue }）。检定目标的两种来源都读：
//     test.target（performTest 写入的 { kind:'enemy', id }）与 test.source.enemyId（makeTest 的
//     source 元数据，攻击/躲避检定都带 label '攻击'/'躲避'）。
//   · 「检定成功 → 对该敌人造成 1 点伤害」= commit 档案的 afterTest(ctx)
//     （tests.js#closeTest 在 ST.8 按投入卡逐个调用，ctx.result 是标准检定结果），
//     伤害走 api.damageEnemy（唯一的敌人伤害写口）。
const CODE = '10116'

function testedEnemyId(test) {
  const id = test?.target?.kind === 'enemy' ? test.target.id : test?.source?.enemyId
  return id ?? null
}

function reachableEnemy(state, owner, enemyId) {
  const enemy = (state.enemies || []).find(item => item.id === enemyId)
  if (!enemy) return null
  const here = (state.locations || []).find(location => location.id === owner?.location)
  const reachable = enemy.location === owner?.location || (here?.connections || []).includes(enemy.location)
  return reachable ? enemy : null
}

export default {
  code: CODE,
  name: 'Long Shot',
  abilities: [
    {
      kind: 'commit',
      label: '可投入对所在地点/连接地点敌人的攻击或躲避检定；成功后对该敌人造成 1 点伤害',
      skill: {
        // 无印刷图标：没有 anySkill 就不会出现在任何投入候选里。
        anySkill: true,
        commitCondition: ({ state, owner, test }) => {
          const label = test?.source?.label
          if (!['攻击', '躲避'].includes(String(label))) return false
          const enemyId = testedEnemyId(test)
          return Boolean(enemyId && reachableEnemy(state, owner, enemyId))
        },
        afterTest: ({ state, inv, result, test, api }) => {
          if (!result?.success) return
          const enemy = reachableEnemy(state, inv, testedEnemyId(test))
          if (!enemy) return
          api.damageEnemy(enemy, 1, inv.seat)
          api.info(`🎯 「出奇制胜」：本次检定成功，对「${enemy.name}」造成 1 点伤害。`)
        },
      },
    },
  ],
  modifiers: [],
}
