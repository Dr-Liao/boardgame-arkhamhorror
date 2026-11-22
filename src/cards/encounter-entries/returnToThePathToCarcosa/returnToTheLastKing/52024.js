// 52024 疯狂的宾客（重返最后的王者）
// 归属：关卡专用 · returnToTheLastKing（重返卡尔克萨之路 · 最后的王者）
// 遭遇组：return_to_the_last_king
// 卡面：猎手。[action]：谈判。检定[intellect](4)。成功：自动躲避疯狂的宾客。
//
// 行为读点：enemyScript.encounterAction（carcosa encounter-rules.encounterActions）
// 产出场景行动；结算在本章 behavior.performEncounterAction。
export default {
  code: '52024',
  name: '疯狂的宾客',
  scope: 'enemy',
  enemyRule: { parleySkill: 'intellect', parleyDifficulty: 4 },
  enemyScript: {
    encounterAction(state, inv, enemy) {
      return {
        action: 'encounterAction',
        actionKind: 'parley',
        rule: 'parleyCrazedGuest',
        enemyId: enemy.id,
        actions: 1,
        label: '谈判（检定智力 4，成功自动躲避疯狂的宾客）',
      }
    },
  },
}
