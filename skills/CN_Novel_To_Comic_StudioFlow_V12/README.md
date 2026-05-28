# CN Novel To Comic StudioFlow V12

这是一个用于 **中国小说转漫画** 的 SKIIS 技能包，目标是把一章小说稳定改编成一组可连续生产的中国移动端彩色条漫页面。

## 核心定位

V12 不再采用“整页一次性生成”的方式，而是模拟人类漫画工作流：

```text
小说章节原文
→ 章节分析
→ 角色锁定
→ 场景锁定
→ 导演页纲
→ 页面脚本
→ 单格无字图
→ 页面合成
→ 中文后期排版
→ handoff 交接文件
```

## 适用场景

- 中国玄幻、修真、都市异能、武侠、奇幻小说转漫画
- 移动端竖向条漫
- 需要长期连载、角色连续、风格统一的漫画项目
- 需要降低 AI 味、减少角色漂移、增强分镜导演感的漫画生产流程

## 风格目标

```yaml
style:
  - 中国移动端国漫彩条漫
  - 偏日系人物线稿
  - 赛璐璐平涂
  - 清晰黑色漫画线稿
  - 中低细节
  - 强分镜节奏
  - 少 AI 光效
  - 少 CG 电影感
```

## 默认输出

对外默认只交付最必要文件：

```text
comic_pages/
  P01.png
  P02.png
  ...
page_script.json
handoff.json
```

内部生产资产可选保留：

```text
chapter_card.json
director_beat_sheet.json
character_lock.json
scene_lock.json
panel_images/
lettering_data.json
qc_report.json
```

## 使用方法

新项目启动时，把以下内容交给 GPT 或漫画生产 Agent：

```text
请读取我上传的：
1. 小说章节原文
2. SKIIS_V12.md
3. 基础角色图
4. 上一期 handoff.json

按 SKIIS V12 工作。
不要直接生成整页最终图。
先输出 chapter_card、director_beat_sheet、character_lock、scene_lock、page_script 和 P01 单格生成计划。
我确认后，再按“单格无字图 → 页面合成 → 中文排版”的流程生成 P01。
```

## 文件说明

- `SKIIS_V12.md`：完整技能包规范
- `templates/page_script.template.json`：页面脚本模板
- `templates/handoff.template.json`：交接文件模板
- `prompts/style_prompt.md`：统一画风提示词与负面提示词

## 版本

```yaml
version: 12.0
name: CN_Novel_To_Comic_StudioFlow_V12
status: production-template
```
