# AI Session Backend Persistence Design

## Goal

将 AI 会话与消息的持久化从前端 React 状态迁移到本机 NestJS + SQLite；前端只通过接口加载和更新，刷新后可恢复会话。

## Scope

- 持久化 AI 会话元数据、会话消息、会话模式和更新时间。
- 保留现有配置、命令历史、多 IP 归档和操作日志的 SQLite 存储。
- 文件编辑器未保存草稿、连接状态、打开标签和窗口布局继续作为临时运行态，不写入数据库。
- 不保存 API Key 到前端响应，不改变现有 AI 代理接口。

## Data Model

新增 SQLite migration v4：

- `ai_chat_sessions(id, server_id, title, mode, created_at, updated_at)`。
- `ai_chat_messages(id, session_id, role, content, created_at)`，外键级联删除。

## API

- `GET /api/v1/ai/sessions?serverId=`：读取会话列表。
- `POST /api/v1/ai/sessions`：创建会话。
- `PATCH /api/v1/ai/sessions/:id`：更新标题或模式。
- `DELETE /api/v1/ai/sessions/:id`：删除会话。
- `GET /api/v1/ai/sessions/:id/messages`：读取消息。
- `POST /api/v1/ai/sessions/:id/messages`：新增消息。
- `PATCH /api/v1/ai/sessions/:id/messages/:messageId`：更新流式助手消息内容。
- `DELETE /api/v1/ai/sessions/:id/messages`：清空消息。

所有输入在 Service 层校验；找不到会话或消息返回 404；删除会话级联删除消息。

## Frontend Flow

AI 面板初始化和切换服务器时读取会话及消息；创建、发送、清空、删除和模式更新均等待接口成功后更新视图。流式回复期间保留短暂内存缓冲，完成后通过消息接口写回 SQLite；失败时保留可重试状态并不伪装为已保存。

## Verification

后端 Service 单元测试覆盖校验、级联删除和消息更新；E2E 测试覆盖会话及消息 CRUD。前端 TypeScript 构建验证接口类型和 AI 面板集成。
