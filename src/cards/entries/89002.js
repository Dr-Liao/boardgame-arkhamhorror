// 89002 饥肠辘辘 · 可控饥饿（Ravenous · Controlled Hunger）· 中立 · 支援/才能 · 永久 · 5U-21 签名弱点。
//
// 卡面（cards-data 89002）：
//   Subject 5U-21 deck only. Permanent.
//   Each time you devour a card, place it facedown beneath Ravenous. You get +1 to each of your
//   skills for each card beneath Ravenous (max +5).
//   Forced - If there are 5 or more cards beneath Ravenous: Flip it over.
//
// 引擎读点：
//   · 技能修正：`modifiers` target `skill:*`，数量读「宿主下方容器」——
//     `state.scenarioFlags.mechanics.beneath[seat][asset.id]`（09089 束敌宝罐的 modifiers/criteria 同款
//     读点；本 Mod 的宿主下方牌共用这一份 storage，见 commit-origins.js）。
//   · 翻面：`api.flipAsset(asset, '89002b')`（api-misc.js 物理面翻转读点；89002b 卡面数据在 cards-data）。
//   · 「5 张以上立即翻面」：没有「每次吞噬后」的卡级强制窗口，用 `phaseBegins` 兜底检查（近似：最多
//     延迟到下一个阶段开始才翻面）→ 已在 primitive-requests/core-inv-89002-ravenous-devour.json
//     请求「吞噬后立即结算」的读点。

const code = '89002'
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
      trigger: 'phaseBegins',
      label: '饥肠辘辘下方有 5 张以上卡牌时翻面',
      criteria: ({ state, inv, source }) => Boolean(source?.id) && beneathCount(state, inv, source.id) >= 5,
      resolve: ({ source, api }) => {
        api.flipAsset(source, '89002b')
        api.info('「饥肠辘辘」下方已有 5 张以上卡牌，翻转为「失控饥饿」。')
      },
    },
  ],
  note: '近似：5 张翻面用 phaseBegins 兜底（应在吞噬后立即结算，待 core-inv-89002-ravenous-devour.json）；技能修正读宿主下方容器。',
}
