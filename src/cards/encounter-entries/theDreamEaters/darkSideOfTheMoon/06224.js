// 06224 剧情支援「维吉尔·格雷」（Virgil Gray · 文思泉涌）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [reaction] 你的警报等级提高后：抽取 1 张卡牌，获得 1 资源，或治愈维吉尔·格雷的 1 点恐惧。
// 如果游戏中有超过 1 位调查员，将维吉尔·格雷的控制权交给另一位调查员。
// 强制 - 如果维吉尔·格雷离场：将他从游戏中移除。
export default {
  code: '06224',
  scope: 'storyAsset',
  implemented: true,
  removeFromGameOnLeave: true,
  abilities: [{
    kind: 'reaction',
    trigger: 'afterAlarmRaised',
    label: '抽 1 张牌、获得 1 资源，或治愈维吉尔 1 点恐惧；然后转交控制权',
    limit: { scope: 'perWindow', owner: 'group' },
    criteria: [({ inv, context, source, helpers }) =>
      context?.counterId === 'alarmLevel' && context?.seat === inv.seat && Number(context?.delta) > 0
      && (helpers.canDrawCards() || helpers.canGainResources() || Number(source?.horror || 0) > 0)],
    resolve: ({ state, inv, source, api }) => {
      const options = []
      if (api.canDrawCards(inv.seat)) options.push({ id: 'draw', label: '抽 1 张牌' })
      if (api.canGainResources(inv.seat)) options.push({ id: 'resource', label: '获得 1 资源' })
      if (Number(source?.horror || 0) > 0) options.push({ id: 'heal', label: '治愈维吉尔·格雷的 1 点恐惧' })
      const answer = api.choice({
        kind: 'card', source: source.id, seat: inv.seat,
        prompt: '维吉尔·格雷：选择警报等级提高后的奖励。', options,
      })
      if (answer === 'draw') api.drawCards(inv.seat, 1)
      else if (answer === 'resource') api.gainResources(inv.seat, 1)
      else if (answer === 'heal') api.healAsset(source, { horror: 1, owner: inv })

      const others = (state.investigators || []).filter(other =>
        other.seat !== inv.seat && !other.defeated && !other.resigned)
      if (!others.length) return
      const targetSeat = others.length === 1 ? others[0].seat : Number(api.choice({
        kind: 'target', source: source.id, seat: inv.seat,
        prompt: '选择另一位调查员，交给其控制维吉尔·格雷。',
        options: others.map(other => ({ id: String(other.seat), label: other.name })),
      }))
      if (others.some(other => other.seat === targetSeat)) api.transferAssetControl(source, targetSeat)
    },
  }],
}
