# 关卡 BGM 分配

覆盖 7 个战役、54 个关卡，每关 2–3 首；六循环八关均为三首。前三个战役原有 56 个歌曲位置只用了 17 首不同曲目；补充 15 首后，56 个位置使用 32 首不同曲目，同一首最多分配两次。三循环另有 17 首曲目，其十章歌单不复用前三个战役的曲目。音频文件不重复存储。

进入关卡或关间准备选定下一关后，播放器切换到该关歌单并以首曲开场；同一关刷新不重播，手动暂停后切关保持暂停。重载同一歌单恢复所选曲目。无具体关卡时使用战役歌单，未知关卡回退战役歌单，未知战役回退通用歌单。

配置在 web/scenario-music.js，音频目录不决定可播放战役。全部曲目由 Kevin MacLeod 提供，采用 CC BY 4.0；正式来源和署名见 [CREDITS.txt](CREDITS.txt) 与 [sources.json](sources.json)。原始录音未剪辑，仅转码压缩。

## 夜之狂热

| 关卡 | 场景风格 | 播放顺序 |
| --- | --- | --- |
| 集结 | 封闭宅邸、地下异响、恐惧初现 | Darkest Child → Come Play with Me → Long note One |
| 午夜假面 | 夜街追踪、秘密调查、午夜倒计时 | Dark Walk → On the Ground → Chase Pulse |
| 地底噬魔 | 森林邪教、献祭仪式、古神迫近 | Ritual → The Voices → Gathering Darkness |

## 敦威治遗产

| 关卡 | 场景风格 | 播放顺序 |
| --- | --- | --- |
| 课外活动 | 夜间校园、失踪学者、实验体阴影 | Echoes of Time → Right Behind You → Unseen Horrors |
| 百赌百胜 | 地下赌场、爵士俱乐部、黑帮试探 | Deadly Roulette → I Knew a Guy → Dances and Dames |
| 米斯卡塔尼克博物馆 | 夜探展厅、古物禁书、潜伏追猎 | The Dread → Decay → Long Note Three |
| 疯狂列车 | 疾行列车、车厢崩塌、紧迫逃生 | Chase Pulse → Night Break → Wretched Destroyer |
| 血色祭坛 | 失踪村民、隐秘地窖、献祭仪式 | Ritual → Ossuary 2 - Turn → Ghost Processional |
| 无人知晓 | 乡野搜寻、无形巨兽、危险逼近 | Unseen Horrors → Lightless Dawn → Shadowlands 4 - Breath |
| 毁灭之地 | 哨兵山、邪教仪式、时空裂隙 | Gathering Darkness → Shadowlands 7 - Codex |
| 迷失时空 | 异界漂流、空间错乱、绝望迷航 | Shadowlands 5 - Antechamber → Ossuary 7 - Resolve → Long Note Two |

## 卡尔克萨之路

| 关卡 | 场景风格 | 播放顺序 |
| --- | --- | --- |
| 谢幕 | 荒废剧院、失谐旋律、现实崩解 | Evening of Chaos → Come Play with Me → Darkest Child |
| 最后的王者 | 华丽晚宴、怪诞舞曲、宾客异变 | Danse Macabre → Ghost Processional → Ossuary 1 - A Beginning |
| 往事回声 | 历史档案、幽远钟声、尘封秘密 | Echoes of Time → Long note One → Decay |
| 邪秽誓约 | 疗养院、心理压迫、漫长疑惧 | Long Note Two → The Dread → Right Behind You |
| 真相幻影 | 巴黎夜街、追踪陌客、梦魇追逐 | Dances and Dames → On the Ground → Dark Walk |
| 苍白面具 | 地下墓穴、幽灵行进、石室迷宫 | Ossuary 6 - Air → Ossuary 2 - Turn → Long Note Three |
| 黑星升起 | 风暴修道院、黑星预兆、异界门扉 | Shadowlands 5 - Antechamber → Shadowlands 4 - Breath → Lightless Dawn |
| 卡城幽影 | 哈利湖、失落之城、黄衣终幕 | Ossuary 6 - Air → Ossuary 7 - Resolve → Shadowlands 7 - Codex |

## 失落的时代

| 关卡 | 场景风格 | 播放顺序 |
| --- | --- | --- |
| 荒莽密林 | 潮湿雨林、未知踪迹 | Magic Forest → Shamanistic → Lost Frontier |
| 埃兹特里的覆灭 | 古代神庙、陷阱、崩塌 | Invariance → Enter the Maze → Ancient Rite |
| 命运之线 | 城市追查、失窃文物 | Penumbra → Gloom Horizon |
| 界限彼端 | 城市与古代重叠、时空裂隙 | Static Motion → Orion 300XB → Digital Bark |
| 久远腹地（上） | 重返雨林、寻找洞窟入口 | Truth in the Stones → Magic Forest |
| 久远腹地（下） | 洞窟深处、古老仪式 | Rites → Ancient Rite → Enter the Maze |
| 天机之城 | 异星档案、陌生文明 | Orion 300XB → Digital Bark → Static Motion |
| 幽嘶深渊 | 地下蛇城、迫近的危险 | Controlled Chaos → Interloper |
| 破碎永世 | 纪元崩裂、终局迫近 | Thunder Dreams → Interloper → It is Lost |
| 时间倒流 | 回到过去、封印遗物 | Truth in the Stones → It is Lost → Lost Frontier |

十关共 27 个歌曲位置，17 首新曲目全部参与分配；与前三循环的曲目交集为零。本轮仅下载、转码并保存本地文件，尚未上传 CDN。原始官方 MP3 保存在项目 `artifacts/tfa-music-originals/`；网页使用 128 kbps 本地副本。来源、官方曲目页、下载地址与双份哈希见 `sources.json`。

## 食梦者

八关每关 3 首，共 24 个歌曲位置。8 首新曲各使用两次，占 16 个位置；其余 8 个位置引用原有通用曲目，旧曲复用率为 **33.3%**。音频只在 `common/` 存一份，关卡通过曲目 ID 引用。

| 关卡 | 播放顺序 |
| --- | --- |
| 梦境门外 | Dreams Become Real → Dreamlike → Magic Forest |
| 清醒噩梦 | Unnatural Situation → Spider Eyes → Controlled Chaos |
| 寻觅卡达斯 | Air Prelude → Floating Cities → Ancient Rite |
| 万千骇形 | Dreamlike → Soporific → Enter the Maze |
| 月之暗面 | Floating Cities → Soporific → Orion 300XB |
| 无归之地 | Unnatural Situation → Spider Eyes → Interloper |
| 神居之所 | Air Prelude → Frozen Star → Thunder Dreams |
| 编织宇宙 | Dreams Become Real → Frozen Star → Darkest Child |

新增曲目来自 Kevin MacLeod 的 Incompetech 官方站，依 CC BY 4.0 署名。官方原始 MP3 保存在大厅仓库 `artifacts/tde-music-originals/`；网页文件为 44.1 kHz、128 kbps MP3，原始及转码后的大小与 SHA-256 见 `sources.json`。2026-11-02 已将八首新曲上传至 R2 `boardgame/arkhamhorror/music/common/`，公开 CDN 的八个对象均返回 HTTP 200、`audio/mpeg` 与匹配的文件大小。


## 印斯茅斯暗潮（六循环）

八关各三首，24 个播放位置使用 24 首不同曲目。新增 16 首，复用旧曲 8 首，按播放位置和独立曲目数计算的旧曲复用率均为 33.3%，循环内重复率为 0%。新增音频统一放 common/，官方来源与哈希见 sources.json，署名见 CREDITS.txt。

| 关卡 | 场景风格 | 播放顺序（★为新增） |
| --- | --- | --- |
| 绝望深坑 | 洞穴深处、淹没水道、钥匙与记忆 | ★ Ice Demon → ★ Bent and Broken → Rites |
| 艾莲娜·哈珀失踪案 | 小镇疑云、封锁街区、指认与营救 | ★ Awkward Meeting → ★ Distant Tension → Penumbra |
| 深陷危局 | 洪水漫城、路障封锁、逐街推进 | ★ Deep Haze → ★ Dark Times → Controlled Chaos |
| 魔鬼礁石 | 渔船出海、沉没洞窟、海底钥匙 | ★ Night of Chaos → ★ Darkness is Coming → Truth in the Stones |
| 全速恐惧 | 旧公路追逐、载具疾驰、抵达时机 | ★ Hitman → ★ Clash Defiant → Chase Pulse |
| 雾中之光 | 灯塔迷雾、停尸房与地下室、多线终局 | ★ Dark Fog → ★ Hush → Lost Frontier |
| 达贡巢穴 | 深海祭坛、誓约仪式、诅咒与祝福 | ★ Oppressive Gloom → ★ Anxiety → Ancient Rite |
| 暗潮之下 | 伊哈·恩斯雷门扉、深海之城、终局抉择 | ★ The Descent → ★ Stormfront → Thunder Dreams |


## 地球边缘（七循环）

八关各三首，共 24 首不同曲目。新增 16 首、复用 8 首，按播放位置和独立曲目数计算的复用率均为 **33.3%**，循环内重复率为 0%。音频统一放 common/，按此前 44.1 kHz、128 kbps MP3 规范转码；官方来源、ISRC、原始和转码 SHA-256 见 sources.json，CC BY 4.0 署名见 CREDITS.txt。

| 关卡 | 场景风格 | 播放顺序（★为新增） |
| --- | --- | --- |
| 亡命冰原 I | 坠机冰原、寻找庇护、极地求生 | ★ Despair and Triumph → ★ Moorland → Frozen Star |
| 亡命冰原 II | 风雪寻人、失踪伙伴、冰隙低语 | ★ Spacial Winds → ★ Inexorable → Ice Demon |
| 亡命冰原 III | 营地遇袭、黑雾围困、守住庇护 | ★ Day of Chaos → ★ Darkening Developments → Stormfront |
| 致命幻景 | 记忆迷宫、伙伴往事、幻景救赎 | ★ Evening Fall (Harp) → ★ Lost Time → Dreamlike |
| 失落之峰 | 负重登山、险峻山道、远征不归 | ★ Crossing the Chasm → ★ Long Road Ahead B → Lost Frontier |
| 古老者之城 | 极地古城、异星遗迹、远古机关 | ★ Spacial Harvest → ★ Shadowlands 3 - Machine → Truth in the Stones |
| 疯狂之心 I | 冰下设施、探索封印、黑暗深处 | ★ SCP-x2x (Unseen Presence) → ★ SCP-x4x (Mind Leech) → Orion 300XB |
| 疯狂之心 II | 邪雾苏醒、封印中枢、最后逃离 | ★ Black Vortex → ★ The Complex → Thunder Dreams |

## 绯红密钥（八循环）

十关各三首，共 30 首不同曲目。20 首新增、10 首复用，按播放位置和独立曲目数计算的旧曲复用率均为 **33.3%**，循环内重复率为 0%。新增曲目来自 Kevin MacLeod 的 Incompetech 官方曲库，按 CC BY 4.0 署名，以 44.1 kHz、128 kbps MP3 存入 common/。逐曲来源、ISRC 和校验值见 [sources.json](sources.json)，署名见 [CREDITS.txt](CREDITS.txt)。

| 关卡 | 场景风格 | 播放顺序（★为新增） |
| --- | --- | --- |
| 谜雨 | 伦敦雨夜、街巷追踪、初见红衣人 | ★ Night on the Docks - Sax → ★ No Good Layabout → Dark Walk |
| 死亡酷暑 | 马拉喀什、灼热集市、死者苏醒 | ★ Tabuk → ★ Desert City → Oppressive Gloom |
| 血色阴影 | 布宜诺斯艾利斯、探戈、屋顶追逐 | ★ Tango de Manzana → ★ Bass Walker → Chase Pulse |
| 暗中交易 | 君士坦丁堡、夜市接头、追查货物 | ★ Intrepid → ★ Dhaka → Penumbra |
| 疯星乱舞 | 哈瓦那、舞台与后台、潜入失控 | ★ No Frills Comparsa → ★ No Frills Salsa → Evening of Chaos |
| 如履薄冰 | 安克雷奇、冰原追猎、暴风雪 | ★ Northern Glade → ★ Long Note Four → Frozen Star |
| 战争疮痍 | 亚历山大港、阵营交锋、要塞突围 | ★ Nile's Blues → ★ Killers → Clash Defiant |
| 苦痛之影 | 吉隆坡、雨夜幽魂、红伞旧怨 | ★ Ghostpocalypse - 6 Crossing the Threshold → ★ Trepidation → Anguish |
| 不留痕迹 | 百慕大、异界漂流、寻找失踪者 | ★ Ghostpocalypse - 1 Departure → ★ Nightmare Machine → Symmetry |
| 钥匙议会 | 通古斯卡、密钥审判、异界决战 | ★ Night Vigil → ★ Movement Proposition → Final Battle of the Dark Wizards |
