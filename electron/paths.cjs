'use strict';
/**
 * 统一管理独立版的所有磁盘路径。
 * 所有用户数据都放在  <userData>/data/  下面：
 *   socialdesk.json   主数据库（全部内容、账号、设置）
 *   engine.json       后台引擎配置（开关、间隔、开机自启）
 *   media/            素材原件（图片/视频）
 *   backups/          自动滚动备份
 *   logs/publish.log  发布日志
 */
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

let cache = null;

function paths() {
  if (cache) return cache;
  const root = app.getPath('userData');
  const dataDir = path.join(root, 'data');
  const mediaDir = path.join(dataDir, 'media');
  const backupDir = path.join(dataDir, 'backups');
  const logDir = path.join(dataDir, 'logs');
  for (const d of [dataDir, mediaDir, backupDir, logDir]) {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  cache = {
    root,
    dataDir,
    mediaDir,
    backupDir,
    logDir,
    dbFile: path.join(dataDir, 'socialdesk.json'),
    engineFile: path.join(dataDir, 'engine.json'),
    logFile: path.join(logDir, 'publish.log'),
  };
  return cache;
}

module.exports = { paths };
