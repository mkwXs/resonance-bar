# 共鸣调酒室 v1.1.0

## 下载与安装

- `ResonanceBar-1.1.0-Windows-x64.exe`：Windows 10 / 11 x64 独立应用，双击启动，无需安装 Node.js。
- `ResonanceBar-1.1.0-Android.apk`：Android 8.0 及以上离线应用，APK 使用专用发行密钥签名。
- `ResonanceBar-1.1.0-Source.zip`：源码与构建脚本，不含个人配方数据、签名私钥和第三方工具链。
- `SHA256SUMS.txt`：安装包和源码包的 SHA-256 校验值。

## 本次更新

- 网站升级为独立 Windows 应用和离线 Android 应用。
- Windows 应用自行管理本地服务与用户数据，避免手动启动失败。
- Android 使用应用私有目录保存配方，图片和 JSON 支持系统文件选择器，备份支持系统“另存为”。
- 保留八款原方、搜索筛选、新增编辑删除复制、图片编辑、可调参考价和采购预算。
- 原网站数据可以导出 JSON 后导入新应用，电脑与手机可用同一备份格式互相迁移。

## 验证与已知范围

- JavaScript 语法检查与 7 项自动测试通过。
- Windows 应用启动检查覆盖八款配方渲染、真实保存和渲染进程无 Node.js 访问。
- APK 已通过 Java 编译、D8、zipalign、apksigner v2 / v3 签名校验和 Manifest / assets 检查。
- 暂未连接真实 Android 手机进行安装与系统文件选择器试用。不同厂商的 WebView 版本可能影响显示，建议保留系统 WebView 更新。
- 两端均为本地应用，不含云同步。原网站、Windows 和 Android 的数据独立，通过 JSON 备份迁移。
- 卸载手机应用前请先导出备份。

角色视觉参考与原创调酒方案已分开标注，项目不是官方作品，价格均为估算。
