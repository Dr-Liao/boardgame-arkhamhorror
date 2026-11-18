// 10503 地下勘察 · 议程（writtenInRock）
// 卡面：强制 - 当本议程推进时：把它上面的所有毁灭移到下一个议程。
// [action] 抽遭遇牌库顶牌：把你所在地点的 1 个资源移到剧本参考卡，作为「碎片」。
// 如果刚抽到的遭遇牌是 [[力量]] 诡计，获得 5 资源。
// 阶段数据（毁灭阈值 5）由章节 definition 的 stage() 承接；行动与背面（塌方）由
// behavior.actions / performAction（writtenInRockSurvey）与 behavior.agendaReveal 承接。
// approximation: 幕 1 的 [action] 是议程正面的行动，P7 以章节行动面板（章节 behavior）实现，
// 未做成议程实体上的能力描述子。
export default {
  code: '10503',
  scope: 'agenda',
  implemented: true,
  flags: {
    printedDoom: 5,
    surveyAction: true,
    movesDoomOnAdvance: true,
    back: 'cavedIn',
  },
  note: 'approximation: 议程行动由章节 behavior（writtenInRockSurvey）承接，不是议程实体上的描述子。',
  abilities: [],
}
