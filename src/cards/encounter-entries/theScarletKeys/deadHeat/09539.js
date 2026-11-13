// 09539 奴仆
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：每轮抽到的第一张奴仆获得涌动。
// [fast] 你的回合内：尝试躲避奴仆。本次躲避它获得警戒（每回合一次）。
//
// 一张卡一个文件：behavior.encounterGainsSurge 读取 thrall / firstDrawnEachRoundGainsSurge
// 结算每轮第一张的涌动；behavior.actions / performAction 的 deadHeatThrallEvade 行动读取
// thrall / fastEvadeAction，失败时它获得警戒并攻击（需 primitive-requests/09539.json 的真窗口才能
// 让引擎的关键字管線自动处理「本次躲避获得警戒」）。
export default {
  code: '09539',
  scope: 'enemy',
  implemented: true,
  flags: {
    thrall: true,
    firstDrawnEachRoundGainsSurge: true,
    fastEvadeAction: true,
    alertOnThisEvade: true,
  },
  note: '近似：躲避走章节行为的快速行动（自建检定），「本次躲避获得警戒」在失败时由行为补一次攻击。',
}
