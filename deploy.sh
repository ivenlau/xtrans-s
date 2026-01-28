#!/bin/bash

# 构建项目
npm run build

# 切换到 dist 目录
cd dist

# 初始化 git
git init
git add -A
git commit -m "Deploy to GitHub Pages"

# 推送到 gh-pages 分支
git push -f https://github.com/ivenlau/xtrans-s.git main:gh-pages

# 返回上级目录并删除 dist
cd ..
rm -rf dist
