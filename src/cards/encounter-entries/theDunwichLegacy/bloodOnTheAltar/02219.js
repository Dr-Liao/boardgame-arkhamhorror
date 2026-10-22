// 02219 伊本巴奇之粉末
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：伊本巴奇之粉末入场带有X个线索，其中X为你剧本日志中“在敦威治遗产中幸存”的角色数量。
// 卡面：[free]：将伊本巴奇之粉末的1线索移动到你所在地点一个横置的犹格·索托斯之子上。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 02219 伊本巴奇之粉末：剧情资产，允许从战役牌组打出（第 60 轮）。

export default {
  code: '02219', scope: 'storyAsset',
  assetRule: { powder: true }, name: '伊本巴奇之粉末', scenarioPlayable: true,
  cluesFromSurvivors: ['drHenryArmitage', 'professorWarrenRice', 'drFrancisMorgan', 'zebulonWhateley', 'earlSawyer'],
}
