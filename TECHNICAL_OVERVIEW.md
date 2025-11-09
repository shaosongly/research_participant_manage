# 项目技术说明

## 1. 引言
该项目是一套面向临床研究协调员的受试者访视管理工具，目标是让非工程角色在浏览器内即可完成项目立项、受试者导入、访视计划生成、访视执行记录和超窗核查等工作。本说明提供体系化视角，方便新成员快速了解模块职责、数据形态与代码实现方式。

## 2. 系统概览
- **架构形态**：完全前端的静态应用，依赖 CDN 注入的 Vue 3、Dexie（IndexedDB 封装）、TailwindCSS、Flatpickr、XLSX.js。
- **运行方式**：任何静态服务器即可托管；推荐 `npx http-server` 预览。
- **数据持久化**：浏览器 IndexedDB（数据库名 `ResearchDB`），Dexie 统一封装 CRUD。
- **主要目录**  
  - `landing.html`：产品入口与功能导航。  
  - `html/`：业务页面（受试者、项目、访视等）。  
  - `js/page/`：与页面一一对应的 Vue 逻辑。  
  - `js/common/`：数据库操作、领域服务。  
  - `css/`：Tailwind 增补样式。  

## 3. 模块与页面功能
- **Landing（landing.html）**：展示产品价值、引导进入各业务模块。
- **受试者管理（html/index.html + js/page/index.js）**  
  - Excel/CSV 导入，字段映射。  
  - 受试者列表、搜索、批量删除。  
  - 访视参数（首次日期、频率、窗口）输入与保存。
- **项目管理（html/project_manage.html + js/page/project-manage.js）**  
  - 新建项目及首个中心，展示项目/中心树。  
  - 删除项目时级联清理中心、受试者、访视记录。
- **访视计划（html/visit_plan.html + js/page/visit_plan.js）**  
  - 基于受试者参数计算计划访视表。  
  - 支持调整频次、窗口后重新生成。
- **访视记录（html/visit_record.html + js/page/visit-record.js）**  
  - 记录实际访视日期、状态。  
  - 支持筛选项目/中心/受试者与批量删除。
- **进度排期（html/schedule.html + js/page/schedule.js）**  
  - 以时间轴展示已计划与实际访视，便于协调。  
  - 结合 Flatpickr 选择期段。
- **窗口检查（html/window_check.html + js/page/window-check.js）**  
  - 调用 `SubjectService.checkVisitViolations`，列出超窗访视、超窗天数。  
  - 支持导出或通知。
- **公共组件**：导航栏、侧边菜单、弹窗表单等在各页面使用相同结构，样式在 `css/index.css` 中集中维护。

## 4. 数据模型设计
| 实体 | 存储表 | 主键/索引 | 关键字段 | 说明 |
| --- | --- | --- | --- | --- |
| Project | `projects` | `projectName` | `projectName`, `createTime` | 仅保存名称与创建时间。 |
| Center | `centers` | `[projectName+centerName]` | `projectName`, `centerName`, `createTime` | 通过 `projectName` 与项目关联。 |
| Subject | `subjects` | `[project+center+name]`、`projectCenter` | `project`, `center`, `name`, `firstDate`, `totalVisits`, `frequency`, `visitWindow`, `excelRow` | 储存访视规则与可选自定义字段。`projectCenter` 用于组合索引。 |
| VisitRecord | `visitRecords` | `[project+center+subjectName+visitNumber]`、`projectCenterSubject` | `project`, `center`, `subjectName`, `visitNumber`, `visitDate`, `status` | 记录真实访视，包括日期与备注。 |

数据流转：项目/中心构成层级 → 受试者隶属项目+中心 → 访视计划从受试者规则生成 → 实际访视写入 `visitRecords`。页面筛选、校验都基于组合索引，保证在 IndexedDB 中高效查询。

## 5. 代码实现与交互流程
- **目录映射**：每个 `html/*.html` 通过 `<script type="module">` 引用对应 `js/page/*.js`，这些脚本使用 Vue Composition API 管理状态。
- **状态管理**：不引入全局 store，页面通过 `ref`/`computed` 维护本地状态，并调用 `ProjectOperations`、`SubjectOperations` 等异步方法。
- **核心服务**  
  - `db-operations.js`：定义 `ResearchDB`，按实体提供 CRUD、批量事务与筛选（含复合索引、内存过滤）。  
  - `subject-service.js`：封装访视计划算法与超窗检测逻辑（频率/窗口解析、日期滚动、违规计算）。
- **典型流程**  
  1. 导入受试者：`index.js` 解析 Excel → 用户选择字段映射 → 调用 `SubjectOperations.addSubject` 批量写入 → 刷新列表。  
  2. 生成访视计划：`visit_plan.js` 读取选中受试者 → 使用 `SubjectService.calculatePlannedVisits` → 渲染计划表并支持导出。  
  3. 记录访视：`visit-record.js` 提供表单 → `VisitRecordOperations.upsertVisitRecord`（组合键） → 页面实时筛选展示。  
  4. 超窗检查：`window-check.js` 遍历受试者 → `SubjectService.checkVisitViolations` → 表格提示超窗天数。
- **错误处理与提示**：操作失败时抛出错误，由页面捕获后通过模态或 Toast 提示；导入/计算阶段会将失败详情写入控制台以便调试。

## 6. 接口与扩展点
- **本地存储 API**：`ProjectOperations`、`CenterOperations`、`SubjectOperations`、`VisitRecordOperations` 暴露 Promise 风格接口，方便未来替换为远端 REST/GraphQL。建议保持相同方法签名，并在适配层内加入鉴权。
- **数据导入导出**：`index.js` 通过 XLSX.js 处理 Excel 文件；`visit_plan.js`、`visit-record.js` 可扩展为 CSV 导出。新格式建议集中到 `js/common/import-export.js` 以便复用。
- **UI 扩展**：Tailwind +少量自定义 CSS，若引入组件库需在 `landing.html` 和公共导航中同步。

## 7. 安全与配置
- IndexedDB 默认在本地浏览器，仅存演示或脱敏数据。生产部署前需接入加密存储或远端 API。  
- 真实接口信息、API Key 应存放于运行环境配置（例如 `.env`，并在静态构建时注入）。  
- 任何包含受试者标识的数据导出都应增加脱敏选项和操作日志，可在未来扩展到 Audit 模块。

## 8. 测试与质量保障
- **现状**：依赖人工冒烟测试；重点场景是导入映射、访视计划计算、超窗判定。  
- **建议**：  
  1. 在 `tests/` 添加 Vitest 或 Jest，针对 `subject-service.js` 编写纯函数单元测试。  
  2. 对 `db-operations.js` 编写模拟 IndexedDB 的集成测试，验证事务删除链路。  
  3. 配置 Playwright 做关键流程 E2E（导入 → 计划 → 记录 → 超窗）。  
  4. 在 PR 模板中列出“已测试场景”复选框。

## 9. 运维与部署
- **本地开发**：`npx http-server . -c-1` 或任何静态服务器；若拆分 API，可通过代理（如 `http-server --proxy`）转发请求。  
- **部署流程**：  
  1. 将 `html/`、`js/`、`css/`、`landing.html` 推送至静态托管（例如 GitHub Pages、OSS）。  
  2. 确保 CDN 依赖（Vue、Dexie、Tailwind、Flatpickr、XLSX）在目标网络可访问；必要时改为本地打包。  
  3. 版本控制通过 Git，建议在合并前以标签标记可发布版本并生成变更说明。  
- **监控建议**：由于运行于浏览器，可引入前端埋点（如 Sentry）记录导入失败、IndexedDB 异常，以便远程诊断。
