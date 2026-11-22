// 12005 侦探的直觉（Detective's Intuition）· 探求者 · 事件/洞察 · 0 资源。（乔·戴蒙德签名卡）
//
// 卡面：乔·戴蒙德牌库专用。
//   获得 2 资源，并治愈 1 点伤害或 1 点恐惧。
//   [reaction] 你在自己回合期间抽取侦探的直觉后：将其揭示并抽取额外 2 张卡牌。
//
// 引擎读点：
//   · 打出效果（played 描述子）：api.gainResources + api.healDamage/api.healHorror。
//   · 「抽到后」：`cardDrawn` 窗口（deck-ops.js 每次非弱点抽牌后开窗，context 带 cardCode）；
//     手牌里的反应描述子用 fromHand + noPlayCost（不打出、不付费，只作在手的触发）——
//     与 05023/07194 的「离开手牌生效」写法同源。读点是 openAbilityWindow 的手牌来源枚举。

const code = '12005'

export default {
  code,
  abilities: [
    {
      kind: 'played',
      label: '获得 2 资源，并治愈 1 点伤害或 1 点恐惧',
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 2)
        const canHealDamage = (inv.damage || 0) > 0
        const canHealHorror = (inv.horror || 0) > 0
        let choice = 'damage'
        if (canHealDamage && canHealHorror) {
          choice = api.choice({
            kind: 'effect', source: code, seat: inv.seat,
            prompt: '「侦探的直觉」：治愈 1 点伤害还是 1 点恐惧？',
            options: [{ id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
          })
        } else if (!canHealDamage && canHealHorror) {
          choice = 'horror'
        }
        if (choice === 'horror') api.healHorror(inv.seat, 1)
        else api.healDamage(inv.seat, 1)
      },
    },
    {
      kind: 'reaction',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      // 「每次抽到这张卡只结算一次」：反应窗口在结算后会重新枚举候选，无费用的反应需要
      // perWindow 显式限次，否则同一抽牌窗口会被反复询问。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '你回合期间抽到本卡后：揭示并额外抽 2 张牌',
      criteria: [({ state, inv, context }) => context?.cardCode === code
        && state.currentSeat === inv.seat],
      resolve: ({ inv, api }) => {
        api.info(`🧠 ${inv.name} 揭示了「${api.cardName(code)}」，额外抽取 2 张卡牌。`)
        api.drawCards(inv.seat, 2)
      },
    },
  ],
  modifiers: [],
}
