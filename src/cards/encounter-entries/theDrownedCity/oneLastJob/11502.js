// 11502 阿卡姆夜生活 · 议程 1（金盆洗手 1/2）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：[reaction] 一处[[阿卡姆]]地点最后一个线索被发现后：弃掉遭遇牌库顶的 3 张卡牌。
//       依次将以此方式弃掉的每名[[罪犯]]敌人生成在最近的空地点。
// 印刷：毁灭阈值 7；背面「误入险境」（生成帮派执行者 + 遭遇弃牌堆洗回）。
// 读点：behavior.afterInvestigate 读本条目的 flags.arkhamLastClue（每个议程+地点只触发一次）；
//       doomThreshold 由 definition.stage() 从卡表 doom=7 读取；背面在 behavior.agendaReveal。
export default {
  code: '11502',
  scope: 'agenda',
  implemented: true,
  flags: { arkhamLastClue: true, doomThreshold: 7 },
  note: '数据型条目：数值取卡表；反应在 behavior.afterInvestigate，背面在 behavior.agendaReveal。',
  abilities: [],
}
