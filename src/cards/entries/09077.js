// 09077 地下市场（Underworld Market）· 游荡者支援 · 2 经验 · 永久 / 卓越。
// 卡面：永久。卓越。你得到牌库卡牌张数 +10。
//       [reaction] 你在抽取起始手牌前，选择自己牌库里的 10 张[[违法]]卡牌：将其混洗，放在地下市场旁，
//       作为你的市场牌库。
//       [reaction] 当你回合开始时：揭示你市场牌库顶的 2 张卡牌。你可以花费 1 资源以抽取其中 1 张。
//       将其余卡牌以任意顺序放回市场牌库底。
//
// 读点：牌库 +10 走构筑层 deckConstruction.sizeBonus（与 06167/07303/08031 同一读点）；
// 每回合开始走 turnBegins 反应 + api.lookAt（choose/returnStrategy:'bottom'）。
//
// approximation（已写 primitive-request/09077.json）：
//   · 引擎没有「市场牌库」这一额外牌库容器，也没有「起始手牌前选择 10 张」的构筑/开局读点；
//     这里用玩家牌库顶 2 张近似「市场牌库顶 2 张」，其余按要求放回牌库底。
//   · 起始手牌前的 10 张[[违法]]选择不落地（不影响每回合主能力的可玩性）。
export default {
  code: '09077',
  simplified: true,
  note: 'approximation: 见 primitive-request/09077.json（市场牌库与起始手牌前选 10 张未实现，每回合用牌库顶 2 张近似）',
  deckConstruction: { sizeBonus: 10 },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      label: '回合开始时：揭示牌库顶 2 张，可花 1 资源抽 1 张，其余放回牌库底（市场牌库近似）',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ state, inv, api }) => {
        const owner = state.investigators[inv.seat]
        const deck = owner?.deck || []
        if (!deck.length) {
          api.info('「地下市场」：牌库是空的。')
          return
        }
        const count = Math.min(2, deck.length)
        const top = deck.slice(-count)
        api.info(`🕯️ 「地下市场」：揭示牌库顶的 ${top.map(code => `「${api.cardName(code)}」`).join('、')}。`)
        const answer = api.choice({
          kind: 'reaction', source: '09077', seat: inv.seat, canSkip: true,
          prompt: '是否花费 1 资源，抽取其中 1 张？',
          options: [{ id: 'spend', label: '花费 1 资源抽取 1 张' }, { id: 'skip', label: '不抽取' }],
        })
        if (answer === 'spend' && (owner.resources || 0) >= 1) {
          api.spendResources(inv.seat, 1)
          api.lookAt(inv.seat, {
            zone: 'deck', count, choose: 1, optional: false, returnStrategy: 'bottom',
            source: '09077', prompt: '选择要加入手牌的 1 张，其余放回牌库底。',
          })
          api.info('🕯️ 「地下市场」：花费 1 资源抽取了 1 张牌。')
          return
        }
        api.lookAt(inv.seat, { zone: 'deck', count, choose: 0, returnStrategy: 'bottom', source: '09077' })
      },
    },
  ],
  modifiers: [],
}
