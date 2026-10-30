// 03091 卡尔克萨尖柱
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：evil_portents
// 卡面：显现 - 附属到你所在地点，然后在该地点上放置2个毁灭标记。
// 卡面：如果附属地点上没有毁灭标记，弃掉卡尔克萨尖柱。
// 卡面：[action]：调查。如果你检定成功，不发现此处的线索，改为从附属地点上移除1个毁灭标记。
// 这是一次真正的调查（地点没有线索也能做；放大镜等调查加值生效），成功改为移除毁灭。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03091', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  treacheryRule: {
    attachmentAction(state, inv, location, attachmentIndex) {
      return {
        action: 'encounterAction', actionKind: 'investigate', rule: 'clearSpiresOfCarcosa',
        locationId: location.id, attachmentIndex, actions: 1,
        label: '🔍 调查卡尔克萨尖柱：成功后不发现线索，改为移除 1 个毁灭',
        reason: (location.doom || 0) > 0 ? null : '此地点上没有毁灭',
      }
    },
  },
  encounterResolve(state, inv, card, api, { location }) {
    location.doom = (location.doom || 0) + 2
    location.attachments ||= []
    location.attachments.push({
      id: `spires:${state.round}:${state.moveCount}:${location.attachments.length}`,
      code: '03091', originalCode: '03091',
    })
    return true
  },
}
