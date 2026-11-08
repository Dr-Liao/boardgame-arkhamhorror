// 08552 虚灵纠缠（版本三）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 版本选择由 behavior.fatalMirageVersion / agendaCodeForVersion 决定。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08552',
  scope: 'agenda',
  implemented: true,
  agendaRule: { freeMoveToPrisonOfMemories: { cost: { horror: 1 } } },
  flags: { version: 3, agendaVersion: true },
}
