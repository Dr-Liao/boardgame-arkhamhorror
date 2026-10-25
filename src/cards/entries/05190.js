// 05190 田纳西酸麦芽威士忌（潜袭者 · 3 经验）
// 卡面：快速。使用(2补给)。
// 卡面：[fast]横置田纳西酸麦芽威士忌并花费1补给：你在诡计卡牌的一次技能检定中得到+3[willpower]。
// 卡面：[action]弃掉田纳西酸麦芽威士忌：攻击。本次攻击你得到+3[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05190 田纳西酸麦芽威士忌（潜袭者）：诡计检定 +3 意志（横置 + 1 补给）；弃掉：攻击 +3 战斗 +1 伤害。
//
// 注意：不要把条件写成能力 criteria——免费能力在玩家窗口的枚举不读 criteria（引擎侧只在执行时校验），
// 条件不成立时会出现「选项可点但点了没反应」的空转。条件放进 resolve 里判定。

export default {
  code: '05190',
  uses: 2,
  usesType: 'supplies',
  fast: true,
  abilities: [
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      duringOwnSkillTest: true,
      label: '横置并花 1 补给：诡计卡牌的检定 +3[willpower]',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        // 卡面「在诡计卡牌的一次技能检定中得到 +3[willpower]」：
        // 检定不是诡计 or 不使用意志时，+意志没有可加的技能值（能力可合法触发，但不产生效果）。
        const sourceCode = state.skillTest?.source?.code
        const onTreachery = sourceCode != null && api.cardType(sourceCode) === 'treachery'
        const skill = state.skillTest?.skill
        const usesWillpower = Array.isArray(skill) ? skill.includes('willpower') : skill === 'willpower'
        if (!onTreachery || !usesWillpower) {
          api.info('本次检定不是诡计卡牌的意志检定，田纳西酸麦芽威士忌的 +意志不生效。')
          return
        }
        api.addPendingTestBonus(3)
        api.info(`🥃 ${inv.name} 喝下一口田纳西酸麦芽威士忌：本次检定 +3[意志]。`)
      },
    },
    {
      kind: 'action',
      label: '弃掉：攻击（战斗 +3，伤害 +1）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { discardSelf: true },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { combatBonus: 3, damageBonus: 1 })
      },
    },
  ],
}
