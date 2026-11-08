// 08545 冰雪深处
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart3（P7 亡命冰原 III）。
// 第二张密谋；推进/毁灭值由 definition 的 stage() 从印刷卡取。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08545',
  scope: 'agenda',
  implemented: true,
  agendaRule: {},
  flags: { deeperIce: true },
}
