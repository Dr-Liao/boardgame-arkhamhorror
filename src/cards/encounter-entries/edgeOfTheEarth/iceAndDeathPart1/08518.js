// 08518 冷遇（Cold Welcome）· 议程 1
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart1（theCrash 组）。
// 正面强制：调查员第一次进入一个地点后，把放在一边的地点中所有与该地点相连的地点放置入场。
// 背面：在队长所在地点生成一个疾行谬物；其余疾行谬物 + 冰中生物组洗入遭遇牌库。
// 读点：definition 的本次议程 `chapterFlow`；behavior.resolveAgendaBack 按 flow 分派到
// placeConnectedSetAsideLocations / resolveColdWelcomeBack（本条目只声明规则数据）。
export default {
  code: '08518',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    stage: 1,
    chapterFlow: 'coldWelcome',
    locationEntered: 'placeConnectedSetAsideLocations',
    onAdvance: 'resolveColdWelcomeBack',
  },
}
