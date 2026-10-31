// 06144 维吉尔·格雷（theSearchForKadath）· 剧情支援（盟友 / 入梦者）
// 卡面：[reaction] 在发现至少1个神迹后：抽取1张卡牌、获得1资源，或治愈维吉尔·格雷的1点恐惧。
//       如果游戏中有超过1位调查员，将维吉尔·格雷的控制权交给另一位调查员。
// 卡面：强制 - 如果维吉尔·格雷离场：将他从游戏中移除。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 在「发现神迹」后（resolveSigns）
// 调用 assetRule.afterSignsUncovered 结算反应，在 assetLeftPlay 里处理强制移除。
export default {
  code: '06144', scope: 'storyAsset', implemented: true,
  assetRule: {
    storyAssetRole: 'virgilGray',
    // 由 behavior 在每次神迹计数增加后调用；ownerSeat = 当前控制者。
    afterSignsUncovered(state, api, { ownerSeat = null } = {}) {
      const inv = state.investigators?.[ownerSeat]
      const asset = inv?.assets?.find(item => (item.originalCode || item.code) === '06144')
      if (!inv || !asset) return false
      const options = [
        { id: 'draw', label: '抽 1 张卡牌' },
        { id: 'resource', label: '获得 1 资源' },
        { id: 'heal', label: '治愈维吉尔·格雷的 1 点恐惧' },
      ]
      const answer = api.choose?.({
        kind: 'reaction', source: '06144', seat: inv.seat,
        prompt: '维吉尔·格雷：发现神迹的反应——选择一项。',
        options,
      }) ?? 'draw'
      if (answer === 'resource') api.gainResources?.(inv.seat, 1)
      else if (answer === 'heal') api.healAsset?.(asset, { horror: 1, owner: inv })
      else api.drawCards?.(inv.seat, 1)
      api.info?.(`📖 维吉尔·格雷的反应：${{ draw: '抽 1 张卡', resource: '获得 1 资源', heal: '治愈 1 点恐惧' }[String(answer)] || '抽 1 张卡'}。`)
      // 有多位调查员时把控制权交给下一位（走 api.giveAsset；条目不得直写 assets）。
      const others = (state.investigators || []).filter(item => item.seat !== inv.seat && !item.defeated && !item.resigned)
      if (others.length && api.giveAsset?.(asset, others[0].seat)) {
        api.info?.(`📖 维吉尔·格雷的控制权交给 ${others[0].name}。`)
      }
      return true
    },
    // 强制：离场时移出游戏（behavior.assetLeftPlay 读取；条目不能直写 state）。
    removeFromGameOnLeave: true,
  },
}
