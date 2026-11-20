// 11503 漫漫长夜 · 议程 2（金盆洗手 2/2）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：[reaction] 一处[[阿卡姆]]地点最后一个线索被发现后：弃掉遭遇牌库顶的 3 张卡牌。
//       依次将以此方式弃掉的每名[[罪犯]]敌人生成在最近的空地点。
// 印刷：毁灭阈值 7；背面「好奇害死猫」（每位存活调查员被击败并承受 1 点肉体创伤）。
// 读点：behavior.afterInvestigate 读 flags.arkhamLastClue；背面在 behavior.agendaReveal（进入无结局）。
export default {
  code: '11503',
  scope: 'agenda',
  implemented: true,
  flags: { arkhamLastClue: true, doomThreshold: 7 },
  note: '数据型条目：数值取卡表；反应在 behavior.afterInvestigate，背面在 behavior.agendaReveal。',
  abilities: [],
}
