'use strict';
/**
 * 文件数据库：原子写入 + 自动滚动备份 + 崩溃保护。
 * 独立版的核心价值之一：数据落在你自己的磁盘上，不受浏览器 5MB 限制，
 * 清缓存 / 换浏览器都不会丢。
 */
const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./paths.cjs');
const { log } = require('./logger.cjs');

const MAX_BACKUPS = 30;
const DB_VERSION = 2;

function emptyDB() {
  return {
    version: DB_VERSION,
    posts: [],
    media: [],
    ideas: [],
    inbox: [],
    accounts: [],
    settings: {
      lang: 'zh',
      theme: 'dark',
      hiddenPlatforms: [],
      weekStart: 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      autoFirstComment: true,
      smartTime: true,
      brandVars: { 品牌: 'SocialDesk', 主推产品: '', 官网: '' },
    },
  };
}

/** 合并缺省字段，保证老数据 / 手工改坏的数据也能读起来 */
function normalize(raw) {
  const seed = emptyDB();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.posts)) return null;
  return {
    ...seed,
    ...raw,
    version: DB_VERSION,
    settings: { ...seed.settings, ...(raw.settings || {}) },
    media: Array.isArray(raw.media) ? raw.media : [],
    ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
    inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
  };
}

/** 读取数据库；文件不存在返回 null（调用方决定是否灌演示数据） */
function readDB() {
  const { dbFile } = paths();
  if (!fs.existsSync(dbFile)) return null;
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const parsed = normalize(JSON.parse(raw));
    if (!parsed) {
      log.warn('数据库结构异常，已忽略并保留原文件', { file: dbFile });
      return null;
    }
    return parsed;
  } catch (e) {
    log.error('读取数据库失败', { error: String(e && e.message) });
    // 读坏了不要直接覆盖用户数据，先备份一份坏的
    try {
      fs.copyFileSync(dbFile, path.join(paths().backupDir, `corrupt-${Date.now()}.json`));
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** 原子写入：先写 .tmp 再 rename，避免写一半断电导致数据全毁 */
function writeDB(db) {
  const { dbFile, dataDir } = paths();
  const payload = JSON.stringify(db, null, 2);
  const tmp = path.join(dataDir, `.socialdesk.${process.pid}.tmp`);
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, dbFile);
  return { bytes: Buffer.byteLength(payload, 'utf8'), path: dbFile };
}

function snapshot(reason = 'manual') {
  try {
    const { dbFile, backupDir } = paths();
    if (!fs.existsSync(dbFile)) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(backupDir, `backup-${stamp}-${reason}.json`);
    fs.copyFileSync(dbFile, dest);
    pruneBackups();
    return dest;
  } catch (e) {
    log.warn('生成备份失败', { error: String(e && e.message) });
    return null;
  }
}

function pruneBackups() {
  const { backupDir } = paths();
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(backupDir, f));
    } catch {
      /* ignore */
    }
  }
}

function listBackups() {
  const { backupDir } = paths();
  try {
    return fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const st = fs.statSync(path.join(backupDir, f));
        return { name: f, path: path.join(backupDir, f), bytes: st.size, at: st.mtime.toISOString() };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

/* ------------------------- 引擎配置 ------------------------- */

const DEFAULT_ENGINE = {
  enabled: true,
  intervalSec: 20,
  launchAtLogin: false,
  minimizeToTray: false,
  notifyOnPublish: true,
  keepRunningInTray: true,
  lastTickAt: null,
  lastPublishAt: null,
  publishedCount: 0,
  failedCount: 0,
};

function readEngine() {
  try {
    const raw = fs.readFileSync(paths().engineFile, 'utf8');
    return { ...DEFAULT_ENGINE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ENGINE };
  }
}

function writeEngine(cfg) {
  try {
    fs.writeFileSync(paths().engineFile, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    log.warn('引擎配置写入失败', { error: String(e && e.message) });
  }
  return cfg;
}

module.exports = {
  DB_VERSION,
  emptyDB,
  normalize,
  readDB,
  writeDB,
  snapshot,
  listBackups,
  readEngine,
  writeEngine,
  DEFAULT_ENGINE,
};
