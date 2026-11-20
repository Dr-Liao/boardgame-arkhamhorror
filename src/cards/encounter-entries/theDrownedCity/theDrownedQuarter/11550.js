// 11550 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
// P2 原语接口：文物（Artifact）由被击败持有者按地图最近幸存调查员移交（transferOnControllerDefeat
// = 'nearest'，见 docs/campaign/theDrownedCity/primitives.md）；该声明落在真实文物条目上，
// 供 tests/tdc-primitives.test.mjs 的移交读点使用（夹具不再重复注册同一卡号）。
//
// P7 第二轮「受控剧情资产行动」原语：scope:'storyAsset' + controlledAsset:true 后，本条目声明的
// action 能力随 inv.assets 里的实例进入 legalMoves / 玩家能力窗口（controlledAbilityCards），
// 与玩家资产同一套 executeDescriptor 管线（含 api.test 检定）。
// 成功结算：检定成功 → 离场（api.discardAsset）；故事的「符文 Y + 加入胜利区」由章节
// behavior.assetLeftPlay 消费引擎既有离场钩子（见 note；引擎拒绝 asset→story 跨类型翻面，
// 所以用故事卡加入胜利区表达同一结果）。
// 「投入本次检定的每张卡牌技能图标翻倍」由章节 behavior.commitIconMultiplier（既有读点：
// src/engine/tests.js 投入结算）在本次检定来源为 11550 时返回 2。
export default {
  code: '11550',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  transferOnControllerDefeat: 'nearest',
  flags: {"test":{"skill":"intellect","difficulty":8}},
  abilities: [
    {
      kind: 'action',
      label: '检定智力(8)（投入卡牌技能图标翻倍）：成功翻面结算（符文 Y「知识」+ 胜利区）',
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, 'intellect', 8, {
          source: { label: '黑曜石遗物', name: api.cardName('11550'), code: '11550' },
          resolve: result => {
            if (!result?.success) return
            // 离场：成功后的离场由章节 behavior.assetLeftPlay 结算（符文 Y + 故事卡 11550b 加入胜利区；
            // 正面普通离场则从游戏中移除）。这里只发起离场——引擎在检定结算回调内仍保留
            // state.skillTest.source，章节据此区分「成功翻面结算」与「普通离场」。
            api.discardAsset(inv.seat, source)
          },
        })
      },
    },
  ],
  note: "印刷：将要离场时从游戏移除；[action] 检定智力(8)，投入本次检定的每张卡牌技能图标翻倍；成功则翻面并结算其文本（符文 [Y]「知识」+ 加入胜利区）。已接线：[action] 走 controlledAsset:true 的能力声明（legalMoves + executeDescriptor + api.test）；图标翻倍走章节 behavior.commitIconMultiplier（引擎既有投入读点，仅本次检定来源为 11550 时 ×2）；成功后的离场/符文/胜利区与「离场移出游戏」走章节 behavior.assetLeftPlay（引擎 assetLeftPlay 既有读点）；文物移交走 transferOnControllerDefeat。引擎限制（仅视觉面）：applyPhysicalFace 拒绝 asset→story 跨类型翻面，因此不改变实例面，而以「故事卡 11550b 加入胜利区」等价实现同一规则结果（离场 + 符文 Y + 胜利区）；已登记 engine-needs §7 为可选 P8 视觉读点。",
}
