
## 08549 · 致命幻景 / Fatal Mirage
- type=scenario subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
### text
```
Easy / Standard
[skull]: -X. X is the number of story cards in the victory display.
[cultist]: -2. If you fail, place 1 of your clues on your location.
[tablet]: -3. If you fail, you must either move to the Prison of Memories, or shuffle the top card of the Tekeli-li deck into your deck without looking at it.
[elder_thing]: -4. If you fail, place 1 doom on an [[Eidolon]] enemy in play.
```
### backText
```
Hard / Expert
[skull]: -X. X is the current agenda number plus the number of story cards in the victory display.
[cultist]: -2. If you do not succeed by at least 2, place 1 of your clues on your location.
[tablet]: -4. If you fail, you must either move to the Prison of Memories, or shuffle the top card of the Tekeli-li deck into your deck without looking at it. (If you fail by 2 or more, do both instead.)
[elder_thing]: -5. If you fail, place 1 doom on an [[Eidolon]] enemy in play.
```
### textZh
```
简单/ 普通
[skull]：-X。X为胜利区中剧情卡牌的数量。
[cultist]：-2。如果你检定失败，将你的1个线索放到你所在地点。
[tablet]：-3。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。
[elder_thing]：-4。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。
```
### backTextZh
```
困难/专家
[skull]：-X。X为当前密谋编号加上胜利区中剧情卡牌的数量。
[cultist]：-2。如果你检定失败，或成功但没有超过难度至少2点，将你的1个线索放到你所在地点。
[tablet]：-4。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。(如果你检定失败且低于难度至少2点，改为两项都执行)。
[elder_thing]：-5。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。
```
### entry
```js
// 08549 致命幻景（混乱标记参考卡）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 场景参考卡：标记数值由 chaos.js/behavior.chaosTokenValue 实现。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08549',
  scope: 'scenario',
  implemented: true,
  flags: {
    tokenMeanings: {
      skull: '胜利区剧情卡牌数（困难/专家 + 当前密谋编号）',
      cultist: -2, tablet: -3, elderthing: -4,
    },
  },
}
```

## 08550 · 虚灵纠缠(版本一) / Ethereal Tangle (v. I)
- type=agenda subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=1
### text
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
### backText
```
Each remaining investigator is defeated and must shuffle the top card of the Tekeli-li deck into their deck.
```
### textZh
```
[free]受到1点恐惧：移动到记忆囚笼。
```
### backTextZh
```
剩余的每位调查员被击败，且必须将忒咳哩-哩牌库顶的1张卡牌混洗入自己的牌库。
```
### entry
```js
// 08550 虚灵纠缠（版本一）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 版本选择由 behavior.fatalMirageVersion / agendaCodeForVersion 决定。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08550',
  scope: 'agenda',
  implemented: true,
  agendaRule: { freeMoveToPrisonOfMemories: { cost: { horror: 1 } } },
  flags: { version: 1, agendaVersion: true },
}
```

## 08551 · 虚灵纠缠(版本二) / Ethereal Tangle (v. II)
- type=agenda subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=2
### text
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
### backText
```
Each remaining investigator is defeated and must either suffer 1 mental trauma or shuffle the top 2 cards of the Tekeli-li deck into their deck.
```
### textZh
```
[free]受到1点恐惧：移动到记忆囚笼。
```
### backTextZh
```
剩余的每位调查员被击败，且必须承受1点精神创伤，或者将忒咳哩-哩牌库顶的2张卡牌混洗入自己的牌库。
```
### entry
```js
// 08551 虚灵纠缠（版本二）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 版本选择由 behavior.fatalMirageVersion / agendaCodeForVersion 决定。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08551',
  scope: 'agenda',
  implemented: true,
  agendaRule: { freeMoveToPrisonOfMemories: { cost: { horror: 1 } } },
  flags: { version: 2, agendaVersion: true },
}
```

## 08552 · 虚灵纠缠(版本三) / Ethereal Tangle (v. III)
- type=agenda subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=3
### text
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
### backText
```
Each remaining investigator is defeated and suffers 1 mental trauma.
```
### textZh
```
[free]受到1点恐惧：移动到记忆囚笼。
```
### backTextZh
```
剩下的每位调查员被击败并承受1点精神创伤。
```
### entry
```js
// 08552 虚灵纠缠（版本三）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 版本选择由 behavior.fatalMirageVersion / agendaCodeForVersion 决定。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08552',
  scope: 'agenda',
  implemented: true,
  agendaRule: { freeMoveToPrisonOfMemories: { cost: { horror: 1 } } },
  flags: { version: 3, agendaVersion: true },
}
```

## 08553 · 旧事阴影(版本一) / Shadow of the Past (v. I)
- type=act subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=1
### text
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
### backText
```
(→R1)
```
### textZh
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
### backTextZh
```
(→结局1)
```
### entry
```js
// 08553 旧事阴影（版本一）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 目标：直面内心恶魔（通过把记忆剧情卡放入胜利区推进）；可多次重入。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08553',
  scope: 'act',
  implemented: true,
  actRule: {},
  flags: { version: 1, actVersion: true, repeatable: true },
}
```

## 08554 · 旧事阴影(版本二) / Shadow of the Past (v. II)
- type=act subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=2
### text
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
### backText
```
(→R1)
```
### textZh
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
### backTextZh
```
(→结局1)
```
### entry
```js
// 08554 旧事阴影（版本二）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 目标：直面内心恶魔（通过把记忆剧情卡放入胜利区推进）；可多次重入。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08554',
  scope: 'act',
  implemented: true,
  actRule: {},
  flags: { version: 2, actVersion: true, repeatable: true },
}
```

## 08555 · 旧事阴影(版本三) / Shadow of the Past (v. III)
- type=act subType=- encounterCode=fatal_mirage doubleSided=true pack=eoec quantity=1
- traits=[]
- stats: stage=3
### text
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
### backText
```
(→R1)
```
### textZh
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
### backTextZh
```
(→结局1)
```
### entry
```js
// 08555 旧事阴影（版本三）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 目标：直面内心恶魔（通过把记忆剧情卡放入胜利区推进）；可多次重入。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08555',
  scope: 'act',
  implemented: true,
  actRule: {},
  flags: { version: 3, actVersion: true, repeatable: true },
}
```

## 08556 · 记忆囚笼 / Prison of Memories
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Otherworld","Mirage"]
- stats: clues=3 shroud=-2
### text
```
Mirage 1 [per_investigator] (Base Camp, Deck of the Theodosia, University Halls).
X is the current agenda number.
```
### textZh
```
幻景1[per_investigator](大本营、菲奥多西亚号甲板、大学礼堂)。
X为当前密谋编号。
```
### entry
```js
// 08556 记忆囚笼
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08556',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "prisonOfMemories",
    "tier": 1,
    "startLocation": true
  },
}
```

## 08556b · 记忆囚笼 / Prison of Memories
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Put the set-aside Base Camp location into play.
- Put the set-aside Deck of the Theodosia location into play.
- Put the set-aside University Halls location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 将放在一边的大本营地点放置入场。
- 将放在一边的菲奥多西亚号甲板地点放置入场。
- 将放在一边的大学礼堂地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08556b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08556b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["baseCamp","deckOfTheTheodosia","universityHalls"], placeRevealed: true } },
}
```

## 08557 · 大本营 / Base Camp
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=3 shroud=4
### text
```
Mirage 1 [per_investigator] (Coastal Waters, Deserted Station, Riverview Theatre).
[reaction] When you would you fail a skill test by exactly 1 while investigating Base Camp, take 1 horror: You get +1 skill value for this test.
```
### textZh
```
幻景1[per_investigator](沿海水域、荒废车站、河景剧院)。
[reaction]你调查大本营时，在技能检定将要失败且正好低于难度1点时，受到1点恐惧：你本次检定得到技能值+1。
```
### backTextZh
```
选择一项：
- 跟随高田的记忆。将放在一边的沿海水域地点放置入场。
- 跟随伊里亚的记忆。将放在一边的荒废车站地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的河景剧院地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08557 大本营
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08557',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "baseCamp",
    "tier": 1,
    "reactionInvestigate": "failBy1Take1HorrorForPlus1"
  },
}
```

## 08557b · 大本营 / Base Camp
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Takada's memories. Put the set-aside Coastal Waters location into play.
- Follow Eliyah's memories. Put the set-aside Deserted Station location into play.
- Follow Dr. Sinha's memories. Put the set-aside Riverview Theatre location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随高田的记忆。将放在一边的沿海水域地点放置入场。
- 跟随伊里亚的记忆。将放在一边的荒废车站地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的河景剧院地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08557b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08557b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["coastalWaters","desertedStation","riverviewTheatre"], placeRevealed: true } },
}
```

## 08558 · 菲奥多西亚号甲板 / Deck of the Theodosia
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=3 shroud=1
### text
```
Mirage 1 [per_investigator] (Coastal Waters, Hedge Maze, Standing Stones).
Forced - When you investigate Deck of the Theodosia: You must either give it +2 shroud for this investigation, or spend 1 additional action to investigate it.
```
### textZh
```
幻景1[per_investigator](沿海水域、树篱迷宫、耸立岩石)。
强制 - 在你调查菲奥多西亚号甲板时：你必须使其在本次调查中得到+2隐藏值，或者额外花费1个行动来调查。
```
### entry
```js
// 08558 菲奥多西亚号甲板
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08558',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "deckOfTheTheodosia",
    "tier": 1,
    "forcedInvestigate": "harderShroudOrExtraAction"
  },
}
```

## 08558b · 菲奥多西亚号甲板 / Deck of the Theodosia
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Cookie's memories. Put the set-aside Coastal Waters location into play.
- Follow Ellsworth's memories. Put the set-aside Hedge Maze location into play.
- Follow Claypool's memories. Put the set-aside Standing Stones location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随曲奇的记忆。将放在一边的沿海水域地点放置入场。
- 跟随埃尔斯沃思的记忆。将放在一边的树篱迷宫地点放置入场。
- 跟随克莱普尔的记忆。将放在一边的耸立岩石地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08558b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08558b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["coastalWaters","hedgeMaze","standingStones"], placeRevealed: true } },
}
```

## 08559 · 大学礼堂 / University Halls
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=3 shroud=2
### text
```
Mirage 1 [per_investigator] (Elder Chamber, Riverview Theatre, Standing Stones).
Forced - When University Halls is flipped over: Each investigator discards the top 3 cards of their deck for each clue they spent. Each investigator draws each Tekeli-li weakness they discarded in this way. Shuffle each other weakness discarded in this way back into its owner's deck.
```
### textZh
```
幻景1[per_investigator](古老者厅室、河景剧院、耸立岩石)。
强制 - 在大学礼堂翻面时：每位调查员每花费一个线索，弃掉自己牌库顶3张卡牌。每位调查员抽取自己以此方式弃掉的所有忒咳哩-哩弱点。将其他所有以此方式弃掉的弱点混洗回所有者牌库。
```
### entry
```js
// 08559 大学礼堂
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08559',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "universityHalls",
    "tier": 1,
    "forcedReveal": "millDeckForTekeliliWeaknesses"
  },
}
```

## 08559b · 大学礼堂 / University Halls
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Danforth's memories. Put the set-aside Elder Chamber location into play.
- Follow Dr. Kensler's memories. Put the set-aside Riverview Theatre location into play.
- Follow Dyer's memories. Put the set-aside Standing Stones location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随丹佛斯的记忆。将放在一边的古老者厅室地点放置入场。
- 跟随肯斯勒博士的记忆。将放在一边的河景剧院地点放置入场。
- 跟随戴尔的记忆。将放在一边的耸立岩石地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08559b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08559b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["elderChamber","riverviewTheatre","standingStones"], placeRevealed: true } },
}
```

## 08560 · 树篱迷宫 / Hedge Maze
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=2
### text
```
Mirage 2 [per_investigator] (Mo'ai Statues).
Forced - After you investigate Hedge Maze during your turn: Increase its shroud value by 1 until the end of your turn. You cannot leave Hedge Maze this turn.
```
### textZh
```
幻景2[per_investigator](摩艾石像)。
强制 - 你回合期间，在你调查树篱迷宫后：直到你的回合结束，其隐藏值增加1点。本回合你不能离开树篱迷宫。
```
### entry
```js
// 08560 树篱迷宫
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08560',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "hedgeMaze",
    "tier": 2,
    "forcedAfterInvestigate": "shroudPlus1AndCannotLeave"
  },
}
```

## 08560b · 树篱迷宫 / Hedge Maze
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Put the set-aside Mo'ai Statues location into play.
Flip this card back over.
```
### textZh
```
将放在一边的摩艾石像地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08560b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08560b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["moaiStatues"], placeRevealed: true } },
}
```

## 08561 · 荒废车站 / Deserted Station
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=3
### text
```
Mirage 2 [per_investigator] (Alaskan Wilds).
Deserted Station gets +3 shroud while there is at least one treachery attached to it.
```
### textZh
```
幻景2[per_investigator](阿拉斯加荒野)。
荒废车站有诡计附属时，得到+3隐藏值。
```
### entry
```js
// 08561 荒废车站
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08561',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "desertedStation",
    "tier": 2,
    "shroudBonusIfTreacheryAttached": 3
  },
}
```

## 08561b · 荒废车站 / Deserted Station
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Put the set-aside Alaskan Wilds location into play.
Flip this card back over.
```
### textZh
```
将放在一边的阿拉斯加荒野地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08561b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08561b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["alaskanWilds"], placeRevealed: true } },
}
```

## 08562 · 沿海水域 / Coastal Waters
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=4 shroud=2
### text
```
Mirage 2 [per_investigator] (Airfield, Ottoman Front).
Forced - After you reveal a [frost] token while investigating Coastal Waters: Take 1 horror. If this investigation is successful, discover 1 additional clue at Coastal Waters. (Limit once per test.)
```
### textZh
```
幻景2[per_investigator](飞机场、奥斯曼前线)。
强制 - 你调查沿海水域时，在你揭示一个[frost]标记后：受到1点恐惧。如果本次调查成功，发现沿海水域额外1个线索。(每次检定仅限一次。)
```
### entry
```js
// 08562 沿海水域
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08562',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "coastalWaters",
    "tier": 2,
    "forcedOnFrostReveal": "take1HorrorThenExtraClueOnSuccess"
  },
}
```

## 08562b · 沿海水域 / Coastal Waters
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Takada's memories. Put the set-aside Airfield location into play.
- Follow Cookie's memories. Put the set-aside Ottoman Front location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随高田的记忆。将放在一边的飞机场地点放置入场。
- 跟随曲奇的记忆。将放在一边的奥斯曼前线地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08562b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08562b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["airfield","ottomanFront"], placeRevealed: true } },
}
```

## 08563 · 古老者厅室 / Elder Chamber
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=1
### text
```
Mirage 2 [per_investigator] (Cluttered Dormitory).
Forced - After you discover 2 or more clues from Elder Chamber during a single investigation or card effect: Shuffle the top card of the Tekeli-li deck into your deck.
```
### textZh
```
幻景2[per_investigator](凌乱宿舍)。
强制 - 单独一次调查或卡牌效果期间，在你从古老者厅室发现至少2个线索后：将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库。
```
### entry
```js
// 08563 古老者厅室
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08563',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "elderChamber",
    "tier": 2,
    "forcedOnCluesDiscovered": "shuffleTekeliliIntoDeck"
  },
}
```

## 08563b · 古老者厅室 / Elder Chamber
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Put the set-aside Cluttered Dormitory location into play.
Flip this card back over.
```
### textZh
```
将放在一边的凌乱宿舍地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08563b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08563b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["clutteredDormitory"], placeRevealed: true } },
}
```

## 08564 · 河景剧院 / Riverview Theatre
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=4 shroud=1
### text
```
Mirage 2 [per_investigator] (Dr. Kensler's Office, Infirmary).
Forced - When you draw a Tekeli-li card while at Riverview Theatre: Resolve its effects an additional time. Then, discover 1 clue at Riverview Theatre.
```
### textZh
```
幻景2[per_investigator](肯斯勒博士的办公室、医务室)。
强制 - 你在河景剧院抽取1张忒咳哩-哩卡牌时：额外结算一次其效果。然后，发现河景剧院的1个线索。
```
### entry
```js
// 08564 河景剧院
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08564',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "riverviewTheatre",
    "tier": 2,
    "forcedTekeliliDraw": "doubleEffectThenDiscoverClue"
  },
}
```

## 08564b · 河景剧院 / Riverview Theatre
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Dr. Kensler's memories. Put the set-aside Dr. Kensler's Office location into play.
- Follow Dr. Sinha's memories. Put the set-aside Infirmary location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随肯斯勒博士的记忆。将放在一边的肯斯勒博士的办公室地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的医务室地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08564b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08564b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["drKenslersOffice","infirmaryFatalMirage"], placeRevealed: true } },
}
```

## 08565 · 耸立岩石 / Standing Stones
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=4 shroud=2
### text
```
Mirage 2 [per_investigator] (The Black Stone, Dyer's Classroom).
Forced - After you reveal a [frost] token while investigating Standing Stones: Take 1 damage. If this investigation is successful, discover 1 additional clue at Standing Stones. (Limit once per test.)
```
### textZh
```
幻景2[per_investigator](黑色岩石、戴尔的教室)。
强制 - 你调查耸立岩石时，在你揭示一个[frost]后：受到1点伤害。如果本次调查成功，发现耸立岩石额外1个线索。(每次检定仅限一次。)
```
### entry
```js
// 08565 耸立岩石
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08565',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "standingStones",
    "tier": 2,
    "forcedOnFrostReveal": "take1DamageThenExtraClueOnSuccess"
  },
}
```

## 08565b · 耸立岩石 / Standing Stones
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
### text
```
Choose one:
- Follow Claypool's memories. Put the set-aside The Black Stone location into play.
- Follow Dyer's memories. Put the set-aside Dyer's Classroom location into play.
Flip this card back over.
```
### textZh
```
选择一项：
- 跟随克莱普尔的记忆。将放在一边的黑色岩石地点放置入场。
- 跟随戴尔的记忆。将放在一边的戴尔的教室地点放置入场。
将本卡牌翻面。
```
### entry
```js
// 08565b 幻景剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：把放在一边的下一层幻景地点揭示入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08565b',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyFlip: { choices: ["theBlackStone","dyersClassroom"], placeRevealed: true } },
}
```

## 08566 · 飞机场 / Airfield
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=4
### text
```
Mirage 2 [per_investigator] (Memory of a Missing Father).
While Takada Hiroko is at this location, it gets -2 shroud.
As an additional cost for you to investigate Airfield, you must spend 1 resource.
```
### textZh
```
幻景2[per_investigator](失踪父亲之记忆)。
高田弘子在本地点时，本地点得到-2隐藏。
作为调查飞机场的额外费用，你必须花费1资源。
```
### entry
```js
// 08566 飞机场
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08566',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "airfield",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "高田弘子",
      "amount": -2
    },
    "extraInvestigateCost": {
      "resources": 1
    }
  },
}
```

## 08566b · 飞机场 / Airfield
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Takada Hiroko is alive:
Spawn the set-aside Memory of a Missing Father enemy at this location.
Flip this card back over.
If Takada Hiroko is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果高田弘子活着：
在本地点生成放在一边的失踪父亲之记忆敌人。
将本卡牌翻面。
如果高田弘子被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08566b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08566b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08577', partner: '08595', victoryOnBanish: true },
  },
}
```

## 08567 · 阿拉斯加荒野 / Alaskan Wilds
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=3
### text
```
Mirage 2 [per_investigator] (Memory of a Hunt Gone Awry).
While Eliyah Ashevak is at this location, it gets -2 shroud.
As an additional cost for you to enter Alaskan Wilds, you must either shuffle the top card of the Tekeli-li deck into your deck, or spend 1 action.
```
### textZh
```
幻景2[per_investigator](狩猎失败之记忆)。
伊里亚·阿什瓦克在本地点时，本地点得到-2隐藏。
作为你进入阿拉斯加荒野的额外费用，你必须将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库，或者花费1个行动。
```
### entry
```js
// 08567 阿拉斯加荒野
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08567',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "alaskanWilds",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "伊里亚·阿什瓦克",
      "amount": -2
    },
    "moveCost": "shuffleTekeliliOrExtraAction"
  },
}
```

## 08567b · 阿拉斯加荒野 / Alaskan Wilds
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Eliyah Ashevak is alive:
Spawn the set-aside Memory of a Hunt Gone Awry enemy at this location.
Flip this card back over.
If Eliyah Ashevak is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果伊里亚·阿什瓦克活着：
在本地点生成放在一边的狩猎失败之记忆敌人。
将本卡牌翻面。
如果伊里亚·阿什瓦克被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08567b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08567b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08575', partner: '08589', victoryOnBanish: true },
  },
}
```

## 08568 · 凌乱宿舍 / Cluttered Dormitory
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=4
### text
```
Mirage 2 [per_investigator] (Memory of an Unspeakable Evil).
While Danforth is at this location, it gets -2 shroud.
Forced - When you resolve the revelation ability on a Tekeli-li card while at Cluttered Dormitory: Shuffle it back into your deck instead of placing it on the bottom of the Tekeli-li deck.
```
### textZh
```
幻景2[per_investigator](无法述说的恶魔之记忆)。
丹佛斯在本地点时，本地点得到-2隐藏。
强制 - 在你位于凌乱宿舍结算忒咳哩-哩卡牌上的显现能力时：不要将其放到忒咳哩-哩牌库底，改为混洗回你的牌库。
```
### entry
```js
// 08568 凌乱宿舍
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08568',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "clutteredDormitory",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "丹佛斯",
      "amount": -2
    },
    "forcedTekeliliReveal": "shuffleIntoDeckInsteadOfBottom"
  },
}
```

## 08568b · 凌乱宿舍 / Cluttered Dormitory
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Danforth is alive:
Spawn the set-aside Memory of an Unspeakable Evil enemy at this location.
Flip this card back over.
If Danforth is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果丹佛斯活着：
在本地点生成放在一边的无法述说的恶魔之记忆敌人。
将本卡牌翻面。
如果丹佛斯被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08568b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08568b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08580', partner: '08588', victoryOnBanish: true },
  },
}
```

## 08569 · 戴尔的教室 / Dyer's Classroom
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=5
### text
```
Mirage 2 [per_investigator] (Memory of a Regretful Voyage).
While Professor William Dyer is at this location, it gets -2 shroud.
[action] Shuffle the top card of the Tekeli-li deck into your deck: Heal 1 horror from an investigator or [[Ally]] asset at this location.
```
### textZh
```
幻景2[per_investigator](悔恨航程之记忆)。
威廉·戴尔教授在本地点时，本地点得到-2隐藏。
[action]将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库：治愈本地点的一位调查员或一个[[盟友]]支援1点恐惧。
```
### entry
```js
// 08569 戴尔的教室
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08569',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "dyersClassroom",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "威廉·戴尔教授",
      "amount": -2
    },
    "actionShuffleTekelili": "heal1Horror"
  },
}
```

## 08569b · 戴尔的教室 / Dyer's Classroom
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Professor William Dyer is alive:
Spawn the set-aside Memory of a Regretful Voyage enemy at this location.
Flip this card back over.
If Professor William Dyer is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果威廉·戴尔教授活着：
在本地点生成放在一边的悔恨航程之记忆敌人。
将本卡牌翻面。
如果威廉·戴尔教授被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08569b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08569b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08579', partner: '08587', victoryOnBanish: true },
  },
}
```

## 08570 · 医务室 / Infirmary
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=4
### text
```
Mirage 2 [per_investigator] (Memory of a Lost Patient).
While Dr. Mala Sinha is at this location, it gets -2 shroud.
Forced - After you enter Infirmary for the first time this game, if you have more than 6 remaining health: Take damage until you have exactly 6 remaining health. Otherwise, take 1 damage.
```
### textZh
```
幻景2[per_investigator](去世病人之记忆)。
玛拉·辛哈医生在本地点时，本地点得到-2隐藏。
强制 - 在本场游戏你第一次进入医务室后，如果你的剩余生命值超过6点：受到伤害直到你有正好6点剩余生命值。否则，受到1点伤害
```
### entry
```js
// 08570 医务室
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08570',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "infirmaryFatalMirage",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "玛拉·辛哈医生",
      "amount": -2
    },
    "forcedFirstEntry": "damageTo6RemainingHealth"
  },
}
```

## 08570b · 医务室 / Infirmary
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Dr. Mala Sinha is alive:
Spawn the set-aside Memory of a Lost Patient enemy at this location. Flip this card back over.
If Dr. Mala Sinha is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果玛拉·辛哈医生活着：
在本地点生成放在一边的去世病人之记忆敌人。
将本卡牌翻面。
如果玛拉·辛哈医生被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08570b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08570b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08576', partner: '08590', victoryOnBanish: true },
  },
}
```

## 08571 · 肯斯勒博士的办公室 / Dr. Kensler's Office
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=3
### text
```
Mirage 2 [per_investigator] (Memory of an Unrequited Love).
While Dr. Amy Kensler is at this location, it gets -2 shroud.
Forced - After you successfully investigate Dr. Kensler's Office: You must either take 1 horror, or remove 1 secret from an asset you control.
```
### textZh
```
幻景2[per_investigator](单恋之记忆)。
艾米·肯斯勒博士在本地点时，本地点得到-2隐藏。
强制 - 你成功调查肯斯勒博士的办公室后：你必须受到1点恐惧，或移除你控制的一个支援的1秘密。
```
### entry
```js
// 08571 肯斯勒博士的办公室
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08571',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "drKenslersOffice",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "艾米·肯斯勒博士",
      "amount": -2
    },
    "forcedAfterInvestigate": "horrorOrRemoveSecret"
  },
}
```

## 08571b · 肯斯勒博士的办公室 / Dr. Kensler's Office
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Dr. Amy Kensler is alive:
Spawn the set-aside Memory of an Unrequited Love enemy at this location. Flip this card back over.
If Dr. Amy Kensler is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果艾米·肯斯勒博士活着：
在本地点生成放在一边的单恋之记忆敌人。
将本卡牌翻面。
如果艾米·肯斯勒博士被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08571b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08571b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08583', partner: '08593', victoryOnBanish: true },
  },
}
```

## 08572 · 摩艾石像 / Mo'ai Statues
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=5
### text
```
Mirage 2 [per_investigator] (Memory of an Alien Translation).
While Roald Ellsworth is at this location, it gets -2 shroud.
Forced - When the revelation effect of a treachery attaches it to Mo'ai Statues: That treachery gains surge. (Limit once per phase.)
```
### textZh
```
幻景2[per_investigator](翻译异星文字之记忆)。
罗尔德·埃尔斯沃思在本地点时，本地点得到-2隐藏。
强制 - 在诡计卡牌的显现效果将其附属到摩艾石像时：该诡计获得涌动(每阶段仅限一次)。
```
### entry
```js
// 08572 摩艾石像
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08572',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "moaiStatues",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "罗尔德·埃尔斯沃思",
      "amount": -2
    },
    "forcedTreacheryAttach": "surgeOncePerPhase"
  },
}
```

## 08572b · 摩艾石像 / Mo'ai Statues
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Roald Ellsworth is alive:
Spawn the set-aside Memory of an Alien Translation enemy at this location.
Flip this card back over.
If Roald Ellsworth is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果罗尔德·埃尔斯沃思活着：
在本地点生成放在一边的翻译异星文字之记忆敌人。
将本卡牌翻面。
如果罗尔德·埃尔斯沃思被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08572b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08572b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08582', partner: '08594', victoryOnBanish: true },
  },
}
```

## 08573 · 奥斯曼前线 / Ottoman Front
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=4
### text
```
Mirage 2 [per_investigator] (Memory of a Ravaged Country).
While James "Cookie" Fredericks is at this location, it gets -2 shroud.
Each non-[[Elite]] enemy at Ottoman Front gets +2 fight and loses retaliate.
```
### textZh
```
幻景2[per_investigator](饱经战乱的国家之记忆)。
詹姆斯·“曲奇”·弗雷德里克斯在本地点时，本地点得到-2隐藏。
位于奥斯曼前线的每个非[[精英]]敌人得到+2攻击，并失去反击。
```
### entry
```js
// 08573 奥斯曼前线
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08573',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "ottomanFront",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "詹姆斯·“曲奇”·弗雷德里克斯",
      "amount": -2
    },
    "locationModifier": "nonEliteAttackPlus2NoRetaliate"
  },
}
```

## 08573b · 奥斯曼前线 / Ottoman Front
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If James "Cookie" Fredericks is alive:
Spawn the set-aside Memory of a Ravaged Country enemy at this location.
Flip this card back over.
If James "Cookie" Fredericks is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果詹姆斯·“曲奇”·弗雷德里克斯活着：
在本地点生成放在一边的饱经战乱的国家之记忆敌人。
将本卡牌翻面。
如果詹姆斯·“曲奇”·弗雷德里克斯被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08573b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08573b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08578', partner: '08592', victoryOnBanish: true },
  },
}
```

## 08574 · 黑色岩石 / The Black Stone
- type=location subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Mirage"]
- stats: clues=2 shroud=4
### text
```
Mirage 2 [per_investigator] (Memory of a Terrible Discovery).
While Avery Claypool is at this location, it gets -2 shroud.
[fast] Add 1 [frost] token to the chaos bag: Discover 2 clues at The Black Stone. (Group limit once per game.)
```
### textZh
```
幻景2[per_investigator](可怕发现之记忆)。
艾弗里·克莱普尔在本地点时，本地点得到-2隐藏。
[free]在混乱袋里加入1个[frost]标记：发现黑色岩石的2个线索(团队每场游戏仅限一次)。
```
### entry
```js
// 08574 黑色岩石
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08574',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "theBlackStone",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "艾弗里·克莱普尔",
      "amount": -2
    },
    "freeFrostForClues": {
      "clues": 2,
      "oncePerGame": true
    }
  },
}
```

## 08574b · 黑色岩石 / The Black Stone
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=2
### text
```
If Avery Claypool is alive:
Spawn the set-aside Memory of a Terrible Discovery enemy at this location. Flip this card back over.
If Avery Claypool is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
如果艾弗里·克莱普尔活着：
在本地点生成放在一边的可怕发现之记忆敌人。
将本卡牌翻面。
如果艾弗里·克莱普尔被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08574b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08574b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08581', partner: '08591', victoryOnBanish: true },
  },
}
```

## 08575 · 狩猎失败之记忆 / Memory of a Hunt Gone Awry
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=3 fight=5 evade=2 damage=1 horror=1
### text
```
Alert. Retaliate.
Prey - Investigator with Eliyah Ashevak.
[reaction] After you successfully evade this enemy by 3 or more: Deal it 3 damage.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
警戒。反击。
猎物 - 拥有伊里亚·阿什瓦克的调查员。
[reaction]在你成功躲避本敌人，且超过难度至少3点后：对其造成3点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08575 狩猎失败之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08575',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"retaliate":true,"preyPartner":"08589","flipOnDefeat":true} },
}
```

## 08575b · 狩猎失败之记忆 / Memory of a Hunt Gone Awry
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Eliyah has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Eliyah Ashevak is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下伊里亚直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括伊里亚·阿什瓦克或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08575b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08575b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08589', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08576 · 去世病人之记忆 / Memory of a Lost Patient
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=4 fight=3 evade=4 damage=1 horror=1
### text
```
Retaliate.
Prey - Investigator with Dr. Mala Sinha.
[reaction] After you heal 1 or more damage while this enemy is exhausted: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
反击。
猎物 - 拥有玛拉·辛哈医生的调查员。
[reaction]本敌人处于横置状态时，在你治愈1点或更多伤害后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08576 去世病人之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08576',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"retaliate":true,"preyPartner":"08590","reactionHealDamageBack":true,"flipOnDefeat":true} },
}
```

## 08576b · 去世病人之记忆 / Memory of a Lost Patient
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Dr. Sinha has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Dr. Mala Sinha is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下辛哈医生直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当玛拉·辛哈医生在一场冒险中被加入或使用时，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08576b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08576b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08590', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08577 · 失踪父亲之记忆 / Memory of a Missing Father
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=4 fight=3 evade=4 damage=1 horror=1
### text
```
Retaliate.
Prey - Investigator with Takada Hiroko.
[reaction] After you gain 1 or more resources while this enemy is exhausted: Deal 1 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
反击。
猎物 - 拥有高田弘子的调查员。
[reaction]本敌人处于横置状态时，在你获得资源后：对本敌人造成1点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08577 失踪父亲之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08577',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"retaliate":true,"preyPartner":"08595","reactionGainResourceDamage1":true,"flipOnDefeat":true} },
}
```

## 08577b · 失踪父亲之记忆 / Memory of a Missing Father
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Takada has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Takada Hiroko is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下高田直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当一场冒险期间包括高田弘子或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08577b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08577b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08595', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08578 · 饱经战乱的国家之记忆 / Memory of a Ravaged Country
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=3 fight=5 evade=3 damage=2 horror=1
### text
```
Retaliate.
Prey - Investigator with James "Cookie" Fredericks.
[reaction] After this enemy attacks you: Deal it 1 damage.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
反击。
猎物 - 拥有詹姆斯·“曲奇”·弗雷德里克斯的调查员。
[reaction]本敌人攻击你后：对其造成1点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08578 饱经战乱的国家之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08578',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"retaliate":true,"preyPartner":"08592","reactionAfterAttackDamage1":true,"flipOnDefeat":true} },
}
```

## 08578b · 饱经战乱的国家之记忆 / Memory of a Ravaged Country
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Cookie has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever James "Cookie" Fredericks is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下曲奇直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括詹姆斯·“曲奇”·弗雷德里克斯或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08578b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08578b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08592', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08579 · 悔恨航程之记忆 / Memory of a Regretful Voyage
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=5 fight=2 evade=5 damage=0 horror=1
### text
```
Retaliate.
Prey - Investigator with Dr. William Dyer.
[reaction] After you draw 1 or more cards while this enemy is exhausted: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
反击。
猎物 - 拥有威廉·戴尔博士的调查员。
[reaction]本敌人处于横置状态时，在你抽取1张或更多卡牌后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08579 悔恨航程之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08579',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"retaliate":true,"preyPartner":"08587","reactionDrawDamage":true,"flipOnDefeat":true} },
}
```

## 08579b · 悔恨航程之记忆 / Memory of a Regretful Voyage
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Dyer has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Professor William Dyer is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下戴尔直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括威廉·戴尔教授或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08579b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08579b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08587', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08580 · 无法述说的恶魔之记忆 / Memory of an Unspeakable Evil
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=3 fight=4 evade=4 damage=0 horror=2
### text
```
Alert. Retaliate.
Prey - Investigator with Danforth.
[action][action] Shuffle the top 3 cards of the Tekeli-li deck into your deck: Parley. Deal 3 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
警戒。反击。
猎物 - 拥有丹佛斯的调查员。
[action][action]将忒咳哩-哩牌库顶的3张卡牌混洗入你的牌库：谈判。对本敌人造成3点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08580 无法述说的恶魔之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08580',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"retaliate":true,"preyPartner":"08588","parleyShuffle3Damage3":true,"flipOnDefeat":true} },
}
```

## 08580b · 无法述说的恶魔之记忆 / Memory of an Unspeakable Evil
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Danforth has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Danforth is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下丹佛斯直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括丹佛斯或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08580b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08580b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08588', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08581 · 可怕发现之记忆 / Memory of a Terrible Discovery
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=4 fight=3 evade=3 damage=1 horror=1
### text
```
Alert.
Prey - Investigator with Avery Claypool.
[action] Add 1 [frost] token to the chaos bag: Parley. Deal 4 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
警戒。
猎物 - 拥有艾弗里·克莱普尔的调查员。
[action]在混乱袋里加入1个[frost]标记：谈判。对本敌人造成4点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08581 可怕发现之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08581',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"preyPartner":"08591","parleyAddFrostDamage4":true,"flipOnDefeat":true} },
}
```

## 08581b · 可怕发现之记忆 / Memory of a Terrible Discovery
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Claypool has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Avery Claypool is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下克莱普尔直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括艾弗里·克莱普尔或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08581b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08581b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08591', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08582 · 翻译异星文字之记忆 / Memory of an Alien Translation
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=4 fight=3 evade=5 damage=1 horror=1
### text
```
Alert.
Prey - Investigator with Roald Ellsworth.
[reaction] After this enemy is exhausted, if there is an attachment on its location: Deal 4 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
警戒。
猎物 - 拥有罗尔德·埃尔斯沃思的调查员。
[reaction]在本敌人被横置后，如果在其所在地点有附属：对本敌人造成4点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08582 翻译异星文字之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08582',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"preyPartner":"08594","reactionExhaustedWithAttachmentDamage4":true,"flipOnDefeat":true} },
}
```

## 08582b · 翻译异星文字之记忆 / Memory of an Alien Translation
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Ellsworth has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Roald Ellsworth is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下埃尔斯沃思直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括罗尔德·埃尔斯沃思或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08582b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08582b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08594', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08583 · 单恋之记忆 / Memory of an Unrequited Love
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Monster","Eidolon","Elite"]
- stats: health=3 fight=4 evade=3 damage=1 horror=1
### text
```
Alert.
Prey - Investigator with Dr. Amy Kensler.
[reaction] After you discover 1 or more clues at this enemy's location: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
### textZh
```
警戒。
猎物 - 拥有艾米·肯斯勒博士的调查员。
[reaction]在你发现本敌人所在地点的1个或更多线索后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```
### entry
```js
// 08583 单恋之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08583',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"preyPartner":"08593","reactionClueDiscoverDamage":true,"flipOnDefeat":true} },
}
```

## 08583b · 单恋之记忆 / Memory of an Unrequited Love
- type=story subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=[]
- stats: victory=1
### text
```
In your Campaign Log, record Dr. Kensler has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Dr. Amy Kensler is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
### textZh
```
在剧本日志中，记录下肯斯勒博士直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当一场冒险期间包括艾米·肯斯勒博士或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
### entry
```js
// 08583b 记忆敌人背面（直面内心恶魔）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：记录直面恶魔，并把该伙伴切换为坚毅（Resolute）版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08583b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { resolutePartner: '08593', victory: true, record: 'partnersFacedInnerDemon' },
  },
}
```

## 08584 · 恐怖阴影 / Horrifying Shade
- type=enemy subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=3
- traits=["Monster","Eidolon"]
- stats: health=3 fight=3 evade=3 damage=1 horror=1
### text
```
Aloof. Hunter.
While Horrifying Shade is at a location that is cleared of mirages, it loses aloof.
Forced - After you discover or take control of 1 or more clues at Horrifying Shade's location: Place an equal amount of doom on Horrifying Shade.
```
### textZh
```
冷漠。猎手。
恐怖阴影位于破除幻景的地点时，其失去冷漠。
强制 - 在你发现或控制恐怖阴影所在地点的至少1个线索后：在恐怖阴影上放置与该线索数量相等的毁灭标记。
```
### entry
```js
// 08584 恐怖阴影
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08584',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: false },
  flags: { eidolon: true, elite: false, memoryEnemy: false, ...{"aloof":true,"hunter":true,"losesAloofAtFlippedLocation":true,"doomOnClueDiscover":true} },
}
```

## 08585 · 易散之雾 / Evanescent Mist
- type=treachery subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=3
- traits=["Curse","Hazard"]
### text
```
Revelation - Attach Evanescent Mist to the nearest location that is not cleared of mirages. Place 2 clues on attached location.
In order to flip attached location over, investigators at attached location must either spend 2 additional clues as a group, or each take 2 damage.
Forced - If attached location is cleared of mirages: Discard Evanescent Mist.
```
### textZh
```
显现 - 将易散之雾附属到尚未破除幻景的最近地点。在附属地点上放置2个线索。
若要将附属地点翻面，位于附属地点的调查员必须共同花费额外2个线索，或者各自受到2点伤害。
强制 - 如果附属地点已破除幻景：弃掉易散之雾。
```
### entry
```js
// 08585 易散之雾
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 显现：附属到尚未破除幻景的最近地点并放 2 线索；翻面需共同花 2 线索或各受 2 伤害；地点破除幻景后弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08585',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { attachToNearestUnflippedLocation: true },
  flags: { attachLocationClues: 2, hazard: true, curse: true, discardWhenLocationFlipped: true },
}
```

## 08586 · 回首往事 / Anamnesis
- type=treachery subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=3
- traits=["Terror"]
### text
```
Peril.
Revelation - You must either (choose one):
- Take 2 horror.
- Place 1 doom on the current agenda. This effect can cause the current agenda to advance.
```
### textZh
```
险境。
显现 - 你必须(选择以下一项)：
- 受到2点伤害。
- 在当前密谋上放置1个毁灭标记。本效果能导致当前密谋推进。
```
### entry
```js
// 08586 回首往事
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 显现二选一：受 2 伤害，或在当前密谋上放 1 毁灭（可导致推进）。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08586',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { chooseOne: ['take2Damage', 'place1DoomOnAgenda'] },
  flags: { peril: true, terror: true },
}
```

## 08587 · 威廉·戴尔教授 / Professor William Dyer
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Miskatonic","Resolute"]
- stats: health=1
### text
```
Partner. Uses (3 secrets).
[fast] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.
```
### textZh
```
伙伴。使用(3秘密)。
[free]花费1秘密并横置威廉·戴尔教授：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点恐惧。
```
### entry
```js
// 08587 威廉·戴尔教授
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08587',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"reaction":"heal2HorrorAfterFreeSpend"} },
}
```

## 08588 · 丹佛斯 / Danforth
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Miskatonic","Resolute"]
- stats: health=2
### text
```
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 3 cards. Discard each Tekeli-li weakness drawn by this effect without resolving its effects.
```
### textZh
```
伙伴。使用(5秘密)。
[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费1秘密：该调查员抽取3张卡牌。弃掉由此效果抽取的所有忒咳哩-哩弱点，不要结算其效果。
```
### entry
```js
// 08588 丹佛斯
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08588',
  scope: 'storyAsset',
  implemented: true,
  uses: 5,
  usesType: 'secrets',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"reaction":"afterTekeliliResolvedDraw3DiscardWeaknesses"} },
}
```

## 08589 · 伊里亚·阿什瓦克 / Eliyah Ashevak
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Wayfarer","Resolute"]
- stats: health=4
### text
```
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 6. If you succeed, you may move to a connecting location.
```
### textZh
```
伙伴。使用(3秘密)。
[free]在你回合期间，花费1秘密并横置伊里亚·阿什瓦克：躲避。以基础值为6的[agility]尝试躲避。如果你检定成功，你可以移动到一个连接地点。
```
### entry
```js
// 08589 伊里亚·阿什瓦克
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08589',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'action', actionKind: 'evade', label: '花费 1 秘密并横置：以基础值 6 的敏捷躲避；成功可移动到连接地点', cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
      resolve: ({ inv, source, target, state, api }) => {
        api.evade(inv.seat, { enemyId: target?.id, skill: 'agility', baseValue: 6 })
        const result = api.testResult()
        if (!result?.success) return
        const destinations = api.moveDestinations(inv.seat)
        if (!destinations.length) return
        const destination = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: '08589', seat: inv.seat,
          prompt: '选择移动目的地。', options: destinations.map(id => ({ id, label: api.locName(id) })) })
        api.moveInvestigator(inv.seat, destination)
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"basicAction":"evadeBase6ThenMayMove"} },
}
```

## 08590 · 玛拉·辛哈医生 / Dr. Mala Sinha
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Wayfarer","Resolute"]
- stats: health=4
### text
```
Partner. Uses (3 supplies).
[fast] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.
```
### textZh
```
伙伴。使用(3补给)。
[free]花费1补给并横置玛拉·辛哈医生：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点伤害。
```
### entry
```js
// 08590 玛拉·辛哈医生
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08590',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"reaction":"heal2DamageAfterFreeSpend"} },
}
```

## 08591 · 艾弗里·克莱普尔 / Avery Claypool
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Wayfarer","Resolute"]
- stats: health=4
### text
```
Partner. Uses (3 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool: Cancel that token. Then, you must either reveal a new chaos token, or spend 1 supply.
```
### textZh
```
伙伴。使用(3补给)。
[reaction]你所在地点的一位调查员在技能检定期间揭示了一个[frost]标记时，横置艾弗里·克莱普尔：取消该标记。然后，你必须揭示一个新的混乱标记，或者花费1补给。
```
### entry
```js
// 08591 艾弗里·克莱普尔
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08591',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"reaction":"cancelFrostThenRevealOrSpendSupply"} },
}
```

## 08592 · 詹姆斯·“曲奇”·弗雷德里克斯 / James "Cookie" Fredericks
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Veteran","Wayfarer","Resolute"]
- stats: health=6
### text
```
Partner. Uses (3 ammo).
[fast] During your turn, spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 6. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.
```
### textZh
```
伙伴。使用(3子弹)。
[free] 在你回合期间，花费1子弹并横置詹姆斯·“曲奇”·弗雷德里克斯：攻击。以基础值为6的[combat]攻击。如果你检定成功，且被攻击敌人非[[精英]]，则直到本轮结束其不能攻击。
```
### entry
```js
// 08592 詹姆斯·“曲奇”·弗雷德里克斯
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08592',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'ammo',
  abilities: [
    { kind: 'action', actionKind: 'fight', label: '花费 1 子弹并横置：以基础值 6 的战斗攻击；成功且非精英则本轮不能攻击', cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        api.fight(inv.seat, target?.id, { baseValue: 6, onSuccess: ({ enemy }) => {
          if (enemy && !enemy.elite) api.addEffect({ duration: 'endOfRound', label: '曲奇：该敌人本轮不能攻击', sourceCode: '08592', controllerSeat: inv.seat, modifiers: [] })
        } })
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'ammo', partnerRules: {"basicAction":"fightBase6NonEliteCannotAttackThisRound"} },
}
```

## 08593 · 艾米·肯斯勒博士 / Dr. Amy Kensler
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Miskatonic","Resolute"]
- stats: health=3
### text
```
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Dr. Amy Kensler: Investigate. Investigate with a base [intellect] skill of 6. If you succeed, look at the top card of any investigator's deck or the encounter deck. You may discard that card.
```
### textZh
```
伙伴。使用(3秘密)。
[free]在你回合期间，花费1秘密并横置艾米·肯斯勒博士：调查。以基础值为6的[intellect]调查。如果你检定成功，查看任意一位调查员牌库顶的1张卡牌或遭遇牌库顶的1张卡牌。你可以弃掉该卡牌。
```
### entry
```js
// 08593 艾米·肯斯勒博士
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08593',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'action', actionKind: 'investigate', label: '花费 1 秘密并横置：以基础值 6 的智力调查；成功可查看牌库顶', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { skill: 'intellect', baseValue: 6 })
        if (api.testResult()?.success) api.lookAt(inv.seat, { zone: 'deck', count: 1 })
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"basicAction":"investigateBase6LookTopCard"} },
}
```

## 08594 · 罗尔德·埃尔斯沃思 / Roald Ellsworth
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Miskatonic","Wayfarer","Resolute"]
- stats: health=5
### text
```
Partner. Uses (3 supplies).
[fast] During an investigator's turn, either exhaust Roald Ellsworth or spend 1 supply: Choose a non-weakness treachery in play. Treat that treachery's text box as if it were blank until the end of this turn.
```
### textZh
```
伙伴。使用(3补给)。
[free]一位调查员的回合期间，横置罗尔德·埃尔斯沃思，或者花费1补给：选择场上一张非弱点诡计。将该诡计的印刷文本框视为如同空白，直到本回合结束。
```
### entry
```js
// 08594 罗尔德·埃尔斯沃思
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08594',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"free":"blankNonWeaknessTreacheryText"} },
}
```

## 08595 · 高田弘子 / Takada Hiroko
- type=asset subType=- encounterCode=fatal_mirage doubleSided=false pack=eoec quantity=1
- traits=["Ally","Wayfarer","Resolute"]
- stats: health=3
### text
```
Partner. Uses (9 resources).
[action] Exhaust Takada Hiroko: Gain 1 resource. Move up to 3 resources from Takada Hiroko to your resource pool.
```
### textZh
```
伙伴。使用(9资源)。
[action]横置高田弘子：获得1资源。将高田弘子上的最多3资源移动到你的资源池。
```
### entry
```js
// 08595 高田弘子
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08595',
  scope: 'storyAsset',
  implemented: true,
  uses: 9,
  usesType: 'resources',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'resources', partnerRules: {"action":"gain1ResourceMoveUpTo3"} },
}
```