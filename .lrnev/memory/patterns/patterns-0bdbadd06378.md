---
id: patterns-0bdbadd06378
category: patterns
scope: global
source: 2026-06-17 与用户一起完成 graph.lrnev.cn 首次部署的实操
created: '2026-06-17T10:58:59.152Z'
reference_count: 0
---

【知识图谱站 graph.lrnev.cn 增补/重建完整流程】lrnev 改代码后图谱会过期，按此重建（未来 AI 照做）：

前置路径：
- 工具安装目录 DASH=C:/Users/xiqi/.understand-anything/repo/understand-anything-plugin/packages/dashboard
- core dist 须已 build（DASH/../core/dist/{schema,search,types}.js 存在；通常已在）
- 图谱产物目录 GRAPH=E:/project/.lrnev/lrnev-cli/product/lrnev-govern/.understand-anything
- 隔离构建/部署目录 OUT=E:/project/.lrnev/lrnev-cli/.tmp/ua-pages-build

步骤：
1. 重新生成图谱：用户在 codex 对 product/lrnev-govern 跑 /understand --language zh（这步只有用户能做，花 token）。完成后 GRAPH/knowledge-graph.json 等更新，meta.json 的 gitCommitHash 是新快照。
2. 拷数据进 dashboard public：cp GRAPH/{knowledge-graph.json,meta.json,config.json} 到 DASH/public/（会临时覆盖工具自带的示例 knowledge-graph.json，构建后要还原）。
3. 写临时构建配置 DASH/vite.config.lrnev.ts：base="/"（子域名根）；define 注入 import.meta.env.VITE_DEMO_MODE="true"、VITE_GRAPH_URL/VITE_META_URL/VITE_CONFIG_URL="/xxx.json"；resolve.alias 把 @understand-anything/core/{schema,search,types} 指向 ../core/dist/*.js；build.rollupOptions.output.manualChunks 必须照搬 vite.config.demo.ts 里那段（react-vendor/xyflow/graph-layout/markdown 分块）——少了它会因单个超大 bundle 触发 vite build-import-analysis 的 "Parse error @:1:1" 构建失败。
4. 构建：cd DASH && ./node_modules/.bin/vite build --config vite.config.lrnev.ts（不要 tsc -b，直接 vite build 避开类型噪音）。
5. 刷新 OUT：rm -rf OUT;mkdir -p OUT;cp -r DASH/dist/. OUT/;touch OUT/.nojekyll;echo "graph.lrnev.cn">OUT/CNAME。
6. 还原工具目录（别留脏）：rm DASH/public/{meta,config}.json、rm DASH/vite.config.lrnev.ts、rm -rf DASH/dist；在 C:/Users/xiqi/.understand-anything/repo 跑 git checkout -- 那个 public/knowledge-graph.json 恢复示例图。
7. 推 gh-pages（用一次性临时 git 仓库，绝不碰 lrnev 主仓库 git）：cd OUT && rm -rf .git && git init -q && git checkout -b gh-pages && git add -A && git -c user.name=LuChangQiu -c user.email=luchangqiu@users.noreply.github.com commit -m "..." && git push --force https://github.com/LuChangQiu/lrnev-govern.git gh-pages（凭证：printf protocol/host | git credential fill 取，已存在 username=LuChangQiu）。
8. 验证：curl -I https://graph.lrnev.cn/ 应 200 Server:GitHub.com；curl 取 /knowledge-graph.json 校验 nodes/edges/project=lrnev；GitHub 仓库 Deployments 出新 github-pages 记录即成。

关键事实/坑：
- dashboard 是 React+Vite，demo 模式（VITE_DEMO_MODE=true）下 App.tsx 的 dataUrl() 回退路径写死 /${fileName} 且不带 BASE_URL → 子路径 Pages 会 404；用子域名 base="/" 天然规避，这是选 graph.lrnev.cn 子域名而非 user.github.io/lrnev-govern 子路径的原因之一。
- Pages 首次开启在网页点（Settings→Pages，Source=Deploy from a branch，Branch=gh-pages /root，Custom domain=graph.lrnev.cn，等证书后勾 Enforce HTTPS）；用 GitHub API 开会 401（git push 凭证 scope 不含 pages/administration）。重建只是更新内容、推 gh-pages 即可，Pages 设置不用重开。
- Cloudflare DNS：CNAME graph→luchangqiu.github.io，必须"仅 DNS"（灰云），不要开橙色代理。
- .understand-anything/ 和 .codegraph/ 已在 product/lrnev-govern/.gitignore 忽略，别提交进 main。
