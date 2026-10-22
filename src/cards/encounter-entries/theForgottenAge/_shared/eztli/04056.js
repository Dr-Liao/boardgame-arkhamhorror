// 04056 神庙看守者
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：eztli
// 卡面：*本密谋得到+1[per_investigator]毁灭阀值。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04056', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, 'both')
    },
  },
  // 第 120 轮：时间倒流版本（无结局 = 时间之布被拆解）。
  agendaRuleByScenario: {
    turnBackTime: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, null)
        if (state.status === 'playing') api.finish('noResolution')
      },
    },
  },
}
