// 06069 阻止爆发（Containing the Outbreak）· 幕 3
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 正面：每个蛛巢地点获得：「[action]：检定意志(X) 以尝试封印裂隙。X 为该地点的帷幕。
//   位于该地点的调查员可以作为一个团队花费 1×人数线索来自动成功。若你成功，
//   把该地点上的伤害标记替换为恐惧标记。本局余下时间，该地点不能再被寄生。」
//   目标 - 若场上没有蛛巢地点，推进。
// 背面：检查战役日志：马赫斯瓦兰医生加入调查且本局结束时在场 → 结局 1；
//   加入但不在场 → 结局 2；留在病人身边 → 结局 3。
// 读点：grantSealRiftAction 由章节 behavior.actions/performAction 读取（当前幕条目数据）；
//   objective 数据由 behavior.checkObjectives 读取；背面 agendaRule → actRule.onReveal（behavior.actReveal 分派）。
const CODE = '06069'

function maheswaranInPlay(state) {
  if ((state.storyAssets || []).some(asset => (asset.originalCode || asset.code) === '06080')) return true
  return (state.investigators || []).some(inv => (inv.assets || []).some(asset => (asset.originalCode || asset.code) === '06080'))
}

export default {
  code: CODE,
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'noInfestedLocations' },
    grantSealRiftAction: true,
    onReveal(state, act, api) {
      const joined = state.campaign?.records?.drMaheswaranJoinedTheInvestigation === true
      let key = 'resolution3'
      if (joined) key = maheswaranInPlay(state) ? 'resolution1' : 'resolution2'
      api.info?.(joined
        ? (key === 'resolution1'
          ? '🩺 马赫斯瓦兰医生与你们一同离开医院（→结局 1）。'
          : '🩺 马赫斯瓦兰医生不知所踪（→结局 2）。')
        : '🩺 马赫斯瓦兰医生留在病人身边（→结局 3）。')
      api.finish?.(key)
      return true
    },
  },
}
