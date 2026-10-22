// 04209b 羽翼蛇族
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：生成 - 昆扬之口。
// 卡面：警戒。猎手。庞大。
// 卡面：不能被击败。不能进行趁乱攻击。
// 卡面：强制 - 在一个石柱标记被放置在昆扬之口上后：横置羽翼蛇族。其在本轮补给阶段期间不重整。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 羽翼蛇族（04209b）：不能被击败，也不发动借机攻击。
// 关卡定义里的实例字段（cannotBeDefeated/noOpportunityAttack）仍在；
// 这里给出卡面声明，使同一张卡在别的章节生成时也遵守同一规则。

export default {
  code: '04209b',
  name: '羽翼蛇族',
  scope: 'enemy',
  text: '不能被击败。不发动借机攻击。',
  modifiers: [
    { target: 'cannot:beDefeated' },
    { target: 'cannot:opportunityAttack' },
  ],
}
