// 05191 田纳西酸麦芽威士忌（幸存者 · 3 经验）
// 卡面：快速。使用(3补给)。
// 卡面：[fast]横置田纳西酸麦芽威士忌并花费1补给：你在诡计卡牌的一次技能检定中得到+2[willpower]。
// 卡面：[action]弃掉田纳西酸麦芽威士忌：攻击。你本次攻击得到+3[combat]。
//       如果本次攻击对一个非[[精英]]敌人检定成功，自动躲避该敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05191 田纳西酸麦芽威士忌（幸存者）：诡计检定 +2 意志；弃掉：攻击 +3 战斗，命中非精英敌人时自动躲避。

// 当前技能检定是否针对一张诡计卡（performTest 的 source.code 就是诡计的卡号）。
function onTreacheryTest({ state, helpers }) {
  const code = state.skillTest?.source?.code
  if (!code) return false
  return helpers?.cardType?.(code) === 'treachery'
}

export default {
  code: '05191',
  uses: 3,
  usesType: 'supplies',
  fast: true,
  abilities: [
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      duringOwnSkillTest: true,
      label: '横置并花 1 补给：诡计卡牌的检定 +2[willpower]',
      cost: { action: false, exhaust: true, uses: 1 },
      criteria: [onTreacheryTest],
      resolve: ({ inv, api }) => {
        api.addPendingTestBonus(2)
        api.info(`🥃 ${inv.name} 喝下一口田纳西酸麦芽威士忌：本次检定 +2[意志]。`)
      },
    },
    {
      kind: 'action',
      label: '弃掉：攻击（战斗 +3；对非精英敌人命中后自动躲避）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { discardSelf: true },
      resolve: ({ state, inv, api, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 3 })
        if (!result?.success || enemy.elite) return
        if (!state.enemies.includes(enemy)) return
        api.autoEvade(enemy)
        api.info(`💨 非精英敌人「${enemy.name}」被自动躲避。`)
      },
    },
  ],
}
