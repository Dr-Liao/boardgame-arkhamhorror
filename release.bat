@echo off
REM 一键发布诡镇奇谈：只更新本仓库的版本号、提交、打 tag 并推送。
REM 推送 tag 后由 GitHub Actions 自动打包并发布 Release，玩家从大厅的游戏商店更新。
REM 不修改也不推送大厅仓库；大厅发布请运行根目录的 release.bat。
REM 用法：release.bat [版本号] [更新说明] [--no-pause]
REM   不传版本号时会提示输入，例如 0.3.0（不带 v）。
setlocal EnableExtensions
chcp 65001 >nul
pushd "%~dp0" || goto directory_error

set "VERSION=%~1"
if /i "%VERSION%"=="--no-pause" set "VERSION="
set "NOTES=%~2"
set "NOPAUSE="
if /i "%~1"=="--no-pause" set "NOPAUSE=1"
if /i "%NOTES%"=="--no-pause" set "NOTES="
if /i "%~2"=="--no-pause" set "NOPAUSE=1"
if /i "%~3"=="--no-pause" set "NOPAUSE=1"

echo ==================================================
echo   诡镇奇谈 - 一键打包发布
echo ==================================================
echo.

where git >nul 2>nul
if errorlevel 1 goto git_missing
where node >nul 2>nul
if errorlevel 1 goto node_missing

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto not_repo
if not exist "..\..\tools\release\set-version.mjs" goto hall_tools_missing

set "ARK_DIRTY="
for /f "usebackq delims=" %%I in (`git status --porcelain`) do set "ARK_DIRTY=1"
if defined ARK_DIRTY goto dirty_tree

echo 正在从远端获取最新状态...
git fetch --tags origin
if errorlevel 1 goto fetch_failed

git rev-parse --verify origin/main >nul 2>nul
if errorlevel 1 goto no_origin_main

for /f "usebackq delims=" %%I in (`git rev-parse --abbrev-ref HEAD`) do set "ARK_BRANCH=%%I"
if /i "%ARK_BRANCH%"=="main" goto branch_ready

echo [诡镇奇谈] 当前是 detached HEAD，切换到 main...
set "ARK_BASE=main"
git rev-parse --verify refs/heads/main >nul 2>nul
if errorlevel 1 set "ARK_BASE=origin/main"
git rev-parse --verify "%ARK_BASE%" >nul 2>nul
if errorlevel 1 goto detached_failed
git merge-base --is-ancestor "%ARK_BASE%" HEAD
if errorlevel 1 goto detached_ahead
git checkout -B main HEAD
if errorlevel 1 goto detached_failed
set "ARK_BRANCH=main"
goto branch_ready

:detached_ahead
git merge-base --is-ancestor HEAD "%ARK_BASE%"
if errorlevel 1 goto diverged
git checkout -B main "%ARK_BASE%"
if errorlevel 1 goto detached_failed
set "ARK_BRANCH=main"

:branch_ready
for /f "usebackq delims=" %%I in (`git rev-list --count origin/main..HEAD`) do set "ARK_AHEAD=%%I"
for /f "usebackq delims=" %%I in (`git rev-list --count HEAD..origin/main`) do set "ARK_BEHIND=%%I"
if not "%ARK_AHEAD%"=="0" goto ark_ahead
if not "%ARK_BEHIND%"=="0" goto ark_behind

if not defined VERSION goto prompt_version
goto version_ready

:prompt_version
set "VERSION="
set /p "VERSION=请输入诡镇奇谈版本号（x.y.z，例如 0.3.0）: "

:version_ready
if not defined VERSION goto version_cancelled
echo %VERSION%| findstr /r /c:"^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 goto bad_version

git rev-parse -q --verify "refs/tags/v%VERSION%" >nul 2>nul
if not errorlevel 1 goto tag_exists

if not defined NOTES goto prompt_notes
goto notes_ready

:prompt_notes
set /p "NOTES=更新说明（可留空，默认 Release v%VERSION%）: "

:notes_ready
if not defined NOTES set "NOTES=Release v%VERSION%"

echo.
echo 即将发布诡镇奇谈 v%VERSION%
echo   更新说明：%NOTES%
echo.

echo 正在更新诡镇奇谈版本号...
node "..\..\tools\release\set-version.mjs" "%VERSION%" --target=arkham
if errorlevel 1 goto bump_failed
echo.
echo 版本文件：
git status --short
echo.

echo 提交并打 tag...
git add -A
git commit -m "chore: release v%VERSION%"
if errorlevel 1 goto commit_failed
git tag -a "v%VERSION%" -m "%NOTES%"
if errorlevel 1 goto tag_failed

echo.
echo 正在推送诡镇奇谈...
git push origin main
if errorlevel 1 goto push_failed
git push origin "v%VERSION%"
if errorlevel 1 goto tag_push_failed

echo.
echo 发布已触发：v%VERSION%
echo   GitHub Actions 正在打包并发布，通常需要几分钟。
echo.
echo   诡镇发布页：https://github.com/Dr-Liao/boardgame-arkhamhorror/releases/tag/v%VERSION%
echo   构建进度：
echo   https://github.com/Dr-Liao/boardgame-arkhamhorror/actions/workflows/release.yml
echo.
echo   提示：大厅仓库里的子模块指针已指向新提交，发布大厅前请先运行 push-all.bat。
set "RESULT=0"
goto finish

:git_missing
echo [错误] 未找到 git，请先安装 Git for Windows：https://git-scm.com/download/win
set "RESULT=1"
goto finish

:node_missing
echo [错误] 未找到 node，请先安装 Node.js 22.15+：https://nodejs.org
set "RESULT=1"
goto finish

:not_repo
echo [错误] 当前目录不是 git 仓库，无法发布。
set "RESULT=1"
goto finish

:hall_tools_missing
echo [错误] 找不到大厅的版本脚本 ..\..\tools\release\set-version.mjs。
echo        诡镇奇谈需要作为大厅仓库的 games\arkhamhorror 子模块使用。
set "RESULT=1"
goto finish

:dirty_tree
echo [错误] 局部有未提交的改动，发布前必须保持工作区干净。
echo        请先提交并推送（或运行大厅根目录的 push-all.bat），然后重试。
echo        当前改动：
git status --short
set "RESULT=1"
goto finish

:fetch_failed
echo [错误] 获取远端状态失败，请检查网络后再试。
set "RESULT=1"
goto finish

:no_origin_main
echo [错误] 找不到 origin/main 远端分支，请检查 git remote 配置。
set "RESULT=1"
goto finish

:detached_failed
echo [错误] 诡镇奇谈处于 detached HEAD，且无法安全切换到 main。
echo        请手动检查：git status
set "RESULT=1"
goto finish

:diverged
echo [错误] 诡镇奇谈的 detached HEAD 与 main 已分叉，无法自动切换。
echo        请手动检查：git log --oneline --graph --all -20
set "RESULT=1"
goto finish

:ark_ahead
echo [错误] 诡镇奇谈有未推送的本地提交，请先运行 push-all.bat。
set "RESULT=1"
goto finish

:ark_behind
echo [错误] 诡镇奇谈落后于 origin/main，请先运行大厅根目录的 pull-latest.bat。
set "RESULT=1"
goto finish

:version_cancelled
echo 已取消，未做任何修改。
set "RESULT=1"
goto finish

:bad_version
echo [错误] 版本号格式不正确：%VERSION%
echo        请使用 x.y.z，例如 0.3.0（不要带 v）。
set "RESULT=1"
goto finish

:tag_exists
echo [错误] 诡镇奇谈的 tag v%VERSION% 已存在。
echo        若上次发布中断，可手动推送该 tag；否则请换一个更大的版本号。
echo        删除本地 tag：git tag -d v%VERSION%
set "RESULT=1"
goto finish

:bump_failed
echo [错误] 版本号更新失败，未做任何提交。
set "RESULT=1"
goto finish

:commit_failed
echo [错误] 提交失败，请查看上方 git 的错误信息。
echo        版本号可能已改到工作区，请手动检查后重试。
set "RESULT=1"
goto finish

:tag_failed
echo [错误] 创建 tag 失败，提交已保留。
echo        请手动检查：git tag -l "v%VERSION%"
set "RESULT=1"
goto finish

:push_failed
echo [错误] 推送失败。本地提交和 tag 已保留，不会丢失。
echo        网络恢复后可手动执行：
echo          git push origin main
echo          git push origin v%VERSION%
set "RESULT=1"
goto finish

:tag_push_failed
echo [错误] 分支已推送，但 tag 推送失败，GitHub Actions 尚未触发。
echo        本地 tag 已保留，网络恢复后手动执行：
echo          git push origin v%VERSION%
set "RESULT=1"
goto finish

:directory_error
echo [错误] 无法进入脚本所在目录 "%~dp0"。
pause
exit /b 1

:finish
popd
echo.
if not defined NOPAUSE pause
exit /b %RESULT%
