# 中文卡图生图暂存流程

使用 Codex 内置生图工具编辑英文卡面。命令行只准备批次和存放结果；生图请求由
Codex 在当前会话中发起，可以按批次清单同时处理多张。无需外部图片服务密钥。

```powershell
cd games/arkhamhorror
npm run images:translate:status
npm run images:translate
```

安静模式使用 `npm run --silent images:translate:quiet`；命令成功时不打印计划结果，
失败仍会输出错误。单独调用 `node tools/translate-images.mjs` 时，`--plan`、`--stage`
和 `--status` 均可加 `--quiet`。Codex 内置生图的图片预览由工具展示，命令行静默参数
无法隐藏该预览。

默认计划下一批 20 张，作为一轮并发生成。计划写到
`artifacts/card-translation/next-batch.json`，包含英文原图路径、中文卡牌数据、
目标路径和并发分组。下一批计划会跳过已登记到游戏、暂存完成或英文原图缺失的卡面，
并按目标文件路径去重；暂存前重新生成计划仍可能再次选中同一张图。
可以调整批次与并发数：

```powershell
node tools/translate-images.mjs --plan --next=24 --concurrency=4
node tools/translate-images.mjs --plan --next=12 --packs=ptc --concurrency=3
```

Codex 对每张卡调用一次内置生图工具。生成文件返回后，用以下命令按原图尺寸转换为
AVIF 并存入暂存目录；也可以由 Codex 在同一批中执行这些命令：

```powershell
node tools/translate-images.mjs --stage --codes=03065 --input=C:\path\to\generated.png
```

所有成品只放在 `artifacts/card-translation/zh/cards/`。计划会跳过已暂存的文件；
暂存时不会覆盖已有文件。流程不设图片校验或人工审核门槛，也不会更新
`web/img/`、`audit/local-images.json` 或游戏图片登记。完成全部生图后再单独处理登记。

需要接入游戏并上传 CDN 时，先运行：

```powershell
node tools/install-translated-images.mjs
node tools/build-presentation.mjs --write
```

安装脚本把暂存 AVIF 复制到 `web/img/zh/cards/`，登记到
`presentation/generated-localized-arts.json` 与 `audit/local-images.json`；重复执行会跳过已有文件。
上传时通过进程环境提供 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、
`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`，然后运行：

```powershell
node tools/upload-card-images.mjs --staged --concurrency=8
```

上传器只处理暂存的中文卡图，R2 已有的对象会跳过。对象键为
`arkhamhorror/cards/zh/<美术编号>.avif`，游戏默认 CDN 地址为
`https://drliao1.com/arkhamhorror/cards/zh/<美术编号>.avif`。
确认上传成功后可以清空对应的暂存 AVIF；已登记的卡图不会因为暂存文件移除而重新进入生图计划。
