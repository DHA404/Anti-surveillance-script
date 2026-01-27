# 浏览器反监控脚本 | Browser Anti-Surveillance Script

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-blue)](https://www.tampermonkey.net/)
[![Online Course](https://img.shields.io/badge/Online%20Course-Ready-green)](#)

专为浏览器设计的反监控用户脚本，特别适用于网课学习场景。有效防止网页监控用户行为，保护个人隐私，支持虚拟鼠标等高级功能。

A browser-specific anti-surveillance userscript, specially designed for online course scenarios. Effectively prevents web pages from monitoring user behavior, protects personal privacy, and supports advanced features like virtual mouse.

---

## 🎯 主要特色 | Key Features

### � 网课专用优化 | Online Course Optimized
- **防挂机检测**: 虚拟鼠标保持页面活跃状态
- **行为模拟**: 真实的鼠标移动和点击模式
- **多平台支持**: 适配主流网课平台
- **学习保护**: 防止学习行为被过度监控

**Anti-idle Detection**: Virtual mouse keeps page active
**Behavior Simulation**: Realistic mouse movement and click patterns
**Multi-platform Support**: Compatible with major online course platforms
**Learning Protection**: Prevents excessive monitoring of learning behavior

### 🛡️ 隐私保护 | Privacy Protection
- **事件拦截**: 阻止各种用户行为监控
- **设备伪装**: 隐藏真实设备信息
- **连接状态保护**: 阻止在线状态检测
- **本地存储**: 所有配置本地保存，不上传数据

**Event Interception**: Blocks various user behavior monitoring
**Device Spoofing**: Hides real device information
**Connection Protection**: Prevents online status detection
**Local Storage**: All configurations saved locally, no data upload

### �️ 虚拟鼠标技术 | Virtual Mouse Technology
- **贝塞尔曲线**: 模拟真实鼠标移动轨迹
- **智能避让**: 自动避开敏感元素
- **可配置性**: 自定义移动速度和模式
- **人性化操作**: 模拟真实用户使用习惯

**Bezier Curves**: Simulates realistic mouse movement trajectories
**Smart Avoidance**: Automatically avoids sensitive elements
**Configurable**: Customizable movement speed and patterns
**Human-like Operation**: Simulates real user behavior patterns

---

## 📥 安装指南 | Installation Guide

### 前置要求 | Prerequisites
1. 安装用户脚本管理器（强烈推荐脚本猫）：
   - 🌟 **[ScriptCat 脚本猫](https://github.com/scriptscat/scriptcat)** ⭐ **强烈推荐** - 功能最强大的用户脚本管理器
   - [Tampermonkey](https://www.tampermonkey.net/) - 传统选择
2. 确保浏览器允许安装用户脚本
3. 建议使用Chrome、Firefox或Edge浏览器

Install userscript manager (ScriptCat highly recommended):
- 🌟 **[ScriptCat](https://github.com/scriptscat/scriptcat)** ⭐ **Highly Recommended** - Most powerful userscript manager
- [Tampermonkey](https://www.tampermonkey.net/) - Traditional choice
Ensure browser allows userscript installation
Chrome, Firefox, or Edge browsers recommended

#### 🌟 为什么推荐 ScriptCat？| Why ScriptCat?
- **🔄 云同步**: 脚本跨设备同步，换浏览器或重装系统轻松恢复
- **⚡ 后台脚本**: 创新的后台执行机制，脚本持续运行不受页面限制
- **🛡️ 安全可靠**: 沙盒机制隔离运行，权限管理更严格
- **💻 开发体验**: 内置智能代码编辑器，语法高亮和智能补全
- **🔧 功能强大**: 提供比Tampermonkey更丰富的API，解锁更多可能性

**🔄 Cloud Sync**: Sync scripts across devices, easily restore when switching browsers
**⚡ Background Scripts**: Innovative background execution, scripts run continuously without page limits
**🛡️ Security & Reliability**: Sandbox isolation, stricter permission management
**💻 Development Experience**: Built-in smart editor with syntax highlighting and completion
**🔧 Powerful Features**: Richer APIs than Tampermonkey, unlocking more possibilities

### 安装步骤 | Installation Steps

#### 方法一：直接安装 | Direct Installation
1. 点击下方脚本文件：
   - [Anti-surveillance script.js](./Anti-surveillance%20script.js) (英文版 | English)
   - [反监控脚本.js](./反监控脚本.js) (中文版 | Chinese)
2. 脚本管理器会自动打开安装对话框：
   - **ScriptCat**: 自动识别并提示安装
   - **Tampermonkey**: 传统安装流程
3. 查看权限并点击"安装"

Click on script files below:
Script manager will automatically open installation dialog:
**ScriptCat**: Auto-detect and prompt for installation
**Tampermonkey**: Traditional installation process
Review permissions and click "Install"

#### 方法二：手动安装 | Manual Installation
1. 下载脚本文件到本地
2. 打开脚本管理器：
   - **ScriptCat**: 点击"+"号创建新脚本
   - **Tampermonkey**: 点击"实用工具"标签
3. 粘贴脚本内容并保存

Download script file locally
Open script manager:
**ScriptCat**: Click "+" to create new script
**Tampermonkey**: Click "Utilities" tab
Paste script content and save

---

## 🚀 快速开始 | Quick Start

### 基础使用 | Basic Usage

#### 网课场景 | Online Course Scenario
1. **打开网课平台**: 访问您的网课网站
2. **启用脚本**: 脚本会自动加载并运行
3. **配置虚拟鼠标**: 
   - 点击页面上的"反监控"按钮
   - 或通过脚本管理器菜单访问设置：
     - **ScriptCat**: 右键页面 → ScriptCat → 脚本设置
     - **Tampermonkey**: 扩展图标 → 脚本设置
4. **开始学习**: 享受隐私保护的学习体验

**Open Online Course Platform**: Visit your online course website
**Enable Script**: Script loads and runs automatically
**Configure Virtual Mouse**: 
Click "Anti-Surveillance" button on page
Or access settings via script manager menu:
**ScriptCat**: Right-click page → ScriptCat → Script Settings
**Tampermonkey**: Extension icon → Script Settings
**Start Learning**: Enjoy privacy-protected learning experience

#### 推荐设置 | Recommended Settings
- ✅ **虚拟鼠标**: 保持页面活跃，防止挂机检测
- ✅ **事件拦截**: 阻止学习行为监控
- ✅ **设备伪装**: 在需要时启用
- ❌ **过度功能**: 避免影响正常网课功能

**Virtual Mouse**: Keep page active, prevent idle detection
**Event Blocking**: Block learning behavior monitoring
**Device Spoofing**: Enable when needed
**Excessive Features**: Avoid affecting normal course functionality

---

## ⚙️ 配置说明 | Configuration

### 主要功能 | Main Features

#### 🖱️ 虚拟鼠标设置 | Virtual Mouse Settings
- **移动间隔**: 鼠标移动的时间间隔（推荐：200-500ms）
- **光标大小**: 虚拟光标的显示大小
- **悬停时间**: 在元素上的停留时间
- **移动模式**: 选择贝塞尔曲线或直线移动

**Movement Interval**: Time between mouse movements (recommended: 200-500ms)
**Cursor Size**: Display size of virtual cursor
**Hover Duration**: Time to stay on elements
**Movement Mode**: Choose Bezier curve or straight line movement

#### 🚫 事件拦截 | Event Interception
- **鼠标事件**: 点击、移动、滚轮等
- **键盘事件**: 按键、按下、抬起
- **页面事件**: 可见性、焦点、全屏等
- **触摸事件**: 触摸开始、移动、结束

**Mouse Events**: Click, move, wheel, etc.
**Keyboard Events**: Keypress, keydown, keyup
**Page Events**: Visibility, focus, fullscreen, etc.
**Touch Events**: Touchstart, touchmove, touchend

#### 🎭 设备伪装 | Device Spoofing
- **浏览器标识**: 修改User-Agent
- **屏幕分辨率**: 调整显示属性
- **平台信息**: 伪装操作系统信息
- **设备类型**: 桌面、手机、平板

**Browser ID**: Modify User-Agent
**Screen Resolution**: Adjust display properties
**Platform Info**: Spoof operating system information
**Device Type**: Desktop, mobile, tablet

---

## 📚 网课平台适配 | Online Course Platform Compatibility

### 支持的平台 | Supported Platforms
- ✅ **Zoom**: 在线会议和网课
- ✅ **超星学习通**: 高校教学平台
- ✅ **其他平台**: 大部分基于Web的网课系统

**Zoom**: Online meetings and courses
**Tencent Classroom**: Mainstream domestic course platform
**DingTalk**: Corporate and school use
**NetEase Cloud Classroom**: Online learning platform
**Zhihuishu**: University online courses
**Chaoxing Learning**: University teaching platform
**Other Platforms**: Most Web-based online course systems

## � 高级用法 | Advanced Usage

### 自定义规则 | Custom Rules
为特定网课平台创建专用配置：
Create dedicated configurations for specific online course platforms:

1. 打开脚本设置面板
2. 选择"网站特定配置"
3. 添加平台URL和规则
4. 保存并应用配置

Open script settings panel
Select "Site-specific Configuration"
Add platform URL and rules
Save and apply configuration

### 调试模式 | Debug Mode
遇到问题时启用调试：
Enable debug mode when encountering issues:

1. 进入脚本设置
2. 找到"高级选项"
3. 启用"调试模式"
4. 查看浏览器控制台日志

Go to script settings
Find "Advanced Options"
Enable "Debug Mode"
Check browser console logs

---

## 🛠️ 故障排除 | Troubleshooting

### 常见问题 | Common Issues

#### 脚本不工作 | Script Not Working
- 检查Tampermonkey是否启用
- 验证脚本权限设置
- 确认没有冲突的脚本
- 尝试重新安装脚本

Check if Tampermonkey is enabled
Verify script permissions
Confirm no conflicting scripts
Try reinstalling the script

#### 虚拟鼠标问题 | Virtual Mouse Issues
- 检查黑名单设置
- 验证元素目标设置
- 调整移动间隔
- 清除脚本缓存

Check blacklist settings
Verify element targeting
Adjust movement intervals
Clear script cache

#### 网课平台兼容性 | Course Platform Compatibility
- 查看平台特定配置
- 尝试不同的功能组合
- 关闭可能冲突的功能
- 反馈平台兼容性问题

Check platform-specific configuration
Try different feature combinations
Disable potentially conflicting features
Report platform compatibility issues

---

## � 使用须知 | Usage Notes

### ⚠️ 重要提醒 | Important Reminders
- **合理使用**: 仅用于保护隐私，请勿用于违规行为
- **遵守规则**: 遵守网课平台的使用条款
- **备份配置**: 定期备份您的配置设置
- **及时更新**: 保持脚本为最新版本

**Responsible Use**: Only for privacy protection, do not use for violations
**Follow Rules**: Comply with online course platform terms of service
**Backup Configuration**: Regularly backup your configuration settings
**Keep Updated**: Maintain script at latest version

### 🎓 学习建议 | Learning Recommendations
- **专注学习**: 脚本用于保护隐私，不应影响学习质量
- **适度使用**: 根据实际需要调整功能强度
- **反馈问题**: 遇到问题及时反馈，帮助改进脚本
- **分享经验**: 与同学分享合理使用经验

**Focus on Learning**: Script protects privacy but shouldn't affect learning quality
**Moderate Use**: Adjust feature intensity based on actual needs
**Report Issues**: Provide timely feedback to help improve the script
**Share Experience**: Share reasonable usage experiences with classmates

---

## � 文件说明 | File Description

```
anti-surveillance-script/
├── Anti-surveillance script.js    # 英文版本脚本
├── 反监控脚本.js                   # 中文版本脚本
├── README.md                      # 项目说明文档
├── LICENSE                        # MIT开源许可证
└── docs/                          # 文档目录
    ├── CONTRIBUTING.md            # 贡献指南
    ├── DISCLAIMER.md              # 免责声明
    └── CHANGELOG.md               # 更新日志
```

---

## 🔗 相关链接 | Related Links

- **许可证**: [MIT License](./LICENSE)
- **贡献指南**: [Contributing Guidelines](./docs/CONTRIBUTING.md)
- **免责声明**: [Disclaimer](./docs/DISCLAIMER.md)
- **更新日志**: [Changelog](./docs/CHANGELOG.md)
- **🌟 ScriptCat 推荐**: [为什么选择 ScriptCat](./docs/ScriptCat-推荐.md)
- **问题反馈**: [GitHub Issues](../../issues)

---

## 🤝 贡献 | Contributing

欢迎贡献代码、报告问题或提出改进建议！
Welcome to contribute code, report issues, or suggest improvements!

- 🐛 **报告问题**: 发现bug请及时反馈
- 💡 **功能建议**: 提出新功能想法
- 📝 **文档改进**: 帮助完善文档
- 🌐 **翻译支持**: 协助多语言支持

**Report Issues**: Report bugs promptly
**Feature Suggestions**: Propose new feature ideas
**Documentation Improvement**: Help improve documentation
**Translation Support**: Assist with multi-language support

---

## 📞 联系方式 | Contact

- **作者**: DHF
- **问题反馈**: [GitHub Issues](../../issues)
- **功能建议**: [GitHub Discussions](../../discussions)

---

## 📊 兼容性 | Compatibility

### 支持的浏览器 | Supported Browsers
- ✅ Chrome / Chromium (推荐 | Recommended)
- ✅ Firefox
- ✅ Edge
- ✅ Safari (部分功能 | Partial features)
- ✅ Opera

### 用户脚本管理器 | Userscript Managers
- 🌟 **ScriptCat 脚本猫** ⭐ **强烈推荐** - 功能最强大，云同步，后台脚本
- ✅ Tampermonkey - 传统选择，广泛兼容
- ✅ Greasemonkey - Firefox原生支持
- ✅ Violentmonkey - 轻量级选择
- ✅ 其他兼容管理器 | Other compatible managers

**ScriptCat Features**: Cloud sync, background scripts, smart editor, enhanced security
**Tampermonkey**: Traditional choice, wide compatibility
**Greasemonkey**: Firefox native support
**Violentmonkey**: Lightweight option

---

<div align="center">

## 🎓 专为学习而设计，让知识获取更自由 | Designed for Learning, Making Knowledge Access Freer

## ⭐ 如果这个脚本对您的学习有帮助，请给它一个星标！⭐

## ⭐ If this script helps your learning, please give it a star! ⭐

**使用本脚本即表示您同意[免责声明](./docs/DISCLAIMER.md)中的条款**

**Using this script means you agree to the terms in the [Disclaimer](./docs/DISCLAIMER.md)**

</div>