'use strict';
/**
 * 发布日志：内存环形缓冲（给界面看） + 追加写磁盘文件（留档）。
 */
const fs = require('node:fs');
const { paths } = require('./paths.cjs');

const MAX_MEM = 800;
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 超过 4MB 自动轮转

const ring = [];
let sink = null;

function setSink(fn) {
  sink = fn;
}

function rotateIfNeeded() {
  try {
    const p = paths().logFile;
    const st = fs.statSync(p);
    if (st.size > MAX_FILE_BYTES) {
      fs.renameSync(p, p.replace(/\.log$/, `.${Date.now()}.log`));
      // 只保留最近 3 个轮转文件
      const dir = paths().logDir;
      const olds = fs
        .readdirSync(dir)
        .filter((f) => /^publish\.\d+\.log$/.test(f))
        .sort()
        .slice(0, -3);
      for (const f of olds) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* 文件不存在时无需处理 */
  }
}

function log(level, msg, meta) {
  const entry = { at: new Date().toISOString(), level, msg, meta: meta ?? null };
  ring.push(entry);
  if (ring.length > MAX_MEM) ring.shift();

  const line = `[${entry.at}] ${level.toUpperCase().padEnd(5)} ${msg}${
    meta ? ' ' + safeJson(meta) : ''
  }\n`;
  try {
    rotateIfNeeded();
    fs.appendFileSync(paths().logFile, line, 'utf8');
  } catch {
    /* ignore */
  }
  try {
    if (sink) sink(entry);
  } catch {
    /* ignore */
  }
  // 主进程控制台也打印一份，方便排查
  process.stdout.write(line);
  return entry;
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/* log 本身可当函数调用，也挂了快捷方法：
   既支持 log('info', '...') 也支持 log.info('...') / log[level]('...') */
log.info = (m, meta) => log('info', m, meta);
log.ok = (m, meta) => log('ok', m, meta);
log.warn = (m, meta) => log('warn', m, meta);
log.error = (m, meta) => log('error', m, meta);

module.exports = {
  log,
  setSink,
  tail: (n = 200) => ring.slice(-n),
  clear: () => {
    ring.length = 0;
  },
  info: log.info,
  ok: log.ok,
  warn: log.warn,
  error: log.error,
};
