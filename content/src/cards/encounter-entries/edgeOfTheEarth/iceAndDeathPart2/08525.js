// 08525 疯狂与死亡（Madness and Death）· 议程 6 · 议程
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// 背面：剩下的每位调查员被击败并承受 1 点精神创伤，然后结算结局 1（behavior.agendaAdvance）。
export default {
  code: '08525',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    chapterFlow: 'madnessAndDeath',
    onAdvance: 'defeatRemainingAndResolve',
  },
}
