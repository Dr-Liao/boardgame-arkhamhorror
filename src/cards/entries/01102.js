// 01102 银暮秘社僧侣
// 卡面：猎手。猎物。强制 - 入场后：放置 1 个毁灭标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01102',
  enemyWeakness: { hunter: true, prey: true, forcedDoom: true },
  abilities: [],
  modifiers: [],
}
