# EOTE（《地球边缘》）卡面中英对照 dump（脚本生成，供人工复核；勿手改）

- 生成日期：2026-11-09；来源：`src/cards/cards-data.js`（pack=eoep/eoec，403 张）。
- 字段行号由 `docs/edgeOfTheEarth/translate/tools/cards-scan.mjs` 的源码块索引给出；`—` 表示该侧为空。
- `text`/`backText`/`flavor`/`backFlavor` 为英文原文（`flavor` 保留 en 原样，可能含 `<i>` 标签），`*Zh` 为本仓去标签后的简中。

## 08001 · Daniela Reyes / 丹妮拉·雷耶丝
- 行号：src/cards/cards-data.js:285384（name/nameZh） · src/cards/cards-data.js:285397（textZh） · src/cards/cards-data.js:285284（backTextZh）
- pack=eoep · type=investigator · subname=The Mechanic / 机修工
- traits: Entrepreneur  ||  经营者
- text EN:
```
[reaction] After an enemy attacks you (except an attack of opportunity you provoked), even if that attack was canceled: Either deal 1 damage to that enemy, or automatically evade it.
[elder_sign] effect: +1. If you were attacked by an enemy this round, you automatically succeed, instead.
```
- text ZH:
```
[reaction]敌人攻击你后(你触发的趁乱攻击除外)，即便该攻击被取消：对该敌人造成1点伤害，或自动躲避它。
[elder_sign]效果：+1。如果你本轮被敌人攻击过，改为自动成功。
```
- backText EN:
```
Deck Size: 30.
Deckbuilding Options: Guardian cards ([guardian]) level 0, Survivor cards ([survivor]) level 1-5, Neutral cards level 0-5, up to 5 other Survivor cards ([survivor]) level 0.
Deckbuilding Requirements (do not count toward deck size): Mechanic's Wrench, Mob Goons, 1 random basic weakness.
```
- backText ZH:
```
牌库卡牌张数：30。
牌库构建选项：守卫者卡牌([guardian])等级0，求生者卡牌([survivor])等级1-5，中立卡牌等级0-5，其他求生者卡牌([survivor])等级0最多5张。
牌库构建需求(不计入卡牌张数)：机修工的扳手、黑帮暴徒、1张随机基础弱点。
```
- flavor EN:
```
"Relax, tough guy. I'll handle this. You stand over there and look pretty."
```
- flavor ZH:
```
“放松，老兄。我来搞定这些。你好好站那看我来就行了。”
```
- backFlavor EN:
```
Daniela always figured she had a good life. She had a loving, boisterous family. She had a steady job that used her brains and her hands. She had enough money to spend on fast cars, pretty girls, and her motorcycle, Gabriel. Then her brother, Ramon, got caught up in some trouble. Her mother warned her to be careful, that darkness lay ahead. Daniela set a glass of water behind the door for her mother's sake, to catch evil spirits - just as she'd been taught as a child. When Daniela awoke to find it shattered, she was determined to figure out what happened and fix it. Just like she always did.
```
- backFlavor ZH:
```
丹妮拉一直认为她拥有美好的生活。她有一个可爱的、热闹的家庭。她有一份自力更生的稳定工作。她有足够的钱花在跑车、漂亮女孩儿和自己的摩托车加百列上。但之后她的哥哥拉蒙遇上了一些麻烦。母亲警告过她要小心，黑暗将会接踵而至。丹妮拉在门后放了一杯水——母亲小时候教导她，说这样能抓住恶灵。当丹妮拉醒来，发现瓶子碎了，她便决定去找到毛病的源头，然后将其修正，一如既往。
```

## 08002 · Mechanic's Wrench / 机修工的扳手
- 行号：src/cards/cards-data.js:285442（name/nameZh） · src/cards/cards-data.js:285465（textZh） · src/cards/cards-data.js:285415（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Melee  ||  道具 / 工具 / 近战
- text EN:
```
Daniela Reyes deck only.
[fast] Exhaust Mechanic's Wrench: Choose an enemy at your location. That enemy attacks you.
[action]: Fight. Use this ability only against an enemy that has attacked you since the end of your last turn. You get +2 [combat] for this attack and deal +1 damage for this attack.
```
- text ZH:
```
丹妮拉·雷耶丝牌库专用。
[free]横置机修工的扳手：选择你所在地点的一个敌人。该敌人攻击你。
[action]：攻击。本能力只能用于在你上一回合结束后，攻击过你的敌人。本次攻击你得到+2[combat]并且造成+1伤害。
```

## 08003 · Mob Goons / 黑帮暴徒
- 行号：src/cards/cards-data.js:285515（name/nameZh） · src/cards/cards-data.js:285535（textZh） · src/cards/cards-data.js:285486（backTextZh）
- pack=eoep · type=enemy
- traits: Humanoid / Criminal  ||  类人 / 罪犯
- text EN:
```
Hunter.
Prey - Daniela Reyes only.
This enemy's attacks cannot be canceled.
Damage/horror dealt by this enemy's attacks is treated as direct.
```
- text ZH:
```
猎手
猎物 - 仅限丹妮拉·雷耶丝
本敌人的攻击不能被取消。
本敌人攻击造成的伤害/恐惧将视为直接伤害/恐惧。
```
- flavor EN:
```
Debt is a family affair.
```
- flavor ZH:
```
债务也是家务事。
```

## 08004 · Norman Withers / 诺曼·威瑟斯
- 行号：src/cards/cards-data.js:285657（name/nameZh） · src/cards/cards-data.js:285670（textZh） · src/cards/cards-data.js:285556（backTextZh）
- pack=eoep · type=investigator · subname=The Astronomer / 天文学家
- traits: Miskatonic  ||  米斯卡塔尼克
- text EN:
```
Play with the top card of your deck revealed.
Once per round, you may play the top card of your deck as if it were in your hand, at -1 resource cost.
Forced - After a weakness is revealed while on top of your deck: Draw it.
[elder_sign] effect: +X. You may swap the top card of your deck with a card in your hand. X is the resource cost of the top card of your deck.
```
- text ZH:
```
你牌库顶的卡牌始终揭示。
每轮一次，你可以打出你牌库顶的卡牌(如同其是你的手牌)且其资源费用-1。
强制 - 在你的牌库顶揭示一张弱点后：将其抽取。
[elder_sign]效果：+X。你可以用一张手牌交换你牌库顶的卡牌。X为你牌库顶卡牌的资源费用。
```
- backText EN:
```
Deck Size: 30.
Deckbuilding Options: Seeker cards ([seeker]) level 0, Mystic cards ([mystic]) level 1-5, Neutral cards level 0-5, up to 5 other Mystic cards ([mystic]) level 0.
Deckbuilding Requirements (do not count toward deck size): Livre d'Eibon, The Harbinger, 1 random basic weakness.
```
- backText ZH:
```
牌库卡牌张数：30。
牌库构建选项：探求者卡牌([seeker])等级0，潜修者卡牌([mystic])等级1-5，中立卡牌等级0-5，其他潜修者卡牌([mystic])等级0最多5张。
牌库构建需求(不计入卡牌张数)：伊波恩之书、预示者、1张随机基础弱点。
```
- backFlavor EN:
```
The stars hold many secrets, and Norman was never one to ignore a mystery. So when six stars vanished from the sky, he simply couldn't let it go - not even when his colleagues told him he was just imaginging things. It took him years, and the near-death of his career, but he eventually found his answers in an ancient tome. It described the stars, and the sequence in which they would vanish, down to the very date and time. It was a sign, the book said, of the end of everything. It was the harbinger of a great beast that would tear asunder all that man had wrought. Norman isn't sure what he can do to stop the beast from destroying the world, but if the stars hold the answer, then he will find it.
```
- backFlavor ZH:
```
星星里藏有很多秘密，诺曼从不会忽略秘密。当六颗星星从天上消失时，诺曼简直无法接受——尽管他的同事告诉他那一切都是他的想象。他为此花费了好几年，还差点葬送职业生涯，但终于从一本古籍里找到了答案。它描述了星星以及它们消失的顺序，包括确切的日期和时间。书中说这是万物终结的一个信号。它预示了一只庞大的野兽将会撕碎人类所创造的一切。诺曼不知道该怎么做来阻止野兽摧毁世界，但如果星星知道答案，他将会找到答案。
```

## 08005 · Livre d'Eibon / 伊波恩之书
- 行号：src/cards/cards-data.js:285715（name/nameZh） · src/cards/cards-data.js:285741（textZh） · src/cards/cards-data.js:285688（backTextZh）
- pack=eoep · type=asset · subname=Hyperborean Grimoire / 北方乐土的魔法书
- traits: Item / Relic / Tome  ||  道具 / 遗物 / 书籍
- text EN:
```
Norman Withers deck only.
[fast] Exhaust Livre d'Eibon: Swap the top card of your deck with a card in your hand.
[fast] Exhaust Livre d'Eibon: Commit the top card of your deck to an eligible skill test performed by an investigator at your location.
```
- text ZH:
```
诺曼·威瑟斯牌库专用。
[free]横置伊波恩之书：用你一张手牌交换你牌库顶的卡牌。
[free]横置伊波恩之书：将你牌库顶的卡牌投入到你所在地点一位调查员执行的符合条件的技能检定中。
```

## 08006 · The Harbinger / 预示者
- 行号：src/cards/cards-data.js:285785（name/nameZh） · src/cards/cards-data.js:285807（textZh） · src/cards/cards-data.js:285762（backTextZh）
- pack=eoep · type=treachery
- traits: Omen / Endtimes  ||  征兆 / 终结
- text EN:
```
Revelation - Place this card on top of your deck.
While The Harbinger is revealed and on top of your deck, cards in your deck cannot be searched, drawn, or manipulated in any way except by the below ability.
[action] [action]: Discard The Harbinger. This ability may be activated while The Harbinger is on top of your deck, as if it were in your threat area.
```
- text ZH:
```
显现 - 将本卡牌置于你牌库顶。
你的牌库顶揭示了预示者时，除下方能力外，你牌库里的卡牌不能被查找、抽取，或以任何方式操纵。
[action][action]：弃掉预示者。预示者在你牌库顶时可以激活本能力，如同其在你的威胁区。
```

## 08007 · Monterey Jack / 蒙特雷·杰克
- 行号：src/cards/cards-data.js:285932（name/nameZh） · src/cards/cards-data.js:285945（textZh） · src/cards/cards-data.js:285831（backTextZh）
- pack=eoep · type=investigator · subname=The Archaeologist / 考古学家
- traits: Wayfarer  ||  旅人
- text EN:
```
[reaction] At the end of your turn, if you started this round 1 location away from your current location: Either gain 1 resource or draw 1 card (if you started this round 2 or more locations away, do both instead).
[elder_sign] effect: +1. If you started this round 1 or more locations away from your current location, gain 1 resource or draw 1 card.
```
- text ZH:
```
[reaction]当你的回合结束时，如果你本轮开始时的地点与你现在地点的连接次数为1：获得1资源或抽取1张卡牌(连接次数至少为2时，改为执行两项)
[elder_sign]效果：+1。如果你本轮开始时的地点与你现在地点的连接次数至少为1，获得1资源或抽取1张卡牌。
```
- backText EN:
```
Deck Size: 30.
Deckbuilding Options: Rogue cards ([rogue]) level 0, Seeker cards ([seeker]) level 1-5, Neutral cards level 0-5, up to 5 other Seeker cards ([seeker]) level 0.
Deckbuilding Requirements (do not count toward deck size): Trusty Bullwhip, Buried Secrets, 1 random basic weakness.
```
- backText ZH:
```
牌库卡牌张数：30。
牌库构建选项：流浪者卡牌([rogue])等级0，探求者卡牌([seeker])等级1-5，中立卡牌等级0-5，其他探求者卡牌([seeker])等级0最多5张。
牌库构建需求(不计入卡牌张数)：可靠的长鞭、被埋葬的秘密、1张随机基础弱点。
```
- backFlavor EN:
```
Young Jack traveled the world with his father's archaeological expeditions. Now a globe-trotting treasure hunter and an accomplished archaeologist in his own right, "Monterey" follows in his father's footsteps, securing the treasures of ancient civilizations and lost cultures. But after discovering a silver pendant with a familiar symbol on it, Monterey must explore his own past. Years ago, his father was found murdered with the very same sigil carved in his forehead. The image has haunted Monterey's dreams ever since. But he's getting close. He won't stop until he solves the mystery of his father's murder... no matter what it takes.
```
- backFlavor ZH:
```
年轻的杰克跟随他父亲一起考古探险，环游世界。而如今他已是遍历全球的寻宝猎人，同时也是一个出色的考古学家，“蒙特雷”跟随他父亲的脚步，保护着古代文明和失落文化的宝藏。但当蒙特雷发现了一个带有熟悉符号的银色吊坠后，他决定去探索自己的过去。很多年前，他的父亲被杀害了，额头带有同样的符号。自此之后，那个画面一直出现在蒙特雷的梦境里。他已经快接近真相了。在找出杀害他父亲的凶手前，他是不会停下脚步的……无论付出多少代价。
```

## 08008 · Trusty Bullwhip / 可靠的长鞭
- 行号：src/cards/cards-data.js:285990（name/nameZh） · src/cards/cards-data.js:286013（textZh） · src/cards/cards-data.js:285963（backTextZh）
- pack=eoep · type=asset
- traits: Item / Weapon / Melee  ||  道具 / 武器 / 近战
- text EN:
```
Fast. Monterey Jack deck only.
[action]: Fight. This attack uses [agility] instead of [combat]. If this attack succeeds, you may exhaust Trusty Bullwhip to either automatically evade the attacked enemy or deal +1 damage for this attack.
```
- text ZH:
```
快速。雷蒙特·杰克牌库专用。
[action]：攻击。本次攻击不使用[combat]，改为使用[agility]。如果本次攻击成功，你可以横置可靠的长鞭，以自动躲避受到攻击的敌人或使本次攻击+1伤害。
```

## 08009 · Buried Secrets / 被埋葬的秘密
- 行号：src/cards/cards-data.js:286057（name/nameZh） · src/cards/cards-data.js:286077（textZh） · src/cards/cards-data.js:286034（backTextZh）
- pack=eoep · type=treachery
- traits: Mystery  ||  神秘
- text EN:
```
Revelation - Put Buried Secrets into play in your threat area.
If your location can be investigated, you cannot move except by scenario card effects.
[action]: Investigate. If you succeed, instead of discovering clues, discard Buried Secrets. If you fail, you may take 2 horror to shuffle it into your deck.
```
- text ZH:
```
显现 - 将被埋葬的秘密放置入场，放到你的威胁区域中。
如果你所在的地点能被调查，除冒险卡牌效果外，你不能移动。
[action]：调查。如果你成功，不发现线索，改为弃掉被埋葬的秘密。如果你失败，你可以受到2点恐惧以将被埋葬的秘密洗回你的牌库。
```

## 08010 · Lily Chen / 陈丽丽
- 行号：src/cards/cards-data.js:286199（name/nameZh） · src/cards/cards-data.js:286212（textZh） · src/cards/cards-data.js:286096（backTextZh）
- pack=eoep · type=investigator · subname=The Martial Artist / 武术家
- traits: Chosen / Warden  ||  天选 / 监守
- text EN:
```
You begin the game with each Discipline in your deck in play, [[Unbroken]] side faceup.
[elder_sign] effect: +2. After this test ends, flip a [[Broken]] Discipline you control to its [[Unbroken]] side.
```
- text ZH:
```
游戏开始时，你牌库中的每张演武卡牌位于场上，[[运功]]面朝上。
[elder_sign]效果：+2。本次检定结束后，将一张你控制的[[破功]]演武翻至[[运功]]面。
```
- backText EN:
```
Deck Size: 30.
Deckbuilding Options: Mystic cards ([mystic]) level 0, Guardian cards ([guardian]) level 1-5, Neutral cards level 0-5, up to 5 other Guardian cards ([guardian]) level 0.
Deckbuilding Requirements (do not count toward deck size): 1 Burden of Destiny for each Discipline asset (see below), 1 random basic weakness.
Deckbuilding Restrictions: No [[Firearm]] assets.
Additional Requirements: At deck creation, choose a Discipline asset to add to your deck. It is considered part of your Deckbuilding Requirements. For every 15 experience you've earned in total, you may choose and add a different Discipline asset to your deck.
```
- backText ZH:
```
牌库卡牌张数：30。
牌库构建选项：潜修者卡牌([mystic])等级0，守卫者卡牌([guardian])等级1-5，中立卡牌等级0-5，其他守卫者卡牌([guardian])等级0最多5张。
牌库构建需求(不计入卡牌张数)：每张演武支援配1张命运重担(见下方)、1张随机基础弱点。
牌库构建限制：无[[枪械]]支援。
附加需求：当构建牌库时，选择一张演武支援加入到你的牌库。这也视作你牌库构建需求的一部分。每总计取得15点经验值，你可以选择一张不同的演武支援加入你的牌库。
```
- flavor EN:
```
"I have been preparing to confront this evil my entire life. My focus must be absolute."
```
- flavor ZH:
```
“我一生都在准备面对这个邪魔。吾意已决。”
```
- backFlavor EN:
```
Chen Li speaks rarely. When she does, her words are measured and wise. After a lifetime of disciplined training, every gesture is graceful, uncluttered by hesitation. The monks who raised her said that she was born for a special purpose, to face a great evil. Now, they believe that evil is at hand, and she is the only one who can stop it.
```
- backFlavor ZH:
```
陈丽丽话不多。一旦开口，必是倍加思量的金玉良言。经过一生的严格训练，她的每个动作都优雅而果断。养育她的高僧曾经说过，她的出生是为了对抗一个强大的恶魔。现在，他们相信恶魔即将到来，而她是唯一一个能够阻止恶魔的人。
```

## 08011a · Discipline / 演武
- 行号：src/cards/cards-data.js:286258（name/nameZh） · src/cards/cards-data.js:286278（textZh） · src/cards/cards-data.js:286232（backTextZh）
- pack=eoep · type=asset · subname=Alignment of Spirit / 心神合一
- traits: Unbroken  ||  运功
- text EN:
```
Lily Chen deck only. Permanent.
You get +1 [willpower].
[action]: Take 1 direct damage to heal 3 horror, or take 1 direct horror to heal 3 damage. Flip this asset over.
```
- text ZH:
```
陈丽丽牌库专用。永久。
你得到+1[willpower]。
[action]：受到1点直接伤害，以治愈3点恐惧；或受到1点直接恐惧，以治愈3点伤害。将本支援翻面。
```

## 08011b · Discipline / 演武
- 行号：src/cards/cards-data.js:286317（name/nameZh） · src/cards/cards-data.js:286329（textZh） · src/cards/cards-data.js:286295（backTextZh）
- pack=eoep · type=asset · subname=Alignment of Spirit / 心神合一
- traits: Broken  ||  破功
- text EN:
```
Lily Chen deck only. Permanent.
[reaction] After the round ends, if you took no damage or horror this round: Flip this asset over to its [[Unbroken]] side.
```
- text ZH:
```
陈丽丽牌库专用。永久。
[reaction]一轮结束后，如果你在本轮未受到伤害或恐惧：将本支援翻至[[运功]]面。
```

## 08012a · Discipline / 演武
- 行号：src/cards/cards-data.js:286372（name/nameZh） · src/cards/cards-data.js:286392（textZh） · src/cards/cards-data.js:286346（backTextZh）
- pack=eoep · type=asset · subname=Quiescence of Thought / 凝神静气
- traits: Unbroken  ||  运功
- text EN:
```
Lily Chen deck only. Permanent.
You get +1 [intellect].
[action]: If you have fewer than 5 cards in your hand: Draw cards until there are 5 cards in your hand. Flip this asset over.
```
- text ZH:
```
陈丽丽牌库专用。永久。
你得到+1[intellect]。
[action]如果你的手牌少于5张：抽取卡牌，直到你有5张手牌。将本支援翻面。
```

## 08012b · Discipline / 演武
- 行号：src/cards/cards-data.js:286431（name/nameZh） · src/cards/cards-data.js:286443（textZh） · src/cards/cards-data.js:286409（backTextZh）
- pack=eoep · type=asset · subname=Quiescence of Thought / 凝神静气
- traits: Broken  ||  破功
- text EN:
```
Lily Chen deck only. Permanent.
[reaction] After the round ends, if your hand did not have 2 or more cards in it at any point this round: Flip this asset over to its [[Unbroken]] side.
```
- text ZH:
```
陈丽丽牌库专用。永久。
[reaction]一轮结束后，如果本轮你的手牌从未有过2张或以上：将本支援翻至[[运功]]面。
```

## 08013a · Discipline / 演武
- 行号：src/cards/cards-data.js:286486（name/nameZh） · src/cards/cards-data.js:286506（textZh） · src/cards/cards-data.js:286460（backTextZh）
- pack=eoep · type=asset · subname=Prescience of Fate / 扭转乾坤
- traits: Unbroken  ||  运功
- text EN:
```
Lily Chen deck only. Permanent.
You get +1 [combat].
[action]: You get +5 skill value for the next skill test you perform this turn. After that skill test ends, flip this asset over. This action does not provoke attacks of opportunity.
```
- text ZH:
```
陈丽丽牌库专用。永久。
你得到+1[combat]。
[action]：本回合你下次执行的技能检定得到技能值+5。该技能检定结束后，将本支援翻面。本行动不会触发趁乱攻击。
```

## 08013b · Discipline / 演武
- 行号：src/cards/cards-data.js:286545（name/nameZh） · src/cards/cards-data.js:286557（textZh） · src/cards/cards-data.js:286523（backTextZh）
- pack=eoep · type=asset · subname=Prescience of Fate / 扭转乾坤
- traits: Broken  ||  破功
- text EN:
```
Lily Chen deck only. Permanent.
[reaction] After the round ends, if you performed no skill tests this round: Flip this asset over to its [[Unbroken]] side.
```
- text ZH:
```
陈丽丽牌库专用。永久。
[reaction]一轮结束后，如果你本轮没有执行技能检定：将本支援翻至[[运功]]面。
```

## 08014a · Discipline / 演武
- 行号：src/cards/cards-data.js:286600（name/nameZh） · src/cards/cards-data.js:286620（textZh） · src/cards/cards-data.js:286574（backTextZh）
- pack=eoep · type=asset · subname=Balance of Body / 稳如泰山
- traits: Unbroken  ||  运功
- text EN:
```
Lily Chen deck only. Permanent.
You get +1 [agility].
[action]: One at a time, take up to 3 different fight or evade actions. Flip this asset over. This action does not provoke attacks of opportunity.
```
- text ZH:
```
陈丽丽牌库专用。永久。
你得到+1[agility]。
[action]：依次执行最多3次不同的攻击或躲避行动。将本支援翻面。本行动不会触发趁乱攻击。
```

## 08014b · Discipline / 演武
- 行号：src/cards/cards-data.js:286659（name/nameZh） · src/cards/cards-data.js:286671（textZh） · src/cards/cards-data.js:286637（backTextZh）
- pack=eoep · type=asset · subname=Balance of Body / 稳如泰山
- traits: Broken  ||  破功
- text EN:
```
Lily Chen deck only. Permanent.
[reaction] After the round ends, if no enemies were at the same location as you at any point this round: Flip this asset over to its [[Unbroken]] side.
```
- text ZH:
```
陈丽丽牌库专用。永久。
[reaction]一轮结束后，如果本轮中从未有敌人与你处于同一地点：将本支援翻至[[运功]]面。
```

## 08015 · Burden of Destiny / 命运重担
- 行号：src/cards/cards-data.js:286711（name/nameZh） · src/cards/cards-data.js:286731（textZh） · src/cards/cards-data.js:286688（backTextZh）
- pack=eoep · type=treachery
- traits: Flaw  ||  缺陷
- text EN:
```
Revelation - You must either (choose one):
- Flip a Discipline you control to its [[Broken]] side. It cannot be flipped back this round.
- Take 1 damage and 1 horror.
```
- text ZH:
```
显现 - 你必须作出决定(选择以下一项)：
- 将一张你控制的演武翻至[[破功]]面。该卡牌本轮不能翻面。
- 受到1点伤害和1点恐惧。
```
- flavor EN:
```
"How can I save them if I can't even save myself?"
```
- flavor ZH:
```
“我连自己都拯救不了，如何去拯救他人”
```

## 08016 · Bob Jenkins / 鲍勃·詹金斯
- 行号：src/cards/cards-data.js:286849（name/nameZh） · src/cards/cards-data.js:286862（textZh） · src/cards/cards-data.js:286750（backTextZh）
- pack=eoep · type=investigator · subname=The Salesman / 推销员
- traits: Entrepreneur  ||  经营者
- text EN:
```
At any time, an investigator at your location may reveal to you the [[Item]] assets in their hand.
You may take an additional action during your turn, which can only be used to play an [[Item]] asset from the hand of an investigator at your location, under their control. (Both investigators may spend resources to pay its cost).
[elder_sign] effect: +1 for each [[Item]] asset you control.
```
- text ZH:
```
在任何时候，你所在地点的调查员可以向你揭示其手中的[[道具]]支援。
你可以在自己回合期间执行额外一个行动，该行动只能用于打出你所在地点一位调查员手中的一个[[道具]]支援，打出后置于该调查员控制之下。(你和该调查员都可以为支付该支援的费用花费资源。)
[elder_sign]效果：你每控制一张[[道具]]支援，+1。
```
- backText EN:
```
Deck Size: 30.
Deckbuilding Options: Survivor cards ([survivor]) level 0, Rogue cards ([rogue]) level 1-5, Neutral cards level 0-5, up to 5 other Rogue cards ([rogue]) level 0.
Deckbuilding Requirements (do not count toward deck size): Shrewd Dealings, Greed, 1 random basic weakness.
```
- backText ZH:
```
牌库卡牌张数：30。
牌库构建选项：求生者卡牌([survivor])等级0，流浪者卡牌([rogue])等级1-5，中立卡牌等级0-5，其他流浪者卡牌([rogue])等级0最多5张。
牌库构建需求(不计入卡牌张数)：精明的交易、贪婪、1张随机基础弱点。
```
- backFlavor EN:
```
According to Bob, the secret to success as a salesman is persistence. People just need to be told what it is that they want. Repeatedly. Recently, Bob came into possession of a handful of "cursed" golden coins, and he hopes the same persistence he so famously advocates will help him to uncover their origin and purpose. If he plays his cards right, maybe this will be his big score. Maybe he'll finally be able to retire and buy that boat he's had his eye on and spend the rest of his days fishing in a tropical paradise. Or maybe Bob will finally come to see all that glitters is not gold.
```
- backFlavor ZH:
```
鲍勃认为，推销员的成功取决于坚持不懈。你只需要一遍又一遍地告知别人他们想要的是什么。最近，鲍勃拥有了几枚“被诅咒”的金币，他希望自己一向声名在外的坚持能够发现金币的起源与出现的原因。如果他不出差错的话，这将是一大成就。也许干完这票，他终于能退休，买下自己一直想要的那艘船，在热带天堂钓鱼度过余生。也许到最后，鲍勃会发现那些闪闪发光的其实并不是黄金。
```

## 08017 · Shrewd Dealings / 精明的交易
- 行号：src/cards/cards-data.js:286908（name/nameZh） · src/cards/cards-data.js:286927（textZh） · src/cards/cards-data.js:286880（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Bob Jenkins deck only.
Reduce the cost of each [[Item]] asset you play by 1.
[reaction] When you play an [[Item]] asset: Play it under the control of any investigator at your location.
```
- text ZH:
```
鲍勃·詹金斯牌库专用。
你打出的每张[[道具]]支援费用-1。
[reaction]在你打出一张[[道具]]支援时：将其置于你所在地点的任意调查员控制下。
```
- flavor EN:
```
"You say the 'end of the world.' I hear 'business opportunity.'"
```
- flavor ZH:
```
“你说’末日来了‘，我只听到’商机来了‘。”
```

## 08018 · Greed / 贪婪
- 行号：src/cards/cards-data.js:286968（name/nameZh） · src/cards/cards-data.js:286988（textZh） · src/cards/cards-data.js:286944（backTextZh）
- pack=eoep · type=treachery
- traits: Flaw  ||  缺陷
- text EN:
```
Revelation - Take 1 horror. If you have...
- ...10 or fewer resources, take 1 additional horror.
- ...5 or fewer resources, take 1 additional horror.
- ...0 resources, take 1 additional horror.
```
- text ZH:
```
显现 - 受到1点恐惧。如果你有……
- ……10资源或更少，额外受到1点恐惧。
- ……5资源或更少，额外受到1点恐惧。
- ……0资源，额外受到1点恐惧。
```
- flavor EN:
```
Worshipped by its own cult, one might say.
```
- flavor ZH:
```
也许有人会说，自有信徒拜金。
```

## 08019 · Geared Up / 全副武装
- 行号：src/cards/cards-data.js:287028（name/nameZh） · src/cards/cards-data.js:287039（textZh） · src/cards/cards-data.js:287005（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
Forced - When your first turn of the game begins: One at a time, play any number of [[Item]] assets from your hand, reducing the cost of each by 1. During this turn, you have 3 fewer actions to take.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。
强制 - 在你游戏的第一个回合开始时：从手中打出任意张数的[[道具]]支援，每张费用-1。你本回合期间少进行三次行动。
```

## 08020 · Toe to Toe / 正面迎击
- 行号：src/cards/cards-data.js:287085（name/nameZh） · src/cards/cards-data.js:287096（textZh） · src/cards/cards-data.js:287057（backTextZh）
- pack=eoep · type=event
- traits: Spirit / Tactic  ||  勇气 / 策略
- text EN:
```
Fight. This attack deals +1 damage and is automatically successful. As an additional cost to perform this attack, the chosen enemy makes an attack against you.
```
- text ZH:
```
攻击。本次攻击造成+1伤害并自动成功。作为执行本次攻击的额外费用，所选敌人攻击你。
```
- flavor EN:
```
Sometimes, the only way out is through.
```
- flavor ZH:
```
干就完事了。
```

## 08021 · "Get behind me!" / “到我身后！”
- 行号：src/cards/cards-data.js:287143（name/nameZh） · src/cards/cards-data.js:287154（textZh） · src/cards/cards-data.js:287116（backTextZh）
- pack=eoep · type=event
- traits: Spirit / Tactic  ||  勇气 / 策略
- text EN:
```
Fast. Play during any [fast] window.
Until the end of the phase, whenever an enemy would attack another investigator at your location, it attacks you instead, then engages you. Cancel 1 horror dealt by each attack made in this way.
```
- text ZH:
```
快速。可在任何[free]时间段期间打出。
直到本阶段结束，每次敌人攻击你所在地点的另一位调查员时，改为攻击你，然后与你交战。取消每次这种攻击造成的1点恐惧。
```

## 08022 · Gang Up / 成群结队
- 行号：src/cards/cards-data.js:287202（name/nameZh） · src/cards/cards-data.js:287213（textZh） · src/cards/cards-data.js:287174（backTextZh）
- pack=eoep · type=event
- traits: Spirit / Synergy  ||  勇气 / 协作
- text EN:
```
Fight. For each different class among cards you control, you get +1 [combat] and deal +1 damage for this attack.
```
- text ZH:
```
攻击。你每控制一张不同职阶的卡牌，你本次攻击得到+1[combat]，造成+1伤害。
```
- flavor EN:
```
"You mess wit' one of us, you mess wit' all of us!"
```
- flavor ZH:
```
“你要是惹毛了我们之中的哪一个，就是招惹了我们全部人！”
```

## 08023 · Sweeping Kick / 扫堂腿
- 行号：src/cards/cards-data.js:287261（name/nameZh） · src/cards/cards-data.js:287272（textZh） · src/cards/cards-data.js:287233（backTextZh）
- pack=eoep · type=event
- traits: Spirit / Tactic / Trick  ||  勇气 / 策略 / 技巧
- text EN:
```
Fight. Add your [agility] to your skill value for this attack. This attack deals +1 damage. If you succeed, automatically evade the attacked enemy.
```
- text ZH:
```
攻击。本次攻击将你的[agility]加入你的技能值。本次攻击造成+1伤害。如果你成功，自动躲避受到本次攻击的敌人。
```
- flavor EN:
```
"Very good, Li. Now, again."
```
- flavor ZH:
```
“很好，丽丽。现在再来一次。”
```

## 08024 · Defensive Stance / 防御姿态
- 行号：src/cards/cards-data.js:287318（name/nameZh） · src/cards/cards-data.js:287329（textZh） · src/cards/cards-data.js:287294（backTextZh）
- pack=eoep · type=skill
- traits: Practiced / Expert  ||  精通 / 专家
- text EN:
```
While Defensive Stance is in your hand or committed to a skill test, it gains [combat] icons equal to your [agility], and [agility] icons equal to your [combat].
```
- text ZH:
```
防御姿态在你手中或投入到技能检定中时，其获得等于你[agility]的[combat]图标，以及等于你[combat]的[agility]图标。
```
- flavor EN:
```
You slide your feet into position, take a deep breath, and center yourself. They are many, but you are one.
```
- flavor ZH:
```
你迈开步子，架好姿势，深呼吸，站正了身子。敌人有很多，但你只有你自己。
```

## 08025 · Butterfly Swords / 蝴蝶对剑
- 行号：src/cards/cards-data.js:287377（name/nameZh） · src/cards/cards-data.js:287392（textZh） · src/cards/cards-data.js:287349（backTextZh）
- pack=eoep · type=asset
- traits: Item / Weapon / Melee  ||  道具 / 武器 / 近战
- text EN:
```
[action]: Fight. You get +1 [combat] for this attack. After this attack, you may exhaust Butterfly Swords to fight again, adding your [agility] to your skill value for that attack. That attack deals +1 damage.
```
- text ZH:
```
[action]：攻击。本次攻击你得到+1[combat]。本次攻击后，你可以横置蝴蝶对剑再次进行攻击，这次攻击将你的[agility]加入你的技能值。这次攻击造成+1伤害。
```
- flavor EN:
```
In a practiced grip, they are an extension of the empty hand.
```
- flavor ZH:
```
熟练操控，这就是延长的双手。
```

## 08026 · Dodge / 闪躲
- 行号：src/cards/cards-data.js:287441（name/nameZh） · src/cards/cards-data.js:287452（textZh） · src/cards/cards-data.js:287414（backTextZh）
- pack=eoep · type=event
- traits: Tactic  ||  策略
- text EN:
```
Fast. Play when an enemy attacks an investigator at your location.
Cancel that attack. Then, test [agility] (1). If you succeed, deal 1 damage to that enemy.
```
- text ZH:
```
快速。在一个敌人攻击你所在地点的一位调查员时打出。
取消该次攻击。然后，检定[agility](1)。如果你成功，对该敌人造成1点伤害。
```

## 08027 · Combat Training / 战斗训练
- 行号：src/cards/cards-data.js:287498（name/nameZh） · src/cards/cards-data.js:287510（textZh） · src/cards/cards-data.js:287470（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Composure  ||  才能 / 沉稳
- text EN:
```
Fast. Limit 1 [[Composure]] in play.
You get +1 [combat] and +1 [agility].
Non-direct damage/horror must be assigned to Combat Training before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [combat] or +1 [agility] for this skill test.
```
- text ZH:
```
快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[combat]和+1[agility]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给战斗训练。
[free]花费1资源：你本次技能检定得到+1[combat]或+1[agility]。
```

## 08028 · On the Hunt / 追猎行动
- 行号：src/cards/cards-data.js:287558（name/nameZh） · src/cards/cards-data.js:287569（textZh） · src/cards/cards-data.js:287530（backTextZh）
- pack=eoep · type=event
- traits: Tactic  ||  策略
- text EN:
```
Fast. Play when you would draw an encounter card during the mythos phase.
Instead, search the encounter deck for an enemy, spawn it engaged with you (instead of its normal spawn location), attach On the Hunt to it, and shuffle the encounter deck.
[reaction] When you defeat attached enemy: Gain 3 resources.
```
- text ZH:
```
快速。在神话阶段期间你将抽取遭遇卡牌时打出。
改为从遭遇牌库中查找一个敌人，将其生成并与你交战(而非在本来的位置生成它)，将追猎行动附属到该敌人上，并混洗遭遇牌库。
[reaction]在你击败被附属的敌人时：获得3资源。
```

## 08029 · Fang of Tyr'thrha / 提尔斯哈之牙
- 行号：src/cards/cards-data.js:287615（name/nameZh） · src/cards/cards-data.js:287626（textZh） · src/cards/cards-data.js:287587（backTextZh）
- pack=eoep · type=event
- traits: Spell  ||  法术
- text EN:
```
Fight. Choose an enemy at any revealed location as the target for this attack. Before resolving this attack, you may move to that enemy's location. Add your [agility] to your [combat] for this attack. This attack deals +3 damage.
```
- text ZH:
```
攻击。选择任何已揭示地点的一个敌人作为本次攻击的目标。在结算本次攻击前，你可以移动到该敌人的地点。本次攻击你的[combat]加上你的[agility]。本次攻击造成+3伤害。
```
- flavor EN:
```
The fangs of Tindalos reach any prey.
```
- flavor ZH:
```
廷达洛斯之牙不会放过任何猎物。
```

## 08030 · Butterfly Swords / 蝴蝶对剑
- 行号：src/cards/cards-data.js:287672（name/nameZh） · src/cards/cards-data.js:287687（textZh） · src/cards/cards-data.js:287644（backTextZh）
- pack=eoep · type=asset
- traits: Item / Weapon / Melee  ||  道具 / 武器 / 近战
- text EN:
```
[action]: Fight. You get +2 [combat] for this attack. After this attack, you may fight again, adding your [agility] to your skill value for that attack. If both attacks are successful, you may exhaust Butterfly Swords to have the second attack deal +1 damage.
```
- text ZH:
```
[action]：攻击。本次攻击你得到+2[combat]。本次攻击后，你可以再次攻击，这次攻击将你的[agility]加入你的技能值。如果两次攻击都成功，你可以横置蝴蝶对剑，使第二次攻击造成+1伤害。
```

## 08031 · Forced Learning / 强制学习
- 行号：src/cards/cards-data.js:287732（name/nameZh） · src/cards/cards-data.js:287743（textZh） · src/cards/cards-data.js:287709（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Ritual  ||  才能 / 仪式
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
Increase your deck size by 15.
During each upkeep phase, instead of drawing 1 card, draw 2 cards and discard 1 of them.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。
你的牌库卡牌张数+15。
补给阶段期间，不抽取一张卡牌，改为抽取两张并弃掉其中一张。
```

## 08032 · Jeremiah Kirby / 耶利米·科尔比
- 行号：src/cards/cards-data.js:287790（name/nameZh） · src/cards/cards-data.js:287807（textZh） · src/cards/cards-data.js:287763（backTextZh）
- pack=eoep · type=asset · subname=Arctic Archaeologist / 北极考古专家
- traits: Ally / Miskatonic / Wayfarer  ||  盟友 / 米斯卡塔尼克 / 旅人
- text EN:
```
You get +1 [intellect].
[reaction] After Jeremiah Kirby enters play, choose "even" or "odd:" Reveal the top 5 cards of your deck. Draw each card with a cost that matches the chosen option. Shuffle the remaining cards into your deck.
```
- text ZH:
```
你得到+1[intellect]。
[reaction]在耶利米·科尔比入场后，选择“偶数”或“奇数”：揭示你牌库顶的5张卡牌。抽取每张费用符合你选择的卡牌。将剩下的卡牌洗入你的牌库。
```

## 08033 · Archive of Conduits / 通路档案
- 行号：src/cards/cards-data.js:287855（name/nameZh） · src/cards/cards-data.js:287871（textZh） · src/cards/cards-data.js:287829（backTextZh）
- pack=eoep · type=asset · subname=Unidentified / 前路未知
- traits: Item / Tome / Occult  ||  道具 / 书籍 / 密教
- text EN:
```
Limit 1 per deck. As an additional cost to play this asset, place 1 resource on 4 different locations, as leylines.
[reaction] After you successfully investigate a location with a leyline, exhaust this asset: Move that leyline onto this asset. Then, if there are 4 leylines on it, discard it, take its leylines as resources, and record in your Campaign Log that "you have identified the gateway."
```
- text ZH:
```
每套牌库仅限1张。作为打出本支援的额外费用，在4个不同地点放置1个资源，作为灵脉。
[reaction]在你成功调查了一个带有灵脉的地点后，横置本支援：将该灵脉移动至本支援上。然后，如果本卡牌上有4个灵脉，将其弃掉，拿取本卡牌的灵脉作为资源，并在剧本日志里记录“你已经确认了前行道路”。
```

## 08034 · Written in the Stars / 繁星密语
- 行号：src/cards/cards-data.js:287919（name/nameZh） · src/cards/cards-data.js:287930（textZh） · src/cards/cards-data.js:287893（backTextZh）
- pack=eoep · type=event
- traits: Insight  ||  洞察
- text EN:
```
Fast. Play only during your turn.
Discard the top card of your deck. If that card is a weakness, shuffle it back into your deck. Otherwise, for the remainder of your turn, while that card is in your discard pile, commit it to each eligible skill test you perform.
```
- text ZH:
```
快速。只可在你的回合期间打出。
弃掉你牌库顶的1张卡牌。如果该卡牌是一张弱点，将它重新洗回你的牌库。否则在你回合剩余时间内，该卡牌在你的弃牌堆时，将它投入到你执行的每个符合条件的技能检定中。
```

## 08035 · Hiking Boots / 登山靴
- 行号：src/cards/cards-data.js:287974（name/nameZh） · src/cards/cards-data.js:287985（textZh） · src/cards/cards-data.js:287948（backTextZh）
- pack=eoep · type=asset
- traits: Item / Clothing / Footwear  ||  道具 / 服装 / 鞋子
- text EN:
```
Limit 1 [[Footwear]] per investigator.
You get +1 [agility].
[reaction] After the last clue is discovered from your location, exhaust Hiking Boots: Move to a connecting location with at least 1 clue, or to a connecting unrevealed location.
```
- text ZH:
```
每位调查员仅限1张[[鞋子]]。
你得到+1[agility]。
[reaction]你所在地点的最后一个线索被发现后，横置登山靴：移动到一个至少有1个线索，或未揭示的连接地点。
```

## 08036 · Join the Caravan / 加入马队
- 行号：src/cards/cards-data.js:288035（name/nameZh） · src/cards/cards-data.js:288046（textZh） · src/cards/cards-data.js:288007（backTextZh）
- pack=eoep · type=event
- traits: Insight / Synergy  ||  洞察 / 协作
- text EN:
```
Fast. Play only during your turn. Reduce the cost of this card by 1 for each different class among cards you control.
Move to any revealed location.
```
- text ZH:
```
快速。只可在你的回合期间打出。你每控制一张不同职阶的卡牌，本卡牌的费用减1。
移动到任意一个已揭示的地点。
```
- flavor EN:
```
The true journey is the one we take in our minds.
```
- flavor ZH:
```
心之所向才是真正的旅途。
```

## 08037 · Survey the Area / 地区勘测
- 行号：src/cards/cards-data.js:288090（name/nameZh） · src/cards/cards-data.js:288101（textZh） · src/cards/cards-data.js:288066（backTextZh）
- pack=eoep · type=skill
- traits: Practiced / Expert  ||  精通 / 专家
- text EN:
```
While Survey the Area is in your hand or committed to a skill test, it gains [intellect] icons equal to your [agility], and [agility] icons equal to your [intellect].
```
- text ZH:
```
地区探测在你手中或投入到技能检定中时，其获得等于你[agility]的[intellect]图标，以及等于你[intellect]的[agility]图标。
```
- flavor EN:
```
They won't believe you if you don't capture it on film. Hell, they probably still won't believe you.
```
- flavor ZH:
```
不拍到相片里就没有人会相信你。见鬼，他们可能还是会不相信你。
```

## 08038 · Medical Texts / 医学教科书
- 行号：src/cards/cards-data.js:288148（name/nameZh） · src/cards/cards-data.js:288163（textZh） · src/cards/cards-data.js:288121（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tome  ||  道具 / 书籍
- text EN:
```
[action]: Choose an investigator at your location and test [intellect] (2). If you succeed, heal 1 damage from that investigator (2 damage instead if you succeed by 2 or more). If you fail, you must either exhaust Medical Texts or deal 1 damage to that investigator.
```
- text ZH:
```
[action]：选择你所在地点的一位调查员并检定[intellect](2)。如果你成功，治愈该调查员1点伤害(如果你成功并超过难度至少2点，改为治愈2点伤害)。如果你失败，你必须横置医学教科书或对该调查员造成1点伤害。
```

## 08039 · Unearth the Ancients / 发掘古物
- 行号：src/cards/cards-data.js:288210（name/nameZh） · src/cards/cards-data.js:288221（textZh） · src/cards/cards-data.js:288183（backTextZh）
- pack=eoep · type=event
- traits: Insight  ||  洞察
- text EN:
```
Investigate. Choose up to 2 [seeker] assets in your hand. The difficulty of this skill test is equal to the combined cost of the chosen assets. If you succeed, put the chosen assets into play, one at a time. For each [[Relic]] asset put into play by this ability, draw 1 card.
```
- text ZH:
```
调查。选择你手中最多2张[seeker]支援。本次技能检定难度等于所选支援费用之和。如果你成功，将所选支援依次放置入场。通过本能力每放置入场一张[[遗物]]支援，抽取1张卡牌。
```

## 08040 · Scientific Theory / 科学理论
- 行号：src/cards/cards-data.js:288267（name/nameZh） · src/cards/cards-data.js:288279（textZh） · src/cards/cards-data.js:288239（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Composure  ||  才能 / 沉稳
- text EN:
```
Fast. Limit 1 [[Composure]] in play.
You get +1 [intellect] and +1 [combat].
Non-direct damage/horror must be assigned to Scientific Theory before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [intellect] or +1 [combat] for this skill test.
```
- text ZH:
```
快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[intellect]和+1[combat]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给科学理论。
[free]花费1资源：你本次技能检定得到+1[intellect]或+1[combat]。
```

## 08041 · Archive of Conduits / 通路档案
- 行号：src/cards/cards-data.js:288326（name/nameZh） · src/cards/cards-data.js:288342（textZh） · src/cards/cards-data.js:288299（backTextZh）
- pack=eoep · type=asset · subname=Gateway to Tindalos / 通向廷达洛斯
- traits: Ritual  ||  仪式
- text EN:
```
Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a non-[[Elite]] enemy.
[action]: Choose an investigator, and an enemy with a leyline at a revealed location. That investigator moves to that location. You may remove the leyline to deal 1 damage to that enemy.
```
- text ZH:
```
研究完成。使用(4灵脉)。每套牌库仅限1张。
[free]：从本支援上移动1灵脉到一个非[[精英]]敌人。
[action]：选择一位调查员和一个在已揭示地点且带有灵脉的敌人。该调查员移动到该地点。你可以移除该灵脉来对该敌人造成1点伤害。
```

## 08042 · Archive of Conduits / 通路档案
- 行号：src/cards/cards-data.js:288387（name/nameZh） · src/cards/cards-data.js:288403（textZh） · src/cards/cards-data.js:288360（backTextZh）
- pack=eoep · type=asset · subname=Gateway to Acheron / 通向冥河
- traits: Ritual  ||  仪式
- text EN:
```
Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a revealed location.
[action]: Choose an investigator and a revealed location with a leyline. That investigator moves to that location. You may remove the leyline to have them take an investigate action.
```
- text ZH:
```
研究完成。使用(4灵脉)。每套牌库仅限1张。
[free]：从本支援上移动1灵脉到一个已揭示地点。
[action]：选择一位调查员和一个带有灵脉的已揭示地点。该调查员移动到该地点。你可以移除该灵脉来让该调查员执行一次调查行动。
```

## 08043 · Archive of Conduits / 通路档案
- 行号：src/cards/cards-data.js:288448（name/nameZh） · src/cards/cards-data.js:288464（textZh） · src/cards/cards-data.js:288421（backTextZh）
- pack=eoep · type=asset · subname=Gateway to Aldebaran / 通往毕宿五
- traits: Ritual  ||  仪式
- text EN:
```
Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to a non-[[Elite]] enemy.
[action]: Choose an investigator engaged with an enemy with a leyline. That investigator disengages from that enemy and moves to a connecting location. You may remove the leyline to automatically evade that enemy. This action does not provoke attacks of opportunity.
```
- text ZH:
```
研究完成。使用(4灵脉)。每套牌库仅限1张。
[free]：从本支援上移动1灵脉到一个非[[精英]]敌人。
[action]：选择一位与带有灵脉的敌人交战的调查员。该调查员与带有灵脉的一个敌人解除交战，并移动至一个连接地点。你可以移除该灵脉来自动躲避该敌人。本行动不会触发趁乱攻击。
```

## 08044 · Archive of Conduits / 通路档案
- 行号：src/cards/cards-data.js:288509（name/nameZh） · src/cards/cards-data.js:288525（textZh） · src/cards/cards-data.js:288482（backTextZh）
- pack=eoep · type=asset · subname=Gateway to Paradise / 通往天堂
- traits: Ritual  ||  仪式
- text EN:
```
Researched. Uses (4 leylines). Limit 1 per deck.
[fast]: Move 1 leyline from this asset to an investigator.
[action]: Choose an investigator with a leyline. That investigator draws 1 card and heals 1 damage or 1 horror. You may remove the leyline to have them instead draw 2 cards and heal 2 damage or 2 horror.
```
- text ZH:
```
研究完成。使用(4灵脉)。每套牌库仅限1张。
[free]：从本支援上移动1灵脉到一位调查员上。
[action]：选择一位带有灵脉的调查员。该调查员抽取1张卡牌并治愈1点伤害或恐惧。你可以移除该灵脉来使该调查员改为抽取2张卡牌并治愈2点伤害或恐惧。
```

## 08045 · Prophesiae Profana / 亵渎预言
- 行号：src/cards/cards-data.js:288569（name/nameZh） · src/cards/cards-data.js:288585（textZh） · src/cards/cards-data.js:288543（backTextZh）
- pack=eoep · type=asset · subname=Atlas of the Unknowable / 未知地图集
- traits: Item / Relic / Tome  ||  道具 / 遗物 / 书籍
- text EN:
```
While you are not at the locus, you get +1 [intellect], +1 [agility], and you may ignore attacks of opportunity.
[reaction] After Prophesiae Profana enters play: Choose a revealed location. That location is "the locus" until Prophesiae Profana leaves play.
[action]: Move any investigator to the locus.
```
- text ZH:
```
你不在坐标点时，你得到+1[intellect]和+1[agility]，并且你可以忽略趁乱攻击。
[reaction]在亵渎预言入场后：选择一个已揭示地点。该地点是“坐标点”，直到亵渎预言离场。
[action]：移动任意一位调查员至坐标点。
```

## 08046 · Underworld Support / 地下支持
- 行号：src/cards/cards-data.js:288630（name/nameZh） · src/cards/cards-data.js:288641（textZh） · src/cards/cards-data.js:288607（backTextZh）
- pack=eoep · type=asset
- traits: Favor / Illicit  ||  恩惠 / 违法
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
Your deck cannot include more than 1 copy of each non-weakness, non-signature card (by title).
Reduce your deck size by 5.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。你的牌库中每张非弱点、非署名卡牌最多只能有一张(以卡牌名称区别)。
你的牌库卡牌张数减5。
```

## 08047 · Scout Ahead / 提前侦察
- 行号：src/cards/cards-data.js:288688（name/nameZh） · src/cards/cards-data.js:288699（textZh） · src/cards/cards-data.js:288661（backTextZh）
- pack=eoep · type=event
- traits: Insight / Trick  ||  洞察 / 技巧
- text EN:
```
Move. Move up to 3 times. Enemies do not engage you during this movement.
```
- text ZH:
```
移动。移动最多3次。该移动期间敌人不会与你交战。
```
- flavor EN:
```
"... a viewless aura repelled me and bade me retreat from antique and sinister secrets that no man should see, and no man else had ever dared to see." - H. P. Lovecraft, "The Nameless City"
```
- flavor ZH:
```
“……一种无形的气息抗拒着我，并让我远离这些古老而凶险的秘密，这些秘密不应为人所知，也未曾有人所知。”H.P.洛夫克拉夫特，《无名之城》
```

## 08048 · 21 or Bust / 21点
- 行号：src/cards/cards-data.js:288746（name/nameZh） · src/cards/cards-data.js:288757（textZh） · src/cards/cards-data.js:288719（backTextZh）
- pack=eoep · type=event
- traits: Fortune / Gambit  ||  幸运 / 局势
- text EN:
```
One at a time, reveal random tokens from the chaos bag until you choose to stop. Treat each [skull], [cultist], [tablet], or [elder_thing] as a 5; the [auto_fail] as a 10; and the [elder_sign] as either a 1 or an 11. If the combined value of those tokens (ignoring +/-) is...
- ...18 or less, gain 4 resources.
- ...19, gain 5 resources.
- ...20, gain 6 resources.
- ...21, gain 9 resources.
```
- text ZH:
```
依次随机揭示任意个混乱标记，直到你自己选择停下。[skull]、[cultist]、[tablet]或[elder_thing]视作5；[auto_fail]视作10；[elder_sign]可视作1或11。如果这些标记的总和(忽视+/-)是……
- ……18或更少，获得4资源。
- ……19，获得5资源。
- ……20，获得6资源。
- ……21，获得9资源。
```

## 08049 · Counterespionage / 反间谍活动
- 行号：src/cards/cards-data.js:288803（name/nameZh） · src/cards/cards-data.js:288814（textZh） · src/cards/cards-data.js:288777（backTextZh）
- pack=eoep · type=event
- traits: Favor / Service  ||  恩惠 / 服务
- text EN:
```
Fast. Play when you draw a non-weakness treachery.
Cancel that card's revelation effect and draw the top card of the encounter deck.
[reaction] When you play Counterespionage, increase its cost by 2: Change "the encounter deck" to "your deck".
[reaction] When you play Counterespionage, increase its cost by 2: Change "you" to "any investigator".
```
- text ZH:
```
快速。在你抽取一张非弱点的诡计时打出。
取消该卡牌的显现效果并抽取遭遇牌库顶的卡牌。
[reaction]在你打出反间谍活动时，提升其费用2点：将“遭遇牌库”换成“你的牌库”。
[reaction]在你打出反间谍活动时，提升其费用2点：将“你”换成“任意调查员”。
```

## 08050 · Cheat the System / 欺骗制度
- 行号：src/cards/cards-data.js:288862（name/nameZh） · src/cards/cards-data.js:288873（textZh） · src/cards/cards-data.js:288834（backTextZh）
- pack=eoep · type=event
- traits: Trick / Synergy  ||  技巧 / 协作
- text EN:
```
Fast. Play during any [fast] window.
Gain 1 resource for each different class among cards you control.
```
- text ZH:
```
快速。可在任意[free]时间段期间打出。
你每控制一张不同职阶的卡牌，获得1资源。
```
- flavor EN:
```
If you weren't supposed to do it, it wouldn't be legal.
```
- flavor ZH:
```
要是有什么事是你不该做的，那它当然不会合法。
```

## 08051 · Untimely Transaction / 不当交易
- 行号：src/cards/cards-data.js:288920（name/nameZh） · src/cards/cards-data.js:288931（textZh） · src/cards/cards-data.js:288893（backTextZh）
- pack=eoep · type=event
- traits: Favor  ||  恩惠
- text EN:
```
Reveal an [[Item]] asset in your hand. Another investigator at your location may play that asset as if it were in their hand. If they do, draw 1 card and gain resources equal to that asset's printed cost.
```
- text ZH:
```
揭示你手中的一张[[道具]]支援。你所在地点的另一位调查员可以打出该支援，如同其是自己手牌。如果该调查员选择打出，你抽取一张卡牌并获得该支援印刷费用的资源。
```
- flavor EN:
```
"Really? You're going to haggle with me now?"
```
- flavor ZH:
```
“真的嘛？现在要跟我讨价还价了？”
```

## 08052 · Savant / 行业专家
- 行号：src/cards/cards-data.js:288975（name/nameZh） · src/cards/cards-data.js:288986（textZh） · src/cards/cards-data.js:288949（backTextZh）
- pack=eoep · type=skill
- traits: Innate / Developed  ||  天性 / 熟练
- text EN:
```
Savant gains [wild] icons equal to your lowest skill other than the skill being tested.
```
- text ZH:
```
行业专家获得等于你最低技能值的[wild]图标(除正在检定的技能外)。
```
- flavor EN:
```
Fifty percent luck, a hundred percent skill.
```
- flavor ZH:
```
五十分的运气，一百分的实力。
```

## 08053 · The Red Clock / 红色闹钟
- 行号：src/cards/cards-data.js:289032（name/nameZh） · src/cards/cards-data.js:289048（textZh） · src/cards/cards-data.js:289006（backTextZh）
- pack=eoep · type=asset · subname=Broken but Reliable / 损坏却可靠
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
Exceptional. Uses (0 charges).
Forced - After your turn begins: Either place 1 charge here, or take all charges here, as resources. Then, if it has exactly...
- 1 charge, you get +3 skill value for your next skill test.
- 2 charges, you may move up to 2 times.
- 3 charges, you may take an additional action this turn.
```
- text ZH:
```
卓越。使用(0充能)。
强制 - 在你的回合开始后：在此放置1充能，或拿取此处所有充能作为资源。然后，如果它恰好拥有……
- 1充能，下次技能检定中你得到技能值+3。
- 2充能，你可以移动最多2次。
- 3充能，你本回合可以进行1次额外行动。
```

## 08054 · Money Talks / 金钱万能
- 行号：src/cards/cards-data.js:289094（name/nameZh） · src/cards/cards-data.js:289105（textZh） · src/cards/cards-data.js:289068（backTextZh）
- pack=eoep · type=event
- traits: Favor / Gambit  ||  恩惠 / 局势
- text EN:
```
Fast. Play when an investigator at any location initiates a skill test.
Instead of the skill type indicated for this test ([willpower], [intellect], [combat], or [agility]), this is a resource skill test. The performing investigator's base skill value for this test is equal to half the number of resources in your resource pool (rounded down). Draw 1 card.
```
- text ZH:
```
快速。在任意地点一位调查员发动技能检定时打出。
本次检定不是其标识的技能类型([willpower]、[intellect]、[combat]或[agility])，而是改为资源技能检定。执行检定的调查员的基础技能值等于你资源池内资源数的一半(向下取整)。抽取1张卡牌。
```

## 08055 · Black Market / 黑市
- 行号：src/cards/cards-data.js:289149（name/nameZh） · src/cards/cards-data.js:289160（textZh） · src/cards/cards-data.js:289125（backTextZh）
- pack=eoep · type=event
- traits: Favor  ||  恩惠
- text EN:
```
Fast. Play at the start of the investigation phase.
One at a time, reveal cards from the top of any investigator deck(s) until exactly 5 cards have been revealed. Set those cards aside, out of play. While set aside, any investigator may play any of those cards as if they were in their hand. At the start of the next investigation phase, shuffle each of those cards still set aside into its owner's deck.
```
- text ZH:
```
快速。当调查阶段开始时打出。
从任意位调查员的牌库顶依次揭示卡牌，直到正好揭示5张卡牌。将这些卡牌放在一边，位于场外。这些卡牌放在一边时，任意调查员可以将其打出，如同是自己手牌。当下个调查阶段开始时，将这些卡牌中仍放在一边的洗回其所有者的牌库。
```

## 08056 · Moxie / 刚毅果敢
- 行号：src/cards/cards-data.js:289206（name/nameZh） · src/cards/cards-data.js:289218（textZh） · src/cards/cards-data.js:289178（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Composure  ||  才能 / 沉稳
- text EN:
```
Fast. Limit 1 [[Composure]] in play.
You get +1 [willpower] and +1 [agility].
Non-direct damage/horror must be assigned to Moxie before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [willpower] or +1 [agility] for this skill test.
```
- text ZH:
```
快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[willpower]和+1[agility]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给刚毅果敢。
[free]花费1资源：你本次技能检定得到+1[willpower]或+1[agility]。
```

## 08057 · The Black Fan / 黑色扇子
- 行号：src/cards/cards-data.js:289269（name/nameZh） · src/cards/cards-data.js:289285（textZh） · src/cards/cards-data.js:289238（backTextZh）
- pack=eoep · type=asset · subname=Symbol of Power / 力量的象征
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
Exceptional.
While you have...
- ...10+ resources, you get +1 health and +1 sanity.
- ...15+ resources, you may take one additional action during your turn.
- ...20+ resources, you get +1 to each of your skills.
```
- text ZH:
```
卓越。
你拥有……(时)
- ……10+资源，你得到+1生命和+1神智。
- ……15+资源，在你回合期间你可以额外执行一次行动。
- ……20+资源，你得到每项技能值+1。
```

## 08058 · The Red Clock / 红色闹钟
- 行号：src/cards/cards-data.js:289334（name/nameZh） · src/cards/cards-data.js:289350（textZh） · src/cards/cards-data.js:289305（backTextZh）
- pack=eoep · type=asset · subname=Broken but Reliable / 损坏却可靠
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
Exceptional. Uses (0 charges).
Forced - After your turn begins: You may take all charges here, as resources. Place 1 charge here. If it has exactly...
- 1 charge, you get +4 skill value for your next skill test.
- 2 charges, you may move up to 3 times.
- 3 charges, you may take 2 additional actions this turn.
```
- text ZH:
```
卓越。使用(0充能)。
强制 - 在你的回合开始后：你可以拿取此处所有充能，作为资源。在此放置1充能。如果它恰好拥有……
- 1充能，下次技能检定中你得到技能值+4。
- 2充能，你可以移动最多3次。
- 3充能，你本回合可以进行2次额外行动。
```

## 08059 · Down the Rabbit Hole / 掉进兔子洞
- 行号：src/cards/cards-data.js:289393（name/nameZh） · src/cards/cards-data.js:289404（textZh） · src/cards/cards-data.js:289370（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
After each scenario of a campaign, reduce the experience cost of the first 2 cards you upgrade before the next scenario by 1.
Increase the experience cost for you to purchase new cards by 1.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。
在一个剧本的每个冒险结束后，在下一场冒险之前，你升级的前2张卡牌经验值费用-1。
你购买新卡牌所需要的经验值加1。
```

## 08060 · Dragon Pole / 咏春棍
- 行号：src/cards/cards-data.js:289448（name/nameZh） · src/cards/cards-data.js:289463（textZh） · src/cards/cards-data.js:289422（backTextZh）
- pack=eoep · type=asset
- traits: Item / Weapon / Melee  ||  道具 / 武器 / 近战
- text EN:
```
You have 1 additional arcane slot.
[action]: Fight. You get +1 [combat] for this attack for each of your arcane slots that is filled. If at least 2 of your arcane slots are filled, this attack deals +1 damage.
```
- text ZH:
```
你拥有1个额外的法术槽位。
[action]：攻击。你每有一个法术槽位有支援，你本次攻击得到+1[combat]。如果至少有2个法术槽位有支援，本次攻击+1伤害。
```

## 08061 · Meditative Trance / 冥想放空
- 行号：src/cards/cards-data.js:289513（name/nameZh） · src/cards/cards-data.js:289524（textZh） · src/cards/cards-data.js:289485（backTextZh）
- pack=eoep · type=event
- traits: Insight / Spirit  ||  洞察 / 勇气
- text EN:
```
For each of your arcane slots that is filled, either heal 1 damage or 1 horror.
```
- text ZH:
```
你每有一个法术槽位有支援，治愈1点伤害或1点恐惧。
```
- flavor EN:
```
You let your mind drift into cold, meaningless oblivion. The emptiness feels like home.
```
- flavor ZH:
```
你让自己的思想沉沦，冰冷而漫无目的，万物皆忘。虚无如归。
```

## 08062 · Close the Circle / 闭环
- 行号：src/cards/cards-data.js:289571（name/nameZh） · src/cards/cards-data.js:289586（textZh） · src/cards/cards-data.js:289544（backTextZh）
- pack=eoep · type=asset
- traits: Ritual / Synergy  ||  仪式 / 协作
- text EN:
```
Uses (1 charge for each class among cards you control, including this one).
[fast] Spend 1 charge and exhaust Close the Circle: Take a basic action. For each skill test performed during that action, you may use your [willpower] instead of the skill indicated for that action.
```
- text ZH:
```
使用(充能数等于你控制卡牌的职阶数，包含本卡牌)。
[free]花费1充能并横置闭环：执行一次基础行动。该行动期间执行的每次技能检定中，你可以不使用原本指示的技能，改为使用[willpower]。
```

## 08063 · Winds of Power / 力量之风
- 行号：src/cards/cards-data.js:289633（name/nameZh） · src/cards/cards-data.js:289644（textZh） · src/cards/cards-data.js:289606（backTextZh）
- pack=eoep · type=event
- traits: Spirit  ||  勇气
- text EN:
```
Place 2 charges on an asset you control.
[reaction] After you draw Winds of Power during your turn: Play it.
```
- text ZH:
```
在你控制的一张支援上放置2充能。
[reaction]在你回合期间抽取力量之风后：将其打出。
```
- flavor EN:
```
May Oya's breath guide us all.
```
- flavor ZH:
```
愿奥雅之息指引我们所有人
```

## 08064 · Foresight / 先见
- 行号：src/cards/cards-data.js:289688（name/nameZh） · src/cards/cards-data.js:289699（textZh） · src/cards/cards-data.js:289662（backTextZh）
- pack=eoep · type=event
- traits: Augury  ||  预言
- text EN:
```
Fast. Play when an investigator at your location would draw a card from their deck or from the encounter deck.
Name a card. If the drawn card is the named card, that investigator may either (choose one):
- Cancel that card's effects and discard it.
- Immediately play that card at -2 cost.
```
- text ZH:
```
快速。在你所在地点的调查员将要从其牌库或遭遇牌库抽取卡牌时打出。
指定一张卡牌。如果抽取的卡牌是指定的卡牌，该调查员可以(选择一项)：
- 取消该卡牌的效果并将其弃掉。
- 立刻打出该卡牌且其费用-2。
```

## 08065 · Occult Theory / 密教理论
- 行号：src/cards/cards-data.js:289741（name/nameZh） · src/cards/cards-data.js:289752（textZh） · src/cards/cards-data.js:289717（backTextZh）
- pack=eoep · type=skill
- traits: Practiced / Expert  ||  精通 / 专家
- text EN:
```
While Occult Theory is in your hand or committed to a skill test, it gains [willpower] icons equal to your [intellect], and [intellect] icons equal to your [willpower].
```
- text ZH:
```
密教理论在你手中或投入到技能检定中时，其获得等于你[intellect]的[willpower]图标，以及等于你[willpower]的[intellect]图标。
```
- flavor EN:
```
When knowledge is lacking, belief must suffice.
```
- flavor ZH:
```
知识一旦匮乏，信仰便已足够。
```

## 08066 · Parallel Fates / 平行命运
- 行号：src/cards/cards-data.js:289800（name/nameZh） · src/cards/cards-data.js:289811（textZh） · src/cards/cards-data.js:289772（backTextZh）
- pack=eoep · type=event
- traits: Augury  ||  预言
- text EN:
```
Look at the top 6 cards of an investigator's deck or the encounter deck. You may either return them to the top of that deck in any order, or shuffle them into that deck. If you looked at an investigator's deck, that investigator may draw 1 card.
```
- text ZH:
```
查看一位调查员的牌库顶或遭遇牌库顶6张卡牌，你可以将那些卡牌以任何顺序放回该牌库顶，或将他们洗回该牌库。如果你查看了一位调查员的牌库，该调查员可以抽取1张卡牌。
```
- flavor EN:
```
"If I said that I could tell you when you were going to die, would you want to know?"
```
- flavor ZH:
```
“如果我说，在你濒死之际我才会把你的命运告诉你，你还想知道吗？”
```

## 08067 · Astronomical Atlas / 天文地图集
- 行号：src/cards/cards-data.js:289856（name/nameZh） · src/cards/cards-data.js:289871（textZh） · src/cards/cards-data.js:289829（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tome  ||  道具 / 书籍
- text EN:
```
[fast] Exhaust Astronomical Atlas: Look at the top card of your deck. If it is not a weakness, attach it facedown to Astronomical Atlas (max 5 cards attached).
[fast]: Commit a card attached to Astronomical Atlas to an eligible skill test. If that test succeeds, add that card to your hand instead of discarding it. (Limit once per test.)
```
- text ZH:
```
[free]横置天文地图集：查看你牌库顶1张卡牌。如果它不是弱点，将它正面朝下附属到天文地图集上(最多附属5张)。
[free]：将一张附属在天文地图集上的卡牌投入到一个符合条件的技能检定中。如果该检定成功，不弃掉该卡牌，改为将其加入你的手牌。(每次检定仅限一次。)
```

## 08068 · Healing Words / 治愈真言
- 行号：src/cards/cards-data.js:289918（name/nameZh） · src/cards/cards-data.js:289933（textZh） · src/cards/cards-data.js:289891（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (4 charges).
[action] Spend 1 charge: Heal 2 damage from among investigators at your location.
```
- text ZH:
```
使用(4充能)。
[action]花费1充能：治愈你所在地点调查员总计2点伤害。
```
- flavor EN:
```
You don't necessarily trust the occult words, but you have no other choice.
```
- flavor ZH:
```
你也不是非要相信这些咒语，只是你别无选择。
```

## 08069 · Grounded / 情绪稳定
- 行号：src/cards/cards-data.js:289978（name/nameZh） · src/cards/cards-data.js:289990（textZh） · src/cards/cards-data.js:289951（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Composure  ||  才能 / 沉稳
- text EN:
```
Fast. Limit 1 [[Composure]] in play.
You get +1 skill value during skill tests on [[Spell]] cards.
Non-direct damage/horror must be assigned to Grounded before it can be assigned to your investigator card.
[fast] During a skill test on a [[Spell]] card, spend 1 resource: You get +1 skill value for this test.
```
- text ZH:
```
快速。[[沉稳]]卡牌场上仅限1张。
你在[[法术]]卡牌的技能检定期间得到+1技能值。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给情绪稳定。
[free]在[[法术]]卡牌的技能检定期间，花费1资源：你本次检定得到技能值+1。
```

## 08070 · True Magick / 真法魔典
- 行号：src/cards/cards-data.js:290037（name/nameZh） · src/cards/cards-data.js:290054（textZh） · src/cards/cards-data.js:290010（backTextZh）
- pack=eoep · type=asset · subname=Reworking Reality / 重塑现实
- traits: Item / Relic / Tome  ||  道具 / 遗物 / 书籍
- text EN:
```
Uses (1 charge). Replenish this charge at the start of each round.
You may resolve abilities on [[Spell]] assets in your hand by revealing them from your hand. Treat True Magick as if it were the revealed asset (to pay its costs, spend charges, perfom its effect, etc).
```
- text ZH:
```
使用(1充能)。当每轮开始时重新补满本充能。
你可以通过揭示手牌中的[[法术]]支援来结算卡牌上的能力。如同真法魔典是已揭示的支援。(以支付费用、花费充能、执行效果等)。
```

## 08071 · Short Supply / 补给匮乏
- 行号：src/cards/cards-data.js:290100（name/nameZh） · src/cards/cards-data.js:290111（textZh） · src/cards/cards-data.js:290076（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
Forced - When your first turn of the game begins: Discard the top 10 cards of your deck.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。
强制 - 在你游戏的第一个回合开始时：弃掉你牌库顶10张卡牌。
```
- flavor EN:
```
You can only pray that it's enough.
```
- flavor ZH:
```
你只能祈祷这些够用。
```

## 08072 · Schoffner's Catalogue / 沙夫纳的目录
- 行号：src/cards/cards-data.js:290155（name/nameZh） · src/cards/cards-data.js:290166（textZh） · src/cards/cards-data.js:290129（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tome  ||  道具 / 书籍
- text EN:
```
Uses (5 secrets). If Schoffner's Catalogue has no secrets, discard it.
You may spend secrets on Schoffner's Catalogue as resources to pay for [[Item]] assets played by any investigator at your location.
```
- text ZH:
```
使用(5秘密)。如果沙夫纳的目录没有秘密，将其弃掉。
你可以将沙夫纳的目录的秘密作为资源花费，来支付你所在地点任意调查员打出的[[道具]]支援。
```

## 08073 · Bandages / 绷带
- 行号：src/cards/cards-data.js:290215（name/nameZh） · src/cards/cards-data.js:290226（textZh） · src/cards/cards-data.js:290186（backTextZh）
- pack=eoep · type=asset
- traits: Item  ||  道具
- text EN:
```
Uses (3 supplies). If Bandages has no supplies, discard it.
[reaction] After an investigator or [[Ally]] asset at your location takes 1 or more damage, spend 1 supply: Heal 1 damage from that card.
```
- text ZH:
```
使用(3补给)。如果绷带没有补给，将其弃掉。
[reaction]在你所在地点的调查员或[[盟友]]支援受到1点或更多伤害后，花费1补给：治愈该卡牌1点伤害。
```

## 08074 · Jury-Rig / 应急装备
- 行号：src/cards/cards-data.js:290272（name/nameZh） · src/cards/cards-data.js:290283（textZh） · src/cards/cards-data.js:290244（backTextZh）
- pack=eoep · type=event
- traits: Upgrade  ||  升级
- text EN:
```
Uses (3 durability).
Attach to an [[Item]] asset controlled by an investigator at your location.
[fast] During a skill test on attached asset, spend 1 durability: You get +2 skill value for this test.
```
- text ZH:
```
使用(3耐久)。
附属到你所在地点的一位调查员控制的[[道具]]支援上。
[free]被附属支援的技能检定期间，花费1耐久：你本次检定得到+2技能值。
```
- flavor EN:
```
If it ain't broke, make it better.
```
- flavor ZH:
```
如果它还没坏，就好好改进它。
```

## 08075 · Bangle of Jinxes / 厄运手镯
- 行号：src/cards/cards-data.js:290327（name/nameZh） · src/cards/cards-data.js:290342（textZh） · src/cards/cards-data.js:290301（backTextZh）
- pack=eoep · type=asset
- traits: Item / Charm / Cursed  ||  道具 / 守护 / 诅咒萦绕
- text EN:
```
Uses (1 charge).
[fast] Spend 1 charge: You get +2 skill value for this test. (Limit once per test.)
[reaction] After an enemy attacks you: Place 1 charge on Bangle of Jinxes.
```
- text ZH:
```
使用(1充能)。
[free]花费1充能：你本次技能检定得到技能值+2。(每次检定仅限一次。)
[reaction]一个敌人攻击你后：在厄运手镯上放置1充能。
```

## 08076 · Burn After Reading / 阅后即焚
- 行号：src/cards/cards-data.js:290390（name/nameZh） · src/cards/cards-data.js:290401（textZh） · src/cards/cards-data.js:290364（backTextZh）
- pack=eoep · type=event
- traits: Insight  ||  洞察
- text EN:
```
Exile a level 0-5 card in your hand. Discover 2 clues at your location. If the exiled card was level 2 or higher, remove 1 doom from the current agenda. Exile Burn After Reading.
Card designed by the Council-in-Exile at Gen Con 2020
```
- text ZH:
```
放逐你手中一张等级0-5的卡牌。发现你所在地点的2个线索。如果被放逐的卡牌为等级2或更高，移除当前密谋上的1个毁灭印记。放逐阅后即焚。
本卡牌由2020年Gen Con的流亡议会设计。
```

## 08077 · Strength in Numbers / 人多力量大
- 行号：src/cards/cards-data.js:290445（name/nameZh） · src/cards/cards-data.js:290456（textZh） · src/cards/cards-data.js:290419（backTextZh）
- pack=eoep · type=skill
- traits: Innate / Synergy  ||  天性 / 协作
- text EN:
```
Strength in Numbers gains a [wild] icon for each different class among cards you control.
```
- text ZH:
```
你控制的卡牌中每有一个不同的职阶，人多力量大获得一个[wild]图标。
```
- flavor EN:
```
"Watch my back, will ya? In fact, watch my front, too."
```
- flavor ZH:
```
“在后面掩护我，可以吗？其实前面也需要你掩护。”
```

## 08078 · Dauntless Spirit / 无畏精神
- 行号：src/cards/cards-data.js:290500（name/nameZh） · src/cards/cards-data.js:290511（textZh） · src/cards/cards-data.js:290476（backTextZh）
- pack=eoep · type=skill
- traits: Innate / Developed  ||  天性 / 熟练
- text EN:
```
While Dauntless Spirit is in your hand or committed to a skill test, it gains [willpower] icons equal to your [combat], and [combat] icons equal to your [willpower].
```
- text ZH:
```
无畏精神在你手中或投入到技能检定中时，其获得等于你[combat]的[willpower]图标，以及等于你[willpower]的[combat]图标。
```
- flavor EN:
```
This day just keeps getting better and better.
```
- flavor ZH:
```
今天正在变得越来越好。
```

## 08079 · Blood Will Have Blood / 血债血偿
- 行号：src/cards/cards-data.js:290558（name/nameZh） · src/cards/cards-data.js:290569（textZh） · src/cards/cards-data.js:290531（backTextZh）
- pack=eoep · type=event
- traits: Pact / Cursed  ||  契约 / 诅咒萦绕
- text EN:
```
Fast. Play after an enemy attacks you. Max 1 per attack.
Damage/horror from this attack cannot be assigned to [[Ally]] assets. For each point of damage and/or horror you took from this attack, draw 1 card.
```
- text ZH:
```
快速。在一个敌人攻击你后打出。每次攻击最多1张。
该攻击造成的伤害/恐惧不能分配给[[盟友]]支援。你从本次攻击中每受到1点伤害和/或恐惧，抽取1张卡牌。
```

## 08080 · Fire Extinguisher / 灭火器
- 行号：src/cards/cards-data.js:290615（name/nameZh） · src/cards/cards-data.js:290630（textZh） · src/cards/cards-data.js:290589（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Melee  ||  道具 / 工具 / 近战
- text EN:
```
[action]: Fight. You get +1 [combat] and deal +1 damage for this attack.
[action] Discard Fire Extinguisher: Evade. Automatically evade all enemies engaged with you. You may exile Fire Extinguisher instead of discarding it to discard each non-[[Elite]] enemy evaded by this effect.
```
- text ZH:
```
[action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
[action]弃掉灭火器：躲避。自动躲避所有与你交战的敌人。你可以将弃掉灭火器改为放逐，来弃掉每一张被此效果躲避的非[[精英]]敌人。
```

## 08081 · Plucky / 有胆有识
- 行号：src/cards/cards-data.js:290680（name/nameZh） · src/cards/cards-data.js:290692（textZh） · src/cards/cards-data.js:290652（backTextZh）
- pack=eoep · type=asset
- traits: Talent / Composure  ||  才能 / 沉稳
- text EN:
```
Fast. Limit 1 [[Composure]] in play.
You get +1 [willpower] and +1 [intellect].
Non-direct damage/horror must be assigned to Plucky before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [willpower] or +1 [intellect] for this skill test.
```
- text ZH:
```
快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[willpower]和+1[intellect]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给有胆有识。
[free]花费1资源：你本次技能检定得到+1[willpower]或+1[intellect]。
```

## 08082 · Fend Off / 抵挡
- 行号：src/cards/cards-data.js:290738（name/nameZh） · src/cards/cards-data.js:290749（textZh） · src/cards/cards-data.js:290712（backTextZh）
- pack=eoep · type=event
- traits: Gambit / Trick  ||  局势 / 技巧
- text EN:
```
Fast. Play when a non-[[Elite]] enemy spawns at your location.
That enemy attacks you. Then, automatically evade that enemy and attach Fend Off to it.
Attached enemy cannot ready.
```
- text ZH:
```
快速。在你所在地点生成一个非[[精英]]敌人时打出。
该敌人攻击你。然后，自动躲避该敌人并将抵挡附属到该敌人。
被附属的敌人不能重整。
```

## 08083 · Medical Student / 医学生
- 行号：src/cards/cards-data.js:290798（name/nameZh） · src/cards/cards-data.js:290814（textZh） · src/cards/cards-data.js:290769（backTextZh）
- pack=eoep · type=asset
- traits: Ally / Miskatonic / Science  ||  盟友 / 米斯卡塔尼克 / 科学
- text EN:
```
[reaction] After Medical Student enters play: Heal 1 damage and 1 horror from an investigator or [[Ally]] asset at your location.
```
- text ZH:
```
[reaction]在医学生入场后：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害和1点恐惧。
```
- flavor EN:
```
"Can I get course credit for this?"
```
- flavor ZH:
```
“做这些会给我学分么？”
```

## 08084 · On the Trail / 追踪
- 行号：src/cards/cards-data.js:290865（name/nameZh） · src/cards/cards-data.js:290876（textZh） · src/cards/cards-data.js:290836（backTextZh）
- pack=eoep · type=event
- traits: Insight / Tactic  ||  洞察 / 策略
- text EN:
```
Choose an enemy at any location other than yours. Either move twice toward that enemy, or discover 1 clue at any empty location between you and the chosen enemy, along the shortest path to reach that enemy.
```
- text ZH:
```
选择你所在地点以外任意地点的一个敌人。沿着最短路径，朝着该敌人移动2次，或在你与选定敌人间最短路径上的任意无人地点发现1个线索。
```
- flavor EN:
```
"The game is afoot!"
```
- flavor ZH:
```
“游戏开始！”
```

## 08085 · On the Trail / 追踪
- 行号：src/cards/cards-data.js:290926（name/nameZh） · src/cards/cards-data.js:290937（textZh） · src/cards/cards-data.js:290896（backTextZh）
- pack=eoep · type=event
- traits: Insight / Tactic  ||  洞察 / 策略
- text EN:
```
Choose an enemy at any location other than yours. Move twice toward that enemy. Discover 1 clue at each location you entered by this effect.
```
- text ZH:
```
选择你所在地点以外任意地点的一个敌人。朝着该敌人移动2次，发现你以此效果进入的每个地点的1个线索。
```
- flavor EN:
```
"The game is afoot!"
```
- flavor ZH:
```
“游戏开始！”
```

## 08086 · Michael Leigh / 迈克尔·利
- 行号：src/cards/cards-data.js:290987（name/nameZh） · src/cards/cards-data.js:291004（textZh） · src/cards/cards-data.js:290957（backTextZh）
- pack=eoep · type=asset · subname=Experienced Hunter / 资深猎手
- traits: Ally / Detective  ||  盟友 / 侦探
- text EN:
```
You get +1 [intellect] and +1 [combat].
[reaction] After you successfully investigate: Place 1 resource (from the token pool) on Michael Leigh, as evidence (to a maximum of 3 evidence).
[reaction] When you initiate an attack, exhaust Michael Leigh and spend 1 evidence: You deal +1 damage for this attack.
```
- text ZH:
```
你得到+1[intellect]和+1[combat]。
[reaction]在你成功调查后：在迈克尔·利上放置1资源(从供应堆拿取)作为证据(最多3个证据)。
[reaction]在你发动一次攻击时，横置迈克尔·利并花费1证据：你在本次攻击中造成+1伤害。
```

## 08087 · Snipe / 狙击
- 行号：src/cards/cards-data.js:291052（name/nameZh） · src/cards/cards-data.js:291063（textZh） · src/cards/cards-data.js:291024（backTextZh）
- pack=eoep · type=event
- traits: Tactic  ||  策略
- text EN:
```
During the next fight action you perform this turn using a [[Ranged]] or [[Firearm]] asset, treat each [skull], [cultist], [tablet], [elder_thing], or [auto_fail] token you reveal as a "0" token. This action does not provoke attacks of opportunity.
```
- text ZH:
```
你本回合下一个使用了[[远程]]或[[枪械]]支援的攻击行动期间，将你揭示的每个[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]标记视为“0”标记。本行动不会触发趁乱攻击。
```

## 08088 · Old Shotgun / 老旧的霰弹枪
- 行号：src/cards/cards-data.js:291108（name/nameZh） · src/cards/cards-data.js:291123（textZh） · src/cards/cards-data.js:291081（backTextZh）
- pack=eoep · type=asset
- traits: Item / Weapon / Firearm  ||  道具 / 武器 / 枪械
- text EN:
```
Uses (0 ammo). While playing an event, treat Old Shotgun's uses value as 2.
[action] Spend 1 ammo: Fight. You get +3 [combat] for this attack. Instead of its standard damage, this attack's damage is equal to the amount you succeed by, or fail by if you fail and would damage another investigator (to a minimum of 1, to a maximum of 3).
```
- text ZH:
```
使用(0子弹)。打出一张事件卡牌时，将老旧的霰弹枪的使用值视为2。
[action]花费1子弹：攻击。你本次攻击得到+3[combat]。本次攻击不造成标准伤害，改为：攻击成功时造成的伤害数量等于你超过难度的值；攻击失败且将对另一位调查员造成伤害时，对该调查员造成的伤害数量等于你低于难度的值。(伤害最小为1，最大为3)。
```

## 08089 · Quickdraw Holster / 快拔枪套
- 行号：src/cards/cards-data.js:291173（name/nameZh） · src/cards/cards-data.js:291188（textZh） · src/cards/cards-data.js:291145（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Illicit  ||  道具 / 工具 / 违法
- text EN:
```
[fast]: Choose a [[Firearm]] asset taking up only 1 hand slot in your play area. Attach it to Quickdraw Holster, or switch it with the attached asset. The attached asset takes up no hand slots. (Limit 1 attached asset.)
[fast] Exhaust Quickdraw Holster: Perform a fight action on the attached asset without paying its [action] cost.
```
- text ZH:
```
[free]：选择一张在你游戏区域，只占据1个手部槽位的[[枪械]]支援，将其附属到快拔枪套，或与已附属的支援交换。附属的支援不占用手部槽位。(附属的支援仅限1张。)
[free]横置快拔枪套：执行一次已附属支援的攻击行动且无需支付其[action]费用。
```

## 08090 · Brand of Cthugha / 克图格亚的烙印
- 行号：src/cards/cards-data.js:291237（name/nameZh） · src/cards/cards-data.js:291252（textZh） · src/cards/cards-data.js:291210（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (6 charges).
[action]: Fight. For this attack, you may use [willpower] instead of [combat], and you get +1 skill value. If you succeed, spend 1 or 2 charges. Instead of its standard damage, this attack deals 1 damage for each charge spent. If you succeed by 0, lose 1 action.
```
- text ZH:
```
使用(6充能)。
[action]：攻击。你在本次攻击中得到+1技能值，并且可以不使用[combat]，改为使用[willpower]。如果你成功，花费1或2充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。如果你成功且等于难度，失去1行动。
```

## 08091 · Nkosi Mabati / 恩科西·马巴蒂
- 行号：src/cards/cards-data.js:291298（name/nameZh） · src/cards/cards-data.js:291315（textZh） · src/cards/cards-data.js:291270（backTextZh）
- pack=eoep · type=asset · subname=Enigmatic Warlock / 谜一般的术士
- traits: Ally / Sorcerer  ||  盟友 / 法师
- text EN:
```
[reaction] After Nkosi Mabati enters play: Name a non-[elder_sign] chaos token with a symbol. Until this card leaves play, the named symbol is your "sigil."
[reaction] When an investigator at your location reveals a [cultist], [tablet], or [elder_thing] symbol, exhaust Nkosi Mabati: Search the chaos bag for your sigil and reveal it, instead (returning the other token to the chaos bag).
```
- text ZH:
```
[reaction]在恩科西·马巴蒂入场后：指定一个非[elder_sign]的符号混乱标记。在本卡牌离场前，指定的标记为你的“咒印”。
[reaction]在你所在地点的一位调查员揭示了一个[cultist]、[tablet]或[elder_thing]符号时，横置恩科西·马巴蒂：改为从混乱袋中查找你的咒印并揭示它(将其他标记放回混乱袋)
```

## 08092 · Brand of Cthugha / 克图格亚的烙印
- 行号：src/cards/cards-data.js:291363（name/nameZh） · src/cards/cards-data.js:291378（textZh） · src/cards/cards-data.js:291335（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (9 charges).
[action]: Fight. For this attack, you may use [willpower] instead of [combat], and you get +2 skill value. If you succeed, spend 1, 2, or 3 charges. Instead of its standard damage, this attack deals 1 damage for each charge spent. If you succeed by 0, lose 2 actions.
```
- text ZH:
```
使用(9充能)。
[action]：攻击。你在本次攻击中得到+2技能值，并且可以不使用[combat]，改为使用[willpower]。如果你成功，花费1、2或3充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。如果你成功且等于难度，失去2行动。
```

## 08093 · Cyclopean Hammer / 巨石锤
- 行号：src/cards/cards-data.js:291424（name/nameZh） · src/cards/cards-data.js:291439（textZh） · src/cards/cards-data.js:291396（backTextZh）
- pack=eoep · type=asset
- traits: Item / Relic / Weapon / Melee  ||  道具 / 遗物 / 武器 / 近战
- text EN:
```
[action]: Fight. Add your [willpower] to your skill value for this attack. You deal +1 damage for this attack. If you succeed and the enemy is non-[[Elite]], you may move it one location away from you. (If you succeed by 3 or more, you instead deal +2 damage and may move the enemy up to two locations away from you.)
```
- text ZH:
```
[action]：攻击。本次攻击将你的[willpower]加入你的技能值。你在本次攻击中造成+1伤害。如果你成功并且该敌人为非[[精英]]，你可以将其朝着远离你的方向移动一个地点。(如果你成功且超过难度3点或更多，改为造成+2伤害并可以将其朝着远离你的方向移动最多2个地点。)
```

## 08094 · Sledgehammer / 长柄大锤
- 行号：src/cards/cards-data.js:291491（name/nameZh） · src/cards/cards-data.js:291506（textZh） · src/cards/cards-data.js:291463（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Weapon / Melee  ||  道具 / 工具 / 武器 / 近战
- text EN:
```
[action]: Fight. You get -1 [combat] and deal +1 damage for this attack.
[action] [action]: Fight. You get +2 [combat] and deal +2 damage for this attack.
```
- text ZH:
```
[action]：攻击。你本次攻击得到-1[combat]并造成+1伤害。
[action][action]：攻击。你本次攻击得到+2[combat]并造成+2伤害。
```
- flavor EN:
```
Twenty pounds of steel vengeance.
```
- flavor ZH:
```
来自二十磅钢铁的复仇。
```

## 08095 · Protective Gear / 防护服
- 行号：src/cards/cards-data.js:291560（name/nameZh） · src/cards/cards-data.js:291576（textZh） · src/cards/cards-data.js:291530（backTextZh）
- pack=eoep · type=asset
- traits: Item / Armor  ||  道具 / 护甲
- text EN:
```
[reaction] When you draw a [[Hazard]] treachery, deal 1 damage and 1 horror to Protective Gear: Cancel that card's revelation effect.
```
- text ZH:
```
[reaction]在你抽取一张[[危险]]诡计时，对防护服造成1点伤害和1点恐惧：取消该卡牌的显现效果。
```
- flavor EN:
```
After what you've seen, you intend to sleep in it.
```
- flavor ZH:
```
在你见识完后，你甚至想要睡在里面。
```

## 08096 · Sledgehammer / 长柄大锤
- 行号：src/cards/cards-data.js:291624（name/nameZh） · src/cards/cards-data.js:291639（textZh） · src/cards/cards-data.js:291596（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Weapon / Melee  ||  道具 / 工具 / 武器 / 近战
- text EN:
```
[action]: Fight. You get +1 [combat] and deal +1 damage for this attack.
[action] [action] [action]: Fight. You get +5 [combat] and deal +5 damage for this attack.
```
- text ZH:
```
[action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
[action][action][action]：攻击。你本次攻击得到+5[combat]并造成+5伤害。
```
- flavor EN:
```
Twenty-five pounds of steel vengeance.
```
- flavor ZH:
```
来自二十五磅钢铁的复仇。
```

## 08097 · Pocket Telescope / 袖珍望远镜
- 行号：src/cards/cards-data.js:291690（name/nameZh） · src/cards/cards-data.js:291705（textZh） · src/cards/cards-data.js:291663（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool  ||  道具 / 工具
- text EN:
```
[fast] Exhaust Pocket Telescope: Look at the revealed side of a connecting unrevealed location.
[action]: Investigate. Investigate a revealed connecting location as if you were there.
```
- text ZH:
```
[free]横置袖珍望远镜：查看一个连接的未揭示地点的揭示面。
[action]：调查。调查一个连接的已揭示地点，如同你在该地点。
```

## 08098 · Eon Chart / 远古海图
- 行号：src/cards/cards-data.js:291753（name/nameZh） · src/cards/cards-data.js:291768（textZh） · src/cards/cards-data.js:291725（backTextZh）
- pack=eoep · type=asset
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
Uses (3 secrets).
[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take one of the following actions (move, evade, or investigate).
```
- text ZH:
```
使用(3秘密)。
[free]在你回合期间，横置远古海图并花费1秘密：选择并执行以下一个行动(移动、躲避或调查)。
```

## 08099 · Gené Beauregard / 吉恩·波尔格
- 行号：src/cards/cards-data.js:291817（name/nameZh） · src/cards/cards-data.js:291834（textZh） · src/cards/cards-data.js:291788（backTextZh）
- pack=eoep · type=asset · subname=Intrepid Explorer / 英勇的探险家
- traits: Ally / Wayfarer  ||  盟友 / 旅人
- text EN:
```
You get +1 [intellect] and +1 [agility].
[reaction] During your turn, after you move to a location, exhaust Gené Beauregard: Move a clue or a non-[[Elite]] enemy from a connecting location to your location, or vice versa.
```
- text ZH:
```
你得到+1[intellect]和+1[agility]。
[reaction]在你回合期间，你移动到一个地点后，横置吉恩·波尔格：将1个线索或一个非[[精英]]敌人从一个连接地点移动到你的地点，或从你的地点移动到一个连接地点。
```

## 08100 · Eon Chart / 远古海图
- 行号：src/cards/cards-data.js:291883（name/nameZh） · src/cards/cards-data.js:291898（textZh） · src/cards/cards-data.js:291854（backTextZh）
- pack=eoep · type=asset
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
Uses (3 secrets).
[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take two different actions of the following, in any order (move, evade, or investigate).
```
- text ZH:
```
使用(3秘密)。
[free]在你回合期间，横置远古海图并花费1秘密：以任意顺序选择并执行以下两个行动(移动、躲避或调查)。
```

## 08101 · Divination / 占卜
- 行号：src/cards/cards-data.js:291945（name/nameZh） · src/cards/cards-data.js:291960（textZh） · src/cards/cards-data.js:291918（backTextZh）
- pack=eoep · type=asset
- traits: Spell / Augury  ||  法术 / 预言
- text EN:
```
Uses (4 charges).
[action]: Investigate. For this investigation, you may use [willpower] instead of [intellect], and you get +1 skill value. If you succeed, spend 1 or 2 charges. Instead of discovering a clue at your location, discover 1 clue at your location for each charge spent. If you succeed by 0, choose and discard a card from your hand.
```
- text ZH:
```
使用(4充能)。
[action]：调查。你在本次调查中得到+1技能值，并且可以不使用[intellect]，改为使用[willpower]。如果你成功，花费1或2充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。如果你成功且等于难度，选择你一张手牌并将其弃掉。
```

## 08102 · Protecting the Anirniq / 保护魂灵
- 行号：src/cards/cards-data.js:292009（name/nameZh） · src/cards/cards-data.js:292020（textZh） · src/cards/cards-data.js:291980（backTextZh）
- pack=eoep · type=event
- traits: Ritual  ||  仪式
- text EN:
```
Fast. Play after an [[Ally]] asset at your location is discarded by a card effect or is defeated.
Either return that asset to its owner's hand, or its owner draws 3 cards.
```
- text ZH:
```
快速。你所在地点的一个[[盟友]]支援被击败或因卡牌效果弃掉后打出。
将该支援返回其拥有者手中，或其拥有者抽取3张卡牌。
```
- flavor EN:
```
All living things have breath.
Be careful they do not curse you with theirs.
```
- flavor ZH:
```
所有的活物都有气息。注意别被他们的气息诅咒了。
```

## 08103 · Divination / 占卜
- 行号：src/cards/cards-data.js:292066（name/nameZh） · src/cards/cards-data.js:292081（textZh） · src/cards/cards-data.js:292038（backTextZh）
- pack=eoep · type=asset
- traits: Spell / Augury  ||  法术 / 预言
- text EN:
```
Uses (6 charges).
[action]: Investigate. For this investigation, you may use [willpower] instead of [intellect], and you get +2 skill value. If you succeed, spend 1, 2, or 3 charges. Instead of discovering a clue at your location, discover 1 clue at your location for each charge spent. If you succeed by 0, choose and discard 2 cards from your hand.
```
- text ZH:
```
使用(6充能)。
[action]：调查。你在本次调查中得到+2技能值，并且可以不使用[intellect]，改为使用[willpower]。如果你成功，花费1、2或3充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。如果你成功且等于难度，选择你2张手牌并将其弃掉。
```

## 08104 · Professor William Webb / 威廉·韦伯教授
- 行号：src/cards/cards-data.js:292129（name/nameZh） · src/cards/cards-data.js:292146（textZh） · src/cards/cards-data.js:292101（backTextZh）
- pack=eoep · type=asset · subname=Finder of Hidden Connections / 内情发现者
- traits: Ally / Miskatonic  ||  盟友 / 米斯卡塔尼克
- text EN:
```
Uses (3 secrets).
[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Instead of discovering a clue at your location, either choose an [[Item]] card in your discard pile and add it to your hand, or discover a clue at a connecting location.
```
- text ZH:
```
使用(3秘密)。
[reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：不发现你所在地点的1个线索，改为在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中，或在一个连接地点发现1个线索。
```

## 08105 · Ice Pick / 破冰锥
- 行号：src/cards/cards-data.js:292193（name/nameZh） · src/cards/cards-data.js:292208（textZh） · src/cards/cards-data.js:292166（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Melee  ||  道具 / 工具 / 近战
- text EN:
```
Fast.
[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test.
```
- text ZH:
```
快速。
[free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
```

## 08106 · Professor William Webb / 威廉·韦伯教授
- 行号：src/cards/cards-data.js:292259（name/nameZh） · src/cards/cards-data.js:292276（textZh） · src/cards/cards-data.js:292230（backTextZh）
- pack=eoep · type=asset · subname=Finder of Hidden Connections / 内情发现者
- traits: Ally / Miskatonic  ||  盟友 / 米斯卡塔尼克
- text EN:
```
Uses (3 secrets).
[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Choose an [[Item]] card in your discard pile and add it to your hand. Instead of discovering a clue at your location, you may discover a clue at a connecting location.
```
- text ZH:
```
使用(3秘密)。
[reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中。你可以不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
```

## 08107 · Ice Pick / 破冰锥
- 行号：src/cards/cards-data.js:292324（name/nameZh） · src/cards/cards-data.js:292339（textZh） · src/cards/cards-data.js:292296（backTextZh）
- pack=eoep · type=asset
- traits: Item / Tool / Melee  ||  道具 / 工具 / 近战
- text EN:
```
Fast.
[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test. If you succeed, you may discard Ice Pick to have this attack deal +1 damage (if you are fighting), or to discover 1 additional clue at your location (if you are investigating).
```
- text ZH:
```
快速。
[free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。如果你成功，你可以弃掉破冰锥来使得本次攻击造成+1伤害(如果你攻击)，或发现你所在地点的额外1个线索(如果你调查)。
```

## 08108 · Ethereal Slip / 虚影易位
- 行号：src/cards/cards-data.js:292390（name/nameZh） · src/cards/cards-data.js:292401（textZh） · src/cards/cards-data.js:292361（backTextZh）
- pack=eoep · type=event
- traits: Spell / Trick  ||  法术 / 技巧
- text EN:
```
Choose a non-[[Elite]] enemy at a revealed location up to 2 connections away. Swap places with that enemy.
```
- text ZH:
```
选择一个位于已揭示地点的非[[精英]]敌人，且其所在地点与你的连接次数不超过2。与该敌人交换位置。
```
- flavor EN:
```
"Now, for my next trick..."
```
- flavor ZH:
```
“我的下一个特技是……”
```

## 08109 · Blur / 身形虚化
- 行号：src/cards/cards-data.js:292448（name/nameZh） · src/cards/cards-data.js:292463（textZh） · src/cards/cards-data.js:292421（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (3 charges).
[action] If Blur has charges remaining: Evade. For this evasion attempt, you may use [willpower] instead of [agility], and you get +1 skill value. If you succeed, spend 1 charge and you may take an additional action this turn. If you succeed by 0, take 1 damage.
```
- text ZH:
```
使用(3充能)。
[action]如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中得到+1技能值，并且可以不使用[agility]，改为使用[willpower]。如果你成功，花费1充能且本回合可以执行1次额外行动。如果你成功且等于难度，受到1点伤害。
```

## 08110 · Ethereal Slip / 虚影易位
- 行号：src/cards/cards-data.js:292510（name/nameZh） · src/cards/cards-data.js:292521（textZh） · src/cards/cards-data.js:292481（backTextZh）
- pack=eoep · type=event
- traits: Spell / Trick  ||  法术 / 技巧
- text EN:
```
Choose a non-[[Elite]] enemy at any revealed location. Swap places with that enemy.
```
- text ZH:
```
选择位于任意一个已揭示地点的非[[精英]]敌人。与该敌人交换位置。
```
- flavor EN:
```
"Now, for my next trick..."
```
- flavor ZH:
```
“我的下一个特技是……”
```

## 08111 · Blur / 身形虚化
- 行号：src/cards/cards-data.js:292569（name/nameZh） · src/cards/cards-data.js:292584（textZh） · src/cards/cards-data.js:292541（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (4 charges).
[action] If Blur has charges remaining: Evade. For this evasion attempt, you may use [willpower] instead of [agility] and get +2 skill value. If you succeed, spend 1 or 2 charges and you may take that many additional actions this turn. If you succeed by 0, take 2 damage.
```
- text ZH:
```
使用(4充能)。
[action]如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中得到+2技能值，并且可以不使用[agility]，改为使用[willpower]。如果你成功，花费1或2充能且本回合可以执行对应数量次数的额外行动。如果你成功且等于难度，受到2点伤害。
```

## 08112 · "Hit me!" / "再来一张！"
- 行号：src/cards/cards-data.js:292629（name/nameZh） · src/cards/cards-data.js:292640（textZh） · src/cards/cards-data.js:292602（backTextZh）
- pack=eoep · type=event
- traits: Fortune / Gambit  ||  幸运 / 局势
- text EN:
```
Fast. Play after you reveal a chaos token during a skill test.
Reveal an additional chaos token, switching its "-" to a "+". If that chaos token is a [skull] token, you automatically fail.
```
- text ZH:
```
快速。你在技能检定期间揭示混乱标记后打出。
额外揭示一个混乱标记，并经其“-”变为“+”。如果该标记是[skull]，你自动失败。
```

## 08113 · Unscrupulous Loan / 大肆借贷
- 行号：src/cards/cards-data.js:292685（name/nameZh） · src/cards/cards-data.js:292696（textZh） · src/cards/cards-data.js:292660（backTextZh）
- pack=eoep · type=asset
- traits: Pact  ||  契约
- text EN:
```
Limit 1 per investigator. Cannot leave play.
[reaction] After you play Unscrupulous Loan: Gain 10 resources.
Forced - When the game ends or you are eliminated, if you have fewer than 10 resources in your resource pool: Exile Unscrupulous Loan.
```
- text ZH:
```
每位调查员仅限1张。不能离场。
[reaction]在你打出大肆借贷后：获得10资源。
强制 - 在游戏结束或你退场时，如果你资源池中的资源数量小于10：放逐大肆借贷。
```

## 08114 · Precious Memento / 珍贵记忆
- 行号：src/cards/cards-data.js:292742（name/nameZh） · src/cards/cards-data.js:292759（textZh） · src/cards/cards-data.js:292714（backTextZh）
- pack=eoep · type=asset · subname=From a Former Life / 来自前世
- traits: Item / Charm / Blessed  ||  道具 / 守护 / 祝福
- text EN:
```
Limit 1 Precious Memento (From a Former Life) per deck.
[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.
[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.
```
- text ZH:
```
每个牌库仅限1张珍贵记忆(来自前世)。
[reaction]你在一次技能检定中失败且低于难度2点或更多后，横置珍贵记忆：治愈其1点伤害。
[reaction]你在一次技能检定中成功且超过难度2点或更多后，横置珍贵记忆：治愈其1点恐惧。
```

## 08115 · Precious Memento / 珍贵记忆
- 行号：src/cards/cards-data.js:292809（name/nameZh） · src/cards/cards-data.js:292826（textZh） · src/cards/cards-data.js:292781（backTextZh）
- pack=eoep · type=asset · subname=From a Future Life / 来自后世
- traits: Item / Charm / Cursed  ||  道具 / 守护 / 诅咒萦绕
- text EN:
```
Limit 1 Precious Memento (From a Future Life) per deck.
[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.
[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.
```
- text ZH:
```
每个牌库仅限1张珍贵记忆(来自后世)。
[reaction]你在一次技能检定中失败且低于难度2点或更多后，横置珍贵记忆：治愈其1点恐惧。
[reaction]你在一次技能检定中成功且超过难度2点或更多后，横置珍贵记忆：治愈其1点伤害。
```

## 08116 · Talisman of Protection / 护身法宝
- 行号：src/cards/cards-data.js:292875（name/nameZh） · src/cards/cards-data.js:292890（textZh） · src/cards/cards-data.js:292848（backTextZh）
- pack=eoep · type=asset
- traits: Item / Charm  ||  道具 / 守护
- text EN:
```
Fast. Play only during your turn.
Play Talisman of Protection under the control of any investigator at your location.
[reaction] When you assign damage and/or horror that would defeat you, discard Talisman of Protection: Cancel up to 2 of that damage and/or horror.
```
- text ZH:
```
快速。只可在你的回合期间打出。
打出护身法宝，置于你所在地点任意一位调查员控制之下。
[reaction]在你被分配伤害和/或恐惧，且其数量足够击败你时，弃掉护身法宝：取消该伤害和/或恐惧中的最多2点。
```

## 08117 · Earthly Serenity / 尘世宁静
- 行号：src/cards/cards-data.js:292937（name/nameZh） · src/cards/cards-data.js:292952（textZh） · src/cards/cards-data.js:292910（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (4 charges).
[action]: Test [willpower] (1). For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location. If you succeed by 0, lose 1 resource.
```
- text ZH:
```
使用(4充能)。
[action]：检定[willpower](1)。你每成功且超过难度1点，你可以花费1充能来治愈你所在地点一位调查员1点伤害或1点恐惧。如果你成功且等于难度，失去1资源。
```

## 08118 · Enchanted Bow / 附魔弓
- 行号：src/cards/cards-data.js:292998（name/nameZh） · src/cards/cards-data.js:293014（textZh） · src/cards/cards-data.js:292970（backTextZh）
- pack=eoep · type=asset
- traits: Spell / Blessed / Weapon / Ranged  ||  法术 / 祝福 / 武器 / 远程
- text EN:
```
Uses (3 charges).
[action] Exhaust Enchanted Bow: Fight. You must use either [willpower] or [agility] instead of [combat] and get +1 skill value for this attack. This attack deals +1 damage. As an additional cost to initiate this ability, you may spend 1 charge to have this attack target a non-[[Elite]] enemy at a connecting location; if you do, ignore the aloof and retaliate keywords for this attack.
```
- text ZH:
```
使用(3充能)。
[action]横置附魔弓：攻击。你本次攻击得到+1技能值，并且必须改为使用[willpower]或[agility]，而不使用[combat]。本次攻击造成+1伤害。作为发动此能力的额外费用，你可以花费1充能来使本次攻击以一个连接地点的非[[精英]]敌人为目标；如果你这样做，在本次攻击中，忽略冷漠和反击关键词。
```

## 08119 · Earthly Serenity / 尘世宁静
- 行号：src/cards/cards-data.js:293065（name/nameZh） · src/cards/cards-data.js:293080（textZh） · src/cards/cards-data.js:293038（backTextZh）
- pack=eoep · type=asset
- traits: Spell  ||  法术
- text EN:
```
Uses (6 charges).
[action]: Test [willpower] (0). For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location. If you succeed by 0, lose 2 resources.
```
- text ZH:
```
使用(6充能)。
[action]：检定[willpower](0)。你每成功且超过难度1点，你可以花费1充能来治愈你所在地点一位调查员1点伤害或1点恐惧。如果你成功且等于难度，失去2资源。
```

## 08120 · Prophetic / 先知先觉
- 行号：src/cards/cards-data.js:293126（name/nameZh） · src/cards/cards-data.js:293137（textZh） · src/cards/cards-data.js:293098（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Uses (2 resources). Replenish these resources at the start of each round.
Resources on Prophetic may be spent to pay for [[Fortune]], [[Spell]], or [[Spirit]] cards.
[fast] During a skill test on a [[Fortune]], [[Spell]], or [[Spirit]] card, spend 1 resource from Prophetic: You get +1 skill value for this test.
```
- text ZH:
```
使用(2资源)。每轮开始时重新补满资源。
先知先觉上的资源可以被花费来支付[[幸运]]、[[法术]]或[[勇气]]卡牌。
[free]在[[幸运]]、[[法术]]或[[勇气]]卡牌上的技能检定期间，从先知先觉花费1资源：你本次检定得到技能值+1。
```

## 08121 · Sleuth / 一探究竟
- 行号：src/cards/cards-data.js:293183（name/nameZh） · src/cards/cards-data.js:293194（textZh） · src/cards/cards-data.js:293155（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Uses (2 resources). Replenish these resources at the start of each round.
Resources on Sleuth may be spent to pay for [[Charm]], [[Tactic]], or [[Tome]] cards.
[fast] During a skill test on a [[Charm]], [[Tactic]], or [[Tome]] card, spend 1 resource from Sleuth: You get +1 skill value for this test.
```
- text ZH:
```
使用(2资源)。每轮开始时重新补满资源。
一探究竟上的资源可以被花费来支付[[守护]]、[[策略]]或[[书籍]]卡牌。
[free]在[[守护]]、[[策略]]或[[书籍]]卡牌上的技能检定期间，从一探究竟花费1资源：你本次检定得到技能值+1。
```

## 08122 · Bruiser / 好勇斗狠
- 行号：src/cards/cards-data.js:293240（name/nameZh） · src/cards/cards-data.js:293251（textZh） · src/cards/cards-data.js:293212（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Uses (2 resources). Replenish these resources at the start of each round.
Resources on Bruiser may be spent to pay for [[Armor]], [[Firearm]], or [[Melee]] cards.
[fast] During a skill test on a [[Armor]], [[Firearm]], or [[Melee]] card, spend 1 resource from Bruiser: You get +1 skill value for this test.
```
- text ZH:
```
使用(2资源)。每轮开始时重新补满资源。
好勇斗狠上的资源可以被花费来支付[[护甲]]、[[枪械]]或[[近战]]卡牌。
[free]在[[护甲]]、[[枪械]]或[[近战]]卡牌上的技能检定期间，从好勇斗狠花费1资源：你本次检定得到技能值+1。
```

## 08123 · Crafty / 技艺精湛
- 行号：src/cards/cards-data.js:293297（name/nameZh） · src/cards/cards-data.js:293308（textZh） · src/cards/cards-data.js:293269（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Uses (2 resources). Replenish these resources at the start of each round.
Resources on Crafty may be spent to pay for [[Insight]], [[Tool]], or [[Trick]] cards.
[fast] During a skill test on a [[Insight]], [[Tool]], or [[Trick]] card, spend 1 resource from Crafty: You get +1 skill value for this test.
```
- text ZH:
```
使用(2资源)。每轮开始时重新补满资源。
技艺精湛上的资源可以被花费来支付[[洞察]]、[[工具]]或[[技巧]]卡牌。
[free]在[[洞察]]、[[工具]]或[[技巧]]卡牌上的技能检定期间，从技艺精湛花费1资源：你本次检定得到技能值+1。
```

## 08124 · Antiquary / 古物藏家
- 行号：src/cards/cards-data.js:293354（name/nameZh） · src/cards/cards-data.js:293365（textZh） · src/cards/cards-data.js:293326（backTextZh）
- pack=eoep · type=asset
- traits: Talent  ||  才能
- text EN:
```
Uses (2 resources). Replenish these resources at the start of each round.
Resources on Antiquary may be spent to pay for [[Favor]], [[Relic]] or [[Ritual]] cards.
[fast] During a skill test on a [[Favor]], [[Relic]] or [[Ritual]] card, spend 1 resource from Antiquary: You get +1 skill value for this test.
```
- text ZH:
```
使用(2资源)。每轮开始时重新补满资源。
古物藏家上的资源可以被花费来支付[[恩惠]]、[[遗物]]或[[仪式]]卡牌。
[free]在[[恩惠]]、[[遗物]]或[[仪式]]卡牌上的技能检定期间，从古物藏家花费1资源：你本次检定得到技能值+1。
```

## 08125 · In the Thick of It / 危险处境
- 行号：src/cards/cards-data.js:293406（name/nameZh） · src/cards/cards-data.js:293417（textZh） · src/cards/cards-data.js:293383（backTextZh）
- pack=eoep · type=asset
- traits: Curse  ||  诅咒
- text EN:
```
Permanent. Limit 1 per deck. Purchase at deck creation.
When you purchase In the Thick of It, suffer 2 total physical and/or mental trauma. Then, earn 3 experience.
```
- text ZH:
```
永久。每套牌库仅限1张。当构建牌库时购买。
在你购买危险处境时，承受总共2点肉体和/或精神创伤。然后，取得3经验值。
```

## 08126 · Heavy Furs / 厚重皮衣
- 行号：src/cards/cards-data.js:293462（name/nameZh） · src/cards/cards-data.js:293477（textZh） · src/cards/cards-data.js:293435（backTextZh）
- pack=eoep · type=asset
- traits: Item / Armor  ||  道具 / 护甲
- text EN:
```
[reaction] After you reveal a non-[auto_fail] symbol on a chaos token during a skill test you are perfoming, deal 1 damage to Heavy Furs: Cancel that chaos token and return it to the bag. Reveal a new chaos token.
```
- text ZH:
```
[reaction]在你执行的一次技能检定中你揭示一个非[auto_fail]的符号混乱标记后，对厚重皮衣造成1伤害：取消该混乱标记并将其返回混乱袋。揭示一个新的混乱标记。
```

## 08127 · Sled Dog / 雪橇犬
- 行号：src/cards/cards-data.js:293524（name/nameZh） · src/cards/cards-data.js:293540（textZh） · src/cards/cards-data.js:293497（backTextZh）
- pack=eoep · type=asset
- traits: Ally / Creature  ||  盟友 / 生物
- text EN:
```
You may include up to 4 copies of Sled Dog in your deck. Up to 2 Sled Dog cards take up a single ally slot.
[action] Exhaust X Sled Dogs: Move. Move X times.
[action] Exhaust X Sled Dogs: Fight. You get +X [combat] for this attack. Instead of its standard damage, this attack deals X damage.
```
- text ZH:
```
你的牌库中可以有至多4张雪橇犬。1个盟友槽位可以有至多2张雪橇犬。
[action]横置X张雪橇犬：移动。移动X次。
[action]横置X张雪橇犬：攻击。你本次攻击得到+X[combat]。本次攻击不造成基础伤害，改为造成X点伤害。
```

## 08128 · Rod of Animalism / 驯兽之杖
- 行号：src/cards/cards-data.js:293586（name/nameZh） · src/cards/cards-data.js:293601（textZh） · src/cards/cards-data.js:293560（backTextZh）
- pack=eoep · type=asset
- traits: Item / Relic  ||  道具 / 遗物
- text EN:
```
You have 2 additional ally slots, which can only be used to hold [[Creature]] assets.
[reaction] When you play a [[Creature]] asset during your turn: Reduce that asset's cost by 1.
```
- text ZH:
```
你拥有额外2个盟友槽位，只可以用来携带[[生物]]支援。
[reaction]你在自己回合期间打出[[生物]]支援时：该支援的费用减1。
```

## 08129 · Call for Backup / 请求支援
- 行号：src/cards/cards-data.js:293647（name/nameZh） · src/cards/cards-data.js:293658（textZh） · src/cards/cards-data.js:293621（backTextZh）
- pack=eoep · type=event
- traits: Favor / Synergy  ||  恩惠 / 协作
- text EN:
```
One at a time, in any order, if you control a...
- [rogue] card, you may move to a connecting location.
- [guardian] card, deal 1 damage to an enemy at your location.
- [seeker] card, discover 1 clue at your location.
- [mystic] card, heal 1 horror from any card.
- [survivor] card, heal 1 damage from any card.
```
- text ZH:
```
以任意顺序依次结算，如果你控制……
- [rogue]卡牌，你可以移动到一个连接地点。
- [guardian]卡牌，对你所在地点的一个敌人造成1点伤害。
- [seeker]卡牌，发现你所在地点的1个线索。
- [mystic]卡牌，治愈任意卡牌的1点恐惧。
- [survivor]卡牌，治愈任意卡牌的1点伤害。
```

## 08130 · Arm Injury / 臂伤
- 行号：src/cards/cards-data.js:293701（name/nameZh） · src/cards/cards-data.js:293713（textZh） · src/cards/cards-data.js:293678（backTextZh）
- pack=eoep · type=treachery
- traits: Injury  ||  损伤
- text EN:
```
Revelation - Put Arm Injury into play in your threat area.
Arm Injury can be healed as if it were a single point of damage on you (if it is healed, discard it).
Forced - After you take a fight or activate action: You cannot take any of those types of actions for the remainder of the turn.
```
- text ZH:
```
显现 - 将臂伤放置入场，放到你的威胁区域。
臂伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
强制 - 在你执行攻击或启动行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```

## 08131 · Leg Injury / 腿伤
- 行号：src/cards/cards-data.js:293753（name/nameZh） · src/cards/cards-data.js:293765（textZh） · src/cards/cards-data.js:293730（backTextZh）
- pack=eoep · type=treachery
- traits: Injury  ||  损伤
- text EN:
```
Revelation - Put Leg Injury into play in your threat area.
Leg Injury can be healed as if it were a single point of damage on you (if it is healed, discard it).
Forced - After you take a move, resign, or evade action: You cannot take any of those types of actions for the remainder of the turn.
```
- text ZH:
```
显现 - 将腿伤放置入场，放到你的威胁区域。
腿伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
强制 - 在你执行移动、撤退或躲避行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```

## 08132 · Panic / 惊慌
- 行号：src/cards/cards-data.js:293805（name/nameZh） · src/cards/cards-data.js:293817（textZh） · src/cards/cards-data.js:293782（backTextZh）
- pack=eoep · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Put Panic into play in your threat area.
Panic can be healed as if it were a single point of horror on you (if it is healed, discard it).
Forced - After you take a play, engage, or resource action: You cannot take any of those types of actions for the remainder of the turn.
```
- text ZH:
```
显现 - 将惊慌放置入场，放到你的威胁区域。
惊慌可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
强制 - 在你执行打出、资源或交战行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```

## 08133 · Stupor / 麻木
- 行号：src/cards/cards-data.js:293857（name/nameZh） · src/cards/cards-data.js:293869（textZh） · src/cards/cards-data.js:293834（backTextZh）
- pack=eoep · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Put Stupor into play in your threat area.
Stupor can be healed as if it were a single point of horror on you (if it is healed, discard it).
Forced - After you take a parley, draw, or investigate action: You cannot take any of those types of actions for the remainder of the turn.
```
- text ZH:
```
显现 - 将麻木放置入场，放到你的威胁区域。
麻木可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
强制 - 在你执行谈判、抽取或调查行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```

## 08501 · Ice and Death / 亡命冰原
- 行号：src/cards/cards-data.js:293911（name/nameZh） · src/cards/cards-data.js:293922（textZh） · src/cards/cards-data.js:293886（backTextZh）
- pack=eoec · type=scenario
- text EN:
```
Easy / Standard
[skull]: -X. X is half the shelter value of your location (rounded up).
[cultist]: -2. If you fail, shuffle the top card of the Tekeli-li deck into your deck without looking at it (if you cannot, take 1 horror).
[tablet]: -3. For each point you fail by, discard the top card of your deck. Draw each weakness discarded by this effect.
```
- text ZH:
```
简单/普通
[skull]：-X。X等于你所在地点的庇护值的一半(向上取整)。
[cultist]：-2。如果你检定失败，将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容(如果你不能这么做，受到1点恐惧)。
[tablet]：-3。你检定失败且每低于难度1点，弃掉你牌库顶的1张卡牌。抽取所有以此效果弃掉的弱点。
```
- backText EN:
```
Hard / Expert
[skull]: -X. X is the shelter value of your location.
[cultist]: -2. For each point you fail by, shuffle the top card of the Tekeli-li deck into your deck without looking at it (for each card you cannot shuffle, take 1 horror).
[tablet]: -4. For each point you fail by, discard the top card of your deck. Draw each weakness discarded by this effect.
```
- backText ZH:
```
困难/专家
[skull]：-X。X等于你所在地点的庇护值。
[cultist]：-2。你检定失败且每低于难度1点，将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容(每有1张卡牌不能混洗入你的牌库，受到1点恐惧)。
[tablet]：-4。你检定失败且每低于难度1点，弃掉你牌库顶的1张卡牌。抽取所有以此效果弃掉的弱点。
```

## 08502 · Crash Site / 坠机点
- 行号：src/cards/cards-data.js:293963（name/nameZh） · src/cards/cards-data.js:293975（textZh） · src/cards/cards-data.js:293936（backTextZh）
- pack=eoec · type=location
- text EN:
```
[action]: Test [intellect] or [agility] (3) to scavenge from the wreckage. If you succeed, in the "Supplies Recovered" section of the Campaign Log, record Spare Parts. (Max one success per campaign.)
Shelter 0.
```
- text ZH:
```
[action]：检定[intellect]或[agility](3)以在残骸中搜寻。如果你检定成功，在剧本日志“已回收的补给品”中，记录备用零件(每个剧本最多一次成功)。
庇护0。
```
- backFlavor EN:
```
"It was risky business sailing over the antarctic in a single aëroplane without any line of bases..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“靠一架飞机穿越南极，沿途没有任何营地，这风险非常大……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08503 · Frozen Shores / 冰冻海岸
- 行号：src/cards/cards-data.js:294017（name/nameZh） · src/cards/cards-data.js:294029（textZh） · src/cards/cards-data.js:293989（backTextZh）
- pack=eoec · type=location
- traits: Mainland  ||  陆地
- text EN:
```
Frozen Shores gets +2 shroud if an encounter card is attached to it.
Shelter 2.
```
- text ZH:
```
如果有遭遇卡牌附属到冰冻海岸，冰冻海岸得到+2隐藏。
庇护2。
```
- flavor EN:
```
The sun never quite sets over the horizon past the icy shoreline, painting the sky a myriad tapestry of beautiful colors.
```
- flavor ZH:
```
冰冻海岸的太阳永远不会没入地平线下。天空就像一幅五彩缤纷的画布。
```
- backFlavor EN:
```
"There now stretched off to the east the low, white line of the great ice barrier..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“巨大冰障那低矮的白线现在向东延伸开去……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08504 · Treacherous Path / 危险道路
- 行号：src/cards/cards-data.js:294074（name/nameZh） · src/cards/cards-data.js:294086（textZh） · src/cards/cards-data.js:294047（backTextZh）
- pack=eoec · type=location
- traits: Mountains  ||  山脉
- text EN:
```
Forced - After you reveal 1 or more [frost] tokens during a skill test at Treacherous Path: Take 1 damage or horror for each [frost] token revealed.
Shelter 1.
```
- text ZH:
```
强制 - 你在危险道路的技能检定期间揭示[frost]混乱标记后：每揭示一个[frost]标记，受到1点伤害或恐惧。
庇护1。
```
- backFlavor EN:
```
"...in order to recover the Archaean slate vein in which he had found the odd markings, he would have to make a long sledge trip from these foothills to the steep slopes of the gigantic mountains themselves."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“…… 为了找到他曾发现过的有奇怪标记的太古代岩脉，他得坐着雪橇从这些山丘长途跋涉，到达那巍峨山脉的陡坡。 ”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08505 · Precarious Ice Sheet / 不稳定冰盖
- 行号：src/cards/cards-data.js:294131（name/nameZh） · src/cards/cards-data.js:294143（textZh） · src/cards/cards-data.js:294104（backTextZh）
- pack=eoec · type=location
- traits: Glacier  ||  冰川
- text EN:
```
[reaction] When you draw a [[Hazard]] treachery while at Precarious Ice Sheet, add 1 [frost] token to the chaos bag: Cancel that card's effects and discard it. (Group limit once per round.)
Shelter 2.
```
- text ZH:
```
[reaction]你在不稳定冰盖抽取一张[[危险]]诡计时，在混乱袋里加入1个[frost]标记：取消该卡牌的效果并将其弃掉。 (团队每轮仅限一次)。
庇护2。
```
- backFlavor EN:
```
"The ice-sheet was very thin, with dark ground here and there visible..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“冰盖非常薄，到处可以看到黑色的地面……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08506 · Broad Snowdrifts / 辽阔雪地
- 行号：src/cards/cards-data.js:294188（name/nameZh） · src/cards/cards-data.js:294200（textZh） · src/cards/cards-data.js:294161（backTextZh）
- pack=eoec · type=location
- traits: Mainland / Uncharted  ||  陆地 / 未勘之地
- text EN:
```
[reaction] When you successfully investigate Broad Snowdrifts, add 1 [frost] token to the chaos bag: Discover 3 additional clues at Broad Snowdrifts. (Group limit once per game.)
Shelter 4.
```
- text ZH:
```
[reaction]在你成功调查辽阔雪地时，在混乱袋里加入1个[frost]标记：发现辽阔雪地额外3个线索。(团队每场游戏仅限一次)
庇护4。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"...on the lofty ice barrier in the background, myriads of grotesque penguins squawked and flapped their fins..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……在后面高高的冰障上，无数奇奇怪怪的企鹅尖叫着拍打着它们的鳍……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08507 · Icy Wastes / 冰封荒原
- 行号：src/cards/cards-data.js:294247（name/nameZh） · src/cards/cards-data.js:294259（textZh） · src/cards/cards-data.js:294220（backTextZh）
- pack=eoec · type=location
- traits: Glacier / Uncharted  ||  冰川 / 未勘之地
- text EN:
```
Treat the modifier of the first [frost] token revealed during each skill test at Icy Wastes as -3, instead of -1.
Shelter 4.
```
- text ZH:
```
在冰封荒原的每次技能检定期间，改为将揭示的第一个[frost]标记的修正值视为-3，而不是-1。
庇护4。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"...in ten more miles we came to an unbroken waste virtually without signs of sentient artifice."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……又过了十英里，我们来到了一片连绵不断的荒地，完全没有任何人工造物的痕迹。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08508 · Rocky Crags / 岩石峭壁
- 行号：src/cards/cards-data.js:294306（name/nameZh） · src/cards/cards-data.js:294318（textZh） · src/cards/cards-data.js:294279（backTextZh）
- pack=eoec · type=location
- traits: Mountains / Uncharted  ||  山脉 / 未勘之地
- text EN:
```
Forced - When a treachery is attached to Rocky Crags: That treachery gains surge. (Max once per phase.)
Shelter 3.
```
- text ZH:
```
强制 - 在一张诡计附属到岩石峭壁时：该诡计获得涌动(每阶段仅限一次)。
庇护3。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"...rising perpendicularly to a height of 200 feet like the rocky cliffs of Quebec, and marking the end of southward navigation."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……垂直升到200英尺的高度，就像魁北克的岩石峭壁一样，而这也标志着这次向南航行的终点。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08509 · Snow Graves / 雪冢
- 行号：src/cards/cards-data.js:294365（name/nameZh） · src/cards/cards-data.js:294377（textZh） · src/cards/cards-data.js:294338（backTextZh）
- pack=eoec · type=location
- traits: Mainland / Uncharted  ||  陆地 / 未勘之地
- text EN:
```
[reaction] After you discover the last clue from Snow Graves, shuffle the top 3 cards of the Tekeli-li deck into your deck without looking at them: In the "Supplies Recovered" section of the Campaign Log, record Green Soapstone. (Group limit once per campaign.)
Shelter 5.
```
- text ZH:
```
[reaction]你发现雪冢的最后一个线索后，将忒咳哩-哩牌库顶的3张卡牌混洗入你的牌库，不要查看内容：在剧本日志“已回收的补给品”中，记录绿皂石。(团队每场战役限一次)
庇护5。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 2 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费2[per_investigator]个线索。
```
- backFlavor EN:
```
"...it surely looked like madness to find six imperfect monstrosities carefully buried upright in nine-foot snow graves under five-pointed mounds..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……发现六个残缺不全的怪物被小心地竖着埋在九英尺深的雪坑中，而上面还堆成了五角形，这看起来确实很疯狂……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08510 · Icebreaker Landing / 破冰船登陆点
- 行号：src/cards/cards-data.js:294424（name/nameZh） · src/cards/cards-data.js:294436（textZh） · src/cards/cards-data.js:294397（backTextZh）
- pack=eoec · type=location
- traits: Glacier / Uncharted  ||  冰川 / 未勘之地
- text EN:
```
[action]: Parley. Test [intellect] (4) to search the trapped ship for supplies. If you succeed, either remove 1 [frost] token from the chaos bag or record Small Radio in the "Supplies Recovered" section of the Campaign Log. (Max one success per campaign.)
Shelter 5.
```
- text ZH:
```
[action]：谈判。检定[intellect](4)来搜索被困船只，寻找补给品。如果你检定成功，移除混乱袋中的1个[frost]标记，或在剧本日志“已回收的补给品”中，记录小型收音机。(每个剧本最多一次成功)
庇护5。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 2 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费2[per_investigator]个线索。
```
- backFlavor EN:
```
"...we effected a difficult landing on Ross Island shortly after midnight on the morning of the 9th..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……9日凌晨，刚过午夜不久，我们艰难地登上了罗斯岛……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08511 · Frigid Cave / 严寒洞穴
- 行号：src/cards/cards-data.js:294483（name/nameZh） · src/cards/cards-data.js:294495（textZh） · src/cards/cards-data.js:294456（backTextZh）
- pack=eoec · type=location
- traits: Mountains / Uncharted  ||  山脉 / 未勘之地
- text EN:
```
[action] Add 1 [frost] token to the chaos bag: In the "Supplies Recovered" section of the Campaign Log, record Mineral Specimen. (Group limit once per campaign.)
Shelter 6.
```
- text ZH:
```
[action]在混乱袋里加入1个[frost]标记：在剧本日志“已回收的补给品”中，记录矿物标本。(团队每个剧本仅限一次)
庇护6。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 2 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费2[per_investigator]个线索。
```
- backFlavor EN:
```
"Close flying shews many cave-mouths, some unusually regular in outline, square or semicircular. You must come and investigate."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“飞近后看到许多岩洞口，有的轮廓非常规则，呈正方形或半圆形。你一定要来调查一下。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08512 · Barrier Camp / 屏障营地
- 行号：src/cards/cards-data.js:294542（name/nameZh） · src/cards/cards-data.js:294554（textZh） · src/cards/cards-data.js:294515（backTextZh）
- pack=eoec · type=location
- traits: Glacier / Uncharted  ||  冰川 / 未勘之地
- text EN:
```
[action]: Parley. Test [willpower] (4) to convince some of the other explorers here to give you something useful. If you succeed, in the "Supplies Recovered" section of the Campaign Log, record Dynamite. (Max one success per campaign.)
Shelter 7.
```
- text ZH:
```
[action]：谈判。检定[willpower](4)来说服这儿的其他探索者给你一些有用的东西。如果你检定成功，在剧本日志“已回收的补给品”中，记录炸药。(每个剧本最多一次成功)
庇护7。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 4 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费4[per_investigator]个线索。
```
- backFlavor EN:
```
"Our camp on the frozen shore below the volcano's slope was only a provisional one; headquarters being kept aboard the Arkham."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“我们在火山脚下冰冻的海岸上的营地只是临时的；总部依然在阿卡姆号上。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08513 · Remnants of Lake's Camp / 莱克营地遗址
- 行号：src/cards/cards-data.js:294601（name/nameZh） · src/cards/cards-data.js:294613（textZh） · src/cards/cards-data.js:294574（backTextZh）
- pack=eoec · type=location
- traits: Mainland / Uncharted  ||  陆地 / 未勘之地
- text EN:
```
[action]: Test [combat] (4) to dig through the snow in search of supplies. If you succeed, in the "Supplies Recovered" section of the Campaign Log, record Wooden Sledge. (Max one success per campaign.)
Shelter 7.
```
- text ZH:
```
[action]：检定[combat](4)来在雪地中挖掘以寻找补给。如果你检定成功，在剧本日志“已回收的补给品”中，记录木制雪橇。(每个剧本最多一次成功)
庇护7。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 4 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费4[per_investigator]个线索。
```
- backFlavor EN:
```
"It is only with vast hesitancy and repugnance that I let my mind go back to Lake's camp and what we really found there..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“让我重新回忆起莱克营地以及在那儿发现的东西，令我极为犹豫、抵触万分……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08514 · Crystalline Cavern / 水晶洞穴
- 行号：src/cards/cards-data.js:294660（name/nameZh） · src/cards/cards-data.js:294672（textZh） · src/cards/cards-data.js:294633（backTextZh）
- pack=eoec · type=location
- traits: Mountains / Uncharted  ||  山脉 / 未勘之地
- text EN:
```
[action]: Test [agility] (5) to climb up one of the crystalline walls in search of evidence. If you succeed, in the "Supplies Recovered" section of the Campaign Log, record Miasmic Crystal. (Max one success per campaign.)
Shelter 8.
```
- text ZH:
```
[action]：检定[agility](5)来爬上其中一面水晶墙以寻找证据。 如果你检定成功，在剧本日志中“已回收的补给品”中，记录瘴气水晶。(每个剧本最多一次成功)
庇护8。
```
- backText EN:
```
As an additional cost for you to enter this location, investigators at your location must spend 4 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入本地点的额外费用，你所在地点的调查员必须共同花费4[per_investigator]个线索。
```
- backFlavor EN:
```
"Parts, especially upper parts, seem to be of lighter-coloured rock than any visible strata on slopes proper, hence an evidently crystalline origin."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“有些部分，尤其是靠上的部分，似乎是由颜色较浅的岩石构成的，比斜坡本身更浅一些，因此很明显它原先是晶状的。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08515 · Skittering Nonsense / 疾行谬物
- 行号：src/cards/cards-data.js:294721（name/nameZh） · src/cards/cards-data.js:294732（textZh） · src/cards/cards-data.js:294691（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon  ||  怪物 / 幻灵
- text EN:
```
Hunter.
Forced - When you defeat Skittering Nonsense: Shuffle the top card of the Tekeli-li deck into your deck without looking at it (if you cannot, Skittering Nonsense attacks you).
```
- text ZH:
```
猎手。
强制 - 在你击败疾行谬物时：将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容(如果你不能这么做，疾行谬物攻击你)。
```

## 08516 · Apeirophobia / 无限恐惧症
- 行号：src/cards/cards-data.js:294776（name/nameZh） · src/cards/cards-data.js:294787（textZh） · src/cards/cards-data.js:294751（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Test [willpower] (X), where X is your location's shelter value. If you fail, you must decide (choose one):
- Take 1 horror for each point you failed by.
- Place 2 of your clues on your location.
- Add 1 [frost] token to the chaos bag.
```
- text ZH:
```
显现 - 检定[willpower](X)，X为你所在地点的庇护值。如果你检定失败，你必须决定(选择一项)：
- 每低于难度1点，受到1点恐惧。
- 将你的2个线索放到你所在地点。
- 在混乱袋里加入1个[frost]标记。
```

## 08517 · Zero Visibility / 零能见度
- 行号：src/cards/cards-data.js:294829（name/nameZh） · src/cards/cards-data.js:294840（textZh） · src/cards/cards-data.js:294804（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Put Zero Visibility into play in your threat area.
As an additional cost for you to leave a location with a treachery attached to it, you must spend 1 action.
Forced - At the end of your turn: Test [agility] (2). If you succeed, discard Zero Visibility.
```
- text ZH:
```
显现 - 将零能见度放置入场，放到你的威胁区域。
作为离开有诡计附属的地点的额外费用，你必须花费1个行动。
强制 - 当你的回合结束时：检定[agility](2)。如果你检定成功，弃掉零能见度。
```

## 08518 · Cold Welcome / 冷遇
- 行号：src/cards/cards-data.js:294887（name/nameZh） · src/cards/cards-data.js:294899（textZh） · src/cards/cards-data.js:294859（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - After a location is entered by an investigator for the first time: Put into play each set-aside location connected to that location. (Use the map in the Campaign Guide for reference.)
```
- text ZH:
```
强制 - 调查员第一次进入一个地点后：将放在一边的地点中，所有与该地点相连的地点放置入场。(参考剧本手册中的地图摆放)。
```
- backText EN:
```
Spawn a set-aside Skittering Nonsense at the lead investigator's location. Shuffle the remainder of the set-aside Skittering Nonsense enemies and the set-aside Creatures in the Ice encounter set into the encounter deck.
```
- backText ZH:
```
在调查员队长所在地点生成一个放在一边的疾行谬物。将剩余的放在一边的疾行谬物敌人，以及放在一边的冰中生物遭遇组混洗入遭遇牌库。
```
- flavor EN:
```
This isn't exactly how you imagined your first foray into the Antarctic wilds. The stinging cold and lashing, frozen winds will only get worse over time.
```
- flavor ZH:
```
这和你想像中第一次进入南极荒野不太一样。随着时间推移，刺骨的寒冷和鞭挞着你的冰冷寒风会让情况越来越糟。
```
- backFlavor EN:
```
"Hold on! Come see this!" one of the other team members shouts as you trudge ahead through the snow. You turn back and examine what they have found - a second set of tracks in the snow, but smaller, misshapen. Almost impossibly so.
"What in the hell could have made these tracks?" one of your party asks. You stand dumbfounded. Very little wildlife exists out here in the frozen wastes. And these tracks match nothing you've ever seen before. Nothing you can even imagine.
You don't have to question what could make such tracks for long. A shape emerges from the erupting snow, twisted and deformed, like a splotch of ink spilled upon the canvas of reality. It makes a strange, almost familiar cry that is eaten by the howling wind: "-li! -li!" Then, with terrifying speed, it rushes toward you.
```
- backFlavor ZH:
```
“等一下！来看下这个！”当你在雪地中艰难前行时，另一名队员喊道。你返回看看他们发现了什么——雪地上有另一组脚印，但是更小，而且是畸形的。这几乎不可能。
“到底是什么鬼东西留下了这些脚印？”团队中的一人问道。你目瞪口呆地站着。在这片冰冻荒原上，几乎没有野生动物存在。而且你从没见过有什么动物是这种脚印。你甚至无法想像这是什么生物。
但很快你就不用纠结这是什么东西的脚印了。 一道身影从喷发的雪中出现，扭曲变形，就像泼洒在现实画布上的墨点。 它发出一种奇怪的、有些熟悉的叫声，但被呼啸的狂风吞没了：“——哩！——哩！”然后，它以惊人的速度向你冲来。
```

## 08519 · Into the White / 深入白雪
- 行号：src/cards/cards-data.js:294942（name/nameZh） · src/cards/cards-data.js:294954（textZh） · src/cards/cards-data.js:294914（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - After a location is entered by an investigator for the first time: Put into play each set-aside location connected to that location. (Use the map in the Campaign Guide for reference.)
```
- text ZH:
```
强制 - 调查员第一次进入一个地点后：将放在一边的地点中，所有与该地点相连的地点放置入场。(参考剧本手册中的地图摆放)。
```
- backText EN:
```
Spawn the set-aside Terror of the Stars enemy at the revealed location with the highest shelter value.
```
- backText ZH:
```
将放在一边的星之恐怖敌人生成在已揭示的庇护值最高的地点。
```
- flavor EN:
```
Something dwells beneath the ice. Something you've never seen or heard of before, not even in William Dyer's horrifying report. Something...unreal.
```
- flavor ZH:
```
有什么东西潜伏在冰雪之下。那是你从没见过也没听过的，甚至在威廉·戴尔那可怕的报告中也未提及丝毫的东西。那是……非现实的东西。
```
- backFlavor EN:
```
These things, these manifestations, they're not beasts or even alien creatures like those Dyer and Danforth encountered in their last expedition. You're not even sure they are entities at all. They have no shape, consisting of an almost proto-plasmic substance that seeps back into the ice when harmed or whenever you escape their clutches. Given the persistence of these entities and the inclement, deadly conditions of Antarctica, you know you won't survive the night without finding shelter.
Just as you are pondering what your next move should be, the ice beneath you rumbles with tremendous force, letting out a terrifying groan. "An earthquake?" one of your party asks over the raucous noise.
"No, that's impossible," another replies. You share a dreadful glance. Could it be one of those...things?
```
- backFlavor ZH:
```
这些东西，这些存在，它们不是野兽，甚至也不像戴尔和丹佛斯上次探险中遭遇的外星生物。你甚至不确定它们是不是实体。它们没有形状，由几乎像原生质一样的物质组成，当受到伤害或你逃脱它们的控制时，就会重新渗入冰雪之中。考虑到这些实体的存在，以及南极严酷致命的环境，你明白，如果找不到庇护所，你将无法熬过夜晚。
就在你思考下一步该怎么做的时候，你脚下的冰面开始剧烈震动，轰隆隆的巨响，发出可怕的呻吟。“地震？”团队中有人沙哑着嗓子问。
“不，这不可能。”另一人回答。你的眼神也充满畏惧。会不会也是那种……东西？
```

## 08520 · Running Out of Time / 没时间了
- 行号：src/cards/cards-data.js:294997（name/nameZh） · src/cards/cards-data.js:295009（textZh） · src/cards/cards-data.js:294969（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - After a location is entered by an investigator for the first time: Put into play each set-aside location connected to that location. (Use the map in the Campaign Guide for reference.)
```
- text ZH:
```
强制 - 调查员第一次进入一个地点后：将放在一边的地点中，所有与该地点相连的地点放置入场。(参考剧本手册中的地图摆放)。
```
- backText EN:
```
Each investigator, including those who are eliminated, shuffles the top card of the Tekeli-li deck into their deck.
Choose a location in play with no clues on it. Each undefeated investigator moves to that location and immediately resigns. The higher that location's shelter value, the better. If the investigators cannot choose such a location, they must move to the Crash Site and immediately resign, even if they otherwise could not. (Then, resolve the [[Objective]] on act 1a.)
```
- backText ZH:
```
每位调查员(包括已退场的)将忒咳哩-哩牌库顶的1张卡牌混洗入自己的牌库。
选择场上一个没有线索的地点。每位没有被击败的调查员移动到该地点并立即撤退。该地点的庇护值越高越好。如果调查员无法选择此类地点，则必须无视任何条件移动至坠机点并立即撤退(然后，结算场景1a上的目标)。
```
- flavor EN:
```
The sun hangs low in the sky, but never sets. Your party is exhausted from the long, arduous day. Though the sky is never plunged into the dark of night, you know it's only a matter of time before you are forced to make camp.
```
- flavor ZH:
```
太阳低悬于天空，但从不落下。你们团队经过漫长而艰苦的一天，已经筋疲力尽了。虽然天空永远不会陷入黑夜，但你知道被迫扎营只是早晚的事。
```
- backFlavor EN:
```
You can go on no longer. It's not ideal, but you'll have to make do with the shelter you've found. You only hope that it's enough to keep your party from freezing... or worse.
```
- backFlavor ZH:
```
你无法再继续了。虽然不是很理想，但你只能将就着使用你找到的庇护地了。你只希望这里足够让你的团队避免冻死……或更糟的情况。
```

## 08521 · Search for a Camp Site / 寻找扎营点
- 行号：src/cards/cards-data.js:295051（name/nameZh） · src/cards/cards-data.js:295063（textZh） · src/cards/cards-data.js:295024（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] If each investigator is at the same location and that location has no clues on it: Resign. You set up camp. Each investigator resigns.
Objective - Find somewhere safe to set up camp. If each undefeated investigator has resigned, advance. The higher the shelter value of the location they resigned at, the better.
```
- text ZH:
```
[action]如果所有调查员都在同一地点，且该地点上没有线索：撤退。你扎起了营。所有调查员撤退。
目标 - 找到安全的地方扎营。如果所有未被击败的调查员都撤退了，推进场景。他们撤退的地点的庇护值越高越好。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
You're going to have to find a way back to camp, and soon...or you'll have to make due camping in the wilds.
```
- flavor ZH:
```
你得找到回营地的路，而且要尽快……不然你就只能在野外暂且扎营。
```
- backFlavor EN:
```
Exhausted and terrified by your ordeal, you decide this is as good a place as any to make camp for the night. Perhaps tomorrow you can salvage some kind of academic value out of this hellish journey, but for now such things seem trivial. Survival is the only thing on your mind.
```
- backFlavor ZH:
```
你经历苦难，现在筋疲力尽、惊恐不已。你决定这里是扎营过夜的好地方。也许明天你能从这地狱般的旅程中挖掘一些学术价值，但现在这些事情根本微不足道。你满脑子只想着活下去。
```

## 08522 · Terror of the Stars / 星之恐怖
- 行号：src/cards/cards-data.js:295106（name/nameZh） · src/cards/cards-data.js:295118（textZh） · src/cards/cards-data.js:295076（backTextZh）
- pack=eoec · type=enemy · subname=Bringer of Ice and Death / 带来寒冰与死亡
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Hunter. Massive.
Terror of the Stars gets +3 [per_investigator] health.
While Terror of the Stars is ready, investigators cannot resign at its location or discover clues at its location.
```
- text ZH:
```
猎手。 庞大。
星之恐怖得到+3[per_investigator]生命值。
星之恐怖处于重整状态时，调查员不能在星之恐怖所在地点撤退，或发现星之恐怖所在地点的线索。
```

## 08523 · A Harsh Wind Blows / 狂风呼啸
- 行号：src/cards/cards-data.js:295170（name/nameZh） · src/cards/cards-data.js:295182（textZh） · src/cards/cards-data.js:295142（backTextZh）
- pack=eoec · type=agenda
- backText EN:
```
Choose a facedown encounter card beneath a location. Look at the other side of that card (without resolving its text). Then return it facedown beneath that location.
```
- backText ZH:
```
选择在一个地点底下的一张正面朝下的遭遇卡牌。查看该卡牌正面(不要结算其文字)。然后将其正面朝下放回该地点底下。
```
- flavor EN:
```
Several of your party have mysteriously vanished in the night. Without a sign of any struggle, you can only assume they left of their own accord...but why?
```
- flavor ZH:
```
你团队中几个人在晚上神秘消失。没有任何挣扎的迹象，你只能认为他们是自愿离开的……但是为什么？
```
- backFlavor EN:
```
As you journey through the glacial wilds, you stumble across a set of tracks in the snow leading farther from camp. You pause and investigate further. Were these tracks made by one of your missing team members? Or by something more...monstrous?
```
- backFlavor ZH:
```
当你穿越冰川荒野时，你偶然发现一组脚印，朝着远离营地的方向延伸。你停下来作进一步调查。这些足迹是你失踪的一名队员留下的吗？还是什么……更可怕的东西？
```

## 08524 · The Chill of Night / 寒冷夜晚
- 行号：src/cards/cards-data.js:295225（name/nameZh） · src/cards/cards-data.js:295237（textZh） · src/cards/cards-data.js:295197（backTextZh）
- pack=eoec · type=agenda
- backText EN:
```
Choose a facedown encounter card beneath a location. Look at the other side of that card (without resolving its text). Then return it facedown beneath that location.
```
- backText ZH:
```
选择在一个地点底下的一张正面朝下的遭遇卡牌。查看该卡牌正面(不要结算其文字)。然后将其正面朝下放回该地点底下。
```
- flavor EN:
```
The low-hanging sun dimly illuminates the Antarctic night. Gray clouds cover the sky, threatening an icy storm.
```
- flavor ZH:
```
低垂的太阳照亮了南极的夜晚。天空乌云密布，预示着一场冰雪风暴即将来临。
```
- backFlavor EN:
```
As you journey through the glacial wilds, you stumble across a set of tracks in the snow leading farther from camp. You pause and investigate further. Were these tracks made by one of your missing team members? Or by something more...monstrous?
```
- backFlavor ZH:
```
当你穿越冰川荒野时，你偶然发现一组脚印，朝着远离营地的方向延伸。你停下来作进一步调查。这些足迹是你失踪的一名队员留下的吗？还是什么……更可怕的东西？
```

## 08525 · Madness and Death / 疯狂与死亡
- 行号：src/cards/cards-data.js:295280（name/nameZh） · src/cards/cards-data.js:295292（textZh） · src/cards/cards-data.js:295252（backTextZh）
- pack=eoec · type=agenda
- backText EN:
```
Each remaining investigator is defeated and suffers 1 mental trauma.
(→R1)
```
- backText ZH:
```
剩下的每位调查员被击败并承受1点精神创伤。
(→结局1)
```
- flavor EN:
```
The storm grows closer, and with it looming in the sky, that damnable sound returns. It haunts you with its presence, worming its way into your mind. Is it the cause of this folly? This madness?
```
- flavor ZH:
```
风暴越来越近，而随着它在天空中逼近，那该死的声音又回来了。它萦绕着你，钻进你的思想。是它造成了这场闹剧吗？还有这场疯狂？
```
- backFlavor EN:
```
As the night ends, the storm arrives in its full ferocity. Raging, icy winds and dense snowfall make your task impossible. You'll never find the remaining team members in these conditions, and even if you did...
A hard lump of guilt and despair forms in your throat. There's no way they would survive in this storm, not without supplies or shelter. That you are forced to choose between your life and theirs is a burden you will surely carry with you for the rest of your life. And you'll be lucky if that's more than a couple of days.
```
- backFlavor ZH:
```
夜幕退散，风暴肆虐。凛冽的寒风和密集的大雪让你的任务失去了成功的可能。在这种情况下你永远也找不到剩下的团队成员，而即使你找到了……
一股强烈的内疚和绝望涌上你的喉咙。在这场风暴中，没有补给和庇护所，活下来是不可能的。你只能在双方的性命之间做取舍，这项决定会成为你一辈子的心理负担。当然，前提是你这辈子不会过几天就到头。
```

## 08526 · The Lost Expedition / 失踪队员
- 行号：src/cards/cards-data.js:295334（name/nameZh） · src/cards/cards-data.js:295346（textZh） · src/cards/cards-data.js:295307（backTextZh）
- pack=eoec · type=act
- text EN:
```
[fast] Investigators at your location spend 1 [per_investigator] clues, as a group: Draw the encounter card beneath your location.
[action] If you are at camp: Resign. You turn in for the night.
Objective - Find as many missing expedition members as you can by adding them to the victory display, then head back to camp before daybreak. If each undefeated investigator has resigned, advance.
```
- text ZH:
```
[free]你所在地点的调查员共同花费1[per_investigator]个线索：抽取你所在地点底下的遭遇卡牌。
[action]如果你位于营地：撤退。你回来渡过夜晚。
目标 - 找到尽可能多的失踪探险队成员(将其加入胜利区)，然后在黎明到来前回到营地。如果所有未被击败的调查员都撤退了，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
You set out to search for the missing team members, hoping to find them before daybreak...
```
- flavor ZH:
```
你开始寻找失踪的队员，希望在黎明前找到他们……
```
- backFlavor EN:
```
With night coming to a close, the storm approaches faster and faster. Soon, the weather will be too deadly for your search to continue. If anyone is still out there, you doubt they'll survive - and neither will you if you remain unsheltered any longer. You return to your camp, your heart heavy with guilt and and your mind addled by that foul noise that festers within.
```
- backFlavor ZH:
```
随着夜晚临近结束，风暴接近得越来越迅速了。很快，天气就会变得非常恶劣，你们将无法继续搜寻。如果还有人在外面，你怀疑他们是否还能活下来——当然，如果你也继续待在庇护所外面，那你也是一样的下场。你返回营地，你的心被沉重的罪恶感压迫着，而你的思想被你身体里那不断滋长的污秽声音所腐化。
```

## 08527 · Dead End / 死路
- 行号：src/cards/cards-data.js:295384（name/nameZh） · src/cards/cards-data.js:295395（textZh） · src/cards/cards-data.js:295359（backTextZh）
- pack=eoec · type=story
- text EN:
```
Remove 1 [frost] token from the chaos bag.
Add this story card to the victory display.
```
- text ZH:
```
从混乱袋里移除1个[frost]标记。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
There is nothing here but ice and snow, and no sign of any missing team members. Frustrated, you turn back. You won't find anyone here.
```
- flavor ZH:
```
这里除了冰雪以外什么都没有，也没有任何失踪队员的迹象。你垂头丧气地回了头。你在这找不到任何人。
```

## 08528 · Cracks in the Ice / 冰上裂缝
- 行号：src/cards/cards-data.js:295434（name/nameZh） · src/cards/cards-data.js:295445（textZh） · src/cards/cards-data.js:295409（backTextZh）
- pack=eoec · type=story
- text EN:
```
Search your deck for a copy of Tekeli-li and place it on the bottom of the Tekeli-li deck without resolving it. Shuffle your deck.
Add this story card to the victory display.
```
- text ZH:
```
查找你的牌库，找出一张忒咳哩-哩并将其放到忒咳哩-哩牌库底，不要结算它。混洗你的牌库。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
As you traverse the glacial wilds, something rumbles and churns beneath your feet. Is that where these creatures are coming from? In the depths of the ice?
A somber thought crosses your mind. If you are right, such entities could exert their vile influence no matter where you stand. Perhaps this has something to do with your missing companions after all, though there are no signs of them here.
```
- flavor ZH:
```
当你穿越冰川荒野时，有东西在你脚下搅动，隆隆作响。这些生物就是从那里来的吗？从冰雪深处？
一个严峻的想法掠过你的脑海。如果你是对的，那不管你在哪里，都逃不出这些存在的魔爪。也许这跟你失踪的同伴有关系，尽管这里没有他们的踪迹。
```

## 08529 · Somber Remains / 忧心弃物
- 行号：src/cards/cards-data.js:295484（name/nameZh） · src/cards/cards-data.js:295495（textZh） · src/cards/cards-data.js:295459（backTextZh）
- pack=eoec · type=story
- text EN:
```
Search the top 9 cards of your deck for each copy of Tekeli-li and place each one you find on the bottom of the Tekeli-li deck without resolving it. Shuffle your deck.
Add this story card to the victory display.
```
- text ZH:
```
查找你牌库顶的9张卡牌，找出其中所有忒咳哩-哩，并将这些卡牌都放在忒咳哩-哩牌库底，不要结算它们。混洗你的牌库。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
You come across evidence of one of your lost companions, abandoned and half-buried in snow - torn scraps from a heavy fur coat and a pair of goggles. Examining the goggles closely yields a terrifying discovery - a dark, sticky substance that you cannot, for the life of you, identify.
```
- flavor ZH:
```
你偶然发现了一个失踪同伴的迹象，是厚重毛皮大衣上撕下的碎片和一副护目镜，被遗弃在这里，半埋在雪中。仔细检查护目镜，你发现一些可怕的事情——一种你无论如何也认不出的黑色粘稠物质。
```

## 08530 · Disappearing Footprints / 消失的足迹
- 行号：src/cards/cards-data.js:295534（name/nameZh） · src/cards/cards-data.js:295545（textZh） · src/cards/cards-data.js:295509（backTextZh）
- pack=eoec · type=story
- text EN:
```
Remove 1 [frost] token from the chaos bag.
Add this story card to the victory display.
```
- text ZH:
```
从混乱袋里移除1个[frost]标记。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
The tracks continue for some time before vanishing, bafflingly, into the snow. There's no sign of any struggle, nor are there any other tracks that might indicate where they could have gone. Could the winds have covered the tracks? And if so, why were you able to follow the rest of the footprints so easily?
But when you turn back to examine the prints you first followed, they too are gone.
```
- flavor ZH:
```
足迹持续了一段，然后莫名其妙地消失在雪地中。没有任何挣扎的迹象，也没有任何其他痕迹可以表明他们可能去了哪里。难道是狂风将足迹掩埋了吗？但如果是这样，为什么你能这么轻易的追踪到之前的脚印呢？
你转身想检查一路跟来的脚印，却发现它们也消失了。
```

## 08531 · Dissected Explorer / 被剖开的探险家
- 行号：src/cards/cards-data.js:295584（name/nameZh） · src/cards/cards-data.js:295595（textZh） · src/cards/cards-data.js:295559（backTextZh）
- pack=eoec · type=story
- text EN:
```
Search your deck for a copy of Tekeli-li and place it on the bottom of the Tekeli-li deck without resolving it. Shuffle your deck.
Add this story card to the victory display.
```
- text ZH:
```
查找你的牌库，找出一张忒咳哩-哩并将其放到忒咳哩-哩牌库底，不要结算它。混洗你的牌库。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
You follow a set of tracks into a small cavern carved into a glacial wall, and your stomach lurches at the sight before you. One of your missing team members lies in a crumpled heap at the end of the hollow, his clothing torn open. A clean vertical incision has bisected his torso open from his sternum to his belly, and his entrails have been carefully removed. You struggle not to retch. Who could have possibly done such a thing?
```
- flavor ZH:
```
你跟着一组脚印进入了一个在冰川峭壁上凿出的小洞穴，而看到眼前的景象，你的胃痉挛起来。一名失踪队员躺在坑洞尽头，衣服被撕开了。一道利落的切口从他的胸口切开到腹部，他的内脏被小心地取走了。你努力不让自己呕吐。谁会做出这样的事？
```

## 08532 · Evil Within / 深层邪恶
- 行号：src/cards/cards-data.js:295634（name/nameZh） · src/cards/cards-data.js:295645（textZh） · src/cards/cards-data.js:295609（backTextZh）
- pack=eoec · type=story
- text EN:
```
Discard an [[Eidolon]] enemy that does not have the [[Elite]] trait from play.
Add this story card to the victory display.
```
- text ZH:
```
从场上弃掉一个没有[[精英]]特性的[[幻灵]]敌人。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
You are fleeing from a creature made of kaleidoscopic ooze when you suddenly freeze in place, a web of cracks reaching out across the ice beneath your boots. Your breath catches in your throat. Another step could spell your doom or save your life. Behind you, the entity gains on you, reaching out with arms that are not quite solid or liquid. Feeling lucky, you decide to roll the dice, striking the ground behind you and fleeing to the side. Just as you hoped, the ice is thin enough to splinter open, and the creature tumbles down through the crack, into the icy depths. You breathe a sigh of relief, thankful you did not share a similar fate.
```
- flavor ZH:
```
你正在逃离一个由千变万化的软泥组成的生物时，突然停了下来，脚下的冰面上布满了裂缝。你大气不敢出一口。再走一步，你就可能万劫不复，或者小命得救。在你身后，那个实体渐渐靠近你，伸出既不完全是固体也不完全是液体的手臂。你想试试运气，决定孤注一掷，猛击身后的冰面并逃到一边。正如你所希望的，冰面足够薄从而裂开，那生物掉进裂缝，去往深处。你松了一口气，还好下去的不是自己。
```

## 08533 · Bloody Evidence / 血腥证据
- 行号：src/cards/cards-data.js:295684（name/nameZh） · src/cards/cards-data.js:295695（textZh） · src/cards/cards-data.js:295659（backTextZh）
- pack=eoec · type=story
- text EN:
```
Search the top 9 cards of your deck for each copy of Tekeli-li and place each one you find on the bottom of the Tekeli-li deck without resolving it. Shuffle your deck.
Add this story card to the victory display.
```
- text ZH:
```
查找你牌库顶的9张卡牌，找出其中所有忒咳哩-哩，并将这些卡牌都放在忒咳哩-哩牌库底，不要结算它们。混洗你的牌库。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
You follow a set of footprints through the snow, hoping they will lead you to a sign, any sign, of your lost companions. Sadly, the evidence you discover is not the kind you were hoping to find. Where the prints end, you find an ice pick covered in freshly frozen blood. To your horror, a human eye lies nearby, staining the snow red. A shudder creeps up your spine. What on Earth could compel somebody to do such a thing?
```
- flavor ZH:
```
你跟着雪地上的一组脚印，希望它们能指引你找到失踪同伴的任何迹象。遗憾的是，你找到的迹象并不是你想要的那种。在脚印的尽头，你发现一个覆盖着新鲜冻血的破冰锥。令你惊恐的是，旁边放着一个人类的眼珠，把雪染成了红色。你的脊梁上冒出寒气，忍不住打了个寒颤。究竟是什么迫使一个人做出这种事情？
```

## 08534 · Madness Inside / 心中的疯狂
- 行号：src/cards/cards-data.js:295734（name/nameZh） · src/cards/cards-data.js:295745（textZh） · src/cards/cards-data.js:295709（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose a [[Possessed]] enemy in play that does not have the [[Elite]] trait. Take control of each doom on that enemy, flipping them to their clue sides. Discard the chosen enemy.
Add this story card to the victory display.
```
- text ZH:
```
选择场上一个没有[[精英]]特性的[[附身]]敌人。控制该敌人上所有毁灭标记，并将其翻到线索面。弃掉选择的敌人。
将本剧情卡牌加入胜利区。
```
- flavor EN:
```
To your relief, you come across one of your missing team members - but they are not themself. Their eyes glazed over, their expression dazed and lost. A murky, slimy substance drips from their face and trickles onto the ice below. When you finally manage to get through to them, they wipe the strange, inky miasma from their face, staining their cheeks black. "What...was I doing?" they ask.
```
- flavor ZH:
```
让你松一口气的是，你遇到了一名失踪的队员——但已经面目全非了。对方目光呆滞，神情茫然。一种浑浊、粘稠的物质从这名队员的脸上滴下来，落到下面的冰面上。当你最终准备接近，对方擦拭着脸上奇怪、墨黑的瘴气，脸颊都染成了黑色。“我在……做什么？”那人问道。
```

## 08535 · Professor William Dyer / 威廉·戴尔教授
- 行号：src/cards/cards-data.js:295789（name/nameZh） · src/cards/cards-data.js:295801（textZh） · src/cards/cards-data.js:295759（backTextZh）
- pack=eoec · type=enemy · subname=Professor of Geology / 地质学教授
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action] Choose and discard up to 2 cards from your hand: Parley. Place that many resources on Professor William Dyer (from the token bank). If there are 3 [per_investigator] resources on him, add him to the victory display.
Forced - If Professor William Dyer is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
[action]从你的手中选择并弃掉最多2张卡牌：谈判。将相等数量的资源(从供应堆拿取)放在威廉·戴尔教授上。如果其上有3[per_investigator]资源，将其加入胜利区。
强制 - 如果威廉·戴尔教授被击败：在剧本日志上划掉其名字。
```

## 08536 · Danforth / 丹佛斯
- 行号：src/cards/cards-data.js:295853（name/nameZh） · src/cards/cards-data.js:295865（textZh） · src/cards/cards-data.js:295823（backTextZh）
- pack=eoec · type=enemy · subname=Brilliant Student / 杰出学生
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. You listen closely to Danforth's rambling. Draw up to 2 cards from the top of the Tekeli-li deck. Then, place that many resources on Danforth (from the token pool). If there are 3 [per_investigator] resources on him, add him to the victory display.
Forced - If Danforth is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。你仔细听丹佛斯的胡言乱语。抽取忒咳哩-哩牌库顶最多2张卡牌。然后，将相等数量的资源(从供应堆拿取)放在丹佛斯上。如果其上有3[per_investigator]资源，将其加入胜利区。
强制 - 如果丹佛斯被击败：在剧本日志上划掉其名字。
```

## 08537 · Eliyah Ashevak / 伊里亚·阿什瓦克
- 行号：src/cards/cards-data.js:295917（name/nameZh） · src/cards/cards-data.js:295929（textZh） · src/cards/cards-data.js:295887（backTextZh）
- pack=eoec · type=enemy · subname=Dog Handler / 驯犬师
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. Test [agility] (2) to sneak by Anyu and speak with Eliyah. For each point you succeed by, place 1 resource on him (from the token pool). If you fail, he attacks you. If there are 2 [per_investigator] resources on him, add him to the victory display.
Forced - If Eliyah Ashevak is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。检定[agility](2)以偷偷溜过安雨，并与伊里亚交谈。你检定成功且每超过难度1点，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有2[per_investigator]资源，将其加入胜利区。
强制 - 如果伊里亚·阿什瓦克被击败：在剧本日志上划掉其名字。
```

## 08538 · Dr. Mala Sinha / 玛拉·辛哈医生
- 行号：src/cards/cards-data.js:295981（name/nameZh） · src/cards/cards-data.js:295993（textZh） · src/cards/cards-data.js:295951（backTextZh）
- pack=eoec · type=enemy · subname=Daring Physician / 无畏医师
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. Test [willpower] (2) to attempt to calm Dr. Sinha down. For each point you succeed by, place 1 resource on her (from the token pool). If you fail, she attacks you. If there are 2 [per_investigator] resources on her, add her to the victory display.
Forced - If Dr. Mala Sinha is defeated: Cross her name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。检定[willpower](2)以试图让辛哈医生冷静下来。你检定成功且每超过难度1点，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有2[per_investigator]资源，将其加入胜利区。
强制 - 如果玛拉·辛哈医生被击败：在剧本日志上划掉其名字。
```

## 08539 · Avery Claypool / 艾弗里·克莱普尔
- 行号：src/cards/cards-data.js:296045（name/nameZh） · src/cards/cards-data.js:296057（textZh） · src/cards/cards-data.js:296015（backTextZh）
- pack=eoec · type=enemy · subname=Antarctic Guide / 南极向导
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. Test [willpower] or [intellect] (5) to get Claypool to stop babbling nonsense. If you succeed, place 1 resource on him (from the token pool). If you fail, he attacks you. If there are 1 [per_investigator] resources on him, add him to the victory display.
Forced - If Avery Claypool is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。检定[willpower]或[intellect](5)以使克莱普尔停止胡言乱语。如果你检定成功，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有1[per_investigator]资源，将其加入胜利区。
强制 - 如果艾弗里·克莱普尔被击败：在剧本日志上划掉其名字。
```

## 08540 · James "Cookie" Fredericks / 詹姆斯·“曲奇”·弗雷德里克斯
- 行号：src/cards/cards-data.js:296109（name/nameZh） · src/cards/cards-data.js:296121（textZh） · src/cards/cards-data.js:296079（backTextZh）
- pack=eoec · type=enemy · subname=Dubious Choice / 不可靠人选
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
Retaliate.
[action]: Parley. Test [combat] (2) to wrestle the gun away from Cookie. For each point you succeed by, place 1 resource on him (from the token pool). If you fail, he attacks you. If there are 2 [per_investigator] resources on him, add him to the victory display.
Forced - If James "Cookie" Fredericks is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
反击。
[action]：谈判。检定[combat](2)以夺走曲奇的枪。你检定成功且每超过难度1点，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有2[per_investigator]资源，将其加入胜利区。
强制 - 如果詹姆斯·“曲奇”·弗雷德里克斯被击败：在剧本日志上划掉其名字。
```

## 08541 · Dr. Amy Kensler / 艾米·肯斯勒博士
- 行号：src/cards/cards-data.js:296173（name/nameZh） · src/cards/cards-data.js:296185（textZh） · src/cards/cards-data.js:296143（backTextZh）
- pack=eoec · type=enemy · subname=Professor of Biology / 生物学教授
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. Test [intellect] (2) to convince Dr. Kensler to tell you what she has seen. For each point you succeed by, place 1 resource on her (from the token pool). If you fail, she attacks you. If there are 2 [per_investigator] resources on her, add her to the victory display.
Forced - If Dr. Amy Kensler is defeated: Cross her name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。检定[intellect](2)以说服肯斯勒博士将她看到的东西都告诉你。你检定成功且每超过难度1点，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有2[per_investigator]资源，将其加入胜利区。
强制 - 如果艾米·肯斯勒博士被击败：在剧本日志上划掉其名字。
```

## 08542 · Roald Ellsworth / 罗尔德·埃尔斯沃思
- 行号：src/cards/cards-data.js:296237（name/nameZh） · src/cards/cards-data.js:296249（textZh） · src/cards/cards-data.js:296207（backTextZh）
- pack=eoec · type=enemy · subname=Intrepid Explorer / 英勇的探险家
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action]: Parley. Test [combat] or [agility] (5) to get Ellsworth to let go of the strange rock he is clutching. If you succeed, place 1 resource on him (from the token pool). If you fail, he attacks you. If there are 1 [per_investigator] resources on him, add him to the victory display.
Forced - If Roald Ellsworth is defeated: Cross his name off in the Campaign Log.
```
- text ZH:
```
[action]：谈判。检定[combat]或[agility](5)以使埃尔斯沃思放下手里的奇怪石头。如果你检定成功，在其上放置1资源(从供应堆拿取)。如果你检定失败，其攻击你。如果其上有1[per_investigator]资源，将其加入胜利区。
强制 - 如果罗尔德·埃尔斯沃思被击败：在剧本日志上划掉其名字。
```

## 08543 · Takada Hiroko / 高田弘子
- 行号：src/cards/cards-data.js:296301（name/nameZh） · src/cards/cards-data.js:296313（textZh） · src/cards/cards-data.js:296271（backTextZh）
- pack=eoec · type=enemy · subname=Aeroplane Mechanic / 飞机技师
- traits: Humanoid / Possessed / Elite  ||  类人 / 附身 / 精英
- text EN:
```
[action] Spend up to 3 resources: Parley. Place each of these resources on Takada Hiroko. If there are 5 [per_investigator] resources on her, add her to the victory display.
Forced - If Takada Hiroko is defeated: Cross her name off in the Campaign Log.
```
- text ZH:
```
[action]花费最多3资源：谈判。将花费的所有资源放到高田弘子上。如果其上有5[per_investigator]资源，将其加入胜利区。
强制 - 如果高田弘子被击败：在剧本日志上划掉其名字。
```

## 08544 · Manifestations of Evil / 邪灵现身
- 行号：src/cards/cards-data.js:296365（name/nameZh） · src/cards/cards-data.js:296377（textZh） · src/cards/cards-data.js:296337（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - When this agenda would advance, if there is at least 1 facedown card beneath a Seeping Nightmare: Instead of advancing this agenda, remove 2 doom from play and find the Seeping Nightmare with the most facedown cards beneath it. Choose one of the cards beneath it at random and spawn it at its location.
```
- text ZH:
```
强制 - 在本密谋将要推进时，如果在渗出梦魇底下有正面朝下的卡牌：不推进密谋，改为从场上移除2个毁灭标记，并找到其底下正面朝下卡牌最多的渗出梦魇。随机选择其底下的1张卡牌，并生成在其所在地点。
```
- backText EN:
```
The lead investigator must decide (choose one):
- Add 1 [frost] token to the chaos bag.
- In player order, each investigator shuffles the top 2 cards of the Tekeli-li deck into their deck (each investigator who cannot takes 1 damage and 1 horror instead).
```
- backText ZH:
```
调查员队长必须决定(选择一项)：
- 在混乱袋里加入1个[frost]标记。
- 以玩家顺序，每位调查员将忒咳哩-哩牌库顶的2张卡牌混洗入自己的牌库(每位不能这么做的调查员改为受到1点伤害和1点恐惧)。
```
- flavor EN:
```
Something stirs beneath the ice. Through the cracks, a vile ichor bubbles forth, its odor pungent and rancid.
```
- flavor ZH:
```
冰下有东西在搅动。从裂缝里冒出邪恶的酸水，散发着刺鼻的腐臭气味。
```
- backFlavor EN:
```
This place is not what it seems. You feel as though you have trespassed somewhere ancient and terrible, and now its wrath is erupting all around you.
```
- backFlavor ZH:
```
这地方并非表里如一。你感觉好像你侵入了一个古老而可怕的地方，现在它的愤怒正在你周围爆发。
```

## 08545 · Icy Depths / 冰雪深处
- 行号：src/cards/cards-data.js:296420（name/nameZh） · src/cards/cards-data.js:296432（textZh） · src/cards/cards-data.js:296392（backTextZh）
- pack=eoec · type=agenda
- backText EN:
```
Each remaining investigator is defeated and suffers 1 physical trauma.
```
- backText ZH:
```
剩下的每位调查员被击败并承受1点肉体创伤。
```
- flavor EN:
```
The violent quakes have risen to a crescendo. Any second now, you feel as though the entire ice shelf could collapse, spilling you into the frigid ocean - or worse, if your theory about the underground source of these creatures is correct.
```
- flavor ZH:
```
强烈的地震已达到高潮。现在起的每一秒，你都觉得整个冰架可能崩塌，把你扔进冰冷的海洋——或者更糟，如果你关于这些生物来自地下的推论是正确的话。
```
- backFlavor EN:
```
Your only warning is a thin web of cracks that tears through the ice before your feet, and then a sudden explosion of mist and ink-like miasma erupts around you. The force slams you to the ground. You crawl desperately along the freezing-cold ice as the miasma reaches for you. An incomprehensible sound, like the rushing of a furious whirlwind, fills your ears. Then a thunderous crack, and you are falling - no, sliding - down along the ice toward the freezing cold waters below.
It is a wonder you are even still conscious. You summon all of your strength and cling to the ice shelf just before you plummet below. You finally haul yourself back over the edge, casting a panicked glance at the horizon, but there is no sign of any miasma or mist. The crack in the ice shelf extends for hundreds of feet in front of you, separating you from your pursuers. Somehow, you've unwittingly escaped...although you won't be forgetting that near-death experience anytime soon.
```
- backFlavor ZH:
```
你唯一的警告就是你脚前的冰面上出现了薄薄一层裂缝，然后你周围突然爆发出雾气和墨般的瘴气。这股力量将你击倒在地。你绝望地在冰冷的冰面上爬行，瘴气向你袭来。一种难以理解的声音像一阵狂暴的旋风一样，震耳欲聋。然后是一声雷鸣般的巨响，你就掉下去了——不，是沿着冰面滑向下面冰冷的海水。
你还有意识简直是个奇迹。就在你掉下去之前，你鼓起所有的力量抓住了冰架。你终于爬上边缘，惊慌失措地瞥了一眼地平线，但没有任何瘴气或薄雾的迹象。冰架上的裂缝在你面前延伸数百英尺，将你与追捕者分开。你不知不觉地就逃了出来……尽管那次濒死体验你很长时间都忘不了。
```

## 08546 · Under Attack! / 陷入围攻！
- 行号：src/cards/cards-data.js:296473（name/nameZh） · src/cards/cards-data.js:296485（textZh） · src/cards/cards-data.js:296446（backTextZh）
- pack=eoec · type=act
- text EN:
```
Each [[Eidolon]] enemy gains Victory 0.
The camp gains: "[action] Investigators at your location spend 4 clues, as a group: Resign."
Objective - If there are no [[Eidolon]] enemies in play, advance.
Objective - If each undefeated investigator has resigned, advance.
```
- text ZH:
```
每个[[幻灵]]敌人获得胜利0。
营地获得：“[action]你所在地点的调查员共同花费4个线索：撤退。”
目标 - 如果场上没有[[幻灵]]敌人，推进场景。
目标 - 如果所有未被击败的调查员都撤退了，推进场景。
```
- backText EN:
```
If there are no [[Eidolon]] enemies in play:
The last of the nightmarish creatures falls, its miasmatic body at once dissolving into inky, prismatic liquid and dissipating into wisps of gray mist filled with screaming shapes. Then, silence.
(→R1)
If the investigators advanced by resigning:
You follow a makeshift path through a jagged split in the ice shelf, making your way deeper into the mainland, toward the mountains. You don't know if these creatures can follow human tracks - or indeed if they need tracks at all in order to pursue you - but you take the time to cover them, regardless. Hopefully, with this shortcut you've found, you'll be safe...
(→R2)
```
- backText ZH:
```
如果场上没有[[幻灵]]敌人：
最后的可怕生物倒下了，它瘴气似的身体立刻融化成墨状的五彩液体，然后消散成一缕缕形状诡异的灰色雾气。然后，一切归于沉寂。
(→结局1)
如果调查员通过撤退来推进场景：
你沿着一条简易小路穿过冰架的锯齿状裂缝，进入大陆深处，走向山脉。你不知道这些生物是否会跟随人类的足迹——或者它们是否需要人类的足迹来追赶你——但无论如何，你都要花时间来掩盖它们。希望有了这条你找到的捷径，你会变安全些……
(→结局2)
```
- flavor EN:
```
Your camp has been discovered, and now the monsters prowling about the ice and snow are converging on your position. You have only two ways out of this nightmare: you must fight, or you must flee.
```
- flavor ZH:
```
你的营地被发现了，现在在冰雪中徘徊的怪物正向你的位置聚集。你只有两条路可以逃离这个噩梦：要么战斗，要么逃跑。
```

## 08547 · Seeping Nightmare / 渗出梦魇
- 行号：src/cards/cards-data.js:296528（name/nameZh） · src/cards/cards-data.js:296539（textZh） · src/cards/cards-data.js:296498（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
While an [[Eidolon]] enemy at Seeping Nightmare's location is moving, its location is considered connected to the camp.
While there are no facedown cards beneath Seeping Nightmare, it gains hunter.
Forced - When Seeping Nightmare is defeated: Remove each facedown card beneath it from the game.
```
- text ZH:
```
位于渗出梦魇所在地点的[[幻灵]]敌人移动时，其所在地点视为与营地相连。
渗出梦魇底下没有正面朝下的卡牌时，其获得猎手。
强制 - 在渗出梦魇被击败时：将其底下的所有正面朝下的卡牌从游戏中移除。
```

## 08548 · Phantasmagoria / 千变幻景
- 行号：src/cards/cards-data.js:296585（name/nameZh） · src/cards/cards-data.js:296596（textZh） · src/cards/cards-data.js:296560（backTextZh）
- pack=eoec · type=treachery
- traits: Curse  ||  诅咒
- text EN:
```
Revelation - If there are no Seeping Nightmares in play, Phantasmagoria gains surge. Otherwise, find the Seeping Nightmare nearest to an investigator. If there are 1 or more cards beneath it, choose one of them at random and spawn it at its location. If there are no cards beneath it, it moves and attacks as if it were the enemy phase (without exhausting).
```
- text ZH:
```
显现 - 如果场上没有渗出梦魇，千变幻景获得涌动。否则，找到离一位调查员最近的渗出梦魇。如果其底下有至少1张卡牌，随机选择其中一张并将该卡牌生成在其所在地点。如果其底下没有卡牌，则其移动并攻击，如同此刻是敌军阶段(但不要横置)。
```

## 08549 · Fatal Mirage / 致命幻景
- 行号：src/cards/cards-data.js:296638（name/nameZh） · src/cards/cards-data.js:296649（textZh） · src/cards/cards-data.js:296613（backTextZh）
- pack=eoec · type=scenario
- text EN:
```
Easy / Standard
[skull]: -X. X is the number of story cards in the victory display.
[cultist]: -2. If you fail, place 1 of your clues on your location.
[tablet]: -3. If you fail, you must either move to the Prison of Memories, or shuffle the top card of the Tekeli-li deck into your deck without looking at it.
[elder_thing]: -4. If you fail, place 1 doom on an [[Eidolon]] enemy in play.
```
- text ZH:
```
简单/ 普通
[skull]：-X。X为胜利区中剧情卡牌的数量。
[cultist]：-2。如果你检定失败，将你的1个线索放到你所在地点。
[tablet]：-3。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。
[elder_thing]：-4。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。
```
- backText EN:
```
Hard / Expert
[skull]: -X. X is the current agenda number plus the number of story cards in the victory display.
[cultist]: -2. If you do not succeed by at least 2, place 1 of your clues on your location.
[tablet]: -4. If you fail, you must either move to the Prison of Memories, or shuffle the top card of the Tekeli-li deck into your deck without looking at it. (If you fail by 2 or more, do both instead.)
[elder_thing]: -5. If you fail, place 1 doom on an [[Eidolon]] enemy in play.
```
- backText ZH:
```
困难/专家
[skull]：-X。X为当前密谋编号加上胜利区中剧情卡牌的数量。
[cultist]：-2。如果你检定失败，或成功但没有超过难度至少2点，将你的1个线索放到你所在地点。
[tablet]：-4。如果你检定失败，你必须移动到记忆囚笼，或者将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。(如果你检定失败且低于难度至少2点，改为两项都执行)。
[elder_thing]：-5。如果你检定失败，在场上一个[[幻灵]]敌人上放置1个毁灭标记。
```

## 08550 · Ethereal Tangle (v. I) / 虚灵纠缠(版本一)
- 行号：src/cards/cards-data.js:296692（name/nameZh） · src/cards/cards-data.js:296704（textZh） · src/cards/cards-data.js:296664（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
- text ZH:
```
[free]受到1点恐惧：移动到记忆囚笼。
```
- backText EN:
```
Each remaining investigator is defeated and must shuffle the top card of the Tekeli-li deck into their deck.
```
- backText ZH:
```
剩余的每位调查员被击败，且必须将忒咳哩-哩牌库顶的1张卡牌混洗入自己的牌库。
```
- flavor EN:
```
You find yourself trapped in an endless prison of distorted thought. Each door is another world to discover, another memory to explore...
```
- flavor ZH:
```
你发现自己被困在扭曲思想的无尽牢笼中。每扇门都是另一个等待发现的世界，另一段等待探索的记忆……
```
- backFlavor EN:
```
Bit by bit, your consciousness fades. You are lost in the ever-expanding weave of memories, your senses drowning in a deluge of thought and emotion. A jumbled cage of fear, doubt, and horror.
When you finally awaken, only seconds have passed.
```
- backFlavor ZH:
```
你的意识正在一点一点地消失。你迷失在不断膨胀的记忆交织之中，你的感官淹没在思想和情感的洪流之中。一个混杂着恐惧、怀疑和恐怖的囚笼。
当你最终醒来时，时间却只过了几秒钟。
```

## 08551 · Ethereal Tangle (v. II) / 虚灵纠缠(版本二)
- 行号：src/cards/cards-data.js:296747（name/nameZh） · src/cards/cards-data.js:296759（textZh） · src/cards/cards-data.js:296719（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
- text ZH:
```
[free]受到1点恐惧：移动到记忆囚笼。
```
- backText EN:
```
Each remaining investigator is defeated and must either suffer 1 mental trauma or shuffle the top 2 cards of the Tekeli-li deck into their deck.
```
- backText ZH:
```
剩余的每位调查员被击败，且必须承受1点精神创伤，或者将忒咳哩-哩牌库顶的2张卡牌混洗入自己的牌库。
```
- flavor EN:
```
You once again find yourself trapped in an endless prison of distorted thought...
```
- flavor ZH:
```
你发现你又一次被困在扭曲思想的无尽牢笼中……
```
- backFlavor EN:
```
Again, your consciousness fades. You tumble through everlasting moments, empathy tugging your emotions in every direction at once. It is an ocean of bottomless thought, deep and dark and tenebrous.
When you finally awaken, once again only seconds have passed.
```
- backFlavor ZH:
```
你的意识又一次开始消失。你在接连不断的场景之间辗转翻腾，情感与它们共鸣，被同时扯向四面八方。这里是有着无底思想的海洋，深邃、黑暗、阴沉。
当你最终醒来时，时间还是只过了几秒钟。
```

## 08552 · Ethereal Tangle (v. III) / 虚灵纠缠(版本三)
- 行号：src/cards/cards-data.js:296802（name/nameZh） · src/cards/cards-data.js:296814（textZh） · src/cards/cards-data.js:296774（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
[fast] Take 1 horror: Move to the Prison of Memories.
```
- text ZH:
```
[free]受到1点恐惧：移动到记忆囚笼。
```
- backText EN:
```
Each remaining investigator is defeated and suffers 1 mental trauma.
```
- backText ZH:
```
剩下的每位调查员被击败并承受1点精神创伤。
```
- flavor EN:
```
You once again find yourself trapped in an endless prison of distorted thought...
```
- flavor ZH:
```
你发现你又一次被困在扭曲思想的无尽牢笼中……
```
- backFlavor EN:
```
Your consciousness is dismantled, this time violently. It is as though your capacity to feel, to think, has been ripped to shreds by the incomprehensible depth of this awful prison. Infinite leagues apart, your every molecule struggles to remain you as your mind is usurped.
When you finally awaken, a full day has passed.
```
- backFlavor ZH:
```
你的意识被摧毁了，这次非常粗暴。就好像你的感觉和思考能力，已经被这可怕的监狱那不可理解的深度撕成了碎片。你的思想被篡夺时，你的每一个分子即便各自相隔千里，却仍在努力保持着你自己。
当你终于醒来时，已经过去了整整一天。
```

## 08553 · Shadow of the Past (v. I) / 旧事阴影(版本一)
- 行号：src/cards/cards-data.js:296856（name/nameZh） · src/cards/cards-data.js:296868（textZh） · src/cards/cards-data.js:296829（backTextZh）
- pack=eoec · type=act
- text EN:
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
- text ZH:
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
In this strange, alternate reality, past memories and nightmares come to life. Is this place real or a figment of your imagination? Or perhaps both?
```
- flavor ZH:
```
在这个离奇的异世界，过去的记忆和噩梦化为现实。这个地方是真实的还是你想像出来的？或者可能都是？
```
- backFlavor EN:
```
Understanding sets in. Dream though it may be, this place is like a nexus of minds - a place within the miasma where thought is material. Where madness is embodied.
As you ponder the deeper truths that might have taken shape in this maze of horrors, a door appears just in the periphery of your sight: the same door you once used to trap yourself in this hellish place.
Perhaps there are more mysteries to discover here, but for now, you've seen enough. You open the door...
```
- backFlavor ZH:
```
你开始理解了。尽管可能是梦，但这个地方就像思想的中枢——笼罩于瘴气之中，思想是实体的地方。在这里，疯狂也会具象化。
当你在思考，这恐怖迷宫中可能存在的深层真相时，一扇门恰好出现在你视线的边缘：正是通过那扇门你才被关在这鬼地方。
也许这里还有更多的谜团有待探索，但现在，你已经看得够多了。你打开了门……
```

## 08554 · Shadow of the Past (v. II) / 旧事阴影(版本二)
- 行号：src/cards/cards-data.js:296910（name/nameZh） · src/cards/cards-data.js:296922（textZh） · src/cards/cards-data.js:296883（backTextZh）
- pack=eoec · type=act
- text EN:
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
- text ZH:
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
In this strange, alternate reality, past memories and nightmares come to life. Is this place real or a figment of your imagination? Or perhaps both?
```
- flavor ZH:
```
在这个离奇的异世界，过去的记忆和噩梦化为现实。这个地方是真实的还是你想像出来的？或者可能都是？
```
- backFlavor EN:
```
Once again, as you wonder about the deeper significance this place holds, the exit appears before you, a door of solid oak that stands out within the mirage. Hallucination or not, it is your only way out of this strange place. Maybe the truth is out there, somewhere, but for now, it's safer to leave and return to reality. You open the door...
```
- backFlavor ZH:
```
再一次，当你想知道这个地方拥有的更深层次的意义时，出口出现在你面前，一扇坚实的橡木门在幻景中突兀显现。无论是不是妄想，这是你离开这个奇怪地方的唯一途径。也许真相就在某处，但现在，离开回到现实中更安全。你打开了门……
```

## 08555 · Shadow of the Past (v. III) / 旧事阴影(版本三)
- 行号：src/cards/cards-data.js:296964（name/nameZh） · src/cards/cards-data.js:296976（textZh） · src/cards/cards-data.js:296937（backTextZh）
- pack=eoec · type=act
- text EN:
```
Objective - Confront your demons to strengthen your resolve. (Hint: You may have more than one opportunity to advance this act. Until then, you are trapped. If you are running out of time and are given the chance to advance, consider taking it...)
```
- text ZH:
```
目标 - 直面内心的恶魔，坚定你的决心。(提示：你可能有不止一次机会来推进本场景。在那之前，你都被困住了。如果你在时限将尽时正好可以推进，不妨考虑抓住机会……)
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
In this strange, alternate reality, past memories and nightmares come to life. Is this place real or a figment of your imagination? Or perhaps both?
```
- flavor ZH:
```
在这个离奇的异世界，过去的记忆和噩梦化为现实。这个地方是真实的还是你想像出来的？或者可能都是？
```
- backFlavor EN:
```
As you confront yet another memory locked inside this strange hallucination, you spot another door - not a wooden one or indeed any door made by human hands, but rather a colossal circular gate of rock with an elaborately carved slab of slate-gray stone blocking your way. Enigmatic glyphs wind around its frame, their meaning inscrutable. You step forward, place your hand upon the stone, and to your surprise, the door cracks open with an immense rumble.
A layer of thick, prismatic miasma drips from the doorway as you peer inside. Thum-thum. Thum-thum. Thum-thum. The beating is tremendous. Something quivers and throbs on the other side, something hideous and enormous, like a beating heart. Thum-thum. Thum-thum. Thum-thum. The heart of the mountain. The heart of the mirage. Then the door slams open, tendrils of ichor slap around your wrists, and you are dragged, screaming, through the door-
```
- backFlavor ZH:
```
当你在这个奇怪的幻觉中面对另一段记忆时，你发现了另一扇门——不是木制的，也不是经由人类之手做出的门，而是一扇巨大的，精心雕刻着灰色石板的圆形石门挡住了你的路。高深莫测的象形文字缠绕在它的门框上，其含义难以理解。你走上前，把你的手放在石头上，令你吃惊的是，随着一声巨大的隆隆声，门开了。
当你往里面看的时候，一层厚厚的五光十色的瘴气从门口溢出。咚-咚。咚-咚。咚-咚。节拍声震耳欲聋。另一边有什么东西在颤抖抽搐，一种可怕而巨大的东西，就像一颗跳动的心脏。咚-咚。咚-咚。咚-咚。山脉之心。幻景之心。然后门砰的一声开了，脓肿的卷须拍打在你的手腕上，你被拖着，尖叫着穿过了门——
```

## 08556 · Prison of Memories / 记忆囚笼
- 行号：src/cards/cards-data.js:297018（name/nameZh） · src/cards/cards-data.js:297030（textZh） · src/cards/cards-data.js:296989（backTextZh）
- pack=eoec · type=location
- traits: Otherworld / Mirage  ||  异界 / 幻景
- text EN:
```
Mirage 1 [per_investigator] (Base Camp, Deck of the Theodosia, University Halls).
X is the current agenda number.
```
- text ZH:
```
幻景1[per_investigator](大本营、菲奥多西亚号甲板、大学礼堂)。
X为当前密谋编号。
```

## 08556b · Prison of Memories / 记忆囚笼
- 行号：src/cards/cards-data.js:297073（name/nameZh） · src/cards/cards-data.js:297084（textZh） · src/cards/cards-data.js:297049（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Put the set-aside Base Camp location into play.
- Put the set-aside Deck of the Theodosia location into play.
- Put the set-aside University Halls location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 将放在一边的大本营地点放置入场。
- 将放在一边的菲奥多西亚号甲板地点放置入场。
- 将放在一边的大学礼堂地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
You wander for what seems like hours through the myriad reflections. The further you venture from where you arrived, the more distant reality becomes. There are many paths to take through the hallucination. Places you recognize from your memories, and others you do not, taken from the memories of your companions.
As the shape of the mirage changes around you, you consider which prison might be worse - the one that reveals its true, deadly nature? Or the one that hides it?
```
- flavor ZH:
```
你在无数的倒影中徘徊了几个小时。你越是深入冒险，你离现实的距离就越远。幻觉中有许多路径可以走。你认出一些在记忆中出现过的地方，另一些你则毫无印象，是存在于你同伴的记忆中的。
随着你周围的幻景不断变化，你在想哪个监狱可能更糟糕——是那个揭示其真实、致命本质的监狱吗？还是隐藏起来的那个？
```

## 08557 · Base Camp / 大本营
- 行号：src/cards/cards-data.js:297126（name/nameZh） · src/cards/cards-data.js:297138（textZh） · src/cards/cards-data.js:297097（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 1 [per_investigator] (Coastal Waters, Deserted Station, Riverview Theatre).
[reaction] When you would you fail a skill test by exactly 1 while investigating Base Camp, take 1 horror: You get +1 skill value for this test.
```
- text ZH:
```
幻景1[per_investigator](沿海水域、荒废车站、河景剧院)。
[reaction]你调查大本营时，在技能检定将要失败且正好低于难度1点时，受到1点恐惧：你本次检定得到技能值+1。
```
- backText EN:
```
—
```
- backText ZH:
```
选择一项：
- 跟随高田的记忆。将放在一边的沿海水域地点放置入场。
- 跟随伊里亚的记忆。将放在一边的荒废车站地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的河景剧院地点放置入场。
将本卡牌翻面。
```
- backFlavor EN:
```
—
```
- backFlavor ZH:
```
伊里亚和他的同伴安雨沿着营地的外围走来，进入了你的视线。“你去哪儿了？”高田说着，也出现在你眼前。“独自一人外出是相当愚蠢的。”辛哈医生也加入了责备的行列。
“放松。我可不是独自一人。”伊里亚回答道，他戴着手套的手轻轻地抚摸着安雨的脖子。
医师翻了个白眼离开了，但高田抱着双臂，依然留在那里。“在我们出发之前还有很多事情要做，你知道的吧。”她说。
伊里亚叹了口气，点了点头。“我知道。只是……有点焦虑。这地方有点……”他声音越来越小。
高田点头。“是的。我也感觉到了。”
```

## 08557b · Base Camp / 大本营
- 行号：src/cards/cards-data.js:297179（name/nameZh） · src/cards/cards-data.js:297190（textZh） · src/cards/cards-data.js:297155（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Takada's memories. Put the set-aside Coastal Waters location into play.
- Follow Eliyah's memories. Put the set-aside Deserted Station location into play.
- Follow Dr. Sinha's memories. Put the set-aside Riverview Theatre location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随高田的记忆。将放在一边的沿海水域地点放置入场。
- 跟随伊里亚的记忆。将放在一边的荒废车站地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的河景剧院地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
Eliyah and his companion, Anyu, shimmer into view along the outskirts of the camp. "Where have you been?" Takada says, also appearing before your very eyes.
"It is foolish to venture out alone," Dr. Sinha joins in the scolding.
"Relax. I wasn't alone," Eliyah replies, his gloved hand gently petting Anyu's neck.
The physician rolls her eyes and departs, but Takada remains, folding her arms across her chest. "There is still a lot to do before we head out, you know," she states.
Eliyah sighs and nods. "I know. Just...anxious. Something about this place..." he trails off.
Takada nods. "Yes. I feel it, too."
```
- flavor ZH:
```
伊里亚和他的同伴安雨沿着营地的外围走来，进入了你的视线。“你去哪儿了？”高田说着，也出现在你眼前。“独自一人外出是相当愚蠢的。”辛哈医生也加入了责备的行列。
“放松。我可不是独自一人。”伊里亚回答道，他戴着手套的手轻轻地抚摸着安雨的脖子。
医师翻了个白眼离开了，但高田抱着双臂，依然留在那里。“在我们出发之前还有很多事情要做，你知道的吧。”她说。
伊里亚叹了口气，点了点头。“我知道。只是……有点焦虑。这地方有点……”他声音越来越小。
高田点头。“是的。我也感觉到了。”
```

## 08558 · Deck of the Theodosia / 菲奥多西亚号甲板
- 行号：src/cards/cards-data.js:297232（name/nameZh） · src/cards/cards-data.js:297244（textZh） · src/cards/cards-data.js:297203（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 1 [per_investigator] (Coastal Waters, Hedge Maze, Standing Stones).
Forced - When you investigate Deck of the Theodosia: You must either give it +2 shroud for this investigation, or spend 1 additional action to investigate it.
```
- text ZH:
```
幻景1[per_investigator](沿海水域、树篱迷宫、耸立岩石)。
强制 - 在你调查菲奥多西亚号甲板时：你必须使其在本次调查中得到+2隐藏值，或者额外花费1个行动来调查。
```

## 08558b · Deck of the Theodosia / 菲奥多西亚号甲板
- 行号：src/cards/cards-data.js:297285（name/nameZh） · src/cards/cards-data.js:297296（textZh） · src/cards/cards-data.js:297261（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Cookie's memories. Put the set-aside Coastal Waters location into play.
- Follow Ellsworth's memories. Put the set-aside Hedge Maze location into play.
- Follow Claypool's memories. Put the set-aside Standing Stones location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随曲奇的记忆。将放在一边的沿海水域地点放置入场。
- 跟随埃尔斯沃思的记忆。将放在一边的树篱迷宫地点放置入场。
- 跟随克莱普尔的记忆。将放在一边的耸立岩石地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
Ellsworth appears in a shimmer of mirage-light, staring out over the railing into the cold, blue ocean. "Beautiful, isn't it?" he says.
Cookie and Claypool appear nearby, carrying several crates of supplies between them. "Y'know what would be beautiful?" Cookie hollers. "If maybe yeh helped out a lil' bit. Think yeh might get off yer ass for a minute 'n pitch in, Ellsworth?"
The explorer nods with a soft sigh and takes the weight from Claypool's hands, nodding aside for him to take a break. Claypool gives him a gentle, knowing smile.
```
- flavor ZH:
```
埃尔斯沃思出现在闪烁的幻光中，凝视着栏杆外冰冷的蓝色海洋。
“很美，不是吗？”他说。
曲奇和克莱普尔出现在旁边，他们中间还有几箱补给品。“那你想知道什么事情更美吗？”曲奇大喊着。“比如你现在就来搭把手。埃尔斯沃思，你能不能动一下，过来帮帮忙？”
探险家轻轻叹了口气，点了点头，接过克莱普尔手中的东西，向旁边点了下头，让克莱普尔休息一下。克莱普尔给了他一个温柔的、会心的微笑。
```

## 08559 · University Halls / 大学礼堂
- 行号：src/cards/cards-data.js:297338（name/nameZh） · src/cards/cards-data.js:297350（textZh） · src/cards/cards-data.js:297309（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 1 [per_investigator] (Elder Chamber, Riverview Theatre, Standing Stones).
Forced - When University Halls is flipped over: Each investigator discards the top 3 cards of their deck for each clue they spent. Each investigator draws each Tekeli-li weakness they discarded in this way. Shuffle each other weakness discarded in this way back into its owner's deck.
```
- text ZH:
```
幻景1[per_investigator](古老者厅室、河景剧院、耸立岩石)。
强制 - 在大学礼堂翻面时：每位调查员每花费一个线索，弃掉自己牌库顶3张卡牌。每位调查员抽取自己以此方式弃掉的所有忒咳哩-哩弱点。将其他所有以此方式弃掉的弱点混洗回所有者牌库。
```

## 08559b · University Halls / 大学礼堂
- 行号：src/cards/cards-data.js:297391（name/nameZh） · src/cards/cards-data.js:297402（textZh） · src/cards/cards-data.js:297367（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Danforth's memories. Put the set-aside Elder Chamber location into play.
- Follow Dr. Kensler's memories. Put the set-aside Riverview Theatre location into play.
- Follow Dyer's memories. Put the set-aside Standing Stones location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随丹佛斯的记忆。将放在一边的古老者厅室地点放置入场。
- 跟随肯斯勒博士的记忆。将放在一边的河景剧院地点放置入场。
- 跟随戴尔的记忆。将放在一边的耸立岩石地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
Three figures shimmer into view as they cross one another in the darkened halls. "Professor," you hear Dr. Kensler's voice acknowledge, and her outline becomes defined. Professor Dyer and his protégé appear next. "I do hope you'll consider my proposal," she continues. If she truly cared one way or the other, her tone of voice surely does not reveal it.
In response, Dyer simply glances at Danforth, who appears to be staring behind her - far, far behind her. "Well. In any event..." she adjusts her glasses, and enters the door labeled with her name.
Dyer shakes his head with a sigh, but Danforth is the one who breaks the silence. "I...I think we should go."
```
- flavor ZH:
```
三个人影在昏暗的礼堂里互相交错，闪着微光出现在你的视线中。“教授。”你听到肯斯勒博士的声音，她的轮廓变得清晰起来。戴尔教授和他的学生紧接着出现了。“我真的希望你能考虑我的建议。”她继续说。如果她真的如她所言那么在乎，至少从她的语气完全听不出来。
作为回应，戴尔只是瞥了丹佛斯一眼，丹佛斯似乎正盯着她身后——远处，非常远。
“好吧。不论如何……”她调整了一下眼镜，走进了贴着她名字的门。
戴尔摇摇头，叹了口气，但是丹佛斯打破了沉默。“我……我认为我们应该去。”
```

## 08560 · Hedge Maze / 树篱迷宫
- 行号：src/cards/cards-data.js:297444（name/nameZh） · src/cards/cards-data.js:297456（textZh） · src/cards/cards-data.js:297415（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Mo'ai Statues).
Forced - After you investigate Hedge Maze during your turn: Increase its shroud value by 1 until the end of your turn. You cannot leave Hedge Maze this turn.
```
- text ZH:
```
幻景2[per_investigator](摩艾石像)。
强制 - 你回合期间，在你调查树篱迷宫后：直到你的回合结束，其隐藏值增加1点。本回合你不能离开树篱迷宫。
```

## 08560b · Hedge Maze / 树篱迷宫
- 行号：src/cards/cards-data.js:297497（name/nameZh） · src/cards/cards-data.js:297508（textZh） · src/cards/cards-data.js:297473（backTextZh）
- pack=eoec · type=story
- text EN:
```
Put the set-aside Mo'ai Statues location into play.
Flip this card back over.
```
- text ZH:
```
将放在一边的摩艾石像地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
"You really think I can't navigate a simple maze?" Ellsworth chuckles. He looks several years younger and wears a proper tuxedo instead of his comfortable jacket and trousers. The figure he speaks to stands just out of view, a dark silhouette with a muffled, indistinct voice. "Fine," the explorer replies with a roll of his eyes. He hands the figure his champagne glass and loosens his tie. "But when I get back, you are going to tell me what this is really all about."
```
- flavor ZH:
```
“你真的认为我连一个简单的迷宫都走不来吗？”埃尔斯沃思轻声笑着。他看起来年轻了好几岁，穿着得体的燕尾服，而不是舒适的夹克和裤子。和他说话的那个人恰好在视线之外，一个黑色的剪影，声音低沉而模糊。“好吧。”探险家翻了个白眼回答道。他把香槟酒杯递给那个人，松了松领带。“但等我回来，你要告诉我这到底是怎么回事。”
```

## 08561 · Deserted Station / 荒废车站
- 行号：src/cards/cards-data.js:297550（name/nameZh） · src/cards/cards-data.js:297562（textZh） · src/cards/cards-data.js:297521（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Alaskan Wilds).
Deserted Station gets +3 shroud while there is at least one treachery attached to it.
```
- text ZH:
```
幻景2[per_investigator](阿拉斯加荒野)。
荒废车站有诡计附属时，得到+3隐藏值。
```

## 08561b · Deserted Station / 荒废车站
- 行号：src/cards/cards-data.js:297603（name/nameZh） · src/cards/cards-data.js:297614（textZh） · src/cards/cards-data.js:297579（backTextZh）
- pack=eoec · type=story
- text EN:
```
Put the set-aside Alaskan Wilds location into play.
Flip this card back over.
```
- text ZH:
```
将放在一边的阿拉斯加荒野地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
When Eliyah materializes into view, you are stunned to see him without his steadfast companion, Anyu. He holds an unfamiliar woman's hands, her wavy hair the color of a brilliant ruby. The two young lovers stare into one another's eyes as the old train approaches. "How long do you think you will be gone?"
"I...I'm not sure," he confesses. "It is a lengthy journey. Alaska is a hell of a big place."
"So, this is goodbye, then," the woman says. She wipes angry tears from her eyes. "Will you write?"
"I'll try, but..." he glances away.
"Right, right," she says, understanding. The train pulls into the station, its piercing squeal muffling their words. "You...fool." She leans up and kisses his cheek. "You are a fool, Eliyah."
"I...I know," he replies. "I know."
```
- flavor ZH:
```
当伊里亚出现在你的视线中时，你惊讶地发现他身边没有一直陪伴着他的伙伴安雨。他握着一个陌生女子的手，她有着灿烂红宝石般颜色的卷发。当老旧的火车驶近时，这对年轻的恋人互相凝视着对方的眼睛。“你预计你要去多久？”
“我……我也不清楚。”他坦白，“这是一次漫长的旅程。阿拉斯加真是个大地方。”
“所以，这就是永别了吧。”女子说道。她擦去眼中愤怒的泪水。“你会写信给我吗？”
“我尽力，但是……”他把目光移开。
“好吧，好吧。”她说道，表示明白。火车进站了，刺耳的汽笛声盖过了他们说的话。“你……大傻瓜。”她踮起脚，亲吻了他的脸颊。“你是个大傻瓜，伊里亚。”
“我……我知道。”他回答，“我知道的。”
```

## 08562 · Coastal Waters / 沿海水域
- 行号：src/cards/cards-data.js:297656（name/nameZh） · src/cards/cards-data.js:297668（textZh） · src/cards/cards-data.js:297627（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Airfield, Ottoman Front).
Forced - After you reveal a [frost] token while investigating Coastal Waters: Take 1 horror. If this investigation is successful, discover 1 additional clue at Coastal Waters. (Limit once per test.)
```
- text ZH:
```
幻景2[per_investigator](飞机场、奥斯曼前线)。
强制 - 你调查沿海水域时，在你揭示一个[frost]标记后：受到1点恐惧。如果本次调查成功，发现沿海水域额外1个线索。(每次检定仅限一次。)
```

## 08562b · Coastal Waters / 沿海水域
- 行号：src/cards/cards-data.js:297709（name/nameZh） · src/cards/cards-data.js:297720（textZh） · src/cards/cards-data.js:297685（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Takada's memories. Put the set-aside Airfield location into play.
- Follow Cookie's memories. Put the set-aside Ottoman Front location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随高田的记忆。将放在一边的飞机场地点放置入场。
- 跟随曲奇的记忆。将放在一边的奥斯曼前线地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
"Hell of a test run!" Cookie yells over the roar of the rushing wind. The two of them are up in one of Takada's aeroplanes - this must have happened just after she completed work on the first plane, before the lot of you set off toward the peaks, and the events that ensued.
"Get used to it!" Takada shouts from the pilot's seat. "Weather's gonna be rough anytime we're in the air. Don't worry though, she'll hold." You see the grim copilot hold back a smile. "You're enjoying this, aren't you?" Takada chimes.
"Naw," Cookie lies. "Just been a while, is all."
```
- flavor ZH:
```
“这该死的试飞！”曲奇的喊声盖过了呼啸的疾风。他俩在高田的一架飞机上——这一定是发生在你们出发前往那些山峰之前，她完成第一架飞机的工作后，紧接着发生的事情。
“习惯一下吧！”高田坐在飞行员的座位上高喊。“我们在空中，任何时候天气都会很恶劣。不过别担心，她撑得住。”你看到冷酷的副驾驶在强忍着笑。“你很享受，是吧？”高田调侃道。
“啥呀？”曲奇撒谎道，“只是时间长有点无聊罢了。”
```

## 08563 · Elder Chamber / 古老者厅室
- 行号：src/cards/cards-data.js:297762（name/nameZh） · src/cards/cards-data.js:297774（textZh） · src/cards/cards-data.js:297733（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Cluttered Dormitory).
Forced - After you discover 2 or more clues from Elder Chamber during a single investigation or card effect: Shuffle the top card of the Tekeli-li deck into your deck.
```
- text ZH:
```
幻景2[per_investigator](凌乱宿舍)。
强制 - 单独一次调查或卡牌效果期间，在你从古老者厅室发现至少2个线索后：将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库。
```

## 08563b · Elder Chamber / 古老者厅室
- 行号：src/cards/cards-data.js:297815（name/nameZh） · src/cards/cards-data.js:297826（textZh） · src/cards/cards-data.js:297791（backTextZh）
- pack=eoec · type=story
- text EN:
```
Put the set-aside Cluttered Dormitory location into play.
Flip this card back over.
```
- text ZH:
```
将放在一边的凌乱宿舍地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
These are the sledges missing from Lake's camp," Professor Dyer remarks, shimmering into view. He doesn't sound particularly surprised - it seems they must have accounted for this possibility.
Danforth is already at the first of the sledges, examining its contents. "Here's the gasoline stove, the fuel, all of their research instruments..." he trails off. "God, what is that awful stench?" He motions toward the farthest sledge, the tarpaulin strapped around its cargo bulging oddly.
"Danforth, don't-" Dyer calls out, but it's too late. The moment Danforth removes the tarpaulin, he staggers backward, covering his mouth and nose. Frozen and preserved beneath the tarpaulin are the corpses of a young explorer and one of his sled dogs.
"Gedney," Dyer whispers.
```
- flavor ZH:
```
“这些是莱克营地失踪的雪橇。”戴尔教授边说着边闪着光出现在视线中。听起来他并没有特别惊讶——似乎他们已经预见了这种可能性。
丹佛斯已经走到第一辆雪橇前面，检查雪橇里的东西。“这是燃油炉、燃料，还有他们所有的研究仪器……”他声音越来越小。“天哪，这是什么臭味？”他朝最远的那架雪橇走去，捆在货物上的油布奇怪地鼓起。
“丹佛斯，别——”戴尔喊着，但已经太迟了。丹佛斯刚把油布拿开，就摇摇晃晃地后退了几步，捂住了嘴和鼻子。油布下面冻着一位年轻探险家和他的一只雪橇犬的尸体。
“格德尼。”戴尔低语
```

## 08564 · Riverview Theatre / 河景剧院
- 行号：src/cards/cards-data.js:297868（name/nameZh） · src/cards/cards-data.js:297880（textZh） · src/cards/cards-data.js:297839（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Dr. Kensler's Office, Infirmary).
Forced - When you draw a Tekeli-li card while at Riverview Theatre: Resolve its effects an additional time. Then, discover 1 clue at Riverview Theatre.
```
- text ZH:
```
幻景2[per_investigator](肯斯勒博士的办公室、医务室)。
强制 - 你在河景剧院抽取1张忒咳哩-哩卡牌时：额外结算一次其效果。然后，发现河景剧院的1个线索。
```

## 08564b · Riverview Theatre / 河景剧院
- 行号：src/cards/cards-data.js:297921（name/nameZh） · src/cards/cards-data.js:297932（textZh） · src/cards/cards-data.js:297897（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Dr. Kensler's memories. Put the set-aside Dr. Kensler's Office location into play.
- Follow Dr. Sinha's memories. Put the set-aside Infirmary location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随肯斯勒博士的记忆。将放在一边的肯斯勒博士的办公室地点放置入场。
- 跟随辛哈医生的记忆。将放在一边的医务室地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
"Thank you for...for inviting me here, Dr. Sinha," Dr. Kensler says quietly, her outline shimmering into view. She and Dr. Sinha sit next to one another in the almost-empty theatre. The lights are dim and the curtain drawn, but the show has not yet begun.
"Of course. And just Mala is fine."
Kensler flinches and clears her throat. "Then call me Amy."
"I already do," the physician replies as the screen in front of them kindles to life.
```
- flavor ZH:
```
“谢谢你……邀请我来这里，辛哈医生。”肯斯勒博士轻声说着，她的轮廓闪烁着出现在视线中。她和辛哈医生坐在几乎空无一人的剧院里。灯光昏暗，帷幕揭起，但演出还没有开始。
“当然。还有叫我玛拉就行。”
肯斯勒畏缩了一下，然后清了清嗓子。“那你可以叫我艾米。”
“我已经这么做啦。”医师回复着，她们面前的荧幕开始变亮。
```

## 08565 · Standing Stones / 耸立岩石
- 行号：src/cards/cards-data.js:297974（name/nameZh） · src/cards/cards-data.js:297986（textZh） · src/cards/cards-data.js:297945（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (The Black Stone, Dyer's Classroom).
Forced - After you reveal a [frost] token while investigating Standing Stones: Take 1 damage. If this investigation is successful, discover 1 additional clue at Standing Stones. (Limit once per test.)
```
- text ZH:
```
幻景2[per_investigator](黑色岩石、戴尔的教室)。
强制 - 你调查耸立岩石时，在你揭示一个[frost]后：受到1点伤害。如果本次调查成功，发现耸立岩石额外1个线索。(每次检定仅限一次。)
```

## 08565b · Standing Stones / 耸立岩石
- 行号：src/cards/cards-data.js:298027（name/nameZh） · src/cards/cards-data.js:298038（textZh） · src/cards/cards-data.js:298003（backTextZh）
- pack=eoec · type=story
- text EN:
```
Choose one:
- Follow Claypool's memories. Put the set-aside The Black Stone location into play.
- Follow Dyer's memories. Put the set-aside Dyer's Classroom location into play.
Flip this card back over.
```
- text ZH:
```
选择一项：
- 跟随克莱普尔的记忆。将放在一边的黑色岩石地点放置入场。
- 跟随戴尔的记忆。将放在一边的戴尔的教室地点放置入场。
将本卡牌翻面。
```
- flavor EN:
```
Claypool stares up at the ruins with a twinkle of wonder in his eyes. "Marvelous, isn't it, William?" Behind him, Professor Dyer materializes within the mirage. Both of them are at least a decade younger, perhaps more. You note Claypool did not address the professor by his title.
"Marvelous and mysterious," Dyer replies. "Nobody knows the true purpose of this site. Perhaps nobody ever will."
"But that's why we do this, right?" Claypool says with a grin. "To learn the truth."
Dyer glances back at the youth, lines of worry pulling at his eyes. "Yes," he whispers, "the truth."
```
- flavor ZH:
```
克莱普尔抬头凝视着遗迹，眼中闪烁着惊奇的光芒。“太了不起了，是不是，威廉？”在他身后，戴尔教授在幻景中出现了。他们两人都至少年轻十岁，也许更多。你注意到克莱普尔没有称呼教授的头衔。
“奇妙而神秘。”戴尔回答，“没有人知道这里的真正用途。也许以后也不会有人知道。”
“但这就是我们这么做的原因，对吧？”克莱普尔笑着说，“为了了解真相。”
戴尔回头看了一眼那个年轻人，他的眼角拉出忧虑的皱纹。“是的。”他低语道，“真相。”
```

## 08566 · Airfield / 飞机场
- 行号：src/cards/cards-data.js:298080（name/nameZh） · src/cards/cards-data.js:298092（textZh） · src/cards/cards-data.js:298051（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Missing Father).
While Takada Hiroko is at this location, it gets -2 shroud.
As an additional cost for you to investigate Airfield, you must spend 1 resource.
```
- text ZH:
```
幻景2[per_investigator](失踪父亲之记忆)。
高田弘子在本地点时，本地点得到-2隐藏。
作为调查飞机场的额外费用，你必须花费1资源。
```

## 08566b · Airfield / 飞机场
- 行号：src/cards/cards-data.js:298133（name/nameZh） · src/cards/cards-data.js:298144（textZh） · src/cards/cards-data.js:298109（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Takada Hiroko is alive:
Spawn the set-aside Memory of a Missing Father enemy at this location.
Flip this card back over.
If Takada Hiroko is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果高田弘子活着：
在本地点生成放在一边的失踪父亲之记忆敌人。
将本卡牌翻面。
如果高田弘子被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
A teenage girl shimmers into view. You recognize Takada's chestnut eyes and thin, straight hair. Her cheeks are stained with tears and rain. She waves as the old, rickety aeroplane takes off. You don't recognize the design - this must have been over a decade ago. "Don't worry, kiddo." The man next to her grips her shoulder encouragingly. "He'll be back soon," he reassures her, his voice soft with compassion. "You'll see."
```
- flavor ZH:
```
一个十几岁的女孩闪烁着出现在视线中。你认出高田栗色的眼睛和纤细的直发。她的脸颊被泪水和雨水弄脏了。当那架摇摇晃晃的老旧飞机起飞时，她挥着手。你并不认识这种设计——这一定是十多年前的事了。“别担心，孩子。”她旁边的男人抓住她的肩膀鼓励她。“他很快就会回来的。”他安慰她说，他的声音温柔而富有同情心，“你就等着吧。”
```

## 08567 · Alaskan Wilds / 阿拉斯加荒野
- 行号：src/cards/cards-data.js:298187（name/nameZh） · src/cards/cards-data.js:298199（textZh） · src/cards/cards-data.js:298158（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Hunt Gone Awry).
While Eliyah Ashevak is at this location, it gets -2 shroud.
As an additional cost for you to enter Alaskan Wilds, you must either shuffle the top card of the Tekeli-li deck into your deck, or spend 1 action.
```
- text ZH:
```
幻景2[per_investigator](狩猎失败之记忆)。
伊里亚·阿什瓦克在本地点时，本地点得到-2隐藏。
作为你进入阿拉斯加荒野的额外费用，你必须将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库，或者花费1个行动。
```

## 08567b · Alaskan Wilds / 阿拉斯加荒野
- 行号：src/cards/cards-data.js:298240（name/nameZh） · src/cards/cards-data.js:298251（textZh） · src/cards/cards-data.js:298216（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Eliyah Ashevak is alive:
Spawn the set-aside Memory of a Hunt Gone Awry enemy at this location.
Flip this card back over.
If Eliyah Ashevak is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果伊里亚·阿什瓦克活着：
在本地点生成放在一边的狩猎失败之记忆敌人。
将本卡牌翻面。
如果伊里亚·阿什瓦克被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Eliyah sits huddled up against a tree, a torrent of snow falling around him. In his arms, Anyu whines. Blood soaks his gloves, staining the dog's fur red as he holds her tight. "I know, girl," he chants, "I know, I know. We...we are going to be okay. You and me, girl. Anyu, right? That was your name?" The dog peers up into his eyes. "We will be okay, Anyu. I promise you."
```
- flavor ZH:
```
伊里亚蜷缩在一棵树旁坐着，一阵大雪在他的周围落下。安雨在他的臂弯里呜咽着。鲜血浸湿了他的手套，他紧紧地抱着狗，狗的皮毛都被染成了红色。“我知道，小姑娘。”他念叨着，“我知道，我知道。我们……我们会没事的。你和我都会没事的，小姑娘。安雨，对吧？那是你的名字吗？”大狗抬头看着他的眼睛。“我们会没事的，安雨。我向你保证。”
```

## 08568 · Cluttered Dormitory / 凌乱宿舍
- 行号：src/cards/cards-data.js:298294（name/nameZh） · src/cards/cards-data.js:298306（textZh） · src/cards/cards-data.js:298265（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of an Unspeakable Evil).
While Danforth is at this location, it gets -2 shroud.
Forced - When you resolve the revelation ability on a Tekeli-li card while at Cluttered Dormitory: Shuffle it back into your deck instead of placing it on the bottom of the Tekeli-li deck.
```
- text ZH:
```
幻景2[per_investigator](无法述说的恶魔之记忆)。
丹佛斯在本地点时，本地点得到-2隐藏。
强制 - 在你位于凌乱宿舍结算忒咳哩-哩卡牌上的显现能力时：不要将其放到忒咳哩-哩牌库底，改为混洗回你的牌库。
```

## 08568b · Cluttered Dormitory / 凌乱宿舍
- 行号：src/cards/cards-data.js:298347（name/nameZh） · src/cards/cards-data.js:298358（textZh） · src/cards/cards-data.js:298323（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Danforth is alive:
Spawn the set-aside Memory of an Unspeakable Evil enemy at this location.
Flip this card back over.
If Danforth is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果丹佛斯活着：
在本地点生成放在一边的无法述说的恶魔之记忆敌人。
将本卡牌翻面。
如果丹佛斯被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Danforth screams and throws his covers aside. Sweat drenches his forehead and drips down his cheeks. "Just a dream," he whispers. "Just a dream, just a dream." He collapses from his bed, dabs his head with a handkerchief, and wanders over to the nearby window to peer outside. The shape he sees on the other side causes him to leap back in fear, crashing into the opposite wall. "No...no!"
```
- flavor ZH:
```
丹佛斯尖叫着把被子扔到一边。汗水浸透了他的前额，从他的脸颊上滴下来。“这只是个梦。”他低语着，“只是个梦，只是个梦。”他从床上倒了下来，用手帕轻轻擦了擦脑袋，然后走到旁边的窗口向外张望。他看到另一边的影子，吓得向后一跳，撞上对面的墙。“不……不！”
```

## 08569 · Dyer's Classroom / 戴尔的教室
- 行号：src/cards/cards-data.js:298401（name/nameZh） · src/cards/cards-data.js:298413（textZh） · src/cards/cards-data.js:298372（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Regretful Voyage).
While Professor William Dyer is at this location, it gets -2 shroud.
[action] Shuffle the top card of the Tekeli-li deck into your deck: Heal 1 horror from an investigator or [[Ally]] asset at this location.
```
- text ZH:
```
幻景2[per_investigator](悔恨航程之记忆)。
威廉·戴尔教授在本地点时，本地点得到-2隐藏。
[action]将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库：治愈本地点的一位调查员或一个[[盟友]]支援1点恐惧。
```

## 08569b · Dyer's Classroom / 戴尔的教室
- 行号：src/cards/cards-data.js:298454（name/nameZh） · src/cards/cards-data.js:298465（textZh） · src/cards/cards-data.js:298430（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Professor William Dyer is alive:
Spawn the set-aside Memory of a Regretful Voyage enemy at this location.
Flip this card back over.
If Professor William Dyer is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果威廉·戴尔教授活着：
在本地点生成放在一边的悔恨航程之记忆敌人。
将本卡牌翻面。
如果威廉·戴尔教授被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Dyer shakes the man's hand vigorously, a smile beaming across his face. "You have no idea how much this means to me," he exclaims. "This will be a journey of profound importance. For all of us."
You recognize the man he speaks to - it is the late Professor Lake, one of many who ventured with Dyer to Antarctica and never returned.
"Yes, William," Lake replies, his eyes dribbling over with terrible black ichor. "This expedition will change everything."
```
- flavor ZH:
```
戴尔使劲捏着那个男子的手，脸上洋溢着笑容。“你不知道这对我有多重要。”他大声说道，“这将是一次意义深远的旅程。对我们所有人来说都是。”
你认出了和他说话的那个人——已故的莱克教授，他是和戴尔一起去南极冒险并再也没有回来的众多人员之一。
“是的，威廉。”莱克回答道，他的眼睛里流淌着可怕的黑色脓液。“这次探险将改变一切。”
```

## 08570 · Infirmary / 医务室
- 行号：src/cards/cards-data.js:298508（name/nameZh） · src/cards/cards-data.js:298520（textZh） · src/cards/cards-data.js:298479（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Lost Patient).
While Dr. Mala Sinha is at this location, it gets -2 shroud.
Forced - After you enter Infirmary for the first time this game, if you have more than 6 remaining health: Take damage until you have exactly 6 remaining health. Otherwise, take 1 damage.
```
- text ZH:
```
幻景2[per_investigator](去世病人之记忆)。
玛拉·辛哈医生在本地点时，本地点得到-2隐藏。
强制 - 在本场游戏你第一次进入医务室后，如果你的剩余生命值超过6点：受到伤害直到你有正好6点剩余生命值。否则，受到1点伤害
```

## 08570b · Infirmary / 医务室
- 行号：src/cards/cards-data.js:298561（name/nameZh） · src/cards/cards-data.js:298572（textZh） · src/cards/cards-data.js:298537（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Dr. Mala Sinha is alive:
Spawn the set-aside Memory of a Lost Patient enemy at this location. Flip this card back over.
If Dr. Mala Sinha is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果玛拉·辛哈医生活着：
在本地点生成放在一边的去世病人之记忆敌人。
将本卡牌翻面。
如果玛拉·辛哈医生被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
A young Dr. Sinha appears by the bedside, her face contorted with grief. You have never seen her so stricken. A nurse places a hand on top of Dr. Sinha's in consolation, but she bats it away. "Don't," she barks, choking back a sob.
"There is nothing more you could have done, Doctor," the nurse says.
"There is always more that can be done," Dr. Sinha shouts. "We could have been smarter! Faster!" Her hands shake as she tries to make a fist. Black miasma seeps from between her knuckles. "We - I - this is my fault. All my fault."
```
- flavor ZH:
```
年轻的辛哈医生出现在床边，她的脸因悲伤而扭曲。你从未见过她如此伤心。一名护士把手放在辛哈医生的手上安慰她，但她把手挥开了。“不要。”她哽咽着尖叫。
“你已经做到最好了，医生。”护士说。
“不，我永远都应该做得更好。” 辛哈医生喊道，“我们本可以更聪明！更快！”她想握拳，但双手却颤抖起来。黑色瘴气从她的指缝间渗出。“我们——我——这是我的错。都是我的错。”
```

## 08571 · Dr. Kensler's Office / 肯斯勒博士的办公室
- 行号：src/cards/cards-data.js:298615（name/nameZh） · src/cards/cards-data.js:298627（textZh） · src/cards/cards-data.js:298586（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of an Unrequited Love).
While Dr. Amy Kensler is at this location, it gets -2 shroud.
Forced - After you successfully investigate Dr. Kensler's Office: You must either take 1 horror, or remove 1 secret from an asset you control.
```
- text ZH:
```
幻景2[per_investigator](单恋之记忆)。
艾米·肯斯勒博士在本地点时，本地点得到-2隐藏。
强制 - 你成功调查肯斯勒博士的办公室后：你必须受到1点恐惧，或移除你控制的一个支援的1秘密。
```

## 08571b · Dr. Kensler's Office / 肯斯勒博士的办公室
- 行号：src/cards/cards-data.js:298668（name/nameZh） · src/cards/cards-data.js:298679（textZh） · src/cards/cards-data.js:298644（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Dr. Amy Kensler is alive:
Spawn the set-aside Memory of an Unrequited Love enemy at this location. Flip this card back over.
If Dr. Amy Kensler is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果艾米·肯斯勒博士活着：
在本地点生成放在一边的单恋之记忆敌人。
将本卡牌翻面。
如果艾米·肯斯勒博士被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Dr. Kensler sits at her desk, struggling to focus on her work. Various papers sit in neat piles around her, and the bookshelf is perfectly ordered, just as you would expect from the professor. But the journal she writes in is cluttered and unkempt. She runs her hand through her hair, undoing her ponytail. "No, no, no..." she mutters, ripping a piece of paper from the book. You spot a photograph serving as a bookmark, keeping her page as she shuts the journal angrily. She opens one of her desk drawers and throws the crumpled paper inside, barely noticing the way the drawer bubbles over with miasma, and the putrid gray mist emanating from within...
```
- flavor ZH:
```
肯斯勒博士坐在办公桌前，努力将精神集中在工作上。各种各样的文件整齐地堆放在她的周围，书架上整齐有序，就跟你认为教授应该的样子一样。但她写的日记却凌乱不堪。她用手梳理头发，解开马尾辫。“不，不，不……”她喃喃地说着，从书上撕下一张纸。你在她生气地合上日记时注意到一张作为书签的照片夹在书页之间。她打开一个抽屉，把那张皱巴巴的纸扔了进去，全然不在乎抽屉里正冒着瘴气泡，还有从里面散发出来的腐烂的灰色烟雾……
```

## 08572 · Mo'ai Statues / 摩艾石像
- 行号：src/cards/cards-data.js:298722（name/nameZh） · src/cards/cards-data.js:298734（textZh） · src/cards/cards-data.js:298693（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of an Alien Translation).
While Roald Ellsworth is at this location, it gets -2 shroud.
Forced - When the revelation effect of a treachery attaches it to Mo'ai Statues: That treachery gains surge. (Limit once per phase.)
```
- text ZH:
```
幻景2[per_investigator](翻译异星文字之记忆)。
罗尔德·埃尔斯沃思在本地点时，本地点得到-2隐藏。
强制 - 在诡计卡牌的显现效果将其附属到摩艾石像时：该诡计获得涌动(每阶段仅限一次)。
```

## 08572b · Mo'ai Statues / 摩艾石像
- 行号：src/cards/cards-data.js:298775（name/nameZh） · src/cards/cards-data.js:298786（textZh） · src/cards/cards-data.js:298751（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Roald Ellsworth is alive:
Spawn the set-aside Memory of an Alien Translation enemy at this location.
Flip this card back over.
If Roald Ellsworth is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果罗尔德·埃尔斯沃思活着：
在本地点生成放在一边的翻译异星文字之记忆敌人。
将本卡牌翻面。
如果罗尔德·埃尔斯沃思被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Rain patters against the face of the statue as Ellsworth examines the inscription at its foundation. "This one isn't like the rest," he murmurs to himself. "This isn't Rapa Nui. This isn't one of the mo'ai at all." The statue in the mirage cracks open, and miasma begins to seep from inside...
```
- flavor ZH:
```
当埃尔斯沃思审视雕像地基上的铭文时，雨水拍打着雕像的表面。“这个跟别的不一样。”他自言自语着，“这不是拉帕努伊。这根本不是摩艾。”幻景里的雕像裂开了，瘴气开始从里面渗出来……
```

## 08573 · Ottoman Front / 奥斯曼前线
- 行号：src/cards/cards-data.js:298829（name/nameZh） · src/cards/cards-data.js:298841（textZh） · src/cards/cards-data.js:298800（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Ravaged Country).
While James "Cookie" Fredericks is at this location, it gets -2 shroud.
Each non-[[Elite]] enemy at Ottoman Front gets +2 fight and loses retaliate.
```
- text ZH:
```
幻景2[per_investigator](饱经战乱的国家之记忆)。
詹姆斯·“曲奇”·弗雷德里克斯在本地点时，本地点得到-2隐藏。
位于奥斯曼前线的每个非[[精英]]敌人得到+2攻击，并失去反击。
```

## 08573b · Ottoman Front / 奥斯曼前线
- 行号：src/cards/cards-data.js:298882（name/nameZh） · src/cards/cards-data.js:298893（textZh） · src/cards/cards-data.js:298858（backTextZh）
- pack=eoec · type=story
- text EN:
```
If James "Cookie" Fredericks is alive:
Spawn the set-aside Memory of a Ravaged Country enemy at this location.
Flip this card back over.
If James "Cookie" Fredericks is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果詹姆斯·“曲奇”·弗雷德里克斯活着：
在本地点生成放在一边的饱经战乱的国家之记忆敌人。
将本卡牌翻面。
如果詹姆斯·“曲奇”·弗雷德里克斯被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Through the din of war - a hail of gunfire and mortars so loud it shakes the earth - Cookie reloads his rifle, slowly and methodically. "Sergeant Fredericks!" a voice calls out to him. His companion ducks through the trench as another nearby explosion kicks up a spray of mud. "Germans broke the line last night. They're circling around. We have to get out of here!"
Cookie affixes a bayonet to the end of his rifle. "Did the lieutenant give the order?" he asks.
"Lieutenant Williams is dead," the soldier replies, the fear in his voice palpable. "Sir...you're in charge."
```
- flavor ZH:
```
在战争的喧闹声——枪声和迫击炮声震得大地都为之摇动——之中，曲奇缓慢而有条不紊地重新装填好步枪。“弗雷德里克斯中士！”一个声音喊道。他的同伴俯身穿过壕沟，附近的另一次爆炸扬起了泥水。“德国人昨晚突破阵线了。他们在周围打转。我们必须离开这里！”
曲奇在他的步枪末端绑上了刺刀。“中尉下命令了吗？”他问道。
“威廉斯中尉死了。”士兵回答，声音里透着恐惧，“长官……现在由您指挥。”
```

## 08574 · The Black Stone / 黑色岩石
- 行号：src/cards/cards-data.js:298936（name/nameZh） · src/cards/cards-data.js:298948（textZh） · src/cards/cards-data.js:298907（backTextZh）
- pack=eoec · type=location
- traits: Mirage  ||  幻景
- text EN:
```
Mirage 2 [per_investigator] (Memory of a Terrible Discovery).
While Avery Claypool is at this location, it gets -2 shroud.
[fast] Add 1 [frost] token to the chaos bag: Discover 2 clues at The Black Stone. (Group limit once per game.)
```
- text ZH:
```
幻景2[per_investigator](可怕发现之记忆)。
艾弗里·克莱普尔在本地点时，本地点得到-2隐藏。
[free]在混乱袋里加入1个[frost]标记：发现黑色岩石的2个线索(团队每场游戏仅限一次)。
```

## 08574b · The Black Stone / 黑色岩石
- 行号：src/cards/cards-data.js:298989（name/nameZh） · src/cards/cards-data.js:299000（textZh） · src/cards/cards-data.js:298965（backTextZh）
- pack=eoec · type=story
- text EN:
```
If Avery Claypool is alive:
Spawn the set-aside Memory of a Terrible Discovery enemy at this location. Flip this card back over.
If Avery Claypool is crossed out:
Move each investigator and enemy at this location to Prison of Memories. Discard each card attached to this location. Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
如果艾弗里·克莱普尔活着：
在本地点生成放在一边的可怕发现之记忆敌人。
将本卡牌翻面。
如果艾弗里·克莱普尔被划掉了：
将位于本地点的所有调查员和敌人移动到记忆囚笼。弃掉附属到本地点的所有卡牌。将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"According to Inuit legend, this megalith has stood here since before humanity walked the Earth," a young Avery recounts, examining the runic language along its surface.
"I don't know about any of that, but it is definitely ancient. That's not even the weirdest part, though."
"What is?" one of the other explorers asks, pulling his hood down to get a better view of the towering structure.
"See for yourself," Claypool says, unfolding a map and placing it against the smooth stone. Drawn over the map's surface are many rings and lines depicting various weather patterns. "This thing...is like a lightning rod."
```
- flavor ZH:
```
“根据因纽特人的传说，这块巨石在人类出现在地球上之前就已经矗立在这里了。”年轻的艾弗里一边沿着它的表面研究符文语言，一边叙述道。“我不懂这些文字，但它毫无疑问是古代的。不过，这还不是最奇怪的部分。”
“那什么是呢？”另一名探险家一边问，一边拉下兜帽，以便更好地欣赏这座高耸的建筑。
“你自己看吧。”克莱普尔说着，展开一张地图，把它放在光滑的石头上。地图表面绘有许多圆环和线条，描绘了不同的天气模式。“这东西……像是避雷针。”
```

## 08575 · Memory of a Hunt Gone Awry / 狩猎失败之记忆
- 行号：src/cards/cards-data.js:299047（name/nameZh） · src/cards/cards-data.js:299058（textZh） · src/cards/cards-data.js:299014（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Alert. Retaliate.
Prey - Investigator with Eliyah Ashevak.
[reaction] After you successfully evade this enemy by 3 or more: Deal it 3 damage.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
警戒。反击。
猎物 - 拥有伊里亚·阿什瓦克的调查员。
[reaction]在你成功躲避本敌人，且超过难度至少3点后：对其造成3点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08575b · Memory of a Hunt Gone Awry / 狩猎失败之记忆
- 行号：src/cards/cards-data.js:299103（name/nameZh） · src/cards/cards-data.js:299114（textZh） · src/cards/cards-data.js:299079（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Eliyah has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Eliyah Ashevak is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下伊里亚直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括伊里亚·阿什瓦克或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"We almost died that day. Anyu and I," the real Eliyah says as the mirage fades. Anyu licks his gloved hand and whines. "We were the only two that survived. And nobody ever believed me when I told them about the creature that attacked us. They turned me into a pariah. I thought...maybe I was crazy, after all." He shudders as he recalls the shape the mirage took. "But now I know. What attacked us that day was real."
```
- flavor ZH:
```
“那天我们差点就死了。安雨和我。”幻景消失时，真正的伊里亚说道。安雨舔着他戴着手套的手，发出呜呜的声音。“只有我们两个幸存了下来。当我将袭击我们的生物相关的事情告诉别人的时候，没人相信我。他们把我贬为了贱民。我想……也许终究是我疯了。”当他回忆起幻景时，不禁战栗起来。“但现在我知道了。那天袭击我们的东西是真实存在的。”
```

## 08576 · Memory of a Lost Patient / 去世病人之记忆
- 行号：src/cards/cards-data.js:299161（name/nameZh） · src/cards/cards-data.js:299172（textZh） · src/cards/cards-data.js:299128（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Retaliate.
Prey - Investigator with Dr. Mala Sinha.
[reaction] After you heal 1 or more damage while this enemy is exhausted: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
反击。
猎物 - 拥有玛拉·辛哈医生的调查员。
[reaction]本敌人处于横置状态时，在你治愈1点或更多伤害后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08576b · Memory of a Lost Patient / 去世病人之记忆
- 行号：src/cards/cards-data.js:299217（name/nameZh） · src/cards/cards-data.js:299228（textZh） · src/cards/cards-data.js:299193（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Dr. Sinha has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Dr. Mala Sinha is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下辛哈医生直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当玛拉·辛哈医生在一场冒险中被加入或使用时，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"I will never forget that day. The day I lost my first patient." She crosses her arms as the mirage fades. Her eyes are tired and worn. "They tell you it happens to even the best of us, but even so, we are never prepared. I was not foolish enough to vow that I would never lose another one. I knew that was a fantasy." She glances at you knowingly. "Instead, I simply vowed never to get attached. So do not be upset at my distance. It is for my own sake. So if - when - I lose you, I am not lost, myself."
```
- flavor ZH:
```
“我永远忘不了那一天，我第一个病人去世的那天。”当幻景消失时，她交叉双臂。她的眼睛疲倦而疲惫。“他们告诉你，即使是最优秀的人也会遇到这种情况，但即便如此，我们也从来没有准备好。我还没有蠢到发誓再也不会失去另一个病人。我知道那只是幻想。”她会意地瞥了你一眼。“相反，我只是发誓再也不对他人倾注感情。所以不要因为我疏远你而难过。这是为了我自己。所以如果——当——我失去你时，我也不会迷失，我自己。”
```

## 08577 · Memory of a Missing Father / 失踪父亲之记忆
- 行号：src/cards/cards-data.js:299275（name/nameZh） · src/cards/cards-data.js:299286（textZh） · src/cards/cards-data.js:299242（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Retaliate.
Prey - Investigator with Takada Hiroko.
[reaction] After you gain 1 or more resources while this enemy is exhausted: Deal 1 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
反击。
猎物 - 拥有高田弘子的调查员。
[reaction]本敌人处于横置状态时，在你获得资源后：对本敌人造成1点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08577b · Memory of a Missing Father / 失踪父亲之记忆
- 行号：src/cards/cards-data.js:299331（name/nameZh） · src/cards/cards-data.js:299342（textZh） · src/cards/cards-data.js:299307（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Takada has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Takada Hiroko is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下高田直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当一场冒险期间包括高田弘子或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"He never did come home," Takada whispers, choking on her words. "I spent my whole life following in his footsteps. I thought...I thought if I did, maybe..." she wipes the tears - and inky miasma - from her eyes. "He's gone. Gone forever."
```
- flavor ZH:
```
“他没有回家。”高田低声哽咽着说。“我一生都在追随他的脚步。我以为……我以为如果我这么做，也许……”她擦去从眼中流出的泪水——还有墨黑的瘴气。“他走了。再也回不来了。”
```

## 08578 · Memory of a Ravaged Country / 饱经战乱的国家之记忆
- 行号：src/cards/cards-data.js:299389（name/nameZh） · src/cards/cards-data.js:299400（textZh） · src/cards/cards-data.js:299356（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Retaliate.
Prey - Investigator with James "Cookie" Fredericks.
[reaction] After this enemy attacks you: Deal it 1 damage.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
反击。
猎物 - 拥有詹姆斯·“曲奇”·弗雷德里克斯的调查员。
[reaction]本敌人攻击你后：对其造成1点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08578b · Memory of a Ravaged Country / 饱经战乱的国家之记忆
- 行号：src/cards/cards-data.js:299445（name/nameZh） · src/cards/cards-data.js:299456（textZh） · src/cards/cards-data.js:299421（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Cookie has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever James "Cookie" Fredericks is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下曲奇直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括詹姆斯·“曲奇”·弗雷德里克斯或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
As the mirage dissolves, you watch a young Sergeant James Fredericks command his men to flee, a hail of bullets and mortar fire following in their wake. "Kid never did make it back," the real Cookie says, grinding his teeth. "Very few of us did that day. And for what?" He spits. The roar of gunfire fades into the distance. "For what?"
```
- flavor ZH:
```
在幻景开始消失时，你看到年轻的詹姆斯·弗雷德里克斯中士命令他的部下逃跑，一阵枪林弹雨和迫击炮火紧随其后。“小伙子到最后也没能活着回去。”真正的曲奇咬着牙说道。
“那天我们这些人都快死光了。而这是为了什么呢？”他啐了口口水。枪炮声渐渐消失在远处。“为了什么？”
```

## 08579 · Memory of a Regretful Voyage / 悔恨航程之记忆
- 行号：src/cards/cards-data.js:299503（name/nameZh） · src/cards/cards-data.js:299514（textZh） · src/cards/cards-data.js:299470（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Retaliate.
Prey - Investigator with Dr. William Dyer.
[reaction] After you draw 1 or more cards while this enemy is exhausted: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
反击。
猎物 - 拥有威廉·戴尔博士的调查员。
[reaction]本敌人处于横置状态时，在你抽取1张或更多卡牌后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08579b · Memory of a Regretful Voyage / 悔恨航程之记忆
- 行号：src/cards/cards-data.js:299559（name/nameZh） · src/cards/cards-data.js:299570（textZh） · src/cards/cards-data.js:299535（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Dyer has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Professor William Dyer is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下戴尔直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括威廉·戴尔教授或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"We never should have gone," the real Dyer whispers as the shape of Professor Lake fades into the mirage. "I should have convinced him. I should have...but I was too greedy, too eager." he chokes. "And now, here I am again. You and I, we have led these people to their ends. Even if we survive, we will never forget what we have done to these people. What we have risked."
```
- flavor ZH:
```
“我们根本就不应该去。”随着莱克教授的身影消失在幻景中，真正的戴尔低语着。“我本应说服他的。我本应……但我太贪婪、太渴望了。”他哽咽着，“而现在，我又来了。是你和我，我们把这些人引向他们的末日。即便我们最终活下来了，我们也永远忘不了我们对这些人做过的事。我们所冒的险。”
```

## 08580 · Memory of an Unspeakable Evil / 无法述说的恶魔之记忆
- 行号：src/cards/cards-data.js:299617（name/nameZh） · src/cards/cards-data.js:299628（textZh） · src/cards/cards-data.js:299584（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Alert. Retaliate.
Prey - Investigator with Danforth.
[action][action] Shuffle the top 3 cards of the Tekeli-li deck into your deck: Parley. Deal 3 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
警戒。反击。
猎物 - 拥有丹佛斯的调查员。
[action][action]将忒咳哩-哩牌库顶的3张卡牌混洗入你的牌库：谈判。对本敌人造成3点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08580b · Memory of an Unspeakable Evil / 无法述说的恶魔之记忆
- 行号：src/cards/cards-data.js:299673（name/nameZh） · src/cards/cards-data.js:299684（textZh） · src/cards/cards-data.js:299649（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Danforth has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Danforth is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下丹佛斯直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括丹佛斯或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"It's here, it's here," the real Danforth mutters as he sees the miasma dripping from the cracked window. "It was always here, always here and I returned, returned to hear that accursed sound..." He continues to watch in horror as the miasma retreats, returning his dormitory to its natural state. It takes several minutes for him to stop shaking.
```
- flavor ZH:
```
“它在这里，它在这里。”真正的丹佛斯看到从破裂的窗户溢出的瘴气，喃喃自语道。“它一直在这里，一直在这里，而我回来了，回来就为了听到那个可恶的声音……”他继续惊恐地看着瘴气退去，宿舍恢复了正常状态。几分钟后他才停止颤抖。
```

## 08581 · Memory of a Terrible Discovery / 可怕发现之记忆
- 行号：src/cards/cards-data.js:299731（name/nameZh） · src/cards/cards-data.js:299742（textZh） · src/cards/cards-data.js:299698（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Alert.
Prey - Investigator with Avery Claypool.
[action] Add 1 [frost] token to the chaos bag: Parley. Deal 4 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
警戒。
猎物 - 拥有艾弗里·克莱普尔的调查员。
[action]在混乱袋里加入1个[frost]标记：谈判。对本敌人造成4点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08581b · Memory of a Terrible Discovery / 可怕发现之记忆
- 行号：src/cards/cards-data.js:299787（name/nameZh） · src/cards/cards-data.js:299798（textZh） · src/cards/cards-data.js:299763（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Claypool has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Avery Claypool is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下克莱普尔直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括艾弗里·克莱普尔或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"After that, there was no going back," the real Claypool explains. "We had opened Pandora's box, so to speak. I could no longer bury my head in the sand. There are forces out there beyond our comprehension. Things that science cannot explain. Just as I could not explain that stone's meteorological impact on the region. Nor could I explain the nature of the storm that hit us after we uncovered it."
You ask Claypool what happened to the other man who was with him that day. He grinds his teeth and shakes his head.
```
- flavor ZH:
```
“从那以后，就没有回头路了。”真正的克莱普尔解释说，“可以说，我们打开了潘朵拉之盒。我再也不能逃避现实了。世上存在我们无法理解的力量。科学无法解释的东西。就像我无法解释那石头对那个地区的气象影响一样，我也无法解释在我们发现后袭击我们的风暴的性质。”
你询问克莱普尔，那天和他在一起的另一个人发生了什么。他咬着牙，摇着头。
```

## 08582 · Memory of an Alien Translation / 翻译异星文字之记忆
- 行号：src/cards/cards-data.js:299845（name/nameZh） · src/cards/cards-data.js:299856（textZh） · src/cards/cards-data.js:299812（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Alert.
Prey - Investigator with Roald Ellsworth.
[reaction] After this enemy is exhausted, if there is an attachment on its location: Deal 4 damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
警戒。
猎物 - 拥有罗尔德·埃尔斯沃思的调查员。
[reaction]在本敌人被横置后，如果在其所在地点有附属：对本敌人造成4点伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08582b · Memory of an Alien Translation / 翻译异星文字之记忆
- 行号：src/cards/cards-data.js:299901（name/nameZh） · src/cards/cards-data.js:299912（textZh） · src/cards/cards-data.js:299877（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Ellsworth has confronted his demons. Draw a checkmark next to his name in the Expedition Team section.
From now on, whenever Roald Ellsworth is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If he is currently in play, switch him with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下埃尔斯沃思直面他内心的恶魔。在探险队部分他的名字旁画一个勾。
从现在起，每当一场冒险期间包括罗尔德·埃尔斯沃思或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果他当前在场上，现在就将他切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
"I...I remember this," the real Ellsworth says, staring at his own memory. "This is what made me want to become an explorer. To discover things like this. Ancient secrets, left behind by God knows what. But the more I discover, the more I think that perhaps there are parts of the Earth better left alone. Perhaps all of this is the fault of people like me, who refuse to let history lie. Arrogant fools, the lot of us."
```
- flavor ZH:
```
“我……我记得这个。”真正的埃尔斯沃思盯着自己的记忆说，“这就是为什么我想成为一名探险家的原因。为了发现这样的东西。古代秘密，天知道是被什么东西留下来的。但我发现得越多，我就越觉得，不去探索地球的某些地方会更好。也许这一切都是像我这样的人的错，我们这些拒绝让历史被尘封的人。我们都是傲慢的傻瓜。”
```

## 08583 · Memory of an Unrequited Love / 单恋之记忆
- 行号：src/cards/cards-data.js:299959（name/nameZh） · src/cards/cards-data.js:299970（textZh） · src/cards/cards-data.js:299926（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Alert.
Prey - Investigator with Dr. Amy Kensler.
[reaction] After you discover 1 or more clues at this enemy's location: Deal that much damage to this enemy.
Forced - When this enemy is defeated: Flip it over and resolve the text on its other side.
```
- text ZH:
```
警戒。
猎物 - 拥有艾米·肯斯勒博士的调查员。
[reaction]在你发现本敌人所在地点的1个或更多线索后：对本敌人造成该数量的伤害。
强制 - 在本敌人被击败时：将其翻面并结算另一面的文本。
```

## 08583b · Memory of an Unrequited Love / 单恋之记忆
- 行号：src/cards/cards-data.js:300015（name/nameZh） · src/cards/cards-data.js:300026（textZh） · src/cards/cards-data.js:299991（backTextZh）
- pack=eoec · type=story
- text EN:
```
In your Campaign Log, record Dr. Kensler has confronted her demons. Draw a checkmark next to her name in the Expedition Team section.
From now on, whenever Dr. Amy Kensler is included or used during a scenario, use the set-aside [[Resolute]] version instead of the version from the Expedition Team encounter set. If she is currently in play, switch her with that version now.
Add this card to the victory display.
The investigators may advance the current act or continue playing.
```
- text ZH:
```
在剧本日志中，记录下肯斯勒博士直面她内心的恶魔。在探险队部分她的名字旁画一个勾。
从现在起，每当一场冒险期间包括艾米·肯斯勒博士或其被使用，不使用探险队遭遇组中的版本，改为使用放在一边的[[坚毅]]版本。如果她当前在场上，现在就将她切换为该版本。
将本卡牌加入胜利区。
调查员可以推进当前场景或继续游戏。
```
- flavor EN:
```
Dr. Kensler - the real one - eyes you coldly. "This memory is not for you," she warns. "Though I suppose you have no more control over this than I do." You cannot help but be a little curious what kind of academic work would rattle somebody like her, so you ask. "It was not academic in nature," she confesses, running her hand idly along the vision of her office desk, before pulling the photograph out from inside the journal and examining it in private. "I was never very skilled in expressing myself in...matters of the heart," she says, and the photograph fades in her hands, along with the rest of the mirage. "Come along. I do not wish to remain here any longer," she states.
```
- flavor ZH:
```
肯斯勒博士——真正的那位——冷眼看着你。“你不该接触这段记忆。”她警告着，“不过我想你和我一样，对当前处境也没有什么决定权。”你不禁好奇，什么样的学术工作会让像她这样的人感到不安，所以你向她发问。“这不是学术性质的。”她坦白道，一边漫不经心地抚摸着她的办公桌，然后从日记里抽出照片，私下里检查它。“我从来都不擅长……表达自己内心的想法。”她说着，照片在她手中慢慢消失，幻景中的其他东西也一同消失了。“走吧。我不想再待在这里了。”她说着。
```

## 08584 · Horrifying Shade / 恐怖阴影
- 行号：src/cards/cards-data.js:300070（name/nameZh） · src/cards/cards-data.js:300081（textZh） · src/cards/cards-data.js:300040（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon  ||  怪物 / 幻灵
- text EN:
```
Aloof. Hunter.
While Horrifying Shade is at a location that is cleared of mirages, it loses aloof.
Forced - After you discover or take control of 1 or more clues at Horrifying Shade's location: Place an equal amount of doom on Horrifying Shade.
```
- text ZH:
```
冷漠。猎手。
恐怖阴影位于破除幻景的地点时，其失去冷漠。
强制 - 在你发现或控制恐怖阴影所在地点的至少1个线索后：在恐怖阴影上放置与该线索数量相等的毁灭标记。
```

## 08585 · Evanescent Mist / 易散之雾
- 行号：src/cards/cards-data.js:300125（name/nameZh） · src/cards/cards-data.js:300136（textZh） · src/cards/cards-data.js:300100（backTextZh）
- pack=eoec · type=treachery
- traits: Curse / Hazard  ||  诅咒 / 危险
- text EN:
```
Revelation - Attach Evanescent Mist to the nearest location that is not cleared of mirages. Place 2 clues on attached location.
In order to flip attached location over, investigators at attached location must either spend 2 additional clues as a group, or each take 2 damage.
Forced - If attached location is cleared of mirages: Discard Evanescent Mist.
```
- text ZH:
```
显现 - 将易散之雾附属到尚未破除幻景的最近地点。在附属地点上放置2个线索。
若要将附属地点翻面，位于附属地点的调查员必须共同花费额外2个线索，或者各自受到2点伤害。
强制 - 如果附属地点已破除幻景：弃掉易散之雾。
```

## 08586 · Anamnesis / 回首往事
- 行号：src/cards/cards-data.js:300180（name/nameZh） · src/cards/cards-data.js:300191（textZh） · src/cards/cards-data.js:300155（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Peril.
Revelation - You must either (choose one):
- Take 2 horror.
- Place 1 doom on the current agenda. This effect can cause the current agenda to advance.
```
- text ZH:
```
险境。
显现 - 你必须(选择以下一项)：
- 受到2点伤害。
- 在当前密谋上放置1个毁灭标记。本效果能导致当前密谋推进。
```

## 08587 · Professor William Dyer / 威廉·戴尔教授
- 行号：src/cards/cards-data.js:300236（name/nameZh） · src/cards/cards-data.js:300249（textZh） · src/cards/cards-data.js:300208（backTextZh）
- pack=eoec · type=asset · subname=Professor of Geology / 地质学教授
- traits: Ally / Miskatonic / Resolute  ||  盟友 / 米斯卡塔尼克 / 坚毅
- text EN:
```
Partner. Uses (3 secrets).
[fast] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.
```
- text ZH:
```
伙伴。使用(3秘密)。
[free]花费1秘密并横置威廉·戴尔教授：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点恐惧。
```
- flavor EN:
```
"We should never have come back."
```
- flavor ZH:
```
“我们根本不该回到这儿。”
```

## 08588 · Danforth / 丹佛斯
- 行号：src/cards/cards-data.js:300298（name/nameZh） · src/cards/cards-data.js:300311（textZh） · src/cards/cards-data.js:300270（backTextZh）
- pack=eoec · type=asset · subname=Brilliant Student / 杰出学生
- traits: Ally / Miskatonic / Resolute  ||  盟友 / 米斯卡塔尼克 / 坚毅
- text EN:
```
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 3 cards. Discard each Tekeli-li weakness drawn by this effect without resolving its effects.
```
- text ZH:
```
伙伴。使用(5秘密)。
[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费1秘密：该调查员抽取3张卡牌。弃掉由此效果抽取的所有忒咳哩-哩弱点，不要结算其效果。
```
- flavor EN:
```
"...the windowless place... wings... eyes in the darkness..."
```
- flavor ZH:
```
“……没有窗户的地方……翅膀……黑暗中的眼睛……”
```

## 08589 · Eliyah Ashevak / 伊里亚·阿什瓦克
- 行号：src/cards/cards-data.js:300360（name/nameZh） · src/cards/cards-data.js:300373（textZh） · src/cards/cards-data.js:300332（backTextZh）
- pack=eoec · type=asset · subname=Dog Handler / 驯犬师
- traits: Ally / Wayfarer / Resolute  ||  盟友 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 6. If you succeed, you may move to a connecting location.
```
- text ZH:
```
伙伴。使用(3秘密)。
[free]在你回合期间，花费1秘密并横置伊里亚·阿什瓦克：躲避。以基础值为6的[agility]尝试躲避。如果你检定成功，你可以移动到一个连接地点。
```
- flavor EN:
```
"I know, Anyu. This place is all wrong."
```
- flavor ZH:
```
“我知道，安雨。这地方完全不对劲。”
```

## 08590 · Dr. Mala Sinha / 玛拉·辛哈医生
- 行号：src/cards/cards-data.js:300422（name/nameZh） · src/cards/cards-data.js:300435（textZh） · src/cards/cards-data.js:300394（backTextZh）
- pack=eoec · type=asset · subname=Daring Physician / 无畏医师
- traits: Ally / Wayfarer / Resolute  ||  盟友 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (3 supplies).
[fast] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.
```
- text ZH:
```
伙伴。使用(3补给)。
[free]花费1补给并横置玛拉·辛哈医生：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点伤害。
```
- flavor EN:
```
"I'll see what I can do, but some of these wounds are beyond the understanding of modern medicine..."
```
- flavor ZH:
```
“我会试试，但有些伤口是现代医学无法理解的……”
```

## 08591 · Avery Claypool / 艾弗里·克莱普尔
- 行号：src/cards/cards-data.js:300484（name/nameZh） · src/cards/cards-data.js:300497（textZh） · src/cards/cards-data.js:300456（backTextZh）
- pack=eoec · type=asset · subname=Antarctic Guide / 南极向导
- traits: Ally / Wayfarer / Resolute  ||  盟友 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (3 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool: Cancel that token. Then, you must either reveal a new chaos token, or spend 1 supply.
```
- text ZH:
```
伙伴。使用(3补给)。
[reaction]你所在地点的一位调查员在技能检定期间揭示了一个[frost]标记时，横置艾弗里·克莱普尔：取消该标记。然后，你必须揭示一个新的混乱标记，或者花费1补给。
```
- flavor EN:
```
"These are not stormclouds. These are something else entirely."
```
- flavor ZH:
```
“这些不是风暴云，完全是别的东西。”
```

## 08592 · James "Cookie" Fredericks / 詹姆斯·“曲奇”·弗雷德里克斯
- 行号：src/cards/cards-data.js:300546（name/nameZh） · src/cards/cards-data.js:300559（textZh） · src/cards/cards-data.js:300518（backTextZh）
- pack=eoec · type=asset · subname=Dubious Choice / 不可靠人选
- traits: Ally / Veteran / Wayfarer / Resolute  ||  盟友 / 老兵 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (3 ammo).
[fast] During your turn, spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 6. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.
```
- text ZH:
```
伙伴。使用(3子弹)。
[free] 在你回合期间，花费1子弹并横置詹姆斯·“曲奇”·弗雷德里克斯：攻击。以基础值为6的[combat]攻击。如果你检定成功，且被攻击敌人非[[精英]]，则直到本轮结束其不能攻击。
```
- flavor EN:
```
"Next thing that moves is gettin' a lead hole through its teeth."
```
- flavor ZH:
```
“还有玩意敢动就等着牙口长弹孔吧。”
```

## 08593 · Dr. Amy Kensler / 艾米·肯斯勒博士
- 行号：src/cards/cards-data.js:300610（name/nameZh） · src/cards/cards-data.js:300623（textZh） · src/cards/cards-data.js:300582（backTextZh）
- pack=eoec · type=asset · subname=Professor of Biology / 生物学教授
- traits: Ally / Miskatonic / Resolute  ||  盟友 / 米斯卡塔尼克 / 坚毅
- text EN:
```
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Dr. Amy Kensler: Investigate. Investigate with a base [intellect] skill of 6. If you succeed, look at the top card of any investigator's deck or the encounter deck. You may discard that card.
```
- text ZH:
```
伙伴。使用(3秘密)。
[free]在你回合期间，花费1秘密并横置艾米·肯斯勒博士：调查。以基础值为6的[intellect]调查。如果你检定成功，查看任意一位调查员牌库顶的1张卡牌或遭遇牌库顶的1张卡牌。你可以弃掉该卡牌。
```
- flavor EN:
```
"The beings that built this place... did they create this, too?"
```
- flavor ZH:
```
“建造这个地方的生物……也创造了它吗？”
```

## 08594 · Roald Ellsworth / 罗尔德·埃尔斯沃思
- 行号：src/cards/cards-data.js:300672（name/nameZh） · src/cards/cards-data.js:300685（textZh） · src/cards/cards-data.js:300644（backTextZh）
- pack=eoec · type=asset · subname=Intrepid Explorer / 英勇的探险家
- traits: Ally / Miskatonic / Wayfarer / Resolute  ||  盟友 / 米斯卡塔尼克 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (3 supplies).
[fast] During an investigator's turn, either exhaust Roald Ellsworth or spend 1 supply: Choose a non-weakness treachery in play. Treat that treachery's text box as if it were blank until the end of this turn.
```
- text ZH:
```
伙伴。使用(3补给)。
[free]一位调查员的回合期间，横置罗尔德·埃尔斯沃思，或者花费1补给：选择场上一张非弱点诡计。将该诡计的印刷文本框视为如同空白，直到本回合结束。
```
- flavor EN:
```
"I thought I knew this place. I really did."
```
- flavor ZH:
```
“我认为我知道这个地方，真的。”
```

## 08595 · Takada Hiroko / 高田弘子
- 行号：src/cards/cards-data.js:300736（name/nameZh） · src/cards/cards-data.js:300749（textZh） · src/cards/cards-data.js:300708（backTextZh）
- pack=eoec · type=asset · subname=Aeroplane Mechanic / 飞机技师
- traits: Ally / Wayfarer / Resolute  ||  盟友 / 旅人 / 坚毅
- text EN:
```
Partner. Uses (9 resources).
[action] Exhaust Takada Hiroko: Gain 1 resource. Move up to 3 resources from Takada Hiroko to your resource pool.
```
- text ZH:
```
伙伴。使用(9资源)。
[action]横置高田弘子：获得1资源。将高田弘子上的最多3资源移动到你的资源池。
```
- flavor EN:
```
"No wonder nobody has flown over these parts."
```
- flavor ZH:
```
“怪不得没有人飞过这一带。”
```

## 08596 · To the Forbidden Peaks / 失落之峰
- 行号：src/cards/cards-data.js:300795（name/nameZh） · src/cards/cards-data.js:300806（textZh） · src/cards/cards-data.js:300770（backTextZh）
- pack=eoec · type=scenario
- text EN:
```
Easy / Standard
[skull]: -X. X is the level of your location.
[cultist]: -1. If you fail, after this test ends move to the location directly below you.
[tablet]: -3. If you fail, lose control of an [[Expedition]] asset and place it at your location.
[elder_thing]: -4. If you fail, the nearest [[Elder Thing]] enemy moves once toward you. If it is engaged with you, it attacks.
```
- text ZH:
```
简单/ 普通
[skull]：-X。X等于所在地点的高度。
[cultist]：-1。如果你检定失败，在本次检定结束后，移动到你下方紧挨着的地点。(FAQ，v2.1)
[tablet]：-3。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。
[elder_thing]：-4。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。
```
- backText EN:
```
Hard / Expert
[skull]: -X. X is 2 plus the level of your location.
[cultist]: -1. After this test ends move to the location directly below you.
[tablet]: -4. If you fail, lose control of an [[Expedition]] asset and place it at your location.
[elder_thing]: -5. If you fail, the nearest [[Elder Thing]] enemy moves once toward you. If it is engaged with you, it attacks.
```
- backText ZH:
```
困难/专家
[skull]：-X。X等于你所在地点的高度加2。
[cultist]：-1。在本次检定结束后，移动到你下方紧挨着的地点。(FAQ，v2.1)
[tablet]：-4。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。
[elder_thing]：-5。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。
```

## 08597 · Forbidden Peaks / 失落山峰
- 行号：src/cards/cards-data.js:300849（name/nameZh） · src/cards/cards-data.js:300861（textZh） · src/cards/cards-data.js:300821（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - After you move to a location: Return all of your clues to the token pool.
```
- text ZH:
```
强制 - 在你移动到一个地点后：将你所有线索放回供应堆。
```
- backText EN:
```
Put the set-aside Terror of the Stars enemy into play at the highest level location with one or more investigators. Each investigator at that location loses control of all [[Expedition]] assets and places them at their location.
Read Scenario Interlude: Tragedy Strikes in the Campaign Guide.
```
- backText ZH:
```
将放在一边的星之恐怖敌人放置入场，位于高度最高的，有调查员的地点。所有位于该地点的调查员各自失去其对所有[[探险]]支援的控制权，并将那些支援放在自己所处的地点。
阅读剧本手册中的冒险幕间故事：悲剧袭来。
```
- flavor EN:
```
You arrive at the foothills of the menacing mountain. The strange caves and odd formations at the mountain's summit beg to be explored.
```
- flavor ZH:
```
你来到了险恶山脉的山麓下。山顶的奇异洞穴和奇怪构造亟待探索。
```
- backFlavor EN:
```
The mountainside splits and erupts with snow. A storm of jagged ice shards bursts forth from the womb of the mountain. Behind it, the beast emerges: a whirlwind of mist; haunting, alien shapes; hideous effluvia. It sets its terrible gaze on your party and reaches for you with a tendril of miasma.
```
- backFlavor ZH:
```
山腰裂开，雪花喷了出来。一股凌乱的冰屑风暴从山腹中爆发。在其之后，野兽出现了：一团迷雾旋风；令人难忘的异形身影；可怕的臭气。它惊悚的眼神死死盯着你们，带着一缕瘴气向你袭来。
```

## 08598 · Terror Descends / 恐怖降临
- 行号：src/cards/cards-data.js:300904（name/nameZh） · src/cards/cards-data.js:300916（textZh） · src/cards/cards-data.js:300876（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - After you move to a location: Return all of your clues to the token pool.
```
- text ZH:
```
强制 - 在你移动到一个地点后：将你所有线索放回供应堆。
```
- backText EN:
```
If one or more investigators have resigned, proceed to (→R1).
Otherwise, proceed to (→R2).
```
- backText ZH:
```
如果有调查员已经撤退，进入(→结局1)。
否则，进入(→结局2)。
```
- flavor EN:
```
The once-flurrying snow has become a tempest of wind and heavy snowfall. If you don't make it across the peaks soon, you'll be forced to take shelter...or spend the rest of eternity as a frozen corpse along the mountainside.
```
- flavor ZH:
```
曾经的小雪变成了狂风暴雪。如果你不能尽快越过山峰，你就得被迫寻找避难所……或者永远变成山坡上一具冻僵的尸体。
```
- backFlavor EN:
```
The snowfall is so thick now that you can no longer see your destination, nor can you hear your companions' shouts over the howling wind. Every step takes the breath out of you. The air is so thin up here, it is a wonder you even have any breath to spare. You glance up at the blanket of white cast in an endless net overhead. Perhaps you were never close to the summit - just another trick of the eye, like everything else in this godforsaken place.
```
- backFlavor ZH:
```
雪下得如此之大，目的地已从你的视野中消失，你同伴的呼喊也无法越过咆哮的狂风传入你耳中。你走的每一步都让你喘不过气来。这里的空气太稀薄了，你还能呼吸已经是个奇迹。你抬头望着头顶上投下的白茫茫的无尽之网。也许你从来没有接近过山顶——就像这个鬼地方的一切，不过是另一种障眼法。
```

## 08599 · Ascend the Mountain / 登上高峰
- 行号：src/cards/cards-data.js:300958（name/nameZh） · src/cards/cards-data.js:300970（textZh） · src/cards/cards-data.js:300931（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action]: Take control of an [[Expedition]] asset at your location.
Objective - Get to the top of the mountain. If each undefeated investigator has resigned, advance.
```
- text ZH:
```
[action]：控制你所在地点的一个[[探险]]支援。
目标 - 到达山顶。如果所有未被击败的调查员都撤退了，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
Carrying as much expedition gear as you can, you must climb the imposing mountainside to unlock the secrets that lie on the other side.
```
- flavor ZH:
```
你带着尽可能多的探险装备，必须爬上险峻的山坡去解开另一边的秘密。
```
- backFlavor EN:
```
After a long and arduous journey up the mountainside, you've reached the forbidden peaks. You hope the pain and horror you've suffered along the way is behind you, but you fear that it will persist...and become relentless.
```
- backFlavor ZH:
```
经过漫长艰难的登山之旅，你已到达失落山峰。你希望一路承受的痛苦与恐惧都已抛诸脑后，却担心它会继续折磨你……永不停歇。
```

## 08600 · Deep Drifts / 深厚积雪
- 行号：src/cards/cards-data.js:301012（name/nameZh） · src/cards/cards-data.js:301024（textZh） · src/cards/cards-data.js:300985（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to Deep Drifts from a location below it: Discard the top 3 cards of your deck. Draw each weakness discarded this way.
```
- text ZH:
```
强制 - 你从下方的地点移动到深厚积雪后：弃掉你牌库顶3张卡牌。抽取所有以此方式弃掉的弱点。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08601 · White Bluff / 白色断崖
- 行号：src/cards/cards-data.js:301071（name/nameZh） · src/cards/cards-data.js:301083（textZh） · src/cards/cards-data.js:301044（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to White Bluff from a location below it: Test [agility] (X). X is 1 plus this location's level. If you fail, lose control of an [[Expedition]] asset and place it at White Bluff.
```
- text ZH:
```
强制 - 你从下方的地点移动到白色断崖后：检定[agility](X)。X为本地点的高度加1。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在白色断崖。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08602 · Steep Incline / 陡峭斜坡
- 行号：src/cards/cards-data.js:301131（name/nameZh） · src/cards/cards-data.js:301143（textZh） · src/cards/cards-data.js:301103（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to Steep Incline from a location below it: Take 1 damage.
```
- text ZH:
```
强制 - 你从下方的地点移动到陡峭斜坡后：受到1点伤害。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- flavor EN:
```
"The last stage of our descent to the town was unusually steep and abrupt...."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“我们进入城市的最后一段路异常地崎岖陡峭……”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08603 · Narrow Ridge / 狭窄山脊
- 行号：src/cards/cards-data.js:301191（name/nameZh） · src/cards/cards-data.js:301203（textZh） · src/cards/cards-data.js:301163（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to Narrow Ridge from a location below it: Take 1 horror.
```
- text ZH:
```
强制 - 你从下方的地点移动到狭窄山脊后：受到1点恐惧。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- flavor EN:
```
"...before noon we all felt a thrill of excitement at beholding a vast, lofty, and snow-clad mountain chain which opened out and covered the whole vista ahead."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……中午来临前，看见一条高大的白色山脉耸立在那，延展开来遮挡了整个视野，我们感到一阵兴奋。”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08604 · Rocky Ledge / 岩架
- 行号：src/cards/cards-data.js:301251（name/nameZh） · src/cards/cards-data.js:301263（textZh） · src/cards/cards-data.js:301223（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to Rocky Ledge from a location below it: Shuffle the top card of the Tekeli-li deck into your deck without looking at it.
```
- text ZH:
```
强制 - 你从下方的地点移动到岩架后：将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库，不要查看内容。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- flavor EN:
```
"They had crossed the icy peaks on whose templed slopes they had once worshipped and roamed among the tree-ferns."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“它们越过了那冰封山峰，它们曾经拜过那斜坡上修建的寺庙，还在树般的蕨类植物中漫步。”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08605 · Snow-Covered Crag / 白雪复盖的峭壁
- 行号：src/cards/cards-data.js:301311（name/nameZh） · src/cards/cards-data.js:301323（textZh） · src/cards/cards-data.js:301283（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After you move to Snow-Covered Crag from a location below it: Exhaust each asset you control.
```
- text ZH:
```
强制 - 你从下方的地点移动到白雪复盖的峭壁后：横置所有你控制的支援。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- flavor EN:
```
"The distribution of cryptical cave-mouths on the black snow-denuded summits seemed roughly even...."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“在无雪的黑色山峰上，散布着神秘的洞穴，即便……”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08606 · Windswept Path / 迎风通路
- 行号：src/cards/cards-data.js:301370（name/nameZh） · src/cards/cards-data.js:301382（textZh） · src/cards/cards-data.js:301343（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Forced - After Windswept Path is revealed: If it is at level 0, place 1 [per_investigator] clues on it (from the token pool).
Forced - After you move to Windswept Path from a location below it: Place 1 clue on it (from the token pool).
```
- text ZH:
```
强制 - 迎风通路被揭示后：如果其高度为0，在其上放置1[per_investigator]个线索(从供应堆拿取)。
强制 - 你从下方的地点移动到迎风通路后：在其上放置1个线索(从供应堆拿取)。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- backFlavor EN:
```
"The touch of evil mystery in these barrier mountains, and in the beckoning sea of opalescent sky glimpsed betwixt their summits, was a highly subtle and attenuated matter..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这山岳屏障，以及它们之间呼唤众人的乳白色云海，能瞥见一丝暗藏其中，极其细微的邪恶神秘……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08607 · The Summit / 山顶
- 行号：src/cards/cards-data.js:301428（name/nameZh） · src/cards/cards-data.js:301440（textZh） · src/cards/cards-data.js:301401（backTextZh）
- pack=eoec · type=location
- traits: Mountain  ||  山脉
- text EN:
```
Clues on The Summit can only be discovered by investigating.
Forced - When The Summit is revealed: Add 1 [frost] token to the chaos bag.
[action]: Resign. Add each [[Expedition]] asset you control to the victory display. Return all of your clues to the token pool.
```
- text ZH:
```
山顶的线索只能通过调查发现。
强制 - 在山顶被揭示时：在混乱袋里加入1个[frost]标记。
[action]：撤退。将所有你控制的[[探险]]支援加入胜利区。将你所有的线索放回供应堆。
```
- backText EN:
```
You cannot enter this location unless all of the clues on the location directly below it have been discovered.
```
- backText ZH:
```
你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
```
- backFlavor EN:
```
"As we drew near the forbidding peaks, dark and sinister above the line of crevasse-riven snow and interstitial glaciers, we noticed more and more the curiously regular formations..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“当我们接近那些耸立在满是裂隙的冰雪和冰川上，黑暗而不详的禁忌山峰时，我们越来越注意到这座山的构造竟有些规则，颇为奇特……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08608 · Terror of the Stars / 星之恐怖
- 行号：src/cards/cards-data.js:301488（name/nameZh） · src/cards/cards-data.js:301500（textZh） · src/cards/cards-data.js:301458（backTextZh）
- pack=eoec · type=enemy · subname=Guardian of Forbidden Peaks / 失落之峰守护者
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Hunter. Massive.
Terror of the Stars gets +3 [per_investigator] health.
X is the level of your location (to a minimum of 1).
Forced - At the end of the round: Move all investigators at Terror of the Stars's location to the location directly below it.
```
- text ZH:
```
猎手。庞大。
星之恐怖得到+3[per_investigator]生命值。
X等于你所在地点的高度(至少为1)。
强制 - 当一轮结束时：将星之恐怖所在地点的所有调查员移动到下方紧挨着的地点。
```

## 08609 · Constricting Elder Thing / 拘束型古老者
- 行号：src/cards/cards-data.js:301552（name/nameZh） · src/cards/cards-data.js:301563（textZh） · src/cards/cards-data.js:301522（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Elder Thing  ||  怪物 / 古老者
- text EN:
```
Hunter.
X is the level of your location (to a minimum of 1).
While Constricting Elder Thing is engaged with you, you cannot move to locations above your location.
```
- text ZH:
```
猎手。
X等于你所在地点的高度(至少为1)。
拘束型古老者与你交战时，你不能移动到你所在地点上方的地点。
```

## 08610 · Snowfall / 降雪
- 行号：src/cards/cards-data.js:301608（name/nameZh） · src/cards/cards-data.js:301619（textZh） · src/cards/cards-data.js:301582（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Place 2 clues on your location (from the token pool).
```
- text ZH:
```
显现 - 在你所在地点放置2个线索(从供应堆拿取)。
```
- flavor EN:
```
"...the still lower horizon-grazing southern sun of midnight poured its hazy reddish rays over the white snow, bluish ice and water lanes, and black bits of exposed granite slope."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……午夜的太阳从南方地平线低处掠过，将朦胧的红色光芒洒在白色的积雪，蓝色冰层与水道，以及裸露的花岗岩斜坡上的小块黑色上。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08611 · Avalanche / 雪崩
- 行号：src/cards/cards-data.js:301661（name/nameZh） · src/cards/cards-data.js:301672（textZh） · src/cards/cards-data.js:301636（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - If the level of your location is 1-4, move to the location directly below you. Then test [willpower] (X). X is the level of your location. If you fail, repeat this process. If you did not move by this effect, Avalanche gains surge.
```
- text ZH:
```
显现 - 如果你所在地点的高度为1-4，移动到你下方紧挨着的地点。然后，检定[willpower](X)。X等于你所在地点的高度。如果你检定失败，重复本过程。如果你没有因为本效果移动，雪崩获得涌动。
```

## 08612 · Hanging on the Edge / 悬于边缘
- 行号：src/cards/cards-data.js:301714（name/nameZh） · src/cards/cards-data.js:301725（textZh） · src/cards/cards-data.js:301689（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Test [agility] (3). If you fail, take 2 damage, lose control of each [[Expedition]] asset you control (placing it at your location), and move to the location directly below you.
```
- text ZH:
```
显现 - 检定[agility](3)。如果你检定失败，受到2点伤害，失去你控制的所有[[探险]]支援的控制权(放到你所在地点)，并移动到你下方紧挨着的地点。
```

## 08613 · Hypothermia / 低温症
- 行号：src/cards/cards-data.js:301767（name/nameZh） · src/cards/cards-data.js:301778（textZh） · src/cards/cards-data.js:301742（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Test [willpower] (3). If the level of your location is 4 or 5, reveal 1 additional chaos token for this skill test. If you fail, either add 1 [frost] token to the chaos bag, or take 1 horror for each point you failed by.
```
- text ZH:
```
显现 - 检定[willpower](3)。如果你所在地点的高度为4或5，本次技能检定额外揭示1个混乱标记。如果你检定失败，在混乱袋里加入1个[frost]标记，或每低于难度1点就受到1点恐惧。
```

## 08614 · Green Soapstone / 绿皂石
- 行号：src/cards/cards-data.js:301825（name/nameZh） · src/cards/cards-data.js:301837（textZh） · src/cards/cards-data.js:301795（backTextZh）
- pack=eoec · type=asset · subname=Jinxed Idol / 不详象征
- traits: Item / Expedition  ||  道具 / 探险
- text EN:
```
Uses (4 charges).
[reaction] When you perform a successful attack, spend 1 charge and exhaust Green Soapstone: Deal +1 damage for that attack.
```
- text ZH:
```
使用(4充能)。
[reaction]在你执行一次成功的攻击时，花费1充能并横置绿皂石：这次攻击造成+1伤害。
```

## 08615 · Wooden Sledge / 木制雪撬
- 行号：src/cards/cards-data.js:301886（name/nameZh） · src/cards/cards-data.js:301897（textZh） · src/cards/cards-data.js:301856（backTextZh）
- pack=eoec · type=asset
- traits: Item / Expedition  ||  道具 / 探险
- text EN:
```
[action] Exhaust Wooden Sledge: An investigator at this location searches the top 6 cards of their deck for up to 3 non-weakness [[Item]] or [[Supply]] cards and attaches them facedown to Wooden Sledge. Shuffle their deck.
While Wooden Sledge is under an investigator's control, facedown cards attached to it may be played as if they were in the hand of any investigator at its location.
```
- text ZH:
```
[action]横置木制雪撬：位于本地点的一位调查员查找其牌库顶的6张卡牌，找出最多3张非弱点[[道具]]或[[供给]]卡牌，正面朝下附属到木制雪撬。混洗其牌库。
木制雪撬在调查员控制下时，正面朝下附属在木制雪橇的卡牌可以被打出，如同该卡牌在该地点任意一位调查员手中。
```

## 08616 · Dynamite / 炸药
- 行号：src/cards/cards-data.js:301946（name/nameZh） · src/cards/cards-data.js:301957（textZh） · src/cards/cards-data.js:301916（backTextZh）
- pack=eoec · type=asset
- traits: Item / Expedition  ||  道具 / 探险
- text EN:
```
Uses (2 supplies).
[action] Spend 1 supply and exhaust Dynamite: Choose either your location or a connecting location. Deal 3 damage to each enemy and investigator at the chosen location.
```
- text ZH:
```
使用(2补给)。
[action]花费1补给并横置炸药：选择你所在地点或一个连接地点。对所选地点的每个敌人和每位调查员各造成3点伤害。
```

## 08617 · Miasmic Crystal / 瘴气水晶
- 行号：src/cards/cards-data.js:302006（name/nameZh） · src/cards/cards-data.js:302018（textZh） · src/cards/cards-data.js:301976（backTextZh）
- pack=eoec · type=asset · subname=Strange Evidence / 奇怪证据
- traits: Item / Relic / Expedition  ||  道具 / 遗物 / 探险
- text EN:
```
Uses (3 charges).
[reaction] When an investigator at your location draws a Tekeli-li weakness, spend 1 charge: That investigator cancels the effects of that weakness, places it on the bottom of the Tekeli-li deck, and draws 1 card.
```
- text ZH:
```
使用(3充能)。
[reaction]在一位你所在地点的调查员抽取到一张忒咳哩-哩弱点时，花费1充能：该调查员取消该弱点的效果，将其放到忒咳哩-哩牌库底，并抽取1张卡牌。
```

## 08618 · Mineral Specimen / 矿物标本
- 行号：src/cards/cards-data.js:302069（name/nameZh） · src/cards/cards-data.js:302080（textZh） · src/cards/cards-data.js:302039（backTextZh）
- pack=eoec · type=asset
- traits: Item / Relic / Expedition  ||  道具 / 遗物 / 探险
- text EN:
```
Uses (3 charges).
[action] Spend 1 charge: Investigate. Investigate with a base [intellect] skill of 5. Cancel each [frost] token revealed during this test. If you succeed, discover 1 additional clue at your location.
```
- text ZH:
```
使用(3充能)。
[action]花费1充能：调查。以基础值为5的[intellect]调查。取消本次检定期间揭示的所有[frost]标记。如果你检定成功，发现你所在地点额外1个线索。
```

## 08619 · Small Radio / 小型收音机
- 行号：src/cards/cards-data.js:302131（name/nameZh） · src/cards/cards-data.js:302142（textZh） · src/cards/cards-data.js:302101（backTextZh）
- pack=eoec · type=asset
- traits: Item / Expedition  ||  道具 / 探险
- text EN:
```
Uses (3 supplies).
You may trigger abilities on assets from the Expedition Team encounter set that are not in play, but whose names are not crossed off in the Campaign Log. Instead of paying that ability's non-[action] costs, exhaust Small Radio and spend 1 supply.
```
- text ZH:
```
使用(3补给)。
你可以触发不在场上的探险队遭遇组的支援上的能力(仅限在剧本日志中没有划掉名字的支援)。不支付该能力的非[action]费用，改为横置小型收音机并花费1补给。
```

## 08620 · Spare Parts / 备用零件
- 行号：src/cards/cards-data.js:302191（name/nameZh） · src/cards/cards-data.js:302202（textZh） · src/cards/cards-data.js:302161（backTextZh）
- pack=eoec · type=asset
- traits: Item / Expedition  ||  道具 / 探险
- text EN:
```
Uses (3 supplies).
[fast] Spend 1 supply and exhaust Spare Parts: Add 1 supply to another asset at your location, or choose an investigator at your location to gain 1 resource.
```
- text ZH:
```
使用(3补给)。
[free]花费1补给并横置备用零件：在你所在地点的另一个支援上放置1补给，或者选择你所在地点的一位调查员获得1资源。
```

## 08621 · City of the Elder Things / 古老者之城
- 行号：src/cards/cards-data.js:302246（name/nameZh） · src/cards/cards-data.js:302257（textZh） · src/cards/cards-data.js:302221（backTextZh）
- pack=eoec · type=scenario
- text EN:
```
Easy / Standard
[skull]: -X. X is the number of keys you control.
[cultist]: -2. If you fail, place a key you control on your location.
[tablet]: -3. If a [frost] token was revealed during this test, you automatically fail, instead.
[elder_thing]: -4. If you fail, the nearest enemy moves once toward you. If it is engaged with you, it attacks.
```
- text ZH:
```
简单/ 普通
[skull]：-X。X为你控制的钥匙的数量。
[cultist]：-2。如果你检定失败，将你控制的一个钥匙放到你所在地点。
[tablet]：-3。如果本次检定期间揭示了[frost]标记，改为你自动失败。
[elder_thing]：-4。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。
```
- backText EN:
```
Hard / Expert
[skull]: -X. X is 2 plus the number of keys you control.
[cultist]: -2. Place a key you control on your location.
[tablet]: -4. If a [frost] token was revealed during this test, take 1 damage and you automatically fail, instead.
[elder_thing]: -5. If you fail, the nearest enemy moves once toward you. If it is engaged with you, it attacks.
```
- backText ZH:
```
困难/专家
[skull]：-X。X为你控制的钥匙的数量加2。
[cultist]：-2。将你控制的一个钥匙放到你所在地点。
[tablet]：-4。如果本次检定期间揭示了[frost]标记，改为你受到1点伤害且自动失败。
[elder_thing]：-5。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。
```

## 08622 · Lurking Horrors / 恐惧潜伏
- 行号：src/cards/cards-data.js:302300（name/nameZh） · src/cards/cards-data.js:302312（textZh） · src/cards/cards-data.js:302272（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
[fast] During your turn, spend 1 clue: Look at the revealed side of a City Landscape in your column or row. (Limit once per round.)
[fast] During your turn, spend 3 clues: Move to any location in your column or row. (Limit once per round.)
```
- text ZH:
```
[free]在你回合期间，花费1个线索：查看你所在行或列的一个城市景观的已揭示面。(每轮仅限一次。)
[free]在你回合期间，花费3个线索：移动到你所在行或列的任意地点。(每轮仅限一次。)
```
- backText EN:
```
Read Scenario Interlude: Gaze into Madness in the Campaign Log.
```
- backText ZH:
```
阅读剧本手册中的冒险幕间故事：凝视疯狂。
```
- flavor EN:
```
The hidden alien city looms before you, ancient and enigmatic. What secrets - and terrors - lie in wait within?
```
- flavor ZH:
```
古老而神秘的城市在你面前隐现，里面有着怎样的秘密——和恐怖——在等待着你呢？
```
- backFlavor EN:
```
The walls of the city call to you in surreptitious whispers, ethereal songs indecipherable to human ears, and yet somehow familiar all the same. You try your best to shut them out, to make believe it is just your imagination, but not all of your companions are as successful...
```
- backFlavor ZH:
```
城市的城墙偷偷呼唤着你，这是人类耳朵听不懂的空灵歌曲，但不知怎么的，却还是那么熟悉。你尽全力让声音不进入脑海，假装这只是你的想像，但你的所有同伴并非都能成功……
```

## 08623 · Doom from Below / 自下而来的毁灭
- 行号：src/cards/cards-data.js:302355（name/nameZh） · src/cards/cards-data.js:302367（textZh） · src/cards/cards-data.js:302327（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
[fast] During your turn, spend 1 clue: Look at the revealed side of a City Landscape in your column or row. (Limit once per round.)
[fast] During your turn, spend 3 clues: Move to any location in your column or row. (Limit once per round.)
```
- text ZH:
```
[free]在你回合期间，花费1个线索：查看你所在行或列的一个城市景观的已揭示面。(每轮仅限一次。)
[free]在你回合期间，花费3个线索：移动到你所在行或列的任意地点。(每轮仅限一次。)
```
- backText EN:
```
(→R2)
```
- backText ZH:
```
(→结局2)
```
- flavor EN:
```
Below the darkened ice, more of the city lies trapped, encased and frozen in time. This is but the tip of the iceberg...
```
- flavor ZH:
```
在黑暗的冰层下，城市更多部分都被困在那里，冰封于时间的长河中。这只是冰山一角……
```
- backFlavor EN:
```
Your thoughts become convoluted, a tangle of fear, worry, and doubt. Danger lurks around every corner of this abominable place, but most dangerous of all is the growing feeling that you should not be here - that you should flee from this place and never return.
As the weather outside turns foul, you hole up in the relative safety of one of the city's towering structures. It is too late to return to camp. Your only hope is to take shelter within the alien city, hoping your presence goes unnoticed by the denizens that still prowl through its streets and ancient halls.
```
- backFlavor ZH:
```
你的想法变得错综复杂，恐惧、担心和怀疑交织在一起。危险潜伏在这个令人厌恶的地方每一个角落，但最危险的是，你越来越觉得你不应该呆在这里——你应该逃离这个地方，永远不要回来。
当外面的天气变坏时，你躲在这座城市高楼中相对安全的一个地方。现在已经太迟了，没法回营地了。你唯一的希望是在这个城市中避难，祈祷你的存在不会被仍然徘徊在它的街道和古老大厅里的居民注意到。
```

## 08624 · Sprawling City (v. I) / 错综复杂之城(版本一)
- 行号：src/cards/cards-data.js:302409（name/nameZh） · src/cards/cards-data.js:302421（textZh） · src/cards/cards-data.js:302382（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] Spend two [elder_thing] keys: Remember that the team "studied the history of the Elder Things."
[action] Spend two [tablet] keys: Remember that the team "discerned the origin of the Shoggoths."
Objective - If the team has "studied the history of the Elder Things" and "discerned the origin of the Shoggoths," advance.
```
- text ZH:
```
[action]花费2个[elder_thing]钥匙：请记住队伍“研究了古老者的历史”。
[action]花费2个[tablet]钥匙：请记住队伍“了解了修格斯的起源”。
目标 - 如果队伍“研究了古老者的历史”且“了解了修格斯的起源”，推进场景。
```
- backText EN:
```
Shuffle the set-aside Shoggoths encounter set and the encounter discard pile into the encounter deck.
You know the route into the undercity. Reveal the Hidden Tunnel.
Put the set-aside Terror of the Stars enemy into play at the Hidden Tunnel, exhausted.
```
- backText ZH:
```
将放在一边的修格斯遭遇组和遭遇弃牌库混洗入遭遇牌库。
你知道去地下城市的通路。揭示隐秘隧道。
将放在一边的星之恐怖敌人放置入场，位于隐秘隧道，处于横置状态。
```
- flavor EN:
```
This is the discovery of a lifetime. Dyer's report was true - all of it. You must explore this alien civilization in order to learn more...
```
- flavor ZH:
```
这是一生难得的发现。戴尔的报告是真的——全部内容都是。你必须探索这个异星文明，以便了解更多……
```
- backFlavor EN:
```
What you have found is almost too wild to believe. According to the murals and records within the city, the "Elder Things" were travelers from the stars. They colonized the Earth long before the time of humanity, settling far and wide. And deep in the undercity beneath the tallest mountain, they created monstrous creatures - "Shoggoths" - to be their servants. But the Shoggoths rebelled against them and soon their civilization collapsed...
Suddenly, a distant noise stops you and the other explorers in their tracks: a deep, bellowing roar that seems to come from somewhere far below. You dare not ponder what kind of monstrosity could have made such a hideous sound.
```
- backFlavor ZH:
```
你的发现简直太疯狂了，让人难以置信。根据城里的壁画和记录，“古老者”是来自繁星的旅者。早在人类出现之前，它们就在地球上殖民，定居范围非常宽广。在最高山脉下的地下城市深处，它们创造了怪异生物——“修格斯”——作为它们的仆人。但修格斯反抗了它们，它们的文明很快就崩溃了……
突然，远处传来声音阻止了你和其他探险者的脚步：一种低沉的咆哮声，似乎来自下面远处的某个地方。你不敢想像是什么样的怪物会发出如此可怕的声音。
```

## 08625 · Sprawling City (v. II) / 错综复杂之城(版本二)
- 行号：src/cards/cards-data.js:302463（name/nameZh） · src/cards/cards-data.js:302475（textZh） · src/cards/cards-data.js:302436（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] Spend two [elder_thing] keys: Remember that the team "studied the history of the Elder Things."
[action] Spend two [cultist] keys: Remember that the team "discovered a hidden power."
Objective - If the team has "studied the history of the Elder Things" and "discovered a hidden power," advance.
```
- text ZH:
```
[action]花费2个[elder_thing]钥匙：请记住队伍“研究了古老者的历史”。
[action]花费2个[cultist]钥匙：请记住队伍“发现了隐藏的力量”。
目标 - 如果队伍“研究了古老者的历史”且“发现了隐藏的力量”，推进场景。
```
- backText EN:
```
Shuffle the set-aside Creatures in the Ice encounter set and the encounter discard pile into the encounter deck.
You know the route into the undercity. Reveal the Hidden Tunnel.
Add 1 [frost] token to the chaos bag.
```
- backText ZH:
```
将放在一边的冰中生物遭遇组和遭遇弃牌库混洗入遭遇牌库。
你知道去地下城市的通路。揭示隐秘隧道。
在混乱袋里加入1个[frost]标记。
```
- flavor EN:
```
This is the discovery of a lifetime. Dyer's report was true - all of it. You must explore this alien civilization in order to learn more...
```
- flavor ZH:
```
这是一生难得的发现。戴尔的报告是真的——全部内容都是。你必须探索这个异星文明，以便了解更多……
```
- backFlavor EN:
```
What you have found is almost too wild to believe. According to the murals and records within the city, the "Elder Things" were travelers from the stars. They colonized the Earth long before the time of humanity, settling far and wide. And deep in the undercity beneath the tallest mountain, they found a dormant, primordial power - something so terrifying, they built a gateway to seal it within. But eventually, it began to escape, and their civilization collapsed...
There must be even more preposterous secrets buried deep below. You have to learn the truth of this ancient power, and in order to do so, you must find the secret passageway that will lead you deeper into the heart of the mountain.
```
- backFlavor ZH:
```
你的发现简直太疯狂了，让人难以置信。根据城里的壁画和记录，“古老者”是来自繁星的旅者。早在人类出现之前，它们就在地球上殖民，定居范围非常宽广。在最高山脉下的地下城市深处，它们发现了一种蛰伏中的远古力量——这种力量如此可怕，它们建造了一个大门，将其封印在里面。但最终，它开始逃脱，它们的文明崩溃了……
一定还有更荒谬的秘密埋藏在地下深处。你打算一定要了解这种古老力量的真相，而为此，你必须找到能把你引导到大山深处的秘密通道。
```

## 08626 · Sprawling City (v. III) / 错综复杂之城(版本三)
- 行号：src/cards/cards-data.js:302517（name/nameZh） · src/cards/cards-data.js:302529（textZh） · src/cards/cards-data.js:302490（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] Spend two [tablet] keys: Remember that the team "discerned the origin of the Shoggoths."
[action] Spend two [cultist] keys: Remember that the team "discovered a hidden power."
Objective - If the team has "discerned the origin of the Shoggoths" and "discovered a hidden power," advance.
```
- text ZH:
```
[action]花费2个[tablet]钥匙：请记住队伍“了解了修格斯的起源”。
[action]花费2个[cultist]钥匙：请记住队伍“发现了隐藏的力量”。
目标 - 如果队伍“了解了修格斯的起源”且“发现了隐藏的力量”，推进场景。
```
- backText EN:
```
Shuffle the set-aside Shoggoths encounter set and the encounter discard pile into the encounter deck.
You know the route into the undercity. Reveal the Hidden Tunnel.
In player order, each investigator draws 1 card from the top of the encounter deck.
```
- backText ZH:
```
将放在一边的修格斯遭遇组和遭遇弃牌库混洗入遭遇牌库。
你知道去地下城市的通路。揭示隐秘隧道。
按玩家顺序，每位调查员抽取遭遇牌库顶的1张卡牌。
```
- flavor EN:
```
This is the discovery of a lifetime. Dyer's report was true - all of it. You must explore this alien civilization in order to learn more...
```
- flavor ZH:
```
这是一生难得的发现。戴尔的报告是真的——全部内容都是。你必须探索这个异星文明，以便了解更多……
```
- backFlavor EN:
```
What you have found is almost too wild to believe. According to the murals and records within the city, a race of monstrous creatures known as "Shoggoths" were created to serve the masters of this city. The Shoggoths were sent deep into the undercity beneath the tallest mountain, where they would construct a gateway to seal some dormant, primordial power, something so terrifying even the Shoggoths' masters feared it. But the Shoggoths rebelled against them and let the seal decay, leading to the collapse of this ancient civilization...
Suddenly, a distant noise stops you and the other explorers in their tracks: a deep, bellowing roar that seems to come from somewhere far below. You dare not ponder what kind of monstrosity could have made such a hideous sound.
```
- backFlavor ZH:
```
你的发现简直太疯狂了，让人难以置信。根据这座城市的壁画和记录，一个被称为“修格斯”的怪物种族被创造出来为这座城市的主人服务。修格斯被派遣到最高山脉下的地下城深处，在那里它们将建造一个大门来封印某种蛰伏中的远古力量，这种力量是如此可怕，以至于修格斯的主人都害怕它。但修格斯反抗了主人，让封印衰弱，导致了这个古老文明的崩溃……
突然，远处传来声音阻止了你和其他探险者的脚步：一种低沉的咆哮声，似乎来自下面远处的某个地方。你不敢想像是什么样的怪物会发出如此可怕的声音。
```

## 08627 · Pursuit of the Unknown (v. I) / 追寻未知(版本一)
- 行号：src/cards/cards-data.js:302571（name/nameZh） · src/cards/cards-data.js:302583（textZh） · src/cards/cards-data.js:302544（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] Spend two [cultist] keys: Each investigator may heal 1 damage, 1 horror, and 1 trauma.
Objective - If each undefeated investigator is at the Hidden Tunnel and it has no clues, advance.
```
- text ZH:
```
[action]花费2个[cultist]钥匙：每位调查员可以治愈1点伤害、1点恐惧和1点创伤。
目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
Somewhere in this sprawling web of icy streets and cyclopean structures lies an ancient gateway leading to the undercity beneath the great mountain. You'll have to find it if you wish to learn more...
```
- flavor ZH:
```
在这个由结冰的街道和巨大建筑构成的庞大网络某处，有一个通往宏伟山脉底下的地下城市的古老大门。如果你想了解更多的话，你必须找到它……
```
- backFlavor EN:
```
The path, now clear, leads into a labyrinth of dark, treacherous tunnels. For good or ill, your rigorous journey is coming to an end. Taking a deep breath, you gather your courage and delve into the depths of the mountain.
```
- backFlavor ZH:
```
已经探明的前路通向迷宫般黑暗而危险的隧道。无论好坏，你的艰难旅程即将结束。你深呼吸，鼓起勇气，一头钻进山脉深处。
```

## 08628 · Pursuit of the Unknown (v. II) / 追寻未知(版本二)
- 行号：src/cards/cards-data.js:302625（name/nameZh） · src/cards/cards-data.js:302637（textZh） · src/cards/cards-data.js:302598（backTextZh）
- pack=eoec · type=act
- text EN:
```
[action] Spend two [tablet] keys: Each investigator searches their deck for each Tekeli-li weakness, shuffles each of them into the Tekeli-li deck, then shuffles their deck.
Objective - If each undefeated investigator is at the Hidden Tunnel and it has no clues, advance.
```
- text ZH:
```
[action]花费2个[tablet]钥匙：每位调查员查找各自牌库，找出所有忒咳哩-哩弱点，将这些弱点混洗入忒咳哩-哩牌库，然后混洗各自牌库。
目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
Somewhere in this sprawling web of icy streets and cyclopean structures lies an ancient gateway leading to the undercity beneath the great mountain. You'll have to find it if you wish to learn more...
```
- flavor ZH:
```
在这个由结冰的街道和巨大建筑构成的庞大网络某处，有一个通往宏伟山脉底下的地下城市的古老大门。如果你想了解更多的话，你必须找到它……
```
- backFlavor EN:
```
The path, now clear, leads into a labyrinth of dark, treacherous tunnels. For good or ill, your rigorous journey is coming to an end. Taking a deep breath, you gather your courage and delve into the depths of the mountain.
```
- backFlavor ZH:
```
已经探明的前路通向迷宫般黑暗而危险的隧道。无论好坏，你的艰难旅程即将结束。你深呼吸，鼓起勇气，一头钻进山脉深处。
```

## 08629 · Pursuit of the Unknown (v. III) / 追寻未知(版本三)
- 行号：src/cards/cards-data.js:302679（name/nameZh） · src/cards/cards-data.js:302691（textZh） · src/cards/cards-data.js:302652（backTextZh）
- pack=eoec · type=act
- text EN:
```
Forced - When a [[Shoggoth]] or [[Elite]] enemy enters a location: Defeat each [[Elder Thing]] enemy at that location.
[action] Spend two [elder_thing] keys: Remove each [elder_thing] token from the chaos bag.
Objective - If each undefeated investigator is at the Hidden Tunnel and it has no clues, advance.
```
- text ZH:
```
强制 - 在一个[[修格斯]]或[[精英]]敌人进入一个地点时：击败该地点的所有[[古老者]]敌人。
[action]花费2个[elder_thing]钥匙：从混乱袋里移除所有[elder_thing]标记。
目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
Somewhere in this sprawling web of icy streets and cyclopean structures lies an ancient gateway leading to the undercity beneath the great mountain. You'll have to find it if you wish to learn more...
```
- flavor ZH:
```
在这个由结冰的街道和巨大建筑构成的庞大网络某处，有一个通往宏伟山脉底下的地下城市的古老大门。如果你想了解更多的话，你必须找到它……
```
- backFlavor EN:
```
The path, now clear, leads into a labyrinth of dark, treacherous tunnels. For good or ill, your rigorous journey is coming to an end. Taking a deep breath, you gather your courage and delve into the depths of the mountain.
```
- backFlavor ZH:
```
已经探明的前路通向迷宫般黑暗而危险的隧道。无论好坏，你的艰难旅程即将结束。你深呼吸，鼓起勇气，一头钻进山脉深处。
```

## 08630 · Hidden Tunnel / 隐秘隧道
- 行号：src/cards/cards-data.js:302732（name/nameZh） · src/cards/cards-data.js:302744（textZh） · src/cards/cards-data.js:302705（backTextZh）
- pack=eoec · type=location · subname=Entrance to the Depths / 深渊入口
- traits: City  ||  城市
- text EN:
```
Clues on Hidden Tunnel cannot be discovered or moved to other locations.
[action]: Test a skill of your choice (4). You may spend a [skull] key to get +5 skill value for this test. If you succeed, return 1 clue on Hidden Tunnel to the token pool (2 clues instead if you spent a [skull] key).
```
- text ZH:
```
隐秘隧道上的线索不能被发现或移动到其他地点。
[action]：任选一项技能检定(4)。你可以花费一个[skull]钥匙来使你本次检定得到技能值+5。如果你检定成功，将隐秘隧道上的1个线索返回到供应堆(如果你花费了一个[skull]钥匙，改为2个线索)。
```
- backText EN:
```
The passageway into the undercity is hidden. You cannot enter the Hidden Tunnel.
```
- backText ZH:
```
进入地下城市的通道被隐藏了。你不能进入隐秘隧道。
```
- backFlavor EN:
```
"...our study of the decadent sculptures brought about a change in our immediate objective. This of course had to do with the chiselled avenues to the black inner world, of whose existence we had not known before...."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“……我们对堕落雕画的研究使我们的当前目标发生了变化。这当然与开凿的通往黑暗内部世界的通道有关，而我们以前并不知道它的存在……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08631 · Ancient Planetarium / 古代天文馆
- 行号：src/cards/cards-data.js:302791（name/nameZh） · src/cards/cards-data.js:302803（textZh） · src/cards/cards-data.js:302764（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action] Spend two "0" keys: Add one of the spent "0" keys to the chaos bag (as a chaos token) for the remainder of the campaign. Record in the Campaign Log the team photographed the astronomical charts.
```
- text ZH:
```
[action]花费2个“0”钥匙：直到剧本结束，在混乱袋里加入花费的其中一个“0”钥匙(作为一个混乱标记)。在剧本日志中记录队伍拍摄了天文图的照片。
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08632 · Stone Bridge / 石桥
- 行号：src/cards/cards-data.js:302850（name/nameZh） · src/cards/cards-data.js:302862（textZh） · src/cards/cards-data.js:302822（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action]: Test [combat] (4) or [agility] (4). If you succeed, discover 1 clue from Stone Bridge.
[action]: Move to another Stone Bridge location.
```
- text ZH:
```
[action]：检定[combat](4)或[agility](4)。如果你检定成功，发现石桥的1个线索。
[action]：移动到另一个石桥地点。
```
- flavor EN:
```
"All of these febrile structures seemed knit together by tubular bridges crossing from one to the other at various dizzy heights..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“所有这些狂乱建筑似乎都被在各种令人晕眩的高度的管状桥连接在了一起……”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08633 · Cylindrical Tower / 圆柱塔
- 行号：src/cards/cards-data.js:302908（name/nameZh） · src/cards/cards-data.js:302920（textZh） · src/cards/cards-data.js:302881（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action] Spend two "-2" keys: Draw 2 cards, gain 2 resources, and remove 2 [frost] tokens from the chaos bag. Record in the Campaign Log the team studied the mural carvings.
```
- text ZH:
```
[action]花费2个“-2”钥匙：抽取2张卡牌，获得2资源，并从混乱袋里移除2个[frost]标记。在剧本日志中记录队伍研究了壁画雕刻。
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08634 · Labyrinthine Chamber / 迷宫房间
- 行号：src/cards/cards-data.js:302966（name/nameZh） · src/cards/cards-data.js:302978（textZh） · src/cards/cards-data.js:302939（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
Each time a chaos token is revealed during a skill test at this location, double its modifier if a key matching that chaos token is on this location or under the control of an investigator at this location.
```
- text ZH:
```
在本地点的技能检定期间，每次揭示混乱标记，如果本地点上的钥匙或者本地点一位调查员控制的钥匙与该混乱标记一致，将该混乱标记的修正值翻倍。
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08635 · Map Room / 地图资料室
- 行号：src/cards/cards-data.js:303025（name/nameZh） · src/cards/cards-data.js:303037（textZh） · src/cards/cards-data.js:302998（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action] Spend two "-3" keys: Choose 3 locations other than Hidden Tunnel and reveal them. Discover 1 clue from each of these locations. Record in the Campaign Log the team read the map.
```
- text ZH:
```
[action]花费2个“-3”钥匙：选择并揭示3个隐秘隧道以外的地点。(FAQ，v2.1)在这些地点中每个地点各发现1个线索。在剧本日志中记录队伍查看了地图。
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08636 · Roofless Rampart / 无顶堡垒
- 行号：src/cards/cards-data.js:303084（name/nameZh） · src/cards/cards-data.js:303096（textZh） · src/cards/cards-data.js:303056（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action] Spend two "-1" keys: Either remove 1 doom from the agenda, or choose and discard from play 1 non-[[Elite]] enemy or treachery. Record in the Campaign Log the team discovered an ancient vault.
```
- text ZH:
```
[action]花费2个“-1”钥匙：移除密谋上的1个毁灭标记，或者选择并弃掉场上1个非[[精英]]敌人或诡计。在剧本日志中记录队伍发现了一个古代墓穴。
```
- flavor EN:
```
"...farther on there was a huge roofless rampart still complete in its gigantic five-pointed outline..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……再往前走，有一座巨大的无顶堡垒，它那巨大的五角形轮廓仍然完整无缺……”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08637 · Ruinous Streets / 破败街道
- 行号：src/cards/cards-data.js:303142（name/nameZh） · src/cards/cards-data.js:303154（textZh） · src/cards/cards-data.js:303115（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
Forced - After you reveal 1 or more [frost] tokens during a skill test at Ruinous Streets: Take 1 damage.
[reaction] After you discover the last clue from Ruinous Streets: Discover 1 clue on a connecting location.
```
- text ZH:
```
强制 - 当你在破败街道的技能检定期间揭示1个或更多[frost]混乱标记后：受到1点伤害。
[reaction]你发现破败街道上最后的线索后：发现一个连接地点的1个线索。
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08638 · Cyclopean Spires / 巨大尖顶
- 行号：src/cards/cards-data.js:303201（name/nameZh） · src/cards/cards-data.js:303213（textZh） · src/cards/cards-data.js:303173（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action]: Move 1 key on another location in this row to Cyclopean Spires. (Group limit once per game.)
```
- text ZH:
```
[action]：将本行另一个地点的1个钥匙移动到巨大尖顶。(团队每场游戏仅限一次)
```
- flavor EN:
```
"There were composite cones and pyramids either alone or surmounting cylinders or cubes or flatter truncated cones and pyramids, and occasional needle-like spires in curious clusters..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“那儿混合着圆锥体和角锥体，有的是单独的，也有顶端是圆柱体或立方体或更平坦的圆锥体和角锥体，偶尔还会有奇怪的成群针状尖顶……”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08639 · Submerged Passageway / 埋没通路
- 行号：src/cards/cards-data.js:303260（name/nameZh） · src/cards/cards-data.js:303272（textZh） · src/cards/cards-data.js:303232（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
[action]: Move 1 clue from this location to an unrevealed location in this column or row.
```
- text ZH:
```
[action]：将本地点上的1个线索移动到本行或本列的一个未揭示的地点。
```
- flavor EN:
```
"Had the coming of the ice been foreseen, and had a nameless population left en masse to seek a less doomed abode?"
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“难道是预见到了冰雪的来临，所以全体离开去寻找一个不那么危险的地方？”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08640 · Temple of the Elder Things / 古老者之庙
- 行号：src/cards/cards-data.js:303318（name/nameZh） · src/cards/cards-data.js:303330（textZh） · src/cards/cards-data.js:303291（backTextZh）
- pack=eoec · type=location
- traits: City  ||  城市
- text EN:
```
Forced - After you reveal 1 or more [frost] tokens during a skill test at this location: Take 1 horror.
[action] If there are no clues on Temple of the Elder Things: Choose 2 locations with keys on them. Swap each key on those locations. (Group limit once per game.)
```
- text ZH:
```
强制 - 当你在本地点的一次技能检定期间揭示1个或更多[frost]混乱标记后：受到1点恐惧。
[action]如果古老者之庙没有线索：选择2个有钥匙的地点。交换这些地点的所有钥匙。(团队每场游戏仅限一次)
```
- backFlavor EN:
```
"Yet now the sway of reason seemed irrefutably shaken, for this Cyclopean maze of squared, curved, and angled blocks had features which cut off all comfortable refuge. It was, very clearly, the blasphemous city of the mirage in stark, objective, and ineluctable reality."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“但现在这令人信服的理由似乎已无可辩驳地动摇了，因为这个由方形、弧形和有棱角的石块组成的巨大迷宫拥有的特征把一切舒适的退路都切断了。很明显，幻景中那座亵渎之城是赤裸裸的、客观的、无可逃避的现实。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08641 · Terror of the Stars / 星之恐怖
- 行号：src/cards/cards-data.js:303377（name/nameZh） · src/cards/cards-data.js:303389（textZh） · src/cards/cards-data.js:303347（backTextZh）
- pack=eoec · type=enemy · subname=Bane of the Elder Things / 古老者之祸
- traits: Monster / Eidolon / Elite  ||  怪物 / 幻灵 / 精英
- text EN:
```
Hunter. Massive.
Terror of the Stars gets +3 [per_investigator] health.
While Terror of the Stars is ready, investigators at its location cannot spend or take control of keys.
```
- text ZH:
```
猎手。庞大。
星之恐怖得到+3[per_investigator]生命值。
星之恐怖处于重整状态时，位于星之恐怖所在地点的调查员不能花费或控制钥匙。
```

## 08642 · Benign Elder Thing / 和蔼的古老者
- 行号：src/cards/cards-data.js:303441（name/nameZh） · src/cards/cards-data.js:303452（textZh） · src/cards/cards-data.js:303411（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Elder Thing  ||  怪物 / 古老者
- text EN:
```
Spawn - Any empty location.
Benign Elder Thing enters play with 1 doom on it.
Forced - When Benign Elder Thing is defeated: Place 1 doom on the agenda.
[action]: Parley. Test [willpower] (3). If you succeed, remove Benign Elder Thing from the game.
```
- text ZH:
```
生成 - 任意无人地点。
和蔼的古老者入场带有1个毁灭标记。
强制 - 在和蔼的古老者被击败时：在当前密谋上放置1个毁灭标记。
[action]：谈判。检定[willpower](3)。如果你检定成功，将和蔼的古老者从游戏中移除。
```

## 08643 · Reawakened Elder Thing / 复苏的古老者
- 行号：src/cards/cards-data.js:303501（name/nameZh） · src/cards/cards-data.js:303512（textZh） · src/cards/cards-data.js:303471（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Elder Thing  ||  怪物 / 古老者
- text EN:
```
Hunter.
Forced - When this enemy engages you: Place a key you control on it. When it leaves play, place that key on its location.
Forced - When an investigator at this enemy's location takes control of a key: This enemy readies, engages, and attacks them.
```
- text ZH:
```
猎手。
强制 - 在本敌人与你交战时：将你控制的一个钥匙放到本敌人上。在本敌人离场时，将该钥匙放在本敌人所在地点。
强制 - 在本敌人所在地点的一位调查员控制一个钥匙时：本敌人重整，与该调查员交战，并攻击该调查员。
```

## 08644 · Dawning of the Truth / 真相开端
- 行号：src/cards/cards-data.js:303556（name/nameZh） · src/cards/cards-data.js:303567（textZh） · src/cards/cards-data.js:303531（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Test [willpower] (2). Increase the difficulty of this test by 1 for each key on your location or under your control. If you fail, take 2 horror (3 horror instead if you fail by 3 or more).
```
- text ZH:
```
显现 - 检定[willpower](2)。本次检定难度值增加你所在地点和你控制的钥匙数之和。如果你检定失败，受到2点恐惧(如果你检定失败且低于难度至少3点，改为3点恐惧)。
```

## 08645 · Crumbling Ruins / 崩塌废墟
- 行号：src/cards/cards-data.js:303609（name/nameZh） · src/cards/cards-data.js:303620（textZh） · src/cards/cards-data.js:303584（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Test [agility] (3). During this test, if you reveal a chaos token that matches a key on your location or under the control of an investigator at your location, you automatically fail. For each point you fail by, take 1 damage.
```
- text ZH:
```
显现 - 检定[agility](3)。本次检定期间，如果你揭示了一个与你所在地点上的钥匙或者你所在地点一位调查员控制的钥匙一致的混乱标记，你自动失败。你检定失败且每低于难度1点，受到1点伤害。
```

## 08646 · Frostbitten / 冻伤
- 行号：src/cards/cards-data.js:303663（name/nameZh） · src/cards/cards-data.js:303675（textZh） · src/cards/cards-data.js:303637（backTextZh）
- pack=eoec · type=treachery
- traits: Injury  ||  损伤
- text EN:
```
Revelation - Put Frostbitten into play in your threat area.
Frostbitten can be healed as if it were a single point of damage on you (if it is healed, discard it).
Forced - When you reveal a [frost] token during a skill test: You must either take 1 damage or you automatically fail this test. (Limit once per test.)
```
- text ZH:
```
显现 - 将冻伤放置入场，放到你的威胁区域。
冻伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
强制 - 你在技能检定期间揭示[frost]混乱标记时：你必须受到1点伤害或本次检定自动失败。(每次检定仅限一次。)
```

## 08647 · Possessed / 附身
- 行号：src/cards/cards-data.js:303718（name/nameZh） · src/cards/cards-data.js:303730（textZh） · src/cards/cards-data.js:303692（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Put Possessed into play in your threat area.
Possessed can be healed as if it were a single point of horror on you (if it is healed, discard it).
Forced - When you reveal a [frost] token during a skill test: You must either take 1 horror or you automatically fail this test. (Limit once per test.)
```
- text ZH:
```
显现 - 将附身放置入场，放到你的威胁区域。
附身可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
强制 - 你在技能检定期间揭示[frost]混乱标记时：你必须受到1点恐惧或本次检定自动失败。(每次检定仅限一次。)
```

## 08648 · The Heart of Madness / 疯狂之心
- 行号：src/cards/cards-data.js:303772（name/nameZh） · src/cards/cards-data.js:303783（textZh） · src/cards/cards-data.js:303747（backTextZh）
- pack=eoec · type=scenario
- text EN:
```
Easy / Standard
[skull]: -1 (-3 instead if there is an [[Ancient One]] enemy at your location).
[cultist]: -1. If there is a seal at your location, or if your location is a Mist-Pylon, treat this token as a [frost] token, instead.
[tablet]: -3. If you fail, draw the top card of the Tekeli-li deck.
[elder_thing]: -4. If you fail by 3 or more, place 1 doom on the current agenda. This can cause the current agenda to advance.
```
- text ZH:
```
简单/ 普通
[skull]：-1(如果你所在地点有[[古神]]敌人，改为-3)。
[cultist]：-1。如果你所在地点有封印，或者你所在地点是迷雾高塔，改为将本标记视为[frost]标记。
[tablet]：-3。如果你检定失败，抽取忒咳哩-哩牌库顶的1张卡牌。
[elder_thing]：-4。如果你检定失败且低于难度至少3点，在当前密谋上放置1个毁灭标记。本效果能导致当前密谋推进。
```
- backText EN:
```
Hard / Expert
[skull]: -2 (-4 instead if there is an [[Ancient One]] enemy at your location).
[cultist]: -1. If there is a seal at your location, or if your location is a Mist-Pylon, treat this token as a [frost] token in addition to its modifier.
[tablet]: -3. Draw the top card of the Tekeli-li deck.
[elder_thing]: -5. If you fail by 3 or more, place 1 doom on the current agenda. This can cause the current agenda to advance.
```
- backText ZH:
```
困难/专家
[skull]：-2(如果你所在地点有[[古神]]敌人，改为-4)。
[cultist]：-1。如果你所在地点有封印，或者你所在地点是迷雾高塔，将本标记视为[frost]标记，再-1。
[tablet]：-3。抽取忒咳哩-哩牌库顶的1张卡牌。
[elder_thing]：-5。如果你检定失败且低于难度至少3点，在当前密谋上放置1个毁灭标记。本效果能导致当前密谋推进。
```

## 08649 · The Gate of Y'quaa / 伊夸之门
- 行号：src/cards/cards-data.js:303824（name/nameZh） · src/cards/cards-data.js:303837（textZh） · src/cards/cards-data.js:303797（backTextZh）
- pack=eoec · type=location · subname=Primordial Seal / 远古封印
- traits: Ruins  ||  遗迹
- text EN:
```
[action]: Place an activated seal you control on The Gate of Y'quaa.
[action]: Resign. You retreat, hoping you've done enough to seal away whatever lies beyond the gate. (If you control 1 or more seals, you retain control of them.)
```
- text ZH:
```
[action]：将你控制的一个激活的封印放在伊夸之门上。
[action]：撤退。你撤退了，希望你已经做了足够的工作，能够把大门彼端的东西封印起来(如果你控制着1个或更多封印，你保留它们的控制权)。
```
- backText EN:
```
A wall of churning miasma blocks the ancient gateway. Investigators and enemies cannot enter The Gate of Y'quaa. The Gate of Y'quaa cannot have attachments.
```
- backText ZH:
```
一堵翻滚的瘴气之墙挡住了古老的大门，调查员和敌人不能进入伊夸之门。伊夸之门不能拥有附属。
```
- backFlavor EN:
```
-the black pit - the carven rim - the proto-shoggoths - the windowless solids with five dimensions - the nameless cylinder - the elder pharos - the primal white jelly - the wings - the eyes in darkness - the moon-ladder - the original - the eternal - the undying-
```
- backFlavor ZH:
```
——黑色深坑——洞穴边——原初修格斯——没有窗户的五维实体——无名圆柱——古老灯塔——原始白色胶状物——翅膀——黑暗中的眼睛——登月梯——起源——永恒——不朽——
```

## 08650 · Geothermal Vent / 地热口
- 行号：src/cards/cards-data.js:303883（name/nameZh） · src/cards/cards-data.js:303895（textZh） · src/cards/cards-data.js:303856（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[action] If you control the [seal_a] seal: Test [combat] (3). If you succeed, investigators at Geothermal Vent spend 1 [per_investigator] clues, as a group, to activate the [seal_a] seal. Then, remove 1 [frost] token from the chaos bag.
```
- text ZH:
```
[action]如果你控制[seal_a]封印：检定[combat](3)。如果你检定成功，位于地热口的调查员可以共同花费1[per_investigator]个线索，来激活[seal_a]封印。然后，从混乱袋里移除1个[frost]标记。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08651 · Forsaken Temple / 被遗忘的神庙
- 行号：src/cards/cards-data.js:303941（name/nameZh） · src/cards/cards-data.js:303953（textZh） · src/cards/cards-data.js:303914（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[action] If you control the [seal_c] seal: Test [willpower] (3). If you succeed, investigators at Forsaken Temple spend 1 [per_investigator] clues, as a group, to activate the [seal_c] seal. Then, look at the revealed side of each unrevealed location on the same spoke as Forsaken Temple.
```
- text ZH:
```
[action]如果你控制[seal_c]封印：检定[willpower](3)。如果你检定成功，位于被遗忘的神庙的调查员可以共同花费1[per_investigator]个线索，来激活[seal_c]封印。然后，查看与被遗忘的神庙在同一辐条上的，所有未揭示地点的已揭示面。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08652 · Library of Kós / 寇斯图书馆
- 行号：src/cards/cards-data.js:303999（name/nameZh） · src/cards/cards-data.js:304011（textZh） · src/cards/cards-data.js:303972（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[action] If you control the [seal_b] seal: Test [intellect] (3). If you succeed, investigators at Library of Kós spend 1 [per_investigator] clues, as a group, to activate the [seal_b] seal. Then, look at the revealed side of each unrevealed location on the same ring as Library of Kós.
```
- text ZH:
```
[action]如果你控制[seal_b]封印：检定[intellect](3)。如果你检定成功，位于寇斯图书馆的调查员可以共同花费1[per_investigator]个线索，来激活[seal_b]封印。然后，查看与寇斯图书馆在同一环形上的，所有未揭示地点的已揭示面。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08653 · Protoplasmic Pool / 原生质池
- 行号：src/cards/cards-data.js:304057（name/nameZh） · src/cards/cards-data.js:304069（textZh） · src/cards/cards-data.js:304030（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[action] If you control the [seal_d] seal: Test [agility] (3). If you succeed, investigators at Protoplasmic Pool spend 1 [per_investigator] clues, as a group, to activate the [seal_d] seal. Then, deal 2 damage to each enemy in play.
```
- text ZH:
```
[action]如果你控制[seal_d]封印：检定[agility](3)。如果你检定成功，位于原生质池的调查员可以共同花费1[per_investigator]个线索，来激活[seal_d]封印。然后，对场上所有敌人各造成2点伤害。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08654 · Hall of the Sunless Sea / 无光之海大厅
- 行号：src/cards/cards-data.js:304115（name/nameZh） · src/cards/cards-data.js:304127（textZh） · src/cards/cards-data.js:304088（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[action] If you control the [seal_e] seal, investigators at Hall of the Sunless Sea spend 1 [per_investigator] clues and discard 2 [per_investigator] cards from their hands, as a group: Activate the [seal_e] seal.
```
- text ZH:
```
[action]如果你控制[seal_e]封印，位于无光之海大厅的调查员可以共同花费1[per_investigator]个线索并弃掉2[per_investigator]手牌：激活[seal_e]封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08655 · Subnautical Sprawl / 水下扩张区
- 行号：src/cards/cards-data.js:304173（name/nameZh） · src/cards/cards-data.js:304185（textZh） · src/cards/cards-data.js:304146（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Treat the modifier of the first [frost] token revealed during each skill test at Subnautical Sprawl as -3 instead of -1. (Limit once per round.)
```
- text ZH:
```
在水下扩张区的每次技能检定期间，将揭示的第一个[frost]标记的修正值改为视为-3，而不是-1。(每轮仅限一次。)
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08656 · Vaulted Corridor / 拱形走廊
- 行号：src/cards/cards-data.js:304231（name/nameZh） · src/cards/cards-data.js:304243（textZh） · src/cards/cards-data.js:304204（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast]: Choose another Vaulted Corridor and test [agility] (X). X is the number of locations away that Vaulted Corridor is from this one. If you succeed, move there. (Limit once per round.)
```
- text ZH:
```
[free]：选择另一个拱形走廊并检定[agility](X)。X为本地点到该拱形走廊所需移动次数。如果你检定成功，移动到该地点。(每轮仅限一次。)
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08657 · Primeval Terror / 原始恐怖
- 行号：src/cards/cards-data.js:304286（name/nameZh） · src/cards/cards-data.js:304297（textZh） · src/cards/cards-data.js:304260（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Test [willpower] (2). This test gets +1 difficulty for each location away from The Gate of Y'quaa you are. If you fail, take 2 horror.
```
- text ZH:
```
显现 - 检定[willpower](2)。你所在地点到伊夸之门每需移动一次，本次检定得到+1难度。如果你检定失败，受到2点恐惧。
```
- flavor EN:
```
"The sheer appalling antiquity and lethal desolation of the place were enough to overwhelm almost any sensitive person..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“这个地方那纯粹到令人震惊的古老和致命的荒凉足以压倒几乎所有敏感的人……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08658 · Roots of the Earth / 地球根源
- 行号：src/cards/cards-data.js:304340（name/nameZh） · src/cards/cards-data.js:304351（textZh） · src/cards/cards-data.js:304314（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Test [agility] (2). This test gets +1 difficulty for each location away from The Gate of Y'quaa you are. If you fail, take 2 damage.
```
- text ZH:
```
显现 - 检定[agility](2)。你所在地点到伊夸之门每需移动一次，本次检定得到+1难度。如果你检定失败，受到2点伤害。
```
- flavor EN:
```
"The things once rearing and dwelling in this frightful masonry in the age of dinosaurs were not indeed dinosaurs, but far worse."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“在恐龙时代繁育和居住在这个可怕的砖石建筑里的东西并不是真正的恐龙，而是更可怕的东西。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08659 · The Beating Heart / 跳动的心脏
- 行号：src/cards/cards-data.js:304398（name/nameZh） · src/cards/cards-data.js:304410（textZh） · src/cards/cards-data.js:304370（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)
```
- text ZH:
```
强制 - 如果在同一地点有至少2个由调查员控制的激活的封印：储存在封印内的潜在能量聚合在一起，随后的连锁反应引发静电爆炸，摧毁了地球上的所有生命。(→结局3)
```
- backText EN:
```
Read Scenario Interlude: The Final Straw in the Campaign Guide.
```
- backText ZH:
```
阅读剧本手册中的冒险幕间故事：最后一根稻草。
```
- flavor EN:
```
Five darkened paths lead away from the gateway, through icy caverns and down vaulted corridors of smooth black stone. Quiet dread fills the ancient, dormant structure.
```
- flavor ZH:
```
五道黑暗的通路从大门向外延伸，穿过冰封的洞穴和光滑的黑石拱廊。寂静的恐怖遍布这古老沉寂的建筑。
```
- backFlavor EN:
```
A dark, primordial energy seeps forth from the walls, the very same miasma that has haunted your every step throughout this doomed journey. You freeze in your tracks and back away. You've seen the kinds of hideous shapes it can take. The kinds of memories it conjures- foul and fair alike. But not everyone sees the mirage for what it truly is...
```
- backFlavor ZH:
```
一种黑暗、原始的能量从墙壁中渗出，正是在这末日之旅中缠绕着你前进路程上每一步的瘴气。你停下脚步，开始后退。你已经见识过它会变成什么样的可怕形状，它所能唤起的那些记忆——不论肮脏还是美好的。但并不是每个人都能看到幻景的真实面目……
```

## 08660 · The Miasma Beckons / 瘴气的召唤
- 行号：src/cards/cards-data.js:304453（name/nameZh） · src/cards/cards-data.js:304465（textZh） · src/cards/cards-data.js:304425（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)
```
- text ZH:
```
强制 - 如果在同一地点有至少2个由调查员控制的激活的封印：储存在封印内的潜在能量聚合在一起，随后的连锁反应引发静电爆炸，摧毁了地球上的所有生命。(→结局3)
```
- backText EN:
```
Check the seals controlled by each investigator (if a seal is not controlled by an investigator, skip it).
The investigator who controls the [seal_a] seal takes 1 damage (2 instead if the seal is activated).
The investigator who controls the [seal_b] seal discards 2 random cards from their hand (4 instead if the seal is activated).
The investigator who controls the [seal_c] seal takes 1 horror (2 instead if the seal is activated).
The investigator who controls the [seal_d] seal loses 1 action (2 instead if the seal is activated).
The investigator who controls the [seal_e] seal loses 3 resources (6 instead if the seal is activated).
```
- backText ZH:
```
检查由每位调查员控制的封印(如果有封印不是由调查员控制的，跳过它)。
控制[seal_a]封印的调查员受到1点伤害(如果封印是激活的，改为2点)。
控制[seal_b]封印的调查员随机弃掉2张手牌(如果封印是激活的，改为4张)。
控制[seal_c]封印的调查员受到1点恐惧(如果封印是激活的，改为2点)。
控制[seal_d]封印的调查员失去1个行动(如果封印是激活的，改为2个)。
控制[seal_e]封印的调查员失去3资源(如果封印是激活的，改为6资源)。
```
- flavor EN:
```
Eldritch whispers and the dribbling of inky miasma permeates the once-silent ruins. Something is reaching out to you from within its walls. Calling to you.
```
- flavor ZH:
```
怪异的低语和滴下的墨状瘴气弥漫在曾经寂静的废墟上。有东西从墙里向你伸出。它正呼唤着你。
```
- backFlavor EN:
```
The seals pulse with dangerous electrostatic energy, filling the icy chambers with bright blue light. You struggle to contain the power within each seal as you move quickly to put them in their proper place.
```
- backFlavor ZH:
```
封印中跳动着危险的静电能量，明亮的蓝色光芒照亮了整个冰冷的房间。你尽力控制所有封印的力量，同时快速移动，想要把它们放在正确的地方。
```

## 08661 · Call of Madness / 疯狂的召唤
- 行号：src/cards/cards-data.js:304508（name/nameZh） · src/cards/cards-data.js:304520（textZh） · src/cards/cards-data.js:304480（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)
```
- text ZH:
```
强制 - 如果在同一地点有至少2个由调查员控制的激活的封印：储存在封印内的潜在能量聚合在一起，随后的连锁反应引发静电爆炸，摧毁了地球上的所有生命。(→结局3)
```
- backText EN:
```
Each remaining investigator is defeated and must either suffer 1 mental trauma or shuffle the top 3 cards of the Tekeli-li deck into their deck.
```
- backText ZH:
```
剩余的每位调查员被击败，且必须承受1点精神创伤，或者将忒咳哩-哩牌库顶的3张卡牌混洗入各自的牌库。
```
- flavor EN:
```
The gateway stirs. Whatever is calling to you from within these walls, it hears your every word, your every footstep. It knows of your presence, of your hopes, of your fears. And it yearns to be free.
```
- flavor ZH:
```
大门骚动着。无论墙里有什么在召唤你，它都能听到你说的每一个字，你的每一步。它知道你的存在，你的希望，你的恐惧。而且它渴望自由。
```
- backFlavor EN:
```
Before you can find and place all five seals, a tremendous noise fills the cavernous halls of the facility, and inky, prismatic miasma begins to seep from every inch of the walls and ceiling. Waves of creeping ichor and wafting black mist block every route but the one from which you came. You flee back to the gateway to escape or find another path forward, but by the time you reach the massive door, it is too late.
```
- backFlavor ZH:
```
在你成功找到并放置所有五个封印之前，巨大的噪音响彻洞穴般的大厅，五彩的墨状瘴气开始从墙壁和天花板的每一寸渗透出来。大量蠕动的脓水和飘来的黑雾挡住了每一条路，除了你来的那条。你向大门口逃去，试图逃跑或找到另一条路前进，但当你到达大门时，已经太迟了。
```

## 08662 · Dormancy / 蛰伏
- 行号：src/cards/cards-data.js:304562（name/nameZh） · src/cards/cards-data.js:304574（textZh） · src/cards/cards-data.js:304535（backTextZh）
- pack=eoec · type=act
- text EN:
```
Objective - If an activated seal is placed on The Gate of Y'quaa, advance.
```
- text ZH:
```
目标 - 如果一个激活的封印被放到伊夸之门上，推进场景。
```
- backText EN:
```
Check which seal was just placed (do not remove it).
If it was the [seal_a] seal, the investigator who placed it heals 1 damage.
If it was the [seal_b] seal, the investigator who placed it draws 2 cards.
If it was the [seal_c] seal, the investigator who placed it heals 1 horror.
If it was the [seal_d] seal, the investigator who placed it may take an additional action this turn.
If it was the [seal_e] seal, the investigator who placed it gains 3 resources.
```
- backText ZH:
```
检查刚刚放置的是哪个封印(不要移除它)。
如果是[seal_a]封印，放置该封印的调查员治愈1点伤害。
如果是[seal_b]封印，放置该封印的调查员抽取2张卡牌。
如果是[seal_c]封印，放置该封印的调查员治愈1点恐惧。
如果是[seal_d]封印，放置该封印的调查员本回合可以执行额外一个行动。
如果是[seal_e]封印，放置该封印的调查员获得3资源。
```
- flavor EN:
```
You have decided to explore the rest of this antediluvian complex in order to find the devices that fit this strange doorway.
```
- flavor ZH:
```
为了找到能安装在这个奇怪大门上的设备，你决定探索这片远古建筑群的其余部分。
```
- backFlavor EN:
```
As soon as you set the seal into place, it locks into the door with an audible click. The energy stored within the seal reaches out, coursing through channels and grooves along the doorway, and lighting the entire chamber with an eerie glow. Perhaps if you can activate and place the remaining four seals, you can put a stop to this madness.
```
- backFlavor ZH:
```
一旦你将封印放对位置，随着咔嗒一声，它就锁在了门上。储存在封印内的能量顺着管道和凹槽延伸，照亮了整个房间，发出一种怪异的光芒。也许如果你能激活并放置剩下的四个封印，你就能阻止这场疯狂。
```

## 08663 · The Great Seal / 巨大封印
- 行号：src/cards/cards-data.js:304616（name/nameZh） · src/cards/cards-data.js:304628（textZh） · src/cards/cards-data.js:304589（backTextZh）
- pack=eoec · type=act
- text EN:
```
Objective - Place as many activated seals as you can on The Gate of Y'quaa before whatever is inside escapes. If all five seals have been placed, advance.
```
- text ZH:
```
目标 - 在里面的东西逃离前，在伊夸之门上放置尽可能多的激活的封印。如果放置了所有五个封印，推进场景。
```
- backText EN:
```
(→R1)
```
- backText ZH:
```
(→结局1)
```
- flavor EN:
```
Placing the first of the five seals has awoken a strange power within the facility. You believe if you can find and activate the remaining seals, they will aid in containing the thing that dwells on the other side of this gate...
```
- flavor ZH:
```
放置了五个封印中的第一个后，设施中的某种奇怪力量被唤醒了。你相信如果你能找到并激活剩下的封印，它们将有助于控制潜伏在这扇门彼端的东西……
```
- backFlavor EN:
```
The final seal locks into place. With a hum, power flows through the facility. Small orbs embedded in the ceiling begin to light, one by one. The realization dawns on you that this sanctuary is far more advanced than you could have ever imagined.
```
- backFlavor ZH:
```
最后的封印归位。随着一阵嗡嗡声，能量流过整个设施。嵌在天花板上的小球体开始一个接一个地亮起来。你意识到这个圣所比你想像的要先进得多。
```

## 08664 · Glacial Grotto / 冰川岩洞
- 行号：src/cards/cards-data.js:304670（name/nameZh） · src/cards/cards-data.js:304682（textZh） · src/cards/cards-data.js:304643（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Forced - After Glacial Grotto is revealed: Place the dormant [seal_a] seal on it.
[action]: Test [combat] (2) to shatter the ice. If you succeed, investigators at Glacial Grotto may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.
```
- text ZH:
```
强制 - 在冰川岩洞被揭示后：将休眠的[seal_a]封印放在它上面。
[action]：检定[combat](2)来打碎冰块。如果你检定成功，位于冰川岩洞的调查员可以共同花费1[per_investigator]个线索，来使你控制其上的封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08665 · Sculptured Crypt / 雕画密室
- 行号：src/cards/cards-data.js:304728（name/nameZh） · src/cards/cards-data.js:304740（textZh） · src/cards/cards-data.js:304701（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Forced - After Sculptured Crypt is revealed: Place the dormant [seal_b] seal on it.
[action]: Test [intellect] (2) to decipher the alien script. If you succeed, investigators at Sculptured Crypt may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.
```
- text ZH:
```
强制 - 在雕画密室被揭示后：将休眠的[seal_b]封印放在它上面。
[action]：检定[intellect](2)来破译异星文字。如果你检定成功，位于雕画密室的调查员可以共同花费1[per_investigator]个线索，来使你控制其上的封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08666 · Undercity Altar / 地城祭坛
- 行号：src/cards/cards-data.js:304786（name/nameZh） · src/cards/cards-data.js:304798（textZh） · src/cards/cards-data.js:304759（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Forced - After Undercity Altar is revealed: Place the dormant [seal_c] seal on it.
[action]: Test [willpower] (2) to break the ancient ward. If you succeed, investigators at Undercity Altar may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.
```
- text ZH:
```
强制 - 在地城祭坛被揭示后：将休眠的[seal_c]封印放在它上面。
[action]：检定[willpower](2)来打破古代结界。如果你检定成功，位于地城祭坛的调查员可以共同花费1[per_investigator]个线索，来使你控制其上的封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08667 · Ichor-Laden Tunnels / 脓水隧道
- 行号：src/cards/cards-data.js:304844（name/nameZh） · src/cards/cards-data.js:304856（textZh） · src/cards/cards-data.js:304817（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Forced - After Ichor-Laden Tunnels is revealed: Place the dormant [seal_d] seal on it.
[action]: Test [agility] (2) to traverse the ichor. If you succeed, investigators at Ichor-Laden Tunnels may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.
```
- text ZH:
```
强制 - 在脓水隧道被揭示后：将休眠的[seal_d]封印放在它上面。
[action]：检定[agility](2)来穿过脓水。如果你检定成功，位于脓水隧道的调查员可以共同花费1[per_investigator]个线索，来使你控制其上的封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08668 · Limestone Caverns / 灰岩洞穴
- 行号：src/cards/cards-data.js:304902（name/nameZh） · src/cards/cards-data.js:304914（textZh） · src/cards/cards-data.js:304875（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Forced - After Limestone Caverns is revealed: Place the dormant [seal_e] seal on it.
[action] Investigators at Limestone Caverns spend 1 [per_investigator] clues and 3 [per_investigator] resources, as a group: Take control of the seal on Limestone Caverns.
```
- text ZH:
```
强制 - 在灰岩洞穴被揭示后：将休眠的[seal_e]封印放在它上面。
[action]位于灰岩洞穴的调查员共同花费1[per_investigator]个线索和3[per_investigator]资源：控制灰岩洞穴上的封印。
```
- backFlavor EN:
```
"Other apertures were undoubtedly connected with bygone mechanical facilities - heating, lighting, and the like - of a sort suggested in many of the carvings. Ceilings tended to be plain, but had sometimes been inlaid with green soapstone or other tiles, mostly fallen now."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“其他的孔洞无疑是与过去的机械设备有关——如供暖、照明等——这在许多雕画中都有所暗示。天花板一般都很平实，但有时也会镶嵌上绿色的皂石或其他瓷砖，而现在大多已经脱落了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08669 · Protoplasmic Mass / 原生质团
- 行号：src/cards/cards-data.js:304961（name/nameZh） · src/cards/cards-data.js:304972（textZh） · src/cards/cards-data.js:304931（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Shoggoth  ||  怪物 / 修格斯
- text EN:
```
Hunter.
Spawn - Location farthest from you on the outer ring.
Prey - Nearest investigator with a seal only.
Forced - When the enemy phase ends, if an investigator controls an activated seal: Protoplasmic Mass readies and resolves the enemy phase again (it resolves its hunter keyword and attacks a second time). (Limit once per phase.)
```
- text ZH:
```
猎手。
生成 - 最外的环形上距离你最远的地点。
猎物 - 仅对拥有封印的最近调查员。
强制 - 在敌军阶段结束时，如果一位调查员控制着激活的封印：重整原生质团并再结算一次敌军阶段(其结算其猎手关键词并再次攻击)。(每个阶段限一次。)
```

## 08670 · Electrostatic Discharge / 静电释放
- 行号：src/cards/cards-data.js:305016（name/nameZh） · src/cards/cards-data.js:305027（textZh） · src/cards/cards-data.js:304991（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Surge.
Revelation - Each investigator at the same location as a seal takes 1 horror, and 1 damage if that seal is activated
```
- text ZH:
```
涌动。
显现 - 每位与一个封印在同一地点的调查员受到1点恐惧，如果该封印是激活的，再受到1点伤害。
```

## 08671 · The Seal Weakens / 封印减弱
- 行号：src/cards/cards-data.js:305074（name/nameZh） · src/cards/cards-data.js:305086（textZh） · src/cards/cards-data.js:305046（backTextZh）
- pack=eoec · type=agenda
- backText EN:
```
Spawn 1 set-aside copy of The Nameless Madness enemy at the Mist-Pylon nearest to an investigator.
Check the Campaign Log. If the truth of the mirage eludes you:
You stare, dumbstruck, at the hideous phantasmagoria. The air shimmers with a dreamlike quality about its damnable form, an endless weave of intermingled nightmare and memory. The very sight of it drives you to your knees. It is the final truth. Reality was the mirage.
Each investigator searches their deck for each copy of Tekeli-li and draws them one at a time in a random order, without placing them on the bottom of the Tekeli-li deck. After resolving all of them, shuffle each of them back into their bearer's deck.
```
- backText ZH:
```
在离一位调查员最近的迷雾高塔生成1张放在一边的无名疯狂敌人。
检查剧本日志。如果你尚未明了幻景的真相：
你呆呆地望着这千变万化的可怕幻景。空气中闪烁着梦幻般的光芒，噩梦和记忆在无尽地交织着。一看到它你就不由自主跪了下来。这是终极真相。现实曾是幻景。
每位调查员查找自己牌库，找出其中所有忒咳哩-哩，并依次按随机顺序抽取这些卡牌，且不要将它们放在忒咳哩-哩牌库底。在结算完所有这些卡牌后，将它们各自混洗入承受者的牌库。
```
- flavor EN:
```
Miasma has completely consumed this part of the facility. The walls and ceiling drip with polychromatic ooze, polar mist swirls through the halls, and the air shimmers with the insubstantial quality of a mirage. What manner of power is this? And how can you possibly hope to destroy it?
```
- flavor ZH:
```
瘴气已经完全吞噬了设施的这一部分。墙壁和天花板上滴落着色彩不断变化的软泥，极地迷雾在大厅里盘旋，空气闪烁着虚幻的微光。这是什么样的力量？而你又能怎样毁掉它？
```
- backFlavor EN:
```
From the nameless depths at the very core of the Earth, the miasma's true form emerges. It is a shapeless thing, a creature of whirling mist and putrid ichor that screams and whispers and crawls and flies. It seeps through the walls and up from the ice; it is everywhere; it is everything.
```
- backFlavor ZH:
```
从地球最核心的无名深渊中，瘴气的真实形态出现了。那是一种无形，由旋转的雾和腐烂脓液构成的生物，它在尖叫、低语、爬行、飞舞。它穿过墙壁，从冰中渗出；它无处不在；它就是一切。
```

## 08672 · That Which Has No Name / 无名存在
- 行号：src/cards/cards-data.js:305128（name/nameZh） · src/cards/cards-data.js:305140（textZh） · src/cards/cards-data.js:305101（backTextZh）
- pack=eoec · type=agenda
- text EN:
```
Forced - When 1 or more doom would be put into play, if there are any copies of The Nameless Madness still set aside: Instead, spawn 1 set-aside copy of The Nameless Madness at the location nearest to an investigator without a copy of that enemy that is connected to a location with a copy of that enemy.
Objective - At the end of the round, if all 15 copies of The Nameless Madness are in play and not every Mist-Pylon is collapsed, advance this agenda.
```
- text ZH:
```
强制 - 在至少1个毁灭标记将要被放置入场时，如果仍然有放在一边的无名疯狂：改为在一个没有无名疯狂敌人，但连接地点有该敌人的，离调查员最近的地点生成1张放在一边的无名疯狂。
目标 -当一轮结束时，如果所有15张无名疯狂都在场上，且并非所有迷雾高塔都被摧毁，推进本密谋。
```
- backText EN:
```
For each Mist-Pylon that is collapsed, set 3 copies of The Nameless Madness aside.
Each investigator loses all of their clues.
Remove each location except The Gate of Y'quaa from the game. Investigators and copies of The Nameless Madness are not defeated by this effect. All other cards at these locations are discarded.
Put the 4 set-aside Titanic Ramp locations into play in a straight line to the right of The Gate of Y'quaa. Put the set-aside Hidden Tunnel location into play to the right of the rightmost Titanic Ramp. Place each investigator and each remaining copy of The Nameless Madness in play at the leftmost Titanic Ramp.
Remove the act deck from the game and advance to the set-aside The Final Mirage. It is both the current act and the current agenda.
```
- backText ZH:
```
每有一个被摧毁的迷雾高塔，将3张无名疯狂放在一边。
每位调查员失去其所有线索。
将除了伊夸之门外的所有地点从游戏中移除。调查员和无名疯狂不会被本效果击败。弃掉这些地点上的所有其他卡牌。
将4张放在一边的巨大坡道地点放置入场，在伊夸之门右边排成一条直线。将放在一边的隐秘隧道地点放置入场，位于最右边的巨大坡道右边。将所有调查员和剩余的所有无名疯狂放置入场，位于最左边的巨大坡道。
将场景牌库从游戏中移除，并推进至放在一边的最终幻景。它既是当前场景也是当前密谋。
```
- flavor EN:
```
Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li! Tekeli-li!
```
- flavor ZH:
```
忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！忒咳哩-哩！
```
- backFlavor EN:
```
It is too late. You cannot contain the creature that dwells beneath the mountain. All you can hope to do now is escape with your lives.
```
- backFlavor ZH:
```
已经太迟了。你没能控制住在山脉底下的生物。你现在唯一能做事情的就是逃命。
```

## 08673 · Collapse the Pylons / 摧毁高塔
- 行号：src/cards/cards-data.js:305182（name/nameZh） · src/cards/cards-data.js:305194（textZh） · src/cards/cards-data.js:305155（backTextZh）
- pack=eoec · type=act
- text EN:
```
Each revealed Mist-Pylon can be attacked as if it were an enemy. Its fight value is equal to its shroud value and its health is equal to its clue value. While it has no health remaining, it is collapsed (it remains in play).
[reaction] When you discover 1 or more clues at a Mist-Pylon, spend those clues: Deal that much damage to that Mist-Pylon.
Objective - At the end of the round, if each Mist-Pylon is collapsed, advance this act.
```
- text ZH:
```
每个已揭示的迷雾高塔可以被攻击，如同它是敌人。它的战斗值等于它的隐藏值，它的生命值等于它的线索值。它没有剩余生命值时，它被摧毁(它依然保持在场上)。
[reaction]在你发现迷雾高塔上的1个或更多线索时，花费那些线索：对该迷雾高塔造成该数量的伤害。
目标 - 当一轮结束时，如果所有迷雾高塔都被摧毁，推进本场景。
```
- backText EN:
```
Set all but 3 copies of The Nameless Madness aside.
Each investigator loses all of their clues.
Remove each location except The Gate of Y'quaa from the game. Investigators and copies of The Nameless Madness are not defeated by this effect. All other cards at those locations are discarded.
Put the 4 set-aside Titanic Ramp locations into play in a straight line to the right of The Gate of Y'quaa. Put the set-aside Hidden Tunnel location into play to the right of the rightmost Titanic Ramp. Place each investigator and each remaining copy of The Nameless Madness in play at the leftmost Titanic Ramp.
Remove the agenda deck from the game and advance to the set-aside The Final Mirage. It is both the current act and the current agenda.
```
- backText ZH:
```
将除了3张以外的其他所有无名疯狂放在一边。
每位调查员失去其所有线索。
将除了伊夸之门外的所有地点从游戏中移除。调查员和无名疯狂不会被本效果击败。弃掉这些地点上的所有其他卡牌。
将4张放在一边的巨大坡道地点放置入场，在伊夸之门右边排成一条直线。将放在一边的隐秘隧道地点放置入场，位于最右边的巨大坡道右边。将所有调查员和剩余的所有无名疯狂放置入场，位于最左边的巨大坡道。
将密谋牌库从游戏中移除，并推进至放在一边的最终幻景。它既是当前场景也是当前密谋。
```
- flavor EN:
```
Five pylons hold this facility together. Your only hope is to destroy them - and everything else.
```
- flavor ZH:
```
五座高塔共同支撑着这座设施。你唯一的希望就是摧毁它们——还有其他的一切。
```
- backFlavor EN:
```
The facility shakes to its very core. Without the Mist-Pylons powering the structure, the nameless entity that resides within is free - and its days are numbered, as are yours. The mountain groans and trembles, threatening to collapse all around you.
```
- backFlavor ZH:
```
整座设施都在摇晃。没有高塔为建筑供能，居住在里面的无名存在重获自由——但它时日无多，当然你也一样。山脉呻吟着，颤抖着，好像要在你周围倒塌。
```

## 08674 · Mist-Pylon / 迷雾高塔
- 行号：src/cards/cards-data.js:305235（name/nameZh） · src/cards/cards-data.js:305247（textZh） · src/cards/cards-data.js:305208（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast] If you control the [seal_a] seal, and it is activated: You unleash the seal's power. Place the [seal_a] seal on this Mist-Pylon. For the remainder of the game, each time you deal damage to a Mist-Pylon, deal 1 additional damage.
```
- text ZH:
```
[free]如果你控制[seal_a]封印，且其是激活的：你释放了封印的力量。将[seal_a]封印放在本迷雾高塔上。直到本场游戏结束，每当你对迷雾高塔造成伤害，额外造成1点伤害。
```
- backText EN:
```
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入迷雾高塔的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"In the whole spectacle there was a persistent, pervasive hint of stupendous secrecy and potential revelation; as if these stark, nightmare spires marked the pylons of a frightful gateway..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这整个奇观中，始终遍布着某种暗示，暗示着惊人的秘密和潜在的启示：仿佛这些荒凉的、噩梦般的尖顶标志着一个可怕大门旁的高塔……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08675 · Mist-Pylon / 迷雾高塔
- 行号：src/cards/cards-data.js:305292（name/nameZh） · src/cards/cards-data.js:305304（textZh） · src/cards/cards-data.js:305265（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast] If you control the [seal_b] seal, and it is activated: You unleash the seal's power. Place the [seal_b] seal on this Mist-Pylon. For the remainder of the game, reduce the shroud value of each Mist-Pylon by 2.
```
- text ZH:
```
[free]如果你控制[seal_b]封印，且其是激活的：你释放了封印的力量。将[seal_b]封印放在本迷雾高塔上。直到本场游戏结束，每个迷雾高塔的隐藏值减少2。
```
- backText EN:
```
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入迷雾高塔的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"In the whole spectacle there was a persistent, pervasive hint of stupendous secrecy and potential revelation; as if these stark, nightmare spires marked the pylons of a frightful gateway..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这整个奇观中，始终遍布着某种暗示，暗示着惊人的秘密和潜在的启示：仿佛这些荒凉的、噩梦般的尖顶标志着一个可怕大门旁的高塔……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08676 · Mist-Pylon / 迷雾高塔
- 行号：src/cards/cards-data.js:305349（name/nameZh） · src/cards/cards-data.js:305361（textZh） · src/cards/cards-data.js:305322（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast] If you control the [seal_c] seal, and it is activated: You unleash the seal's power. Place the [seal_c] seal on this Mist-Pylon. For the remainder of the game, each investigator gets +1 to each of their skills while they are at a Mist-Pylon.
```
- text ZH:
```
[free]如果你控制[seal_c]封印，且其是激活的：你释放了封印的力量。将[seal_c]封印放在本迷雾高塔上。直到本场游戏结束，位于迷雾高塔地点的每位调查员得到每项技能值+1。
```
- backText EN:
```
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入迷雾高塔的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"In the whole spectacle there was a persistent, pervasive hint of stupendous secrecy and potential revelation; as if these stark, nightmare spires marked the pylons of a frightful gateway..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这整个奇观中，始终遍布着某种暗示，暗示着惊人的秘密和潜在的启示：仿佛这些荒凉的、噩梦般的尖顶标志着一个可怕大门旁的高塔……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08677 · Mist-Pylon / 迷雾高塔
- 行号：src/cards/cards-data.js:305406（name/nameZh） · src/cards/cards-data.js:305418（textZh） · src/cards/cards-data.js:305379（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast] If you control the [seal_d] seal, and it is activated: You unleash the seal's power. Place the [seal_d] seal on this Mist-Pylon. For the remainder of the game, whenever an investigator at a Mist-Pylon would be dealt 1 or more damage and/or horror, cancel 1 of that damage or horror.
```
- text ZH:
```
[free]如果你控制[seal_d]封印，且其是激活的：你释放了封印的力量。将[seal_d]封印放在本迷雾高塔上。直到本场游戏结束，每当位于迷雾高塔地点的调查员将要受到伤害和/或恐惧时，取消1点该伤害或恐惧。
```
- backText EN:
```
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入迷雾高塔的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"In the whole spectacle there was a persistent, pervasive hint of stupendous secrecy and potential revelation; as if these stark, nightmare spires marked the pylons of a frightful gateway..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这整个奇观中，始终遍布着某种暗示，暗示着惊人的秘密和潜在的启示：仿佛这些荒凉的、噩梦般的尖顶标志着一个可怕大门旁的高塔……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08678 · Mist-Pylon / 迷雾高塔
- 行号：src/cards/cards-data.js:305463（name/nameZh） · src/cards/cards-data.js:305475（textZh） · src/cards/cards-data.js:305436（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
[fast] If you control the [seal_e] seal, and it is activated: You unleash the seal's power. Place the [seal_e] seal on this Mist-Pylon. For the remainder of the game, each enemy gets -2 fight and -2 evade while it is at a Mist-Pylon.
```
- text ZH:
```
[free]如果你控制[seal_e]封印，且其是激活的：你释放了封印的力量。将[seal_e]封印放在本迷雾高塔上。直到本场游戏结束，每个位于迷雾高塔地点的敌人得到-2攻击和-2躲避。
```
- backText EN:
```
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.
```
- backText ZH:
```
作为你进入迷雾高塔的额外费用，你所在地点的调查员必须共同花费1[per_investigator]个线索。
```
- backFlavor EN:
```
"In the whole spectacle there was a persistent, pervasive hint of stupendous secrecy and potential revelation; as if these stark, nightmare spires marked the pylons of a frightful gateway..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在这整个奇观中，始终遍布着某种暗示，暗示着惊人的秘密和潜在的启示：仿佛这些荒凉的、噩梦般的尖顶标志着一个可怕大门旁的高塔……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08679 · The Nameless Madness / 无名疯狂
- 行号：src/cards/cards-data.js:305521（name/nameZh） · src/cards/cards-data.js:305533（textZh） · src/cards/cards-data.js:305492（backTextZh）
- pack=eoec · type=enemy · subname=The Entity in the Mirage / 幻景中的存在
- traits: Ancient One / Eidolon / Elite  ||  古神 / 幻灵 / 精英
- text EN:
```
Alert. Massive. Retaliate.
The Nameless Madness cannot take damage.
Forced - After you successfully evade or attack The Nameless Madness: For each point you succeeded by, exhaust the nearest ready copy of The Nameless Madness.
```
- text ZH:
```
警戒。庞大。反击。
无名疯狂不能受到伤害。
强制 - 你成功躲避或攻击无名疯狂后：你每超过难度1点，横置最近的一个重整状态的无名疯狂。
```

## 08680 · Unsealed Phantasm / 解开封印的幻影
- 行号：src/cards/cards-data.js:305584（name/nameZh） · src/cards/cards-data.js:305595（textZh） · src/cards/cards-data.js:305554（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon / Shoggoth  ||  怪物 / 幻灵 / 修格斯
- text EN:
```
Spawn - The nearest Mist-Pylon that is not collapsed (or your location, if there are none in play).
While Unsealed Phantasm is ready and at a Mist-Pylon, damage cannot be dealt to that Mist-Pylon.
Forced - At the end of the enemy phase, if Unsealed Phantasm is ready: Move it once toward the Mist-Pylon nearest to it that is not collapsed.
```
- text ZH:
```
生成 - 最近的未被摧毁的迷雾高塔(如果场上没有，则为你所在地点)。
解开封印的幻影处于重整状态且位于一个迷雾高塔时，不能对该迷雾高塔造成伤害。
强制 - 当敌军阶段结束时，如果解开封印的幻影处于重整状态：将其朝最近的未被摧毁的迷雾高塔移动一次。
```

## 08681 · The Final Mirage / 最终幻景
- 行号：src/cards/cards-data.js:305645（name/nameZh） · src/cards/cards-data.js:305657（textZh） · src/cards/cards-data.js:305619（backTextZh）
- pack=eoec · type=act
- text EN:
```
The Nameless Madness gains hunter.
Forced - When 1 or more doom would be put into play: Instead, spawn 1 set-aside copy of The Nameless Madness at the leftmost investigator's location.
Objective - Run.
```
- text ZH:
```
无名疯狂获得猎手。
强制 - 在至少1个毁灭标记将要被放置入场时：改为在最左边的调查员所在地点生成一张放在一边的无名疯狂敌人。
目标 - 跑。
```
- backText EN:
```
Check the Campaign Log.
- If all 5 Mist-Pylons were collapsed and Dr. Kensler has a plan, proceed to (→R1).
- If all 5 Mist-Pylons were collapsed and the truth of the mirage eludes you, proceed to (→R2).
- Otherwise, proceed to (→R3).
```
- backText ZH:
```
检查剧本日志。
- 如果所有5个迷雾高塔都被摧毁，且肯斯勒博士有一个计划，进入(→结局1)。
- 如果所有5个迷雾高塔都被摧毁，且你尚未明了幻景的真相，进入(→结局2)。
- 否则，进入(→结局3)。
```
- backFlavor EN:
```
You emerge from the tunnel, daylight blinding you as the sun peeks out from behind the jagged mountaintops in the distance. Behind you, the entity rushes toward the exit. You prepare yourself for the end, the wall of mist, miasma, and madness feeling much like an oncoming train.
```
- backFlavor ZH:
```
你从隧道里出来，阳光从远处锯齿状的山顶后面探出头，使你目眩。在你身后，那存在也猛冲向出口。你做好面对终结的准备，雾墙、瘴气和疯狂感觉就像一列火车迎面而来。
```

## 08682 · Titanic Ramp / 巨大坡道
- 行号：src/cards/cards-data.js:305698（name/nameZh） · src/cards/cards-data.js:305710（textZh） · src/cards/cards-data.js:305671（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (4). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.
```
- text ZH:
```
巨大坡道与其左边和右边的地点连接。
作为离开巨大坡道的额外费用，检定[agility](4)。如果你检定失败，取消本次移动的效果。位于你所在地点或相邻地点的任意调查员，可以花费1个线索来使你本次检定自动成功。
```
- backText EN:
```
Titanic Ramp is connected to the locations to its left and right.
```
- backText ZH:
```
巨大坡道与其左边和右边的地点连接。
```
- backFlavor EN:
```
"...over our former trail back to the city, along ice-sunken megalithic corridors to the great open circle, and up that archaic spiral ramp in a frenzied automatic plunge for the sane outer air and light of day."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在我们回城路上，沿着被冰淹没的巨石走廊来到那空旷的巨大圆形遗迹，然后沿着古老的螺旋坡道疯狂而机械地往上冲，朝向外面那有着空气和日光的正常世界。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08683 · Titanic Ramp / 巨大坡道
- 行号：src/cards/cards-data.js:305755（name/nameZh） · src/cards/cards-data.js:305767（textZh） · src/cards/cards-data.js:305728（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (3). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.
```
- text ZH:
```
巨大坡道与其左边和右边的地点连接。
作为离开巨大坡道的额外费用，检定[agility](3)。如果你检定失败，取消本次移动的效果。位于你所在地点或相邻地点的任意调查员，可以花费1个线索来使你本次检定自动成功。
```
- backText EN:
```
Titanic Ramp is connected to the locations to its left and right.
```
- backText ZH:
```
巨大坡道与其左边和右边的地点连接。
```
- backFlavor EN:
```
"...over our former trail back to the city, along ice-sunken megalithic corridors to the great open circle, and up that archaic spiral ramp in a frenzied automatic plunge for the sane outer air and light of day."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在我们回城路上，沿着被冰淹没的巨石走廊来到那空旷的巨大圆形遗迹，然后沿着古老的螺旋坡道疯狂而机械地往上冲，朝向外面那有着空气和日光的正常世界。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08684 · Titanic Ramp / 巨大坡道
- 行号：src/cards/cards-data.js:305812（name/nameZh） · src/cards/cards-data.js:305824（textZh） · src/cards/cards-data.js:305785（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (2). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.
```
- text ZH:
```
巨大坡道与其左边和右边的地点连接。
作为离开巨大坡道的额外费用，检定[agility](2)。如果你检定失败，取消本次移动的效果。位于你所在地点或相邻地点的任意调查员，可以花费1个线索来使你本次检定自动成功。
```
- backText EN:
```
Titanic Ramp is connected to the locations to its left and right.
```
- backText ZH:
```
巨大坡道与其左边和右边的地点连接。
```
- backFlavor EN:
```
"...over our former trail back to the city, along ice-sunken megalithic corridors to the great open circle, and up that archaic spiral ramp in a frenzied automatic plunge for the sane outer air and light of day."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在我们回城路上，沿着被冰淹没的巨石走廊来到那空旷的巨大圆形遗迹，然后沿着古老的螺旋坡道疯狂而机械地往上冲，朝向外面那有着空气和日光的正常世界。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08685 · Titanic Ramp / 巨大坡道
- 行号：src/cards/cards-data.js:305869（name/nameZh） · src/cards/cards-data.js:305881（textZh） · src/cards/cards-data.js:305842（backTextZh）
- pack=eoec · type=location
- traits: Ruins  ||  遗迹
- text EN:
```
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (1). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.
```
- text ZH:
```
巨大坡道与其左边和右边的地点连接。
作为离开巨大坡道的额外费用，检定[agility](1)。如果你检定失败，取消本次移动的效果。位于你所在地点或相邻地点的任意调查员，可以花费1个线索来使你本次检定自动成功。
```
- backText EN:
```
Titanic Ramp is connected to the locations to its left and right.
```
- backText ZH:
```
巨大坡道与其左边和右边的地点连接。
```
- backFlavor EN:
```
"...over our former trail back to the city, along ice-sunken megalithic corridors to the great open circle, and up that archaic spiral ramp in a frenzied automatic plunge for the sane outer air and light of day."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“在我们回城路上，沿着被冰淹没的巨石走廊来到那空旷的巨大圆形遗迹，然后沿着古老的螺旋坡道疯狂而机械地往上冲，朝向外面那有着空气和日光的正常世界。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08686 · Hidden Tunnel / 隐秘隧道
- 行号：src/cards/cards-data.js:305927（name/nameZh） · src/cards/cards-data.js:305940（textZh） · src/cards/cards-data.js:305899（backTextZh）
- pack=eoec · type=location · subname=A Way Out / 出逃之路
- traits: Ruins  ||  遗迹
- text EN:
```
Hidden Tunnel is connected to the location to its left.
Objective - If each undefeated investigator is at the Hidden Tunnel, advance the act.
```
- text ZH:
```
隐秘隧道与其左边的地点连接。
目标 - 如果每位没有被击败的调查员都在隐秘隧道，推进场景。
```
- backText EN:
```
Hidden Tunnel is connected to the location to its left.
```
- backText ZH:
```
隐秘隧道与其左边的地点连接。
```
- flavor EN:
```
"...not even the fear of collapse could make us pause before reaching the normal outer realm of sun and sky."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……就算是对遗迹倒塌的恐惧，也不能停下我们奔向有着太阳和天空的正常世界的脚步。”H. P. 洛夫克拉夫特《疯狂山脉》
```
- backFlavor EN:
```
"Thank heaven we did not slacken our run. The curling mist had thickened again, and was driving ahead with increased speed; whilst the straying penguins in our rear were squawking and screaming..."
 - H. P. Lovecraft, At the Mountains of Madness
```
- backFlavor ZH:
```
“谢天谢地，我们没有放慢脚步。卷曲的雾又浓了起来，正加速向我们涌来；而在我们后面的那些迷路的企鹅开始尖叫……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08687 · Primordial Evil / 原初恶魔
- 行号：src/cards/cards-data.js:305987（name/nameZh） · src/cards/cards-data.js:305998（textZh） · src/cards/cards-data.js:305957（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon  ||  怪物 / 幻灵
- text EN:
```
Hunter. Retaliate.
Forced - When you deal any amount of damage to Primordial Evil: Shuffle the top card of the Tekeli-li deck into your deck without looking at it (if you cannot, Primordial Evil attacks you).
```
- text ZH:
```
猎手。反击。
强制 - 在你对原初恶魔造成任意数量的伤害时：将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容(如果你不能这么做，原初恶魔攻击你)。
```

## 08688 · The Madness Within / 潜藏的疯狂
- 行号：src/cards/cards-data.js:306042（name/nameZh） · src/cards/cards-data.js:306053（textZh） · src/cards/cards-data.js:306017（backTextZh）
- pack=eoec · type=treachery
- traits: Curse  ||  诅咒
- text EN:
```
Revelation - Test [willpower] (4). For each point you fail by, shuffle the top card of the Tekeli-li deck into your deck without looking at it (for each card you cannot shuffle, take 1 horror).
```
- text ZH:
```
显现 - 检定[willpower](4)。你检定失败且每低于难度1点，将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容(每有1张卡牌不能混洗入你的牌库，受到1点恐惧)。
```

## 08689 · Manifestation of Madness / 实体疯狂
- 行号：src/cards/cards-data.js:306100（name/nameZh） · src/cards/cards-data.js:306111（textZh） · src/cards/cards-data.js:306070（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon  ||  怪物 / 幻灵
- text EN:
```
Hunter.
Forced - When Manifestation of Madness attacks you: Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them (for each card you cannot shuffle, Manifestation of Madness deals +1 damage and +1 horror for this attack).
```
- text ZH:
```
猎手。
强制 - 在实体疯狂攻击你时：将忒咳哩-哩牌库顶的2张卡牌混洗入你的牌库，不要查看内容(每有1张卡牌不能混洗入你的牌库，实体疯狂该次攻击造成+1伤害和+1恐惧)。
```

## 08690 · Glacial Phantasm / 冰川幻影
- 行号：src/cards/cards-data.js:306160（name/nameZh） · src/cards/cards-data.js:306171（textZh） · src/cards/cards-data.js:306130（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Eidolon  ||  怪物 / 幻灵
- text EN:
```
Forced - At the end of the enemy phase, if Glacial Phantasm is ready: Move it once toward the location with the most investigators. In player order, each investigator at Glacial Phantasm's location or a connecting location shuffles the top card of the Tekeli-li deck into their deck without looking at it (each investigator who cannot takes 1 horror).
```
- text ZH:
```
强制 - 当敌军阶段结束时，如果冰川幻影处于重整状态：将其向调查员最多的地点移动一次。按玩家顺序，每位在冰川幻影所在地点或连接地点的调查员，将忒咳哩-哩牌库顶的1张卡牌混洗入自己的牌库，不要查看内容(每位不能这么做的调查员受到1点恐惧)。
```

## 08691 · Kindred Mist / 同源迷雾
- 行号：src/cards/cards-data.js:306215（name/nameZh） · src/cards/cards-data.js:306226（textZh） · src/cards/cards-data.js:306190（backTextZh）
- pack=eoec · type=treachery
- traits: Curse  ||  诅咒
- text EN:
```
Revelation - Attach to the nearest location without a copy of Kindred Mist attached.
Forced - When 1 or more cards from the Tekeli-li deck would be shuffled into your deck while you are at attached location: Draw them instead, placing them on the bottom of your deck instead of the bottom of the Tekeli-li deck. Discard Kindred Mist at the end of this round.
```
- text ZH:
```
显现 - 附属到最近且没有附属同源迷雾的地点。
强制 - 你在附属地点时，在忒咳哩-哩牌库的卡牌将要混洗入你的牌库时：改为抽取那些卡牌，不要将它们放在忒咳哩-哩牌库底，改为放在你的牌库底。当一轮结束时弃掉同源迷雾。
```

## 08692 · Antarctic Wind / 南极寒风
- 行号：src/cards/cards-data.js:306268（name/nameZh） · src/cards/cards-data.js:306279（textZh） · src/cards/cards-data.js:306243（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Attach to the nearest location without a copy of Antarctic Wind attached.
Investigators at attached location cannot play cards or draw cards from their deck.
Forced - At the end of the round: Discard Antarctic Wind.
```
- text ZH:
```
显现 - 附属到最近且没有附属南极寒风的地点。
位于附属地点的调查员不能打出卡牌，或从自己的牌库抽取卡牌。
强制 - 当一轮结束时：弃掉南极寒风。
```

## 08693 · Whiteout / 雪盲危机
- 行号：src/cards/cards-data.js:306321（name/nameZh） · src/cards/cards-data.js:306332（textZh） · src/cards/cards-data.js:306296（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Attach to your location.
Each investigator at attached location gets -1 [willpower], -1 [intellect], -1 [combat], and -1 [agility].
Forced - At the end of the round: Discard Whiteout.
```
- text ZH:
```
显现 - 附属到你所在地点。
位于附属地点的每位调查员得到-1[willpower]、-1 [intellect]、-1 [combat]、-1 [agility]。
强制 - 当一轮结束时：弃掉雪盲危机。
```

## 08694 · Polar Vortex / 极地旋涡
- 行号：src/cards/cards-data.js:306374（name/nameZh） · src/cards/cards-data.js:306385（textZh） · src/cards/cards-data.js:306349（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with health (including your investigator) takes 1 direct damage.
Forced - At the end of the round: Discard Polar Vortex.
```
- text ZH:
```
显现 - 附属到你所在地点。
强制 - 你在附属地点结束你的回合时：你控制的每张有生命值的卡牌(包括你的调查员)受到1点直接伤害。
强制 - 当一轮结束时：弃掉极地旋涡
```

## 08695 · Elder Thing Scavenger / 古老者清道夫
- 行号：src/cards/cards-data.js:306433（name/nameZh） · src/cards/cards-data.js:306444（textZh） · src/cards/cards-data.js:306402（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Elder Thing  ||  怪物 / 古老者
- text EN:
```
Hunter.
Forced - After Elder Thing Scavenger attacks you: Discard the top 3 cards of your deck. Draw each weakness discarded this way.
```
- text ZH:
```
猎手。
强制 - 在古老者清道夫攻击你后：弃掉你牌库顶3张卡牌。抽取所有以此方式弃掉的弱点。
```
- flavor EN:
```
"Of the life of the Old Ones, both under the sea and after part of them migrated to land, volumes could be written."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“古老者的生活，不论是在海底，还是一部分迁移到陆地上之后，都足以出好几本书了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08696 · Guardian Elder Thing / 古老者守卫
- 行号：src/cards/cards-data.js:306493（name/nameZh） · src/cards/cards-data.js:306504（textZh） · src/cards/cards-data.js:306463（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Elder Thing  ||  怪物 / 古老者
- text EN:
```
Hunter.
Forced - When you deal damage to Guardian Elder Thing: For each point of damage dealt, discard the top card of your deck. Draw each weakness discarded this way.
```
- text ZH:
```
猎手。
强制 - 在你对古老者守卫造成伤害时：每造成1点伤害，弃掉你牌库顶的1张卡牌。抽取所有以此方式弃掉的弱点。
```

## 08697 · Rise of the Elder Things / 古老者崛起
- 行号：src/cards/cards-data.js:306548（name/nameZh） · src/cards/cards-data.js:306559（textZh） · src/cards/cards-data.js:306523（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Find the topmost [[Elder Thing]] enemy in the encounter discard pile and spawn it engaged with you. Each [[Elder Thing]] enemy currently engaged with you gets +1 fight and +1 evade until the end of the round. If Rise of the Elder Things put no enemies into play, it gains surge.
```
- text ZH:
```
显现 - 找出遭遇弃牌堆最顶部的一张[[古老者]]敌人，并将其生成，与你交战。当前与你交战的每个[[古老者]]敌人得到+1攻击和+1躲避，直到一轮结束。如果古老者崛起没有放置敌人入场，其获得涌动。
```

## 08698 · Ice Shaft / 冰缝
- 行号：src/cards/cards-data.js:306602（name/nameZh） · src/cards/cards-data.js:306613（textZh） · src/cards/cards-data.js:306576（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Test [agility] (3). For each [frost] token revealed during this test, take 1 damage. If you fail, take 2 damage.
```
- text ZH:
```
显现 - 检定[agility](3)。本次检定期间每揭示一个[frost]标记，受到1点伤害。如果你检定失败，受到2点伤害。
```
- flavor EN:
```
One false step...
```
- flavor ZH:
```
一失足……
```

## 08699 · Through the Ice / 穿越冰雪
- 行号：src/cards/cards-data.js:306655（name/nameZh） · src/cards/cards-data.js:306666（textZh） · src/cards/cards-data.js:306630（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Attach to the nearest location without a copy of Through the Ice attached.
As an additional cost for you to enter or leave attached location (except by a scenario card effect), test [agility] (2). If you fail, cancel the effects of the move, take 1 damage and 1 horror, and discard Through the Ice.
```
- text ZH:
```
显现 - 附属到最近且没有附属穿越冰雪的地点。
作为进入或离开附属地点(除因冒险卡牌效果外)的额外费用，检定[agility](2)。如果你检定失败，取消本次移动的效果，受到1点伤害和1点恐惧，并弃掉穿越冰雪。
```

## 08700 · Lost Researcher / 迷失的研究员
- 行号：src/cards/cards-data.js:306713（name/nameZh） · src/cards/cards-data.js:306724（textZh） · src/cards/cards-data.js:306683（backTextZh）
- pack=eoec · type=enemy
- traits: Humanoid / Possessed  ||  类人 / 附身
- text EN:
```
Spawn - Any location (empty, if able).
Lost Researcher enters play with 1 doom on it.
Forced - When Lost Researcher is defeated: Move each doom on it to its location.
[action]: Parley. Test [willpower] or [intellect] (3). If you succeed, take control of 1 doom on Lost Researcher and flip it to its clue side. Then, if there is no doom on Lost Researcher, discard it.
```
- text ZH:
```
生成 - 任意地点(如可能，则生成在无人地点)。
迷失的研究员入场时，带有1个毁灭标记。
强制 - 在迷失的研究员被击败时：将其上的所有毁灭标记移动到其所在地点。
[action]：谈判。检定[willpower]或[intellect](3)。如果你检定成功，控制迷失的研究员上的1个毁灭标记并将其翻至线索面。然后，如果迷失的研究员上没有毁灭标记，将其弃掉。
```

## 08701 · Frenzied Explorer / 狂乱的探险家
- 行号：src/cards/cards-data.js:306773（name/nameZh） · src/cards/cards-data.js:306784（textZh） · src/cards/cards-data.js:306743（backTextZh）
- pack=eoec · type=enemy
- traits: Humanoid / Possessed  ||  类人 / 附身
- text EN:
```
Frenzied Explorer enters play with 1 doom on it.
Forced - When Frenzied Explorer is defeated: Move each doom on it to its location.
[reaction] After you successfully evade Frenzied Explorer by 2 or more: Take control of 1 doom on Frenzied Explorer and flip it to its clue side. Then, if there is no doom on Frenzied Explorer, discard it.
```
- text ZH:
```
狂乱的探险家入场时，带有1个毁灭标记。
强制 - 在狂乱的探险家被击败时：将其上的所有毁灭标记移动到其所在地点。
[reaction]在你成功躲避狂乱的探险家，且超过难度至少2点后：控制狂乱的探险家上的1个毁灭标记并将其翻至线索面。然后，如果狂乱的探险家上没有毁灭标记，将其弃掉。
```

## 08702 · Abandoned to Madness / 身陷疯狂
- 行号：src/cards/cards-data.js:306828（name/nameZh） · src/cards/cards-data.js:306839（textZh） · src/cards/cards-data.js:306803（backTextZh）
- pack=eoec · type=treachery
- traits: Curse  ||  诅咒
- text EN:
```
Revelation - Attach to the nearest [[Possessed]] enemy and place 1 doom on that enemy. If there are no [[Possessed]] enemies in play, search the encounter deck and discard pile for a [[Possessed]] enemy, draw it, and attach Abandoned to Madness to it (shuffle the encounter deck).
Increase the difficulty to fight, evade, or parley with attached enemy by 1.
```
- text ZH:
```
显现 - 附属到最近的[[附身]]敌人，并在该敌人上放置1个毁灭标记。如果场上没有[[附身]]敌人，查找遭遇牌库及弃牌堆，从中找出并抽取一个[[附身]]敌人，并将身陷疯狂附属到该敌人(混洗遭遇牌库)。
与该敌人进行的攻击、躲避或谈判的难度增加1。
```

## 08703 · Blasphemous Visions / 渎神幻象
- 行号：src/cards/cards-data.js:306881（name/nameZh） · src/cards/cards-data.js:306892（textZh） · src/cards/cards-data.js:306856（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Shuffle the top card of the Tekeli-li deck into your deck without looking at it. Then, put Blasphemous Visions into play in your threat area.
Resolve the effects of each Tekeli-li weakness you draw an additional time.
[action]: Test [willpower] (3). If you succeed, discard Blasphemous Visions.
```
- text ZH:
```
显现 - 将忒咳哩-哩牌库顶的1张卡牌混洗入你的牌库，不要查看内容。然后，将渎神幻象放置入场，放到你的威胁区域。
你抽取的每张忒咳哩-哩弱点的效果额外结算一次。
[action]：检定[willpower](3)。如果你检定成功，弃掉渎神幻象。
```

## 08704 · Glimpse the Unspeakable / 窥看不可说之事
- 行号：src/cards/cards-data.js:306934（name/nameZh） · src/cards/cards-data.js:306945（textZh） · src/cards/cards-data.js:306909（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Peril.
Revelation - Draw the top card of the Tekeli-li deck (and resolve its effects). Shuffle it into any investigator's deck instead of placing it on the bottom of the Tekeli-li deck. If no Tekeli-li weakness is drawn by this effect, Glimpse the Unspeakable gains surge.
```
- text ZH:
```
险境。
显现 - 抽取忒咳哩-哩牌库顶的1张卡牌(并结算其效果)。不要将其放到忒咳哩-哩牌库底，改为混洗入任意一位调查员的牌库。如果没有以此效果抽取忒咳哩-哩弱点，窥看不可说之事获得涌动。
```

## 08705 · Nightmarish Vapors / 噩梦烟气
- 行号：src/cards/cards-data.js:306987（name/nameZh） · src/cards/cards-data.js:306998（textZh） · src/cards/cards-data.js:306962（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Peril.
Revelation - You must either (choose one):
- Lose 2 actions.
- Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them.
```
- text ZH:
```
险境。
显现 - 你必须(选择以下一项)：
- 失去2个行动。
- 将忒咳哩-哩牌库顶的2张卡牌混洗入你的牌库，不要查看内容。
```

## 08706 · Miasmatic Torment / 瘴气折磨
- 行号：src/cards/cards-data.js:307040（name/nameZh） · src/cards/cards-data.js:307051（textZh） · src/cards/cards-data.js:307015（backTextZh）
- pack=eoec · type=treachery
- traits: Curse  ||  诅咒
- text EN:
```
Revelation - If you control a partner asset, exhaust them and attach Miasmatic Torment to them. Otherwise, Miasmatic Torment gains surge.
Attached asset cannot ready.
Forced - At the end of your turn: Attached asset takes 1 damage or 1 horror.
[action]: Test [willpower] or [intellect] (3). If you succeed, discard Miasmatic Torment.
```
- text ZH:
```
险境。
显现 - 如果你控制伙伴支援，将其横置，并将瘴气折磨附属到该支援。否则，瘴气折磨获得涌动。
被附属的支援不能重整。
强制 - 当你的回合结束时：被附属的支援受到1点伤害或1点恐惧。
[action]：检定[willpower]或[intellect](3)。如果你检定成功，弃掉瘴气折磨。
```

## 08707 · Nebulous Miasma / 朦胧瘴气
- 行号：src/cards/cards-data.js:307093（name/nameZh） · src/cards/cards-data.js:307104（textZh） · src/cards/cards-data.js:307068（backTextZh）
- pack=eoec · type=treachery
- traits: Curse / Hazard  ||  诅咒 / 危险
- text EN:
```
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with sanity (including your investigator) takes 1 direct horror.
Forced - At the end of the round: Discard Nebulous Miasma.
```
- text ZH:
```
险境。
显现 - 附属到你所在地点。
强制 - 你在附属地点结束你的回合时：你控制的每张有神智值的卡牌(包括你的调查员)受到1点直接恐惧。
强制 - 当一轮结束时：弃掉朦胧瘴气。
```

## 08708 · Giant Albino Penguin / 巨型白化企鹅
- 行号：src/cards/cards-data.js:307154（name/nameZh） · src/cards/cards-data.js:307165（textZh） · src/cards/cards-data.js:307123（backTextZh）
- pack=eoec · type=enemy
- traits: Creature  ||  生物
- text EN:
```
Aloof.
As an additional cost for you to enter or leave this enemy's location, you must spend 1 action.
```
- text ZH:
```
冷漠。
作为进入或离开本敌人所在地点的额外费用，你必须花费1个行动。
```
- flavor EN:
```
"...it was only a penguin - albeit of a huge, unknown species larger than the greatest of the known king penguins, and monstrous in its combined albinism and virtual eyelessness."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……那只是一只企鹅——是一种未知的巨型白化种，比帝企鹅中已知最大的还要大，而其白化的外观和无目的的眼睛非常怪异。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08709 · Wuk! Wuk! Wuk! / 呜啊！呜啊！呜啊！
- 行号：src/cards/cards-data.js:307207（name/nameZh） · src/cards/cards-data.js:307218（textZh） · src/cards/cards-data.js:307182（backTextZh）
- pack=eoec · type=treachery
- traits: Hazard  ||  危险
- text EN:
```
Revelation - Find the Giant Albino Penguin enemy farthest from you. You must either move it to your location or place 1 doom on it. If there are no Giant Albino Penguins in play, search the encounter deck and discard pile for a Giant Albino Penguin, draw it, and shuffle the encounter deck.
```
- text ZH:
```
显现 - 找到离你最远的巨型白化企鹅敌人。你必须将其移动到你所在地点，或在其上放置1个毁灭标记。如果场上没有巨型白化企鹅敌人，查找遭遇牌库及弃牌堆，从中找出并抽取一个巨型白化企鹅，并混洗遭遇牌库。
```

## 08710 · Forgotten Shoggoth / 失落的修格斯
- 行号：src/cards/cards-data.js:307266（name/nameZh） · src/cards/cards-data.js:307277（textZh） · src/cards/cards-data.js:307235（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Shoggoth  ||  怪物 / 修格斯
- text EN:
```
Hunter.
Forced - After Forgotten Shoggoth engages you: Draw the top card of the Tekeli-li deck (if you cannot, Forgotten Shoggoth attacks you).
```
- text ZH:
```
猎手。
强制 - 失落的修格斯与你交战后：抽取忒咳哩-哩牌库顶的1张卡牌(如果你不能这么做，失落的修格斯攻击你)。
```
- flavor EN:
```
"...shoggoths and their work ought not to be seen by human beings or portrayed by any beings."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“……修格斯与其作为，不该被任何人目睹，也不该被任何生物记述。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08711 · Rampaging Shoggoth / 狂暴的修格斯
- 行号：src/cards/cards-data.js:307326（name/nameZh） · src/cards/cards-data.js:307337（textZh） · src/cards/cards-data.js:307296（backTextZh）
- pack=eoec · type=enemy
- traits: Monster / Shoggoth / Elite  ||  怪物 / 修格斯 / 精英
- text EN:
```
Hunter. Massive.
Rampaging Shoggoth gets +2 [per_investigator] health.
Forced - At the end of the enemy phase: Deal 2 damage to each investigator and non-[[Shoggoth]] enemy at Rampaging Shoggoth's location. Each of those investigators draws the top card of the Tekeli-li deck.
```
- text ZH:
```
猎手。 庞大。
狂暴的修格斯得到+2[per_investigator]生命值。
强制 - 当敌军阶段结束时：对狂暴的修格斯所在地点的每位调查员和每个非[[修格斯]]敌人造成2点伤害。这些调查员各自抽取忒咳哩-哩牌库顶的1张卡牌。
```

## 08712 · Polar Mirage / 极地幻景
- 行号：src/cards/cards-data.js:307384（name/nameZh） · src/cards/cards-data.js:307395（textZh） · src/cards/cards-data.js:307359（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Attach to the nearest location with at least 1 clue, and without a copy of Polar Mirage attached.
Forced - After you discover or take control of 1 or more clues at attached location: Discard each non-weakness card in your hand. Discard Polar Mirage.
```
- text ZH:
```
显现 - 附属到最近的有线索且没有附属极地幻景的地点。
强制 - 你发现附属地点的线索，或控制附属地点的线索后：弃掉你手中所有非弱点卡牌。弃掉极地幻景。
```

## 08713 · Dark Aurora / 黑暗极光
- 行号：src/cards/cards-data.js:307438（name/nameZh） · src/cards/cards-data.js:307449（textZh） · src/cards/cards-data.js:307412（backTextZh）
- pack=eoec · type=treachery
- traits: Terror  ||  恐怖
- text EN:
```
Revelation - Test [willpower] (3). For each [frost] token revealed during this test, take 1 horror. If you fail, take 2 horror.
```
- text ZH:
```
显现 - 检定[willpower](3)。本次检定期间每揭示一个[frost]标记，受到1点恐惧。如果你检定失败，受到2点恐惧。
```
- flavor EN:
```
"The phosphorescent organisms supplied light with vast effectiveness, and doubtless atoned for the loss of the familiar polar auroras of the outer-world night."
 - H. P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“这种磷光生物提供的光线非常有效，毫无疑问，此处缺失的如同外界夜晚的极光的问题被它弥补了。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08714 · Professor William Dyer / 威廉·戴尔教授
- 行号：src/cards/cards-data.js:307494（name/nameZh） · src/cards/cards-data.js:307507（textZh） · src/cards/cards-data.js:307466（backTextZh）
- pack=eoec · type=asset · subname=Professor of Geology / 地质学教授
- traits: Ally / Miskatonic  ||  盟友 / 米斯卡塔尼克
- text EN:
```
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.
```
- text ZH:
```
伙伴。使用(3秘密)。
[action]花费1秘密并横置威廉·戴尔教授：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点恐惧。
```
- flavor EN:
```
"Doubt of the real facts, as I must reveal them, is inevitable."
 - H.P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“我必须揭露事实真相，尽管质疑是无法避免的。”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08715 · Danforth / 丹佛斯
- 行号：src/cards/cards-data.js:307554（name/nameZh） · src/cards/cards-data.js:307567（textZh） · src/cards/cards-data.js:307526（backTextZh）
- pack=eoec · type=asset · subname=Brilliant Student / 杰出学生
- traits: Ally / Miskatonic  ||  盟友 / 米斯卡塔尼克
- text EN:
```
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 2 cards.
```
- text ZH:
```
伙伴。使用(5秘密)。
[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费1秘密：该调查员抽取2张卡牌。
```
- flavor EN:
```
"Danforth was a great reader of bizarre material..."
 - H.P. Lovecraft, At the Mountains of Madness
```
- flavor ZH:
```
“丹佛斯读了不少稀奇古怪的书……”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08716 · Eliyah Ashevak / 伊里亚·阿什瓦克
- 行号：src/cards/cards-data.js:307614（name/nameZh） · src/cards/cards-data.js:307627（textZh） · src/cards/cards-data.js:307586（backTextZh）
- pack=eoec · type=asset · subname=Dog Handler / 驯犬师
- traits: Ally / Wayfarer  ||  盟友 / 旅人
- text EN:
```
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 5. If you succeed, you may move to a connecting location.
```
- text ZH:
```
伙伴。使用(3秘密)。
[action]花费1秘密并横置伊里亚·阿什瓦克：躲避。以基础值为5的[agility]尝试躲避。如果你检定成功，你可以移动到一个连接地点。
```
- flavor EN:
```
"Anyu's got the scent. Haven't you, girl?"
```
- flavor ZH:
```
“安雨闻到了气味。是吧，小姑娘？”
```

## 08717 · Dr. Mala Sinha / 玛拉·辛哈医生
- 行号：src/cards/cards-data.js:307674（name/nameZh） · src/cards/cards-data.js:307687（textZh） · src/cards/cards-data.js:307646（backTextZh）
- pack=eoec · type=asset · subname=Daring Physician / 无畏医师
- traits: Ally / Wayfarer  ||  盟友 / 旅人
- text EN:
```
Partner. Uses (3 supplies).
[action] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.
```
- text ZH:
```
伙伴。使用(3补给)。
[action]花费1补给并横置玛拉·辛哈医生：治愈你所在地点的一位调查员或另一个[[盟友]]支援2点伤害。
```
- flavor EN:
```
"Want to survive the trip? Good. Then don't get on my bad side."
```
- flavor ZH:
```
“想活着回去吗？很好。那就不要惹毛我。”
```

## 08718 · Avery Claypool / 艾弗里·克莱普尔
- 行号：src/cards/cards-data.js:307734（name/nameZh） · src/cards/cards-data.js:307747（textZh） · src/cards/cards-data.js:307706（backTextZh）
- pack=eoec · type=asset · subname=Antarctic Guide / 南极向导
- traits: Ally / Wayfarer  ||  盟友 / 旅人
- text EN:
```
Partner. Uses (5 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool and spend 1 supply: Cancel that token and reveal a new one.
```
- text ZH:
```
伙伴。使用(5补给)。
[reaction]你所在地点的一位调查员在技能检定期间揭示了一个[frost]标记时，横置艾弗里·克莱普尔并花费1补给：取消该标记并揭示一个新的标记。
```
- flavor EN:
```
"Weather is turning foul again. I would tell you to turn back, but I gather you would refuse - right?"
```
- flavor ZH:
```
“天气又变坏了。我建议你回头，但我猜你不会同意——是吧？”
```

## 08719 · James "Cookie" Fredericks / 詹姆斯·“曲奇”·弗雷德里克斯
- 行号：src/cards/cards-data.js:307794（name/nameZh） · src/cards/cards-data.js:307807（textZh） · src/cards/cards-data.js:307766（backTextZh）
- pack=eoec · type=asset · subname=Dubious Choice / 不可靠人选
- traits: Ally / Veteran / Wayfarer  ||  盟友 / 老兵 / 旅人
- text EN:
```
Partner. Uses (3 ammo).
[action] Spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 5. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.
```
- text ZH:
```
伙伴。使用(3子弹)。
[action] 花费1子弹并横置詹姆斯·“曲奇”·弗雷德里克斯：攻击。以基础值为5的[combat]攻击。如果你检定成功，且被攻击的敌人非[[精英]]，则直到本轮结束其不能攻击。
```
- flavor EN:
```
"No I ain't leavin' my damn gun back at camp!"
```
- flavor ZH:
```
“老子可不打算把枪留在营地里！”
```

## 08720 · Dr. Amy Kensler / 艾米·肯斯勒博士
- 行号：src/cards/cards-data.js:307856（name/nameZh） · src/cards/cards-data.js:307869（textZh） · src/cards/cards-data.js:307828（backTextZh）
- pack=eoec · type=asset · subname=Professor of Biology / 生物学教授
- traits: Ally / Miskatonic  ||  盟友 / 米斯卡塔尼克
- text EN:
```
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Dr. Amy Kensler: Investigate. Investigate with a base [intellect] skill of 5. If you succeed, look at the top card of any investigator's deck or the encounter deck. You may discard that card.
```
- text ZH:
```
伙伴。使用(3秘密)。
[action]花费1秘密并横置艾米·肯斯勒博士：调查。以基础值为5的[intellect]调查。如果你检定成功，查看任意一位调查员牌库顶的1张卡牌或遭遇牌库顶的1张卡牌。你可以弃掉该卡牌。
```
- flavor EN:
```
"All of this is so fascinating! Do you not agree?"
```
- flavor ZH:
```
“这一切太迷人了！你不这么认为吗？”
```

## 08721 · Roald Ellsworth / 罗尔德·埃尔斯沃思
- 行号：src/cards/cards-data.js:307916（name/nameZh） · src/cards/cards-data.js:307929（textZh） · src/cards/cards-data.js:307888（backTextZh）
- pack=eoec · type=asset · subname=Intrepid Explorer / 英勇的探险家
- traits: Ally / Miskatonic / Wayfarer  ||  盟友 / 米斯卡塔尼克 / 旅人
- text EN:
```
Partner. Uses (5 supplies).
[fast] During an investigator's turn, exhaust Roald Ellsworth and spend 1 supply: Choose a treachery attached to any location. Treat that treachery's text box as if it were blank until the end of this turn.
```
- text ZH:
```
伙伴。使用(5补给)。
[free]任意调查员回合期间，横置罗尔德·埃尔斯沃思并花费1补给：选择一张附属到任意地点的诡计。将所选诡计的印刷文本框视为如同空白，直到本回合结束。
```
- flavor EN:
```
"I have been all over the world. Please, just trust me."
```
- flavor ZH:
```
“我去过世界各地。拜托了，相信我就行。”
```

## 08722 · Takada Hiroko / 高田弘子
- 行号：src/cards/cards-data.js:307978（name/nameZh） · src/cards/cards-data.js:307991（textZh） · src/cards/cards-data.js:307950（backTextZh）
- pack=eoec · type=asset · subname=Aeroplane Mechanic / 飞机技师
- traits: Ally / Wayfarer  ||  盟友 / 旅人
- text EN:
```
Partner. Uses (9 resources).
[action] Exhaust Takada Hiroko: Move up to 3 resources from Takada Hiroko to your resource pool.
```
- text ZH:
```
伙伴。使用(9资源)。
[action]横置高田弘子：将高田弘子上的最多3资源移动到你的资源池。
```
- flavor EN:
```
"Nobody knows these machines better than I do."
```
- flavor ZH:
```
“没有人比我更了解这些机器。”
```

## 08723 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308037（name/nameZh） · src/cards/cards-data.js:308049（textZh） · src/cards/cards-data.js:308010（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Take 1 horror. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 受到1点恐惧。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08724 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308093（name/nameZh） · src/cards/cards-data.js:308105（textZh） · src/cards/cards-data.js:308066（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Take 1 damage. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 受到1点伤害。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08725 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308149（name/nameZh） · src/cards/cards-data.js:308161（textZh） · src/cards/cards-data.js:308122（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Discard 1 card at random from your hand. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 随机弃掉1张手牌。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08726 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308205（name/nameZh） · src/cards/cards-data.js:308217（textZh） · src/cards/cards-data.js:308178（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Lose 2 resources. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 失去2资源。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08727 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308261（name/nameZh） · src/cards/cards-data.js:308273（textZh） · src/cards/cards-data.js:308234（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - If it is your turn, lose 1 action. Otherwise, lose 1 action during your next turn. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 如果现在是你的回合，失去1个行动。否则，你的下一个回合期间失去1个行动。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08728 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308317（name/nameZh） · src/cards/cards-data.js:308329（textZh） · src/cards/cards-data.js:308290（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Place 1 of your clues on your location. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 将你的1个线索放到你所在地点。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08729 · Tekeli-li / 忒咳哩-哩
- 行号：src/cards/cards-data.js:308373（name/nameZh） · src/cards/cards-data.js:308385（textZh） · src/cards/cards-data.js:308346（backTextZh）
- pack=eoec · type=treachery
- traits: Madness  ||  疯狂
- text EN:
```
Revelation - Discard an asset you control. Place Tekeli-li on the bottom of the Tekeli-li deck.
```
- text ZH:
```
显现 - 弃掉你控制的一张支援。将忒咳哩-哩放到忒咳哩-哩牌库底。
```
- flavor EN:
```
"Still came that eldritch, mocking cry - 'Tekeli-li! Tekeli-li!'"
 - H.P. Lovecraft, At the Mountains of Madness.
```
- flavor ZH:
```
“耳边依旧传来那怪异、嘲弄般的喊声——‘忒咳哩-哩！忒咳哩-哩！’”H. P. 洛夫克拉夫特《疯狂山脉》
```

## 08730 · Claypool's Furs / 克莱普尔的皮草
- 行号：src/cards/cards-data.js:308433（name/nameZh） · src/cards/cards-data.js:308448（textZh） · src/cards/cards-data.js:308402（backTextZh）
- pack=eoec · type=asset
- traits: Item / Clothing  ||  道具 / 服装
- text EN:
```
Fast.
[reaction] When you reveal a [frost] token during a skill test you are performing, deal 1 damage to Claypool's Furs: Cancel that chaos token and return it to the bag. Reveal a new chaos token.
```
- text ZH:
```
快速。
[reaction]你执行的技能检定期间，在你揭示一个[frost]标记时，对克莱普尔的皮草造成1点伤害：取消该混乱标记并将其放回混乱袋。揭示一个新的混乱标记。
```

## 08731 · Collected Works of Poe / 爱伦·坡作品集
- 行号：src/cards/cards-data.js:308497（name/nameZh） · src/cards/cards-data.js:308512（textZh） · src/cards/cards-data.js:308467（backTextZh）
- pack=eoec · type=asset
- traits: Item / Tome  ||  道具 / 书籍
- text EN:
```
Uses (3 charges).
[action] Spend 1 charge: Choose an investigator at your location to search the top 6 cards of their deck for each copy of Tekeli-li and place each of them on the bottom of the Tekeli-li deck. Shuffle that investigator's deck. That investigator draws 1 card.
```
- text ZH:
```
使用(3充能)。
[action]花费1充能：选择你所在地点的一位调查员，其查找自己牌库顶的6张卡牌，找出其中所有忒咳哩-哩，并将这些卡牌都放在忒咳哩-哩牌库底。混洗该调查员的牌库。该调查员抽取1张卡牌。
```

## 08732 · Cookie's Custom .32 / 曲奇的特制.32手枪
- 行号：src/cards/cards-data.js:308561（name/nameZh） · src/cards/cards-data.js:308576（textZh） · src/cards/cards-data.js:308531（backTextZh）
- pack=eoec · type=asset
- traits: Item / Weapon / Firearm  ||  道具 / 武器 / 枪械
- text EN:
```
Fast. Uses (2 ammo).
[action] Spend 1 ammo: Fight. Either fight with a base [combat] skill of 5, or get +2 [combat] for this attack. This attack deals +1 damage.
```
- text ZH:
```
快速。 使用(2子弹)。
[action]花费1子弹：攻击。以基础值为5的[combat]攻击，或者本次攻击得到+2[combat]。本次攻击造成+1伤害。
```

## 08733 · Dyer's Sketches / 戴尔的素描
- 行号：src/cards/cards-data.js:308628（name/nameZh） · src/cards/cards-data.js:308639（textZh） · src/cards/cards-data.js:308597（backTextZh）
- pack=eoec · type=event
- traits: Insight  ||  洞察
- text EN:
```
Fast. Play during any [fast] window.
Draw 3 cards.
```
- text ZH:
```
快速。可在任何[free]时间段期间打出。
抽取3张卡牌。
```
- flavor EN:
```
Professor Dyer kept many sketches depicting the creatures he encountered.
```
- flavor ZH:
```
戴尔教授保留着许多描绘着他遇到的生物的素描。
```

## 08734 · Ellsworth's Boots / 埃尔斯沃思的靴子
- 行号：src/cards/cards-data.js:308686（name/nameZh） · src/cards/cards-data.js:308697（textZh） · src/cards/cards-data.js:308656（backTextZh）
- pack=eoec · type=asset
- traits: Item / Clothing / Footwear  ||  道具 / 服装 / 鞋子
- text EN:
```
Limit 1 [[Footwear]] per investigator.
[reaction] After the last clue is discovered from your location, exhaust Ellsworth's Boots: Move to a connecting location, or discard Ellsworth's Boots to move to any revealed location.
```
- text ZH:
```
每位调查员仅限1张[[鞋子]]。
[reaction]你所在地点的最后一个线索被发现后，横置埃尔斯沃思的靴子：移动到一个连接地点，或者弃掉埃尔斯沃思的靴子来移动到任意一个已揭示地点。
```

## 08735 · Kensler's Log / 肯斯勒的日志
- 行号：src/cards/cards-data.js:308748（name/nameZh） · src/cards/cards-data.js:308763（textZh） · src/cards/cards-data.js:308718（backTextZh）
- pack=eoec · type=asset
- traits: Item / Tome  ||  道具 / 书籍
- text EN:
```
Fast. Uses (2 secrets).
[action] Spend 1 secret: Investigate. Either investigate with a base [intellect] skill of 5, or get +2 [intellect] for this investigation. If you succeed, you discover 1 additional clue at your location.
```
- text ZH:
```
快速。使用(2秘密)。
[action]花费1秘密：调查。以基础值为5的[intellect]调查，或者本次调查得到+2[intellect]。如果你检定成功，发现你所在地点额外1个线索。
```

## 08736 · Sinha's Medical Kit / 辛哈的医药箱
- 行号：src/cards/cards-data.js:308812（name/nameZh） · src/cards/cards-data.js:308823（textZh） · src/cards/cards-data.js:308782（backTextZh）
- pack=eoec · type=asset
- traits: Item / Science  ||  道具 / 科学
- text EN:
```
Uses (3 supplies).
[fast] Exhaust Sinha's Medical Kit and spend 1 supply: Heal 1 damage or 1 horror from an investigator or [[Ally]] asset at your location.
```
- text ZH:
```
使用(3补给)。
[free]横置辛哈的医药箱并花费1补给：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害或1点恐惧。
```

## 08737 · Takada's Cache / 高田的物品
- 行号：src/cards/cards-data.js:308872（name/nameZh） · src/cards/cards-data.js:308883（textZh） · src/cards/cards-data.js:308842（backTextZh）
- pack=eoec · type=event
- traits: Supply  ||  供给
- text EN:
```
Fast. Play during any [fast] window.
Gain 3 resources and draw 1 card. Remove Takada's Cache from the game.
```
- text ZH:
```
快速。可在任何[free]时间段期间打出。
获得3资源并抽取1张卡牌。
将高田的物品从游戏中移除。
```
- flavor EN:
```
Takada left these spare supplies behind. Maybe you can make use of them.
```
- flavor ZH:
```
高田留下了这些备用物资。也许你可以利用它们。
```

## 08738 · Anyu / 安雨
- 行号：src/cards/cards-data.js:308931（name/nameZh） · src/cards/cards-data.js:308948（textZh） · src/cards/cards-data.js:308900（backTextZh）
- pack=eoec · type=asset · subname=Faithful Companion / 忠诚伴侣
- traits: Ally / Creature  ||  盟友 / 生物
- text EN:
```
[fast] Exhaust Anyu: Choose one, or discard Anyu to choose up to three, in any order -
 - Move to a connecting location.
 - You get +2 skill value for your next skill test this round.
 - Evade. Attempt to evade with a base [agility] skill of 4.
```
- text ZH:
```
[free]横置安雨：选择一项，或弃掉安雨来选择最多三项(以任意顺序)——
- 移动到一个连接地点。
- 你本轮下次技能检定中得到技能值+2。
- 躲避。以基础值为4的[agility]尝试躲避。
```

