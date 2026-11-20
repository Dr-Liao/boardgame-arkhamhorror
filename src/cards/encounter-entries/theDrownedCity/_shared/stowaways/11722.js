// 11722 感染！（Infected!）· 诡计 · 共享遭遇组 stowaways（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/stowaways。
// 卡面（cards-data 11722）：
//   显现 - 将感染！放置入场，位于你的威胁区。每位调查员限1张。
//   强制 - 你在有另一位调查员或一名[[偷渡者]]敌人的地点结束回合后：在感染！上放置1个毁灭标记。
//   [action]：检定[willpower](3)。如果你失败，受到1点伤害。如果你成功，弃掉感染！
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat（scenario-runtime 的唯一威胁区写入口），treacheryRule.threatArea
//     与 FHV/TSK 同类卡同款；重复副本按「每位调查员限 1 张」在显现时判重后交给引擎弃置；
//   · 「你的回合结束后」= turnEnded 窗口（turn-flow.js 的唯一派发点，context 带 seat/location）；
//   · 放毁灭 = api.doomOn（placeDoomOnCard 的唯一包装）；
//   · 摆脱行动 [action] = 威胁区条目的 action 描述子（moves.js 用 controlledAbilityCards 枚举威胁区
//     行动）；检定 api.test + 失败 api.damage / 成功 api.removeThreat（威胁区卡的唯一弃置写入口）。
const CODE = '11722'
const DIFFICULTY = 3

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  name: '感染！',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Hazard'],
    quantity: 3,
    limitPerInvestigator: 1,
    test: { skill: 'willpower', difficulty: DIFFICULTY },
    turnEndDoom: 1,
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🦠 「感染！」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🦠 「感染！」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'turnEnded',
    silent: true,
    label: '你在有另一位调查员或偷渡者敌人的地点结束回合：在感染！上放 1 毁灭',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      if (!holder || context?.seat !== holder.seat) return false
      const here = state.locations?.find(location => location.id === holder.location)
      if (!here) return false
      const anotherInvestigator = (state.investigators || []).some(other =>
        other !== holder && !other.defeated && !other.resigned && other.location === here.id)
      const stowaway = (state.enemies || []).some(enemy => enemy.location === here.id
        && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'stowaway'))
      return anotherInvestigator || stowaway
    },
    resolve: ({ state, source, api }) => {
      const holder = holderOf(state, source)
      if (!holder) return
      api.doomOn?.(source, 1)
      api.info?.(`🦠 「感染！」：${holder.name} 在危险地点结束回合，卡上放置 1 个毁灭标记（当前 ${source.doom || 0}）。`)
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    label: '[action] 意志(3)：失败受到 1 点伤害；成功弃掉感染！',
    criteria: ({ state, source }) => Boolean(holderOf(state, source)),
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', DIFFICULTY, {
        source: { type: 'encounter', code: CODE, name: '感染！', label: '摆脱检定' },
        resolve: result => {
          if (!result?.success) {
            api.damage(inv.seat, 1)
            api.info?.(`🦠 「感染！」：${inv.name} 检定失败，受到 1 点伤害。`)
            return
          }
          api.removeThreat?.(source)
          api.info?.(`🦠 「感染！」：${inv.name} 检定成功，弃掉「感染！」。`)
        },
      })
    },
  }],
  note: '威胁区入场/判重/回合结束放毁灭/摆脱行动全部走既有 api 与窗口：api.threat、turnEnded、'
    + 'api.doomOn、action 描述子 + api.test + api.damage/api.removeThreat。「每位调查员限 1 张」在显现时判重，'
    + '重复副本直接交给引擎弃置。',
}
