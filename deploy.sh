#!/bin/bash
# Publishes this folder to GitHub Pages: https://<you>.github.io/koshvia/
set -e
cd "$(dirname "$0")"
if ! command -v gh >/dev/null; then
  if command -v brew >/dev/null; then brew install gh; else echo "Install the GitHub CLI from https://cli.github.com, then run this again."; exit 1; fi
fi
gh auth status >/dev/null 2>&1 || gh auth login -h github.com -p https -w
GH_USER=$(gh api user -q .login)
[ -d .git ] || git init -q -b main
git config user.name >/dev/null || git config user.name "$GH_USER"
git config user.email >/dev/null || git config user.email "$GH_USER@users.noreply.github.com"
git add -A
git commit -q -m "Koshvia web app" 2>/dev/null || true
gh repo view "$GH_USER/koshvia" >/dev/null 2>&1 || gh repo create koshvia --public --description "Koshvia web app (code only, no user data)"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/koshvia.git"
git push -u origin main
gh api -X POST "repos/$GH_USER/koshvia/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || echo "(Pages may already be enabled)"
gh api -X PUT "repos/$GH_USER/koshvia/pages" -f "cname=koshvia.vyuhika.com" >/dev/null 2>&1 || true
echo
echo "Done. Once your GoDaddy CNAME exists, the app is at: https://koshvia.vyuhika.com"
echo "(Meanwhile: https://$GH_USER.github.io/koshvia/ may redirect there.)"
