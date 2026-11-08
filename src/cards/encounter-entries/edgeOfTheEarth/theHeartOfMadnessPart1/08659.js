// 08659 跳动的心脏（The Beating Heart）· 议程 1
// 卡面：强制 - 如果两名或更多激活封印被同一地点的调查员控制：静电爆炸毁灭一切（→R3）。
// 背面：阅读战役指南的幕间「最后一根稻草」。读点：forced 由章节 behavior.checkObjectives /
// performAction 统一检查（封印记账在 src/campaign/eote-seals.js），本条目只声明数据与幕间记录。
export default {
  code: '08659',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    detonation: true,
    onLeave(state, agenda, api) {
      api.setScenarioFlag?.('interlude', 'theFinalStraw')
      api.info?.('🫀 跳动的心脏：阅读幕间「最后一根稻草」。')
    },
  },
  flags: { detonation: true },
}
