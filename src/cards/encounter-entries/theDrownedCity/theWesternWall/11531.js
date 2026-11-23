// 11531 海底壁画[tdc_rune_w] · 诡计（西墙，放一边）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：显现 - 将海底壁画[tdc_rune_w]附属到你所在地点。不能取消。
//       海底壁画[tdc_rune_w]不能离场。
//       [action]：检定[combat](2)，然后检定[willpower](2)。如果你两次检定均成功，
//       将本卡牌翻面并结算其文本（→ 11531b：符文 W = “寄生虫”，加入胜利区）。
// 印刷：特性 [[Evidence]][[Glyph]]；双面（背面 11531b）。
// 读点：encounterResolve 用 api.attachToLocation 附属（唯一写入口；不直接写 location 字段）；
//       behavior.actions/performAction 的 twwSeafloorFrieze 读 flags.friezeAction 做两次检定与翻面结算；
//       cannotLeavePlay 为引擎读点。
export default {
  code: '11531',
  scope: 'treachery',
  implemented: true,
  flags: { friezeAction: true, storyCode: '11531b' },
  cannotLeavePlay: true,
  cannotBeCanceledRevelation: true,
  encounterResolve(state, inv, card, api) {
    const locationId = inv?.location
    if (!locationId) return false
    const location = (state.locations || []).find(item => item.id === locationId)
    if (!location) return false
    const already = (location.attachments || [])
      .some(attachment => String(attachment.originalCode || attachment.code) === '11531')
    if (already) return false
    if (typeof api?.attachToLocation !== 'function') {
      api?.info?.('「海底壁画」：当前上下文缺少 attachToLocation，未附属。')
      return false
    }
    api.attachToLocation(locationId, {
      id: `11531:${locationId}`, code: '11531', originalCode: '11531',
      name: card?.name || '海底壁画', cannotLeavePlay: true,
    })
    api?.info?.('「海底壁画」附属到当前地点（不能取消、不能离场）。')
    return true
  },
  note: '数据型条目：显现附属由 encounterResolve 经 api.attachToLocation 实现（附属实例同样带 cannotLeavePlay）；'
    + '两次检定的翻面行动由 behavior.twwSeafloorFrieze 实现。'
    + '「显现不能取消」已接 cannotBeCanceledRevelation（treachery-tokens.js / encounter.js 取消窗口既有读点）。'
    + '「不能离场」已接引擎读点 cannotLeavePlay：scenario-decks.js#encounterCardCannotLeavePlay，'
    + 'detachEncounterAttachment / detachEncounterAttachmentById / discardEncounterAttachment 统一拒绝；'
    + '背面 11531b 不声明，可正常离场。',
  abilities: [],
}
