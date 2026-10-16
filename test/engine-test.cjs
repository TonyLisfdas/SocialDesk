'use strict';
/**
 * 引擎端到端测试（开发用，不参与打包）
 * 验证：排期到点 → 后台引擎自动触发 → 适配器发出真实 HTTP 请求 → 结果写回数据库
 * 用法： xvfb-run electron test/engine-test.cjs
 */
const http = require('node:http');
const { app } = require('electron');

const db = require('../electron/db.cjs');
const sched = require('../electron/scheduler.cjs');

const PORT = 5999;
const received = [];

function startMockRelay() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = { __raw: body };
        }
        received.push({ url: req.url, method: req.method, auth: req.headers.authorization, body: parsed });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: 'mock-post-1' }));
      });
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

function makeDB() {
  const base = db.emptyDB();
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  return {
    ...base,
    accounts: [
      {
        id: 'acc_x_1',
        platformId: 'x',
        handle: '@socialdesk_test',
        displayName: 'Test',
        connected: true,
        mode: 'api',
        followers: 0,
        credential: `http://127.0.0.1:${PORT}/publish|secret-token`,
      },
      {
        // 没有凭证的平台，用于验证「未连接 → 失败」这条分支
        id: 'acc_tg_1',
        platformId: 'telegram',
        handle: '@nobot',
        displayName: 'No cred',
        connected: false,
        mode: 'api',
        followers: 0,
      },
    ],
    posts: [
      {
        id: 'post_due_1',
        content: '这是一条到点该自动发出的测试内容',
        platforms: ['x', 'telegram', 'wechat_mp'],
        status: 'scheduled',
        scheduledAt: past,
        mediaIds: [],
        hashtags: ['自动发布', '独立版'],
        firstComment: '',
        createdAt: past,
        updatedAt: past,
      },
      {
        id: 'post_future_1',
        content: '这条还没到点，不应该被发出去',
        platforms: ['x'],
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        mediaIds: [],
        hashtags: [],
        createdAt: past,
        updatedAt: past,
      },
    ],
  };
}

app.whenReady().then(async () => {
  const out = [];
  const say = (s) => {
    out.push(s);
    console.log(s);
  };
  let failures = 0;
  const check = (name, cond, extra = '') => {
    say(`${cond ? '  ✅' : '  ❌'} ${name}${extra ? '  ' + extra : ''}`);
    if (!cond) failures += 1;
  };

  const srv = await startMockRelay();
  say('— 端到端测试开始 —');

  db.writeDB(makeDB());
  sched.configure({ enabled: true, intervalSec: 5 });
  sched.start(); // 模拟真实启动路径：计时器先跑起来，再等它自己触发
  await sched.runDue('test-run');

  const after = db.readDB();
  const due = after.posts.find((p) => p.id === 'post_due_1');
  const future = after.posts.find((p) => p.id === 'post_future_1');

  say('\n1) 到点的内容');
  check('状态变为 published', due.status === 'published', `status=${due.status}`);
  check('记录了 publishedAt', !!due.publishedAt);
  check('X 平台发布成功', due.overrides?.x?.status === 'published', JSON.stringify(due.overrides?.x || {}));
  check('记录了外部 ID', due.overrides?.x?.externalId === 'mock-post-1', due.overrides?.x?.externalId || '');
  check('记录了通道名', due.overrides?.x?.channel === 'webhook', due.overrides?.x?.channel || '');
  check('Telegram 因无凭证标记失败', due.overrides?.telegram?.status === 'failed');
  check('公众号标记为人工发布（不算失败）', due.overrides?.wechat_mp?.status === 'scheduled');

  say('\n2) 没到点的内容');
  check('保持 scheduled 未被动到', future.status === 'scheduled', `status=${future.status}`);
  check('没有产生发布记录', !future.overrides || Object.keys(future.overrides).length === 0);

  say('\n3) 中转服务实际收到的东西');
  check('收到 1 次请求', received.length === 1, `count=${received.length}`);
  if (received.length) {
    const r = received[0];
    check('是 POST', r.method === 'POST');
    check('带上了 Bearer Token', r.auth === 'Bearer secret-token', r.auth || '');
    check('正文正确', r.body?.content?.includes('到点该自动发出'), r.body?.content || '');
    check('话题标签已并入正文', r.body?.content?.includes('#自动发布'), '');
    check('带上了 platform 字段', r.body?.platform === 'x', r.body?.platform || '');
  }

  say('\n4) 磁盘文件');
  const fs = require('node:fs');
  const { paths } = require('../electron/paths.cjs');
  check('主数据库已写入', fs.existsSync(paths().dbFile));
  check('发布日志已写入', fs.existsSync(paths().logFile) && fs.statSync(paths().logFile).size > 0);
  const size = fs.statSync(paths().dbFile).size;
  check('数据库文件非空', size > 500, `${size} bytes`);

  say('\n5) 引擎状态');
  const st = sched.status();
  check('引擎在运行', st.running === true);
  check('已发布计数 +1', st.published >= 1, `published=${st.published}`);
  check('有最近发布记录', st.recent.length >= 1);

  say(`\n— 结果：${failures === 0 ? '全部通过 ✅' : failures + ' 项失败 ❌'} —`);
  srv.close();
  app.exit(failures === 0 ? 0 : 1);
});
