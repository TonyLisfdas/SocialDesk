import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider, useStore } from './lib/store';
import bridge from './lib/bridge';
import { AppSkeleton } from './components/AppSkeleton';
import './index.css';

/**
 * 启动闸门
 * 浏览器版可以同步读 localStorage，直接渲染；独立版要等主进程把
 * 磁盘上的数据库读回来，所以先铺一层骨架屏，读完再挂 App。
 */
function Gate() {
  const { ready } = useStore();
  if (!ready) {
    return <AppSkeleton note={`正在载入本地数据…（${bridge.isDesktop ? '磁盘文件' : '浏览器存储'}）`} />;
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
