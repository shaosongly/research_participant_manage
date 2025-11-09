# Repository Guidelines（仓库指南）

## 项目结构与模块组织
本项目是静态的 Vue 3 仪表盘。根目录 `landing.html` 为营销入口，业务页面集中在 `html/`（如 `project_manage.html`、`visit_plan.html`）。页面控制器按视图放在 `js/page/`，共享数据工具（例如 `SubjectOperations`）位于 `js/common/`。样式按页面分散在 `css/`，新增公共变量请先放入 `css/index.css`。新增资源应与所属页面放在一起，并优先复用公共助手以避免重复逻辑。

## 构建、测试与开发命令
- `npx http-server . -c-1` - 在仓库根目录快速预览，禁用缓存便于调试 UI。
- `npx prettier "js/**/*.js" "css/**/*.css" --check` - PR 前执行一致性检查；添加 `--write` 可自动修复。
栈依赖 CDN，除非引入新工具链，否则无需 `npm install`。

## 代码风格与命名约定
使用 4 空格缩进，多行对象保留结尾逗号以匹配现有 Vue 组件。导出类采用 PascalCase（如 `ProjectOperations`），ref/composable 使用 camelCase，`js/page/` 文件保持 kebab-case。DOM id 与 CSS class 务必描述清晰（新组件建议使用 `rp-` 前缀）。提交前运行 Prettier，并用简洁注释说明复杂逻辑，避免逐行解说。

## 测试指南
当前没有自动化套件；请按页面执行手动冒烟测试：在 `html/index.html` 导入 CSV，在 `visit_plan.html` 添加或编辑访视，并通过 `js/common/db-operations.js` 验证数据持久化。若需脚本测试，请在 `tests/` 目录新建 `<feature>.spec.js`，覆盖快乐路径、校验失败与删除流程。报告缺陷时附上控制台输出或截图。

## 提交与拉取请求规范
历史提交多为简短祈使句（`fix`、`重构代码`）。建议改用具描述性的消息（如 `Add visit window validation`），方便审阅者浏览日志。创建 PR 时请包含：1) UI/数据改动摘要，2) 复现步骤或预览链接，3) 关联 issue，4) 外观改动的截图或 GIF。提交前先 rebase 到最新主分支，并说明已完成的手动测试。

## 安全与配置提示
切勿将真实受试者数据写入仓库。模拟数据统一放在 `js/common/subject-service.js`，并显式标注为占位内容。若接入真实 API，请将端点与密钥存入被 `.gitignore` 忽略的环境配置文件，并通过轻量 fetch 封装读取，以便审计或切换环境。
