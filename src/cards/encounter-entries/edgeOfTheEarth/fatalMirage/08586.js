// 08586 回首往事
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 显现二选一：受 2 伤害，或在当前密谋上放 1 毁灭（可导致推进）。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08586',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { chooseOne: ['take2Damage', 'place1DoomOnAgenda'] },
  flags: { peril: true, terror: true },
}
