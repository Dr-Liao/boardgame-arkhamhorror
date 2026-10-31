// 06154 奇妙平原（theSearchForKadath）· 诡计（力量，印刷 2 张）
// 卡面：显现 - 如果你所在地点没有线索，弃掉奇妙平原，其获得涌动。否则，将奇妙平原附属到你所在地点。
// 卡面：附属地点的隐藏值-2。
// 卡面：强制 - 在你成功调查附属的地点后：受到1点恐惧，在当前密谋上放置1个毁灭标记，
//       并弃掉奇妙平原。本效果能导致当前密谋推进。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的 locationShroudModifier（-2）、
// afterTest（成功调查后的强制）读取并接线。
export default {
  code: '06154', scope: 'treachery', implemented: true,
  treacheryRule: {
    attachedToLocation: true,
    shroudModifier: -2,
    afterInvestigateSuccess: { horror: 1, doom: 1, discard: true },
  },
  encounterResolve(state, inv, card, api) {
    const location = (state.locations || []).find(item => item.id === inv?.location)
    if (!location || (location.clues || 0) === 0) {
      api.info?.('🌾 「奇妙平原」：此地点没有线索，弃掉本卡并获得涌动（再抽 1 张遭遇卡）。')
      api.drawEncounter?.(inv.seat)
      return false
    }
    api.attachEncounterToLocation?.('06154', location.id)
    api.info?.('🌾 「奇妙平原」附属到当前地点（隐藏值 -2）。')
    return true
  },
}
