// 05340 虚空之路
// 宇宙 -：与任意方向连接（behavior.placeCosmosLocation 按 definition 指令表执行）。
// 进入时强制：弃掉 1 张手牌，或受到 1 点伤害。引擎直读 locationRule.onEnter.effect。
export default {
  code: '05340',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        const options = []
        if ((inv.hand || []).length) options.push({ id: 'discard', label: '弃掉 1 张手牌' })
        options.push({ id: 'damage', label: '受到 1 点伤害' })
        const answer = api.choose({
          kind: 'location', source: location.id, seat: inv.seat,
          prompt: '进入虚空之路：弃掉 1 张手牌，或受到 1 点伤害。', options,
        })
        if (answer === 'discard' && (inv.hand || []).length) {
          let index = 0
          const picked = api.choose({
            kind: 'card', source: location.id, seat: inv.seat, prompt: '选择并弃掉 1 张手牌。',
            options: inv.hand.map((code, position) => ({ id: String(position), label: code })),
          })
          const parsed = Number(picked)
          if (Number.isInteger(parsed) && parsed >= 0 && parsed < inv.hand.length) index = parsed
          const [code] = inv.hand.splice(index, 1)
          ;(inv.discard ||= []).push(code)
        } else {
          api.damage(inv.seat, 1)
        }
      },
    },
  },
}