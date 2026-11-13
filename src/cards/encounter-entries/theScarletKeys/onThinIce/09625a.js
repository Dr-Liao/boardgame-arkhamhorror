// 09625a 索恩（Thorne · The One with the Red Cravat）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。同一张物理卡的另一面是 09625b（剧情支援）。
// 卡面（中）：猎手。反击。索恩得到 +2[per_investigator]生命值。
//   强制 - 在抽取[[危险]]诡计后：索恩变换身上附属的每个钥匙。
//   强制 - 在索恩被击败时：如果玄丧之镜附属到索恩，将其附属到任意一位调查员，由该调查员控制。
//
// 读点（全部在章节 behavior，条目只声明数据）：
//   · 「+2[per_investigator] 生命值」→ definition 的 `healthPerPlayerBonus: 2`（引擎 spawnEnemy 读点）；
//   · 「抽取[[危险]]诡计后变换钥匙」→ behavior.encounterDrawn 读 `enemyRule.shiftsKeysOnHazardDrawn`，
//     再调 behavior.resolveKeyShift（内容层唯一 Shift 执行点）；
//   · 「被击败时把钥匙交给调查员」→ behavior.enemyDefeated 读 `enemyRule.handsKeyToInvestigatorOnDefeat`；
//   · 「猎手/反击」由 definition 的印刷关键字进入敌人实例（enemies.js#spawnEnemy 读点）。
export default {
  code: '09625a',
  name: '索恩',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    hunter: true,
    retaliate: true,
    healthPerPlayerBonus: 2,
    shiftsKeysOnHazardDrawn: true,
    handsKeyToInvestigatorOnDefeat: true,
  },
  note: 'approximation: 「变换身上附属的每个钥匙」在本章只有玄丧之镜一把（`keys.shift` 每轮一次的限制'
    + '对敌人持有的钥匙不生效，见 behavior.resolveKeyShift 的 by="enemy"）；敌人持钥的「不可翻回稳定面」'
    + '由 tsk-scarlet-keys 的 `steal` 语义承担，本条目只声明触发时机。',
}
