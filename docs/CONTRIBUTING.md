# Contributing to Anti-Surveillance Userscript | 反监控用户脚本贡献指南

Thank you for your interest in contributing to the Anti-Surveillance Userscript! This document provides guidelines and information for contributors.

感谢您对反监控用户脚本贡献的兴趣！本文档为贡献者提供指导原则和信息。

---

## 🚀 Getting Started | 开始贡献

### Prerequisites | 前置条件
- **JavaScript Knowledge**: Strong understanding of JavaScript and DOM manipulation
- **Userscript Experience**: Familiarity with userscript development and Tampermonkey API
- **Privacy Focus**: Understanding of web privacy and tracking technologies
- **Git Knowledge**: Basic Git operations and GitHub workflow

**JavaScript知识**：深入了解JavaScript和DOM操作
**用户脚本经验**：熟悉用户脚本开发和Tampermonkey API
**隐私关注**：了解网络隐私和跟踪技术
**Git知识**：基本的Git操作和GitHub工作流程

### Development Environment | 开发环境
- **Browser**: Chrome/Firefox with Tampermonkey installed
- **Code Editor**: VS Code or similar with JavaScript support
- **Debug Tools**: Browser developer tools
- **Git Client**: Git CLI or GitHub Desktop

**浏览器**：安装了Tampermonkey的Chrome/Firefox
**代码编辑器**：VS Code或支持JavaScript的类似编辑器
**调试工具**：浏览器开发者工具
**Git客户端**：Git CLI或GitHub Desktop

---

## 📋 How to Contribute | 如何贡献

### 1. Fork and Clone | 分叉和克隆
```bash
# Fork the repository on GitHub first
# Then clone your fork
git clone https://github.com/yourusername/anti-surveillance-script.git
cd anti-surveillance-script
```

### 2. Create a Branch | 创建分支
```bash
# Create a new branch for your feature
git checkout -b feature/your-feature-name
# or for bug fixes
git checkout -b fix/bug-description
```

### 3. Make Changes | 进行更改
- **Code Quality**: Follow the existing code style and patterns
- **Comments**: Add meaningful comments for new functions
- **Testing**: Test your changes thoroughly
- **Documentation**: Update documentation as needed

**代码质量**：遵循现有代码风格和模式
**注释**：为新函数添加有意义的注释
**测试**：彻底测试您的更改
**文档**：根据需要更新文档

### 4. Submit Pull Request | 提交拉取请求
```bash
# Commit your changes
git add .
git commit -m "feat: add new feature description"
# Push to your fork
git push origin feature/your-feature-name
# Create pull request on GitHub
```

---

## 🎯 Contribution Areas | 贡献领域

### 🐛 Bug Reports | 错误报告
- **Detailed Description**: Provide clear, detailed bug descriptions
- **Steps to Reproduce**: Include exact steps to reproduce the issue
- **Environment**: Specify browser, OS, and script version
- **Expected vs Actual**: Describe expected and actual behavior

**详细描述**：提供清晰详细的错误描述
**重现步骤**：包含重现问题的确切步骤
**环境**：指定浏览器、操作系统和脚本版本
**预期与实际**：描述预期和实际行为

### ✨ Feature Requests | 功能请求
- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Suggest how the feature should work
- **Alternatives**: Mention any alternative solutions considered
- **Impact**: Explain why this feature would be valuable

**用例**：描述您要解决的问题
**建议解决方案**：建议功能应该如何工作
**替代方案**：提及考虑过的任何替代解决方案
**影响**：解释为什么这个功能有价值

### 📝 Documentation | 文档改进
- **README Updates**: Improve installation or usage instructions
- **Code Comments**: Add or improve inline documentation
- **Examples**: Provide usage examples or tutorials
- **Translation**: Help with multi-language support

**README更新**：改进安装或使用说明
**代码注释**：添加或改进内联文档
**示例**：提供使用示例或教程
**翻译**：帮助多语言支持

### 🔧 Code Contributions | 代码贡献
- **Performance**: Optimize script performance
- **Security**: Improve security measures
- **Compatibility**: Enhance browser/website compatibility
- **New Features**: Implement new anti-surveillance techniques

**性能**：优化脚本性能
**安全**：改进安全措施
**兼容性**：增强浏览器/网站兼容性
**新功能**：实现新的反监控技术

---

## 📝 Code Guidelines | 代码指南

### Code Style | 代码风格
```javascript
// Use strict mode
'use strict';

// Use meaningful variable and function names
const virtualMouseConfig = {
    enabled: true,
    moveInterval: 200
};

/**
 * Creates a virtual mouse element
 * @param {Object} config - Configuration object
 * @returns {HTMLElement} Virtual mouse element
 */
function createVirtualMouse(config) {
    // Implementation here
}

// Use consistent indentation (4 spaces)
if (condition) {
    // Do something
}

// Add comments for complex logic
// Calculate bezier curve points for smooth movement
const points = calculateBezierPath(start, end, curvature);
```

### Naming Conventions | 命名约定
- **Variables**: camelCase (`virtualMouse`, `moveInterval`)
- **Functions**: camelCase with descriptive names (`createVirtualMouse`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_MOVE_INTERVAL`)
- **Classes**: PascalCase (`VirtualMouseEngine`)
- **Files**: Descriptive names with appropriate extensions

**变量**：camelCase（`virtualMouse`, `moveInterval`）
**函数**：具有描述性名称的camelCase（`createVirtualMouse`）
**常量**：UPPER_SNAKE_CASE（`DEFAULT_MOVE_INTERVAL`）
**类**：PascalCase（`VirtualMouseEngine`）
**文件**：具有适当扩展名的描述性名称

### Comment Standards | 注释标准
```javascript
/**
 * Function description
 * @param {Type} paramName - Parameter description
 * @returns {Type} Return value description
 * @throws {Error} Error description if applicable
 */

// Single line comments for complex logic
/* Multi-line comments for detailed explanations */
```

---

## 🧪 Testing Guidelines | 测试指南

### Manual Testing | 手动测试
- **Multiple Browsers**: Test in Chrome, Firefox, Edge, Safari
- **Different Websites**: Test on various website types
- **Feature Testing**: Test each feature individually
- **Edge Cases**: Test unusual scenarios and edge cases

**多浏览器**：在Chrome、Firefox、Edge、Safari中测试
**不同网站**：在各种网站类型上测试
**功能测试**：单独测试每个功能
**边界情况**：测试异常场景和边界情况

### Automated Testing | 自动化测试
```javascript
// Example test structure
function testVirtualMouseCreation() {
    const config = { enabled: true, moveInterval: 200 };
    const mouse = createVirtualMouse(config);
    
    if (!mouse) {
        throw new Error('Virtual mouse creation failed');
    }
    
    console.log('✅ Virtual mouse creation test passed');
}
```

### Performance Testing | 性能测试
- **Load Time**: Measure script initialization time
- **Memory Usage**: Monitor memory consumption
- **CPU Impact**: Check CPU usage during operation
- **Responsiveness**: Ensure minimal impact on page responsiveness

**加载时间**：测量脚本初始化时间
**内存使用**：监控内存消耗
**CPU影响**：检查操作期间的CPU使用情况
**响应性**：确保对页面响应性的最小影响

---

## 🔄 Pull Request Process | 拉取请求流程

### Before Submitting | 提交前
1. **Test Thoroughly**: Ensure all tests pass
2. **Update Documentation**: Update relevant documentation
3. **Check Style**: Ensure code follows project guidelines
4. **Clean History**: Keep commit history clean and meaningful

**彻底测试**：确保所有测试通过
**更新文档**：更新相关文档
**检查风格**：确保代码遵循项目指南
**清理历史**：保持提交历史干净和有意义

### PR Template | PR模板
```markdown
## Description | 描述
Brief description of changes

## Type of Change | 更改类型
- [ ] Bug fix | 错误修复
- [ ] New feature | 新功能
- [ ] Breaking change | 破坏性更改
- [ ] Documentation update | 文档更新

## Testing | 测试
- [ ] Tested manually | 手动测试
- [ ] Added automated tests | 添加自动化测试
- [ ] Performance tested | 性能测试

## Checklist | 检查清单
- [ ] Code follows style guidelines | 代码遵循风格指南
- [ ] Self-review completed | 自我审查完成
- [ ] Documentation updated | 文档已更新
```

### Review Process | 审查流程
1. **Automated Checks**: Automated tests and style checks
2. **Code Review**: Manual review by maintainers
3. **Testing**: Additional testing if needed
4. **Approval**: Merge after approval and checks pass

**自动检查**：自动化测试和风格检查
**代码审查**：维护者的手动审查
**测试**：需要时进行额外测试
**批准**：批准和检查通过后合并

---

## 🏆 Recognition | 认可

### Contributors | 贡献者
- **Credits**: All contributors are credited in README
- **Hall of Fame**: Notable contributors highlighted
- **Special Thanks**: Special recognition for significant contributions

**署名**：所有贡献者在README中得到署名
**名人堂**：突出显示杰出贡献者
**特别感谢**：对重大贡献的特别认可

### Ways to Contribute | 贡献方式
- **Code**: Direct code contributions
- **Testing**: Bug reporting and testing
- **Documentation**: Writing and improving documentation
- **Community**: Helping other users in discussions

**代码**：直接代码贡献
**测试**：错误报告和测试
**文档**：编写和改进文档
**社区**：在讨论中帮助其他用户

---

## 📞 Getting Help | 获取帮助

### Communication Channels | 沟通渠道
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general questions and community support
- **Code Reviews**: For technical discussions and feedback

**GitHub Issues**：用于错误报告和功能请求
**GitHub Discussions**：用于一般问题和社区支持
**代码审查**：用于技术讨论和反馈

### Resources | 资源
- **Documentation**: Check existing documentation first
- **Search**: Look for similar issues or discussions
- **FAQ**: Review frequently asked questions
- **Examples**: Check code examples and tutorials

**文档**：首先检查现有文档
**搜索**：查找类似的问题或讨论
**常见问题**：查看常见问题解答
**示例**：查看代码示例和教程

---

## 📜 Code of Conduct | 行为准则

### Our Pledge | 我们的承诺
- **Inclusive**: Welcome contributions from everyone
- **Respectful**: Treat all contributors with respect
- **Collaborative**: Foster a collaborative environment
- **Supportive**: Help others learn and grow

**包容性**：欢迎所有人的贡献
**尊重**：尊重所有贡献者
**协作**：培养协作环境
**支持**：帮助他人学习和成长

### Expected Behavior | 预期行为
- **Professional**: Maintain professional communication
- **Constructive**: Provide constructive feedback
- **Patient**: Be patient with newcomers
- **Open-minded**: Consider different perspectives

**专业**：保持专业沟通
**建设性**：提供建设性反馈
**耐心**：对新人保持耐心
**开放**：考虑不同观点

---

## 🔄 Release Process | 发布流程

### Version Management | 版本管理
- **Semantic Versioning**: Follow semantic versioning (MAJOR.MINOR.PATCH)
- **Changelog**: Maintain detailed changelog
- **Release Notes**: Provide comprehensive release notes
- **Tagging**: Use proper Git tags for releases

**语义化版本**：遵循语义化版本（主版本.次版本.补丁版本）
**更新日志**：维护详细的更新日志
**发布说明**：提供全面的发布说明
**标记**：为发布使用适当的Git标记

### Deployment | 部署
- **Testing**: Thorough testing before release
- **Documentation**: Update all documentation
- **Announcement**: Announce releases appropriately
- **Monitoring**: Monitor post-release issues

**测试**：发布前彻底测试
**文档**：更新所有文档
**公告**：适当发布公告
**监控**：监控发布后问题

---

## 📧 Contact | 联系方式

### Questions | 问题
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For general questions
- **Email**: For private or sensitive matters (if provided)

**GitHub Issues**：用于错误和功能请求
**GitHub Discussions**：用于一般问题
**电子邮件**：用于私人或敏感事务（如果提供）

### Feedback | 反馈
- **Constructive**: Provide constructive, actionable feedback
- **Specific**: Be specific about what works and what doesn't
- **Reproducible**: Include steps to reproduce issues
- **Polite**: Maintain polite and professional communication

**建设性**：提供建设性、可操作的反馈
**具体**：具体说明什么有效，什么无效
**可重现**：包含重现问题的步骤
**礼貌**：保持礼貌和专业的沟通

---

<div align="center">

**Thank you for contributing to the Anti-Surveillance Userscript!**

**感谢您对反监控用户脚本的贡献！**

**Your contributions help make the web more private and secure.**

**您的贡献有助于使网络更加私密和安全。**

</div>