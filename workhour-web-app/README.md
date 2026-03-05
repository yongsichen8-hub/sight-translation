# 工时管理 Web 应用

基于 React + Express + TypeScript 的工时管理系统，替代飞书机器人方案。译员通过飞书 OAuth 登录后，可查看进行中的口译/笔译项目并填报工时，系统自动汇总并回写至飞书多维表格。

## 功能概览

- **工时填写**：译员登录后查看进行中项目，填写口译/笔译工时
- **管理页面**：查看所有译员工时记录，支持多维度筛选
- **数据分析**：工时统计概览、按译员/项目分组图表、口译笔译占比
- **飞书集成**：OAuth 登录、多维表格自动读写

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Recharts |
| 后端 | Express + TypeScript + JWT |
| 数据存储 | JSON 文件（TrackerService） |
| 外部服务 | 飞书 OAuth API、飞书多维表格 API |

## 前置条件

- Node.js >= 18
- npm >= 9

## 环境变量配置

### 后端配置

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`，填写以下变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `FEISHU_APP_ID` | 飞书应用 App ID | 在飞书开放平台获取 |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret | 在飞书开放平台获取 |
| `BITABLE_APP_TOKEN` | 多维表格 App Token | `LZxwwV9vGiHesHk5nEVcsw1Pnud` |
| `INTERPRETATION_TABLE_ID` | 口译表 Table ID | `tblxCsMVGfag1mmZ` |
| `TRANSLATION_TABLE_ID` | 笔译表 Table ID | `tbliA5bK8PsJ213l` |
| `JWT_SECRET` | JWT 签名密钥 | 使用随机字符串 |
| `PORT` | 后端服务端口 | `3002`（默认） |
| `CORS_ORIGIN` | 前端跨域来源 | `http://localhost:5174` |
| `FEISHU_REDIRECT_URI` | OAuth 回调地址 | `http://localhost:5174/auth/callback` |

> 注意：`FEISHU_REDIRECT_URI` 需与飞书开放平台中配置的重定向 URI 一致。

## 启动项目

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 启动后端

```bash
cd server
npm run dev
```

后端服务默认运行在 `http://localhost:3002`。

### 3. 启动前端

```bash
cd client
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5174`，已配置 Vite 代理将 `/api` 请求转发到后端。

### 4. 访问应用

浏览器打开 `http://localhost:5174`，点击飞书登录即可使用。

## 项目结构

```
workhour-web-app/
├── client/                     # React 前端
│   ├── src/
│   │   ├── components/         # 页面组件
│   │   │   ├── LoginPage.tsx       # 登录页
│   │   │   ├── TimesheetPage.tsx   # 工时填写页
│   │   │   ├── AdminPage.tsx       # 管理页
│   │   │   └── AnalyticsPage.tsx   # 数据分析页
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # 认证上下文
│   │   ├── services/
│   │   │   └── api.ts             # API 客户端
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── server/                     # Express 后端
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts           # 环境变量配置
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts   # JWT 认证中间件
│   │   ├── routes/
│   │   │   ├── auth.ts            # 认证路由
│   │   │   ├── projects.ts        # 项目路由
│   │   │   ├── timeRecords.ts     # 工时记录路由
│   │   │   └── stats.ts           # 统计路由
│   │   ├── services/
│   │   │   ├── AuthService.ts     # 认证服务
│   │   │   ├── BitableService.ts  # 飞书多维表格服务
│   │   │   └── TrackerService.ts  # 本地数据存储服务
│   │   ├── validators/
│   │   │   └── FormValidator.ts   # 表单验证
│   │   ├── types/
│   │   │   └── index.ts           # 类型定义
│   │   └── index.ts               # 入口文件
│   ├── .env.example
│   └── package.json
└── README.md
```

## API 接口

所有接口返回统一 JSON 格式：`{ success: boolean, data?: any, error?: string }`

### 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/auth/feishu` | 获取飞书 OAuth 授权 URL | 否 |
| GET | `/api/auth/feishu/callback` | 处理 OAuth 回调 | 否 |
| GET | `/api/auth/me` | 获取当前用户信息 | 是 |
| POST | `/api/auth/logout` | 退出登录 | 否 |

### 项目

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/projects` | 获取进行中项目列表（支持 `type` 参数） | 是 |

### 工时记录

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/time-records` | 提交工时记录 | 是 |
| GET | `/api/time-records` | 查询工时记录（支持 `translatorId`、`projectId`、`startDate`、`endDate` 参数） | 是 |

### 统计

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/stats` | 获取工时统计数据（支持 `startDate`、`endDate` 参数） | 是 |

## 开发说明

- 前端开发服务器通过 Vite proxy 将 `/api` 请求代理到后端 `http://localhost:3002`，无需额外配置跨域
- 后端使用 `tsx watch` 实现热重载
- 数据存储在 `server/tracker-data.json`，首次启动时自动创建
- JWT 令牌有效期为 7 天，存储在 HttpOnly Cookie 中
