// 10603 地层扰动 · 诡计（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[危险]]。显现 - 检定[intellect]或[agility](4)。你检定失败且每低于难度 1 点，
//   你必须受到 1 点伤害，或在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。
//
// 一张卡一个文件：显现交给章节 behavior.events.depthsGroundDisturbance（检定技能二选一、
// 逐失败点二选一、放渗坑），本条目只留身份/数值标记。
export default {
  code: '10603',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    test: { skills: ['intellect', 'agility'], difficulty: 4 },
    failByChoice: ['damage', 'sinkhole'],
  },
  encounterResolve(state, inv, card, api) {
    void state
    void card
    api.resolveScenarioEvent('depthsGroundDisturbance', { seat: inv.seat })
    // 返回 false：显现结算完成后由引擎放进遭遇弃牌堆。
    return false
  },
  note: '显现的执行在 behavior.groundDisturbanceResolve（引擎没有「二选一技能」的声明式检定字段）。',
}
