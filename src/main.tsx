import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider, useStore } from './lib/store';
import bridge from './lib/bridge';
import './index.css';

/**
 * 启动闸门
 * 浏览器版可以同步读 localStorage，直接渲染；独立版要等主进程把
 * 磁盘上的数据库读回来，所以先显示一个启动界面，读完再挂 App。
 */
function Gate() {
  const { ready } = useStore();
  if (!ready) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg text-muted">
        <div className="brand-grad flex h-12 w-12 animate-pulse items-center justify-center rounded-[14px] text-[15px] font-black text-white">
          SD
        </div>
        <div className="text-[13px]">
          正在读取本地数据…{bridge.isDesktop ? '（磁盘文件）' : '（浏览器存储）'}
        </div>
      </div>
    );
  }
  return <App />;
}

const el = document.getElementById('root');
if (el) {
  el.innerHTML = '';
  createRoot(el).render(
    <StrictMode>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </StrictMode>,
  );
}
