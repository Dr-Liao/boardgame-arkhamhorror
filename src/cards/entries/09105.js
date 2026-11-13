// 09105 直击弱点（Exploit Weakness）· 幸存者事件 · 0 经验
// 卡面：快速。在你执行的攻击或躲避尝试期间，揭示混乱标记前打出，且本次检定的当前难度值须为 0。
//       本次检定自动成功。不执行本次检定的通常效果，改为弃掉攻击或躲避的敌人
//       （如果该敌人是 [[精英]]，改为自动躲避它并对它造成 3 点伤害）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 快速 + 固定时机：played 描述子 fast + trigger:'beforeChaosTokenReveal'
//     （P2-4 快速事件统一通道；候选出口 encounter.js#reactionWindow，执行器 assets.js#playReactionCard）；
//   · 「攻击或躲避检定」：优先 state.skillTest.actionKind；引擎只在「有人声明 trackTestTarget」时才写
//     actionKind（tests.js:171-181），本卡是事件、没有该声明，因此回落到检定来源 label（attack =
//     combat.js:229 的「攻击」/ evade = combat.js:578 的「躲避」，与 09030 同一读点）；
//   · 难度 0 的判定：state.skillTest.difficulty（reduceTestDifficulty 之后的当前值）；
//   · 自动成功：api.setTestAutoSuccess（引擎的 autoSuccess + skipTokens 唯一写点）；
//   · 弃掉敌人：api.discardEnemy；精英走 api.autoEvadeEnemy + api.damageEnemy。
//   enemy 目标：test.target.id（声明 trackTestTarget 时）→ 回落 test.source.enemyId（攻击/躲避的
//   检定来源始终带 enemyId）。
// approximation: 引擎没有「替换本次检定的通常效果」的写点——自动成功之后攻击/躲避的通常效果仍会
//   结算（对非精英而言敌人在伤害结算前已离场，通常无影响；对精英会额外再吃一次攻击伤害）。
const code = '09105'

const ACTION_LABEL = { 攻击: 'fight', 躲避: 'evade' }
const testActionKind = test => {
  if (!test) return null
  if (test.actionKind) return test.actionKind
  const label = String(test.source?.label || '')
  for (const [text, kind] of Object.entries(ACTION_LABEL)) if (label.includes(text)) return kind
  return null
}

const inPosition = ({ state, inv }) => {
  const test = state.skillTest
  if (!test || test.seat !== inv.seat) return false
  if (!['fight', 'evade'].includes(testActionKind(test))) return false
  return (Number(test.difficulty) || 0) === 0
}

export default {
  code,
  note: 'approximation: 自动成功之后本次攻击/躲避的通常效果仍会结算（引擎没有「取代检定通常效果」写点）；精英分支因此可能多结算一次攻击伤害。',
  playCondition: [{ when: inPosition, message: '「直击弱点」只能在难度为 0 的攻击/躲避检定、揭示标记前打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'beforeChaosTokenReveal',
      criteria: [inPosition],
      label: '本次检定自动成功：弃掉敌人（精英改为自动躲避并造成 3 点伤害）',
      resolve: ({ state, inv, api }) => {
        const test = state.skillTest
        const targetId = test?.target?.id ?? test?.source?.enemyId ?? null
        const enemy = targetId != null ? state.enemies.find(item => item.id === targetId) : null
        api.setTestAutoSuccess()
        if (!enemy) { api.info('「直击弱点」：本次检定自动成功，但没有可弃掉的敌人。'); return }
        if (enemy.elite === true) {
          api.autoEvadeEnemy(enemy)
          api.damageEnemy(enemy, 3, inv.seat, null)
          api.info(`🎯 「直击弱点」：${inv.name} 自动躲避「${enemy.name}」并对其造成 3 点伤害。`)
        } else {
          api.discardEnemy(enemy)
          api.info(`🎯 「直击弱点」：${inv.name} 弃掉「${enemy.name}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
