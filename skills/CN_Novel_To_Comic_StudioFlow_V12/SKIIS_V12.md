# SKIIS V12：CN Novel To Comic StudioFlow

## 定位

中国小说转漫画的正式连载生产技能包。V12 不再采用“整页一次性生成”，而是模拟人类漫画团队流程：

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

## 基础配置

```yaml
SKIIS_NAME: CN_Novel_To_Comic_StudioFlow_V12
MODE: 中国小说转漫画 / 国漫彩条漫 / 日系人物线稿 / 人类漫画工作流
UNIT: 1个小说章节 = 1期漫画
PAGE_COUNT:
  default: 8
  dense_chapter: 10
  max: 10
PAGE_TYPE: 中国移动端竖向条漫页面段
CANVAS:
  master_width: 1600px
  export_width: 1280px
  height: 按内容变化，不固定9:16
STYLE:
  国漫彩条漫
  偏日系人物线稿
  赛璐璐平涂
  清晰黑线
  中低细节
  强分镜节奏
  少AI光效
  少CG电影感
```

## 总原则

```yaml
priority:
  1: 人物一眼分清
  2: 人物前后稳定
  3: 脚本有冲突和钩子
  4: 分镜像导演安排，不像图片拼贴
  5: 页面阅读流畅
  6: 场景锚点连续
  7: 气泡排版专业
  8: 单图精细度

forbid:
  - 不要整页一次性生成最终漫画
  - 不要一页塞完整章
  - 不要总览图
  - 不要角色设定栏画进漫画
  - 不要CG电影场景
  - 不要游戏概念图感
  - 不要AI厚涂海报感
  - 不要所有配角同脸
  - 不要复杂背景压过人物
  - 不要AI直接生成大量中文小字
```

## 核心生产逻辑

```yaml
production_mode:
  old_wrong_way: 整页直接生成
  new_correct_way: 单格无字图生成 + 页面合成 + 中文后期排版

pipeline:
  1_chapter_analysis:
    output:
      - chapter_card.json
  2_character_lock:
    output:
      - character_lock.json
      - 角色锚点图
  3_scene_lock:
    output:
      - scene_lock.json
      - 场景锚点图
  4_director_beat:
    output:
      - director_beat_sheet.json
  5_page_script:
    output:
      - page_script.json
  6_panel_generation:
    output:
      - panel_images/P01_01.png
      - panel_images/P01_02.png
      - 单格无字图
  7_page_compose:
    output:
      - comic_pages/P01.png
      - 合成后的漫画页
  8_lettering:
    output:
      - 中文气泡
      - 拟声字
      - 旁白框
  9_handoff:
    output:
      - handoff.json
```

## 默认交付

```yaml
default_delivery:
  - comic_pages/
      - P01.png
      - P02.png
      - ...
  - page_script.json
  - handoff.json

internal_assets:
  - chapter_card.json
  - director_beat_sheet.json
  - character_lock.json
  - scene_lock.json
  - panel_images/
  - lettering_data.json
  - qc_report.json
```

## 小说分析规则

```yaml
chapter_analysis:
  story_spine:
    start_state:
    turning_point:
    end_state:
    chapter_hook:

  character_intent:
    protagonist_goal:
    antagonist_goal:
    support_character_value:
    pressure_source:

  visual_must_have:
    key_scene:
    key_prop:
    key_action:
    key_symbol:

  emotion_curve:
    curiosity:
    tension:
    pressure:
    reversal:
    hook:

  cut_list:
    remove:
      - 重复解释
      - 长篇内心独白
      - 低视觉价值旁白
    convert:
      - 内心判断 -> 眼神/手部停顿
      - 世界观说明 -> 道具特写+短旁白
      - 群体压迫 -> 阵型/剪影/色块
```

## 页数判断

```yaml
page_count_selector:
  simple_chapter:
    pages: 6
    condition: 单事件、少角色、无大战

  normal_chapter:
    pages: 8
    condition: 有发现、行动、转折、钩子

  dense_chapter:
    pages: 10
    condition: 有关键道具、多方势力、身份反转、高潮宣言

  hard_limit:
    max_pages: 10
    reason: 减少角色漂移，提高完成度
```

## 导演页纲

```yaml
director_beat:
  page_no:
  reader_question: 这一页开头，读者想知道什么？
  page_answer: 这一页回答什么？
  new_question: 这一页结尾留下什么？
  emotional_target: 好奇/紧张/压迫/爽点/反转/悬念
  key_visual: 本页最大视觉记忆点
  camera_strategy: 远景/近景/特写/斜切/留白/反应格
  page_turn_hook: 让读者继续下滑的钩子
```

## 页面脚本格式

```yaml
page_script:
  page_no:
  page_goal:
  reader_hook:
  conflict_line:
  turn_or_reveal:
  end_hook:
  layout_plan:
  panels:
    - panel_id:
      panel_role: 建立/推进/反应/反转/钩子
      size: 大/中/小/窄长/斜切/无边框
      shot: 大远景/中景/近景/特写/极近特写/背影/俯视/仰视
      camera_intent: 神秘/压迫/速度/停顿/爽点
      image_prompt:
      no_text_image: true
      lettering:
        text:
        bubble_type:
        position:
      sfx:
```

## 每页分镜规则

```yaml
page_panel_rule:
  panels_per_page: 3-6
  max_focus_faces: 3
  max_dialogue_bubbles: 5
  one_page_one_change: true

must_have_per_page:
  - 1个主视觉大格
  - 1个特写格
  - 1个反应格或静默格
  - 至少1个非普通横格

panel_forbid:
  - 全页都是横向矩形
  - 全页都是大场景
  - 全页都是人物近景
  - 没有反应格
  - 没有结尾钩子
```

## 分镜切块库

```yaml
panel_cut_library:
  A_wide_establishing:
    use: 建立大场景
    shape: 横向大格
  B_tall_pressure:
    use: 高处压迫/敌方登场
    shape: 窄长竖格
  C_closeup_slice:
    use: 眼神/手/法宝
    shape: 横向窄条
  D_diagonal_action:
    use: 冲击/飞行/斩击
    shape: 斜切格
  E_silent_gap:
    use: 悬念/停顿/压抑
    shape: 大留白或无字小格
  F_reaction_stack:
    use: 群像反应
    shape: 2-3个小格叠放
  G_bleed_impact:
    use: 高潮爆点
    shape: 无边框溢出版
```

## 角色锁定规则

```yaml
character_shape_language:
  name:
  tier:
  role:
  silhouette:
  age_read:
  face_shape:
  eye_brow:
  hair_beard:
  body_posture:
  outfit_shape:
  color_block:
  prop_or_mark:
  speech_style:
  appearance_limit:
  forbidden:

character_tier:
  A_main:
    rule: 主角，必须最稳定，基础角色图优先
  B_key_support:
    rule: 关键配角，出场少但强识别
  C_named_pressure:
    rule: 命名敌方，必须有独立轮廓和脸型差异
  D_crowd:
    rule: 群像不精画脸，靠阵型、服色、武器、旗帜识别
```

## 关键角色专项

```yaml
main_character:
  must_keep:
    - 发型轮廓
    - 脸型
    - 眉眼
    - 服装大轮廓
    - 主色块
    - 标志性道具
  forbid:
    - 换发型
    - 换服装主色
    - 每页换脸

child_character_rule:
  max_appearance_per_issue: 2
  no_random_background_appearance: true
  no_crowd_mixing: true
  must_keep:
    - 小体型
    - 圆脸大眼
    - 固定发型
    - 固定服装色
    - 固定道具
  forbid:
    - 成人化
    - 长发少女化
    - 黑衣化
    - 随机出现在群像中

old_enemy_rule:
  each_named_enemy_must_have:
    - 不同脸型
    - 不同胡须
    - 不同体型
    - 不同姿态
    - 不同主色块
  forbid:
    - 两个老者同脸
    - 只靠衣服区分
```

## 场景锁定规则

```yaml
scene_anchor:
  name:
  landmarks:
  color_palette:
  repeated_angle:
  simplified_background_version:
  used_pages:
  do_not_change:

scene_style:
  establishing:
    detail: medium
    use: 交代地标
  dialogue:
    detail: low
    use: 人物关系优先，背景简化
  action:
    detail: very_low
    use: 速度线、气浪、碎石、色块背景

scene_forbid:
  - 电影体积光
  - 游戏概念背景
  - 每页都大远景
  - 背景纹理抢人物
```

## 画风锁定

```yaml
STYLE_LOCK:
  name: 国漫彩条漫_日系线稿_赛璐璐平涂_导演分镜版
  line:
    - 清晰黑色漫画线稿
    - 主轮廓略粗
    - 内部线条较细
    - 允许少量手绘粗糙感
  color:
    - 赛璐璐平涂
    - 平涂色块
    - 1-2层硬边阴影
    - 少渐变
    - 少法宝光
    - 少材质纹理
  character:
    - 日系人物脸型
    - 鼻口简化
    - 眼睛有表现力
    - 表情漫画化
    - 国漫玄幻服装轮廓
  background:
    - 背景简化
    - 只保留地标
    - 不要CG电影感
    - 不要游戏场景概念图
  panel:
    - 黑边分镜
    - 竖向滚动
    - 大中小切块变化
    - 留白节奏
    - 速度线和拟声字
```

## 统一风格提示词

```text
中国移动端国漫彩条漫，偏日系人物线稿，清晰黑色漫画线，主轮廓略粗，内部线条较细，赛璐璐平涂，平涂色块，1-2层硬边阴影，少量局部法宝光，背景简化，分镜黑边清楚，竖向滚动条漫，人物表情漫画化，强镜头切换，留白节奏，像人类漫画工作室连载页。
```

英文辅助：

```text
mainstream Chinese vertical color manhua, Japanese-influenced manga character line art, clean black ink outline, variable line weight, cel-shading, flat color blocks, simple hard-edge shadows, low-to-mid detail, simplified background, comic panel readability, hand-drawn comic feeling, rough line texture, vertical scrolling webcomic layout
```

负面提示：

```text
AI poster, cinematic CG, game concept art, glossy painting, painterly rendering, oil painting, realistic skin, 3D face, excessive glow, volumetric light, depth of field, hyper detailed background, same face syndrome, character sheet, infographic, summary page, thumbnails
```

## 单格生成规则

```yaml
panel_generation:
  input:
    - character_lock
    - scene_lock
    - panel_prompt
    - camera_intent
  output:
    - 无字单格图
  rules:
    - 不生成中文对白
    - 保留气泡位置
    - 人物脸型和服装必须参考character_lock
    - 背景只保留本格需要的锚点
```

## 页面合成规则

```yaml
page_compose:
  input:
    - panel_images
    - layout_plan
    - lettering_data
  output:
    - comic_pages/Pxx.png
  rules:
    - 分镜边框统一
    - 留白按节奏设置
    - 大格和小格比例明确
    - 中文气泡后期添加
    - 拟声字可手写风
```

## 中文排版规则

```yaml
lettering:
  bubble_text: 6-16字
  max_bubbles_per_page: 5
  font_style: 中文漫画黑体/手写感标题字
  bubble_order: 从上到下，按阅读动线
  bubble_types:
    normal: 圆形对白
    shout: 爆炸气泡
    thought: 云状或小尾巴
    narration: 方框旁白
  forbid:
    - AI生成乱码字
    - 气泡挡脸
    - 一格塞太多字
```

## 验收标准

```yaml
acceptance:
  production:
    single_panel_generation: required
    page_compose: required
    lettering_after_generation: required
  manga_feel:
    line_art_visible: required
    cel_shading_visible: required
    no_cg_background: required
    no_ai_poster: required
  character:
    main_character_consistent: required
    support_characters_distinct: required
    child_character_stable: required
    old_men_not_same_face: required
    group_characters_not_overdrawn: required
  director:
    one_page_one_question: required
    one_page_one_answer: required
    page_end_hook: required
    panel_shape_variety: required
    camera_angle_variety: required
    reaction_panel_present: required
  strip_reading:
    vertical_scroll_rhythm: required
    whitespace_used: required
    not_all_horizontal_panels: required
```
