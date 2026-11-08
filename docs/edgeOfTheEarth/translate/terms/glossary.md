# 《地球边缘》术语总表（terms / glossary）

> 审计：terms-audit，2026-11-09。范围：EOTE 08 号段全部中译层（卡面 403 卡、剧情 8 章+战役、8 份指南、23 条规则书、战役模块）。
> 统计口径：脚本 `docs/edgeOfTheEarth/translate/tools/terms-scan.mjs`（从 Mod 根 `node … --write`）；数字为**去重后中译语料**出现次数（cards=1521 条/49,353 汉字，story=429 条/55,989，guides=207/26,040，rules=94/5,747，modules=84/307）。
> 推荐原则：**卡面（上游 ArkhamDB 简中 `cards_zh-cn.json`）>`剧本/指南`>`rules`**；与上游一致的问题标 `upstream-zh-cn`（继承），仓库自写/规则书偏差标 `repo-authored`。
> 每个术语的完整样本（path:line）见 `findings.json` 与 `node … --term=<id>`。

## 一、规则术语

| # | EN | 推荐中译 | 观察到的变体（层/次数） | 结论与代表位置 |
| --- | --- | --- | --- | --- |
| 1 | doom / doom token | **毁灭标记** | 毁灭标记 30（cards23/story4/guides2/rules1）；未发现「末日标记」 | 统一，无问题。`src/cards/cards-data.js:293912` |
| 2 | clue | **线索** | 线索 147；无「提示/线索标记」 | 统一。`src/cards/cards-data.js:293975` |
| 3 | horror | **恐惧**（规则值） | 恐惧 117；恐怖 50（cards34/story10/guides6） | 「恐怖」是特性 Terror / 形容词用法（如「恐怖阴影」「令人恐怖」），不能替换规则值「恐惧」。`src/cards/cards-data.js:285397` |
| 4 | damage | **伤害** | 伤害 143；「损伤」仅 3 次为特性 Injury 译名 | 统一；勿把 Injury/损伤 当 damage。`src/cards/cards-data.js:285465` |
| 5 | asset | **支援** | 支援 151；未发现「资产」 | 统一（参考工程 UI 偶见「资产」，本仓 08 段 0 次）。`src/cards/cards-data.js:285397` |
| 6 | event / skill | **事件 / 技能** | 事件 18；技能 92（「技巧」为特性 Trick） | 统一。 |
| 7 | treachery | **诡计** | 诡计 19；「阴谋」18 仅为剧情叙事（阴谋被挫败） | 卡牌类型与效果文本用「诡计」。`src/cards/cards-data.js:288814` |
| 8 | enemy | **敌人** | 敌人 191；「敌军」6 次全部是固定流程名「敌军阶段」（与仓库 UI/规则书一致） | 统一；**不是**误译。`src/cards/cards-data.js:296596` |
| 9 | location | **地点** | 地点 523；「位置」10 为普通用语 | 统一。`src/cards/cards-data.js:293964` |
| 10 | agenda | **密谋** | 密谋 33；**议程 5（仅 rules，见 findings terms-0007）** | 规则书须改「密谋」。`web/eote-rules.js:109,237,238` |
| 11 | act | **幕** | 幕 23 | 统一（另有「幕间」=interlude，独立词）。 |
| 12 | resolution | **结局** | 结局 103；「结算」47 为动词 resolve | 区分「结局（卡片）」与「结算（动作）」。 |
| 13 | scenario | **规则文本「场景」；正式关卡术语「剧本」；叙事「冒险」** | 剧本 171（cards47/story71/guides43/rules10）；场景 50（cards42）；冒险 97（story56）；章节 14（rules9/story4） | 卡面「推进场景」、规则书「剧本」、剧情「本冒险」并存；同一层内不混用即可（findings 未单列，属口径说明）。 |
| 14 | campaign | **战役** | 战役 33（rules22） | 统一。 |
| 15 | campaign log | **剧本日志** | 剧本日志 132（cards33/story60/guides39）；**战役日志 12（仅 rules，findings terms-0006）** | 推荐跟卡面「剧本日志」。`src/cards/cards-data.js:293975` / `web/eote-rules.js:24,25` |
| 16 | shelter (value) | **庇护值** | 庇护值 35；卡面地点印作「庇护N」15 次（findings terms-0018）；「庇护所/避难所」为物理藏身处叙事词 | 推荐「庇护值」；卡面「庇护N」需 cards 审计裁定。`src/cards/cards-data.js:293975` |
| 17 | supplies | **按语境：卡面使用次数「补给」；战役资源「物资」；固定记录名「已回收的补给品」** | 补给 56（cards28）、补给品 28、物资 19（story5/rules11） | 三义并存但各有语境；同一句内不混用（详见 §五 用字规范）。`src/cards/cards-data.js:290226` / `web/eote-rules.js:157` |
| 18 | partner | **伙伴**（关键词/规则文本） | 伙伴 81；「同伴」61（story32/guides20 叙事）、「队友」4（叙事） | 规则与关键词一律「伙伴」；叙事「同伴」可接受，但同段不混用（低优先）。`src/cards/cards-data.js:300249` |
| 19 | expedition | **探险** | 探险 241；「考察」7（story4/guides3） | 统一（考察为叙事动词）。 |
| 20 | frost token | **寒霜标记** | 寒霜标记 5（rules）+ 寒霜 12（rules 正文简写）；卡面用 `[frost]` 图标 | 规则书条目名用「寒霜标记」；正文「寒霜」指标记时可接受。`web/eote-rules.js:35` |
| 21 | key | **钥匙** | 钥匙 48（cards32/rules15） | 统一。 |
| 22 | seal / seal token | **封印 / 封印标记** | 封印 147；封印标记 3 | 卡面用 `[seal_a]–[seal_e]` 图标，规则书用「封印标记」。`web/eote-rules.js` |
| 23 | token | **标记** | 标记 167；「token」残留 0（详见表 §三） | 统一。 |
| 24 | investigator | **调查员** | 调查员 584 | 统一。 |
| 25 | weakness | **弱点** | 弱点 52 | 统一。 |
| 26 | deck / discard pile | **牌库（卡面口径）/ 牌组（构筑 UI）/ 牌堆（公共牌堆）/ 弃牌堆** | 牌库 218（cards206/rules12）；牌组 89（story62/rules22）；牌堆 47（story37）；弃牌堆 6 | 规则文本应统一「牌库」，story/guides 的「牌组」建议改；「弃牌堆」正确（findings terms-0014）。`src/cards/cards-data.js:285415` / `story-text.js:2284` |
| 27 | encounter set | **遭遇组** | 遭遇组 49 | 统一；「遭遇牌堆」为 encounter deck（另一概念）。 |
| 28 | campaign / check point / interlude | **战役 / 检查点 / 幕间** | 检查点 20、幕间 30 | 统一。 |
| 29 | enemy phase | **敌军阶段** | 敌军阶段 6（cards）；与仓库 UI/规则书一致 | 固定流程名，勿改「敌人阶段」。`src/cards/cards-data.js:296596` |
| 30 | trauma | **创伤** | 创伤 30 | 统一。 |
| 31 | victory display | **胜利区** | 胜利区 74 | 与 Victory 关键词（胜利点）不同概念。 |
| 32 | uncharted | **未勘之地** | 未勘之地 13（cards9/story2/guides2） | 地点特性 [[Uncharted]] 译名统一。`src/cards/cards-data.js:294602` |
| 33 | ancient one / elder things | **古神 / 古老者** | 古神 16；古老者 89 | 两个不同特性：Ancient One=古神，Elder Things=古老者。「远古者/上古者」0 次。 |
| 34 | possessed / eidolon / hazard | **附身 / 幻灵 / 危险** | 附身 32；幻灵 40；危险 65 | 有 `[[附身]]`「幻灵」「危险」特性；与 Peril「险境」区分。 |
| 35 | chaos token / chaos bag | **混乱标记 / 混乱袋** | 混乱标记 29；混乱袋 46；「混沌袋」2 次为错字 | 「混沌袋」见 findings 附表（低）；统一「混乱」。 |
| 36 | objective / resign | **目标 / 撤退** | 目标 33；撤退 50；「退出」1 | 统一。 |
| 37 | miasma | **瘴气** | 瘴气 97 | 统一（无「毒瘴」）。 |
| 38 | nameless madness | **无名疯狂** | 无名疯狂 21；「无名狂魔」2（仅 rules，findings terms-0010） | 推荐跟卡面。`src/cards/cards-data.js:305522` |
| 39 | expedition team | **探险队** | 探险队 137 | 统一（「考察队/远征队」0 次）。 |
| 40 | supplies recovered | **已回收的补给品** | 已回收的补给品 21 | 固定记录名，勿写「已回收的物资」。 |

## 二、关键词（keywords.js 38 条 vs 卡面/规则书）

推荐名均取 `content/campaigns/edgeOfTheEarth/keywords.js` 与卡面对齐后的结果；✅=卡面一致，⚠=有冲突或跨层偏差，ℹ=本循环无印刷实例（仅元数据/规则书用）。

| EN | keywords.js | 推荐 | 判定 | 依据 |
| --- | --- | --- | --- | --- |
| Hunter | 猎手 | 猎手 | ✅ | 17 卡全含「猎手」；上游全库 138/139「猎手。」 |
| Aloof | 冷漠 | 冷漠 | ✅ | 3 卡一致。 |
| Massive | 庞大 | 庞大 | ✅ | 5 张 Massive 卡全部「庞大」；上游全库「庞大。」18/19。**「巨大」不是 Massive 译名**（用于巨大坡道等专名）。 |
| Retaliate | 报复 | **反击** | ⚠ terms-0004 | 11 张卡全部「反击」，上游 37/37「反击。」；keywords.js:20 错。 |
| Alert | 警戒 | 警戒 | ✅ | 6 卡一致。 |
| Surge | 涌动 | 涌动 | ✅ | 8 卡一致（上游 25/25）。 |
| Peril | 险境 | 险境 | ✅ | 5 卡一致（上游 56/56「险境」）。 |
| Hidden | 隐藏 | 隐藏 | ℹ | 08 段无印刷 Hidden 关键词；EN 命中的 7 张是地点名 Hidden Tunnel（隐秘隧道）。 |
| Victory | 胜利点 | 胜利点 | ℹ | 08 段无印刷 Victory X；39 次「胜利区」是 victory display。 |
| Objective | 目标 | 目标 | ✅ | 20 卡一致。 |
| Revelations | 显现 | 显现 | ✅ | 52 卡一致；「揭示」101 次是 reveal 动作（另一词）。 |
| Power/others | 猎物/生成/谈判/撤退/快速/永久/卓越/精英 | 猎物/生成/谈判/撤退/快速/永久/卓越/精英 | ✅ | 卡面对齐。 |
| Fast | 快速 | 快速（关键词名） | ⚠ terms-0001 | 关键词名对；但卡面图标 EN `[fast]` 被 zh 系统性写成 `[free]`（53 卡/58 处）。 |
| Partner | 伙伴 | 伙伴 | ✅ | 19 张剧情支援一致。 |
| Resolute | 坚毅 | 坚毅 | ✅ | 18 卡一致。 |
| Shelter | 庇护值 | 庇护值 | ✅/⚠ | 关键词名合理；卡面地点正文作「庇护N」（terms-0018，cards 裁定）。 |
| Seal / SealTokens | 封印/封印标记 | 封印/封印标记 | ✅ | 23/17 卡；token 类以 `[seal_x]` 呈现。 |
| Level | 高度等级 | 高度 / 高度等级 | ✅ | 地点高度=高度（08596）；卡牌等级=等级（另一义）。 |
| Key | 钥匙 | 钥匙 | ✅ | 8 卡一致。 |
| Tekeli-li | 忒咳哩-哩！ | **忒咳哩-哩**（卡名无感叹号） | ⚠ terms-0005 | 08723–08729 卡名与文本均为「忒咳哩-哩」；keywords.js/rules 多「！」。 |
| Expedition | 探险 | 探险 | ✅ | 特性 [[Expedition]]=探险，7 卡 traitsZh。 |
| Frost | 寒霜标记 | 寒霜标记 | ✅ | token 类；卡面 `[frost]`。 |
| Supplies | 物资 | 按语境（见术语 #17） | ℹ | 卡面 supplies 使用次数=补给，战役 Supplies=物资。 |
| Titanic | 巨型 | **巨大坡道（专名）/ 待核 trait** | ⚠ terms-0009 | 卡面 08682–08685「巨大坡道」；规则书「泰坦坡道」。 |
| Hazard / Broken / Unbroken / Eidolon / AncientOne / Possessed | 危险/破功/运功/幻灵/古神/附身 | 同左 | ✅（rules 层例外 terms-0008） | 卡面 traitsZh 与 keywords.js 一致；规则书 Broken/Unbroken 用英文+「未破/已破」。 |
| Mirage | 幻景 | 幻景 | ✅ | 211→172 次全为幻景；「蜃景」4 次为叙事比喻。 |

## 三、图标 token 与中文叫法

- 08 卡面 zh 正文保留英文方括号 token 共 618 处（608 在 cards）：`[action]`117、`[reaction]`56、`[free]`58、`[fast]`0、`[willpower]`38、`[intellect]`31、`[combat]`39、`[agility]`45、`[wild]`2、`[skull]`17、`[cultist]`16、`[tablet]`16、`[elder_thing]`15、`[auto_fail]`3、`[elder_sign]`7、`[frost]`40、`[seal_a]–[seal_e]` 7–8、`[per_investigator]`60、职业图标 `[guardian]/[seeker]/[rogue]/[mystic]/[survivor]` 各 4–5。
- **`[fast]`↔`[free]` 错位**：EN 卡面 `[fast]` 58 处，zh 卡面 0 处；zh `[free]` 58 处而 EN `[free]` 0 处——一一对应（53 张卡）。仓库渲染器 `web/card-text.js:17` 与 `web/locales/zh-CN.table.js:12-13` 把两者区分为「免费触发」/「快速」，故实际显示标签不同（findings terms-0001，high）。
- 中文技能名：卡面/剧情/指南不使用「意志/智力/战斗/敏捷」替代图标 token（0 次）；规则书仅 `web/eote-rules.js:182` 用一次「敏捷（4）检定」描述性文字，建议写「敏捷（[agility]）」或与卡面一致保留 token（低优先）。
- 未替换占位符：`[shelterValue]` 4 处（story2/guides2，findings terms-0015）；`{' { '}frost{' } '}` 转义泄漏 23 处（findings terms-0002）。

## 四、专名（卡面为准，跨层核对）

### 4.1 五位调查员（08001–08018，含双面 08011a/b–08014a/b）

| 卡号 | EN | 规范中译（cards-data nameZh） | 跨层核对 |
| --- | --- | --- | --- |
| 08001 | Daniela Reyes | 丹妮拉·雷耶丝 | cards/rules 一致；未出现「雷耶斯」异写 |
| 08004 | Norman Withers | 诺曼·威瑟斯 | 一致；未出现「韦瑟斯」 |
| 08007 | Monterey Jack | 蒙特雷·杰克 | 一致 |
| 08010 | Lily Chen | 陈丽丽 | 卡片/rules 均「陈丽丽」；未出现「陈莉莉」 |
| 08016 | Bob Jenkins | 鲍勃·詹金斯 | 一致；未出现「简金斯」 |

### 4.2 九位探险队伙伴（安全面 08714–08722 / 坚毅面 08587–08595 / 纪念逝者 08730–08738）

卡面、records.js#PARTNERS、story 正文、guides 四层全部同写（0 异写）：

| 卡号 | EN | 统一中译 |
| --- | --- | --- |
| 08714 | Professor William Dyer | 威廉·戴尔教授（叙事简称：戴尔/戴尔教授） |
| 08715 | Danforth | 丹佛斯 |
| 08716 | Eliyah Ashevak | 伊里亚·阿什瓦克（叙事：伊里亚/阿什瓦克先生） |
| 08717 | Dr. Mala Sinha | 玛拉·辛哈医生（辛哈医生/辛哈） |
| 08718 | Avery Claypool | 艾弗里·克莱普尔（克莱普尔先生） |
| 08719 | James "Cookie" Fredericks | 詹姆斯·“曲奇”·弗雷德里克斯（曲奇） |
| 08720 | Dr. Amy Kensler | 艾米·肯斯勒博士（肯斯勒博士） |
| 08721 | Roald Ellsworth | 罗尔德·埃尔斯沃思 |
| 08722 | Takada Hiroko | 高田弘子（高田女士） |

> ⚠ story-text 记录层 `campaign.records.partnerNames` 9/9 为英文回退（status=missing），见 findings terms-0019。

### 4.3 营地名（13 处）与物资（7 件）

营地名以卡面为准：坠机点 / 冰冻海岸 / 危险道路 / 不稳定冰盖 / 辽阔雪地 / 冰封荒原 / 岩石峭壁 / 雪冢 / 破冰船登陆点 / 严寒洞穴 / 屏障营地 / 莱克营地遗址 / 水晶洞穴。
- 偏差：`records.js:200` 作「莱克营地遗迹」、`:201` 作「水晶洞窟」（findings terms-0012）；`story-text` 的 13 条记录标签带英文前缀「Camp - X (N)」（findings terms-0003）。
物资：绿皂石 / 木制雪橇 / 炸药 / 瘴气水晶 / 矿物标本 / 小型收音机 / 备用零件。
- 偏差：08615 卡名与 shared-encounters 作「木制雪撬」、规则书作「木雪橇」（findings terms-0011）；规则书 08620 作「备件」（terms-0021）。

### 4.4 章节、地点与主要实体

| EN | 推荐中译 | 备注 |
| --- | --- | --- |
| Ice and Death | 亡命冰原 | 卡面 08501；分篇「第 I/II/III 部分」（写法见 terms-0022） |
| Fatal Mirage | 致命幻景 | 08549；「致命幻象」0 次 |
| To the Forbidden Peaks | 失落之峰 | 08596；注意 08597 议程另名「失落山峰」（不同卡） |
| City of the Elder Things | 古老者之城 | 08621 |
| The Heart of Madness | 疯狂之心 | 08648 |
| The Gate of Y'quaa | 伊夸之门 | 08649；「伊库阿之门」0 次 |
| Titanic Ramp | 巨大坡道 | 08682–08685；规则书「泰坦坡道」（terms-0009） |
| Mist-Pylon | 迷雾高塔 | 08674–08678 |
| Hidden Tunnel | 隐秘隧道 | 08630/08686 |
| The Nameless Madness | 无名疯狂 | 08679；规则书「无名狂魔」（terms-0010） |
| Terror of the Stars | 星之恐怖 | 08522/08608/08641；「星之恐惧」0 次 |
| Elder Thing 系列 | 拘束型古老者 / 和蔼的古老者 / 复苏的古老者 / 古老者清道夫 / 古老者守卫 | 特性「古老者」 |
| Shoggoth 系列 | 失落的修格斯 / 狂暴的修格斯 | 特性「修格斯」 |
| Skittering Nonsense | 疾行谬物 | 08515 |
| Giant Albino Penguin | 巨型白化企鹅 | 08708（「巨型」=Giant，不是 Massive） |
| Anyu | 安雨 | 08738；「安尤/阿纽」0 次 |
| Theodosia | 菲奥多西亚号 | 08558「菲奥多西亚号甲板」 |

## 五、用字/标点/数字统一口径（低严重度为主）

1. **简繁**：中文剧情/指南保留台湾译文用字「著」661 处（story451/guides210），应用简体「着」（着作等 zhù 义除外）；其余繁体字 0 处；「明瞭」3 处应作「明了」，但「瞭望塔」4 处正确（findings terms-0013/0020）。
2. **标点**：卡面沿用上游全角「，。：」+ 半角括号「()」；rules 用「（）：；」；story/guides 混入英文式半角「: . ( )」。建议：句内统一全角，ASCII 数字列表编号后的「:」「.」改全角，删重复「。.」「：:」（terms-0016/0017）。
3. **引号**：cards/story/guides 用中文弯引号 “”；rules 用直角引号「」50 处——同一系统两套引号，建议规则书改「“”」或全局统一（低）。
4. **列表符号**：story/guides 用「•」（214 处），cards 用行首「- 」（61 处）；建议按层保持（卡面印刷风格）但 story/guides 内不混用。
5. **中英/数字间距**：cards 多为「等级0」「(3秘密)」无空格（上游风格）；rules/story 部分「第 I 部分」有空格。建议同一文档内统一：图标 token 与中文之间不加空格，章节罗马数字统一「第 I 部分」。
6. **数字/编号**：半角数字（cards 1039 处）；全角数字 0 处；「冒险???：致命幻景」对应 EN「Scenario ???」，属故意留白，不是占位符泄漏。
7. **图标与中文技能名**：卡面保留 `[willpower]` 等英文 token；中文技能名「意志/智力/战斗/敏捷」不用于替代 token；规则书偶用中文名时加图标（低）。

## 六、误报与需人工裁定（详见 findings.json#falsePositives）

- **敌军阶段**（不是 enemy 误译）、**损伤**（特性 Injury）、**技巧**（特性 Trick）、**胜利区**（victory display）、**Hidden Tunnel**（地点名命中 Hidden 模式）、**Level 的牌库构建义**、**Massive=庞大**（不是巨大）、**冒险???**（印刷留白）均**不算问题**。
- 「同伴/队友 vs 伙伴」「物资/补给品/补给」「场景/剧本/冒险」「庇护N vs 庇护值」属**语境分工**，除已列 findings 外建议按本表口径人工统一。
