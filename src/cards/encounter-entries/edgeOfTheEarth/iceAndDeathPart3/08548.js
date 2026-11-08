// 08548 千变幻景
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart3（P7 亡命冰原 III）。
// behavior/遭遇结算读点：无渗出梦魇时获得涌动，否则翻出其底下 1 张或让其移动并攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08548',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { spawnBeneathOrHunterAttack: true },
  flags: { surgeIfNoSeepingNightmare: true, curse: true },
}
