// 08585 易散之雾
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 显现：附属到尚未破除幻景的最近地点并放 2 线索；翻面需共同花 2 线索或各受 2 伤害；地点破除幻景后弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08585',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { attachToNearestUnflippedLocation: true },
  flags: { attachLocationClues: 2, hazard: true, curse: true, discardWhenLocationFlipped: true },
}
