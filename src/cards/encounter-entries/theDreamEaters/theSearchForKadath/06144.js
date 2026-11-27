// 06144 维吉尔·格雷（theSearchForKadath）· 剧情支援（盟友 / 入梦者）
// 卡面：[reaction] 在发现至少1个神迹后：抽取1张卡牌、获得1资源，或治愈维吉尔·格雷的1点恐惧。
//       如果游戏中有超过1位调查员，将维吉尔·格雷的控制权交给另一位调查员。
// 卡面：强制 - 如果维吉尔·格雷离场：将他从游戏中移除。
//
// 章节在发现神迹后打开控制者的反应选择，离场则走通用支援移除规则。
export default {
  code: '06144', scope: 'storyAsset', implemented: true,
  removeFromGameOnLeave: true,
  assetRule: {
    afterSignsUncovered(state, api, { ownerSeat = null } = {}) {
      const inv = state.investigators?.[ownerSeat]
      const asset = inv?.assets?.find(item => (item.originalCode || item.code) === '06144')
      if (!inv || !asset) return false

      const options = [
        { id: 'skip', label: '不发动' },
        { id: 'draw', label: '抽 1 张卡牌' },
        { id: 'resource', label: '获得 1 资源' },
      ]
      if ((asset.horror || 0) > 0) {
        options.push({ id: 'heal', label: '治愈维吉尔·格雷的 1 点恐惧' })
      }
      const answer = api.choose?.({
        kind: 'reaction', source: '06144', seat: inv.seat, canSkip: true,
        prompt: '维吉尔·格雷：发现神迹后，可以发动反应选择一项。',
        options,
      })
      const reward = options.find(option => option.id === answer)
      if (!reward || answer === 'skip') return false
      if (answer === 'resource') api.gainResources?.(inv.seat, 1)
      else if (answer === 'heal') api.healAsset?.(asset, { horror: 1, owner: inv })
      else api.drawCards?.(inv.seat, 1)
      api.info?.(`📖 维吉尔·格雷的反应：${reward.label}。`)

      const others = (state.investigators || []).filter(item => item.seat !== inv.seat && !item.defeated && !item.resigned)
      if (!others.length) return true
      const targetSeat = others.length === 1 ? String(others[0].seat) : api.choose?.({
        kind: 'investigator', source: '06144', seat: inv.seat,
        prompt: '选择一名其他调查员接管维吉尔·格雷。',
        options: others.map(item => ({ id: String(item.seat), label: item.name })),
      })
      const target = others.find(item => String(item.seat) === targetSeat)
      if (target && api.transferAssetControl?.(asset, target.seat)) {
        api.info?.(`📖 维吉尔·格雷的控制权交给 ${target.name}。`)
      }
      return true
    },
  },
}
