// 04094 一片漆黑
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：ruins
// 卡面：显现 - 将一片漆黑放置入场，放在密谋牌库旁。
// 卡面：每位调查员每轮不能从单个地点发现超过1个线索。
// 卡面：强制 - 当一轮结束时：从场上弃掉1张一片漆黑。(每轮最多一次。)
//
// 读点：
//   · 「放在密谋牌库旁」= api.putNextToAgenda（state.agendaAside 唯一写入口）；
//     encounterResolve 返回 { placed: true } 阻止这张牌结算后进遭遇弃牌堆。
//   · 线索上限 = 条目声明的 treacheryRule.clueDiscoveryLimit，引擎在
//     src/engine/locations.js 的 canDiscoverClueAt / discoverClueAt 两处按旁置卡声明通用记账
//     （键不按卡号分支，同一卡号多张不叠加）。
//   · 轮末弃 1 张 = 条目声明的 treacheryRule.discardOneAtRoundEnd，引擎 phases.js 的
//     旁置卡轮末扫描负责（与印斯茅斯 07095/07107、07185 同一套原语）。
//   · 旧存档的 scenarioFlags.deepDark 计数由 The Forgotten Age 的 encounter-rules.js
//     save repair 补成真实旁置实例。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
const CODE = '04094'

export default {
  code: CODE, implemented: true, scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda(CODE)
    api.info?.('一片漆黑被放在密谋牌库旁：每位调查员每轮从单个地点最多发现 1 个线索。')
    return { placed: true }
  },
  treacheryRule: { discardOneAtRoundEnd: true, clueDiscoveryLimit: 1 },
}
