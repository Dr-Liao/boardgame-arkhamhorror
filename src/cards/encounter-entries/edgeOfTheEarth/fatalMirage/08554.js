// 08554 旧事阴影（版本二）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 目标：直面内心恶魔（通过把记忆剧情卡放入胜利区推进）；可多次重入。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08554',
  scope: 'act',
  implemented: true,
  actRule: {},
  flags: { version: 2, actVersion: true, repeatable: true },
}
