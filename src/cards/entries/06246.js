// 06246 迅速撤退
// 卡面：每次技能检定最多投入1张。
//       将迅速撤退在基础躲避行动期间投入时，其获得[agility][agility]和以下文本：
//       “如果本次检定成功且超过难度至少2点，你可以自动躲避你所在地点的另一个敌人。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06246 迅速撤退（技能卡）：印刷 1 个敏捷图标。
//   · 「每次技能检定最多投入1张」→ 检定档案 skill.maxPerTest:1（tests.js 的投入过滤读点）；
//   · 「基础躲避行动期间投入时获得 [agility][agility]」→ skill.iconBonus 按来源授予；
//   · 「成功且超过难度至少2点，自动躲避另一个敌人」→ skill.afterTest 选择目标并自动躲避。

export default {
  code: '06246',
  abilities: [
    {
      kind: 'commit',
      label: '迅速撤退',
      skill: {
        maxPerTest: 1,
        iconBonus: ({ skill, test }) => test?.basicAction === 'evade'
          && (Array.isArray(skill) ? skill.includes('agility') : skill === 'agility') ? 2 : 0,
        afterTest: ({ state, inv, result, test, api }) => {
          if (test?.basicAction !== 'evade' || !result?.success || result.value - result.difficulty < 2) return
          const others = (state.enemies || []).filter(enemy => enemy.location === inv.location
            && enemy.id !== test.source?.enemyId && !enemy.defeated)
          if (!others.length) return
          const answer = api.choice({
            kind: 'enemy', source: '06246', seat: inv.seat, canSkip: true,
            prompt: '是否自动躲避所在地点的另一名敌人？',
            options: [{ id: 'skip', label: '不躲避' },
              ...others.map(enemy => ({ id: enemy.id, label: enemy.name }))],
          })
          const target = others.find(enemy => enemy.id === answer)
          if (target) api.autoEvade(target)
        },
      },
    },
  ],
  modifiers: [],
}
