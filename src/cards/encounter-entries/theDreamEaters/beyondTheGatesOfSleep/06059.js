// 06059 伦道夫·卡特（Randolph Carter · 专家入梦者）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 剧情支援（type=asset，不进遭遇牌库；setup 时放在一边，可由结局加入牌组 / 控制）。
// 卡面：你得到 +1[combat] 和 +1[agility]。
//   [reaction] 你所在地点的技能检定中揭示 [tablet] 符号后，横置伦道夫·卡特：抽 2 张牌。
// 读点：passive.stats（受控支援的被动加成，assetEffect/ability-rules 合并）；
//   描述子 reaction trigger 'symbolRevealed'（tests.js 的符号窗口，context = { seat, token, location }）。
export default {
  code: '06059',
  scope: 'storyAsset',
  implemented: true,
  passive: { stats: { combat: 1, agility: 1 } },
  abilities: [{
    kind: 'reaction',
    trigger: 'symbolRevealed',
    label: '横置伦道夫·卡特：抽 2 张牌',
    cost: { exhaust: true },
    criteria: [({ context }) => context?.token === 'tablet'],
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 2)
      api.info(`📖 伦道夫·卡特在符文的低语中指出了方向：${inv.name} 抽 2 张牌。`)
    },
  }],
}
