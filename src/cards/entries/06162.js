// 06162 格雷戈里·葛利
// 卡面：使用(9资源)。
// 卡面：[reaction]在你发动一次技能检定时，花费格雷戈里·葛利的最多3资源：
//       如果本次检定成功且至少超过该资源数量，获得相同数量的资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里添加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「发动技能检定」= testBegins 窗口（performTest 在投入前开 reactionWindow）；
//   · 花费葛利身上的资源 = 资产的 uses（usesType 'resource'）；
//   · 「成功后获得等量资源」= api.addExtraOnSuccess（test 成功结算段读 state.skillTest.extraOnSuccess）。
// 成功结算段按 minimumSuccessBy 检查成功差值是否达到押注数。

export default {
  code: '06162',
  uses: 9,
  usesType: 'resource',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      id: 'gregoryGryWager',
      limit: 'oncePerTest',
      label: '发动技能检定时：押注最多 3 资源，检定成功后获得等量资源',
      criteria: [({ inv }) => (inv.assets || []).some(asset => asset.code === '06162' && (asset.uses || 0) > 0)],
      resolve: ({ state, inv, api }) => {
        const asset = (inv.assets || []).find(item => item.code === '06162')
        if (!asset) return
        const maximum = Math.min(3, Number(asset.uses) || 0)
        if (maximum <= 0) { api.info('格雷戈里·葛利上没有资源可押注。'); return }
        const answer = maximum === 1 ? '1' : api.choice({
          kind: 'amount', source: '06162', seat: inv.seat,
          prompt: `从格雷戈里·葛利身上花费多少资源押注（最多 ${maximum}）？`,
          options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount} 资源` })),
        })
        const spend = Math.max(0, Math.min(maximum, Number(answer) || 0))
        if (!spend) return
        api.addUses(asset, -spend)
        api.addExtraOnSuccess({ type: 'gainResource', amount: spend, minimumSuccessBy: spend })
        api.info(`🎲 ${inv.name} 从格雷戈里·葛利身上押注 ${spend} 资源：本次检定成功且超出至少 ${spend} 点后获得 ${spend} 资源。`)
      },
    },
  ],
  modifiers: [],
}
