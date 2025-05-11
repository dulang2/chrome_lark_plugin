# 飞书助手 Chrome 扩展

## 简介

飞书助手是一款 Chrome 浏览器扩展，旨在帮助用户快速将当前浏览的页面链接或自定义的文本消息发送到指定的飞书群聊或个人用户。

## 主要功能

*   **多维表格集成**：通过飞书API实现与多维表格的双向数据同步，支持记录创建/更新
*   **右键菜单操作**：支持网页文本划词快速创建多维表格记录
*   **配置管理中心**：
    - 飞书凭证管理（app_id/app_secret）
    - 多维表格映射关系配置
    - 消息模板引擎
*   **消息推送系统**：
    - 支持API/Webhook双模式
    - 支持富文本消息格式
    - 失败自动重试机制
*   **权限分级控制**：根据飞书API权限自动启用对应功能模块

## 安装与配置

1.  **安装扩展**：
    *   从 Chrome 网上应用店安装（如果已发布）。
    *   或通过加载已解压的扩展程序进行本地安装。
2.  **配置选项**：
    *   安装完成后，右键点击扩展图标，选择“选项”进入设置页面。
    *   **发送设置**：
        *   **API 模式**：需要填写飞书应用的 `App ID` 和 `App Secret`。此模式通常功能更全面。
        *   **Webhook 模式**：需要填写飞书群机器人的 `Webhook 地址`。此模式配置相对简单。
    *   **群聊管理**：添加飞书群聊的名称和对应的 `Chat ID`。
    *   **用户管理**：添加飞书用户的名称和对应的 `User ID` (如 Open ID, User ID 或 Union ID，具体取决于 API 要求)。

## 使用方法

1.  **打开 Popup**：点击浏览器工具栏中的“飞书助手”图标，打开操作弹窗。
2.  **输入消息**：
    *   默认情况下，扩展可能会自动填充当前页面的标题和链接（此功能需在 `background.js` 和 `popup.js` 中实现）。
    *   您也可以在文本框中输入或修改要发送的自定义消息。
3.  **选择接收者**：从下拉列表中选择预先配置好的飞书群聊或个人用户。
4.  **发送消息**：点击“发送”按钮。

## 权限说明

本扩展需要以下权限以正常工作：

*   `storage`: 用于存储用户的配置信息，如 API 密钥、Webhook 地址以及群聊和用户列表。
*   `activeTab`: 用于获取当前活动标签页的 URL 和标题，方便用户快速分享页面链接。
*   `contextMenus`: (可能用于)提供右键快捷操作，例如直接发送当前页面到预设目标。
*   `notifications`: 用于在消息发送成功或失败时向用户显示通知。
*   `system.display`: (具体用途待定，可能与获取屏幕信息或多显示器支持相关)。
*   `host_permissions` (`https://open.feishu.cn/*`): 允许扩展与飞书的开放 API 进行通信，以发送消息和获取必要信息。

## 技术栈

*   Manifest V3
*   TypeScript
*   HTML5/CSS3
*   飞书开放平台 API（多维表格、消息推送）
*   LayUI 前端框架
*   Webpack 构建工具
*   Chrome Storage API
*   ESLint + Prettier 代码规范

## 项目结构

```
.
├── manifest.json         # 扩展清单文件（MV3规范）
├── README.md             # 项目文档
└── src/
    ├── background/       # 后台服务
    │   ├── bitable.ts    # 多维表格API服务
    │   ├── contextMenu.ts # 右键菜单管理
    │   └── core.ts       # 核心逻辑控制
    ├── config/           # 配置管理
    │   ├── schema.ts     # 配置项类型定义
    │   └── manager.ts    # 配置持久化管理
    ├── options/          # 配置页面
    │   ├── components/   # Vue组件
    │   │   ├── BitableConfig.vue
    │   │   └── CredentialForm.vue
    │   └── store/        # Pinia状态管理
    ├── libs/             # 第三方库
    │   └── feishu-sdk/   # 飞书API封装
    └── utils/
        ├── errorHandler.ts # 统一错误处理
        └── logger.ts     # 日志服务
```

## 注意事项

*   请确保您在选项页面中填写的 `App ID`、`App Secret` 或 `Webhook 地址` 是正确且有效的。
*   使用 API 模式时，请确保您的飞书应用拥有发送消息到相应群聊或用户的权限。
