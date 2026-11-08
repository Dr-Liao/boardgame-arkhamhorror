// 08544 邪灵现身
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart3（P7 亡命冰原 III）。
// behavior.agendaWouldAdvance 读点（章节 behavior 分派）。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08544',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    // 强制：密谋将要推进时，若渗出梦魇底下有正面朝下的卡牌：不推进，改为移除 2 毁灭并随机翻出 1 张。
    forcedAdvanceHold: true,
    removeDoomOnHold: 2,
    spawnFromBeneath: 1,
  },
  flags: { seepingNightmareAdvance: true },
}
