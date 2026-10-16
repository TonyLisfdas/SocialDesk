'use strict';
/**
 * 后台定时发布引擎 —— 独立版相对浏览器版最大的增量。
 *
 * 浏览器标签页一关就什么都没了，所以浏览器版只能「手动点发布」。
 * 独立版是常驻进程，于是可以：
 *   · 每 N 秒扫一次队列，到点自动发
 *   · 关机期间错过的排期，下次启动自动补发（catch-up）
 *   · 失败自动重试（可配次数与间隔）
 *   · 发布结果和日志落盘，随时可查
 */
const { readDB, writeDB, readEngine, writeEngine } = require('./db.cjs');
const { publishPost, applyResults } = require('./publisher.cjs');
const { log } = require('./logger.cjs');

const MAX_RETRY = 2;

let timer = null;
let ticking = false;
let cfg = null;
let sink = null; // 事件回调：推给渲染进程 / 通知

const state = {
  running: false,
  lastTickAt: null,
  lastPublishAt: null,
  published: 0,
  failed: 0,
  nextRunAt: null,
  inFlight: new Set(),
  recent: [], // 最近若干次发布结果，给界面显示
};

function setSink(fn) {
  sink = fn;
}

function emit(type, payload) {
  try {
    if (sink) sink({ type, at: new Date().toISOString(), payload });
  } catch {
    /* ignore */
  }
}

function status() {
  return {
    running: state.running,
    lastTickAt: state.lastTickAt,
    lastPublishAt: state.lastPublishAt,
    published: state.published,
    failed: state.failed,
    nextRunAt: state.nextRunAt,
    inFlight: [...state.inFlight],
    recent: state.recent.slice(-20),
    config: cfg,
  };
}

function configure(patch = {}) {
  cfg = writeEngine({ ...(cfg || readEngine()), ...patch });
  if (state.running) {
    // 改间隔 / 开关后重启计时器，并立刻刷新「下次检查」时间
    stop();
    start();
  }
  emit('engine:config', cfg);
  return cfg;
}

/** 找出所有到点该发的排期内容（含关机期间错过的） */
function duePosts(db, now) {
  return (db.posts || []).filter((p) => {
    if (p.status !== 'scheduled') return false;
    if (!p.scheduledAt) return false;
    if (state.inFlight.has(p.id)) return false;
    return new Date(p.scheduledAt).getTime() <= now;
  });
}

async function runDue(reason = 'tick') {
  if (ticking) return;
  ticking = true;
  state.lastTickAt = new Date().toISOString();

  try {
    const db = readDB();
    if (!db) return;

    const now = Date.now();
    const due = duePosts(db, now);
    if (!due.length) return;

    log.info(`发现 ${due.length} 条到点内容（${reason}）`, { ids: due.map((p) => p.id) });

    let next = db;
    let changed = false;

    for (const post of due) {
      state.inFlight.add(post.id);
      emit('publish:start', { postId: post.id, platforms: post.platforms });
      try {
        const retries = Number(post.retries || 0);
        const { results, anyOk, summary } = await publishPost(next, post);
        let updated = applyResults(post, results);

        // 全失败且还没超过重试上限 → 留回队列里，下个 tick 再试
        if (!anyOk && retries < MAX_RETRY) {
          updated = { ...updated, status: 'scheduled', retries: retries + 1 };
          log.warn(`全部失败，${retries + 1}/${MAX_RETRY} 次重试已排入`, { postId: post.id });
        }

        next = { ...next, posts: next.posts.map((p) => (p.id === post.id ? updated : p)) };
        changed = true;

        if (anyOk) {
          state.published += 1;
          state.lastPublishAt = new Date().toISOString();
        } else if (updated.status === 'failed') {
          state.failed += 1;
        }

        const record = {
          postId: post.id,
          summary,
          at: new Date().toISOString(),
          results,
          ok: anyOk,
        };
        state.recent.push(record);
        if (state.recent.length > 100) state.recent.shift();
        emit('publish:done', record);
      } catch (e) {
        log.error('调度发布异常', { postId: post.id, error: String(e && e.message) });
        emit('publish:error', { postId: post.id, error: String((e && e.message) || e) });
      } finally {
        state.inFlight.delete(post.id);
      }
    }

    if (changed) {
      writeDB(next);
      emit('db:changed', { source: 'scheduler' });
    }
  } finally {
    ticking = false;
    state.nextRunAt = new Date(Date.now() + (cfg?.intervalSec || 20) * 1000).toISOString();
  }
}

function start() {
  cfg = cfg || readEngine();
  if (timer) clearInterval(timer);
  const ms = Math.max(5, Number(cfg.intervalSec) || 20) * 1000;
  timer = setInterval(() => {
    if (cfg.enabled) runDue('tick');
  }, ms);
  state.running = true;
  state.nextRunAt = new Date(Date.now() + ms).toISOString();
  log.info('发布引擎已启动', { intervalSec: cfg.intervalSec, enabled: cfg.enabled });
  emit('engine:status', status());

  // 启动后延迟 3 秒做一次「补发」，把关机期间错过的排期发出去
  setTimeout(() => {
    if (cfg.enabled) runDue('catch-up');
  }, 3000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  state.running = false;
  log.info('发布引擎已停止');
  emit('engine:status', status());
}

/** 手动触发一次扫描（界面点「立即检查」） */
async function tickNow() {
  await runDue('manual');
  return status();
}

module.exports = { start, stop, status, configure, tickNow, runDue, setSink, state };
