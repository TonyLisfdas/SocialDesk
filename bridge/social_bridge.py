#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SocialDesk 本机发布桥  ·  social_bridge.py
=====================================================================
国内平台（小红书 / 抖音 / 视频号 / B站 / 快手 / 知乎 / 微博）没有开放 API，
业界通行做法是「扫码登录网页版 → 取 cookie → 程序模拟发布」。

本桥的作用：把 SocialDesk 发来的内容，转给你本机已有的发布工具去执行。
- 只用 Python 标准库，不需要 pip install 任何东西即可启动
- 真正的发布动作由 config.json 里配置的「命令模板」完成，
  这样你想用 social-auto-upload、playwright 脚本、还是自写脚本，都能接
- 支持试运行（dry_run）：只打印将要执行的命令，不真的发

启动：
    python bridge/social_bridge.py
    python bridge/social_bridge.py --port 5409
然后回到 SocialDesk → 账号管理 → 小红书/抖音等 → 凭证填 http://127.0.0.1:5409

接口：
    GET  /health    → {"ok": true, "platforms": [...]}
    POST /publish   → 执行发布
    POST /dry-run   → 只校验、不回传失败
"""

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(ROOT, "config.json")
LOG_FILE = os.path.join(ROOT, "bridge.log")

DEFAULT_CONFIG = {
    "_说明": "把下面每个平台的 enabled 改成 true，并按你的实际工具改 command。占位符见 README。",
    "port": 5409,
    "timeoutSec": 600,
    "dryRun": False,
    "platforms": {
        "xiaohongshu": {
            "enabled": False,
            "name": "小红书",
            "handler": "shell",
            "command": "python {sau}/examples/upload_video_to_xiaohongshu.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
            "note": "示例：接 dreammis/social-auto-upload（MIT）。把 {sau} 指向你克隆的仓库目录。",
        },
        "douyin": {
            "enabled": False,
            "name": "抖音",
            "handler": "shell",
            "command": "python {sau}/examples/upload_video_to_douyin.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
            "note": "同上，抖音版脚本",
        },
        "wechat_channels": {
            "enabled": False,
            "name": "视频号",
            "handler": "shell",
            "command": "python {sau}/examples/upload_video_to_tencent.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
            "note": "同上，视频号版脚本",
        },
        "bilibili": {
            "enabled": False,
            "name": "哔哩哔哩",
            "handler": "shell",
            "command": "python {sau}/examples/upload_video_to_bilibili.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
            "note": "",
        },
        "kuaishou": {
            "enabled": False,
            "name": "快手",
            "handler": "shell",
            "command": "python {sau}/examples/upload_video_to_kuaishou.py --file \"{video}\" --title \"{title}\" --desc \"{content}\"",
            "note": "",
        },
        "zhihu": {
            "enabled": False,
            "name": "知乎",
            "handler": "shell",
            "command": "",
            "note": "自己写个脚本，用 cookie 调知乎的 API；把命令填这里即可。",
        },
    },
    "vars": {
        "sau": "C:/tools/social-auto-upload",
    },
}


def log(msg):
    line = "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_config():
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=2)
        log("已生成默认配置：%s（把要用的平台 enabled 改成 true）" % CONFIG_FILE)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    # 补齐缺省字段
    for k, v in DEFAULT_CONFIG.items():
        if k not in cfg:
            cfg[k] = v
    for pid, pcfg in DEFAULT_CONFIG["platforms"].items():
        cfg["platforms"].setdefault(pid, pcfg)
    cfg.setdefault("vars", {})
    return cfg


def build_context(payload):
    """把工作台发来的 JSON 展开成命令模板能用的占位符"""
    media_paths = [p for p in (payload.get("mediaPaths") or []) if p and os.path.exists(p)]
    first = media_paths[0] if media_paths else ""
    content = payload.get("content") or ""
    title = (payload.get("title") or content.splitlines()[0] if content else "")[:80]
    tags = payload.get("hashtags") or []
    ctx = {
        "video": first,
        "image": first,
        "media": first,
        "mediaAll": " ".join('"%s"' % p for p in media_paths),
        "mediaCount": str(len(media_paths)),
        "title": title,
        "content": content,
        "tags": " ".join("#" + t.lstrip("#") for t in tags),
        "firstComment": payload.get("firstComment") or "",
        "platform": payload.get("platform") or "",
        "account": payload.get("account") or "",
        "scheduledAt": payload.get("scheduledAt") or "",
        "json": json.dumps(payload, ensure_ascii=False),
    }
    return ctx, media_paths


def render(template, ctx):
    out = template
    for k, v in ctx.items():
        out = out.replace("{%s}" % k, str(v))
    return out


def run_platform(pid, payload, cfg, dry_run=False):
    conf = (cfg.get("platforms") or {}).get(pid)
    if not conf:
        return {"ok": False, "message": "桥里没有配置平台：%s" % pid}
    if not conf.get("enabled"):
        return {
            "ok": False,
            "message": "%s 还没启用。打开 bridge/config.json，把 platforms.%s.enabled 改成 true 并填好 command。"
            % (conf.get("name", pid), pid),
        }

    command = (conf.get("command") or "").strip()
    if not command:
        return {"ok": False, "message": "%s 没有配置 command（bridge/config.json）" % pid}

    ctx, media_paths = build_context(payload)
    ctx.update({k: v for k, v in (cfg.get("vars") or {}).items()})
    cmd = render(command, ctx)

    if not media_paths and "{video}" in command:
        return {
            "ok": False,
            "message": "这条内容没有可用的本地素材文件。%s 需要视频/图片，请在素材库里上传（或用链接）。"
            % conf.get("name", pid),
        }

    log("执行：%s" % cmd)
    if dry_run or cfg.get("dryRun"):
        return {"ok": True, "message": "试运行（未真正发布）：%s" % cmd, "dryRun": True}

    shell = True if os.name == "nt" else True
    try:
        proc = subprocess.run(
            cmd,
            shell=shell,
            cwd=conf.get("cwd") or ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=int(cfg.get("timeoutSec") or 600),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "message": "命令超时（%ss）——平台可能卡在上传，去看窗口输出" % cfg.get("timeoutSec")}
    except Exception as e:
        return {"ok": False, "message": "命令启动失败：%s" % e}

    tail = (proc.stdout or "")[-800:] + (("\n" + proc.stderr[-800:]) if proc.stderr else "")
    if proc.returncode == 0:
        log("成功：%s" % pid)
        return {"ok": True, "message": "已通过本机脚本发布到 %s" % conf.get("name", pid), "output": tail}
    log("失败（code=%s）：%s" % (proc.returncode, pid))
    return {
        "ok": False,
        "message": "脚本返回错误码 %s。看下面输出末尾通常是原因。" % proc.returncode,
        "output": tail,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "SocialDeskBridge/1.0"
    cfg = DEFAULT_CONFIG

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/health", "/"):
            ready = [p for p, c in (self.cfg.get("platforms") or {}).items() if c.get("enabled")]
            self._send(
                200,
                {
                    "ok": True,
                    "service": "SocialDesk publish bridge",
                    "python": sys.version.split()[0],
                    "platforms": ready,
                    "note": "未启用的平台请改 bridge/config.json",
                },
            )
            return
        self._send(404, {"ok": False, "message": "unknown path"})

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception as e:
            self._send(400, {"ok": False, "message": "请求体不是合法 JSON：%s" % e})
            return

        if path == "/publish":
            pid = payload.get("platform") or ""
            result = run_platform(pid, payload, self.cfg, dry_run=False)
            self._send(200 if result.get("ok") else 200, result)
            return

        if path == "/dry-run":
            pid = payload.get("platform") or ""
            result = run_platform(pid, payload, self.cfg, dry_run=True)
            self._send(200, result)
            return

        self._send(404, {"ok": False, "message": "unknown path"})


def main():
    ap = argparse.ArgumentParser(description="SocialDesk 本机发布桥")
    ap.add_argument("--port", type=int, default=None)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    cfg = load_config()
    Handler.cfg = cfg
    port = args.port or int(cfg.get("port") or 5409)

    ready = [p for p, c in cfg["platforms"].items() if c.get("enabled")]
    print("=" * 62)
    print(" SocialDesk 本机发布桥")
    print(" 地址： http://%s:%s      （填到 SocialDesk 的账号凭证里）" % (args.host, port))
    print(" 已启用平台： %s" % (", ".join(ready) if ready else "（无，请编辑 bridge/config.json）"))
    print(" 配置文件： %s" % CONFIG_FILE)
    print(" 发布日志： %s" % LOG_FILE)
    print(" 按 Ctrl+C 停止")
    print("=" * 62)

    srv = ThreadingHTTPServer((args.host, port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
