// 01007 掩盖罪证
// 卡面：显现 - 将掩盖罪证放置入场，放到你的威胁区域，并在上面放置3个线索。
// 卡面：[reaction]在你将要发现你所在地点的至少1个线索时：改为弃掉掩盖罪证上同等数量的线索。
// 卡面：强制 - 在游戏结束时，如果掩盖罪证上有线索：你承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01007',
  explicitReactionPrompt: true,
  abilities: [
    {
      kind: 'weakness',
      label: '掩盖罪证',
      weakness: { type: 'threat', clues: 3, redirectClues: true },
    },
  ],
  mentalTraumaIfCounters: true,
  modifiers: [

  ],
}
