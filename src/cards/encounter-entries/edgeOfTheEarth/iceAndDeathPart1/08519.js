// 08519 深入白雪（Into the White）· 议程 2
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart1（theCrash 组）。
// 正面强制：第一次进入地点后放置相连的放一边地点（与议程 1 同一条强制）。
// 背面：将放在一边的星之恐怖生成在已揭示且庇护值最高的地点。
// 读点：behavior.resolveAgendaBack → resolveIntoTheWhiteBack。
export default {
  code: '08519',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    stage: 2,
    chapterFlow: 'intoTheWhite',
    locationEntered: 'placeConnectedSetAsideLocations',
    onAdvance: 'resolveIntoTheWhiteBack',
  },
}
