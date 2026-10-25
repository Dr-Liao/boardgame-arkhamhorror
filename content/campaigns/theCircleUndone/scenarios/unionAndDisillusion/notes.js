// 本章账本：完全未实现的卡面子句（gaps）与忠实近似（approximations）。
// 放在 behavior.js 之外的独立文件里，保持 behavior.js 行数只减不增（architecture-guard）。
export const scenarioGaps = []

export const scenarioApproximations = [
  '结局 9/10 的 ReturnTo 分支不适用（本仓库无 ReturnTo 包）；结局 2（秘社胜）与结局 9（女巫集会胜）只写战役记录，战役结束与尾声由 P9 的战役 flow 接线。',
  '结局 XP 未在 resolution 里发放（引擎没有结局 XP 管线，P9 战役流程统一结算）。',
  '参考实现收齐的「远古恶魔」「寒冷刺骨」两个核组不在本战役包（TCU 只有 21 个遭遇组），相关遭遇卡不参与牌堆。',
  '4 张命运剧情卡没有「冒险参考牌底」原语：用 state.scenarioFlags.fateCards（{ code, ally, enemy, person, trail, resolved, seat } 纯 JSON）记录；幕 1 背面按玩家顺序发放并逐张结算，翻回敌人面用 spawnStoryEnemy 近似（表示层，本关没有能选中该卡的效果）。',
  '失踪人口：reference 用剧本日志的划掉标记区分「失踪/已死」；本实现按 missingPersons（空记录时视为 4 人全部失踪，等同 standalone）与 disappearedIntoTheMist/wasClaimedBySpecters 记录判断。',
  '共享 encounter-rules 的「幽灵敌人只能在幽灵地点被攻击/躲避」不适用于本章：UAD 的幽灵敌人（命运敌人/幽灵乌鸦/夜鸦）卡面没有该限制，behavior 覆盖 canFightEnemy/canEvadeEnemy 为恒可。',
  '灵怪陷阱在剧情中「不能进入」与未访之岛的「鬼灵迷雾」限制都用 behavior.investigatorEntryError 在未揭示时挡路；没有独立的通行原语。',
  '幕 3 背面按版本生成的敌人：v1「女巫的法术成功 → 安妮特·梅森」用目录卡 05057 的数值 spawnStoryEnemy；失败时生成 05090 女巫集会学徒；v3/v4 生成 05095 秘社新信徒（1–2 张）并在 josefIsAliveAndWell 时生成 05085 约瑟夫·梅吉尔（不可谈判以 flags.noParleyJosef 为唯一读点，谈判成功后翻面结算 05085b 的毁灭移除）。',
  '阵法检定难度 +2（立石闹鬼）用 state.scenarioFlags.circleDifficultyRound + testDifficultyModifier 近似「直到本轮结束」。',
]

