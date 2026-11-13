// 09626 虚空奇美拉（Void Chimera · True Form）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。
// 卡面（中）：隐匿4。庞大。
//   虚空奇美拉的其他形态在场时，你不能揭露任何隐匿迷你卡牌。
//   强制 - 你揭露虚空奇美拉的诱饵后：在放在一边的虚空奇美拉中，找出副标题与其对应的版本，生成在你的地点。
//
// 读点（章节 behavior，条目只声明数据）：
//   · 「隐匿 4」→ behavior.concealedAmountOf 读 `enemyRule.concealed`（definition 也带同一数值）；
//   · 「庞大」→ definition 的印刷关键字（spawnEnemy 读 def.massive）；
//   · 「其它形态在场时不能揭露」→ behavior.exposeBlockedReason 读 `blocksExposeWhileOtherFormsInPlay`
//     （条目是这条规则的唯一声明处，behavior 只查询在场形态）；
//   · 「揭露诱饵 → 生成对应副标题的形态」→ behavior.exposeAt 读 `decoySpawns` 映射（4 张具名诱饵），
//     生成优先从「放在一边」取回同卡，避免出现第二份；
//   · 真身迷你卡的 kind 是 `VoidChimeraTrueForm`（原语要求字母开头的稳定标识）。
export default {
  code: '09626',
  name: '虚空奇美拉（真实形态）',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    concealed: 4,
    massive: true,
    blocksExposeWhileOtherFormsInPlay: true,
    decoySpawns: {
      DecoyVoidChimeraFellbeak: '09627',
      DecoyVoidChimeraEarsplitter: '09628',
      DecoyVoidChimeraGorefeaster: '09629',
      DecoyVoidChimeraFellhound: '09630',
    },
    spawnsAtExposedLocation: true,
  },
  note: 'approximation: 「尽可能平均分发」在张数除不尽时按地点顺序补足（参考实现让领队选择多出的 1 张）；'
    + '揭露走独立剧本行动（1 行动）而不是调查/攻击/躲避中的顺带揭露，见 behavior 的 scenarioApproximations。'
    + '「放在一边的对应副标题形态」用 code 反查（副标题与卡号一一对应），不解析副标题文本。',
}
