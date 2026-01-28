# XTrans - 无服务器 P2P 文件传输

快速、安全、完全去中心化的文件传输工具。无需服务器，通过浏览器直接连接，支持局域网和互联网传输。

## 🌟 核心特性

- 🚀 **纯前端架构** - 零后端依赖，完全运行在浏览器中，可部署在任何静态托管服务（GitHub Pages, Vercel, Netlify）。
- 🔗 **全能连接** - 支持局域网和广域网（互联网）P2P 直连。
- 🤝 **手动连接** - 通过扫描二维码或复制连接码，在任意两台设备间建立安全通道。
- 🔒 **安全隐私** - 数据点对点传输（WebRTC DTLS 加密），不经过任何第三方服务器，不留存任何数据。
- 📱 **PWA 支持** - 可安装到桌面/手机主屏幕，支持离线运行。
- 💾 **本地存储** - 使用 IndexedDB 存储传输历史和设置。

## 📖 技术栈

- **前端框架**: React 18 + TypeScript + Vite
- **UI 组件**: Tailwind CSS + Radix UI
- **状态管理**: Zustand
- **核心通信**: WebRTC (RTCPeerConnection + RTCDataChannel)
- **存储**: IndexedDB
- **PWA**: Workbox

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 📱 使用说明

### 建立连接

由于采用无服务器架构，设备间无法自动发现，需通过以下步骤建立连接：

1.  **发起方**：
    *   点击主界面的 **"连接设备"** 按钮。
    *   选择 **"我是发起方"**。
    *   点击 **"生成我的连接码"**。
    *   将生成的二维码展示给对方，或复制连接码发送给对方。

2.  **接收方**：
    *   点击主界面的 **"连接设备"** 按钮。
    *   选择 **"我是接收方"**。
    *   扫描发起方的二维码，或粘贴连接码。
    *   点击 **"下一步"**，生成响应码。
    *   将响应码展示或发送回给发起方。

3.  **完成连接**：
    *   发起方输入接收方的响应码。
    *   点击 **"完成连接"**。
    *   连接建立成功后，设备列表将自动刷新。

### 文件/文字传输

*   **发送文件**：点击设备卡片上的 "发送文件"，选择文件即可。支持多文件并发传输。
*   **发送文字**：点击 "发送文字"，输入内容即时送达。

## 📦 部署

本项目是纯静态应用，可以部署到任何静态网站托管服务。

### GitHub Pages / Vercel / Netlify

1.  Fork 本仓库。
2.  在托管平台导入仓库。
3.  构建命令：`npm run build`。
4.  发布目录：`dist`。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/xtrans/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🌐 浏览器兼容性

*   Chrome 90+
*   Edge 90+
*   Firefox 88+
*   Safari 14+
*   iOS Safari / Android Chrome

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
