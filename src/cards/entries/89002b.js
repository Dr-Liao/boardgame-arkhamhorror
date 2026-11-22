// 89002b 饥肠辘辘 · 失控饥饿（Ravenous · Uncontrolled Hunger）· 中立 · 支援/缺陷 · 永久 · 5U-21 签名弱点。
//
// 卡面（cards-data 89002b）：
//   Subject 5U-21 deck only. Permanent.
//   Each time you devour a card, set it aside, out of play. You get +1 to each of your skills for
//   each card beneath Ravenous (max +5).
//   Forced - At the end of your turn: Devour a non-story card beneath Ravenous or controlled by an
//   investigator at your location. If there is nothing beneath Ravenous, flip it over.
//
// 引擎读点：
//   · 技能修正：与 89002 相同（读 `state.scenarioFlags.mechanics.beneath[seat][asset.id]`；
//     近似：本 Mod 没有「放在一边、场外」独立区域，两面共用同一宿主下方容器）。
//   · 回合结束强制：`turnEnded` 窗口（windows.js）；若下方无卡 → `api.flipAsset(source, '89002')`
//     翻回可控面。若有卡，「每回合吞噬一张下方/在场的非剧情卡」在本近似下不改变计数
//     （吞噬目标仍是同一容器），只记录日志 → 已在 primitive-requests/core-inv-89002-ravenous-devour.json
//     请求真正的「set aside 场外区 + 失控面回合末吞噬」。

const code = '89002b'
const beneathCount = (state, owner, hostId) => (state?.scenarioFlags?.mechanics?.beneath?.[owner?.seat]?.[hostId] || []).length

export default {
  code,
  modifiers: [
    {
      target: 'skill:*',
      amount: ({ state, inv, controller, source }) => {
        const owner = inv || controller
        if (!owner || !source?.id) return 0
        return Math.min(5, beneathCount(state, owner, source.id))
      },
    },
  ],
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnEnded',
      label: '你的回合结束时：若下方没有卡牌，翻回可控饥饿',
      criteria: ({ state, inv, source, context }) => Boolean(source?.id)
        && context?.seat === inv.seat
        && beneathCount(state, inv, source.id) === 0,
      resolve: ({ source, api }) => {
        api.flipAsset(source, '89002')
        api.info('「饥肠辘辘（失控饥饿）」下方没有卡牌，翻回「可控饥饿」。')
      },
    },
  ],
  note: '近似：两面共用宿主下方容器（无「放在一边」独立区域）；失控面回合末「吞噬下方/在场卡」在本近似下不改变计数（待 core-inv-89002-ravenous-devour.json）。',
}
