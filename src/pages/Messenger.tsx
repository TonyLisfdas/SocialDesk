import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, PanelLeft, Smartphone,
  Download, Info, ShieldCheck,
} from 'lucide-react';
import { useStore } from '../lib/store';
import bridge, { type MessengerState } from '../lib/bridge';
import { SERVICES, SERVICE_MAP } from '../messenger/services';
import { Button, IconButton, Card } from '../components/ui';
import { cn } from '../lib/utils';

/**
 * 消息聚合
 * ------------------------------------------------------------------
 * 把 WhatsApp / Telegram / Messenger / Instagram / Discord / Slack / LINE
 * 的网页版并排放在一起管理，不用来回切浏览器标签。
 *
 * · 桌面版：用原生视图（Electron WebContentsView）嵌入，登录态持久保存
 * · 网页版：退回 iframe；被对方网站拦住的，给「新标签页打开」兜底
 *
 * 全程零 API —— 登录的是你自己的账号，消息走官方网页。
 */
export function MessengerPage() {
  const { i18n, pushToast } = useStore();
  const t = i18n.t;

  const [active, setActive] = useState<string>('whatsapp');
  const [railOpen, setRailOpen] = useState(true);
  const [state, setState] = useState<MessengerState | null>(null);
  const [mounted, setMounted] = useState<string[]>([]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const native = bridge.hasNativeGuest;
  const service = SERVICE_MAP[active];

  /* ---------- 桌面版：把原生视图贴到内容区 ---------- */
  const syncBounds = useCallback(() => {
    const el = stageRef.current;
    if (!el || !native) return;
    const r = el.getBoundingClientRect();
    void bridge.messenger.setBounds({
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  }, [native]);

  useEffect(() => {
    if (!native) return;
    // 切服务 / 窗口尺寸变化，都要把原生视图重新贴齐
    void bridge.messenger
      .mount(active, service.url)
      .then((s) => {
        if (s) setState(s);
        setMounted((m) => (m.includes(active) ? m : [...m, active]));
      })
      .catch(() => pushToast('嵌入失败，建议用「在浏览器打开」', 'warn'));
    const raf = requestAnimationFrame(syncBounds);
    const ro = new ResizeObserver(syncBounds);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', syncBounds);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', syncBounds);
      void bridge.messenger.unmount();
    };
  }, [active, native, service.url, syncBounds, pushToast]);

  /* ---------- 订阅原生事件（标题/加载中/前进后退可用性） ---------- */
  useEffect(() => {
    if (!native) return;
    void bridge.messenger.state().then((s) => s && setState(s));
    const off = bridge.messenger.onState((s) => setState(s));
    return off;
  }, [native]);

  /* ---------- 离开本页时一定要摘掉原生视图，否则会浮在别的页面上 ---------- */
  useEffect(() => {
    return () => {
      if (native) void bridge.messenger.unmount();
    };
  }, [native]);

  const openExternal = () => {
    void bridge.openExternal(service.url);
    pushToast(`${t('msg.openedExternal')} · ${i18n.lang === 'zh' ? service.nameZh : service.nameEn}`);
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ---------------- 左侧服务栏 ---------------- */}
      <div className={cn('flex shrink-0 flex-col gap-2', railOpen ? 'w-[188px]' : 'w-[58px]')}>
        <div className="flex items-center gap-1.5">
          <IconButton
            label={t('msg.toggleRail')}
            size="md"
            onClick={() => setRailOpen((v) => !v)}
          >
            <PanelLeft size={16} />
          </IconButton>
          {railOpen ? (
            <span className="label truncate px-1">{t('msg.services')}</span>
          ) : null}
        </div>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
          {SERVICES.map((s) => {
            const on = s.id === active;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'hit group flex min-h-[44px] items-center gap-2.5 rounded-[var(--sd-r-sm)] px-2.5 text-left transition-colors',
                  on
                    ? 'bg-[color-mix(in_srgb,var(--sd-brand)_14%,transparent)] text-fg'
                    : 'text-muted hover:bg-raise hover:text-fg',
                )}
                title={s.nameZh}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--sd-r-xs)] text-[11px] font-bold text-white shadow-sm"
                  style={{ background: s.color }}
                >
                  {s.glyph}
                </span>
                {railOpen ? (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {i18n.lang === 'zh' ? s.nameZh : s.nameEn}
                  </span>
                ) : null}
                {railOpen && mounted.includes(s.id) ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" title={t('msg.loaded')} />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* LINE 客户端兜底 */}
        <Card className="p-2.5">
          <div className="mb-2 flex items-start gap-1.5 text-[11px] leading-snug text-faint">
            <Smartphone size={12} className="mt-[1px] shrink-0" />
            <span>{railOpen ? t('msg.lineFallback') : t('msg.line')}</span>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              const url = SERVICE_MAP.line.clientUrl ?? 'line://';
              void bridge.openExternal(url);
              pushToast(t('msg.clientLaunching'));
            }}
          >
            <Download size={13} />
            {railOpen ? t('msg.openClient') : 'LINE'}
          </Button>
        </Card>
      </div>

      {/* ---------------- 内容区 ---------------- */}
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* 工具条 */}
        <div className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line px-3">
          <IconButton label={t('msg.back')} disabled={!state?.canGoBack} onClick={() => void bridge.messenger.goBack()}>
            <ArrowLeft size={16} />
          </IconButton>
          <IconButton
            label={t('msg.forward')}
            disabled={!state?.canGoForward}
            onClick={() => void bridge.messenger.goForward()}
          >
            <ArrowRight size={16} />
          </IconButton>
          <IconButton label={t('msg.reload')} onClick={() => void bridge.messenger.reload()}>
            <RotateCw size={16} className={cn(state?.loading && 'animate-spin')} />
          </IconButton>
          <IconButton label={t('msg.home')} onClick={() => void bridge.messenger.home(service.url)}>
            <Home size={16} />
          </IconButton>

          <div className="mx-2 min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">
              {i18n.lang === 'zh' ? service.nameZh : service.nameEn}
            </div>
            <div className="truncate text-[11px] text-faint">
              {state?.loading ? t('msg.loading') : state?.title || service.url}
            </div>
          </div>

          <Button size="sm" variant="ghost" onClick={openExternal}>
            <ExternalLink size={13} />
            {t('msg.openExternal')}
          </Button>
        </div>

        {/* 嵌入区 */}
        <div className="relative min-h-0 flex-1 bg-bg">
          {/* 原生视图会盖在这个占位区上；网页版则渲染下面的 iframe */}
          <div ref={stageRef} className="absolute inset-0">
            {!native ? (
              <div className="flex h-full flex-col">
                <div className="flex items-start gap-2 border-b border-line bg-raise/60 px-4 py-2.5 text-[12px] text-muted">
                  <Info size={13} className="mt-[2px] shrink-0 text-warn" />
                  <span>{t('msg.browserHint')}</span>
                </div>
                <iframe
                  key={active}
                  src={service.url}
                  title={service.nameZh}
                  className="min-h-0 flex-1 border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
          </div>

          {/* 桌面版首次进入的说明层：原生视图未加载时可见 */}
          {native && !mounted.includes(active) ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] text-faint">
              {t('msg.connecting')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function MessengerFooter() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-faint">
      <ShieldCheck size={12} className="text-ok" />
      不上传任何数据
    </div>
  );
}
