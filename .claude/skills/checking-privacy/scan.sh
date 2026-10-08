#!/usr/bin/env bash
# 개인정보 스캔. 검색어는 private/privacy-terms.txt(git 제외, 한 줄에 하나, # 주석)에서 읽는다.
# 출력에는 검색어 대신 번호만 찍는다(로그·대화에 원문이 남지 않게).
# 사용: bash .claude/skills/checking-privacy/scan.sh [--staged | --tracked | --log <range> | --dist]
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
TERMS=private/privacy-terms.txt
mode=${1:---staged}
fail=0

if [[ ! -s $TERMS ]]; then
  echo "ERROR: $TERMS 가 없거나 비어 있음. 주소·단지명·매물 URL·평면도 파일명 등을 한 줄에 하나씩 적어 두세요." >&2
  exit 2
fi
terms=$(grep -v '^[[:space:]]*#' "$TERMS" | sed '/^[[:space:]]*$/d')

# 일치한 줄에서 몇 번째 검색어인지 번호만 보고한다
report() { # $1=위치 라벨, $body=본문
  local label=$1 i=0 t hits
  while IFS= read -r t; do
    i=$((i+1))
    hits=$(grep -n -F -- "$t" <<<"$body" | cut -d: -f1 | paste -sd, -)
    [[ -n $hits ]] && { echo "HIT term#$i  $label  lines:$hits"; fail=1; }
  done <<<"$terms"
}

case $mode in
  --staged)
    bad=$(git diff --cached --name-only | grep -E '^(private|handoff|archive|\.superpowers|dist|test-results|playwright-report)/|^Planner 5D ' || true)
    [[ -n $bad ]] && { echo "FORBIDDEN staged path:"; echo "$bad"; fail=1; }
    imgs=$(git diff --cached --name-only --diff-filter=A | grep -Ei '\.(jpe?g|png|webp|heic|pdf)$' || true)
    [[ -n $imgs ]] && { echo "REVIEW new binary (평면도·사진 아닌지 확인):"; echo "$imgs"; }
    while IFS= read -r f; do
      [[ -z $f ]] && continue
      body=$(git show ":$f" 2>/dev/null) || continue
      report "$f"
    done < <(git diff --cached --name-only --diff-filter=ACMR)
    ;;
  --tracked)
    while IFS= read -r f; do
      body=$(cat -- "$f" 2>/dev/null) || continue
      report "$f"
    done < <(git ls-files)
    ;;
  --log)
    range=${2:?--log 에는 범위가 필요 (예: main..HEAD 또는 --all)}
    body=$(git log --format='%H %B' $range); report "commit messages ($range)"
    body=$(git log -p --format= $range); report "commit diffs ($range)"
    ;;
  --dist)
    [[ -d dist ]] || { echo "dist/ 없음. npm run build 먼저." >&2; exit 2; }
    while IFS= read -r f; do
      body=$(LC_ALL=C cat -- "$f"); report "$f"
    done < <(find dist -type f)
    ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

[[ $fail -eq 0 ]] && echo "OK: privacy scan clean ($mode)"
exit $fail
