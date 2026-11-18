// 10679 第三日 / 第三夜 · 剧情（时间标记卡）· 共享遭遇组 the_final_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_final_day。
// 卡面（cards-data 10679，双面）：正面「第三日 Day Three」——「盛宴终于来到，我们欢笑，共庆新面貌。」；
//   背面「第三夜 Night Three」——「摆脱现世的囚牢，迎接无穷的怀抱。」印刷没有能力，只是当前日期指示卡。
//
// 读点（数据型条目，规则在章节层）：日历写读同 10675——scenario.mechanics.calendar 的
//   { maximumDay: 3, record: 'hemlockDate' }；preludeTheFinalEvening 以 10679b（第三夜面）为步进卡、fateOfTheVale
//   取第三日；实体 face 记 'day' | 'night'，duringPeriod 读引擎日历。
export default {
  code: '10679',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    timeMarker: true,
    day: 3,
    doubleSided: true,
    facePeriods: { front: 'day', back: 'night' },
    frontName: 'Day Three',
    backName: 'Night Three',
    calendarRecord: 'hemlockDate',
    calendarMaximumDay: 3,
  },
  note: '数据型时间标记条目：日期写入与读取都在引擎 scenario-calendar.js（duringPeriod 读同一份日期）；片段卡 10679b 是同一张卡的第三夜面。',
  abilities: [],
}
