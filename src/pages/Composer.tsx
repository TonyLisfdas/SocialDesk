import { PostEditor } from '../components/PostEditor';
import type { Post } from '../types';

export interface ComposerSeed {
  mediaIds?: string[];
  scheduledAt?: string;
  platforms?: string[];
}

export function Composer({
  post,
  seed,
}: {
  post: Post | null;
  seed?: ComposerSeed;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PostEditor post={post} seed={seed} />
    </div>
  );
}
