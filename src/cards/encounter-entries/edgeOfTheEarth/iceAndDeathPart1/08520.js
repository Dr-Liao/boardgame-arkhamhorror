// 08520 没时间了（Running Out of Time）· 议程 3
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart1（theCrash 组）。
// 正面强制：第一次进入地点后放置相连的放一边地点（与议程 1 同一条强制）。
// 背面：每位调查员（含已退场）把忒咳哩-哩牌库顶 1 张洗入自己牌库；选择场上一个没有线索的地点，
//       每位未被击败的调查员移动到该地点并立即撤退（庇护值越高越好）；结算结局 1。
// 读点：behavior.resolveAgendaBack → resolveRunningOutOfTimeBack。
export default {
  code: '08520',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    stage: 3,
    chapterFlow: 'runningOutOfTime',
    locationEntered: 'placeConnectedSetAsideLocations',
    onAdvance: 'resolveRunningOutOfTimeBack',
  },
}
