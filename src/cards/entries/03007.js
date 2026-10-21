// 03007 保卫后方
// 卡面：马克·哈里根牌库专用。
// 卡面：如果攻击期间本次技能检定成功，将马克哈里根上的1点伤害移动到被攻击敌人上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03007',
  abilities: [
    { kind: 'commit', label: '保卫后方', skill: { homeFront: true } },
  ],
  modifiers: [

  ],
}
