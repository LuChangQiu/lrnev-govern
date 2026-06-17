---
number: '0001'
title: '用 understand-anything 知识图谱 + GitHub Pages 子域名做"给人看的项目理解入口"'
status: proposed
scope: global
created: '2026-06-17'
date: '2026-06-17'
---

# 0001. 用 understand-anything 知识图谱 + GitHub Pages 子域名做"给人看的项目理解入口"

## 状态

proposed

## 背景

lrnev 自带的 specs（requirements 讲 WHY、design 讲 HOW）+ `lrnev map` 是 AI/治理视角的理解入口，且文件即真相、零漂移。但缺一个"给人直观看代码结构"的可视化大屏，新贡献者上手成本高。用户的域名是 lrnev.cn（走 Cloudflare）。已装 understand-anything（codex 版，安装在 C:/Users/xiqi/.understand-anything/repo）。

## 决策

用 understand-anything 生成 lrnev 代码库的知识图谱（codex 跑 /understand --language zh），把它的 React/Vite dashboard 构建成纯静态站，部署到 GitHub Pages 的 gh-pages 分支，绑定自定义子域名 graph.lrnev.cn。访问 https://graph.lrnev.cn/ 即可看交互式知识图谱（299 节点/881 边，commit 6579f47 快照）。

## 备选方案

- 把生成产物直接提交进 main 仓库让 clone 即看：拒绝，会污染真相目录、12MB 噪音、且会过期误导人，与零模型/文件即真相定位冲突
- 用主域名 lrnev.cn 直接放图谱：拒绝，挤占未来产品首页位置
- 开 Cloudflare 橙色代理走 CDN：拒绝（现阶段），SSL 双层易出死循环，GitHub Pages 已够用
- 不做可视化、只让贡献者读 specs+codegraph：可行但缺给非技术/新人的直观入口，图谱是补充而非替代

## 后果

取舍：①产物不进 main 主干——`.understand-anything/`（生成数据，12MB 含中间产物）和构建出的 dist 都不提交进 main，已加入 .gitignore；dist 只活在 gh-pages 分支。保持"文件即真相"的主干干净。②图谱是某一刻快照、非实时——改 lrnev 代码后图谱会漂移，需手动重跑 understand-anything + 重新构建部署（详细流程见 memory）。③Cloudflare DNS 用"仅 DNS"（灰色云朵）不开橙色代理——GitHub Pages 已自带 HTTPS+CDN，叠 Cloudflare 代理需把 SSL 模式设 Full 否则会重定向死循环，收益小不值当。④子域名而非主域名——graph.lrnev.cn 专放图谱，主域名 lrnev.cn 留给未来产品首页/文档。风险：图谱漂移是主要长期负担，依赖发版纪律去重建。

## 参考

- 待补充
