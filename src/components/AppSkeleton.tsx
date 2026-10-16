import { Skeleton } from './ui';

/**
 * 启动骨架屏
 * 打开软件时先铺出界面轮廓（侧边栏 + 顶栏 + 内容卡片），
 * 数据读完再自然替换。避免"白屏一闪 / 转圈发呆"的草台感。
 */
export function AppSkeleton({ note }: { note?: string }) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      {/* 侧边栏 */}
      <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Skeleton w={36} h={36} r="var(--sd-r-md)" />
          <div className="flex-1 space-y-1.5">
            <Skeleton w={86} h={12} />
            <Skeleton w={58} h={10} />
          </div>
        </div>
        <div className="space-y-1.5 px-3 pt-1">
          {[38, 38, 38, 38, 38].map((h, i) => (
            <Skeleton key={i} h={h} r="var(--sd-r-sm)" />
          ))}
        </div>
        <div className="mt-3 space-y-1.5 px-3">
          {[30, 30, 30].map((h, i) => (
            <Skeleton key={i} h={h} r="var(--sd-r-sm)" />
          ))}
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
          <Skeleton w={72} h={16} />
          <div className="ml-auto flex items-center gap-2.5">
            <Skeleton w={200} h={40} r="var(--sd-r-md)" />
            <Skeleton w={64} h={40} r="var(--sd-r-md)" />
            <Skeleton w={40} h={40} r="var(--sd-r-md)" />
            <Skeleton w={104} h={40} r="var(--sd-r-md)" />
          </div>
        </div>

        <div className="flex-1 space-y-5 p-5">
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={96} className="flex-1" r="var(--sd-r-card)" />
            ))}
          </div>
          <div className="flex gap-4">
            <Skeleton h={300} className="flex-[2]" r="var(--sd-r-card)" />
            <Skeleton h={300} className="flex-1" r="var(--sd-r-card)" />
          </div>
        </div>
      </div>

      {note ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel px-3.5 py-1.5 text-[12px] text-faint shadow-lg">
          {note}
        </div>
      ) : null}
    </div>
  );
}
