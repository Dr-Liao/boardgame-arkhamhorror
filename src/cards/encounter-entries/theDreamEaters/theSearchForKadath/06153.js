// 06153 麦格鸟之歌（theSearchForKadath）· 诡计（诅咒，印刷 2 张）
// 卡面：显现 - 附属到你所在地点。
// 卡面：强制 - 在你移动离开其附属的地点后：受到1点恐惧，在当前密谋上放置1个毁灭标记，
//       并弃掉麦格鸟之歌。本效果能导致当前密谋推进。
// 卡面：[action]：检定[willpower](4)来抵御呼唤，或检定[combat](4)来赶走鸟群。若成功，弃掉本卡。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的 locationLeft（强制）、
// locationShroudModifier 不需要，actions/performAction（摆脱行动）读取并接线。
export default {
  code: '06153', scope: 'treachery', implemented: true,
  treacheryRule: {
    attachedToLocation: true,
    // 离开附属地点后的强制；behavior.locationLeft 读取。
    afterLeave: { horror: 1, doom: 1, discard: true },
    // 附属地点的 [action]：检定意志(4)或战斗(4)，成功弃掉；behavior.actions/performAction 读取。
    attachedAction: {
      rule: 'magahBirdResist',
      skills: ['willpower', 'combat'],
      difficulty: 4,
      label: '🐦 麦格鸟之歌：检定意志(4)或战斗(4)赶走鸟群（成功弃掉本卡）',
    },
  },
  encounterResolve(state, inv, card, api) {
    const location = (state.locations || []).find(item => item.id === inv?.location)
    if (!location) return false
    api.attachEncounterToLocation?.('06153', location.id)
    api.info?.('🐦 「麦格鸟之歌」附属到当前地点。')
    return true
  },
}
