# 敌人攻击动效

敌人出手与实际承伤分成两段。分类是展示配置，不参与攻击资格、伤害分配、取消、沉睡、群聚或剧本规则。

## 配置入口

- `content/presentation/enemy-attack-styles.js`：已审计的 247 个卡号／形态及运行时别名。12 个共享类别（含形象待确认的中性回退），23 个特殊家族。
- `web/enemy-attack-themes.js`：类别颜色、声音与家族图形。
- `web/enemy-attack-fx.js`：共享动作、家族签名与承伤效果。家族使用不同的 SVG 形状，复用动作与时间线；不是逐个敌人的逐帧角色动画。
- `src/integration/enemy-attack-presentation.js`：解析原始卡号、运行时别名、真身角色、飞天水螅与复活尸体。群聚只继承公开的宿主身份，不读取底牌来决定外观。

共享类别：人形近战、爪击、扑咬、群袭、有机缠绕、巨体重击、精神侵入、幽灵、咒术、飞行扑击、载具撞击、中性冲击。形象未确认的 31 个身份继续采用中性冲击；未擅自假定枪械或触手。

特殊家族：食尸鬼祭司、假面猎手、乌默尔多斯、实验体、追猎恐魔、塞拉斯、犹格之子、犹格、风琴手、哈斯塔、预示者、伊格、无形之子、幽灵看守人、安妮特、阿撒托斯、不可名状之物、奈亚拉托提普、阿特拉克及蛛腿、混生畸物、礁石骇物、达贡、海德拉。不同卡号／形态共用家族。沉睡面的攻击资格仍由引擎阻止。

## 事件契约

`attack` 的 `direction: incoming, presentationStage: threat` 只表示实际启动的出手。带 `attackStyle`、可选 `enemyFamily`、公开来源身份和分配前快照；不播放调查员承伤抖动或伤害数字。旧存档事件没有 `presentationStage` 时继续使用原先的普通攻击演出。

`enemyHarm` 的 `presentationStage: harm` 来自 `applyHarm` 实际放置点。`targets` 逐个记录 `{seat, assetId?, damage, horror}`，包含潜水服转移与其它座位支援承伤。在致命资产移除前保存快照；防止为零不产生事件。纯恐惧采用紫色眼纹与精神暗化；生命伤害采用冲击和抖动，混合承伤叠加恐惧层。

来源标记通过 WeakMap 绑定传给这次 `applyHarm` 的上下文，反应中的无关伤害不继承来源。哈斯塔的额外伤害显式传入展示来源，原本的反应参数不变。

`src/engine/presentation-events.js` 在规则事务之外保存展示插入位置。`resolution.js` 合并返回事件，不增加续算的规则事件游标。续算凭据的 `_presentationEmitted` 只用于阻止已播展示重发，沿用下划线展示字段不入规则指纹的既有约定。选择恢复、JSON 存档与事务检查点均适用。

前端在每次快照重绘后清除承伤去重记录，再记录当前这段已播的调查员承伤，防止最终检查点重复飘字；支援承伤使用资产锚点。支持静音、快速、减弱动态、强制同步清理。

## 无实体攻击接口

`scenarioRuntime.presentAttack({code,name,seat,damage,horror,text}, resolve)` 为无场上敌人实体的攻击提供展示来源。`resolve` 接收 `{damage(seat,n), horror(seat,n)}`，分别沿用原有 `applyHarm` 规则路径，额外标记展示来源，不经过普通 `enemyAttack` 规则窗口，也不生成假敌人。

阿撒托斯沿用原本先 3 伤害、后 3 恐惧的两次调用。全局来源使用视口上方宇宙签名，目标仍为实际调查员／支援。该接口已由阿撒托斯接线并经专项测试。

## 音效与验证

新增 7 段捆绑音效，来源为 Ogrebane 的 Monster Sound Pack 与 Kenney Sci-fi Sounds，均 CC0。`web/audio/enemy-attack-sources.json` 记录作者、来源、原文件与输出校验和、裁剪、处理方式、实际时长；许可保存在音频目录。运行时不联网下载。

专项：`tests/enemy-attack-presentation.test.mjs`；浏览器：`tests/enemy-attack.browser.mjs` 和 `tests/combat-presentation.browser.mjs` 中 enemy cases。截图、完整日志、逐身份状态表在工作区根目录 `artifacts/arkham-enemy-attack-audit/implementation/`。
