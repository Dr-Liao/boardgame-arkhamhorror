// 10675 第一日 / 第一夜 · 剧情（时间标记卡）· 共享遭遇组 the_first_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_first_day（4 个序曲 + 8 章都按日期取这一张）。
// 卡面（cards-data 10675，双面）：正面「第一日 Day One」——「新的朋友已来到，毒堇谷的欢迎不得了。」；
//   背面「第一夜 Night One」——「森林的晚上好热闹。生灵众多真奇妙，有大也有小。」
//   印刷没有能力：它只是剧本区的「当前第 N 日 / 昼或夜」指示卡。
//
// 读点（数据型条目，规则在章节层）：
//   · 日期：章 definition 声明 scenario.mechanics.calendar = { maximumDay: 3, record: 'hemlockDate' }，
//     behavior 用 api.mechanics.calendar.set(day, period)（= 引擎 scenario-calendar.js#setScenarioDate）写入；
//     (Day)/(Night) 子句的判定读同一份日期的 duringPeriod（engine/matcher.js）；
//   · 摆放：章节 behavior 的 placeTimeMarker（theThingInTheDepths / theSilentHeath）或 setup 的
//     scenario.storyAssets 登记，实体 face 记 'day' | 'night'；
//   · 本条目只声明「这是第几日的时间标记、两面各是什么时段」，供章节/投影读取。
export default {
  code: '10675',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    timeMarker: true,
    day: 1,
    doubleSided: true,
    facePeriods: { front: 'day', back: 'night' },
    frontName: 'Day One',
    backName: 'Night One',
    calendarRecord: 'hemlockDate',
    calendarMaximumDay: 3,
  },
  note: '数据型时间标记条目：日期写入与读取都在引擎 scenario-calendar.js（章节 behavior 调 api.mechanics.calendar.set，'
    + '(Day)/(Night) 子句由 engine/matcher.js 的 duringPeriod 读同一份日期）；条目只声明第几日与两面时段。',
  abilities: [],
}
