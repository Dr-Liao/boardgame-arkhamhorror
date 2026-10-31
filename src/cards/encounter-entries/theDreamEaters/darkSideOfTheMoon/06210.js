// 06210 幕 I「月兽腹地」（In the Belly of the Moon-Beast）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面（正面）：目标 - 只有位于月兽之城的调查员可以共同花费所需
// 数量的线索以推进（每人 3 个线索）。
// 背面「及时救援」（Timely Rescue）：选择位于月兽之城的一位调查员控制放在一边的维吉尔·格雷
// （文思泉涌）剧情支援。检查剧本日志：如果伦道夫被俘，该卡牌的所有者将放在一边的伦道夫·卡特
// （梦境专家）剧情支援放入手牌。
//
// 依据 Haskell Act/Cards/.../InTheBellyOfTheMoonBeast.hs：
//   · 目标是团队线索（PerPlayer 3，限月兽之城）→ actRule.objective 数据，behavior.actions/checkObjectives 读；
//   · 背面要「把牌组外的剧情支援交给指定调查员 / 放入某位所有者手牌」，涉及找牌与跨卡身份（伦道夫是
//     战役资产，本章不一定持有其卡号）→ 顺序流程放在 behavior.js 的 `virgilRescue` 流程，条目只声明 flow id。
export default {
  code: '06210',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { kind: 'groupClues', perInvestigator: 3, atLocationCode: '06215' },
    chapterFlow: 'virgilRescue',
  },
  note: '背面「剧情支援控制者选择 / 被俘的伦道夫入手」由 behavior.actReveal 的 virgilRescue 流程结算。',
}
