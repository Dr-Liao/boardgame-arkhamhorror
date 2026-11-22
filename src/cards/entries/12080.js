// 12080 灵活脱身（Slippery）
// 卡面：如果躲避非[[精英]]敌人时本次技能检定成功，该敌人在下一个补给阶段期间不重整。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 技能牌 = kind:'commit' 描述子（commitProfile 的唯一入口，图标由 cards-data 提供）；
//   · 检定成功后的脚本 = skill.onSuccessResolve（tests.js 在成功结算段按投入卡逐张调用）；
//   · 「下一个补给阶段不重整」= api.preventEnemyReady(enemy, 1)（scenario-runtime 写
//     enemy.preventReady；读点是 phases.js 的补给阶段重整判定，与跳过重整的既有原语同源）；
//   · 躲避目标与[[精英]]判定读 state.skillTest.source（doEvade 写入 label:'躲避' 与 enemyId）。

const CODE = '12080'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '躲避非[[精英]]敌人成功：该敌人下一个补给阶段不重整',
      skill: {
        onSuccessResolve: ({ state, api }) => {
          const test = state.skillTest
          if (!test || String(test.source?.label || '') !== '躲避') return
          const enemyId = test.source?.enemyId
          const enemy = (state.enemies || []).find(item => item.id === enemyId)
          if (!enemy || enemy.elite) return
          api.preventEnemyReady(enemy, 1)
          api.info(`🌀 「灵活脱身」：「${enemy.name}」在下一个补给阶段不重整。`)
        },
      },
    },
  ],
  modifiers: [],
}
