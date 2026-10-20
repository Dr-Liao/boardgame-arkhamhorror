# 关卡 BGM 分配

覆盖 4 个战役、29 个关卡，每关 2–3 首。前三个战役原有 56 个歌曲位置只用了 17 首不同曲目；补充 15 首后，56 个位置使用 32 首不同曲目，同一首最多分配两次。三循环另有 17 首曲目，其十章歌单不复用前三个战役的曲目。音频文件不重复存储。

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
