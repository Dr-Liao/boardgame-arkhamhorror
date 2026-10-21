// 03268 建议
// 卡面：使用(3充能)。
// 卡面：[action]横置建议：躲避。本次躲避尝试将你的[willpower]值加入你的技能值。如果你未超过难度至少2点并成功，从建议移除1充能。
// 卡面：[reaction]在一个非[[精英]]敌人将要攻击你时，花费1充能：取消该次攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03268 暗示：主动躲避能力 + 取消非精英敌人攻击的反应（消耗充能）。
// 5c-26：主动能力不再走 carcosaPlayer 逃生原语。**顺带修了一个既有 bug**：
// 旧原语把空 effect 传给 chooseEnemy，而 abilityTargets({}) 恒为空 → 一用就抛
// 「没有合法敌人目标」。现在按躲避的目标形状（交战中的敌人）选目标，并先挡掉无目标的情况。

export default {
  code: '03268',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', label: '建议躲避', cost: { action: true, exhaust: true },
      resolve: ({ inv, source, api }) => {
        const engaged = api.enemiesAt(inv.location).filter(item => item.engagedSeat === inv.seat)
        if (!engaged.length) { api.info('你没有可建议躲避的交战敌人。'); return }
        const enemy = api.chooseEnemy(inv.seat, { type: 'evade' })
        if (!enemy) return
        api.evade(inv.seat, { enemyId: enemy.id, addSkill: 'willpower', suggestionAssetId: source?.id })
      },
    },
    {
      kind: 'reaction', trigger: 'enemyAttack', id: 'suggestionCancel', legacyReaction: true,
      criteria: { nonEliteOnly: true }, label: '取消非精英敌人的攻击',
      cost: { uses: 1 }, effect: { type: 'cancelEnemyAttack' },
    },
  ],
  modifiers: [

  ],
}
