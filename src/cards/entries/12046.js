// 12046 奥利维尔·毕晓普（Olivier Bishop, Haughty Art "Collector"）· 资产 · 游荡者 0 经验 · 盟友槽
// 卡面：你得到+1[agility]。
// 卡面：[fast]你的回合期间，横置奥利维尔·毕晓普：移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/OlivierBishopHaughtyArtCollector.hs
//   （controllerGets [SkillModifier #agility 1]；
//    freeTrigger (exhaust a)：getConnectedMoveLocations → chooseOrRunOneM (moveTo …)）。
// 读点：modifiers 的 skill:agility +1（stats 被动管线）；[fast] = kind:action + cost.action:false
//   （legalMoves 在本人回合枚举，不消耗行动点）→ resolve 选合法连接地点后 api.moveInvestigator。
export default {
  code: '12046',
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [
    {
      kind: 'action',
      label: '横置：移动到一个连接地点',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const destinations = (here?.connections || [])
          .map(id => state.locations.find(location => location.id === id))
          .filter(location => location)
        if (!destinations.length) { api.info('这里没有可移动到的连接地点。'); return }
        const destination = destinations.length === 1 ? destinations[0].id : api.choice({
          kind: 'move', source: '12046', seat: inv.seat, prompt: '选择要移动到的连接地点。',
          options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        api.moveInvestigator(inv.seat, destination)
        api.info(`${inv.name} 横置奥利维尔·毕晓普，移动到「${api.locName(destination)}」。`)
      },
    },
  ],
}
