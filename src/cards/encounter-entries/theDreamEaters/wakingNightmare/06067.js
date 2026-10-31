// 06067 寻求答案（Looking for Answers）· 幕 1
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 正面：目标 - 团队花费 4×人数线索推进（引擎 objective 数据）。
// 背面：把放在一边的「梯井」与「地下室门」地点放入场；检查当前议程：
//   若为议程 2 或 3，进行一次蛛群滋生检定；若为议程 1，立即推进到议程 2。
// 读点：objective 数据由 definition 的 act.objective 声明（引擎 act-agenda.js 直接读取）；
//   背面涉及「放在一边」地点与滋生检定，由章节 behavior 的 chapterFlow:'lookingForAnswers' 执行
//   （definition 的 act 数据声明 chapterFlow，条目里同名字段供审计读点）。
export default {
  code: '06067',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'clues', perInvestigator: 4, group: true },
    chapterFlow: 'lookingForAnswers',
  },
}
