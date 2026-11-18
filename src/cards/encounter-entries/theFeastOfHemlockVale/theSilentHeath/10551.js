// 10551 荒芜（版本一）· 议程（寂静荒野 2/2，第 1 日 / 第 1 夜）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：每个[[昆虫]]敌人失去冷漠。
//       强制 - 在毁灭标记放置到本密谋时，如果族群虫后敌人放在一边：从混乱袋中揭示标记，
//       数量等于胜利区中[[昆虫]]敌人的数量。如果揭示了有符号的标记，生成放在一边的族群虫后。
// 读点：behavior.syncInsectKeywords 读 insectsLoseAloof；behavior.doomPlaced 读
//       spawnBroodQueenOnDoom（'symbol' = 任意符号标记）。
export default {
  code: '10551',
  scope: 'agenda',
  implemented: true,
  flags: { insectsLoseAloof: true, spawnBroodQueenOnDoom: 'symbol' },
  note: '困难/专家难度提示卡背面不改变本议程正面文本；本条目只描述正面。',
  abilities: [],
}
