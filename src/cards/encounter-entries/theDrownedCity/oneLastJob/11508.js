// 11508 面对后果 · 幕 3（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：每名其上有线索的[[罪犯]]敌人获得冷漠。
//       [action] 从你所在地点一名[[罪犯]]敌人上移除 1 个线索：谈判。该敌人将其伤害值造成给你所在地点的另一名敌人。
//       目标 - 一轮结束时，如果胜利区至少有 1 名[[精英]]敌人，推进。
// 印刷：背面「帮派战争」→ 结局 1（第 5 页）。
// 读点：behavior.roundEnded 读 flags.eliteInVictory；behavior.actReveal（幕 3 背面）调用 api.finish('resolution1')。
export default {
  code: '11508',
  scope: 'act',
  implemented: true,
  flags: { eliteInVictory: 1, parleyRemoveClue: 1, resolutionOnAdvance: 'resolution1' },
  note: '数据型条目：目标由 behavior.roundEnded 读 flags；背面直接进入结局 1。'
    + 'approximation：「移除线索让敌人互相造成伤害」的谈判行动未实现（无通用目标选择读点）。',
  abilities: [],
}
