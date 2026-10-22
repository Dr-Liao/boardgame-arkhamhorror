// 04315 时间之线
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：强制 - 如果一位手牌、牌库、弃牌堆或游戏区域内有古代遗物的调查员退场：立即推进到密谋3b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 密谋 04315「时间之线」背面：无形之子在恩凯联结点现身，本密谋进胜利区并获得复仇 1。

export default {
  code: '04315', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api, hooks) {
      api.shuffleDiscard()
      hooks.removeFromSetAside(hooks.formlessSpawn())
      const nexus = hooks.byId(hooks.nexus())
      if (nexus) api.spawn(hooks.formlessSpawn(), nexus.id)
      hooks.addToVictory(agenda, { vengeance: 1 })
      api.info?.('🌑 无形之子在恩凯联结点现身；本密谋进入胜利区并获得复仇 1。')
    },
  },
}
