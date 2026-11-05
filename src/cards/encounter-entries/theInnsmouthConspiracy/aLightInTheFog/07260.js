// 07260 惨遭俘虏（Taken Captive）· 诡计 · TIC 第六章《雾中之光》
//
// 印刷（中文）：
//   显现 - 检定[agility](4)。如果你检定失败，你被俘虏，将你的所有钥匙放在拘禁室。
//
// 印刷（English）：
//   Revelation - Test [agility] (4). If you fail, you are captured; place each of your keys on
//   Holding Cells.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07260.js
//
// 引擎读点：
//   · 章节数据把本卡标记为 entryRevelation:true（显现检定由条目接管）→ treachery-tokens.js
//     #resolveTreacheryBody 的 `t.entryRevelation` 分支调用本条目的 encounterResolve
//     （与 07256/07257/07258 同模式），不再走声明式 treacheryRule.test 的 fail 惩罚白名单。
//   · 检定：api.test（scenarioRuntime 的 test；4 参为回调）agility(4)。
//   · 失败被俘 + 钥匙放拘禁室：api.scenario.capture(inv.seat, { source:'07260', keysTo:'destination' })
//     —— capture.js 是唯一写入口；'destination' = 本次捕获的关押地点（拘禁室）。
//   · 成功：无附加效果（印刷无）。
//   · 返回值 = 「是否已安置、不进遭遇弃牌堆」：本卡没有入场效果（只有显现检定），结算后按
//     诡计常规进入遭遇弃牌堆。修复前无条件 return true 会被引擎当成「已处理」，卡凭空离场
//     （审计 M16；同族 07256 返回 false）。
//
// implemented: true

export default {
  code: '07260', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    // 两种 api 面都兼容：treachery-tokens 传 scenarioRuntime 本身；能力面才把原语挂在 api.scenario 下。
    const runtime = api?.scenario && typeof api.scenario === 'object' ? api.scenario : api
    api.test(inv.seat, 'agility', 4, result => {
      if (result.success) {
        api.info?.(`✔️ ${inv.name} 通过「${card.name}」的敏捷检定。`)
        return
      }
      runtime.capture(inv.seat, { source: '07260', keysTo: 'destination' })
    })
    return false
  },
}
