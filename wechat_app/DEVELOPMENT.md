# 微信小程序访视计划工具 - 开发文档

## 1. 技术与运行约束
- 平台：微信小程序
- 运行方式：本地小程序开发者工具 + 真机预览
- 网络：一期不依赖后端服务
- 依赖管理：使用 npm 构建以便引入第三方库

### 1.1 npm 构建说明
- 初始化 `package.json` 并安装依赖。
- 在微信开发者工具中启用 “使用 npm 模块”，执行 “构建 npm”。
- 依赖尽量集中在 `utils/` 内部调用，避免在页面层直接耦合外部库。
- 构建失败优先排查包体积与 Node 依赖（如 `fs`、`crypto`）。

### 1.3 可执行操作清单（npm 构建）
1. 在 `wechat_app/` 目录执行：
   - `npm install`
2. 打开微信开发者工具，导入项目目录：`wechat_app/`。
3. 在工具右上角菜单选择：
   - “详情” -> 勾选 “使用 npm 模块”
4. 在菜单栏执行：
   - “工具” -> “构建 npm”
5. 若构建失败：
   - 检查 `miniprogram_npm/` 是否生成
   - 重新构建后重启开发者工具
   - 优先排查依赖是否包含 Node 专属 API

### 1.2 计划依赖（可扩展）
- `lunar-javascript`：节假日/农历相关判断
- `xlsx`：Excel 导出（需评估小程序兼容与包体积）

## 2. 目录规划（建议）
```
wechat_app/
  app.js
  app.json
  app.wxss
  pages/
    plan-list/        # 实验方案管理
    plan-edit/        # 新建/编辑方案
    plan-generate/    # 选择方案 + 首访日期
    plan-result/      # 访视计划结果与导出
    holiday-manage/   # 节假日管理
    history/          # 历史记录列表
    history-detail/   # 历史记录详情
  utils/
    visit-plan.js     # 访视计划计算
    holiday.js        # 节假日与覆盖逻辑
    storage.js        # 本地存储封装
  export-excel.js   # Excel 导出
```

## 3. 数据模型（本地存储）
### 3.1 方案 Plan
```
{
  id: string,
  name: string,
  totalVisits: number,
  frequency: string,   // "28" 或 "28,28,56"
  visitWindow: string, // "7" 或 "7,7,14"
  visitLabelRule: string, // 可选，如 "D3"
  createdAt: string,
  updatedAt: string,
  // 预留扩展字段
  projectName?: string,
  centerName?: string,
  groupName?: string
}
```

### 3.2 历史记录 PlanSnapshot
```
{
  id: string,
  planId: string,
  planName: string,
  firstVisitDate: string,
  totalVisits: number,
  frequency: string,
  visitWindow: string,
  visitLabelRule: string,
  items: [
    {
      visitNumber: number,
      visitLabel: string,
      dateType: "earliest" | "base" | "latest",
      date: string,
      holidayInfo: string
    }
  ],
  unavoidableCount: number,
  unavoidableDetails: [
    {
      visitNumber: number,
      visitLabel: string,
      dates: [
        { date: string, holidayInfo: string }
      ]
    }
  ],
  createdAt: string
}
```

### 3.3 节假日覆盖 HolidayOverride
```
{
  date: string,        // "YYYY-MM-DD"
  isHoliday: boolean,
  holidayName: string, // 可选
  updatedAt: string
}
```

## 4. 关键流程
### 4.1 生成访视计划
1. 读取方案规则与首访日期。
2. 解析频率与窗口（数量必须匹配）。
3. 计算每次访视的 base/earliest/latest 日期。
4. 对每个日期标注节假日信息。
5. 统计“无法避开节假日”访视。
6. 渲染计划结果并可保存为历史记录。

### 4.2 调整首访日期
- 用户修改首访日期 -> 重新执行计算 -> 刷新结果。

### 4.3 导出 Excel
- 将计划结果转换为二维表格。
- 生成 Excel 文件并保存到用户可访问目录。
- 若 `.xlsx` 生成失败，降级输出 `.csv`。

## 5. 导出实现策略
- 优先生成 `.xlsx`，若生成或打开失败，降级为 `.csv`。
- CSV 仍可被 Excel 打开，作为兼容兜底方案。
- 导出流程：
  - 将二维表格转为工作簿数据结构。
  - 使用 `wx.getFileSystemManager()` 写入临时文件路径。
  - 使用 `wx.openDocument()` 打开或 `wx.shareFileMessage()` 分享。

## 6. 计算逻辑说明
### 6.1 频率解析
- 若包含逗号：拆分为数组，长度必须等于 totalVisits - 1。
- 否则：使用固定值填充数组。

### 6.2 窗口解析
- 若为空：窗口默认为 0。
- 若包含逗号：拆分为数组，长度必须等于 totalVisits - 1。
- 否则：使用固定值填充数组。

### 6.3 计划生成
- 第 1 次访视：base/earliest/latest 都为首访日期。
- 第 n 次访视：基于上次 base 日期 + 频率递推。
- earliest = base - window，latest = base + window。

## 7. 节假日策略
### 7.1 基础节假日
- 使用 `lunar-javascript` 作为节假日判断基础。

### 7.2 覆盖策略
- 若日期存在自定义覆盖，优先使用覆盖结果。
- 否则使用基础节假日判断。
- 再次判断是否为周末。

## 8. 本地存储策略
- 使用 `wx.setStorageSync` / `wx.getStorageSync` 保存结构化数据。
- 导出文件与大体积内容使用 `wx.getFileSystemManager()` 写入本地文件。
- 历史记录保留上限 100 条，超出则删除最旧记录。
- 统一封装 `utils/storage.js` 提供 `get/set/list/delete`。
- 数据键建议：
  - `plans`
  - `planSnapshots`
  - `holidayOverrides`

## 9. 错误处理与提示
- 频率/窗口数量不匹配：弹出明确提示。
- 日期无效或缺失：阻止生成并提示。
- 导出失败：提示用户检查存储权限。

## 10. 待确认技术点
- Excel 导出方式（小程序端生成 xlsx 的可行性与体积限制）。
