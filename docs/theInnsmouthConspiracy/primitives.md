# P0–P3 原语与证据契约

本文件记录《印斯茅斯暗潮》迁移前置阶段交付的通用能力。逐卡规则仍由后续单卡描述子负责；原语可用不表示卡牌、剧本或战役已经可玩。阶段状态以 `audit/tic-migration.json` 为准。

P4 新增的选择、隐私投影和浏览器通路见[交互契约](interactions.md)。`commitOrigins.withdraw(seat,index)` 在判定前收回投入实体；投入与奖励队列同步移除，避免重复结算。`chaosRevealStepEnded` 在存在订阅者时也覆盖普通数字标记。

## 来源、目录与扫描

`tools/scan-tic-scope.mjs` 从卡池与参考工程锁定卡号、关联面、三包分区、八章提示卡、四档初始混乱袋、共享遭遇组、外部依赖及逐文件 SHA-256。`tools/scan-tic-mechanisms.mjs` 对正背面文本分类，登记原语、关键词、规则书、交互、章节和纯内容，并逐段盘点中英指南与幕间来源；分类结果不充当字面行为验收。

P0–P4 将三个 `tic*` 包仅作为目录注册；P5 调查员包的独立开放由[调查员契约及审计](investigators.md)负责，战役和一般玩家包继续为 `catalog-only`。八章各有独立 `scenarios/<id>/index.js`，可在隔离注册表中校验目录合同。完整指南与实际规则尚未交付，因此这些占位章不加入生产关卡列表；P7 提升时必须一起接入完整指南。

可签入、可复算的最小输入保存在 `audit/tic-{scope,mechanism-scan,primitive-plan,primitive-catalog}.json`。大厅根目录 `artifacts/migration/tic/` 存运行镜像、replay 过程基线、日志、控制副本与截图，继续被忽略；不依赖 Mod 下的历史运行目录，也不用放开整个 artifacts 目录。`--check` 只比较，不重新写入报告或基线。

## 通用 API

先复用既有注册与枚举入口，再补下表的域接口。本轮不新增能力 kind、目标 kind 或打出通道。

| 盘点范围 | 既有入口及本轮裁定 |
| --- | --- |
| 能力 kind 与效果 | `src/engine/ability.js` 的 `ABILITY_KINDS`、`normalizeDescriptor` 与 `src/engine/effects.js` 的 `EFFECT_PRIMITIVES`；常规费用、抽牌、伤害、修正继续复用。实际枚举值收入原语目录。 |
| `ctx.api` | `src/engine/engine.js` 组合既有接口；新机制集中由 `api-mechanics.js` 组合，不在单卡建立状态写入入口。 |
| 窗口 | `src/engine/windows.js` 的注册表；新增三类窗口与调用点见下文，其余沿用。实际注册值收入原语目录。 |
| matcher | `src/engine/matcher.js` 的 `all/any/none/not`、座位、地点、敌人、标记与回合判定；新机制通过 API 查询后组合，无需增加通用谓词种类。 |
| 目标枚举 | `src/engine/targets.js` 的 `TARGET_KINDS`、`normalizeTarget`、`enumerateTargets`；敌人、调查员、地点、支援和手牌沿用原枚举。彩色钥匙、封印实体及乘客选择留给 P4 接入现有选择事务，不能伪装为已完成的卡牌目标交互。 |
| play channels | `src/engine/play-channels.js` 的 `createPlayChannels`；弃牌堆、威胁区、宿主下方、直觉、附属事件、背包及原定计划沿用既有打出协议。特殊投入由 `commitOrigins` 复用权威投入入口，不另建“如同手牌”通道。 |

单卡通过 `ctx.api` 使用以下域接口；章节运行时通过 `api.mechanics` 使用同一套接口。所有有选择或可中断副作用的调用都必须在现有规则事务中执行。参数错误抛错；资源不足或无合法目标返回 `false`／`null`，不能先支付部分费用再失败。

| 原语 | 入口与参数 | 约束与读点 |
| --- | --- | --- |
| `chaos.pool` | `chaosTokens.count/room/add(token,count,{exact})`、`pay(token,count,{sealed,selection})`、`replace(from,to,count,{exact})` | 祝福与诅咒分别最多 10 个；袋内、已揭示、封印区共用物理池。效果尽可能加入，费用使用 `exact:true` 并完整预检。支付可显式指定袋内／封印来源，重复或非法选择不扣费。 |
| `chaos.pool` 的轮末操作 | `chaosTokens.scheduleReplacement(from,to)` | 纯 JSON 记录本轮结束时的替换，`phases.js` 轮末结算，包含轮中后来加入的标记；出队后不重复执行。 |
| `chaos.seal` | `chaosTokens.seal(sourceId,token,count,{exact})`、`release(sourceId,token,count,{toPool})`、`revealSealed(sourceId,token)` | 按实例区分来源；释放回袋，`toPool` 回池。封印替代揭示进入当前检定的物理揭示区；支援离场沿用统一释放读点。 |
| `chaos.resolution` | `chaosTokens.treat({index,as,modifier,cancel,stop,retain,autoSuccess})` | 按物理标记下标处理，不把所有同面标记混为一枚。取消、停止继续揭示、修改修正与结束后去向分别声明。`tests.js` 的揭示管线读取，`chaos-bag.js` 收尾消费／归还。 |
| 检定外揭示 | `chaosTokens.inspect(count)` | 不结算祝福／诅咒的固有效果，不追加揭示、不消耗；检定结束清理逻辑不与普通揭示混用。 |
| `location.flood` | `water.level(id)`、`effectiveLevel(seat,{reduce,immune})`、`set(id,level,{cannotIncrease})`、`change(id,delta,options)` | 等级 0／1／2；变化夹取，非法等级拒绝。载具的 `protectsFromFlood` 参与有效等级。淹没本身不产生固有伤害。 |
| `investigator.air` | `water.beginAirTurn(seat,{damage,protectedFromAir})`、`endAirTurn(seat)` | `scenario.mechanics.water.air` 可接入回合开始；位移、淹没变化与回合结束检查风险。已获得空气后本回合不会再次创建同一次风险；伤害走直接伤害入口。特别卡牌／议程的豁免由其描述子按来源传入，不按卡号判断。 |
| `scenario.keys` | `keys.initialize(specs)`、`at(target,{reveal})`、`placeRandom(target)`、`claim(seat,color)`、`transfer(color,from,to,options)`、`give(from,to,colors)`、`spend(seat,color,to)`、`onExit(target,location,seat)` | 一种颜色一个实体；隐藏查询只返回 `unrevealed`，随机放置不返回颜色。取得需地点无剩余线索；转交必须同地点并拥有钥匙。敌人击败／移除、调查员淘汰及支援离场有清理读点。花费默认放到提示卡区域 `reference`。 |
| `scenario.vehicle` | `vehicles.register(id,{location,capacity,running,protectsFromFlood})`、`of/accessError/enter/leave/running/move/remove` | 每轮共用一次上下车机会；在车内不能独立移动。移动预检所有乘客并走权威位移入口，保留进入地点、揭示及敌人跟随语义。动态阻止移动时抛错，由整个规则事务回滚。多名剩余乘客需明确选择驾驶者，淘汰读点接入此选择。 |
| `location.graph` | `map.paths(from,to,canEnter)`、`distance(from,to)`、`neighbors(cells,cell)`、`initializeRoad(spec)`、`extendRoad(from,count)` | 最短路径保留等长选择，洞穴仅正交相邻。道路首张来自道路牌库，补绕路牌、确定性打乱后放入前方新列；有前方地点时不重复扩展。同列不相连，相邻列全部互连。地点 id 必须对应章节定义。 |
| `campaign.recordSet` | `recordSets.values/add/remove`、`claimReward(id)` | 集合增删幂等，只读不初始化。调用方只在首次领取成功时结算奖励，并与记账处于同一事务。记忆、嫌疑人、藏身处的剧情含义留在内容层。 |
| `test.commitOrigin` | `commitOrigins.beneath/store/take`、`commit(seat,{host,code,from,retain})` | 原区可为宿主下方或弃牌堆，投入复用既有资格／费用／图标入口。失败恢复原区顺序，`retain` 的宿主下方牌在检定结束时返回原宿主；不能复制一张牌同时留在两个区。 |
| `deck.traitLimit` | `validateTraitLimits(codes,cards,limits)`，经 `validateDeckRules` 统一调用 | 不同卡名、职业、等级的契约共用单张上限；初始构筑、部分构筑及升级共享校验。错误提示使用中英文词典。 |
| `turn.promise` | `promise(seat,sourceId,event)` | `draw/play/commit` 三种事件，限自己的回合。抽牌、打出和投入都有读点，首次违背触发 `promiseBroken`，同一声明不重复触发；来源离场后失效。卡牌的惩罚由描述子结算。 |
| `uses.transfer` | `useTokens.move(fromId,toId,type,count)`、`spend(seat,assetId,type,count,providers)` | 同地点转移秘密／充能或合并支付；调用方提供卡面允许的代付来源，原语检查实体、区位、类型和总量；费用不足无部分扣除。 |

`keys` 的目标格式为 `location:<id>`、`investigator:<seat>`、`enemy:<id>`、`asset:<id>`、`setAside`、`reference` 或 `removed`。隐藏颜色只供受信任的规则代码读取；P4 的公开投影与交互仍须独立验收，不得直接向客户端发送权威钥匙表。

新增时机为 `chaosTokenResolved`、`chaosRevealStepEnded` 和 `promiseBroken`。前两者分别在祝福／诅咒结算后及揭示步骤结束后接线，后者由三类卡牌事件接线；注册与调用必须同时保留。标记的 `index` 取自相应上下文或 `tokens[]`，不要用卡面字符串代表一枚物理标记。

## 存档与复用边界

P6 的玩家卡扩展登记在 `primitive-catalog.playerExtensions`，请求处理见 `audit/tic-player-queue.json`，逐卡使用及测试见[玩家卡验收](players.md)。`playerTools` 是 `createPlayerApi` 提供的域接口；单卡不得直接修改该接口内部字段。`additionalTokenCost` 校验 token、操作、计数和封印范围；能力费用新增 `damage / doomOnSource / drawEncounter`，都走统一费用求值和预检。

`assetRule` 的 P6 声明包含共享秘密、同地点免费能力、额外交战、宿主额外法术槽、任意同地点控制者、无限容量、敌人入场伏击及无封印即弃掉。声明均在能力注册时校验，由资产、伤害、行动、入场或费用管线读取。`playTimingProvider` 返回快速时机、折扣与费用，由行动枚举及执行使用相同的实体来源；空白来源不可提供该能力。`deckConstruction.minimumTypes` 在构筑及升级共享校验，不能把无等级的专属牌当作等级 0 回收。

P6 续算使用可选 JSON 字段：`asset.paidX / restrictedActionSpent / capturedCards`，`playerWindowOccurrences`，以及当前检定的 `baseSkillOverride / tokenRedraws / ignoredTokenModifiers / rerollGuard / tokenRewards / releaseAfterTest`。读取存档时校验类型、非负计数、实体 ID、席位及弱点身份；旧存档缺少这些字段时不补写。测试覆盖 JSON 往返、非法续算、物理副本区分、额外行动后的回合推进和同地点费用支付。

新增机制懒初始化到既有 `scenarioFlags` 的可选扩展 `mechanics`，内部带 `version:1`；未使用的旧战役不会新增该字段。`save-migration.js` 在普通存档、续算基底和并行线读取时校验此扩展，拒绝未知版本与非法数据。这里扩展的是既有 JSON 容器，不提升顶层 schema；旧存档缺少该扩展时保持原状。以后若改变扩展形状，必须明确升级扩展版本并登记迁移，不能静默补解释。

原语计划同时登记已有的行动历史、使用次数、常规效果、研究升级、构筑、敌人和遭遇管线。本阶段不创建任何单卡行为文件，也不改变索引或放行卡牌。研究完成的具体日志键、特殊卡牌的豁免、幕／议程与玩家卡能力必须在 P5–P7 用实际描述子接线后才能确认字面行为。发现新的可复用缺口时重新打开对应原语项，按队列处理，不能绕过 `ctx.api`。

## 验证和可复算证据

在 Mod 目录执行：

```powershell
npm run scan:tic:scope:check
npm run scan:tic:check
npm run test:tic
node tools/verify-tic.mjs --node
npm run test:tic:rules:browser
node tools/verify-tic.mjs --regression
npm run audit:tic:primitives
npm run audit:tic:check
```

`verify-tic --node` 与浏览器 reporter 记录实跑结果及源码哈希；验收期间源码变化或验收后源码漂移时，审计不能继续使用旧的通过结果。原语计划中的 `done` 来自当前有效的专项测试和回归证据，不是手填状态。

修改前的工作区本来就有快测失败；初始标题清单和原始 replay 保存在 `audit/tic-baseline.json` 与 `tests/fixtures/replay/tic-baseline.json`。并发工作区改动导致失败集合变化时，`tools/tic-control-regression.mjs` 在大厅根 artifacts 中建立副本，仅在副本关闭本轮的目录、API 与特性限制接线，再复跑相关既有用例；不重置用户文件，不改写最初基线。`audit/tic-regression.json` 分开记录初始既有失败、控制副本复现的并发漂移及仍需修复的新增失败。

回放也保留两层比较：先对照最初基线；如有漂移，再逐步比较同一源码版本的运行结果与控制副本。只有全部逐步哈希一致，才能把该差异记为并发工作区漂移；报告中的 `matchesOriginalBaseline` 与 `matchesContemporaneousControl` 分开保留，不能把后者表述为“原始基线全部一致”。任何未在控制副本复现的新增失败仍会阻止 P2、P3 确认。

截图在 `artifacts/migration/tic/reports/screenshots/`，浏览器过程资料在本轮独立目录。Node、浏览器和回归运行均须重新验证当前源码后，才能重写并通过总审计。
