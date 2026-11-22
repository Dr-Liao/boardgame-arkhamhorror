// 52023 黛安娜·迪瓦恩（重返最后的王者）
// 归属：关卡专用 · returnToTheLastKing（重返卡尔克萨之路 · 最后的王者）
// 遭遇组：return_to_the_last_king
// 卡面：猎物 - 线索最多。猎手。生命值 +3[per_investigator]。
//       强制 - 任意调查员执行谈判行动后：朝该调查员移动一次。
//
// 行为读点：
//   - `prey` 由 encounterDefinitions / card-rules 读（场景定义里的敌人数据）；
//   - `afterParleyMoveToward` 由本章 behavior.afterParley（引擎 dispatch.afterParley 读点）结算。
export default {
  code: '52023',
  name: '黛安娜·迪瓦恩',
  scope: 'enemy',
  enemyRule: {
    prey: 'mostClues',
    // 每名调查员 +3 生命值（基础生命 + 3 × 调查员数）由场景定义 enemyStatModifier 读取。
    healthPerInvestigatorBonus: 3,
    afterParleyMoveToward: true,
  },
}
