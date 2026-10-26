// 02158 魅力超凡
// 卡面：永久。
// 卡面：你拥有额外1个盟友槽位。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 2026-10-26 原语收敛：通用额外槽只保留「修正」一个入口（add:slot），读点 slotBonus；
// 旧 passive.extraSlots 写法与引擎读路已删除。
export default {
  code: '02158',
  abilities: [

  ],
  modifiers: [
    { target: 'add:slot', value: 'ally', amount: 1 },
  ],
}
