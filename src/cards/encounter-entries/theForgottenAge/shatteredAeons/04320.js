// 04320 伊斯人的遗物
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：[action]：查找你的牌库和弃牌堆，找出古代遗物并将它加入你的手牌。混洗你的牌库。
// 卡面：[action]如果古代遗物附属到你所在地，且该地点上没有线索：控制古代遗物。
// 卡面：目标 - 如果有调查员控制古代遗物，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04320「伊斯人的遗物」背面：敌人身份生成 + 启用「遗物离场 → 重置到 3a」。

export default {
  code: '04320', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      const flags = hooks.flags()
      flags.relicGuard = true
      flags.relicWasControlled = !!hooks.relicControlledBy()
      if (hooks.records().ichtacaIsSetAgainstYou) {
        hooks.removeFromSetAside(hooks.ichtaca())
        const nexus = hooks.byId(hooks.nexus())
        if (nexus) api.spawn(hooks.ichtaca(), nexus.id)
      }
      if (hooks.records().alejandroIsSetAgainstYou) {
        hooks.removeFromSetAside(hooks.alejandro())
        const pocket = hooks.byId(hooks.pocket())
        if (pocket) api.spawn(hooks.alejandro(), pocket.id)
      }
      api.info?.('📜 若古代遗物因任何原因离场：把它附属的地点洗回探索牌库，并将场景重置到 3a。')
    },
  },
}
