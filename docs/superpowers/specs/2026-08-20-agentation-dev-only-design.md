# Agentation 开发环境激活设计

## 目标

在 React 应用根入口启用 `agentation` 的视觉反馈工具，但只在 Vite 开发环境渲染，避免生产构建引入调试面板。

## 方案

- 在 `index.tsx` 导入 `Agentation`。
- 保留现有 `React.StrictMode` 与 `AISSH` 根组件结构。
- 通过 `import.meta.env.DEV` 条件渲染 `<Agentation />`。
- 不修改依赖版本、Vite 配置或其他业务组件。

## 验证

- 使用 TypeScript 编译检查确认入口代码和 `agentation` 类型可用。
- 使用 Vite 构建检查生产分支可以正常打包；开发服务器保持现状，不新开端口。
