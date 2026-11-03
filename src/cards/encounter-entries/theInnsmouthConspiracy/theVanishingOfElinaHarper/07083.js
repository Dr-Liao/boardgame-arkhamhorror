// 艾莲娜·哈珀：免费能力不算行动；仅本回合第一次实际行动免除借机攻击。
export default {
  code: '07083', scope: 'storyAsset', implemented: true, trackActionHistory: true,
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
    { target: 'skill:agility', amount: 1 },
    { target: 'ignore:opportunityAttack', amount: 1, condition: { when: ({ state, inv }) => {
      const history = inv.actionHistory
      return history?.turn !== state.turnSerial || history.entries.length === 0
    } } },
  ],
}
