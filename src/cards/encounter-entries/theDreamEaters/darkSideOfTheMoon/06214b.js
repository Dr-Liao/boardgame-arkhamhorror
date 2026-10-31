// 06214b 剧情卡「下船」（Off the Galley · 月兽帆船 06214 的背面）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon（type=story，卡池 hidden: true，由 06214 翻面时结算）。
// 卡面（翻面时读）：
// 如果本卡牌翻面时已没有线索：将本地点的每位调查员移动到月之森林。将本卡牌从游戏中移除，
// 弃掉位于本地点的所有敌人。
// 如果本卡牌翻面时至少有 1 个线索：本地点的每位调查员的警报等级提高 1 级。
// 将本地点的每位调查员和每个敌人移动到月兽之城。将本卡牌从游戏中移除。
//
// 依据 Haskell Story/CardDefs/.../OffTheGalley.hs 与 Location/Cards/.../MoonBeastGalley.hs 的 Flip 分支：
//   结算依赖「翻面瞬间的线索数」并要同时搬调查员/敌人、弃敌人、移出游戏——这段顺序流程放在本章
//   behavior.js 的 `offTheGalley` 流程（由 06214 的 locationRule.flipFlow 声明 flow id 触发）。
// 本条目只声明剧情面身份与 flow id，供 implementedFor / 覆盖自检读取。
export default {
  code: '06214b',
  scope: 'storyAsset',
  implemented: true,
  flags: { flow: 'offTheGalley', storyFace: true },
  note: '翻面结算（按翻面瞬间线索数二选一）由 behavior 的 offTheGalley 流程完成；本卡由 06214 翻面时读出。',
}
