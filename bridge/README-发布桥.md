# SocialDesk 本机发布桥

国内平台（小红书 / 抖音 / 视频号 / B站 / 快手 / 知乎 / 微博）**没有开放 API**，
业界通行做法是「扫码登录网页版 → 取 cookie → 程序模拟发布」。
本桥就是干这件事的中间层：SocialDesk 把内容发过来，桥去调用你本机已有的发布工具。

```
SocialDesk（桌面程序）  ──HTTP──▶  social_bridge.py  ──▶  小红书 / 抖音 / 视频号 / B站 …
```

## 启动

```bash
python social_bridge.py              # 默认 127.0.0.1:5409
python social_bridge.py --port 5409  # 指定端口
```

- **只用 Python 标准库，不需要 pip install 任何东西**（Python 3.8+）
- 启动后会自动生成 `config.json`，编辑它来配置平台
- 发布日志写在 `bridge.log`

## 配置 config.json

```jsonc
{
  "port": 5409,
  "timeoutSec": 600,        // 单次发布允许的最长时间（视频上传慢，给足）
  "dryRun": false,          // true = 只打印将要执行的命令，不真发（第一次建议先开着试）
  "vars": {                 // 自定义变量，模板里用 {sau} 引用
    "sau": "C:/tools/social-auto-upload"
  },
  "platforms": {
    "xiaohongshu": {
      "enabled": true,      // ← 改成 true 才生效
      "name": "小红书",
      "handler": "shell",
      "command": "python {sau}/examples/upload_video_to_xiaohongshu.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
      "cwd": ""             // 可选：命令的工作目录
    }
  }
}
```

## 命令模板占位符

桥会把 SocialDesk 发来的内容填进 `command` 里：

| 占位符 | 内容 |
|---|---|
| `{video}` / `{image}` / `{media}` | 第一个本地素材的**绝对路径** |
| `{mediaAll}` | 全部素材路径（已带引号，空格分隔） |
| `{mediaCount}` | 素材数量 |
| `{title}` | 标题（取正文第一行，最长 80 字） |
| `{content}` | 完整正文（已含话题标签） |
| `{tags}` | 话题标签（`#xxx` 形式） |
| `{firstComment}` | 首评内容 |
| `{account}` | 账号 handle |
| `{platform}` | 平台 id |
| `{scheduledAt}` | 排期时间 |
| `{json}` | 原始请求 JSON（给自写脚本用） |
| 你在 `vars` 里定义的 | 任意自定义变量 |

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 返回 `{ok:true, platforms:[已启用平台]}`，SocialDesk 用它测连接 |
| POST | `/publish` | 执行发布 |
| POST | `/dry-run` | 只渲染命令不执行 |

`POST /publish` 请求体：

```json
{
  "platform": "xiaohongshu",
  "title": "标题",
  "content": "正文（已含话题标签）",
  "hashtags": ["标签1"],
  "firstComment": "",
  "mediaPaths": ["C:/Users/you/AppData/Roaming/SocialDesk/data/media/xxx.mp4"],
  "account": "@xiaohongshu_1",
  "scheduledAt": "2026-10-16T10:00:00.000Z"
}
```

返回 `{"ok": true, "message": "已通过本机脚本发布到 小红书"}` 即视为成功。

## 现成发布工具

[`dreammis/social-auto-upload`](https://github.com/dreammis/social-auto-upload)（MIT，15.5k★）
已实现抖音/小红书/视频号/B站/TikTok/YouTube 的 cookie 发布，默认配置里就是它的接法示例。

## 风险提示

- cookie 会过期，失效后要重新扫码登录
- 模拟用户行为有触发平台风控的可能，**建议用小号试**
- 第一次配置建议把 `dryRun` 设为 `true`，确认命令拼对了再关掉
