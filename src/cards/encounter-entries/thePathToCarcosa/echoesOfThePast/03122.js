// 03122 洗劫宅邸
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：跳过神话阶段的“在当前密谋上放置1个毁灭标记”步骤。(FAQ，v1.2)
// 卡面：强制 - 有1点或以上线索放置到场上的敌人后：将这些线索翻至其毁灭标记面。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03122', scope: 'agenda', doomPerInvestigator: true, doomPerInvestigatorAmount: 2, skipMythosDoom: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      api.spawn('03140', 'entryHall')
      const records = state.campaign.records || {}
      if (!(records.vipsSlain || []).includes('03068')) api.spawn('03068b', 'entryHall')
    },
  },
}
