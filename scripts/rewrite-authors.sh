#!/usr/bin/env bash
# ============================================================
# 一次性维护脚本：把仓库历史中所有提交的署名改写为 TonyLisfdas
# （提交内容、顺序、说明、日期全部保持不变，只换"落款"）
#
# 由 .github/workflows/authors-rewrite.yml 在 GitHub Actions 上运行，
# 点击 "Run workflow" 按钮即执行；不点则永远不执行。
#
# 特性：
#   - 自动跳过引入本工具自身的提交（改写后的新历史里不保留一次性工具）
#   - 幂等：重复运行结果完全一致（相同输入 → 相同提交编号）
# ============================================================
set -euo pipefail

NAME="TonyLisfdas"
EMAIL="125609993+TonyLisfdas@users.noreply.github.com"

git fetch origin main 2>/dev/null || true

echo "== 改写前 =="
git log --oneline --no-merges origin/main | head -25
echo

# 从旧到新列出 main 上所有非合并提交
mapfile -t commits < <(git rev-list --reverse --no-merges origin/main)

parent=""
skipped=0
rewritten=0
for c in "${commits[@]}"; do
  # 跳过引入本工具文件的提交（一次性工具不应进入"正史"）
  if git diff-tree --no-commit-id --name-only -r "$c" | grep -qE 'rewrite-authors|authors-rewrite'; then
    echo "跳过工具提交: $(git log -1 --format='%h %s' "$c")"
    skipped=$((skipped + 1))
    continue
  fi

  tree=$(git rev-parse "$c^{tree}")
  adate=$(git log -1 --format=%aI "$c")
  cdate=$(git log -1 --format=%cI "$c")

  msg_file=$(mktemp)
  # 原样保留提交说明的每一个字节（含空行与结尾换行）
  git cat-file commit "$c" | sed '1,/^$/d' > "$msg_file"

  export GIT_AUTHOR_NAME="$NAME"
  export GIT_AUTHOR_EMAIL="$EMAIL"
  export GIT_AUTHOR_DATE="$adate"
  export GIT_COMMITTER_NAME="$NAME"
  export GIT_COMMITTER_EMAIL="$EMAIL"
  export GIT_COMMITTER_DATE="$cdate"

  if [ -z "$parent" ]; then
    parent=$(git commit-tree "$tree" -F "$msg_file")
  else
    parent=$(git commit-tree "$tree" -p "$parent" -F "$msg_file")
  fi
  rm -f "$msg_file"
  rewritten=$((rewritten + 1))
done

echo
echo "== 改写完成 =="
echo "跳过工具提交: $skipped 条；改写: $rewritten 条"
echo "新历史顶端: $parent"
echo
echo "== 改写后 =="
git log --oneline "$parent" | head -25
echo
echo "新提交作者:"
git log --format='%an <%ae>' "$parent" | sort | uniq -c

# 替换 main 与本会话工作分支（内容一个字节不变，只换历史署名）
git push --force origin "$parent:main"
git push --force origin "$parent:refs/heads/arena/8fbb541c-socialdesk"

echo
echo "✅ 完成：main 与工作分支已更新为署名后的新历史。"
