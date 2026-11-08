// 08009 被埋葬的秘密（Buried Secrets，蒙特雷·杰克的专属弱点）
//
// 卡面：显现 - 将被埋葬的秘密放置入场，放到你的威胁区域中。
//   如果你所在的地点能被调查，除冒险卡牌效果外，你不能移动。
//   [action]：调查。如果你成功，不发现线索，改为弃掉被埋葬的秘密。
//   如果你失败，你可以受到 2 点恐惧，以将被埋葬的秘密洗回你的牌库。
//
// 读点：
//   · 显现入场：弱点档案 type:'threat'（engine/weakness.js 的威胁分支把它放进威胁区）；
//   · 移动锁：条目级 `threatEffect.blocksMovementWhileInvestigable`（hidden-rules.js#movementError
//     的唯一读点），条件是所在地点可被调查（在场且未上锁）；「剧本卡效果」的例外由
//     movementError 的 `byScenarioEffect` 选项放行（场景运行时透传，见 P5 报告）；
//   · [action] 调查：`api.investigate(..., { noClueDiscovery: true })` 走标准调查管线但不发现线索，
//     成功后用 `api.removeThreat` 弃掉本卡；失败后可选 2 恐惧 + `api.moveCard`/`api.shuffleDeck`
//     洗回牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08009',
  threatEffect: { blocksMovementWhileInvestigable: true },
  abilities: [
    { kind: 'weakness', label: '被埋葬的秘密', weakness: { type: 'threat' } },
    { kind: 'action', label: '调查：成功则弃掉本卡', cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const result = api.investigate(inv.seat, { noClueDiscovery: true })
        if (!result) return
        if (result.success) {
          api.removeThreat(source)
          return
        }
        const takeHorror = api.choice({ kind: 'effect', source: source?.code || '08009', seat: inv.seat, canSkip: true,
          prompt: '调查失败：是否受到 2 点恐惧，将被埋葬的秘密洗回你的牌库？',
          options: [{ id: 'skip', label: '保留在威胁区' }, { id: 'horror', label: '受到 2 点恐惧并洗回牌库' }] }) === 'horror'
        if (!takeHorror) return
        api.horror(inv.seat, 2)
        if (inv.defeated) return
        api.moveCard({ code: source?.code || '08009', from: 'threat', to: 'deckTop' })
        api.shuffleDeck(inv.seat)
      } },
  ],
  modifiers: [],
}
