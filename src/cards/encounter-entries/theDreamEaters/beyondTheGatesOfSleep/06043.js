// 06043 最后一阶（The Final Descent）· 幕 3
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 正面：神话阶段不要从遭遇牌库抽卡。目标 - 若每位调查员都位于「魔幻小路」，立即推进。
// 背面：每位调查员失去全部线索；混乱袋永久加入 1 个 [skull]；
//   把每张[[台阶]]地点移出游戏；随机选择 6 张放在一边的「魔幻森林」放入场，另一张移出游戏；
//   把其余所有放在一边的剧本卡（除辛劳的古革巨人与伦道夫·卡特）洗混组成遭遇牌库（此后神话阶段正常抽牌）。
// 读点：背面需要移动「放在一边」的区域（遭遇卡堆放区），条目禁止直写场景区，
//   因此整段流程由章节 behavior 的 chapterFlow:'theFinalDescent' 执行（definition 的 act 数据声明），
//   本条目声明 objective 数据并把 chapterFlow 写在 actRule（审计读点/章节接线约定）。
export default {
  code: '06043',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'allInvestigatorsAt', originalCode: '06049' },
    chapterFlow: 'theFinalDescent',
  },
}
