# 后端凭据与界面配置持久化设计

## 目标

将服务器、目录树、提示语、AI 模型配置和 OpenAI API Key 的持久化统一到后端 SQLite。前端只负责编辑和展示；SSH 连接由后端依据 `serverId` 从 SQLite 查询主机、端口、用户名和密码，前端连接事件不再发送密码。

## 架构

- `ConfigurationService` 继续负责服务器、目录和应用配置快照的事务性写入。
- 新增后端凭据状态接口，用于保存/清除服务器密码并返回 `hasCredential`，不返回密码。
- `SshGateway` 仅接受 `serverId`（可选终端元数据），从 `DatabaseService.findServer` 解析连接参数。
- `CredentialService` 改为使用 `DatabaseService` 的 `app_preferences` 保存 OpenAI API Key；读取只发生在后端 AI 代理内部。
- 前端连接请求只发送 `serverId`；服务器表单保存后立即触发配置快照保存，目录和 AI 设置继续由快照接口持久化。

## 数据流

1. 添加/编辑服务器：前端更新 Zustand 状态并触发 `PUT /api/v1/configuration`，密码只作为请求体写入 SQLite，响应中仅返回 `hasCredential`。
2. 连接服务器：前端发送 `{ serverId }` 的 `ssh-connect` 事件，后端查库并调用 SSH 服务。
3. 保存 OpenAI 配置：模型地址、模型名等普通配置进入 SQLite 快照；API Key 通过后端凭据接口进入 SQLite，前端状态只保留空字符串。
4. 重启应用：前端从配置接口恢复目录、服务器元数据和 AI 普通配置；密码和 API Key 不下发。

## 错误处理与安全边界

- 未找到 `serverId` 或服务器无凭据时，后端返回 SSH 错误事件，不尝试使用前端传入的主机或密码。
- 凭据接口拒绝空值，删除操作可重复执行。
- 配置快照校验失败时事务回滚，保留旧数据。
- 所有读取配置的响应都不包含 `password`、`customKey` 或 API Key。

## 测试

- 后端单测验证服务器凭据接口、AI Key SQLite round-trip 和无凭据连接拒绝。
- e2e 验证 `ssh-connect` 事件只能依赖数据库记录，以及 AI 请求使用数据库中的 Key。
- 前端构建验证连接调用不再传递服务器密码，配置持久化类型检查通过。
