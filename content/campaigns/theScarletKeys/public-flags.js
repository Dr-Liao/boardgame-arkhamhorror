// 《绯红密钥》章节状态观察投影声明（2026-11-13 P1-12）。
//
// 背景：`scenarioFlags` 里各章的内部状态此前不投影（`observation.js#PUBLIC_SCENARIO_FLAGS` 是硬编码
// 白名单，只放了 TFA 的 depthLevel/pillars），导致玩家/AI 看不到「标靶数、日食、已救平民、阴影位置」
// 这类**规则上公开**的计数。这里按「战役清单声明」的方式给出可公开子键（不含正文、牌序与未揭示身份），
// `observation.js` 只按声明投影；`mechanic-view.js` 用同一份声明生成 TSK 面板摘要。
//
// 约定：
//   · `path` 是 `state.scenarioFlags` 的点路径；章节容器（sanguineShadows 等）用 `容器.子键`。
//   · `label` 为观测面板显示名；`kind`：
//       count   —— 数字，直接显示
//       text    —— 字符串，直接显示
//       map     —— 对象，显示为「键:值」计数（键是地点 id 时由前端换地点名）
//       list    —— 数组，显示长度
//   · 不得加入隐藏信息：未揭露迷你卡身份、牌序、密谋/议程正文、未公开的投票内容等。
export const TSK_PUBLIC_SCENARIO_FLAGS = Object.freeze([
  // ── 谜雨（riddlesAndRain，扁平键）────────────────────────────────────────
  Object.freeze({ path: 'tskRedGlovedManDefeated', label: '戴红手套的男子已被击败', kind: 'text' }),
  Object.freeze({ path: 'tskShadowDoom', label: '阴影中的毁灭', kind: 'count' }),
  Object.freeze({ path: 'tskDoomCarry', label: '跨场景保留的毁灭', kind: 'count' }),
  Object.freeze({ path: 'tskKeyLocations', label: '密钥所在地点', kind: 'map' }),
  Object.freeze({ path: 'tskAbbeyParleyUsed', label: '威斯敏斯特教堂谈判已用', kind: 'text' }),

  // ── 死亡酷热（deadHeat，扁平键）──────────────────────────────────────────
  Object.freeze({ path: 'deadHeatTime', label: '死亡酷热：时间进度', kind: 'count' }),
  Object.freeze({ path: 'deadHeatRescued', label: '已救出的平民', kind: 'count' }),
  Object.freeze({ path: 'deadHeatCiviliansSlain', label: '已阵亡的平民', kind: 'count' }),
  Object.freeze({ path: 'deadHeatSkip', label: '跳过本章', kind: 'text' }),
  Object.freeze({ path: 'deadHeatIntro', label: '开场版本', kind: 'text' }),
  Object.freeze({ path: 'amaranthFace', label: '苋的当前面', kind: 'text' }),

  // ── 血色阴影（sanguineShadows，章节容器）────────────────────────────────
  Object.freeze({ path: 'sanguineShadows.referenceTargets', label: '冒险参考卡上的标靶', kind: 'count' }),
  Object.freeze({ path: 'sanguineShadows.laChicaRojaTargets', label: '红衣女郎身上的标靶', kind: 'count' }),
  Object.freeze({ path: 'sanguineShadows.targets', label: '场上的标靶', kind: 'map' }),
  Object.freeze({ path: 'sanguineShadows.seeingRed', label: '已进入「见红」', kind: 'text' }),
  Object.freeze({ path: 'sanguineShadows.decoyExposedCount', label: '已揭露的诱饵数', kind: 'count' }),

  // ── 暗中交易（dealingsInTheDark，扁平键）─────────────────────────────────
  Object.freeze({ path: 'cluesUnveiled', label: '「彰显的线索」', kind: 'count' }),
  Object.freeze({ path: 'eclipse', label: '日食数', kind: 'count' }),
  Object.freeze({ path: 'manuscriptWinner', label: '手稿争夺领先方', kind: 'text' }),
  Object.freeze({ path: 'talismanWinner', label: '护身符争夺领先方', kind: 'text' }),
  Object.freeze({ path: 'bazaarEntrance', label: '大扎入口地点', kind: 'text' }),
  Object.freeze({ path: 'bazaarEastGate', label: '东门地点', kind: 'text' }),
  Object.freeze({ path: 'twistedAntiprismFace', label: '扭曲反棱镜当前面', kind: 'text' }),
  Object.freeze({ path: 'twistedAntiprismBearer', label: '扭曲反棱镜持有者', kind: 'text' }),
  Object.freeze({ path: 'istanbulStudySuccess', label: '伊斯坦布尔大学研究已成功', kind: 'text' }),
  Object.freeze({ path: 'rooftopRepeats', label: '屋顶重复次数', kind: 'count' }),
  Object.freeze({ path: 'keyAwayWithEnemy', label: '密钥被敌人带走', kind: 'text' }),

  // ── 疯星乱舞（dancingMad，章节容器）──────────────────────────────────────
  Object.freeze({ path: 'dancingMad.mode', label: '剧本版本', kind: 'text' }),
  Object.freeze({ path: 'dancingMad.stance', label: '当前阵营姿态', kind: 'text' }),
  Object.freeze({ path: 'dancingMad.hollowsRemoved', label: '已移除的空洞', kind: 'count' }),
  Object.freeze({ path: 'dancingMad.revealedDesiderio', label: '德西已揭露', kind: 'text' }),
  Object.freeze({ path: 'dancingMad.cafeLunaFace', label: '月亮咖啡馆面', kind: 'text' }),
  Object.freeze({ path: 'dancingMad.pendingSetupReveals', label: '待布置揭示', kind: 'count' }),

  // ── 如履薄冰（onThinIce，章节容器）───────────────────────────────────────
  Object.freeze({ path: 'onThinIce.scoutingReports', label: '侦察报告', kind: 'count' }),
  Object.freeze({ path: 'onThinIce.wildernessOrder', label: '荒原顺序', kind: 'list' }),
  Object.freeze({ path: 'onThinIce.decoyExposed', label: '已揭露的诱饵数', kind: 'count' }),
  Object.freeze({ path: 'onThinIce.trueFormDefeated', label: '真实形态已被击败', kind: 'text' }),
  Object.freeze({ path: 'onThinIce.thorneVersion', label: '索恩版本', kind: 'text' }),
  Object.freeze({ path: 'onThinIce.outerWildernessOpened', label: '已开启外荒原', kind: 'text' }),
  Object.freeze({ path: 'onThinIce.exposedLocation', label: '已揭露地点', kind: 'text' }),

  // ── 战争疮痍（dogsOfWar，章节容器）───────────────────────────────────────
  Object.freeze({ path: 'dogsOfWar.variant', label: '章节版本', kind: 'text' }),
  Object.freeze({ path: 'dogsOfWar.branch', label: '当前分支', kind: 'text' }),
  Object.freeze({ path: 'dogsOfWar.keyResources', label: '钥匙节点资源', kind: 'count' }),
  Object.freeze({ path: 'dogsOfWar.claretKnightDefeated', label: '克拉雷骑士已被击败', kind: 'text' }),
  Object.freeze({ path: 'dogsOfWar.beastDefeated', label: '野兽已被击败', kind: 'text' }),
  Object.freeze({ path: 'dogsOfWar.pulses', label: '脉冲数', kind: 'count' }),
  Object.freeze({ path: 'dogsOfWar.lightOfPharosBearer', label: '法罗斯之光持有者', kind: 'text' }),
  Object.freeze({ path: 'dogsOfWar.keyLociDefeated', label: '钥匙节点已摧毁', kind: 'count' }),

  // ── 苦痛之影（shadesOfSuffering，章节容器）───────────────────────────────
  Object.freeze({ path: 'shadesOfSuffering.tzuInShadows', label: '朱三娘在阴影中', kind: 'text' }),
  Object.freeze({ path: 'shadesOfSuffering.tzuDoom', label: '朱三娘身上的毁灭', kind: 'count' }),
  Object.freeze({ path: 'shadesOfSuffering.removedGeists', label: '已移除的鬼魂', kind: 'count' }),
  Object.freeze({ path: 'shadesOfSuffering.interludeDone', label: '幕间已完成', kind: 'text' }),
  Object.freeze({ path: 'shadesOfSuffering.agenda3', label: '密谋 3 状态', kind: 'text' }),

  // ── 不留痕迹（withoutATrace，章节容器）───────────────────────────────────
  Object.freeze({ path: 'withoutATrace.shadows', label: '阴影三位置', kind: 'map' }),
  Object.freeze({ path: 'withoutATrace.hollowsDiscarded', label: '已弃掉的空洞', kind: 'count' }),
  Object.freeze({ path: 'withoutATrace.hollowsRemoved', label: '已移除的空洞', kind: 'count' }),
  Object.freeze({ path: 'withoutATrace.whistleBlown', label: '哨声已响', kind: 'text' }),
  Object.freeze({ path: 'withoutATrace.mimeticSpawned', label: '拟态克星已生成', kind: 'text' }),
  Object.freeze({ path: 'withoutATrace.reassemblerSpawned', label: '原生质重组者已生成', kind: 'text' }),
  Object.freeze({ path: 'withoutATrace.resolution', label: '结局键', kind: 'text' }),
  Object.freeze({ path: 'withoutATrace.entryCharges', label: '入场费已用', kind: 'count' }),
  Object.freeze({ path: 'withoutATrace.lairRevealed', label: '巢穴已揭示', kind: 'text' }),

  // ── 钥匙议会（congressOfTheKeys，章节容器）──────────────────────────────
  Object.freeze({ path: 'congressOfTheKeys.version3', label: '版本三', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.exposedDecoys', label: '已揭露的诱饵', kind: 'list' }),
  Object.freeze({ path: 'congressOfTheKeys.awardedKeys', label: '已发放的密钥', kind: 'list' }),
  Object.freeze({ path: 'congressOfTheKeys.vertexUnlocked', label: '塔顶已解锁', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.encounterDeckSwitched', label: '遭遇牌库已切换', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.hollowedCommitted', label: '已空洞的投入', kind: 'count' }),
  Object.freeze({ path: 'congressOfTheKeys.decision', label: '裁决结果', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.outcome', label: '议会结局', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.setupVersion', label: '布置版本', kind: 'text' }),
  Object.freeze({ path: 'congressOfTheKeys.doomOnNextAgenda', label: '下一密谋的毁灭', kind: 'count' }),
])
