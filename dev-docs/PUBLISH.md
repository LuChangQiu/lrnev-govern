# 发布到 npm

## 前置检查

```bash
cd product/lrnev-govern

# 确认 package.json name 是 "lrnev"（不是 lrnev-govern）
grep '"name"' package.json   # 应输出 "name": "lrnev"

# 确认测试全绿
npm test

# 确认能构建
npm run build
```

## 首次发布

```bash
# 1. 登录 npm（需要 npm 账号，首次会提示输入用户名/密码/邮箱）
npm login

# 2. 发布（prepublishOnly 钩子会自动 clean + build + test）
npm publish

# 3. 验证安装
npm install -g lrnev
lrnev --version
lrnev-mcp --version  # MCP 服务入口
```

## 更新版本并发布

```bash
# 1. 改版本号
npm version patch   # 0.1.0 → 0.1.1（bug 修复）
npm version minor   # 0.1.0 → 0.2.0（新功能）
npm version major   # 0.1.0 → 1.0.0（breaking changes）

# 2. 更新 CHANGELOG.md

# 3. 推送 tag + 发布
git push --tags
npm publish
```

## package.json 发布相关字段

```json
{
  "name": "lrnev",           // npm install -g lrnev
  "version": "1.3.1",
  "bin": {
    "lrnev": "./bin/lrnev.mjs",       // → 全局命令 lrnev
    "lrnev-mcp": "./bin/lrnev-mcp.mjs" // → 全局命令 lrnev-mcp
  },
  "files": ["bin", "dist", "templates", "README.md", "LICENSE", "CHANGELOG.md"],
  "publishConfig": { "access": "public" },
  "prepublishOnly": "npm run clean && npm run build && npm test"
}
```

## 本地测试发布(不真正上传)

```bash
# 打包看会包含哪些文件
npm pack --dry-run

# 本地安装测试
npm pack                  # 生成 lrnev-x.x.x.tgz
npm install -g ./lrnev-1.3.1.tgz
lrnev --version
```
