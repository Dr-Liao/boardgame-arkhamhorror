// 08504 危险道路（Treacherous Path） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：强制 - 你在危险道路的技能检定期间揭示[frost]混乱标记后：每揭示一个[frost]标记，受到 1 点伤害或恐惧。庇护 1。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08504'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 1, campCandidate: true },
  abilities: [{
    kind: 'forced', trigger: 'tokenReveal',
    label: '危险道路：揭示 [frost] 后受到 1 点伤害或 1 点恐惧',
    criteria: ({ state, source, inv, context }) => context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && state.investigators?.[state.skillTest?.seat]?.location === source.id,
    resolve: ({ inv, api }) => {
      const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '危险道路：受到 1 点伤害，或 1 点恐惧？',
        options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }] })
      if (pick === 'horror') api.horror(inv.seat, 1)
      else api.damage(inv.seat, 1)
    },
  }],
}


