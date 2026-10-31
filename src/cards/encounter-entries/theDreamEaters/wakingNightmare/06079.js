// 06079 伦道夫·卡特（Randolph Carter · 被缚于清醒世界）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 剧情支援（type=asset，不进遭遇牌库；setup 时放在一边，可由幕 2 目标 / 结局加入控制）。
// 卡面：你得到 +1[willpower] 和 +1[intellect]。
//   [reaction] 你所在地点的技能检定中揭示 [elder_thing] 符号后，横置伦道夫·卡特：抽 2 张牌。
// 读点：passive.stats（受控支援的被动加成，assetEffect/ability-rules 合并）；
//   描述子 reaction trigger 'symbolRevealed'（tests.js 的符号窗口，context = { seat, token, location }）。
export default {
  code: '06079',
  scope: 'storyAsset',
  implemented: true,
  passive: { stats: { willpower: 1, intellect: 1 } },
  abilities: [{
    kind: 'reaction',
    trigger: 'symbolRevealed',
    label: '横置伦道夫·卡特：抽 2 张牌',
    cost: { exhaust: true },
    criteria: [({ context }) => context?.token === 'elderthing' || context?.token === 'elder_thing'],
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 2)
      api.info(`📖 伦道夫·卡特指引你穿过清醒世界的裂隙：${inv.name} 抽 2 张牌。`)
    },
  }],
}
