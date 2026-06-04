#!/usr/bin/env node
// lrnev CLI 入口
// 用户运行 `lrnev <子命令>` 时实际执行的脚本。
// 由 package.json 的 bin.lrnev 字段映射到全局命令。

import { runCli } from '../dist/cli/index.js';

runCli(process.argv);
