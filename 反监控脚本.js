// ==UserScript==
// @name         反监控脚本
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  防止网页监控用户行为，默认关闭所有拦截项，支持虚拟鼠标高级设置
// @author       DHF
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    // 调试级别定义
    const DEBUG_LEVELS = {
        ERROR: 0,    // 仅错误信息
        WARN: 1,     // 警告信息  
        INFO: 2,     // 一般信息
        DEBUG: 3,    // 调试信息
        VERBOSE: 4   // 详细信息
    };

    // 调试级别映射
    const DEBUG_LEVEL_NAMES = {
        'ERROR': DEBUG_LEVELS.ERROR,
        'WARN': DEBUG_LEVELS.WARN,
        'INFO': DEBUG_LEVELS.INFO,
        'DEBUG': DEBUG_LEVELS.DEBUG,
        'VERBOSE': DEBUG_LEVELS.VERBOSE
    };

    /**
     * 智能调试日志管理器
     * 提供分级、分类的调试输出控制
     */
    class DebugLogger {
        constructor() {
            this.currentLevel = DEBUG_LEVELS.ERROR;
            this.enabled = false;
            this.categories = {
                virtualMouse: false,
                eventBlocking: false,
                deviceInfo: false,
                config: false,
                animation: false
            };
            this.consoleOnly = true;
            this.timestamp = true;
        }

        /**
         * 更新调试配置
         */
        updateConfig(config) {
            if (!config) return;
            
            this.enabled = config.enabled || false;
            this.currentLevel = DEBUG_LEVEL_NAMES[config.level] || DEBUG_LEVELS.ERROR;
            this.categories = { ...this.categories, ...config.categories };
            this.consoleOnly = config.consoleOnly !== false;
            this.timestamp = config.timestamp !== false;
        }

        /**
         * 检查是否应该输出日志
         */
        shouldLog(level, category) {
            if (!this.enabled) return false;
            if (level > this.currentLevel) return false;
            if (category && !this.categories[category]) return false;
            return true;
        }

        /**
         * 格式化日志前缀
         */
        formatPrefix(level, category) {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'];
            const levelName = levelNames[level] || 'UNKNOWN';
            const timestamp = this.timestamp ? `[${new Date().toISOString()}] ` : '';
            const categoryStr = category ? `[${category}] ` : '';
            return `${timestamp}[反监控][${levelName}]${categoryStr}`;
        }

        /**
         * 输出日志
         */
        log(level, category, ...args) {
            if (!this.shouldLog(level, category)) return;

            const prefix = this.formatPrefix(level, category);
            const message = args.length === 1 && typeof args[0] === 'string' ? args[0] : args;
            
            switch (level) {
                case DEBUG_LEVELS.ERROR:
                    console.error(prefix, message);
                    break;
                case DEBUG_LEVELS.WARN:
                    console.warn(prefix, message);
                    break;
                case DEBUG_LEVELS.INFO:
                    console.info(prefix, message);
                    break;
                case DEBUG_LEVELS.DEBUG:
                case DEBUG_LEVELS.VERBOSE:
                default:
                    console.log(prefix, message);
                    break;
            }
        }

        // 便捷方法
        error(category, ...args) { this.log(DEBUG_LEVELS.ERROR, category, ...args); }
        warn(category, ...args) { this.log(DEBUG_LEVELS.WARN, category, ...args); }
        info(category, ...args) { this.log(DEBUG_LEVELS.INFO, category, ...args); }
        debug(category, ...args) { this.log(DEBUG_LEVELS.DEBUG, category, ...args); }
        verbose(category, ...args) { this.log(DEBUG_LEVELS.VERBOSE, category, ...args); }
    }

    // 创建全局调试日志实例
    const debugLogger = new DebugLogger();

    // 调试模式开关：生产环境设为false，开发调试时设为true
    const DEBUG_MODE = false;
    
    // 统一的日志辅助函数（保持向后兼容）
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log('[反监控]', ...args);
        }
    }

    /**
     * 更新调试配置
     * 从用户配置中读取调试设置并应用到调试日志器
     */
    function updateDebugConfig() {
        try {
            const config = getCurrentSiteConfig().debugConfig || {};
            debugLogger.updateConfig(config);
        } catch (e) {
            console.error('[反监控] 更新调试配置失败:', e);
        }
    }
    
    // 常量定义
    const CONFIG = {
        DEFAULT_MOVE_INTERVAL: 200,
        DEFAULT_CURSOR_SIZE: 40,
        DEFAULT_HOVER_INTERVAL: 1000,
        MAX_LOG_ENTRIES: 1000,
        VIRTUAL_MOUSE_BLACKLIST: [
            'form', 'button', 'input[type="submit"]', 'input[type="button"]',
            'a[href^="javascript:"]', '[onclick*="submit"]', '[onclick*="payment"]',
            '[onclick*="buy"]', '[onclick*="purchase"]', '[onclick*="delete"]',
            '.delete-btn', '.remove-btn', '.confirm-btn'
        ]
    };
    
    // 深拷贝辅助函数
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        return JSON.parse(JSON.stringify(obj));
    }
    
    // 配置加密/解密函数（简单加密）
    function encryptConfig(config) {
        try {
            return btoa(encodeURIComponent(JSON.stringify(config)));
        } catch (e) {
            console.error('[反监控脚本] 配置加密失败:', e);
            return JSON.stringify(config);
        }
    }
    
    function decryptConfig(encrypted) {
        try {
            return JSON.parse(decodeURIComponent(atob(encrypted)));
        } catch (e) {
            console.error('[反监控脚本] 配置解密失败:', e);
            return null;
        }
    }
    
    // 检查元素是否在黑名单中
    function isElementBlacklisted(element) {
        if (!element) return false;
        
        for (const selector of CONFIG.VIRTUAL_MOUSE_BLACKLIST) {
            try {
                if (element.matches && element.matches(selector)) {
                    return true;
                }
                let parent = element.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.matches && parent.matches(selector)) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
            } catch (e) {
            }
        }
        return false;
    }
    
    // 命名空间对象，封装全局变量
    const AntiMonitor = {
        virtualMouse: null,
        virtualMouseInterval: null,
        isRealMousePresent: true,
        hoverPoints: [],
        currentHoverIndex: 0,
        handleRealMouseEnter: null,
        handleRealMouseLeave: null,
        virtualMouseState: {
            randomAngle: null,
            clickAngle: null,
            clickModeShouldClick: false,
            smoothAngle: null,
            patternX: null,
            hoverTime: null,
            hoverTargetX: null,
            hoverTargetY: null
        },
        smoothMoveState: {
            currentDisplayX: 0,
            currentDisplayY: 0,
            targetX: 0,
            targetY: 0,
            moveProgress: 0,
            moveSpeed: 0.05,
            maxSpeed: 0.1,
            currentSpeed: 0.02,
            bezierPoints: [],
            bezierProgress: 0,
            isBezierMoving: false
        }
    };
    
    console.log('[反监控脚本] 开始加载...');

    // 初始化虚拟鼠标动画样式
    initVirtualMouseAnimations();

    /**
     * 默认网站配置模板 - 所有拦截项默认关闭
     * 这是每个网站配置的基础模板，定义了所有可配置项的默认值
     */
    const defaultSiteConfig = {
        enabled: false,                          // 该网站是否启用反监控拦截
        showButton: true,                       // 是否显示反监控按钮
        buttonConfig: {
            text: '反监控',                      // 按钮显示文字
            position: 'bottom-right',            // 按钮位置：top-left, top-right, bottom-left, bottom-right, custom
            customX: '20px',                     // 自定义位置的X坐标
            customY: '20px',                     // 自定义位置的Y坐标
            backgroundColor: '#ff4444',          // 按钮背景颜色
            textColor: 'white',                  // 按钮文字颜色
            width: 'auto',                       // 按钮宽度
            height: 'auto',                      // 按钮高度
            padding: '10px',                     // 按钮内边距
            fontSize: '14px',                    // 按钮字体大小
            borderRadius: '4px',                 // 按钮圆角
            opacity: 1,                          // 按钮透明度
            zIndex: '999999'                     // 按钮层级
        },
        pageVisibilityEvents: {
            visibilitychange: false,             // 是否拦截visibilitychange事件
            webkitvisibilitychange: false,       // 是否拦截webkitvisibilitychange事件（浏览器兼容）
            overrideVisibilityState: false       // 是否覆盖visibilityState和hidden属性
        },
        connectivityEvents: {
            enabled: true,                       // 是否启用在线/离线状态检测
            blockOnlineEvent: true,              // 是否拦截online事件
            blockOfflineEvent: true,             // 是否拦截offline事件
            overrideOnlineState: true            // 是否覆盖navigator.onLine属性
        },
        focusEvents: {
            blur: false,                         // 是否拦截blur事件（页面失去焦点）
            focus: false                         // 是否拦截focus事件（页面获得焦点）
        },
        fullscreenEvents: {
            fullscreenchange: false,             // 是否拦截标准全屏事件
            webkitfullscreenchange: false,       // 是否拦截WebKit浏览器全屏事件
            mozfullscreenchange: false,          // 是否拦截Firefox浏览器全屏事件
            msfullscreenchange: false            // 是否拦截IE/Edge浏览器全屏事件
        },
        mouseEvents: {
            mousemove: false,                    // 是否拦截鼠标移动事件
            mousewheel: false,                   // 是否拦截鼠标滚轮事件
            click: false,                        // 是否拦截鼠标点击事件
            hover: false,                        // 是否拦截鼠标悬停事件
            contextmenu: false,                  // 是否拦截右键菜单事件
            dblclick: false,                     // 是否拦截双击事件
            mousedown: false,                    // 是否拦截鼠标按下事件
            mouseup: false                       // 是否拦截鼠标释放事件
        },
        keyboardEvents: {
            keydown: false,                      // 是否拦截按键按下事件
            keyup: false,                        // 是否拦截按键释放事件
            keypress: false,                     // 是否拦截按键按压事件
            input: false                         // 是否拦截输入事件
        },
        windowEvents: {
            resize: false,                       // 是否拦截窗口大小改变事件
            scroll: false,                       // 是否拦截页面滚动事件
            beforeunload: false,                 // 是否拦截页面卸载前事件
            unload: false,                       // 是否拦截页面卸载事件
            load: false,                         // 是否拦截页面加载事件
            error: false,                        // 是否拦截错误事件
            abort: false,                        // 是否拦截中止事件
            pageshow: false,                     // 是否拦截页面显示事件
            pagehide: false                      // 是否拦截页面隐藏事件
        },
        clipboardEvents: {
            copy: false,                         // 是否拦截复制事件
            cut: false,                          // 是否拦截剪切事件
            paste: false,                        // 是否拦截粘贴事件
            beforecopy: false,                   // 是否拦截复制前事件
            beforecut: false,                    // 是否拦截剪切前事件
            beforepaste: false                   // 是否拦截粘贴前事件
        },
        // 新增高级拦截选项
        navigationEvents: {
            enabled: false,                      // 是否启用导航事件拦截
            popstate: false,                     // 是否拦截历史记录改变事件
            hashchange: false,                   // 是否拦截URL哈希值改变事件
            pagehide: false,                     // 是否拦截页面隐藏事件
            pageshow: false                      // 是否拦截页面显示事件
        },
        touchEvents: {
            enabled: false,                      // 是否启用触摸事件拦截
            touchstart: false,                   // 是否拦截触摸开始事件
            touchmove: false,                    // 是否拦截触摸移动事件
            touchend: false,                     // 是否拦截触摸结束事件
            touchcancel: false                   // 是否拦截触摸取消事件
        },
        formEvents: {
            enabled: false,                      // 是否启用表单事件拦截
            change: false,                       // 是否拦截表单元素值改变事件
            input: false,                        // 是否拦截输入事件
            submit: false                        // 是否拦截表单提交事件
        },
        cookieSettings: {
            enabled: false,                      // 是否启用Cookie拦截
            blockAll: false,                     // 是否拦截所有Cookie操作
            blockRules: []                       // Cookie拦截规则
        },
        storageSettings: {
            enabled: false,                      // 是否启用存储拦截
            blockLocalStorage: false,            // 是否拦截localStorage操作
            blockSessionStorage: false,          // 是否拦截sessionStorage操作
            blockIndexedDB: false,               // 是否拦截IndexedDB操作
            blockCache: false                     // 是否拦截Cache API操作
        },
        deviceInfo: {
            enabled: false,                      // 是否拦截设备信息获取
            navigatorProperties: false,          // 是否拦截navigator属性访问
            screenInfo: false,                   // 是否拦截屏幕信息访问
            emulateDevice: false,                // 是否模拟特定设备信息
            deviceType: 'desktop',               // 设备类型：desktop（桌面端）、mobile（移动端）、tablet（平板）、custom（自定义）
            customDevice: {
                userAgent: '',                   // 自定义User-Agent
                platform: '',                    // 自定义平台
                screenWidth: 0,                  // 自定义屏幕宽度
                screenHeight: 0,                 // 自定义屏幕高度
                availWidth: 0,                   // 自定义可用宽度
                availHeight: 0                   // 自定义可用高度
            }
        },
        virtualMouse: {
            enabled: false,                      // 是否启用虚拟鼠标
            activateOnLeave: false,              // 当真实鼠标离开页面时是否激活虚拟鼠标
            deactivateOnEnter: false,            // 当真实鼠标进入页面时是否停用虚拟鼠标
            showCursor: false,                   // 是否显示虚拟鼠标光标
            showCursorAlways: false,             // 是否始终显示虚拟鼠标光标
            cursorColor: '#ff0000',              // 虚拟鼠标光标的颜色
            cursorSize: 10,                      // 虚拟鼠标光标的大小
            cursorOpacity: 0.7,                  // 虚拟鼠标光标的透明度
            enhancedVisual: true,                // 是否启用增强视觉效果
            pathMode: 'random',                  // 移动路径模式：random（随机）、smooth（平滑）、pattern（模式）、hover（悬停）
            moveSpeed: 5,                        // 移动速度
            moveInterval: 200,                    // 移动间隔（毫秒）
            hoverOnly: false,                    // 是否仅使用预设的悬停点
            hoverInterval: 1000,                 // 悬停模式下的移动间隔（毫秒）
            activityArea: 'full',                // 活动区域：full（全屏）、content（内容区）、custom（自定义区域）
            customArea: {                        // 自定义活动区域坐标
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0
            },
            fixedPosition: {                     // 固定位置设置
                enabled: false,                  // 是否启用固定位置
                x: 0,                            // 固定X坐标
                y: 0                             // 固定Y坐标
            },
            animation: {                       // 动画效果配置
                enabled: true,                 // 是否启用动画
                breathing: true,               // 呼吸缩放动画
                pulse: false,                  // 脉冲波纹效果（默认关闭）
                intensity: 'medium',           // 动画强度：low/medium/high
                duration: 2000,                // 动画周期（毫秒）
                performanceMode: 'auto'        // 性能模式：auto/high/low
            },
            debugConfig: {                     // 调试输出配置
                enabled: false,                // 是否启用调试输出
                level: 'ERROR',                // 输出级别：ERROR/WARN/INFO/DEBUG/VERBOSE
                categories: {                  // 分类控制
                    virtualMouse: false,       // 虚拟鼠标相关
                    eventBlocking: false,      // 事件拦截相关
                    deviceInfo: false,         // 设备信息相关
                    config: false,             // 配置相关
                    animation: false           // 动画相关
                },
                consoleOnly: true,             // 仅在控制台显示
                timestamp: true                // 显示时间戳
            }
        }
    };

    /**
     * 默认全局配置
     * 包含所有网站的配置和默认按钮配置
     */
    const defaultGlobalConfig = {
        sites: {},                               // 所有网站的配置，键为网站URL或主机名
        buttonConfig: {
            text: '反监控',                      // 按钮显示文字
            position: 'bottom-right',            // 按钮位置：top-left, top-right, bottom-left, bottom-right, custom
            customX: '20px',                     // 自定义位置的X坐标
            customY: '20px',                     // 自定义位置的Y坐标
            backgroundColor: '#ff4444',          // 按钮背景颜色
            textColor: 'white',                  // 按钮文字颜色
            width: 'auto',                       // 按钮宽度
            height: 'auto',                      // 按钮高度
            padding: '10px',                     // 按钮内边距
            fontSize: '14px',                    // 按钮字体大小
            borderRadius: '4px',                 // 按钮圆角
            opacity: 1,                          // 按钮透明度
            zIndex: '999999'                     // 按钮层级
        },
        currentSiteKey: '',                      // 当前激活的网站配置键
        showButtonByDefault: true               // 是否默认显示反监控按钮
    };

    // 获取保存的配置或使用默认配置
    // 添加兼容性处理，当在普通环境中运行时使用默认配置
    let globalConfig;
    try {
        // 尝试使用GM_getValue获取配置（油猴插件环境）
        if (typeof GM_getValue === 'function') {
            globalConfig = GM_getValue('antiMonitorGlobalConfig', defaultGlobalConfig);
        } else {
            // 普通环境下使用默认配置
            console.log('[反监控脚本] 未检测到油猴环境，使用默认配置');
            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
        }
    } catch (e) {
        console.error('[反监控脚本] 获取配置出错，使用默认配置:', e);
        globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
    }
    
    /**
     * 确保配置结构完整
     * 这个函数检查全局配置是否包含所有必要的配置项，如果缺少则从默认配置中恢复
     */
    function ensureConfigIntegrity() {
        try {
            // 检查全局配置的顶级属性
            for (const key in defaultGlobalConfig) {
                if (!(key in globalConfig)) {
                    globalConfig[key] = defaultGlobalConfig[key];
                    console.log(`[反监控脚本] 修复配置项: ${key}`);
                }
            }
            
            // 检查按钮配置
            for (const key in defaultGlobalConfig.buttonConfig) {
                if (!(key in globalConfig.buttonConfig)) {
                    globalConfig.buttonConfig[key] = defaultGlobalConfig.buttonConfig[key];
                    console.log(`[反监控脚本] 修复按钮配置项: ${key}`);
                }
            }
            
            // 检查所有网站配置的完整性
            for (const siteKey in globalConfig.sites) {
                const siteConfig = globalConfig.sites[siteKey];
                for (const key in defaultSiteConfig) {
                    if (!(key in siteConfig)) {
                        siteConfig[key] = defaultSiteConfig[key];
                        console.log(`[反监控脚本] 修复网站配置项 ${siteKey}: ${key}`);
                    }
                    // 检查嵌套对象配置（如virtualMouse等）
                    if (typeof defaultSiteConfig[key] === 'object' && !Array.isArray(defaultSiteConfig[key])) {
                        // 确保嵌套对象存在
                        if (!siteConfig[key] || typeof siteConfig[key] !== 'object') {
                            siteConfig[key] = defaultSiteConfig[key];
                        }
                        for (const subKey in defaultSiteConfig[key]) {
                            if (!(subKey in siteConfig[key])) {
                                siteConfig[key][subKey] = defaultSiteConfig[key][subKey];
                            }
                        }
                    }
                }
            }
            
            // 保存修复后的配置
            if (typeof GM_setValue === 'function') {
                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                console.log('[反监控脚本] 配置已保存');
            } else {
                // 普通环境下，记录日志但不保存配置
                console.log('[反监控脚本] 未检测到油猴环境，配置不会被保存');
            }
        } catch (e) {
            console.error('[反监控脚本] 配置完整性检查失败:', e);
            // 配置损坏时重置为默认配置
            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
            if (typeof GM_setValue === 'function') {
                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                console.log('[反监控脚本] 配置已重置并保存');
            } else {
                // 普通环境下，记录日志但不保存配置
                console.log('[反监控脚本] 未检测到油猴环境，配置已重置但不会被保存');
            }
        }
    }
    ensureConfigIntegrity(); // 初始化时立即执行配置检查

    // 初始化调试配置（必须在配置定义之后调用）
    updateDebugConfig();

    /**
     * 获取当前网站的配置
     * 根据当前访问的URL查找对应的网站配置
     * 优先使用精确匹配，避免配置混乱
     * 支持普通网站和本地文件
     * @returns {Object} 当前网站的配置对象
     */
    function getCurrentSiteConfig() {
        try {
            // 每次都重新获取当前网站键，确保准确性
            let currentSiteKey = getCurrentSiteKey();
            console.log('[反监控脚本] 获取当前网站键:', currentSiteKey);
            
            // 确保globalConfig.sites存在
            const sitesConfig = (typeof globalConfig === 'object' && globalConfig !== null && 
                              typeof globalConfig.sites === 'object' && globalConfig.sites !== null) ? 
                              globalConfig.sites : {};
            
            // 优先尝试精确匹配当前网站标识符
            if (currentSiteKey && sitesConfig[currentSiteKey]) {
                const siteConfig = sitesConfig[currentSiteKey];
                console.log('[反监控脚本] 精确匹配到网站配置:', currentSiteKey);
                return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
            }
            
            // 如果没有精确匹配，则尝试其他匹配方式（向后兼容）
            const currentHost = window.location.hostname || ''; // 获取当前网站的主机名
            const currentUrl = window.location.href || ''; // 获取当前完整URL
            
            // 尝试匹配精确的URL模式（仅当没有精确匹配时）
            for (const siteKey in sitesConfig) {
                try {
                    // 首先尝试使用正则表达式匹配URL
                    if (typeof siteKey === 'string' && currentUrl && new RegExp(siteKey).test(currentUrl)) {
                        const siteConfig = sitesConfig[siteKey];
                        console.log('[反监控脚本] 通过正则匹配到网站配置:', siteKey);
                        return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
                    }
                } catch (e) {
                    // 正则表达式匹配失败时，尝试使用包含关系匹配
                    // 增强匹配逻辑，支持本地文件路径
                    if (typeof siteKey === 'string' && (currentUrl.includes(siteKey) || currentSiteKey.includes(siteKey))) {
                        const siteConfig = sitesConfig[siteKey];
                        console.log('[反监控脚本] 通过包含关系匹配到网站配置:', siteKey);
                        return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
                    }
                }
            }
            
            // 如果没有找到匹配的配置，返回默认配置的深拷贝，但不自动创建网站配置
            console.log('[反监控脚本] 未找到匹配的网站配置，使用默认配置');
            return JSON.parse(JSON.stringify(defaultSiteConfig));
        } catch (e) {
            console.error('[反监控脚本] 获取当前网站配置失败:', e);
            // 出错时返回默认配置的深拷贝
            return JSON.parse(JSON.stringify(defaultSiteConfig));
        }
    }

    /**
     * 获取当前网站需要拦截的事件列表
     */
    function getEventsToBlock() {
        try {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.enabled) return [];
            
            const events = [];

            // 页面可见性事件
            if (siteConfig.pageVisibilityEvents.visibilitychange) {
                events.push('visibilitychange');
            }
            if (siteConfig.pageVisibilityEvents.webkitvisibilitychange) {
                events.push('webkitvisibilitychange');
            }

            // 焦点事件
            if (siteConfig.focusEvents.blur) {
                events.push('blur');
            }
            if (siteConfig.focusEvents.focus) {
                events.push('focus');
            }

            // 全屏事件
            if (siteConfig.fullscreenEvents.fullscreenchange) {
                events.push('fullscreenchange');
            }
            if (siteConfig.fullscreenEvents.webkitfullscreenchange) {
                events.push('webkitfullscreenchange');
            }
            if (siteConfig.fullscreenEvents.mozfullscreenchange) {
                events.push('mozfullscreenchange');
            }
            if (siteConfig.fullscreenEvents.msfullscreenchange) {
                events.push('msfullscreenchange');
            }

            // 鼠标事件
            if (siteConfig.mouseEvents.mousemove) {
                events.push('mousemove');
            }
            if (siteConfig.mouseEvents.mousewheel) {
                events.push('mousewheel');
                events.push('DOMMouseScroll'); // DOMMouseScroll与mousewheel功能类似，一并拦截
                events.push('wheel'); // 标准滚轮事件
            }
            if (siteConfig.mouseEvents.click) {
                events.push('click');
            }
            if (siteConfig.mouseEvents.dblclick) {
                events.push('dblclick');
            }
            if (siteConfig.mouseEvents.contextmenu) {
                events.push('contextmenu');
            }
            if (siteConfig.mouseEvents.mousedown) {
                events.push('mousedown');
            }
            if (siteConfig.mouseEvents.mouseup) {
                events.push('mouseup');
            }
            if (siteConfig.mouseEvents.hover) {
                events.push('mouseover');
                events.push('mouseout');
                events.push('mouseenter');
                events.push('mouseleave');
            }

            // 键盘事件
            if (siteConfig.keyboardEvents.keydown) {
                events.push('keydown');
            }
            if (siteConfig.keyboardEvents.keyup) {
                events.push('keyup');
            }
            if (siteConfig.keyboardEvents.keypress) {
                events.push('keypress');
            }
            if (siteConfig.keyboardEvents.input) {
                events.push('input');
            }

            // 窗口事件
            if (siteConfig.windowEvents.resize) {
                events.push('resize');
            }
            if (siteConfig.windowEvents.scroll) {
                events.push('scroll');
            }
            if (siteConfig.windowEvents.beforeunload) {
                events.push('beforeunload');
            }
            if (siteConfig.windowEvents.unload) {
                events.push('unload');
            }
            if (siteConfig.windowEvents.load) {
                events.push('load');
            }
            if (siteConfig.windowEvents.error) {
                events.push('error');
            }
            if (siteConfig.windowEvents.abort) {
                events.push('abort');
            }
            if (siteConfig.windowEvents.pageshow) {
                events.push('pageshow');
            }
            if (siteConfig.windowEvents.pagehide) {
                events.push('pagehide');
            }

            // 剪贴板事件
            if (siteConfig.clipboardEvents.copy) {
                events.push('copy');
            }
            if (siteConfig.clipboardEvents.cut) {
                events.push('cut');
            }
            if (siteConfig.clipboardEvents.paste) {
                events.push('paste');
            }
            if (siteConfig.clipboardEvents.beforecopy) {
                events.push('beforecopy');
            }
            if (siteConfig.clipboardEvents.beforecut) {
                events.push('beforecut');
            }
            if (siteConfig.clipboardEvents.beforepaste) {
                events.push('beforepaste');
            }

            // 新增导航事件拦截
            if (siteConfig.navigationEvents && siteConfig.navigationEvents.enabled) {
                if (siteConfig.navigationEvents.popstate) {
                    events.push('popstate');
                }
                if (siteConfig.navigationEvents.hashchange) {
                    events.push('hashchange');
                }
                if (siteConfig.navigationEvents.pagehide) {
                    events.push('pagehide');
                }
                if (siteConfig.navigationEvents.pageshow) {
                    events.push('pageshow');
                }
            }

            // 新增触摸事件拦截
            if (siteConfig.touchEvents && siteConfig.touchEvents.enabled) {
                if (siteConfig.touchEvents.touchstart) {
                    events.push('touchstart');
                }
                if (siteConfig.touchEvents.touchmove) {
                    events.push('touchmove');
                }
                if (siteConfig.touchEvents.touchend) {
                    events.push('touchend');
                }
                if (siteConfig.touchEvents.touchcancel) {
                    events.push('touchcancel');
                }
            }

            // 新增表单事件拦截
            if (siteConfig.formEvents && siteConfig.formEvents.enabled) {
                if (siteConfig.formEvents.change) {
                    events.push('change');
                }
                if (siteConfig.formEvents.input) {
                    events.push('input');
                }
                if (siteConfig.formEvents.submit) {
                    events.push('submit');
                }
            }

            // 在线/离线状态事件拦截 - 始终拦截，确保只报告在线状态
            events.push('online');
            events.push('offline');

            return events;
        } catch (e) {
            console.error('[反监控脚本] 获取事件列表失败:', e);
            return [];
        }
    }

    /**
     * 检查当前网站是否启用拦截功能
     */
    function isSiteEnabled() {
        try {
            return getCurrentSiteConfig().enabled;
        } catch (e) {
            console.error('[反监控脚本] 检查启用状态失败:', e);
            return true; // 出错时默认启用
        }
    }

    /**
     * 创建统一的navigator代理
     * 合并处理所有需要拦截的navigator属性
     */
    function createUnifiedNavigatorProxy() {
        try {
            const siteConfig = getCurrentSiteConfig();
            const deviceInfoConfig = siteConfig.deviceInfo || {};
            const connectivityConfig = siteConfig.connectivityEvents || {};
            
            // 检查是否需要创建navigator代理
            const needsDeviceInfoProxy = deviceInfoConfig.enabled && (deviceInfoConfig.navigatorProperties || deviceInfoConfig.emulateDevice);
            const needsConnectivityProxy = connectivityConfig.enabled && connectivityConfig.overrideOnlineState;
            
            if (!needsDeviceInfoProxy && !needsConnectivityProxy) return; // 不需要代理
            
            // 获取设备信息（如果需要）
            let currentDeviceInfo = null;
            let deviceType = 'desktop';
            
            if (needsDeviceInfoProxy) {
                // 获取设备模拟配置
                const emulateDevice = deviceInfoConfig.emulateDevice || false;
                deviceType = deviceInfoConfig.deviceType || 'desktop';
                const customDevice = deviceInfoConfig.customDevice || {};
                
                // 根据设备类型设置设备信息
                const deviceInfo = {
                    desktop: {
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        platform: 'Win32',
                        screenWidth: 1920,
                        screenHeight: 1080,
                        availWidth: 1920,
                        availHeight: 1040
                    },
                    mobile: {
                        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
                        platform: 'Linux armv8l',
                        screenWidth: 360,
                        screenHeight: 780,
                        availWidth: 360,
                        availHeight: 720
                    },
                    tablet: {
                        userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/92.0.4515.131 Mobile/15E148 Safari/604.1',
                        platform: 'iPad',
                        screenWidth: 1024,
                        screenHeight: 1366,
                        availWidth: 1024,
                        availHeight: 1326
                    }
                };
                
                // 获取当前要使用的设备信息
                if (emulateDevice && deviceType === 'custom' && customDevice) {
                    currentDeviceInfo = {
                        userAgent: customDevice.userAgent || deviceInfo.desktop.userAgent,
                        platform: customDevice.platform || deviceInfo.desktop.platform,
                        screenWidth: customDevice.screenWidth || deviceInfo.desktop.screenWidth,
                        screenHeight: customDevice.screenHeight || deviceInfo.desktop.screenHeight,
                        availWidth: customDevice.availWidth || deviceInfo.desktop.availWidth,
                        availHeight: customDevice.availHeight || deviceInfo.desktop.availHeight
                    };
                } else if (emulateDevice && deviceInfo[deviceType]) {
                    currentDeviceInfo = deviceInfo[deviceType];
                } else {
                    // 默认使用桌面设备信息
                    currentDeviceInfo = deviceInfo.desktop;
                }
            }
            
            // 创建原始navigator对象的代理
            const navigatorProxy = new Proxy(window.navigator, {
                get(target, prop) {
                    // 处理在线/离线状态拦截 - 始终返回在线状态
                    if (prop === 'onLine') {
                        debugLog('设备处于在线状态');
                        return true; // 始终返回在线状态
                    }
                    
                    // 处理设备信息拦截
                    if (needsDeviceInfoProxy) {
                        // 对于可能泄露隐私的敏感属性，返回通用值或模拟数据
                        const sensitiveProps = [
                            'userAgent', 'appVersion', 'platform', 'language', 'languages',
                            'plugins', 'mimeTypes', 'hardwareConcurrency', 'deviceMemory'
                        ];
                        
                        if (sensitiveProps.includes(prop)) {
                            // 只输出正常运行情况，不输出拦截信息
                            return currentDeviceInfo.userAgent;
                        }
                    }
                    
                    // 非敏感属性，返回真实值
                    return Reflect.get(target, prop);
                }
            });
            
            // 覆盖原始navigator对象
            Object.defineProperty(window, 'navigator', {
                configurable: true,
                enumerable: true,
                get: function() { return navigatorProxy; }
            });
            
            console.log('[反监控] 已创建统一的navigator代理');
        } catch (e) {
            console.error('[反监控脚本] 创建navigator代理失败:', e);
        }
    }
    
    /**
     * 检查是否需要拦截指定事件
     * @param {string} eventType - 事件类型
     * @param {EventTarget} target - 事件目标
     * @returns {boolean} 是否需要拦截
     */
    function shouldBlockEvent(eventType, target) {
        try {
            // 始终拦截online和offline事件，确保只报告在线状态
            if (eventType === 'online' || eventType === 'offline') {
                // 只输出在线状态的正常运行情况
                console.log('[反监控] 设备处于在线状态');
                return true;
            }
            
            const siteConfig = getCurrentSiteConfig();
            const eventsToBlock = getEventsToBlock();
            
            // 基础事件拦截检查
            if (eventsToBlock.includes(eventType)) {
                return true;
            }
            
            // 高级拦截规则检查
            if (siteConfig.advancedBlocking && siteConfig.advancedBlocking.enabled && siteConfig.advancedBlocking.rules) {
                for (const rule of siteConfig.advancedBlocking.rules) {
                    if (!rule.enabled) continue;
                    
                    // 事件类型匹配
                    if (rule.eventType && rule.eventType !== eventType) {
                        continue;
                    }
                    
                    // 正则表达式匹配目标
                    if (rule.targetRegex) {
                        try {
                            const regex = new RegExp(rule.targetRegex);
                            const targetString = target ? (target.tagName ? target.tagName.toLowerCase() : String(target)) : '';
                            if (regex.test(targetString)) {
                                return true;
                            }
                        } catch (e) {
                            console.error('[反监控] 正则表达式匹配失败:', e);
                        }
                    }
                    
                    // 元素选择器匹配
                    if (rule.selector && target && target.matches) {
                        try {
                            if (target.matches(rule.selector)) {
                                return true;
                            }
                        } catch (e) {
                            console.error('[反监控] 选择器匹配失败:', e);
                        }
                    }
                    
                    // 属性匹配
                    if (rule.attributes && target && target.hasAttribute) {
                        let allAttributesMatch = true;
                        for (const [attr, value] of Object.entries(rule.attributes)) {
                            if (!target.hasAttribute(attr)) {
                                allAttributesMatch = false;
                                break;
                            }
                            if (value && target.getAttribute(attr) !== value) {
                                allAttributesMatch = false;
                                break;
                            }
                        }
                        if (allAttributesMatch) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        } catch (e) {
            console.error('[反监控] 事件拦截规则检查失败:', e);
            return false;
        }
    }
    
    /**
     * 拦截事件监听器
     * 这是脚本的核心功能之一，通过重写浏览器原生的事件监听机制来拦截指定的事件
     */
    function blockEventListeners() {
        try {
            // 如果当前网站未启用拦截功能，则直接返回
            if (!isSiteEnabled()) return;

            // 保存原始的addEventListener方法，以便后续调用
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            
            // 重写addEventListener方法，实现事件拦截
            EventTarget.prototype.addEventListener = function(eventName, listener, options) {
                // 统计总事件数
                blockStats.incrementTotal(eventName);
                
                // 检查是否需要拦截
                if (shouldBlockEvent(eventName, this)) {
                    // 统计拦截事件数
                    blockStats.incrementBlocked(eventName);
                    
                    // 记录日志
                    blockLog.log(eventName, this, '拦截事件监听', {
                        listenerType: typeof listener,
                        options: options || {}
                    });
                    
                    return; // 不执行原始的事件监听，达到拦截目的
                }
                
                // 对于不拦截的事件，执行原始的监听方法
                return originalAddEventListener.call(this, eventName, listener, options);
            };

            // 拦截visibilityState和hidden属性（如果在配置中启用了此功能）
            const siteConfig = getCurrentSiteConfig();
            if (siteConfig.pageVisibilityEvents.overrideVisibilityState) {
                // 重写document的visibilityState属性，始终返回"visible"
                // 添加configurable和enumerable选项以确保属性可以被安全地重新定义
                try {
                    Object.defineProperty(document, 'visibilityState', {
                        configurable: true,
                        enumerable: true,
                        get: function() {
                            blockLog.log('visibilityState', document, '拦截属性获取');
                            blockStats.incrementTotal('visibilityState');
                            blockStats.incrementBlocked('visibilityState');
                            return 'visible'; // 让网站认为页面始终可见
                        }
                    });
                } catch (e) {
                    blockLog.log('visibilityState', document, '属性重写失败', { error: e.message });
                    console.warn('[反监控脚本] 无法重新定义visibilityState属性:', e);
                }

                // 重写document的hidden属性，始终返回false
                // 添加configurable和enumerable选项以确保属性可以被安全地重新定义
                try {
                    Object.defineProperty(document, 'hidden', {
                        configurable: true,
                        enumerable: true,
                        get: function() {
                            blockLog.log('hidden', document, '拦截属性获取');
                            blockStats.incrementTotal('hidden');
                            blockStats.incrementBlocked('hidden');
                            return false; // 让网站认为页面没有被隐藏
                        }
                    });
                } catch (e) {
                    blockLog.log('hidden', document, '属性重写失败', { error: e.message });
                    console.warn('[反监控脚本] 无法重新定义hidden属性:', e);
                }
            }
            
            // 增强事件拦截：拦截document.createEvent和new Event()
            const originalCreateEvent = document.createEvent;
            document.createEvent = function(eventType) {
                blockStats.incrementTotal('createEvent');
                
                const eventsToBlock = getEventsToBlock();
                if (eventsToBlock.some(blockedEvent => eventType.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                    blockStats.incrementBlocked('createEvent');
                    blockLog.log(eventType, document, '拦截createEvent');
                    // 返回一个模拟事件对象，但不会触发实际行为
                    const mockEvent = {
                        type: eventType,
                        initEvent: function() {},
                        preventDefault: function() {},
                        stopPropagation: function() {}
                    };
                    return mockEvent;
                }
                return originalCreateEvent.call(this, eventType);
            };
            
            // 拦截Event构造函数
            const originalEvent = window.Event;
            try {
                window.Event = function(type, eventInitDict) {
                    blockStats.incrementTotal('EventConstructor');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('EventConstructor');
                        blockLog.log(type, window, '拦截Event构造函数');
                        // 返回一个模拟事件对象
                        const mockEvent = originalEvent.call(this, 'mock-event', eventInitDict);
                        Object.defineProperty(mockEvent, 'type', {
                            get: function() { return type; },
                            configurable: true
                        });
                        return mockEvent;
                    }
                    return new originalEvent(type, eventInitDict);
                };
                
                // 保持原型链
                window.Event.prototype = originalEvent.prototype;
            } catch (e) {
                blockLog.log('EventConstructor', window, '构造函数重写失败', { error: e.message });
                console.warn('[反监控脚本] 无法重写Event构造函数:', e);
            }
            
            // 拦截CustomEvent构造函数
            const originalCustomEvent = window.CustomEvent;
            try {
                window.CustomEvent = function(type, eventInitDict) {
                    blockStats.incrementTotal('CustomEventConstructor');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('CustomEventConstructor');
                        blockLog.log(type, window, '拦截CustomEvent构造函数');
                        // 返回一个模拟事件对象
                        const mockEvent = originalCustomEvent.call(this, 'mock-event', eventInitDict);
                        Object.defineProperty(mockEvent, 'type', {
                            get: function() { return type; },
                            configurable: true
                        });
                        return mockEvent;
                    }
                    return new originalCustomEvent(type, eventInitDict);
                };
                
                // 保持原型链
                window.CustomEvent.prototype = originalCustomEvent.prototype;
            } catch (e) {
                blockLog.log('CustomEventConstructor', window, '构造函数重写失败', { error: e.message });
                console.warn('[反监控脚本] 无法重写CustomEvent构造函数:', e);
            }
            
            // 拦截事件派发
            const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
            EventTarget.prototype.dispatchEvent = function(event) {
                if (event) {
                    blockStats.incrementTotal('dispatchEvent');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => event.type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('dispatchEvent');
                        blockLog.log(event.type, this, '拦截事件派发');
                        return true; // 返回true表示事件已处理，但实际上什么也没做
                    }
                }
                return originalDispatchEvent.call(this, event);
            };
            
            // 拦截window事件监听器
            const originalWindowAddEventListener = window.addEventListener;
            window.addEventListener = function(eventName, listener, options) {
                blockStats.incrementTotal('windowEvent');
                
                if (shouldBlockEvent(eventName, window)) {
                    blockStats.incrementBlocked('windowEvent');
                    blockLog.log(eventName, window, '拦截window事件监听');
                    return;
                }
                return originalWindowAddEventListener.call(this, eventName, listener, options);
            };
            
            // 拦截document事件监听器
            const originalDocumentAddEventListener = document.addEventListener;
            document.addEventListener = function(eventName, listener, options) {
                blockStats.incrementTotal('documentEvent');
                
                if (shouldBlockEvent(eventName, document)) {
                    blockStats.incrementBlocked('documentEvent');
                    blockLog.log(eventName, document, '拦截document事件监听');
                    return;
                }
                return originalDocumentAddEventListener.call(this, eventName, listener, options);
            };
            
            // 增强防绕过机制：拦截removeEventListener以防止恢复被拦截的事件
            const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
            EventTarget.prototype.removeEventListener = function(eventName, listener, options) {
                // 记录但不阻止removeEventListener调用
                blockLog.log(eventName, this, '调用removeEventListener');
                return originalRemoveEventListener.call(this, eventName, listener, options);
            };
            
            // 增强防绕过机制：拦截事件属性赋值（如onclick）
            const eventProperties = ['onclick', 'onload', 'onunload', 'onmousemove', 'onmouseover', 'onmouseout',
                                   'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress', 'onchange',
                                   'onsubmit', 'onfocus', 'onblur', 'onresize', 'onscroll', 'onerror', 'oncontextmenu'];
            
            for (const prop of eventProperties) {
                Object.defineProperty(EventTarget.prototype, prop, {
                    set: function(value) {
                        const eventType = prop.substring(2); // 移除"on"前缀
                        blockStats.incrementTotal('eventProperty');
                        
                        if (shouldBlockEvent(eventType, this)) {
                            blockStats.incrementBlocked('eventProperty');
                            blockLog.log(eventType, this, `拦截事件属性赋值: ${prop}`);
                            // 不执行赋值，防止事件被绑定
                            return;
                        }
                        // 正常执行赋值
                        this[`__${prop}`] = value;
                    },
                    get: function() {
                        return this[`__${prop}`];
                    },
                    configurable: true
                });
            }

            console.log('[反监控] 已启用增强拦截功能');
        } catch (e) {
            blockLog.log('system', null, '拦截功能初始化失败', { error: e.message }, 'error');
            console.error('[反监控脚本] 事件拦截功能失败:', e);
        }
    }
    
    /**
     * Cookie及存储拦截功能
     */
    function blockCookieAndStorage() {
        try {
            if (!isSiteEnabled()) return;
            
            debugLog('启用Cookie及存储拦截');
            
            // 拦截document.cookie
            const originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
            if (originalCookieDescriptor && originalCookieDescriptor.configurable) {
                Object.defineProperty(document, 'cookie', {
                    get: function() {
                        const cookies = originalCookieDescriptor.get.call(this);
                        blockLog.log('cookie', document, '读取Cookie', { cookies });
                        blockStats.incrementTotal('cookie-read');
                        return cookies;
                    },
                    set: function(value) {
                        blockLog.log('cookie', document, '设置Cookie', { cookie: value });
                        blockStats.incrementTotal('cookie-write');
                        
                        // 检查是否需要拦截Cookie设置
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.cookieSettings && siteConfig.cookieSettings.blockAll) {
                            blockStats.incrementBlocked('cookie-write');
                            return; // 拦截Cookie设置
                        }
                        
                        // 基于规则的Cookie拦截
                        if (siteConfig.cookieSettings && siteConfig.cookieSettings.blockRules) {
                            const rules = siteConfig.cookieSettings.blockRules;
                            for (const rule of rules) {
                                if (rule.enabled) {
                                    // 正则表达式匹配
                                    if (rule.regex) {
                                        try {
                                            const regex = new RegExp(rule.regex);
                                            if (regex.test(value)) {
                                                blockStats.incrementBlocked('cookie-write');
                                                return; // 拦截匹配的Cookie
                                            }
                                        } catch (e) {
                                            console.error('[反监控] Cookie正则匹配失败:', e);
                                        }
                                    }
                                    // 名称匹配
                                    if (rule.name && value.startsWith(rule.name + '=')) {
                                        blockStats.incrementBlocked('cookie-write');
                                        return; // 拦截匹配的Cookie
                                    }
                                }
                            }
                        }
                        
                        return originalCookieDescriptor.set.call(this, value);
                    },
                    configurable: true,
                    enumerable: true
                });
                
                blockLog.log('system', document, '成功拦截document.cookie');
            }
            
            // 拦截localStorage
            const originalLocalStorage = window.localStorage;
            if (originalLocalStorage) {
                window.localStorage = new Proxy(originalLocalStorage, {
                    get: function(target, prop) {
                        if (typeof target[prop] === 'function') {
                            return function(...args) {
                                blockLog.log('localStorage', window, `调用${prop}方法`, { args });
                                blockStats.incrementTotal(`localStorage-${prop}`);
                                
                                // 检查是否需要拦截localStorage操作
                                const siteConfig = getCurrentSiteConfig();
                                if (siteConfig.storageSettings && siteConfig.storageSettings.blockLocalStorage) {
                                    blockStats.incrementBlocked(`localStorage-${prop}`);
                                    return prop === 'getItem' ? null : undefined;
                                }
                                
                                return target[prop].apply(target, args);
                            };
                        }
                        return target[prop];
                    }
                });
                
                blockLog.log('system', window, '成功拦截localStorage');
            }
            
            // 拦截sessionStorage
            const originalSessionStorage = window.sessionStorage;
            if (originalSessionStorage) {
                window.sessionStorage = new Proxy(originalSessionStorage, {
                    get: function(target, prop) {
                        if (typeof target[prop] === 'function') {
                            return function(...args) {
                                blockLog.log('sessionStorage', window, `调用${prop}方法`, { args });
                                blockStats.incrementTotal(`sessionStorage-${prop}`);
                                
                                // 检查是否需要拦截sessionStorage操作
                                const siteConfig = getCurrentSiteConfig();
                                if (siteConfig.storageSettings && siteConfig.storageSettings.blockSessionStorage) {
                                    blockStats.incrementBlocked(`sessionStorage-${prop}`);
                                    return prop === 'getItem' ? null : undefined;
                                }
                                
                                return target[prop].apply(target, args);
                            };
                        }
                        return target[prop];
                    }
                });
                
                blockLog.log('system', window, '成功拦截sessionStorage');
            }
            
            // 拦截IndexedDB
            const originalIndexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
            if (originalIndexedDB) {
                window.indexedDB = {
                    open: function(name, version) {
                        blockLog.log('indexedDB', window, '打开数据库', { name, version });
                        blockStats.incrementTotal('indexedDB-open');
                        
                        // 检查是否需要拦截IndexedDB操作
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.storageSettings && siteConfig.storageSettings.blockIndexedDB) {
                            blockStats.incrementBlocked('indexedDB-open');
                            // 返回一个模拟的IDBOpenDBRequest
                            return {
                                result: null,
                                onerror: null,
                                onsuccess: null,
                                onupgradeneeded: null,
                                readyState: 'done',
                                error: new Error('IndexedDB access blocked by anti-monitor script')
                            };
                        }
                        
                        return originalIndexedDB.open.apply(this, arguments);
                    },
                    deleteDatabase: function(name) {
                        blockLog.log('indexedDB', window, '删除数据库', { name });
                        blockStats.incrementTotal('indexedDB-delete');
                        
                        // 检查是否需要拦截IndexedDB操作
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.storageSettings && siteConfig.storageSettings.blockIndexedDB) {
                            blockStats.incrementBlocked('indexedDB-delete');
                            // 返回一个模拟的IDBOpenDBRequest
                            return {
                                result: null,
                                onerror: null,
                                onsuccess: null,
                                readyState: 'done',
                                error: new Error('IndexedDB access blocked by anti-monitor script')
                            };
                        }
                        
                        return originalIndexedDB.deleteDatabase.apply(this, arguments);
                    },
                    cmp: originalIndexedDB.cmp,
                    databases: function() {
                        blockLog.log('indexedDB', window, '获取数据库列表');
                        blockStats.incrementTotal('indexedDB-databases');
                        return originalIndexedDB.databases.apply(this, arguments);
                    }
                };
                
                blockLog.log('system', window, '成功拦截IndexedDB');
            }
        } catch (e) {
            console.error('[反监控] Cookie及存储拦截失败:', e);
        }
    }
    
    /**
     * 拦截设备信息获取
     * 通过覆盖navigator和screen对象的属性来保护设备信息
     */
    function blockDeviceInfoAccess() {
        try {
            // 如果当前网站未启用拦截功能，则直接返回
            if (!isSiteEnabled()) return;
            
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.deviceInfo || !siteConfig.deviceInfo.enabled) {
                return; // 如果不启用设备信息拦截，则不执行后续操作
            }
            
            // 获取设备模拟配置
            const emulateDevice = siteConfig.deviceInfo.emulateDevice || false;
            const deviceType = siteConfig.deviceInfo.deviceType || 'desktop';
            const customDevice = siteConfig.deviceInfo.customDevice || {};
            
            // 根据设备类型设置设备信息
            const deviceInfo = {
                desktop: {
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    platform: 'Win32',
                    screenWidth: 1920,
                    screenHeight: 1080,
                    availWidth: 1920,
                    availHeight: 1040
                },
                mobile: {
                    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
                    platform: 'Linux armv8l',
                    screenWidth: 360,
                    screenHeight: 780,
                    availWidth: 360,
                    availHeight: 720
                },
                tablet: {
                    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/92.0.4515.131 Mobile/15E148 Safari/604.1',
                    platform: 'iPad',
                    screenWidth: 1024,
                    screenHeight: 1366,
                    availWidth: 1024,
                    availHeight: 1326
                }
            };
            
            // 获取当前要使用的设备信息
            let currentDeviceInfo;
            if (emulateDevice && deviceType === 'custom' && customDevice) {
                currentDeviceInfo = {
                    userAgent: customDevice.userAgent || deviceInfo.desktop.userAgent,
                    platform: customDevice.platform || deviceInfo.desktop.platform,
                    screenWidth: customDevice.screenWidth || deviceInfo.desktop.screenWidth,
                    screenHeight: customDevice.screenHeight || deviceInfo.desktop.screenHeight,
                    availWidth: customDevice.availWidth || deviceInfo.desktop.availWidth,
                    availHeight: customDevice.availHeight || deviceInfo.desktop.availHeight
                };
            } else if (emulateDevice && deviceInfo[deviceType]) {
                currentDeviceInfo = deviceInfo[deviceType];
            } else {
                // 默认使用桌面设备信息
                currentDeviceInfo = deviceInfo.desktop;
            }
            
            // navigator属性访问已通过统一的代理函数处理
            // 此处不再重复实现
            
            // 拦截屏幕信息访问
            if (siteConfig.deviceInfo.screenInfo || emulateDevice) {
                // 创建原始screen对象的代理
                const screenProxy = new Proxy(window.screen, {
                    get(target, prop) {
                        // 对于可能泄露隐私的屏幕属性，返回通用值
                        const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
                        
                        if (screenProps.includes(prop)) {
                            console.log(`[反监控] 已拦截screen.${prop}访问`);
                            // 返回模拟值
                            switch(prop) {
                                case 'width':
                                    return currentDeviceInfo.screenWidth;
                                case 'height':
                                    return currentDeviceInfo.screenHeight;
                                case 'availWidth':
                                    return currentDeviceInfo.availWidth;
                                case 'availHeight':
                                    return currentDeviceInfo.availHeight;
                                case 'colorDepth':
                                case 'pixelDepth':
                                    return 24;
                                default:
                                    return 0;
                            }
                        }
                        
                        // 非屏幕尺寸属性，返回真实值
                        return Reflect.get(target, prop);
                    }
                });
                
                // 覆盖原始screen对象
                Object.defineProperty(window, 'screen', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return screenProxy; }
                });
            }
            
            if (emulateDevice) {
                console.log(`[反监控] 已启用设备信息保护功能，并模拟为${deviceType === 'custom' ? '自定义' : deviceType === 'mobile' ? '移动端' : deviceType === 'tablet' ? '平板' : '桌面端'}设备`);
            } else {
                console.log('[反监控] 已启用设备信息保护功能');
            }
        } catch (e) {
            console.error('[反监控脚本] 设备信息保护功能失败:', e);
        }
    }

    /**
     * 虚拟鼠标相关变量声明
     */
    let virtualMouse = null;          // 虚拟鼠标DOM元素引用
    let virtualMouseInterval = null;  // 虚拟鼠标移动定时器
    let isRealMousePresent = true;    // 真实鼠标是否在页面上的标志
    let hoverPoints = [];             // 悬停点数组（用于仅悬停模式）
    let currentHoverIndex = 0;        // 当前悬停点索引
    let handleRealMouseEnter = null;  // 保存鼠标进入事件处理函数引用以便移除
    let handleRealMouseLeave = null;  // 保存鼠标离开事件处理函数引用以便移除
    
    // 虚拟鼠标黑名单 - 避免触发敏感元素
    const VIRTUAL_MOUSE_BLACKLIST = [
        'form', 'button', 'input[type="submit"]', 'input[type="button"]',
        'a[href^="javascript:"]', '[onclick*="submit"]', '[onclick*="payment"]',
        '[onclick*="buy"]', '[onclick*="purchase"]', '[onclick*="delete"]',
        '.delete-btn', '.remove-btn', '.confirm-btn'
    ];
    
    /**
     * 检查元素是否在黑名单中
     * @param {Element} element - 要检查的元素
     * @returns {boolean} 是否在黑名单中
     */
    function isElementBlacklisted(element) {
        if (!element) return false;
        
        for (const selector of VIRTUAL_MOUSE_BLACKLIST) {
            try {
                if (element.matches && element.matches(selector)) {
                    return true;
                }
                // 检查父元素
                let parent = element.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.matches && parent.matches(selector)) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
            } catch (e) {
                // 忽略选择器错误
            }
        }
        return false;
    }
    
    /**
     * 创建虚拟鼠标元素
     * 生成一个在页面上显示的虚拟鼠标光标，并设置其基本样式和行为
     */
    function createVirtualMouse() {
        try {
            // 检查是否在主窗口环境
            const isMainWindow = isInMainWindow();
            console.log('[反监控脚本] 检查主窗口环境:', isMainWindow);
            
            // 如果已存在虚拟鼠标元素，则先移除它
            if (virtualMouse) {
                console.log('[反监控脚本] 移除已存在的虚拟鼠标元素');
                virtualMouse.remove();
            }
            
            // 只在主窗口中创建虚拟鼠标DOM元素
            if (isMainWindow) {
                console.log('[反监控脚本] 在主窗口中创建虚拟鼠标元素');
                // 创建虚拟鼠标的主容器元素
                virtualMouse = document.createElement('div');
                virtualMouse.id = 'virtual-mouse';
                virtualMouse.style.position = 'fixed'; // 固定定位，不受页面滚动影响
                virtualMouse.style.pointerEvents = 'none'; // 不干扰真实鼠标操作
                virtualMouse.style.zIndex = '9999999'; // 确保显示在所有元素上方
                virtualMouse.style.transform = 'translate(-50%, -50%)'; // 使光标中心点对准坐标
                virtualMouse.style.transition = 'none'; // 禁用过渡效果，使移动更流畅
                virtualMouse.style.display = 'block'; // 确保创建时就显示
                virtualMouse.style.visibility = 'visible'; // 确保可见性
                virtualMouse.style.opacity = '1'; // 确保不透明
                virtualMouse.style.width = '40px'; // 设置初始宽度
                virtualMouse.style.height = '40px'; // 设置初始高度
                
                console.log('[反监控脚本] 虚拟鼠标元素样式设置完成');
                
                // 添加鼠标样式元素（包含主光标和点击指示器）
                virtualMouse.innerHTML = `
                    <div class="virtual-mouse-main" style="display: block; position: absolute; top: 0; left: 0;"></div>
                    <div class="virtual-mouse-click"></div>
                `;
                
                console.log('[反监控脚本] 虚拟鼠标HTML内容设置完成');
                
                // 将虚拟鼠标元素添加到页面中
                document.body.appendChild(virtualMouse);
                console.log('[反监控脚本] 虚拟鼠标元素已添加到页面中');
                
                // 立即更新样式确保显示正确
                updateVirtualMouseStyle();
                
                // 添加元素创建后的调试信息
                console.log('[反监控脚本] 虚拟鼠标元素创建完成:', {
                    id: virtualMouse.id,
                    position: virtualMouse.style.position,
                    display: virtualMouse.style.display,
                    zIndex: virtualMouse.style.zIndex
                });
            } else {
                // 在iframe中，创建一个非可视化的虚拟鼠标对象
                console.log('[反监控脚本] 在iframe中，创建非可视化的虚拟鼠标');
                virtualMouse = null; // 不创建DOM元素
            }
            
            // 生成悬停点数组，用于仅悬停模式
            console.log('[反监控脚本] 生成悬停点数组');
            generateHoverPoints();
            
            // 添加调试信息
            console.log('[反监控脚本] 虚拟鼠标创建完成，isMainWindow:', isMainWindow, 'virtualMouse:', virtualMouse);
        } catch (e) {
            console.error('[反监控脚本] 创建虚拟鼠标失败:', e);
        }
    }
    
    /**
     * 生成悬停点数组（用于仅悬停模式）
     */
    function generateHoverPoints() {
        try {
            // 确保 hoverPoints 是一个数组
            if (!Array.isArray(hoverPoints)) {
                hoverPoints = [];
            }
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // 根据活动区域确定范围
            let minX, maxX, minY, maxY;
            
            if (config.activityArea === 'custom') {
                minX = (config.customArea && config.customArea.x1) || 0;
                maxX = (config.customArea && config.customArea.x2) || window.innerWidth;
                minY = (config.customArea && config.customArea.y1) || 0;
                maxY = (config.customArea && config.customArea.y2) || window.innerHeight;
            } else if (config.activityArea === 'content') {
                const contentArea = document.querySelector('main, #content, .content') || document.body;
                const rect = contentArea.getBoundingClientRect();
                minX = rect.left;
                maxX = rect.right;
                minY = rect.top;
                maxY = rect.bottom;
            } else {
                minX = 0;
                maxX = viewportWidth;
                minY = 0;
                maxY = viewportHeight;
            }
            
            // 确保范围值有效
            minX = Math.max(0, minX);
            maxX = Math.max(minX, maxX);
            minY = Math.max(0, minY);
            maxY = Math.max(minY, maxY);
            
            // 生成5个悬停点
            hoverPoints = [];
            for (let i = 0; i < 5; i++) {
                hoverPoints.push({
                    x: minX + Math.random() * (maxX - minX),
                    y: minY + Math.random() * (maxY - minY)
                });
            }
            
            // 如果启用了定点放置，添加定点作为悬停点
            if (config.fixedPosition && config.fixedPosition.enabled) {
                hoverPoints.push({
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                });
            }
            
            // 确保 currentHoverIndex 是一个有效的数字
            if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex) || 
                currentHoverIndex < 0 || currentHoverIndex >= hoverPoints.length) {
                currentHoverIndex = 0;
            }
        } catch (e) {
            console.error('[反监控脚本] 生成悬停点失败:', e);
            // 出错时创建一个默认的悬停点数组，使用随机位置而不是屏幕中心
            hoverPoints = [{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight
            }];
            currentHoverIndex = 0;
        }
    }
    
    /**
     * 更新虚拟鼠标样式
     */
    function updateVirtualMouseStyle() {
        try {
            if (!virtualMouse) return;
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
            const clickIndicator = virtualMouse.querySelector('.virtual-mouse-click');
            
            // 禁用容器的过渡效果，确保实时位置更新
            // 虚拟鼠标移动应该通过JavaScript控制，而不是CSS过渡
            virtualMouse.style.transition = 'none';
            
            console.log('[反监控] 已禁用虚拟鼠标容器过渡效果，确保实时更新');
            
            // 主光标样式 - 使用用户设置的光标大小
            const cursorSize = config.cursorSize || 40; // 直接使用用户设置的值，不再限制范围
            mainCursor.style.width = `${cursorSize}px`;
            mainCursor.style.height = `${cursorSize}px`;
            mainCursor.style.borderRadius = '50%';
            mainCursor.style.backgroundColor = config.cursorColor || '#ff0000';
            mainCursor.style.opacity = Math.max(0.8, Math.min(1, config.cursorOpacity || 0.9));
            mainCursor.style.transition = 'none'; // 禁用主光标的过渡效果，避免抖动
            mainCursor.style.display = 'block'; // 确保主光标显示
            mainCursor.style.position = 'absolute'; // 确保定位正确
            mainCursor.style.top = '0'; // 确保位置正确
            mainCursor.style.left = '0'; // 确保位置正确
            
            // 增强的可视化效果
            if (config.enhancedVisual) {
                mainCursor.style.boxShadow = '0 0 15px rgba(255,0,0,0.9)';
                clickIndicator.style.position = 'absolute';
                clickIndicator.style.width = `${cursorSize * 2}px`;
                clickIndicator.style.height = `${cursorSize * 2}px`;
                clickIndicator.style.borderRadius = '50%';
                clickIndicator.style.border = '3px solid rgba(255,0,0,0.8)';
                clickIndicator.style.top = `-${cursorSize / 2}px`;
                clickIndicator.style.left = `-${cursorSize / 2}px`;
                clickIndicator.style.opacity = '0';
                clickIndicator.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            }
            
            // 确保虚拟鼠标可见 - 强制显示
            const isEnabled = getCurrentSiteConfig().virtualMouse?.enabled || false;
            const isMainWindow = isInMainWindow();
            
            console.log('[反监控] 虚拟鼠标显示状态检查:', {
                isEnabled: isEnabled,
                isMainWindow: isMainWindow,
                virtualMouseExists: !!virtualMouse,
                inDocument: virtualMouse ? document.body.contains(virtualMouse) : false
            });
            
            if (isEnabled && isMainWindow && virtualMouse && document.body.contains(virtualMouse)) {
                virtualMouse.style.display = 'block';
                virtualMouse.style.visibility = 'visible';
                virtualMouse.style.opacity = '1';
            } else {
                virtualMouse.style.display = 'none';
                console.log('[反监控] 虚拟鼠标已隐藏，原因:', {
                    isEnabled: isEnabled,
                    isMainWindow: isMainWindow,
                    virtualMouseExists: !!virtualMouse,
                    inDocument: virtualMouse ? document.body.contains(virtualMouse) : false
                });
            }
            
            // 确保z-index足够高
            virtualMouse.style.zIndex = '9999999';
            
            // 确保容器样式正确
            virtualMouse.style.position = 'fixed';
            virtualMouse.style.pointerEvents = 'none';
            virtualMouse.style.transform = 'translate(-50%, -50%)';
            
            // 应用动画效果
            applyVirtualMouseAnimations(virtualMouse, mainCursor, config);
            
            console.log(`[反监控] 虚拟鼠标样式已更新 - 显示: ${isEnabled}, 大小: ${cursorSize}px, 主光标显示: ${mainCursor.style.display}`);
        } catch (e) {
            console.error('[反监控脚本] 更新虚拟鼠标样式失败:', e);
        }
    }
    
    /**
     * 应用虚拟鼠标动画效果
     * 根据配置动态添加或移除动画类
     */
    function applyVirtualMouseAnimations(virtualMouse, mainCursor, config) {
        try {
            // 获取动画配置
            const animationConfig = config.animation || {};
            const isEnabled = animationConfig.enabled !== false;
            const breathingEnabled = animationConfig.breathing !== false;
            const intensity = animationConfig.intensity || 'medium';
            const performanceMode = animationConfig.performanceMode || 'auto';
            
            // 清除所有动画类
            virtualMouse.classList.remove('virtual-mouse-breathing', 'virtual-mouse-appear', 'virtual-mouse-disappear',
                                       'virtual-mouse-low-intensity', 'virtual-mouse-high-intensity',
                                       'virtual-mouse-performance-low', 'virtual-mouse-performance-high');
            
            if (mainCursor) {
                mainCursor.classList.remove('virtual-mouse-breathing');
            }
            
            if (!isEnabled) {
                debugLogger.debug('animation', '虚拟鼠标动画已禁用');
                return;
            }
            
            // 检测性能模式
            const detectedPerformanceMode = detectPerformanceMode(performanceMode);
            
            // 应用强度级别
            if (intensity === 'low') {
                virtualMouse.classList.add('virtual-mouse-low-intensity');
            } else if (intensity === 'high') {
                virtualMouse.classList.add('virtual-mouse-high-intensity');
            }
            
            // 应用性能模式
            if (detectedPerformanceMode === 'low') {
                virtualMouse.classList.add('virtual-mouse-performance-low');
            } else if (detectedPerformanceMode === 'high') {
                virtualMouse.classList.add('virtual-mouse-performance-high');
            }
            
            // 应用呼吸动画
            if (breathingEnabled && mainCursor && detectedPerformanceMode !== 'minimal') {
                mainCursor.classList.add('virtual-mouse-breathing');
                
                // 设置动画持续时间
                const duration = (animationConfig.duration || 2000) / 1000;
                mainCursor.style.animationDuration = `${duration}s`;
            }
            
            debugLogger.debug('animation', '虚拟鼠标动画已应用:', {
                enabled: isEnabled,
                breathing: breathingEnabled,
                intensity: intensity,
                performanceMode: detectedPerformanceMode,
                duration: animationConfig.duration || 2000
            });
            
        } catch (e) {
            console.error('[反监控] 应用虚拟鼠标动画失败:', e);
        }
    }
    
    /**
     * 检测性能模式
     * 根据设备性能和用户设置自动调整动画复杂度
     */
    function detectPerformanceMode(userMode) {
        if (userMode === 'high') return 'high';
        if (userMode === 'low') return 'low';
        
        // 自动检测模式
        try {
            // 检查硬件并发数
            const concurrency = navigator.hardwareConcurrency || 4;
            
            // 检查设备内存
            const memory = navigator.deviceMemory || 4;
            
            // 检查是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 检查是否启用了减少动画偏好
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            
            if (prefersReducedMotion) {
                return 'minimal';
            }
            
            if (isMobile || concurrency < 4 || memory < 2) {
                return 'low';
            }
            
            if (concurrency >= 8 && memory >= 8) {
                return 'high';
            }
            
            return 'medium';
        } catch (e) {
            console.warn('[反监控] 性能检测失败，使用默认模式:', e);
            return 'medium';
        }
    }
    
    /**
     * 显示点击效果
     */
    function showClickEffect() {
        try {
            if (!virtualMouse) return;
            
            const clickIndicator = virtualMouse.querySelector('.virtual-mouse-click');
            if (clickIndicator) {
                clickIndicator.style.opacity = '1';
                setTimeout(() => {
                    clickIndicator.style.opacity = '0';
                }, 300);
            }
        } catch (e) {
            console.error('[反监控脚本] 显示点击效果失败:', e);
        }
    }
    
    // 创建一个专门的状态对象来存储虚拟鼠标的各种状态变量
    const virtualMouseState = {
        randomAngle: null,
        clickAngle: null,
        clickModeShouldClick: false,
        smoothAngle: null,
        patternX: null,
        hoverTime: null,
        hoverTargetX: null,
        hoverTargetY: null
    };
    
    /**
     * 获取虚拟鼠标的下一个位置
     * 根据配置的路径模式和活动区域计算虚拟鼠标的下一个坐标
     * @param {number} currentX - 当前X坐标
     * @param {number} currentY - 当前Y坐标
     * @returns {Object} 包含新X和Y坐标的对象
     */
    function getNextVirtualMousePosition(currentX, currentY) {
        try {
            // 检查并初始化虚拟鼠标状态变量，确保移动连贯性
            if (virtualMouseState.smoothAngle === null) {
                debugLog('�虚拟鼠标状态变量');
                virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
                virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
                virtualMouseState.clickModeShouldClick = false;
                virtualMouseState.smoothAngle = Math.random() * Math.PI * 2;
                virtualMouseState.patternX = currentX;
                virtualMouseState.hoverTime = 0;
                virtualMouseState.hoverTargetX = currentX;
                virtualMouseState.hoverTargetY = currentY;
                virtualMouseState.lastSpeed = 0; // 新增：上次移动速度
            }
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const viewportWidth = window.innerWidth; // 视口宽度
            const viewportHeight = window.innerHeight; // 视口高度
            
            // 添加调试信息
            console.log('[反监控] 当前配置:', config);
            console.log('[反监控] 当前位置:', {currentX, currentY});
            
            // 如果启用定点放置，直接返回配置的固定位置
            if (config.fixedPosition && config.fixedPosition.enabled) {
                const fixedPos = {
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                };
                console.log('[反监控] 定点放置模式，返回固定位置:', fixedPos);
                return fixedPos;
            }
            
            // 如果是仅悬停模式，返回下一个预设的悬停点
            if (config.hoverOnly && Array.isArray(hoverPoints) && hoverPoints.length > 0) {
                // 确保 currentHoverIndex 是一个有效的数字
                if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex)) {
                    currentHoverIndex = 0;
                }
                
                currentHoverIndex = (currentHoverIndex + 1) % hoverPoints.length; // 循环使用悬停点
                
                // 确保悬停点是有效的对象
                const hoverPoint = hoverPoints[currentHoverIndex];
                if (hoverPoint && typeof hoverPoint === 'object' && 
                    typeof hoverPoint.x === 'number' && !isNaN(hoverPoint.x) &&
                    typeof hoverPoint.y === 'number' && !isNaN(hoverPoint.y)) {
                    console.log('[反监控] 仅悬停模式，返回悬停点:', hoverPoint);
                    return hoverPoint;
                } else {
                    console.error('[反监控] 无效的悬停点，使用随机位置');
                    // 由于minX和minY在后面才定义，这里使用视口尺寸作为默认值
                    const defaultMinX = 0;
                    const defaultMaxX = window.innerWidth;
                    const defaultMinY = 0;
                    const defaultMaxY = window.innerHeight;
                    const randomPos = {
                        x: defaultMinX + Math.random() * (defaultMaxX - defaultMinX),
                        y: defaultMinY + Math.random() * (defaultMaxY - defaultMinY)
                    };
                    debugLog('无效悬停点，使用随机位置:', randomPos);
                    return randomPos;
                }
            }
            
            // 根据配置的活动区域确定移动范围
            let minX, maxX, minY, maxY;
            
            if (config.activityArea === 'custom') {
                // 自定义区域模式
                minX = (config.customArea && config.customArea.x1) || 0;
                maxX = (config.customArea && config.customArea.x2) || window.innerWidth;
                minY = (config.customArea && config.customArea.y1) || 0;
                maxY = (config.customArea && config.customArea.y2) || window.innerHeight;
            } else if (config.activityArea === 'content') {
                // 内容区域模式，尝试获取主要内容区域
                const contentArea = document.querySelector('main, #content, .content') || document.body;
                const rect = contentArea.getBoundingClientRect();
                minX = rect.left;
                maxX = rect.right;
                minY = rect.top;
                maxY = rect.bottom;
            } else {
                // 全屏模式
                minX = 0;
                maxX = viewportWidth;
                minY = 0;
                maxY = viewportHeight;
            }
            
            // 确保当前位置在有效范围内
            currentX = Math.max(minX, Math.min(maxX, currentX));
            currentY = Math.max(minY, Math.min(maxY, currentY));
            
            // 添加调试信息
            console.log('[反监控] 活动区域:', {minX, maxX, minY, maxY});
            
            let newX = currentX;
            let newY = currentY;
            const speedFactor = config.moveSpeed / 5; // 速度系数，用于调整移动速度
            
            // 根据不同的路径模式计算新位置
            switch (config.pathMode) {
                case 'random':
                    // 随机模式：随机向任意方向移动，增加随机性以解决鼠标位置无随机变化的问题
                    // 使用静态变量来跟踪上一次的移动方向，避免过于频繁的来回移动
                    if (virtualMouseState.randomAngle === null) {
                        virtualMouseState.randomAngle = Math.random() * Math.PI * 2; // 初始化随机角度
                    }
                    
                    // 80%概率保持大致相同的方向，20%概率改变方向
                    if (Math.random() < 0.2) {
                        // 增加方向变化的随机性和自然性
                        virtualMouseState.randomAngle += (Math.random() - 0.5) * Math.PI * 0.8; 
                    }
                    
                    // 随机距离，增加移动距离使光标移动更明显
                    // 添加速度变化，使移动更自然
                    const baseSpeed = config.moveSpeed || 5;
                    const randomSpeed = baseSpeed * (0.5 + Math.random() * 1.5); // 速度在0.5-2倍基础速度之间变化
                    const randomDistance = (20 + Math.random() * 60) * (randomSpeed / 5); 
                    
                    newX += Math.cos(virtualMouseState.randomAngle) * randomDistance;
                    newY += Math.sin(virtualMouseState.randomAngle) * randomDistance;
                    
                    // 添加随机微小抖动，模拟手部不稳定性
                    const jitterAmount = config.jitterAmount || 2;
                    if (config.jitterEnabled !== false) {
                        newX += (Math.random() - 0.5) * jitterAmount;
                        newY += (Math.random() - 0.5) * jitterAmount;
                    }
                    
                    console.log('[反监控] 随机模式，新位置:', {newX, newY, randomDistance, angle: virtualMouseState.randomAngle, randomSpeed});
                    break;
                    
                case 'click':
                    // 点击模式：随机移动并增加点击频率
                    if (virtualMouseState.clickAngle === null) {
                        virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
                    }
                    
                    if (Math.random() < 0.15) { // 减小方向变化概率
                        virtualMouseState.clickAngle += (Math.random() - 0.5) * Math.PI * 0.5; // 减小方向变化幅度
                    }
                    
                    // 添加速度变化
                    const clickBaseSpeed = config.moveSpeed || 5;
                    const clickSpeed = clickBaseSpeed * (0.3 + Math.random() * 1.2);
                    const clickDistance = (10 + Math.random() * 15) * (clickSpeed / 5); // 减小距离变化范围
                    newX += Math.cos(virtualMouseState.clickAngle) * clickDistance;
                    newY += Math.sin(virtualMouseState.clickAngle) * clickDistance;
                    
                    // 设置点击概率标志，添加自然的点击频率变化
                    virtualMouseState.clickModeShouldClick = Math.random() < (0.05 + Math.random() * 0.1); // 5-15%概率点击
                    
                    // 添加随机微小抖动
                    if (config.jitterEnabled !== false) {
                        const clickJitter = config.jitterAmount || 1.5;
                        newX += (Math.random() - 0.5) * clickJitter;
                        newY += (Math.random() - 0.5) * clickJitter;
                    }
                    
                    debugLog('点击模式，新位置:', {newX, newY, clickDistance, angle: virtualMouseState.clickAngle, clickSpeed});
                    break;
                    
                case 'smooth':
                    // 平滑模式：大多数时间沿当前方向移动，偶尔改变方向
                    // 使用静态变量来保持移动方向
                    if (virtualMouseState.smoothAngle === null) {
                        virtualMouseState.smoothAngle = Math.random() * Math.PI * 2; // 初始化随机角度
                    }
                    
                    if (Math.random() < 0.05) { // 5%概率改变方向，更平滑
                        // 添加更自然的方向变化，考虑当前速度
                        const speedInfluence = virtualMouseState.lastSpeed / 10; // 速度越快，方向变化越小
                        virtualMouseState.smoothAngle += (Math.random() - 0.5) * Math.PI * (0.25 - speedInfluence * 0.1); 
                    }
                    
                    // 沿当前方向移动，增加移动距离使变化更明显
                    // 添加加速度和减速度
                    const smoothBaseSpeed = config.moveSpeed || 5;
                    let smoothSpeed = smoothBaseSpeed;
                    
                    // 模拟人类移动习惯：开始慢，中间快，接近目标慢
                    const distanceToEdge = Math.min(
                        newX - minX, maxX - newX, 
                        newY - minY, maxY - newY
                    );
                    
                    if (distanceToEdge < 100) {
                        // 接近边界时减速
                        smoothSpeed = smoothBaseSpeed * (distanceToEdge / 100);
                    } else {
                        // 正常移动时的速度变化
                        smoothSpeed = smoothBaseSpeed * (0.7 + Math.random() * 0.8);
                    }
                    
                    const smoothDistance = 25 * (smoothSpeed / 5);
                    newX += Math.cos(virtualMouseState.smoothAngle) * smoothDistance;
                    newY += Math.sin(virtualMouseState.smoothAngle) * smoothDistance;
                    
                    // 保存当前速度
                    virtualMouseState.lastSpeed = smoothSpeed;
                    
                    // 添加微小抖动
                    if (config.jitterEnabled !== false) {
                        const smoothJitter = config.jitterAmount || 1;
                        newX += (Math.random() - 0.5) * smoothJitter;
                        newY += (Math.random() - 0.5) * smoothJitter;
                    }
                    
                    console.log('[反监控] 平滑模式，新位置:', {newX, newY, angle: virtualMouseState.smoothAngle, smoothSpeed});
                    break;
                    
                case 'pattern':
                    // 模式模式：主要向右移动，偶尔换行
                    // 使用静态变量来跟踪当前行位置
                    if (virtualMouseState.patternX === null) {
                        virtualMouseState.patternX = currentX;
                    }
                    
                    // 智能路径规划：考虑元素布局，避免穿过可能的交互元素
                    const elements = document.querySelectorAll('button, a, input, textarea, select, [onclick]');
                    let avoidElements = false;
                    for (const elem of elements) {
                        const rect = elem.getBoundingClientRect();
                        // 检查当前位置附近是否有交互元素
                        if (Math.abs(newX - rect.left) < 50 && Math.abs(newY - rect.top) < 50) {
                            avoidElements = true;
                            break;
                        }
                    }
                    
                    if (avoidElements || Math.random() < 0.03 || virtualMouseState.patternX > maxX * 0.8) { // 3%概率换行或接近右边界或需要避开元素
                        newY += 25 * speedFactor; // 向下移动（换行）
                        // 随机起始位置，增加自然性
                        newX = minX + Math.random() * (maxX - minX) * 0.6 + (maxX - minX) * 0.2;
                        virtualMouseState.patternX = newX; // 重置行位置
                        debugLog('模式模式换行，新位置:', {newX, newY, avoidElements});
                    } else {
                        // 添加速度变化
                        const patternSpeed = (config.moveSpeed || 5) * (0.6 + Math.random() * 0.8);
                        newX += 12 * (patternSpeed / 5); // 向右移动
                        virtualMouseState.patternX = newX; // 更新行位置
                        console.log('[反监控] 模式模式向右，新位置:', {newX, newY, patternSpeed});
                    }
                    break;
                    
                case 'hover':
                    // 悬停模式：大部分时间停留在当前位置，偶尔移动到新位置
                    // 使用静态变量来跟踪悬停时间和目标位置
                    if (virtualMouseState.hoverTime === null) {
                        virtualMouseState.hoverTime = 0;
                    }
                    
                    if (virtualMouseState.hoverTargetX === null || virtualMouseState.hoverTargetY === null) {
                        // 初始化目标位置
                        virtualMouseState.hoverTargetX = currentX;
                        virtualMouseState.hoverTargetY = currentY;
                    }
                    
                    virtualMouseState.hoverTime++;
                    
                    // 1%概率移动到新位置或已经到达目标位置
                    if (Math.random() < 0.01 || (Math.abs(currentX - virtualMouseState.hoverTargetX) < 1 && Math.abs(currentY - virtualMouseState.hoverTargetY) < 1)) {
                        // 智能选择目标位置，考虑页面元素
                        let newTargetX, newTargetY;
                        
                        // 30%概率选择页面上的交互元素作为目标
                        if (Math.random() < 0.3) {
                            const interactiveElements = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
                            if (interactiveElements.length > 0) {
                                const randomElement = interactiveElements[Math.floor(Math.random() * interactiveElements.length)];
                                const rect = randomElement.getBoundingClientRect();
                                newTargetX = rect.left + rect.width / 2;
                                newTargetY = rect.top + rect.height / 2;
                            } else {
                                // 没有交互元素，随机选择位置
                                newTargetX = minX + Math.random() * (maxX - minX);
                                newTargetY = minY + Math.random() * (maxY - minY);
                            }
                        } else {
                            // 随机选择位置
                            newTargetX = minX + Math.random() * (maxX - minX);
                            newTargetY = minY + Math.random() * (maxY - minY);
                        }
                        
                        virtualMouseState.hoverTargetX = newTargetX;
                        virtualMouseState.hoverTargetY = newTargetY;
                        virtualMouseState.hoverTime = 0;
                        debugLog('悬停模式设置新目标:', {x: virtualMouseState.hoverTargetX, y: virtualMouseState.hoverTargetY});
                    }
                    
                    // 向目标位置移动，添加自然的加速减速
                    const dx = virtualMouseState.hoverTargetX - currentX;
                    const dy = virtualMouseState.hoverTargetY - currentY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 1) {
                        // 模拟人类接近目标时的减速
                        const hoverSpeed = Math.min(
                            8, // 最大速度
                            Math.max(1, distance * 0.05) // 距离越远速度越快，最小1
                        ) * (config.moveSpeed || 5) / 5;
                        
                        const moveDistance = Math.min(distance, hoverSpeed);
                        newX = currentX + (dx / distance) * moveDistance;
                        newY = currentY + (dy / distance) * moveDistance;
                        
                        // 添加微小抖动
                        if (config.jitterEnabled !== false) {
                            const hoverJitter = (config.jitterAmount || 1) * 0.5;
                            newX += (Math.random() - 0.5) * hoverJitter;
                            newY += (Math.random() - 0.5) * hoverJitter;
                        }
                        
                        debugLog('悬停模式移动中:', {newX, newY, dx, dy, distance, hoverSpeed});
                    }
                    break;
                    
                default:
                    console.log('[反监控] 未知路径模式，使用默认随机模式');
                    // 默认随机模式
                    if (virtualMouseState.randomAngle === null) {
                        virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
                    }
                    
                    if (Math.random() < 0.2) {
                        virtualMouseState.randomAngle += (Math.random() - 0.5) * Math.PI * 0.5;
                    }
                    
                    const defaultDistance = (30 + Math.random() * 50) * speedFactor;
                    newX += Math.cos(virtualMouseState.randomAngle) * defaultDistance;
                    newY += Math.sin(virtualMouseState.randomAngle) * defaultDistance;
                    console.log('[反监控] 默认随机模式，新位置:', {newX, newY, defaultDistance, angle: virtualMouseState.randomAngle});
            }
            
            // 确保新位置不超出边界
            newX = Math.max(minX + 5, Math.min(maxX - 5, newX)); // 留出5像素边距，避免贴边
            newY = Math.max(minY + 5, Math.min(maxY - 5, newY));
            
            // 添加最终位置调试信息
            console.log('[反监控] 最终位置:', {newX, newY});
            
            return { x: newX, y: newY };
        } catch (e) {
            console.error('[反监控脚本] 计算虚拟鼠标位置失败:', e);
            return { x: currentX, y: currentY }; // 出错时保持当前位置
        }
    }
    
    // 添加平滑移动相关的状态变量
    let smoothMoveState = {
        targetX: null,
        targetY: null,
        currentDisplayX: null,
        currentDisplayY: null,
        moveProgress: 0,
        moveSpeed: 0.8, // 显著增加移动速度
        jitterEnabled: true, // 是否启用随机抖动
        jitterAmount: 2, // 抖动幅度
        // 新增贝塞尔曲线移动参数
        bezierPoints: [], // 贝塞尔曲线控制点
        bezierProgress: 0, // 贝塞尔曲线进度
        isBezierMoving: false, // 是否正在进行贝塞尔曲线移动
        // 新增真实鼠标行为参数
        acceleration: 0.1, // 加速度
        deceleration: 0.15, // 减速度
        maxSpeed: 15, // 最大速度
        currentSpeed: 0, // 当前速度
        targetSpeed: 0, // 目标速度
        velocityX: 0, // X方向速度
        velocityY: 0, // Y方向速度
        // 新增人类行为参数
        pauseProbability: 0.05, // 暂停概率
        pauseDuration: 0, // 暂停持续时间
        isPausing: false, // 是否正在暂停
        microMovements: true, // 是否启用微移动
        microMovementIntensity: 1.5 // 微移动强度
    };
    
    /**
     * 生成贝塞尔曲线点
     * 使用贝塞尔曲线生成更自然的鼠标移动路径
     * @param {number} startX - 起始点X坐标
     * @param {number} startY - 起始点Y坐标
     * @param {number} endX - 结束点X坐标
     * @param {number} endY - 结束点Y坐标
     * @param {number} curvature - 曲率参数，控制曲线弯曲程度
     * @returns {Array} 贝塞尔曲线点数组
     */
    function generateBezierPath(startX, startY, endX, endY, curvature = 0.5) {
        try {
            // 计算控制点
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            // 计算垂直于连线的方向向量
            const dx = endX - startX;
            const dy = endY - startY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len;
            const perpY = dx / len;
            
            // 计算控制点偏移量，添加随机性使曲线更自然
            const offset = len * curvature * (0.5 + Math.random() * 0.5);
            const controlX1 = midX + perpX * offset * (Math.random() > 0.5 ? 1 : -1);
            const controlY1 = midY + perpY * offset * (Math.random() > 0.5 ? 1 : -1);
            
            // 添加第二个控制点，使曲线更复杂
            const controlX2 = midX + perpX * offset * 0.5 * (Math.random() > 0.5 ? 1 : -1);
            const controlY2 = midY + perpY * offset * 0.5 * (Math.random() > 0.5 ? 1 : -1);
            
            // 生成贝塞尔曲线点
            const points = [];
            const steps = 20 + Math.floor(Math.random() * 10); // 20-30个点
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                // 三次贝塞尔曲线公式
                const x = Math.pow(1-t, 3) * startX + 
                         3 * Math.pow(1-t, 2) * t * controlX1 + 
                         3 * (1-t) * Math.pow(t, 2) * controlX2 + 
                         Math.pow(t, 3) * endX;
                         
                const y = Math.pow(1-t, 3) * startY + 
                         3 * Math.pow(1-t, 2) * t * controlY1 + 
                         3 * (1-t) * Math.pow(t, 2) * controlY2 + 
                         Math.pow(t, 3) * endY;
                
                points.push({ x, y });
            }
            
            return points;
        } catch (e) {
            console.error('[反监控脚本] 生成贝塞尔路径失败:', e);
            // 出错时返回直线路径
            return [
                { x: startX, y: startY },
                { x: endX, y: endY }
            ];
        }
    }
    
    /**
     * 计算贝塞尔曲线上的点
     * @param {number} t - 进度值，0-1之间
     * @param {Array} points - 控制点数组
     * @returns {Object} 包含x和y坐标的对象
     */
    function getBezierPoint(t, points) {
        try {
            if (points.length < 2) return { x: 0, y: 0 };
            
            // 如果只有两个点，使用线性插值
            if (points.length === 2) {
                return {
                    x: points[0].x + (points[1].x - points[0].x) * t,
                    y: points[0].y + (points[1].y - points[0].y) * t
                };
            }
            
            // 多点贝塞尔曲线计算（德卡斯特里奥算法）
            let tempPoints = [...points];
            
            while (tempPoints.length > 1) {
                const newPoints = [];
                for (let i = 0; i < tempPoints.length - 1; i++) {
                    newPoints.push({
                        x: tempPoints[i].x + (tempPoints[i+1].x - tempPoints[i].x) * t,
                        y: tempPoints[i].y + (tempPoints[i+1].y - tempPoints[i].y) * t
                    });
                }
                tempPoints = newPoints;
            }
            
            return tempPoints[0];
        } catch (e) {
            console.error('[反监控脚本] 计算贝塞尔点失败:', e);
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 更新鼠标速度和加速度
     * 模拟真实鼠标的加速和减速过程
     * @param {number} targetX - 目标X坐标
     * @param {number} targetY - 目标Y坐标
     * @param {number} currentX - 当前X坐标
     * @param {number} currentY - 当前Y坐标
     * @returns {Object} 包含新速度和位置的对象
     */
    function updateMouseVelocity(targetX, targetY, currentX, currentY) {
        try {
            // 计算到目标的方向和距离
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 如果距离很小，开始减速
            if (distance < 50) {
                smoothMoveState.targetSpeed = Math.max(1, smoothMoveState.maxSpeed * (distance / 50));
            } else {
                // 否则加速到最大速度
                smoothMoveState.targetSpeed = smoothMoveState.maxSpeed;
            }
            
            // 更新当前速度（带加速度）
            if (smoothMoveState.currentSpeed < smoothMoveState.targetSpeed) {
                smoothMoveState.currentSpeed = Math.min(
                    smoothMoveState.targetSpeed,
                    smoothMoveState.currentSpeed + smoothMoveState.acceleration
                );
            } else if (smoothMoveState.currentSpeed > smoothMoveState.targetSpeed) {
                smoothMoveState.currentSpeed = Math.max(
                    smoothMoveState.targetSpeed,
                    smoothMoveState.currentSpeed - smoothMoveState.deceleration
                );
            }
            
            // 计算速度向量
            let velocityX = 0;
            let velocityY = 0;
            
            if (distance > 0.1) {
                velocityX = (dx / distance) * smoothMoveState.currentSpeed;
                velocityY = (dy / distance) * smoothMoveState.currentSpeed;
            }
            
            // 应用微移动（模拟手部轻微抖动）
            if (smoothMoveState.microMovements && Math.random() < 0.3) {
                velocityX += (Math.random() - 0.5) * smoothMoveState.microMovementIntensity;
                velocityY += (Math.random() - 0.5) * smoothMoveState.microMovementIntensity;
            }
            
            // 计算新位置
            const newX = currentX + velocityX;
            const newY = currentY + velocityY;
            
            return {
                x: newX,
                y: newY,
                velocityX: velocityX,
                velocityY: velocityY,
                currentSpeed: smoothMoveState.currentSpeed
            };
        } catch (e) {
            console.error('[反监控脚本] 更新鼠标速度失败:', e);
            return {
                x: currentX,
                y: currentY,
                velocityX: 0,
                velocityY: 0,
                currentSpeed: 0
            };
        }
    }
    
    /**
     * 检查是否应该暂停移动
     * 模拟人类使用鼠标时的自然暂停
     * @returns {boolean} 是否应该暂停
     */
    function shouldPause() {
        try {
            // 如果已经在暂停中，检查是否应该继续
            if (smoothMoveState.isPausing) {
                smoothMoveState.pauseDuration--;
                if (smoothMoveState.pauseDuration <= 0) {
                    smoothMoveState.isPausing = false;
                    return false;
                }
                return true;
            }
            
            // 检查是否应该开始暂停
            if (Math.random() < smoothMoveState.pauseProbability) {
                smoothMoveState.isPausing = true;
                smoothMoveState.pauseDuration = 5 + Math.floor(Math.random() * 10); // 暂停5-15帧
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('[反监控脚本] 检查暂停状态失败:', e);
            return false;
        }
    }

    // 全局变量，用于存储虚拟鼠标的当前位置
    let currentPos = null;
    
    // 拦截日志记录系统
    const blockLog = {
        entries: [],
        maxEntries: 1000,
        
        log(eventType, target, action, details = {}, context = {}) {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.logging || !siteConfig.logging.enabled) return;
            
            // 只输出设备或服务处于在线状态的正常运行情况
            if (action.includes('offline') || eventType.includes('offline')) {
                // 替换为在线状态输出
                console.log('[反监控] 设备处于在线状态');
                return;
            }
            
            const logLevel = siteConfig.logging.level || 'info';
            
            // 增强的目标信息
            let targetInfo = 'unknown';
            if (target) {
                if (target.tagName) {
                    targetInfo = {
                        tagName: target.tagName.toLowerCase(),
                        id: target.id || '',
                        className: target.className || '',
                        src: target.src || '',
                        href: target.href || ''
                    };
                } else {
                    targetInfo = String(target);
                }
            }
            
            const entry = {
                timestamp: Date.now(),
                eventType,
                target: targetInfo,
                action,
                details,
                context,
                url: window.location.href,
                referrer: document.referrer,
                level: logLevel
            };
            
            this.entries.push(entry);
            if (this.entries.length > this.maxEntries) {
                this.entries.shift();
            }
            
            // 控制台输出
            if (entry.level === 'debug' || entry.level === 'info') {
                console.log(`[反监控] ${action} - ${eventType}`, entry);
            } else if (entry.level === 'warn') {
                console.warn(`[反监控] ${action} - ${eventType}`, entry);
            } else if (entry.level === 'error') {
                console.error(`[反监控] ${action} - ${eventType}`, entry);
            }
        },
        
        getEntries() {
            return [...this.entries];
        },
        
        clear() {
            this.entries = [];
        }
    };
    
    // 拦截成功率统计系统
    const blockStats = {
        totalEvents: 0,
        blockedEvents: 0,
        eventTypeStats: {},
        
        incrementTotal(eventType) {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.stats || !siteConfig.stats.enabled) return;
            
            // 只统计在线状态相关事件
            if (eventType === 'online' || eventType === 'offline') {
                // 统一统计为在线状态事件
                eventType = 'online';
            }
            
            this.totalEvents++;
            if (!this.eventTypeStats[eventType]) {
                this.eventTypeStats[eventType] = { total: 0, blocked: 0 };
            }
            this.eventTypeStats[eventType].total++;
        },
        
        incrementBlocked(eventType) {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.stats || !siteConfig.stats.enabled) return;
            
            // 只统计在线状态相关事件
            if (eventType === 'online' || eventType === 'offline') {
                // 统一统计为在线状态事件
                eventType = 'online';
            }
            
            this.blockedEvents++;
            if (!this.eventTypeStats[eventType]) {
                this.eventTypeStats[eventType] = { total: 0, blocked: 0 };
            }
            this.eventTypeStats[eventType].blocked++;
        },
        
        getStats() {
            const successRate = this.totalEvents > 0 ? (this.blockedEvents / this.totalEvents * 100).toFixed(2) : '0.00';
            return {
                totalEvents: this.totalEvents,
                blockedEvents: this.blockedEvents,
                successRate: `${successRate}%`,
                eventTypeStats: { ...this.eventTypeStats }
            };
        },
        
        reset() {
            this.totalEvents = 0;
            this.blockedEvents = 0;
            this.eventTypeStats = {};
        }
    };
    
    /**
     * 初始化虚拟鼠标位置并开始定时更新移动
     */
    function startVirtualMouse(customConfig) {
        try {
            // 首先声明currentPos变量，避免未定义错误
            currentPos = {
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight
            };
            
            // 获取当前站点配置
            const siteConfigResult = getCurrentSiteConfig() || {};
            // 确保virtualMouse配置存在
            const siteConfig = siteConfigResult.virtualMouse || {};
            // 获取全局配置（如果存在）
            const globalConfig = window.virtualMouseConfig || {};
            // 确保defaultSiteConfig.virtualMouse存在
            const defaultVirtualMouseConfig = (typeof defaultSiteConfig === 'object' && defaultSiteConfig !== null && defaultSiteConfig.virtualMouse) ? defaultSiteConfig.virtualMouse : {};
            // 合并配置
            const config = {
                moveInterval: 50, // 减少默认移动间隔，使移动更流畅
                movementSmoothness: 0.3, // 增加默认平滑度，使效果更明显
                jitterEnabled: true, // 默认启用抖动
                jitterAmount: 2, // 默认抖动幅度
                ...defaultVirtualMouseConfig,
                ...siteConfig,
                ...globalConfig,
                ...(customConfig || {})
            };
            
            // 更新平滑移动状态
            smoothMoveState.moveSpeed = config.moveSpeed || 0.3; // 使用moveSpeed而不是movementSmoothness
            smoothMoveState.jitterEnabled = config.jitterEnabled !== false; // 默认启用抖动
            smoothMoveState.jitterAmount = config.jitterAmount || 2;
            
            console.log('[反监控] 尝试启动虚拟鼠标，合并配置:', config);
            debugLog('平滑移动配置:', {
                moveSpeed: smoothMoveState.moveSpeed,
                jitterEnabled: smoothMoveState.jitterEnabled,
                jitterAmount: smoothMoveState.jitterAmount
            });
            
            // 如果虚拟鼠标未启用，则不执行
            if (!config.enabled) {
                console.log('[反监控] 虚拟鼠标未启用，不启动');
                return;
            }
            
            // 如果已经在运行，则不重复启动
            if (virtualMouseInterval) {
                console.log('[反监控] 虚拟鼠标已在运行，不重复启动');
                return;
            }
            
            debugLog('开始启动虚拟鼠标，路径模式:', config.pathMode);
            
            // 确保虚拟鼠标元素已创建
            if (!virtualMouse) {
                console.log('[反监控] 创建虚拟鼠标元素');
                createVirtualMouse();
            }
            
            // 生成悬停点
            debugLog('生成悬停点');
            generateHoverPoints();
            
            // 确保hoverPoints是有效的数组
            if (!Array.isArray(hoverPoints)) {
                hoverPoints = [];
                console.log('[反监控] hoverPoints被重置为空数组');
            }
            
            // 确保currentHoverIndex是有效的
            if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex) || currentHoverIndex < 0) {
                currentHoverIndex = 0;
                console.log('[反监控] currentHoverIndex被重置为0');
            }
            
            // 初始化位置
            // 更安全地检查fixedPosition配置
            const hasValidFixedPosition = config && config.fixedPosition && typeof config.fixedPosition === 'object' && config.fixedPosition.enabled;
            
            if (hasValidFixedPosition) {
                // 如果启用了固定位置，使用配置的固定坐标
                currentPos = {
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                };
                console.log('[反监控] 使用固定位置:', currentPos);
            } else {
                // 否则在屏幕上随机生成一个初始位置
                currentPos = {
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight
                };
                debugLog('使用随机初始位置:', currentPos);
            }
            
            // 确保 currentPos 是一个有效的对象
            if (!currentPos || typeof currentPos !== 'object') {
                currentPos = {
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight
                };
                console.log('[反监控] 重置为随机位置:', currentPos);
            }
            
            // 确保 currentPos 有有效的 x 和 y 属性
            if (typeof currentPos.x !== 'number' || isNaN(currentPos.x)) {
                currentPos.x = Math.random() * window.innerWidth;
            }
            if (typeof currentPos.y !== 'number' || isNaN(currentPos.y)) {
                currentPos.y = Math.random() * window.innerHeight;
            }
            
            // 重置路径模式的状态变量
            debugLog('重置路径模式状态变量');
            virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
            virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
            virtualMouseState.clickModeShouldClick = false;
            virtualMouseState.smoothAngle = Math.random() * Math.PI * 2;
            virtualMouseState.patternX = currentPos.x;
            virtualMouseState.hoverTime = 0;
            virtualMouseState.hoverTargetX = currentPos.x;
            virtualMouseState.hoverTargetY = currentPos.y;
            
            // 重置平滑移动状态
            console.log('[反监控] 重置平滑移动状态');
            smoothMoveState.targetX = currentPos.x;
            smoothMoveState.targetY = currentPos.y;
            smoothMoveState.currentDisplayX = currentPos.x;
            smoothMoveState.currentDisplayY = currentPos.y;
            smoothMoveState.moveProgress = 0;
            
            console.log('[反监控] 重置路径模式状态变量和平滑移动状态');
            console.log('[反监控] 初始化坐标:', {
                targetX: smoothMoveState.targetX,
                targetY: smoothMoveState.targetY,
                currentDisplayX: smoothMoveState.currentDisplayX,
                currentDisplayY: smoothMoveState.currentDisplayY
            });
            
            // 初始化贝塞尔曲线和物理模型参数
            smoothMoveState.bezierPoints = [];
            smoothMoveState.bezierProgress = 0;
            smoothMoveState.isBezierMoving = false;
            
            // 初始化速度和加速度参数
            smoothMoveState.currentSpeed = 1;
            smoothMoveState.targetSpeed = smoothMoveState.maxSpeed || 5;
            smoothMoveState.acceleration = smoothMoveState.acceleration || 0.2;
            smoothMoveState.deceleration = smoothMoveState.deceleration || 0.3;
            
            // 初始化人类行为参数
            smoothMoveState.isPausing = false;
            smoothMoveState.pauseDuration = 0;
            smoothMoveState.pauseProbability = smoothMoveState.pauseProbability || 0.02;
            smoothMoveState.microMovements = smoothMoveState.microMovements !== false;
            smoothMoveState.microMovementIntensity = smoothMoveState.microMovementIntensity || 0.5;
            
            // 更新位置的内部函数
            function updateVirtualMouse() {
                // 获取当前配置
                const config = getCurrentSiteConfig().virtualMouse || {};
                
                // 确保 currentPos 是一个有效的对象
                if (!currentPos || typeof currentPos !== 'object') {
                    // 使用随机位置而不是屏幕中心位置
                    currentPos = {
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight
                    };
                    console.log('[反监控] 重置currentPos为随机位置:', currentPos);
                }
                
                // 确保 currentPos 有有效的 x 和 y 属性
                if (typeof currentPos.x !== 'number' || isNaN(currentPos.x)) {
                    currentPos.x = Math.random() * window.innerWidth;
                }
                if (typeof currentPos.y !== 'number' || isNaN(currentPos.y)) {
                    currentPos.y = Math.random() * window.innerHeight;
                }
                
                // 记录当前位置
                debugLog('更新前的位置:', currentPos);
                
                // 计算新位置
                let newPos = null;
                try {
                    newPos = getNextVirtualMousePosition(currentPos.x, currentPos.y);
                    
                    // 记录新位置
                    debugLog('计算的新位置:', newPos);
                    
                    // 确保新位置是有效的
                    if (!newPos || typeof newPos !== 'object' || 
                        typeof newPos.x !== 'number' || isNaN(newPos.x) ||
                        typeof newPos.y !== 'number' || isNaN(newPos.y)) {
                        console.error('[反监控] 计算的新位置无效，使用当前位置');
                        newPos = null;
                    }
                } catch (e) {
                    console.error('[反监控] 计算新位置失败，使用当前位置:', e);
                    newPos = null;
                }
                
                // 如果平滑移动已完成且有新位置，更新目标位置
                if (smoothMoveState.moveProgress >= 1 && newPos) {
                    // 更新平滑移动的目标位置
                    smoothMoveState.targetX = newPos.x;
                    smoothMoveState.targetY = newPos.y;
                    smoothMoveState.moveProgress = 0; // 重置移动进度
                    
                    // 生成新的贝塞尔路径
                    const curvature = 0.2 + Math.random() * 0.6; // 随机曲率
                    smoothMoveState.bezierPoints = generateBezierPath(
                        smoothMoveState.currentDisplayX, 
                        smoothMoveState.currentDisplayY, 
                        smoothMoveState.targetX, 
                        smoothMoveState.targetY, 
                        curvature
                    );
                    smoothMoveState.bezierProgress = 0;
                    smoothMoveState.isBezierMoving = true;
                    
                    console.log('[反监控] 平滑移动完成，更新目标位置并生成新贝塞尔路径:', newPos);
                } else if (newPos && (smoothMoveState.targetX !== newPos.x || smoothMoveState.targetY !== newPos.y)) {
                    // 如果有新位置且目标位置不同，更新目标位置
                    smoothMoveState.targetX = newPos.x;
                    smoothMoveState.targetY = newPos.y;
                    smoothMoveState.moveProgress = 0; // 重置移动进度
                    
                    // 生成新的贝塞尔路径
                    const curvature = 0.2 + Math.random() * 0.6; // 随机曲率
                    smoothMoveState.bezierPoints = generateBezierPath(
                        smoothMoveState.currentDisplayX, 
                        smoothMoveState.currentDisplayY, 
                        smoothMoveState.targetX, 
                        smoothMoveState.targetY, 
                        curvature
                    );
                    smoothMoveState.bezierProgress = 0;
                    smoothMoveState.isBezierMoving = true;
                    
                    debugLog('更新目标位置并生成新贝塞尔路径:', newPos);
                }
                
                // 记录更新后的位置
                console.log('[反监控] 当前位置:', currentPos, '目标位置:', {x: smoothMoveState.targetX, y: smoothMoveState.targetY});
                
                // 平滑移动计算
            smoothMoveState.moveProgress += smoothMoveState.moveSpeed;
            if (smoothMoveState.moveProgress > 1) {
                smoothMoveState.moveProgress = 1;
            }
            
            debugLog('移动进度:', smoothMoveState.moveProgress, 'moveSpeed:', smoothMoveState.moveSpeed);
                
                // 使用贝塞尔曲线和物理模型实现更真实的移动
                let displayX, displayY;
                
                // 初始化显示位置，确保有有效的坐标值
                if (smoothMoveState.currentDisplayX === null || smoothMoveState.currentDisplayX === undefined ||
                    smoothMoveState.currentDisplayY === null || smoothMoveState.currentDisplayY === undefined) {
                    // 使用当前位置而不是屏幕中心位置
                    smoothMoveState.currentDisplayX = currentPos.x || Math.random() * window.innerWidth;
                    smoothMoveState.currentDisplayY = currentPos.y || Math.random() * window.innerHeight;
                    console.log('[反监控] 初始化显示位置:', {
                        currentDisplayX: smoothMoveState.currentDisplayX,
                        currentDisplayY: smoothMoveState.currentDisplayY,
                        currentPos: currentPos
                    });
                }
                
                // 检查是否应该暂停移动
                if (shouldPause()) {
                    // 暂停时保持当前位置
                    displayX = smoothMoveState.currentDisplayX;
                    displayY = smoothMoveState.currentDisplayY;
                } else {
                    // 如果正在贝塞尔移动中，使用贝塞尔路径
                    if (smoothMoveState.isBezierMoving && smoothMoveState.bezierPoints.length > 0) {
                        // 更新贝塞尔进度
                        smoothMoveState.bezierProgress += 0.02 + Math.random() * 0.03; // 0.02-0.05的进度步长
                        
                        if (smoothMoveState.bezierProgress >= 1) {
                            // 贝塞尔移动完成
                            smoothMoveState.bezierProgress = 1;
                            smoothMoveState.isBezierMoving = false;
                        }
                        
                        // 获取贝塞尔曲线上的点
                        const bezierPoint = getBezierPoint(smoothMoveState.bezierProgress, smoothMoveState.bezierPoints);
                        
                        // 使用物理模型更新位置
                        const velocityResult = updateMouseVelocity(
                            bezierPoint.x, 
                            bezierPoint.y, 
                            smoothMoveState.currentDisplayX, 
                            smoothMoveState.currentDisplayY
                        );
                        
                        // 更新当前显示位置
                        displayX = velocityResult.x;
                        displayY = velocityResult.y;
                    } else {
                        // 使用物理模型更新位置
                        const velocityResult = updateMouseVelocity(
                            smoothMoveState.targetX, 
                            smoothMoveState.targetY, 
                            smoothMoveState.currentDisplayX, 
                            smoothMoveState.currentDisplayY
                        );
                        
                        // 更新当前显示位置
                        displayX = velocityResult.x;
                        displayY = velocityResult.y;
                    }
                    
                    // 检查是否接近目标
                    const distance = Math.sqrt(
                        Math.pow(smoothMoveState.targetX - displayX, 2) + 
                        Math.pow(smoothMoveState.targetY - displayY, 2)
                    );
                    
                    // 如果非常接近目标，更新当前显示位置和当前位置
                    if (distance < 5) {
                        smoothMoveState.currentDisplayX = smoothMoveState.targetX;
                        smoothMoveState.currentDisplayY = smoothMoveState.targetY;
                        // 更新当前位置为目标位置
                        currentPos = {
                            x: smoothMoveState.targetX,
                            y: smoothMoveState.targetY
                        };
                        console.log('[反监控] 平滑移动完成，更新当前位置:', currentPos);
                    } else {
                        // 否则更新当前显示位置
                        smoothMoveState.currentDisplayX = displayX;
                        smoothMoveState.currentDisplayY = displayY;
                    }
                }
                
                // 检查是否在主窗口且虚拟鼠标存在
                if (virtualMouse && window === window.top && document.body.contains(virtualMouse)) {
                    // 边界检查，确保坐标在屏幕范围内
                    const boundedX = Math.max(0, Math.min(window.innerWidth, displayX));
                    const boundedY = Math.max(0, Math.min(window.innerHeight, displayY));
                    
                    // 只在主窗口中更新DOM元素的位置
                    // 由于使用了transform: translate(-50%, -50%)，直接设置left和top即可
                    virtualMouse.style.left = `${boundedX}px`;
                    virtualMouse.style.top = `${boundedY}px`;
                    
                    // 确保虚拟鼠标可见
                    virtualMouse.style.display = 'block';
                    virtualMouse.style.visibility = 'visible';
                    virtualMouse.style.opacity = '1';
                    
                    console.log('[反监控] 更新虚拟鼠标位置:', {
                        originalX: displayX,
                        originalY: displayY,
                        boundedX: boundedX,
                        boundedY: boundedY,
                        targetX: smoothMoveState.targetX,
                        targetY: smoothMoveState.targetY,
                        progress: smoothMoveState.moveProgress,
                        left: virtualMouse.style.left,
                        top: virtualMouse.style.top
                    });
                    
                    // 确保虚拟鼠标可见
                    virtualMouse.style.display = 'block';
                    
                    // 确保主光标可见
                    const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                    if (mainCursor) {
                        mainCursor.style.display = 'block';
                        // 确保主光标样式正确应用
                        const cursorSize = config.cursorSize || 40;
                        mainCursor.style.width = `${cursorSize}px`;
                        mainCursor.style.height = `${cursorSize}px`;
                        mainCursor.style.borderRadius = '50%';
                        mainCursor.style.backgroundColor = config.cursorColor || '#ff0000';
                        mainCursor.style.opacity = Math.max(0.8, Math.min(1, config.cursorOpacity || 0.9));
                        
                        console.log('[反监控] 主光标状态:', {
                            display: mainCursor.style.display,
                            width: mainCursor.style.width,
                            height: mainCursor.style.height,
                            backgroundColor: mainCursor.style.backgroundColor,
                            opacity: mainCursor.style.opacity
                        });
                    }
                    
                    // 触发鼠标移动事件，使页面元素能正确响应虚拟鼠标
                    simulateMouseMove(displayX, displayY);
                    
                    // 在点击模式下，根据概率显示更明显的点击效果
                    if (config.pathMode === 'click' && Math.random() < 0.1) {
                        showClickEffect();
                    } else {
                        // 其他模式下偶尔显示点击效果
                        if (Math.random() < 0.01) {
                            showClickEffect();
                        }
                    }
                } else {
                    // 在iframe中，仍然触发鼠标移动事件
                    simulateMouseMove(displayX, displayY);
                    
                    // 在iframe中不实际触发点击，只在点击模式下显示效果
                    if (config.pathMode === 'click' && Math.random() < 0.1) {
                        debugLog('在iframe中模拟点击模式效果');
                    }
                }
            }
            
            // 缓动函数：二次方缓入缓出
            function easeInOutQuad(t) {
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            }
            
            // 确定移动间隔 - 悬停模式使用更长的间隔
            const interval = (config.hoverOnly || false) ? (config.hoverInterval || 2000) : (config.moveInterval || 1000); // 减少间隔至1000毫秒
            console.log('[反监控] 设置移动间隔:', interval, '毫秒');
            
            // 启动定时器，定期更新位置
            virtualMouseInterval = setInterval(updateVirtualMouse, interval);
            console.log('[反监控] 已设置定时器，ID:', virtualMouseInterval);
            updateVirtualMouse(); // 立即执行一次，避免初始延迟
            
            // 确保虚拟鼠标样式正确设置
            if (virtualMouse) {
                updateVirtualMouseStyle();
                
                // 确保虚拟鼠标可见
                virtualMouse.style.display = 'block';
                virtualMouse.style.visibility = 'visible';
                virtualMouse.style.opacity = '1';
                
                // 确保主光标可见
                const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                if (mainCursor) {
                    mainCursor.style.display = 'block';
                    mainCursor.style.visibility = 'visible';
                    mainCursor.style.opacity = '1';
                }
                
                // 设置初始位置，确保坐标有效
                // 使用当前位置而不是屏幕中心位置
                const initialX = smoothMoveState.currentDisplayX || currentPos?.x || Math.random() * window.innerWidth;
                const initialY = smoothMoveState.currentDisplayY || currentPos?.y || Math.random() * window.innerHeight;
                
                virtualMouse.style.left = `${initialX}px`;
                virtualMouse.style.top = `${initialY}px`;
                
                console.log('[反监控] 设置虚拟鼠标初始位置:', {
                    initialX: initialX,
                    initialY: initialY,
                    currentDisplayX: smoothMoveState.currentDisplayX,
                    currentDisplayY: smoothMoveState.currentDisplayY
                });
                
                debugLog('虚拟鼠标元素状态:', {
                    display: virtualMouse.style.display,
                    visibility: virtualMouse.style.visibility,
                    opacity: virtualMouse.style.opacity,
                    left: virtualMouse.style.left,
                    top: virtualMouse.style.top,
                    targetX: smoothMoveState.targetX,
                    targetY: smoothMoveState.targetY,
                    currentDisplayX: smoothMoveState.currentDisplayX,
                    currentDisplayY: smoothMoveState.currentDisplayY
                });
            }
            
            debugLog('虚拟鼠标已启动');
        } catch (e) {
            console.error('[反监控脚本] 启动虚拟鼠标失败:', e);
        }
    }
    
    /**
     * 停止虚拟鼠标
     * 清除定时器并根据配置隐藏虚拟鼠标光标
     */
    function stopVirtualMouse() {
        try {
            console.log('[反监控] 准备停止虚拟鼠标，当前状态:', {
                virtualMouseInterval: !!virtualMouseInterval,
                virtualMouse: !!virtualMouse
            });
            
            // 清除定时器
            if (virtualMouseInterval) {
                console.log('[反监控] 清除定时器:', virtualMouseInterval);
                clearInterval(virtualMouseInterval);
                virtualMouseInterval = null;
            }
            
            // 重置路径模式的状态变量
            console.log('[反监控] 重置路径模式状态变量');
            virtualMouseState.randomAngle = null;
            virtualMouseState.clickAngle = null;
            virtualMouseState.clickModeShouldClick = false;
            virtualMouseState.smoothAngle = null;
            virtualMouseState.patternX = null;
            virtualMouseState.hoverTime = null;
            virtualMouseState.hoverTargetX = null;
            virtualMouseState.hoverTargetY = null;
            
            // 重置平滑移动状态
            console.log('[反监控] 重置平滑移动状态');
            smoothMoveState.targetX = null;
            smoothMoveState.targetY = null;
            smoothMoveState.currentDisplayX = null;
            smoothMoveState.currentDisplayY = null;
            smoothMoveState.moveProgress = 0;
            
            // 重置当前位置变量
            console.log('[反监控] 重置当前位置变量');
            currentPos = null;
            
            console.log('[反监控] 重置路径模式状态变量和平滑移动状态');
            
            // 如果不是始终显示光标，则隐藏虚拟鼠标
            const config = getCurrentSiteConfig().virtualMouse || {};
            if (virtualMouse && !(config.showCursorAlways || false)) {
                virtualMouse.style.display = 'none';
                console.log('[反监控] 隐藏虚拟鼠标元素');
            }
            
            debugLog('虚拟鼠标已停止');
        } catch (e) {
            console.error('[反监控脚本] 停止虚拟鼠标失败:', e);
        }
    }
    
    /**
     * 模拟鼠标点击
     */
    function simulateMouseClick(x, y) {
        try {
            // 创建点击事件，移除view属性以避免在某些环境下的兼容性问题
            const clickEvent = new MouseEvent('click', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            // 找到该位置的元素并触发点击
            const element = document.elementFromPoint(x, y);
            if (element) {
                // 检查元素是否在黑名单中
                if (isElementBlacklisted(element)) {
                    debugLog('跳过黑名单元素点击:', element);
                    return;
                }
                element.dispatchEvent(clickEvent);
                debugLog('模拟鼠标点击');
            }
        } catch (e) {
            console.error('[反监控脚本] 模拟鼠标点击失败:', e);
        }
    }
    
    /**
     * 模拟鼠标移动
     */
    function simulateMouseMove(x, y) {
        try {
            // 创建鼠标移动事件
            const mouseMoveEvent = new MouseEvent('mousemove', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            // 找到该位置的元素并触发鼠标移动事件
            const element = document.elementFromPoint(x, y);
            if (element) {
                element.dispatchEvent(mouseMoveEvent);
            }
            
            // 同时触发mouseover和mouseenter事件，确保视频控制条能正确显示
            const mouseOverEvent = new MouseEvent('mouseover', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            const mouseEnterEvent = new MouseEvent('mouseenter', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            if (element) {
                element.dispatchEvent(mouseOverEvent);
                element.dispatchEvent(mouseEnterEvent);
            }
            
            // 持续触发鼠标移动事件，解决滚动条仅首次显示后自动隐藏的问题
            // 查找所有可能的滚动条元素
            const scrollbars = document.querySelectorAll('::-webkit-scrollbar, ::-webkit-scrollbar-track, ::-webkit-scrollbar-thumb');
            scrollbars.forEach(scrollbar => {
                // 向滚动条元素发送鼠标移动事件
                scrollbar.dispatchEvent(mouseMoveEvent);
                scrollbar.dispatchEvent(mouseOverEvent);
                scrollbar.dispatchEvent(mouseEnterEvent);
            });
            
            // 特别处理视频元素，确保控制条保持显示
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                // 检查视频是否有控制条
                if (video.controls) {
                    // 向视频元素发送鼠标移动事件
                    video.dispatchEvent(mouseMoveEvent);
                    video.dispatchEvent(mouseOverEvent);
                    video.dispatchEvent(mouseEnterEvent);
                    
                    // 查找视频控制条容器
                    const controls = video.querySelector('.controls, .video-controls, [class*="control"]');
                    if (controls) {
                        controls.dispatchEvent(mouseMoveEvent);
                        controls.dispatchEvent(mouseOverEvent);
                        controls.dispatchEvent(mouseEnterEvent);
                    }
                }
            });
            
            console.log('[反监控] 模拟鼠标移动');
        } catch (e) {
            console.error('[反监控脚本] 模拟鼠标移动失败:', e);
        }
    }
    
    /**
     * 设置真实鼠标检测
     */
    function setupRealMouseDetection() {
        try {
            const siteConfig = getCurrentSiteConfig();
            const config = siteConfig.virtualMouse;
            // 首先检查网站是否启用了反监控功能，然后检查虚拟鼠标是否启用
            if (!siteConfig.enabled || !config.enabled) return;

            // 定义事件处理函数并保存引用
            handleRealMouseEnter = function() {
                isRealMousePresent = true;
                debugLog('真实鼠标进入页面');
                // 重新获取配置，避免闭包变量访问问题
                const siteConfig = getCurrentSiteConfig();
                const config = siteConfig.virtualMouse;
                if ((config.deactivateOnEnter || false) && virtualMouseInterval) {
                    stopVirtualMouse();
                }
                if (virtualMouse && !(config.showCursorAlways || false)) {
                    virtualMouse.style.display = 'none';
                }
            };

            handleRealMouseLeave = function() {
                isRealMousePresent = false;
                console.log('[反监控] 真实鼠标离开页面');
                try {
                    // 重新获取配置，避免闭包变量访问问题
                    const siteConfigResult = getCurrentSiteConfig() || {};
                    const config = (siteConfigResult && typeof siteConfigResult === 'object' && siteConfigResult.virtualMouse) ? siteConfigResult.virtualMouse : {};
                    if ((config.activateOnLeave || false) && !virtualMouseInterval) {
                        startVirtualMouse();
                    }
                    if (virtualMouse) {
                        virtualMouse.style.display = 'block';
                    }
                } catch (e) {
                    console.error('[反监控脚本] 处理真实鼠标离开事件失败:', e);
                }
            };

            // 添加事件监听器
            document.addEventListener('mouseenter', handleRealMouseEnter);
            document.addEventListener('mouseleave', handleRealMouseLeave);

            debugLog('真实鼠标检测已设置');
        } catch (e) {
            console.error('[反监控脚本] 设置鼠标检测失败:', e);
        }
    }

    /**
     * 应用按钮样式
     */
    function applyButtonStyles(button) {
        try {
            // 获取当前网站的按钮配置
            const siteConfig = getCurrentSiteConfig();
            const style = siteConfig.buttonConfig || {
                text: '反监控',
                position: 'bottom-right',
                customX: '20px',
                customY: '20px',
                backgroundColor: '#ff4444',
                textColor: 'white',
                width: 'auto',
                height: 'auto',
                padding: '10px',
                fontSize: '14px',
                borderRadius: '4px',
                opacity: 1,
                zIndex: '999999'
            };
            
            // 更新按钮文字
            button.textContent = style.text;
            
            // 重置所有位置相关样式
            button.style.top = 'auto';
            button.style.bottom = 'auto';
            button.style.left = 'auto';
            button.style.right = 'auto';
            
            // 根据位置设置定位
            switch (style.position) {
                case 'top-left':
                    button.style.top = style.customY;
                    button.style.left = style.customX;
                    break;
                case 'top-right':
                    button.style.top = style.customY;
                    button.style.right = style.customX;
                    break;
                case 'bottom-left':
                    button.style.bottom = style.customY;
                    button.style.left = style.customX;
                    break;
                case 'bottom-right':
                    button.style.bottom = style.customY;
                    button.style.right = style.customX;
                    break;
                case 'custom':
                    button.style.top = style.customY;
                    button.style.left = style.customX;
                    break;
            }
            
            // 应用其他样式
            button.style.backgroundColor = style.backgroundColor;
            button.style.color = style.textColor;
            button.style.width = style.width;
            button.style.height = style.height;
            button.style.padding = style.padding;
            button.style.fontSize = style.fontSize;
            button.style.borderRadius = style.borderRadius;
            button.style.opacity = style.opacity;
            button.style.zIndex = style.zIndex;
            button.style.position = 'fixed';
            button.style.border = 'none';
            button.style.cursor = 'pointer';
            button.style.fontWeight = 'bold';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            button.style.transition = 'all 0.2s';
        } catch (e) {
            console.error('[反监控脚本] 应用按钮样式失败:', e);
        }
    }

    /**
     * 创建完整的配置界面
     */
    function createConfigUI() {
        try {
            // 检查是否在主窗口环境
            if (!isInMainWindow()) {
                console.log('[反监控脚本] 在iframe/object/embed中，不创建配置界面');
                return;
            }
            
            // 检查是否已存在配置面板
            if (document.getElementById('anti-monitor-config')) {
                console.log('[反监控脚本] 配置面板已存在');
                return;
            }

            console.log('[反监控脚本] 开始创建完整配置界面...');
            
            // 创建配置面板
            const panel = document.createElement('div');
            panel.id = 'anti-monitor-config';
            panel.className = 'anti-monitor-panel';
            
            // 获取当前网站配置
            const currentSiteConfig = getCurrentSiteConfig();
            // 确保currentSiteKey正确设置
            if (!globalConfig.currentSiteKey || !globalConfig.sites[globalConfig.currentSiteKey]) {
                globalConfig.currentSiteKey = getCurrentSiteKey();
                console.log('[反监控脚本] 更新currentSiteKey为:', globalConfig.currentSiteKey);
            }
            const currentSiteKey = globalConfig.currentSiteKey;
            
            // 生成网站列表HTML
            let sitesListHtml = '<option value="">-- 选择网站 --</option>';
            for (const siteKey in globalConfig.sites) {
                const selected = siteKey === currentSiteKey ? 'selected' : '';
                sitesListHtml += `<option value="${escapeHtml(siteKey)}" ${selected}>${escapeHtml(siteKey)}</option>`;
            }
            
            // 面板内容
            panel.innerHTML = `
                <div class="anti-monitor-header">
                    <h3>反监控精细化配置</h3>
                    <button class="anti-monitor-close">×</button>
                </div>
                <div class="anti-monitor-content">
                    <!-- 网站配置管理 -->
                    <div class="config-section">
                        <h4>网站配置管理</h4>
                        <div class="config-item">
                            <label for="site-selector">选择网站配置:</label>
                            <select id="site-selector">
                                ${sitesListHtml}
                            </select>
                            <p class="config-hint">每个网站可以有独立的配置，切换后将加载对应网站的设置</p>
                            
                            <button id="add-new-site" style="margin-top: 5px;">添加当前网站</button>
                            <button id="delete-site" style="margin-top: 5px; margin-left: 5px;">删除选中网站</button>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="site-enabled">
                                启用当前网站的拦截功能
                            </label>
                            <p class="config-hint">总开关：关闭后，当前网站的所有反监控功能都将失效</p>
                        </div>
                    </div>

                    <!-- 页面可见性监控拦截 -->
                    <div class="config-section">
                        <h4>页面可见性监控拦截</h4>
                        <p class="config-hint">防止网站检测您是否在浏览当前页面（例如：切换标签页时）</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-visibilitychange">
                                拦截visibilitychange事件（页面可见性变化）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-webkit">
                                拦截webkitvisibilitychange事件（浏览器兼容）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-override">
                                强制返回页面可见状态
                            </label>
                        </div>
                    </div>

                    <!-- 焦点事件拦截 -->
                    <div class="config-section">
                        <h4>焦点事件拦截</h4>
                        <p class="config-hint">防止网站检测您是否将注意力转移到了其他窗口</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="focus-event-blur">
                                拦截blur事件（页面失去焦点）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="focus-event-focus">
                                拦截focus事件（页面获得焦点）
                            </label>
                        </div>
                    </div>

                    <!-- 全屏事件拦截 -->
                    <div class="config-section">
                        <h4>全屏事件拦截</h4>
                        <p class="config-hint">防止网站检测您是否进入或退出了全屏模式</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="fullscreen-change">
                                拦截全屏状态变化事件
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="fullscreen-browser-specific">
                                拦截浏览器特定的全屏事件（webkit/moz/ms）
                            </label>
                        </div>
                    </div>

                    <!-- 鼠标事件拦截 -->
                    <div class="config-section">
                        <h4>鼠标事件拦截</h4>
                        <p class="config-hint">控制网站对鼠标操作的检测</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-movement-mousemove">
                                拦截mousemove事件（鼠标移动追踪）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-movement-wheel">
                                拦截鼠标滚轮事件（mousewheel和DOMMouseScroll）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-click-events">
                                拦截所有点击相关事件（mousedown, mouseup等）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-hover-events">
                                拦截所有悬停相关事件（mouseover, mouseout等）
                            </label>
                        </div>
                    </div>

                    <!-- 高级事件拦截 -->
                    <div class="config-section">
                        <h4>高级事件拦截</h4>
                        <p class="config-hint">更多类型的事件拦截选项</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="keyboard-events">
                                拦截键盘事件（keydown, keyup, keypress）
                            </label>
                            <p class="config-hint">可能影响网站正常交互，如输入文本</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="window-events">
                                拦截窗口事件（resize, scroll, beforeunload）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="clipboard-events">
                                拦截剪贴板事件（copy, cut, paste）
                            </label>
                            <p class="config-hint">拦截后将无法使用复制粘贴功能</p>
                        </div>
                    </div>

                    <!-- 导航事件拦截 -->
                    <div class="config-section">
                        <h4>导航事件拦截</h4>
                        <p class="config-hint">防止网站检测页面内部导航和URL变化</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events-popstate">
                                拦截popstate事件（浏览器后退/前进按钮）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events-hashchange">
                                拦截hashchange事件（URL锚点变化）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events">
                                拦截所有导航事件
                            </label>
                            <p class="config-hint">包括popstate、hashchange等事件</p>
                        </div>
                    </div>

                    <!-- 触摸事件拦截 -->
                    <div class="config-section">
                        <h4>触摸事件拦截</h4>
                        <p class="config-hint">防止网站检测触摸屏幕操作（主要影响移动设备）</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchstart">
                                拦截touchstart事件（触摸开始）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchmove">
                                拦截touchmove事件（触摸移动）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchend">
                                拦截touchend事件（触摸结束）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events">
                                拦截所有触摸事件
                            </label>
                            <p class="config-hint">包括touchstart、touchmove、touchend等事件</p>
                        </div>
                    </div>

                    <!-- 表单事件拦截 -->
                    <div class="config-section">
                        <h4>表单事件拦截</h4>
                        <p class="config-hint">防止网站跟踪表单填写和输入行为</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-change">
                                拦截change事件（输入值变化）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-input">
                                拦截input事件（实时输入）
                            </label>
                            <p class="config-hint">可能影响表单自动填充和实时验证</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-submit">
                                拦截submit事件（表单提交）
                            </label>
                            <p class="config-hint">拦截后可能影响表单正常提交</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events">
                                拦截所有表单事件
                            </label>
                            <p class="config-hint">包括change、input、submit等事件</p>
                        </div>
                    </div>

                    <!-- 在线/离线状态检测 -->
                    <div class="config-section">
                        <h4>在线/离线状态检测</h4>
                        <p class="config-hint">控制网站检测您的网络连接状态的能力</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-events-enabled">
                                启用在线/离线状态控制
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-event-online">
                                拦截online事件（网络连接恢复）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-event-offline">
                                拦截offline事件（网络连接断开）
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-override-online">
                                始终显示为在线状态
                            </label>
                            <p class="config-hint">覆盖navigator.onLine属性，使网站认为您始终在线</p>
                        </div>
                    </div>

                    <!-- 设备信息保护 -->
                    <div class="config-section">
                        <h4>设备信息保护</h4>
                        <p class="config-hint">保护您的设备信息不被网站获取</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-enabled">
                                启用设备信息保护
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-navigator-properties">
                                隐藏真实浏览器标识和环境信息
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-screen-info">
                                隐藏真实屏幕尺寸和分辨率
                            </label>
                        </div>
                        
                        <!-- 虚拟设备信息设置 -->
                        <div class="config-subsection">
                            <h5>虚拟设备信息</h5>
                            <p class="config-hint">模拟为其他类型的设备（如移动端）进行操作</p>
                            
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="device-emulate-enabled">
                                    启用设备模拟
                                </label>
                            </div>
                            
                            <div class="config-item">
                                <label for="device-type">设备类型：</label>
                                <select id="device-type">
                                    <option value="desktop">桌面端（默认）</option>
                                    <option value="mobile">移动端</option>
                                    <option value="tablet">平板设备</option>
                                    <option value="custom">自定义设备</option>
                                </select>
                            </div>
                            
                            <!-- 自定义设备信息（默认隐藏） -->
                            <div id="custom-device-config" style="display: none;">
                                <div class="config-item">
                                    <label for="custom-user-agent">自定义User-Agent：</label>
                                    <input type="text" id="custom-user-agent" placeholder="输入自定义User-Agent" style="width: 100%; margin-top: 5px;">
                                </div>
                                <div class="config-item">
                                    <label for="custom-platform">自定义平台：</label>
                                    <input type="text" id="custom-platform" placeholder="如：Win32、Android、iPad" style="width: 100%; margin-top: 5px;">
                                </div>
                                <div class="config-item">
                                    <label>屏幕尺寸：</label>
                                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                                        <div>
                                            <label for="custom-screen-width">宽度：</label>
                                            <input type="number" id="custom-screen-width" placeholder="宽度" min="1">
                                        </div>
                                        <div>
                                            <label for="custom-screen-height">高度：</label>
                                            <input type="number" id="custom-screen-height" placeholder="高度" min="1">
                                        </div>
                                    </div>
                                </div>
                                <div class="config-item">
                                    <label>可用区域尺寸：</label>
                                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                                        <div>
                                            <label for="custom-avail-width">宽度：</label>
                                            <input type="number" id="custom-avail-width" placeholder="宽度" min="1">
                                        </div>
                                        <div>
                                            <label for="custom-avail-height">高度：</label>
                                            <input type="number" id="custom-avail-height" placeholder="高度" min="1">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 虚拟鼠标高级设置 -->
                    <div class="config-section">
                        <h4>虚拟鼠标高级设置</h4>
                        <p class="config-hint">当您的真实鼠标离开页面时，自动模拟鼠标活动</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-enabled">
                                启用自动虚拟鼠标功能
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-activate-on-leave">
                                当真实鼠标离开时激活虚拟鼠标
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-deactivate-on-enter">
                                当真实鼠标进入时停用虚拟鼠标
                            </label>
                        </div>
                        
                        <!-- 光标样式设置 -->
                        <div class="config-subsection">
                            <h5>光标样式</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-show-cursor">
                                    显示虚拟鼠标光标
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-color">光标颜色:</label>
                                <input type="color" id="virtual-mouse-color">
                                <input type="text" id="virtual-mouse-color-text" placeholder="例如: black">
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-size">光标大小 (像素):</label>
                                <input type="number" id="virtual-mouse-size" min="5" max="200" step="1">
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-opacity">光标透明度 (0.1-1.0):</label>
                                <input type="range" id="virtual-mouse-opacity" min="0.1" max="1.0" step="0.1">
                                <span id="virtual-mouse-opacity-value"></span>
                            </div>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-enhanced">
                                    启用增强可视化效果
                                </label>
                                <p class="config-hint">使虚拟鼠标更明显，带有点击动画</p>
                            </div>
                        </div>
                        
                        <!-- 移动设置 -->
                        <div class="config-subsection">
                            <h5>移动设置</h5>
                            <div class="config-item">
                                <label for="virtual-mouse-path">移动路径模式:</label>
                                <select id="virtual-mouse-path">
                                    <option value="random">随机移动</option>
                                    <option value="smooth">平滑曲线</option>
                                    <option value="pattern">模拟阅读</option>
                                    <option value="hover">悬停模式</option>
                                    <option value="click">点击模式</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-speed">移动速度 (1-10):</label>
                                <input type="range" id="virtual-mouse-speed" min="1" max="10" step="1">
                                <span id="virtual-mouse-speed-value"></span>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-interval">移动间隔 (毫秒):</label>
                                <input type="number" id="virtual-mouse-interval" min="100" max="1000" step="50">
                            </div>
                        </div>
                        
                        <!-- 仅悬停功能 -->
                        <div class="config-subsection">
                            <h5>悬停功能</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-hover-only">
                                    仅悬停不移动（在多个点之间切换）
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-hover-interval">悬停切换间隔 (毫秒):</label>
                                <input type="number" id="virtual-mouse-hover-interval" min="1000" max="10000" step="500">
                            </div>
                        </div>
                        
                        <!-- 活动区域设置 -->
                        <div class="config-subsection">
                            <h5>活动区域设置</h5>
                            <div class="config-item">
                                <label for="virtual-mouse-area">活动区域:</label>
                                <select id="virtual-mouse-area">
                                    <option value="full">整个页面</option>
                                    <option value="content">主要内容区</option>
                                    <option value="custom">自定义区域</option>
                                </select>
                            </div>
                            
                            <!-- 自定义区域设置 -->
                            <div id="custom-area-settings" class="config-subgroup">
                                <p class="config-hint">设置虚拟鼠标活动的矩形区域坐标</p>
                                <div class="config-item">
                                    <label for="custom-area-x1">左上角 X 坐标:</label>
                                    <input type="number" id="custom-area-x1" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-y1">左上角 Y 坐标:</label>
                                    <input type="number" id="custom-area-y1" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-x2">右下角 X 坐标:</label>
                                    <input type="number" id="custom-area-x2" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-y2">右下角 Y 坐标:</label>
                                    <input type="number" id="custom-area-y2" min="0">
                                </div>
                                <button id="set-custom-area-from-view" style="margin-top: 5px;">
                                    从当前视图设置
                                </button>
                            </div>
                        </div>
                        
                        <!-- 定点放置设置 -->
                        <div class="config-subsection">
                            <h5>定点放置设置</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-fixed-position">
                                    启用定点放置功能
                                </label>
                            </div>
                            <div id="fixed-position-settings" class="config-subgroup">
                                <div class="config-item">
                                    <label for="fixed-position-x">固定 X 坐标:</label>
                                    <input type="number" id="fixed-position-x" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="fixed-position-y">固定 Y 坐标:</label>
                                    <input type="number" id="fixed-position-y" min="0">
                                </div>
                                <button id="set-fixed-position-from-cursor" style="margin-top: 5px;">
                                    使用当前鼠标位置
                                </button>
                            </div>
                        </div>
                        
                        <div class="config-item">
                            <button id="test-virtual-mouse">测试虚拟鼠标</button>
                            <button id="test-virtual-mouse-click" style="margin-left: 5px;">测试点击效果</button>
                        </div>
                    </div>

                    <!-- 调试输出控制 -->
                    <div class="config-section">
                        <h4>调试输出控制</h4>
                        <p class="config-hint">控制控制台调试信息的输出级别，减少控制台信息干扰</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="debug-enabled">
                                启用调试输出
                            </label>
                            <p class="config-hint">开启后将显示相应级别的调试信息</p>
                        </div>
                        
                        <div class="config-item">
                            <label for="debug-level">输出级别:</label>
                            <select id="debug-level">
                                <option value="ERROR">仅错误 - 只显示关键错误信息</option>
                                <option value="WARN">错误和警告 - 显示错误和警告信息</option>
                                <option value="INFO">一般信息 - 显示基本运行信息</option>
                                <option value="DEBUG">调试信息 - 显示详细调试信息</option>
                                <option value="VERBOSE">详细信息 - 显示所有调试信息</option>
                            </select>
                            <p class="config-hint">选择要显示的调试信息详细程度</p>
                        </div>
                        
                        <div class="config-item">
                            <label>分类控制:</label>
                            <div style="margin-top: 5px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                                <label>
                                    <input type="checkbox" id="debug-virtual-mouse"> 虚拟鼠标
                                </label>
                                <label>
                                    <input type="checkbox" id="debug-event-blocking"> 事件拦截
                                </label>
                                <label>
                                    <input type="checkbox" id="debug-device-info"> 设备信息
                                </label>
                                <label>
                                    <input type="checkbox" id="debug-config"> 配置管理
                                </label>
                                <label>
                                    <input type="checkbox" id="debug-animation"> 动画效果
                                </label>
                            </div>
                            <p class="config-hint">按功能模块控制调试信息的显示</p>
                        </div>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="debug-timestamp" checked>
                                显示时间戳
                            </label>
                            <p class="config-hint">在调试信息前显示时间戳</p>
                        </div>
                        
                        <div class="config-item">
                            <button id="test-debug-output">测试调试输出</button>
                            <button id="clear-debug-output" style="margin-left: 5px;">清空控制台</button>
                            <p class="config-hint">测试当前调试配置的输出效果</p>
                        </div>
                    </div>

                    <!-- 反监控按钮配置 -->
                    <div class="config-section">
                        <h4>反监控按钮配置</h4>
                        <p class="config-hint">自定义按钮的外观、位置和名称</p>
                        
                        <div class="config-item">
                            <label for="button-text">按钮显示文字:</label>
                            <input type="text" id="button-text" placeholder="输入按钮名称">
                            <p class="config-hint">可以修改按钮上显示的文字</p>
                        </div>
                        <div class="config-item">
                            <label for="button-position">按钮位置:</label>
                            <select id="button-position">
                                <option value="top-left">左上角</option>
                                <option value="top-right">右上角</option>
                                <option value="bottom-left">左下角</option>
                                <option value="bottom-right">右下角</option>
                                <option value="custom">自定义位置</option>
                            </select>
                        </div>
                        <div class="config-item" id="custom-position-container">
                            <label for="button-custom-x">X坐标 (例如: 20px):</label>
                            <input type="text" id="button-custom-x" placeholder="水平位置">
                            
                            <label for="button-custom-y" style="margin-top: 5px;">Y坐标 (例如: 20px):</label>
                            <input type="text" id="button-custom-y" placeholder="垂直位置">
                        </div>
                        <div class="config-item">
                            <label for="button-bg-color">背景颜色:</label>
                            <input type="color" id="button-bg-color">
                            <input type="text" id="button-bg-color-text" placeholder="例如: #ff4444">
                        </div>
                        <div class="config-item">
                            <label for="button-text-color">文字颜色:</label>
                            <input type="color" id="button-text-color">
                            <input type="text" id="button-text-color-text" placeholder="例如: #ffffff">
                        </div>
                        <div class="config-item">
                            <label for="button-width">宽度 (例如: 80px 或 auto):</label>
                            <input type="text" id="button-width" placeholder="宽度值">
                        </div>
                        <div class="config-item">
                            <label for="button-height">高度 (例如: 30px 或 auto):</label>
                            <input type="text" id="button-height" placeholder="高度值">
                        </div>
                        <div class="config-item">
                            <label for="button-padding">内边距 (例如: 8px 12px):</label>
                            <input type="text" id="button-padding" placeholder="内边距值">
                        </div>
                        <div class="config-item">
                            <label for="button-font-size">字体大小 (例如: 14px):</label>
                            <input type="text" id="button-font-size" placeholder="字体大小">
                        </div>
                        <div class="config-item">
                            <label for="button-border-radius">圆角 (例如: 4px):</label>
                            <input type="text" id="button-border-radius" placeholder="圆角值">
                        </div>
                        <div class="config-item">
                            <label for="button-opacity">透明度 (0.1-1.0):</label>
                            <input type="number" id="button-opacity" min="0.1" max="1.0" step="0.1">
                        </div>
                        <div class="config-item">
                            <label for="button-z-index">层级 (数值越大越靠上):</label>
                            <input type="number" id="button-z-index" min="1">
                        </div>
                    </div>

                    <!-- 高级拦截规则配置 -->
                    <div class="config-section">
                        <h4>高级拦截规则配置</h4>
                        <p class="config-hint">配置更精细的拦截规则，支持正则表达式和元素选择器</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="advanced-blocking-enabled">
                                启用高级拦截规则
                            </label>
                        </div>
                        <div class="config-item">
                            <button id="add-rule">添加拦截规则</button>
                            <button id="clear-rules">清除所有规则</button>
                        </div>
                        <div id="rules-container" style="margin-top: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                            <!-- 规则将动态添加到这里 -->
                        </div>
                    </div>
                    
                    <!-- 日志和统计配置 -->
                    <div class="config-section">
                        <h4>日志和统计配置</h4>
                        <p class="config-hint">配置拦截日志记录和统计功能</p>
                        
                        <!-- 日志配置 -->
                        <div class="config-subsection">
                            <h5>日志配置</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="logging-enabled">
                                    启用拦截日志记录
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="log-level">日志级别：</label>
                                <select id="log-level">
                                    <option value="debug">调试</option>
                                    <option value="info" selected>信息</option>
                                    <option value="warn">警告</option>
                                    <option value="error">错误</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <button id="view-logs">查看日志</button>
                                <button id="clear-logs">清除日志</button>
                            </div>
                        </div>
                        
                        <!-- 统计配置 -->
                        <div class="config-subsection">
                            <h5>统计配置</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="stats-enabled">
                                    启用拦截统计
                                </label>
                            </div>
                            <div class="config-item">
                                <button id="view-stats">查看统计数据</button>
                                <button id="reset-stats">重置统计</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 配置操作按钮 -->
                    <div class="config-actions">
                        <button id="save-config">保存配置</button>
                        <button id="reset-current-config">重置当前网站配置</button>
                        <button id="reset-all-config">重置所有配置</button>
                    </div>
                </div>
            `;

                    // 添加到页面（无论是否显示按钮，都先添加面板）
            document.body.appendChild(panel);
            console.log('[反监控脚本] 完整配置面板已添加到页面');

            // 默认隐藏配置面板（移除visible类而不是设置display）
            panel.classList.remove('visible');

            // 检查是否应该显示反监控按钮
            // 只有当监控功能已启用且配置为显示按钮时，才显示按钮
            const hasSiteConfig = globalConfig.sites[globalConfig.currentSiteKey] !== undefined;
            const isMonitoringEnabled = currentSiteConfig.enabled === true;
            const shouldShowButton = hasSiteConfig && isMonitoringEnabled && (currentSiteConfig.showButton !== undefined ?
                                    currentSiteConfig.showButton :
                                    globalConfig.showButtonByDefault);

            // 创建触发按钮变量（提高作用域到整个函数）
            let trigger;
            
            // 只有在网站有配置且配置为显示按钮时，才创建和添加按钮
            if (shouldShowButton) {
                // 创建触发按钮
                trigger = document.createElement('button');
                trigger.id = 'anti-monitor-trigger';
                document.body.appendChild(trigger);
                console.log('[反监控脚本] 触发按钮已添加到页面');

                // 应用按钮样式和文字
                if (trigger) {
                    applyButtonStyles(trigger);
                }
            } else {
                console.log('[反监控脚本] 当前页面未配置或未配置显示按钮，不显示按钮');
            }

            // 加载当前网站配置到UI
            document.getElementById('site-enabled').checked = currentSiteConfig.enabled;
            
            // 页面可见性事件
            document.getElementById('page-visibility-visibilitychange').checked = currentSiteConfig.pageVisibilityEvents.visibilitychange;
            document.getElementById('page-visibility-webkit').checked = currentSiteConfig.pageVisibilityEvents.webkitvisibilitychange;
            document.getElementById('page-visibility-override').checked = currentSiteConfig.pageVisibilityEvents.overrideVisibilityState;
            
            // 焦点事件
            document.getElementById('focus-event-blur').checked = currentSiteConfig.focusEvents.blur;
            document.getElementById('focus-event-focus').checked = currentSiteConfig.focusEvents.focus;
            
            // 全屏事件
            document.getElementById('fullscreen-change').checked = currentSiteConfig.fullscreenEvents.fullscreenchange;
            document.getElementById('fullscreen-browser-specific').checked = 
                currentSiteConfig.fullscreenEvents.webkitfullscreenchange && 
                currentSiteConfig.fullscreenEvents.mozfullscreenchange && 
                currentSiteConfig.fullscreenEvents.msfullscreenchange;
            
            // 鼠标事件
            document.getElementById('mouse-movement-mousemove').checked = currentSiteConfig.mouseEvents.mousemove;
            document.getElementById('mouse-movement-wheel').checked = currentSiteConfig.mouseEvents.mousewheel;
            
            // 鼠标点击和悬停事件总开关
            const areAllClickEventsChecked = currentSiteConfig.mouseEvents.click;
            document.getElementById('mouse-click-events').checked = areAllClickEventsChecked;
            
            const areAllHoverEventsChecked = currentSiteConfig.mouseEvents.hover;
            document.getElementById('mouse-hover-events').checked = areAllHoverEventsChecked;
            
            // 高级事件拦截
            const areAllKeyboardEventsChecked = 
                currentSiteConfig.keyboardEvents.keydown &&
                currentSiteConfig.keyboardEvents.keyup &&
                currentSiteConfig.keyboardEvents.keypress;
            document.getElementById('keyboard-events').checked = areAllKeyboardEventsChecked;
            
            const areAllWindowEventsChecked = 
                currentSiteConfig.windowEvents.resize &&
                currentSiteConfig.windowEvents.scroll &&
                currentSiteConfig.windowEvents.beforeunload;
            document.getElementById('window-events').checked = areAllWindowEventsChecked;
            
            const areAllClipboardEventsChecked = 
                currentSiteConfig.clipboardEvents.copy &&
                currentSiteConfig.clipboardEvents.cut &&
                currentSiteConfig.clipboardEvents.paste;
            document.getElementById('clipboard-events').checked = areAllClipboardEventsChecked;
            
            // 导航事件拦截配置
            document.getElementById('navigation-events-popstate').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.popstate;
            document.getElementById('navigation-events-hashchange').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.hashchange;
            document.getElementById('navigation-events').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.popstate && currentSiteConfig.navigationEvents.hashchange;
            
            // 触摸事件拦截配置
            document.getElementById('touch-events-touchstart').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchstart;
            document.getElementById('touch-events-touchmove').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchmove;
            document.getElementById('touch-events-touchend').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchend;
            document.getElementById('touch-events').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchstart && currentSiteConfig.touchEvents.touchmove && currentSiteConfig.touchEvents.touchend;
            
            // 表单事件拦截配置
            document.getElementById('form-events-change').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.change;
            document.getElementById('form-events-input').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.input;
            document.getElementById('form-events-submit').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.submit;
            document.getElementById('form-events').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.change && currentSiteConfig.formEvents.input && currentSiteConfig.formEvents.submit;
            
            // 在线/离线状态检测配置 - 始终设置为在线状态
            document.getElementById('connectivity-events-enabled').checked = true;
            document.getElementById('connectivity-event-online').checked = true;
            document.getElementById('connectivity-event-offline').checked = true;
            document.getElementById('connectivity-override-online').checked = true;
            
            // 设备信息保护配置
            document.getElementById('device-info-enabled').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.enabled;
            document.getElementById('device-info-navigator-properties').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.navigatorProperties;
            document.getElementById('device-info-screen-info').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.screenInfo;
            
            // 虚拟设备信息配置
            document.getElementById('device-emulate-enabled').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.emulateDevice;
            document.getElementById('device-type').value = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.deviceType || 'desktop';
            
            // 自定义设备配置
            const customDevice = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.customDevice || {};
            document.getElementById('custom-user-agent').value = customDevice.userAgent || '';
            document.getElementById('custom-platform').value = customDevice.platform || '';
            document.getElementById('custom-screen-width').value = customDevice.screenWidth || '';
            document.getElementById('custom-screen-height').value = customDevice.screenHeight || '';
            document.getElementById('custom-avail-width').value = customDevice.availWidth || '';
            document.getElementById('custom-avail-height').value = customDevice.availHeight || '';
            
            // 根据设备类型显示/隐藏自定义设备配置区域
            document.getElementById('device-type').addEventListener('change', function() {
                document.getElementById('custom-device-config').style.display = this.value === 'custom' ? 'block' : 'none';
            });
            
            // 初始显示/隐藏自定义设备配置区域
            document.getElementById('custom-device-config').style.display = document.getElementById('device-type').value === 'custom' ? 'block' : 'none';
            
            // 虚拟鼠标配置
            const vmConfig = currentSiteConfig.virtualMouse;
            console.log('[反监控] 加载虚拟鼠标配置:', vmConfig);
            
            document.getElementById('virtual-mouse-enabled').checked = vmConfig.enabled;
            document.getElementById('virtual-mouse-activate-on-leave').checked = vmConfig.activateOnLeave;
            document.getElementById('virtual-mouse-deactivate-on-enter').checked = vmConfig.deactivateOnEnter;
            document.getElementById('virtual-mouse-show-cursor').checked = vmConfig.showCursor;
            document.getElementById('virtual-mouse-color').value = hexToRgb(vmConfig.cursorColor) || '#000000';
            document.getElementById('virtual-mouse-color-text').value = vmConfig.cursorColor;
            document.getElementById('virtual-mouse-size').value = vmConfig.cursorSize;
            document.getElementById('virtual-mouse-opacity').value = vmConfig.cursorOpacity;
            document.getElementById('virtual-mouse-opacity-value').textContent = vmConfig.cursorOpacity;
            document.getElementById('virtual-mouse-enhanced').checked = vmConfig.enhancedVisual;
            
            // 确保路径模式有有效值
            const pathMode = vmConfig.pathMode || 'random';
            document.getElementById('virtual-mouse-path').value = pathMode;
            debugLog('设置路径模式:', pathMode);
            
            document.getElementById('virtual-mouse-speed').value = vmConfig.moveSpeed;
            document.getElementById('virtual-mouse-speed-value').textContent = vmConfig.moveSpeed;
            document.getElementById('virtual-mouse-interval').value = vmConfig.moveInterval;
            document.getElementById('virtual-mouse-hover-only').checked = vmConfig.hoverOnly;
            document.getElementById('virtual-mouse-hover-interval').value = vmConfig.hoverInterval;
            document.getElementById('virtual-mouse-area').value = vmConfig.activityArea;
            
            // 自定义区域设置
            document.getElementById('custom-area-x1').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.x1) || 0;
            document.getElementById('custom-area-y1').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.y1) || 0;
            document.getElementById('custom-area-x2').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.x2) || 0;
            document.getElementById('custom-area-y2').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.y2) || 0;
            
            // 定点放置设置
            document.getElementById('virtual-mouse-fixed-position').checked = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.enabled) || false;
            document.getElementById('fixed-position-x').value = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.x) || 0;
            document.getElementById('fixed-position-y').value = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.y) || 0;
            
            // 按钮配置
            const siteButtonConfig = currentSiteConfig.buttonConfig || {
                text: '反监控',
                position: 'bottom-right',
                customX: '20px',
                customY: '20px',
                backgroundColor: '#ff4444',
                textColor: 'white',
                width: 'auto',
                height: 'auto',
                padding: '10px',
                fontSize: '14px',
                borderRadius: '4px',
                opacity: 1,
                zIndex: '999999'
            };
            document.getElementById('button-text').value = siteButtonConfig.text;
            document.getElementById('button-position').value = siteButtonConfig.position;
            document.getElementById('button-custom-x').value = siteButtonConfig.customX;
            document.getElementById('button-custom-y').value = siteButtonConfig.customY;
            document.getElementById('button-bg-color').value = siteButtonConfig.backgroundColor;
            document.getElementById('button-bg-color-text').value = siteButtonConfig.backgroundColor;
            document.getElementById('button-text-color').value = siteButtonConfig.textColor;
            document.getElementById('button-text-color-text').value = siteButtonConfig.textColor;
            document.getElementById('button-width').value = siteButtonConfig.width;
            document.getElementById('button-height').value = siteButtonConfig.height;
            document.getElementById('button-padding').value = siteButtonConfig.padding;
            document.getElementById('button-font-size').value = siteButtonConfig.fontSize;
            document.getElementById('button-border-radius').value = siteButtonConfig.borderRadius;
            document.getElementById('button-opacity').value = siteButtonConfig.opacity;
            document.getElementById('button-z-index').value = siteButtonConfig.zIndex;

            // 控制自定义区域设置的显示/隐藏
            function toggleCustomAreaSettings() {
                const container = document.getElementById('custom-area-settings');
                const area = document.getElementById('virtual-mouse-area').value;
                container.style.display = area === 'custom' ? 'block' : 'none';
            }
            toggleCustomAreaSettings();
            document.getElementById('virtual-mouse-area').addEventListener('change', toggleCustomAreaSettings);

            // 控制定点位置设置的显示/隐藏
            function toggleFixedPositionSettings() {
                const container = document.getElementById('fixed-position-settings');
                const enabled = document.getElementById('virtual-mouse-fixed-position').checked;
                container.style.display = enabled ? 'block' : 'none';
            }
            toggleFixedPositionSettings();
            document.getElementById('virtual-mouse-fixed-position').addEventListener('change', toggleFixedPositionSettings);

            // 控制自定义位置输入框的显示/隐藏
            function toggleCustomPosition() {
                const container = document.getElementById('custom-position-container');
                const position = document.getElementById('button-position').value;
                container.style.display = position === 'custom' ? 'block' : 'none';
            }
            toggleCustomPosition();
            document.getElementById('button-position').addEventListener('change', toggleCustomPosition);

            // 颜色选择器与文本框联动
            document.getElementById('button-bg-color').addEventListener('input', function() {
                document.getElementById('button-bg-color-text').value = this.value;
            });
            document.getElementById('button-bg-color-text').addEventListener('input', function() {
                document.getElementById('button-bg-color').value = this.value;
            });
            document.getElementById('button-text-color').addEventListener('input', function() {
                document.getElementById('button-text-color-text').value = this.value;
            });
            document.getElementById('button-text-color-text').addEventListener('input', function() {
                document.getElementById('button-text-color').value = this.value;
            });
            
            // 虚拟鼠标颜色选择器与文本框联动
            document.getElementById('virtual-mouse-color').addEventListener('input', function() {
                document.getElementById('virtual-mouse-color-text').value = this.value;
            });
            document.getElementById('virtual-mouse-color-text').addEventListener('input', function() {
                document.getElementById('virtual-mouse-color').value = this.value;
            });

            // 虚拟鼠标速度滑块显示
            document.getElementById('virtual-mouse-speed').addEventListener('input', function() {
                document.getElementById('virtual-mouse-speed-value').textContent = this.value;
            });
            
            // 虚拟鼠标透明度滑块显示
            document.getElementById('virtual-mouse-opacity').addEventListener('input', function() {
                document.getElementById('virtual-mouse-opacity-value').textContent = this.value;
            });
            
            // 路径模式变更时立即应用
            document.getElementById('virtual-mouse-path').addEventListener('change', function() {
                console.log('[反监控] 路径模式变更为:', this.value);
                // 如果虚拟鼠标正在运行，先停止再重新启动以应用新的路径模式
                if (window.virtualMouseInterval) {
                    stopVirtualMouse();
                    // 重置虚拟鼠标状态
                    virtualMouseState.randomAngle = null;
                    virtualMouseState.clickAngle = null;
                    virtualMouseState.clickModeShouldClick = false;
                    virtualMouseState.smoothAngle = null;
                    virtualMouseState.patternX = null;
                    virtualMouseState.hoverTime = null;
                    // 重新启动虚拟鼠标
                    startVirtualMouse();
                }
            });

            // 事件监听：打开/关闭配置面板
            if (trigger) {
                trigger.addEventListener('click', () => {
                    panel.classList.toggle('visible');
                    console.log('[反监控脚本] 配置面板显示状态切换');
                });
            }

            // 关闭配置面板
            document.querySelector('.anti-monitor-close').addEventListener('click', () => {
                panel.classList.remove('visible');
            });

            // 网站选择器变化：切换不同网站的配置
            document.getElementById('site-selector').addEventListener('change', function() {
                // 在切换网站配置前，先保存当前网站的配置
                const currentSiteKey = globalConfig.currentSiteKey;
                const currentSiteConfig = getCurrentSiteConfig();
                
                // 确保当前配置已保存
                if (currentSiteKey && currentSiteConfig) {
                    globalConfig.sites[currentSiteKey] = currentSiteConfig;
                    console.log(`[反监控] 保存当前网站配置: ${currentSiteKey}`);
                }
                
                // 切换到新的网站配置
                const selectedKey = unescapeHtml(this.value);
                if (selectedKey && selectedKey in globalConfig.sites) {
                    globalConfig.currentSiteKey = selectedKey;
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                    // 移除页面刷新，改为重新加载配置并更新UI
                    reloadConfigPanel();
                }
            });
            
            // 添加当前网站到配置列表
            document.getElementById('add-new-site').addEventListener('click', () => {
                // 获取当前网站的标识，支持本地文件
                let newSiteKey;
                if (window.location.protocol === 'file:') {
                    // 对于本地文件，使用规范化的路径作为配置键
                    newSiteKey = 'file://' + window.location.pathname.replace(/\\/g, '/');
                } else {
                    // 对于普通网站，使用主机名
                    newSiteKey = window.location.hostname;
                }
                
                if (!(newSiteKey in globalConfig.sites)) {
                    // 创建新网站配置，默认启用按钮显示
                    const newSiteConfig = JSON.parse(JSON.stringify(defaultSiteConfig));
                    newSiteConfig.showButton = true;
                    // 确保新添加的网站配置能够显示按钮，即使enabled为false
                    globalConfig.sites[newSiteKey] = newSiteConfig;
                    globalConfig.currentSiteKey = newSiteKey;
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                    reloadConfigPanel();
                } else {
                    alert('该网站已在配置列表中');
                }
            });
            
            // 删除选中网站的配置
            document.getElementById('delete-site').addEventListener('click', () => {
                const selectedKey = unescapeHtml(document.getElementById('site-selector').value);
                if (selectedKey && selectedKey in globalConfig.sites) {
                    if (confirm(`确定要删除 ${selectedKey} 的配置吗？`)) {
                        delete globalConfig.sites[selectedKey];
                        // 如果删除的是当前网站，切换到第一个网站或创建新的
                        if (selectedKey === globalConfig.currentSiteKey) {
                            const siteKeys = Object.keys(globalConfig.sites);
                            globalConfig.currentSiteKey = siteKeys.length > 0 ? siteKeys[0] : '';
                        }
                        if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', globalConfig);
                        } else {
                            console.log('[反监控脚本] 非油猴环境，配置未保存');
                        }
                        reloadConfigPanel();
                    }
                } else {
                    alert('请先选择一个网站');
                }
            });

            // 全屏事件的浏览器特定选项联动
            document.getElementById('fullscreen-browser-specific').addEventListener('change', function() {
                const checked = this.checked;
                document.getElementById('fullscreen-change').checked = checked;
            });

            // 鼠标事件拦截总开关联动
            document.getElementById('mouse-click-events').addEventListener('change', function() {
                const checked = this.checked;
                // 不自动勾选click事件，因为它会影响正常使用
                document.getElementById('mouse-movement-mousemove').checked = checked;
            });
            
            document.getElementById('mouse-hover-events').addEventListener('change', function() {
                const checked = this.checked;
            });

            // 高级事件拦截总开关联动
            document.getElementById('keyboard-events').addEventListener('change', function() {
                const checked = this.checked;
            });
            
            document.getElementById('window-events').addEventListener('change', function() {
                const checked = this.checked;
            });
            
            document.getElementById('clipboard-events').addEventListener('change', function() {
                const checked = this.checked;
            });

            // 虚拟鼠标：从当前视图设置自定义区域
            document.getElementById('set-custom-area-from-view').addEventListener('click', function() {
                document.getElementById('custom-area-x1').value = 0;
                document.getElementById('custom-area-y1').value = 0;
                document.getElementById('custom-area-x2').value = window.innerWidth;
                document.getElementById('custom-area-y2').value = window.innerHeight;
            });
            
            // 虚拟鼠标：使用当前鼠标位置作为定点
            document.getElementById('set-fixed-position-from-cursor').addEventListener('click', function() {
                // 创建临时鼠标移动监听器获取当前位置
                const tempGetCurrentCursorPosition = function(e) {
                    document.getElementById('fixed-position-x').value = Math.round(e.clientX);
                    document.getElementById('fixed-position-y').value = Math.round(e.clientY);
                    document.removeEventListener('mousemove', tempGetCurrentCursorPosition);
                    alert('已设置为当前鼠标位置');
                };
                document.addEventListener('mousemove', tempGetCurrentCursorPosition);
                alert('请移动鼠标到目标位置');
            });

            // 测试虚拟鼠标
            document.getElementById('test-virtual-mouse').addEventListener('click', function() {
                const currentState = virtualMouseInterval !== null;
                if (currentState) {
                    stopVirtualMouse();
                    this.textContent = '测试虚拟鼠标';
                } else {
                    startVirtualMouse();
                    this.textContent = '停止测试';
                }
            });
            
            // 测试虚拟鼠标点击效果
            document.getElementById('test-virtual-mouse-click').addEventListener('click', function() {
                if (!virtualMouse) {
                    createVirtualMouse();
                }
                showClickEffect();
            });

            // 调试输出控制事件处理器
            const debugEnabled = document.getElementById('debug-enabled');
            const debugLevel = document.getElementById('debug-level');
            const debugTimestamp = document.getElementById('debug-timestamp');
            const debugCategories = {
                virtualMouse: document.getElementById('debug-virtual-mouse'),
                eventBlocking: document.getElementById('debug-event-blocking'),
                deviceInfo: document.getElementById('debug-device-info'),
                config: document.getElementById('debug-config'),
                animation: document.getElementById('debug-animation')
            };

            // 调试输出开关变化
            debugEnabled.addEventListener('change', function() {
                updateDebugConfigFromUI();
            });

            // 调试级别变化
            debugLevel.addEventListener('change', function() {
                updateDebugConfigFromUI();
            });

            // 时间戳开关变化
            debugTimestamp.addEventListener('change', function() {
                updateDebugConfigFromUI();
            });

            // 分类控制变化
            Object.keys(debugCategories).forEach(category => {
                debugCategories[category].addEventListener('change', function() {
                    updateDebugConfigFromUI();
                });
            });

            // 测试调试输出
            document.getElementById('test-debug-output').addEventListener('click', function() {
                testDebugOutput();
            });

            // 清空控制台
            document.getElementById('clear-debug-output').addEventListener('click', function() {
                console.clear();
                debugLogger.info('config', '控制台已清空');
            });

            /**
             * 保存当前网站配置
             * 将当前网站的配置保存到全局配置中
             */
            function saveCurrentSiteConfig() {
                try {
                    const currentSiteKey = globalConfig.currentSiteKey;
                    if (!currentSiteKey) {
                        console.warn('[反监控] 没有当前网站键，无法保存配置');
                        return;
                    }
                    
                    // 获取当前网站配置
                    const currentConfig = getCurrentSiteConfig();
                    
                    // 确保当前网站配置已添加到globalConfig.sites
                    if (!globalConfig.sites[currentSiteKey]) {
                        globalConfig.sites[currentSiteKey] = currentConfig;
                    } else {
                        // 更新现有网站配置
                        globalConfig.sites[currentSiteKey] = currentConfig;
                    }
                    
                    // 保存到GM_setValue
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                        console.log(`[反监控] 已保存网站配置: ${currentSiteKey}`);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                } catch (e) {
                    console.error('[反监控] 保存当前网站配置失败:', e);
                }
            }

            /**
             * 从UI更新调试配置
             */
            function updateDebugConfigFromUI() {
                try {
                    const currentConfig = getCurrentSiteConfig();
                    
                    // 更新调试配置
                    if (!currentConfig.debugConfig) {
                        currentConfig.debugConfig = {};
                    }
                    
                    currentConfig.debugConfig.enabled = debugEnabled.checked;
                    currentConfig.debugConfig.level = debugLevel.value;
                    currentConfig.debugConfig.timestamp = debugTimestamp.checked;
                    
                    // 更新分类控制
                    if (!currentConfig.debugConfig.categories) {
                        currentConfig.debugConfig.categories = {};
                    }
                    
                    Object.keys(debugCategories).forEach(category => {
                        currentConfig.debugConfig.categories[category] = debugCategories[category].checked;
                    });
                    
                    // 应用到调试日志器
                    debugLogger.updateConfig(currentConfig.debugConfig);
                    
                    // 保存配置
                    saveCurrentSiteConfig();
                    
                    debugLogger.info('config', '调试配置已更新:', currentConfig.debugConfig);
                } catch (e) {
                    console.error('[反监控] 更新调试配置失败:', e);
                }
            }

            /**
             * 测试调试输出
             */
            function testDebugOutput() {
                debugLogger.error('test', '这是一条错误信息测试');
                debugLogger.warn('test', '这是一条警告信息测试');
                debugLogger.info('test', '这是一般信息测试');
                debugLogger.debug('test', '这是调试信息测试');
                debugLogger.verbose('test', '这是详细信息测试');
                
                // 测试分类输出
                debugLogger.error('virtualMouse', '虚拟鼠标错误测试');
                debugLogger.warn('eventBlocking', '事件拦截警告测试');
                debugLogger.info('deviceInfo', '设备信息测试');
                debugLogger.debug('config', '配置管理调试测试');
                debugLogger.verbose('animation', '动画效果详细测试');
                
                console.log('=== 调试输出测试完成 ===');
                console.log('当前配置:', debugLogger);
            }

            // 保存配置
            document.getElementById('save-config').addEventListener('click', () => {
                try {
                    const currentSiteKey = globalConfig.currentSiteKey;
                    if (!currentSiteKey) return;
                    
                    // 保存当前网站配置
                    const siteConfig = globalConfig.sites[currentSiteKey];
                    
                    siteConfig.enabled = document.getElementById('site-enabled').checked;
                    
                    // 页面可见性事件设置
                    siteConfig.pageVisibilityEvents = {
                        visibilitychange: document.getElementById('page-visibility-visibilitychange').checked,
                        webkitvisibilitychange: document.getElementById('page-visibility-webkit').checked,
                        overrideVisibilityState: document.getElementById('page-visibility-override').checked
                    };
                    
                    // 焦点事件设置
                    siteConfig.focusEvents = {
                        blur: document.getElementById('focus-event-blur').checked,
                        focus: document.getElementById('focus-event-focus').checked
                    };
                    
                    // 全屏事件设置
                    const fullscreenBrowserSpecific = document.getElementById('fullscreen-browser-specific').checked;
                    siteConfig.fullscreenEvents = {
                        fullscreenchange: document.getElementById('fullscreen-change').checked,
                        webkitfullscreenchange: fullscreenBrowserSpecific,
                        mozfullscreenchange: fullscreenBrowserSpecific,
                        msfullscreenchange: fullscreenBrowserSpecific
                    };
                    
                    // 鼠标事件设置
                    siteConfig.mouseEvents = {
                        mousemove: document.getElementById('mouse-movement-mousemove').checked,
                        mousewheel: document.getElementById('mouse-movement-wheel').checked,
                        click: document.getElementById('mouse-click-events').checked,
                        hover: document.getElementById('mouse-hover-events').checked
                    };
                    
                    // 键盘事件设置
                    const keyboardEventsChecked = document.getElementById('keyboard-events').checked;
                    siteConfig.keyboardEvents = {
                        keydown: keyboardEventsChecked,
                        keyup: keyboardEventsChecked,
                        keypress: keyboardEventsChecked
                    };
                    
                    // 窗口事件设置
                    const windowEventsChecked = document.getElementById('window-events').checked;
                    siteConfig.windowEvents = {
                        resize: windowEventsChecked,
                        scroll: windowEventsChecked,
                        beforeunload: windowEventsChecked
                    };
                    
                    // 剪贴板事件设置
                    const clipboardEventsChecked = document.getElementById('clipboard-events').checked;
                    siteConfig.clipboardEvents = {
                        copy: clipboardEventsChecked,
                        cut: clipboardEventsChecked,
                        paste: clipboardEventsChecked
                    };
                    
                    // 导航事件设置
                    const navigationEventsAllChecked = document.getElementById('navigation-events').checked;
                    siteConfig.navigationEvents = {
                        popstate: navigationEventsAllChecked || document.getElementById('navigation-events-popstate').checked,
                        hashchange: navigationEventsAllChecked || document.getElementById('navigation-events-hashchange').checked
                    };
                    
                    // 触摸事件设置
                    const touchEventsAllChecked = document.getElementById('touch-events').checked;
                    siteConfig.touchEvents = {
                        touchstart: touchEventsAllChecked || document.getElementById('touch-events-touchstart').checked,
                        touchmove: touchEventsAllChecked || document.getElementById('touch-events-touchmove').checked,
                        touchend: touchEventsAllChecked || document.getElementById('touch-events-touchend').checked
                    };
                    
                    // 表单事件设置
                    const formEventsAllChecked = document.getElementById('form-events').checked;
                    siteConfig.formEvents = {
                        change: formEventsAllChecked || document.getElementById('form-events-change').checked,
                        input: formEventsAllChecked || document.getElementById('form-events-input').checked,
                        submit: formEventsAllChecked || document.getElementById('form-events-submit').checked
                    };
                    
                    // 在线/离线状态检测设置 - 始终设置为在线状态
                    siteConfig.connectivityEvents = {
                        enabled: true,
                        blockOnlineEvent: true,
                        blockOfflineEvent: true,
                        overrideOnlineState: true
                    };
                    
                    // 设备信息保护设置
                    const deviceInfoEnabled = document.getElementById('device-info-enabled').checked;
                    siteConfig.deviceInfo = {
                        enabled: deviceInfoEnabled,
                        navigatorProperties: deviceInfoEnabled && document.getElementById('device-info-navigator-properties').checked,
                        screenInfo: deviceInfoEnabled && document.getElementById('device-info-screen-info').checked,
                        emulateDevice: deviceInfoEnabled && document.getElementById('device-emulate-enabled').checked,
                        deviceType: document.getElementById('device-type').value,
                        customDevice: {
                            userAgent: document.getElementById('custom-user-agent').value || '',
                            platform: document.getElementById('custom-platform').value || '',
                            screenWidth: parseInt(document.getElementById('custom-screen-width').value) || null,
                            screenHeight: parseInt(document.getElementById('custom-screen-height').value) || null,
                            availWidth: parseInt(document.getElementById('custom-avail-width').value) || null,
                            availHeight: parseInt(document.getElementById('custom-avail-height').value) || null
                        }
                    };
                    
                    // 虚拟鼠标设置
                    const pathMode = document.getElementById('virtual-mouse-path').value;
                    debugLog('保存路径模式:', pathMode);
                    siteConfig.virtualMouse = {
                        enabled: document.getElementById('virtual-mouse-enabled').checked,
                        activateOnLeave: document.getElementById('virtual-mouse-activate-on-leave').checked,
                        deactivateOnEnter: document.getElementById('virtual-mouse-deactivate-on-enter').checked,
                        moveSpeed: parseInt(document.getElementById('virtual-mouse-speed').value),
                        moveInterval: parseInt(document.getElementById('virtual-mouse-interval').value),
                        pathMode: pathMode,
                        showCursor: document.getElementById('virtual-mouse-show-cursor').checked,
                        cursorOpacity: parseFloat(document.getElementById('virtual-mouse-opacity').value),
                        cursorSize: parseInt(document.getElementById('virtual-mouse-size').value),
                        cursorColor: document.getElementById('virtual-mouse-color-text').value,
                        activityArea: document.getElementById('virtual-mouse-area').value,
                        customArea: {
                            x1: parseInt(document.getElementById('custom-area-x1').value) || 0,
                            y1: parseInt(document.getElementById('custom-area-y1').value) || 0,
                            x2: parseInt(document.getElementById('custom-area-x2').value) || 0,
                            y2: parseInt(document.getElementById('custom-area-y2').value) || 0
                        },
                        fixedPosition: {
                            enabled: document.getElementById('virtual-mouse-fixed-position').checked,
                            x: parseInt(document.getElementById('fixed-position-x').value) || 0,
                            y: parseInt(document.getElementById('fixed-position-y').value) || 0
                        },
                        hoverOnly: document.getElementById('virtual-mouse-hover-only').checked,
                        hoverInterval: parseInt(document.getElementById('virtual-mouse-hover-interval').value),
                        enhancedVisual: document.getElementById('virtual-mouse-enhanced').checked
                    };
                    
                    // 保存网站特定的按钮显示设置
                    siteConfig.showButton = true;
                    
                    // 确保当前网站配置已添加到globalConfig.sites
                    // 使用currentSiteKey而不是getCurrentSiteKey()，确保保存到正确的网站配置
                    const siteKeyToSave = globalConfig.currentSiteKey;
                    if (!globalConfig.sites[siteKeyToSave]) {
                        globalConfig.sites[siteKeyToSave] = siteConfig;
                        globalConfig.currentSiteKey = siteKeyToSave;
                    } else {
                        // 更新现有网站配置
                        globalConfig.sites[siteKeyToSave] = siteConfig;
                    }
                    
                    // 保存按钮配置到当前网站配置
                    siteConfig.buttonConfig = {
                        position: document.getElementById('button-position').value,
                        customX: document.getElementById('button-custom-x').value || '20px',
                        customY: document.getElementById('button-custom-y').value || '20px',
                        backgroundColor: document.getElementById('button-bg-color-text').value || '#ff4444',
                        textColor: document.getElementById('button-text-color-text').value || '#ffffff',
                        width: document.getElementById('button-width').value || 'auto',
                        height: document.getElementById('button-height').value || 'auto',
                        padding: document.getElementById('button-padding').value || '8px 12px',
                        fontSize: document.getElementById('button-font-size').value || '14px',
                        borderRadius: document.getElementById('button-border-radius').value || '4px',
                        opacity: document.getElementById('button-opacity').value || '1',
                        zIndex: document.getElementById('button-z-index').value || '999999',
                        text: document.getElementById('button-text').value || '反监控'
                    };
                    
                    // 保存高级拦截规则配置
                    siteConfig.advancedBlocking = {
                        enabled: document.getElementById('advanced-blocking-enabled').checked,
                        rules: [] // 规则将通过单独的函数保存
                    };
                    
                    // 保存日志配置
                    siteConfig.logging = {
                        enabled: document.getElementById('logging-enabled').checked,
                        level: document.getElementById('log-level').value,
                        maxLogEntries: 1000
                    };
                    
                    // 保存统计配置
                    siteConfig.stats = {
                        enabled: document.getElementById('stats-enabled').checked,
                        trackSuccessRate: true,
                        trackEventTypes: true
                    };
                    
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                    alert('配置已保存！');
                    
                    // 立即应用按钮样式和文字（修复：在未设置配置的新网站确认选项后显示反监控按钮）
                    let trigger = document.getElementById('anti-monitor-trigger');
                    if (trigger) {
                        applyButtonStyles(trigger);
                    } else if (siteConfig.enabled) {
                        // 如果按钮不存在但反监控已启用，则创建按钮
                        console.log('[反监控脚本] 创建新的触发按钮');
                        trigger = document.createElement('button');
                        trigger.id = 'anti-monitor-trigger';
                        document.body.appendChild(trigger);
                        applyButtonStyles(trigger);
                        
                        // 添加点击事件
                        trigger.addEventListener('click', () => {
                            const panel = document.getElementById('anti-monitor-config');
                            panel.classList.toggle('visible');
                        });
                    }
                    updateVirtualMouseStyle();
                    
                    // 重新应用拦截
                    blockEventListeners();
                } catch (e) {
                    console.error('[反监控脚本] 保存配置失败:', e);
                    alert('保存配置失败，请查看控制台错误信息');
                }
            });

            // 重置当前网站配置
            document.getElementById('reset-current-config').addEventListener('click', () => {
                const currentSiteKey = globalConfig.currentSiteKey;
                if (currentSiteKey && confirm(`确定要重置 ${currentSiteKey} 的配置吗？`)) {
                    globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                    reloadConfigPanel();
                }
            });

            // 重置所有配置
            document.getElementById('reset-all-config').addEventListener('click', () => {
                if (confirm('确定要重置所有配置吗？这将删除所有网站的自定义设置！')) {
                    if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', defaultGlobalConfig);
                        } else {
                            console.log('[反监控脚本] 非油猴环境，配置未保存');
                        }
                    reloadConfigPanel();
                }
            });
            
            // 高级拦截规则配置
            document.getElementById('add-rule').addEventListener('click', () => {
                const container = document.getElementById('rules-container');
                const ruleId = `rule-${Date.now()}`;
                const ruleHTML = `
                    <div class="rule-item" id="${ruleId}" style="margin: 10px 0; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <label style="flex: 0 0 60px;">
                                <input type="checkbox" class="rule-enabled" checked>
                                启用
                            </label>
                            <div style="flex: 1;">
                                <label>事件类型：</label>
                                <input type="text" class="rule-event-type" placeholder="如：click, mousemove" style="width: 150px; margin-right: 10px;">
                                <label>元素选择器：</label>
                                <input type="text" class="rule-selector" placeholder="如：.tracking-element" style="width: 200px; margin-right: 10px;">
                                <label>目标正则：</label>
                                <input type="text" class="rule-target-regex" placeholder="如：tracking-.*" style="width: 150px;">
                            </div>
                            <button class="remove-rule" data-rule-id="${ruleId}">删除</button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', ruleHTML);
                
                // 添加删除规则事件
                document.querySelector(`.remove-rule[data-rule-id="${ruleId}"]`).addEventListener('click', function() {
                    const ruleItem = document.getElementById(this.dataset.ruleId);
                    if (ruleItem) {
                        ruleItem.remove();
                    }
                });
            });
            
            document.getElementById('clear-rules').addEventListener('click', () => {
                if (confirm('确定要清除所有高级拦截规则吗？')) {
                    document.getElementById('rules-container').innerHTML = '';
                }
            });
            
            // 日志和统计配置
            document.getElementById('view-logs').addEventListener('click', () => {
                const logs = blockLog.getEntries();
                const logStr = logs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString();
                    return `${time} - ${log.action}: ${log.eventType} (${log.target})`;
                }).join('\n');
                
                if (logStr) {
                    alert(`拦截日志 (共${logs.length}条):\n\n${logStr}`);
                } else {
                    alert('暂无拦截日志');
                }
            });
            
            document.getElementById('clear-logs').addEventListener('click', () => {
                if (confirm('确定要清除所有拦截日志吗？')) {
                    blockLog.clear();
                    alert('日志已清除');
                }
            });
            
            document.getElementById('view-stats').addEventListener('click', () => {
                const stats = blockStats.getStats();
                let statsStr = `拦截统计：\n\n`;
                statsStr += `总事件数：${stats.totalEvents}\n`;
                statsStr += `拦截事件数：${stats.blockedEvents}\n`;
                statsStr += `拦截成功率：${stats.successRate}\n\n`;
                statsStr += `按事件类型统计：\n`;
                
                for (const eventType in stats.eventTypeStats) {
                    const eventStats = stats.eventTypeStats[eventType];
                    const successRate = eventStats.total > 0 ? 
                        ((eventStats.blocked / eventStats.total) * 100).toFixed(2) : '0.00';
                    statsStr += `${eventType}: ${eventStats.blocked}/${eventStats.total} (${successRate}%)\n`;
                }
                
                alert(statsStr);
            });
            
            document.getElementById('reset-stats').addEventListener('click', () => {
                if (confirm('确定要重置所有拦截统计吗？')) {
                    blockStats.reset();
                    alert('统计已重置');
                }
            });
            
            // 初始化配置面板
            function initConfigPanel() {
                const currentSiteConfig = getCurrentSiteConfig();
                
                // 初始化高级拦截规则
                if (currentSiteConfig.advancedBlocking) {
                    document.getElementById('advanced-blocking-enabled').checked = currentSiteConfig.advancedBlocking.enabled;
                }
                
                // 初始化日志配置
                if (currentSiteConfig.logging) {
                    document.getElementById('logging-enabled').checked = currentSiteConfig.logging.enabled;
                    document.getElementById('log-level').value = currentSiteConfig.logging.level || 'info';
                }
                
                // 初始化统计配置
                if (currentSiteConfig.stats) {
                    document.getElementById('stats-enabled').checked = currentSiteConfig.stats.enabled;
                }
                
                // 初始化调试配置
                if (currentSiteConfig.debugConfig) {
                    const debugConfig = currentSiteConfig.debugConfig;
                    
                    // 设置基本配置
                    if (debugEnabled) debugEnabled.checked = debugConfig.enabled || false;
                    if (debugLevel) debugLevel.value = debugConfig.level || 'ERROR';
                    if (debugTimestamp) debugTimestamp.checked = debugConfig.timestamp !== false;
                    
                    // 设置分类控制
                    if (debugConfig.categories) {
                        Object.keys(debugCategories).forEach(category => {
                            if (debugCategories[category]) {
                                debugCategories[category].checked = debugConfig.categories[category] || false;
                            }
                        });
                    }
                }
            }
            
            // 调用初始化函数
            initConfigPanel();

        } catch (e) {
            console.error('[反监控脚本] 创建配置界面失败:', e);
            // 显示一个简化的备用按钮
            showFallbackButton();
        }
    }

    /**
     * 重新加载配置面板
     * 当切换网站配置时，重新加载配置并更新UI而不刷新整个页面
     * 保存并恢复用户选择的网站配置
     */
    function reloadConfigPanel() {
        try {
            console.log('[反监控脚本] 重新加载配置面板');
            
            // 获取当前配置面板
            const panel = document.getElementById('anti-monitor-config');
            if (!panel) {
                console.error('[反监控脚本] 配置面板不存在');
                return;
            }
            
            // 保存当前面板的显示状态
            const wasVisible = panel.classList.contains('visible');
            
            // 保存当前选中的网站配置键
            const selectedSiteKey = globalConfig.currentSiteKey;
            
            // 在重新加载配置面板前，先保存当前网站的配置
            const currentSiteConfig = getCurrentSiteConfig();
            if (selectedSiteKey && currentSiteConfig) {
                globalConfig.sites[selectedSiteKey] = currentSiteConfig;
                console.log(`[反监控] 重新加载前保存网站配置: ${selectedSiteKey}`);
                
                // 保存到存储
                if (typeof GM_setValue === 'function') {
                    GM_setValue('antiMonitorGlobalConfig', globalConfig);
                }
            }
            
            // 移除旧的配置面板
            panel.remove();
            
            // 创建新的配置面板
            createConfigUI();
            
            // 恢复面板的显示状态
            const newPanel = document.getElementById('anti-monitor-config');
            if (newPanel && wasVisible) {
                newPanel.classList.add('visible');
            }
            
            // 恢复之前选中的网站配置
            if (selectedSiteKey) {
                globalConfig.currentSiteKey = selectedSiteKey;
                // 更新下拉选择框的选中状态
                const siteSelector = document.getElementById('site-selector');
                if (siteSelector) {
                    for (let i = 0; i < siteSelector.options.length; i++) {
                        if (unescapeHtml(siteSelector.options[i].value) === selectedSiteKey) {
                            siteSelector.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[反监控脚本] 重新加载配置面板失败:', e);
        }
    }

    /**
     * 显示备用按钮（当主配置界面创建失败时）
     */
    function showFallbackButton() {
        try {
            // 检查是否在主窗口环境
            if (!isInMainWindow()) {
                console.log('[反监控脚本] 在iframe/object/embed中，不创建备用按钮');
                return;
            }
            
            console.log('[反监控脚本] 显示备用按钮');
            const fallbackBtn = document.createElement('button');
            fallbackBtn.id = 'anti-monitor-fallback';
            
            // 获取当前网站的按钮配置
            const siteConfig = getCurrentSiteConfig();
            const btnConfig = siteConfig.buttonConfig || {
                text: '反监控配置',
                backgroundColor: '#ff4444',
                textColor: 'white',
                padding: '10px',
                borderRadius: '4px',
                zIndex: '999999'
            };
            
            fallbackBtn.textContent = btnConfig.text || '反监控配置';
            fallbackBtn.style.position = 'fixed';
            fallbackBtn.style.bottom = '20px';
            fallbackBtn.style.right = '20px';
            fallbackBtn.style.zIndex = btnConfig.zIndex || '999999';
            fallbackBtn.style.padding = btnConfig.padding || '10px';
            fallbackBtn.style.backgroundColor = btnConfig.backgroundColor || '#ff4444';
            fallbackBtn.style.color = btnConfig.textColor || 'white';
            fallbackBtn.style.border = 'none';
            fallbackBtn.style.borderRadius = btnConfig.borderRadius || '4px';
            fallbackBtn.style.cursor = 'pointer';
            
            fallbackBtn.addEventListener('click', () => {
                alert('反监控脚本已运行，但配置界面加载失败。\n请尝试刷新页面或检查控制台错误信息。');
            });
            
            document.body.appendChild(fallbackBtn);
        } catch (e) {
            console.error('[反监控脚本] 创建备用按钮失败:', e);
        }
    }

    /**
     * 辅助函数：HTML转义
     */
    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, function(match) {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return entities[match];
        });
    }
    
    /**
     * 辅助函数：HTML反转义
     */
    function unescapeHtml(text) {
        if (!text) return '';
        return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, function(match) {
            const entities = {
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&quot;': '"',
                '&#39;': "'"
            };
            return entities[match];
        });
    }
    
    /**
     * 辅助函数：颜色名称转十六进制
     */
    function hexToRgb(color) {
        // 如果已经是十六进制颜色，直接返回
        if (color.startsWith('#')) return color;
        
        // 简单的颜色名称到十六进制的映射
        const colorMap = {
            'black': '#000000',
            'white': '#ffffff',
            'red': '#ff0000',
            'green': '#00ff00',
            'blue': '#0000ff',
            'yellow': '#ffff00',
            'purple': '#800080',
            'orange': '#ffa500'
        };
        
        return colorMap[color.toLowerCase()] || '#000000';
    }

    /**
     * 初始化虚拟鼠标动画样式
     * 添加呼吸缩放和脉冲波纹效果
     */
    function initVirtualMouseAnimations() {
        try {
            const animationCSS = `
                /* 虚拟鼠标呼吸缩放动画 */
                @keyframes virtualMouseBreathing {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                
                /* 虚拟鼠标脉冲波纹动画 */
                @keyframes virtualMousePulse {
                    0% {
                        transform: scale(1);
                        opacity: 0.8;
                    }
                    50% {
                        transform: scale(1.3);
                        opacity: 0.3;
                    }
                    100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
                
                /* 虚拟鼠标出现动画 */
                @keyframes virtualMouseAppear {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    60% {
                        transform: scale(1.2);
                        opacity: 0.9;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                
                /* 虚拟鼠标消失动画 */
                @keyframes virtualMouseDisappear {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0.8);
                        opacity: 0;
                    }
                }
                
                /* 呼吸动画类 */
                .virtual-mouse-breathing {
                    animation: virtualMouseBreathing 2s ease-in-out infinite;
                    will-change: transform;
                }
                
                /* 脉冲动画类 */
                .virtual-mouse-pulse {
                    animation: virtualMousePulse 2s ease-out infinite;
                    will-change: transform, opacity;
                }
                
                /* 出现动画类 */
                .virtual-mouse-appear {
                    animation: virtualMouseAppear 0.3s ease-out forwards;
                }
                
                /* 消失动画类 */
                .virtual-mouse-disappear {
                    animation: virtualMouseDisappear 0.2s ease-in forwards;
                }
                
                /* 低强度动画 */
                .virtual-mouse-low-intensity .virtual-mouse-breathing {
                    animation-duration: 3s;
                }
                
                .virtual-mouse-low-intensity .virtual-mouse-pulse {
                    animation-duration: 3s;
                }
                
                /* 高强度动画 */
                .virtual-mouse-high-intensity .virtual-mouse-breathing {
                    animation-duration: 1.5s;
                }
                
                .virtual-mouse-high-intensity .virtual-mouse-pulse {
                    animation-duration: 1.5s;
                }
                
                /* 性能优化：减少动画复杂度 */
                .virtual-mouse-performance-low .virtual-mouse-pulse {
                    display: none;
                }
                
                .virtual-mouse-performance-low .virtual-mouse-breathing {
                    animation-duration: 4s;
                }
                
                /* 响应式动画调整 */
                @media (max-width: 768px) {
                    .virtual-mouse-breathing {
                        animation-duration: 2.5s;
                    }
                    
                    .virtual-mouse-pulse {
                        animation-duration: 2.5s;
                    }
                }
                
                @media (prefers-reduced-motion: reduce) {
                    .virtual-mouse-breathing,
                    .virtual-mouse-pulse,
                    .virtual-mouse-appear,
                    .virtual-mouse-disappear {
                        animation: none !important;
                    }
                }
            `;
            
            addStyle(animationCSS);
            console.log('[反监控] 虚拟鼠标动画样式初始化完成');
        } catch (e) {
            console.error('[反监控] 初始化虚拟鼠标动画样式失败:', e);
        }
    }

    /**
     * 添加基础样式
     * 添加兼容性处理，在普通环境中使用原生DOM操作
     */
    function addStyle(css) {
        if (typeof GM_addStyle === 'function') {
            // 油猴环境下使用原生API
            GM_addStyle(css);
        } else {
            // 普通环境下使用DOM操作
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            console.log('[反监控脚本] 在普通环境中添加样式');
        }
    }
    
    // 使用兼容的样式添加函数
    addStyle(`
        .anti-monitor-panel {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999 !important;
            width: 800px;
            max-width: 95%;
            max-height: calc(95vh - 40px);
            background: white;
            border-radius: 8px;
            box-shadow: 0 5px 30px rgba(0,0,0,0.3);
            display: none;
            overflow: auto;
        }
        
        .anti-monitor-panel.visible {
            display: block !important;
        }
        
        .anti-monitor-header {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
        }
        
        .anti-monitor-header h3 {
            margin: 0;
            color: #333;
            font-size: 18px;
        }
        
        .anti-monitor-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
        }
        
        .anti-monitor-content {
            padding: 15px 15px 60px 15px;
            overflow-y: auto;
            min-height: 200px;
        }
        
        .config-section {
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .config-section h4 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 16px;
            padding-left: 5px;
            border-left: 3px solid #3498db;
        }
        
        .config-subsection h5 {
            margin: 15px 0 8px 0;
            color: #34495e;
            font-size: 14px;
            padding-left: 5px;
            border-left: 2px solid #95a5a6;
        }
        
        .config-item {
            margin-bottom: 12px;
            padding-left: 5px;
        }
        
        .config-item label {
            display: block;
            margin-bottom: 3px;
            color: #555;
            cursor: pointer;
        }
        
        .config-item input[type="text"],
        .config-item input[type="number"],
        .config-item select,
        .config-item textarea {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        
        .config-item input[type="range"] {
            width: 70%;
            display: inline-block;
        }
        
        .config-item input[type="range"] + span {
            display: inline-block;
            width: 25%;
            text-align: center;
            color: #777;
        }
        
        .config-item input[type="color"] {
            width: 50px;
            height: 30px;
            padding: 2px;
            border: 1px solid #ddd;
            border-radius: 4px;
            vertical-align: middle;
            margin-right: 10px;
        }
        
        .config-item input[type="color"] + input[type="text"] {
            width: calc(100% - 60px);
            display: inline-block;
        }
        
        .config-item button {
            padding: 5px 10px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .config-item button:hover {
            background: #2980b9;
        }
        
        .config-hint {
            margin: 5px 0 0 0;
            font-size: 12px;
            color: #7f8c8d;
            font-style: italic;
            padding-left: 20px;
        }
        
        .config-subgroup {
            margin-left: 20px;
            padding-left: 10px;
            border-left: 1px dashed #ddd;
            margin-bottom: 10px;
        }
        
        .config-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            margin-bottom: 0;
            justify-content: center;
            flex-wrap: wrap;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 4px;
            min-height: 80px;
            position: relative;
            z-index: 10;
        }
        
        .config-actions button {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        #save-config {
            background: #2ecc71;
            color: white;
        }
        
        #save-config:hover {
            background: #27ae60;
        }
        
        #reset-current-config {
            background: #f39c12;
            color: white;
        }
        
        #reset-current-config:hover {
            background: #d35400;
        }
        
        #reset-all-config {
            background: #e74c3c;
            color: white;
        }
        
        #reset-all-config:hover {
            background: #c0392b;
        }
    `);

    /**
     * 清理所有事件监听器和定时器
     * 在页面卸载或脚本需要停止时调用，防止内存泄漏
     */
    function cleanup() {
        try {
            // 停止虚拟鼠标定时器
            if (virtualMouseInterval) {
                clearInterval(virtualMouseInterval);
                virtualMouseInterval = null;
            }

            // 移除虚拟鼠标元素
            if (virtualMouse && virtualMouse.parentNode) {
                virtualMouse.parentNode.removeChild(virtualMouse);
                virtualMouse = null;
            }

            // 移除所有添加的事件监听器
            // 确保只在函数存在时移除事件监听器
            if (typeof handleRealMouseEnter === 'function') {
                document.removeEventListener('mouseenter', handleRealMouseEnter);
            }
            if (typeof handleRealMouseLeave === 'function') {
                document.removeEventListener('mouseleave', handleRealMouseLeave);
            }
            
            console.log('[反监控脚本] 已清理所有资源');
        } catch (e) {
            console.error('[反监控脚本] 清理资源时出错:', e);
        }
    }

    /**
     * 检查是否在主窗口环境（不在iframe/object/embed中）
     */
    function isInMainWindow() {
        try {
            // 检查是否在主窗口（不是iframe）
            if (window !== window.top) {
                return false;
            }
            
            // 检查是否在object或embed元素中
            // 通过检查frameElement属性（如果存在且类型为'object'或'embed'，则不在主窗口）
            if (window.frameElement && 
                (window.frameElement.tagName.toLowerCase() === 'object' || 
                 window.frameElement.tagName.toLowerCase() === 'embed')) {
                return false;
            }
            
            return true;
        } catch (e) {
            // 访问window.top或window.frameElement时出错，可能在受限环境中
            console.error('[反监控脚本] 环境检测出错:', e);
            return false;
        }
    }
    
    /**
     * 获取当前网站的唯一标识符
     * 支持普通网站和本地文件
     * @returns {string} 当前网站的标识符
     */
    function getCurrentSiteKey() {
        try {
            // 对于本地文件，使用规范化的路径作为配置键
            if (window.location.protocol === 'file:') {
                return 'file://' + window.location.pathname.replace(/\\/g, '/');
            } else {
                // 对于普通网站，使用主机名
                return window.location.hostname;
            }
        } catch (e) {
            console.error('[反监控脚本] 获取当前网站标识符失败:', e);
            return '';
        }
    }

    /**
     * 创建油猴脚本管理器菜单
     * 添加菜单项用于控制当前页面是否启用反监控脚本
     */
    function createUserScriptMenu() {
        try {
            // 检测是否在油猴环境中
            const isInGreaseMonkey = typeof GM_registerMenuCommand === 'function' && typeof GM_setValue === 'function';
            
            if (!isInGreaseMonkey) {
                console.log('[反监控脚本] 非油猴环境，跳过菜单创建');
                return;
            }
            
            console.log('[反监控脚本] 创建油猴脚本菜单');
            
            // 获取当前网站配置
            const currentConfig = getCurrentSiteConfig();
            
            // 注册菜单项：启用/禁用当前页面反监控
            GM_registerMenuCommand(
                `在当前页面${currentConfig.enabled ? '禁用' : '启用'}反监控`,
                function() {
                    // 确保为当前网站创建配置（如果不存在）
                    const currentSiteKey = globalConfig.currentSiteKey || getCurrentSiteKey();
                    if (!globalConfig.sites[currentSiteKey]) {
                        globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                        globalConfig.currentSiteKey = currentSiteKey;
                    }
                    
                    // 切换当前网站的启用状态
                    const newEnabledState = !globalConfig.sites[currentSiteKey].enabled;
                    globalConfig.sites[currentSiteKey].enabled = newEnabledState;
                    
                    // 启用时默认显示按钮
                    if (newEnabledState) {
                        globalConfig.sites[currentSiteKey].showButton = true;
                    }
                    
                    // 保存配置
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[反监控脚本] 非油猴环境，配置未保存');
                    }
                    
                    // 根据状态启用或禁用拦截功能
                    if (newEnabledState) {
                        blockEventListeners();
                        blockDeviceInfoAccess();
                        
                        // 检查并创建按钮（如果需要）
                        const trigger = document.getElementById('anti-monitor-trigger');
                        if (!trigger) {
                            // 如果按钮不存在，创建按钮
                            const newTrigger = document.createElement('button');
                            newTrigger.id = 'anti-monitor-trigger';
                            document.body.appendChild(newTrigger);
                            applyButtonStyles(newTrigger);
                            
                            // 添加点击事件
                            newTrigger.addEventListener('click', () => {
                                const panel = document.getElementById('anti-monitor-config');
                                if (panel) {
                                    panel.classList.toggle('visible');
                                } else {
                                    // 如果面板不存在，创建配置界面
                                    createConfigUI();
                                }
                            });
                        }
                    } else {
                        // 禁用时刷新页面以清除拦截效果
                        location.reload();
                        return;
                    }
                    
                    // 通知用户状态已更改
                    const status = newEnabledState ? '已启用' : '已禁用';
                    alert(`当前页面反监控${status}`);
                    
                    console.log(`[反监控脚本] 当前页面反监控${status}`);
                }
            );
            
            // 注册菜单项：显示/隐藏反监控按钮
            // 只要当前网站有配置就显示此菜单项
            const hasSiteConfig = globalConfig.sites[globalConfig.currentSiteKey] !== undefined;
            if (hasSiteConfig) {
                const shouldShowButton = currentConfig.showButton !== undefined ? 
                                        currentConfig.showButton : 
                                        globalConfig.showButtonByDefault;
                
                GM_registerMenuCommand(
                    `${shouldShowButton ? '隐藏' : '显示'}反监控按钮`,
                    function() {
                        // 确保为当前网站创建配置（如果不存在）
                        const currentSiteKey = globalConfig.currentSiteKey || getCurrentSiteKey();
                        if (!globalConfig.sites[currentSiteKey]) {
                            globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                            globalConfig.currentSiteKey = currentSiteKey;
                        }
                        
                        // 切换按钮显示状态
                        globalConfig.sites[currentSiteKey].showButton = !shouldShowButton;
                        if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', globalConfig);
                        } else {
                            console.log('[反监控脚本] 非油猴环境，配置未保存');
                        }
                        
                        // 通知用户并刷新页面以应用更改
                        alert(`反监控按钮已${!shouldShowButton ? '显示' : '隐藏'}，页面将刷新以应用更改`);
                        location.reload();
                        
                        console.log(`[反监控脚本] 反监控按钮已${!shouldShowButton ? '显示' : '隐藏'}`);
                    }
                );
            }
            
            // 注册菜单项：显示配置面板
            GM_registerMenuCommand(
                '显示反监控配置面板',
                function() {
                    try {
                        // 检查配置面板是否已存在
                        const panel = document.getElementById('anti-monitor-config');
                        const trigger = document.getElementById('anti-monitor-trigger');
                        
                        if (panel && panel.classList.contains('visible')) {
                            // 如果面板已显示，则隐藏它
                            panel.classList.remove('visible');
                        } else {
                            // 如果面板不存在或被隐藏，显示它
                            if (trigger) {
                                trigger.click();
                            } else {
                                // 如果触发按钮也不存在，重新创建配置界面
                                createConfigUI();
                                // 创建后显示面板
                                const newPanel = document.getElementById('anti-monitor-config');
                                if (newPanel) {
                                    newPanel.classList.add('visible');
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[反监控脚本] 显示配置面板失败:', e);
                        alert('显示配置面板失败，请尝试刷新页面或查看控制台错误信息。');
                    }
                }
            );
            
            // 注册菜单项：重置配置
            GM_registerMenuCommand(
                '重置反监控配置',
                function() {
                    try {
                        // 弹出确认对话框，防止误操作
                        const confirmed = confirm('确定要重置所有反监控配置吗？此操作不可撤销。');
                        
                        if (confirmed) {
                            // 重置全局配置为默认值
                            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
                            
                            // 保存重置后的配置
                            if (typeof GM_setValue === 'function') {
                                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                            } else {
                                console.log('[反监控脚本] 非油猴环境，配置未保存');
                            }
                            
                            // 通知用户并刷新页面以应用更改
                            alert('反监控配置已重置，页面将刷新以应用更改');
                            location.reload();
                            
                            console.log('[反监控脚本] 反监控配置已重置');
                        }
                    } catch (e) {
                        console.error('[反监控脚本] 重置配置失败:', e);
                        alert('重置配置失败，请查看控制台错误信息。');
                    }
                }
            );
            
        } catch (e) {
            console.error('[反监控脚本] 创建油猴脚本菜单失败:', e);
        }
    }

    // 将虚拟鼠标相关函数暴露到全局作用域，以便测试页面调用
    // 使用unsafeWindow而不是window，因为油猴脚本在沙箱环境中运行
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.startVirtualMouse = startVirtualMouse;
        unsafeWindow.stopVirtualMouse = stopVirtualMouse;
        unsafeWindow.getNextVirtualMousePosition = getNextVirtualMousePosition;
        console.log('[反监控脚本] 已将虚拟鼠标函数暴露到全局作用域');
    } else {
        console.warn('[反监控脚本] unsafeWindow不可用，无法将函数暴露到全局作用域');
    }

    /**
     * 初始化函数
     * 脚本的入口点，负责初始化所有功能模块
     */
    function init() {

        try {
            // 每次都重新获取当前网站键，避免使用缓存的值
            globalConfig.currentSiteKey = getCurrentSiteKey();
            console.log('[反监控脚本] 当前网站键:', globalConfig.currentSiteKey);
            
            // 创建油猴脚本菜单
            createUserScriptMenu();
            
            // 检查是否在主窗口环境
            const isMainWindow = isInMainWindow();
            
            // 检查DOM是否准备就绪
            if (document.readyState === 'loading') {
                // DOM尚未加载完成，等待加载完成后初始化
                console.log('[反监控脚本] 等待DOM加载完成...');
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('[反监控脚本] DOM已加载完成，初始化反监控功能');
                    
                    // 在所有环境中都启用核心的反监控功能
                if (getCurrentSiteConfig().enabled) {
                    blockEventListeners(); // 启用事件拦截
                    createUnifiedNavigatorProxy(); // 创建统一的navigator代理
                    blockDeviceInfoAccess(); // 启用设备信息保护（除navigator外的部分）
                }
                    createVirtualMouse(); // 确保虚拟鼠标被创建
                    setupRealMouseDetection(); // 设置真实鼠标检测
                    
                    // 只在主窗口中创建UI元素
                    if (isMainWindow) {
                        console.log('[反监控脚本] 在主窗口中，创建配置界面');
                        createConfigUI(); // 创建配置界面
                    }
                });
            } else {
                // DOM已经就绪，直接初始化
                console.log('[反监控脚本] DOM已就绪，初始化反监控功能');
                
                // 在所有环境中都启用核心的反监控功能
                if (getCurrentSiteConfig().enabled) {
                    blockEventListeners(); // 启用事件拦截
                    blockCookieAndStorage(); // 启用Cookie及存储拦截
                    createUnifiedNavigatorProxy(); // 创建统一的navigator代理
                    blockDeviceInfoAccess(); // 启用设备信息保护（除navigator外的部分）
                }
                createVirtualMouse(); // 确保虚拟鼠标被创建
                setupRealMouseDetection(); // 设置真实鼠标检测
                
                // 检查是否需要启动虚拟鼠标
                const vmConfig = getCurrentSiteConfig().virtualMouse;
                console.log('[反监控] 检查虚拟鼠标初始化，配置:', vmConfig);
                
                if (vmConfig.enabled) {
                    if (!vmConfig.activateOnLeave) {
                        console.log('[反监控] 配置为不依赖鼠标离开状态，直接启动虚拟鼠标');
                        startVirtualMouse();
                    } else if (!isRealMousePresent) {
                        debugLog('真实鼠标不在页面上且配置允许，启动虚拟鼠标');
                        startVirtualMouse();
                    } else {
                        debugLog('虚拟鼠标已启用但条件不满足，等待鼠标离开');
                    }
                } else {
                    console.log('[反监控] 虚拟鼠标未启用');
                }
                
                // 只在主窗口中创建UI元素
                if (isMainWindow) {
                    console.log('[反监控脚本] 在主窗口中，创建配置界面');
                    createConfigUI(); // 创建配置界面
                }
            }
            
            // 添加窗口卸载事件监听器，确保在页面关闭时清理所有资源
            window.addEventListener('unload', cleanup);
            
            // 检查初始状态，如果鼠标不在页面上且配置允许，启动虚拟鼠标
            setTimeout(() => {
                const siteConfig = getCurrentSiteConfig();
                const config = siteConfig ? siteConfig.virtualMouse : {};
                console.log('[反监控] 检查虚拟鼠标初始状态，配置:', config);
                
                if (config.enabled) {
                    // 重置路径模式的状态变量
                    virtualMouseState.smoothAngle = null;
                    virtualMouseState.patternX = null;
                    virtualMouseState.hoverTime = null;
                    virtualMouseState.hoverTargetX = null;
                    virtualMouseState.hoverTargetY = null;
                    virtualMouseState.randomAngle = null;
                    virtualMouseState.clickAngle = null;
                    virtualMouseState.clickModeShouldClick = false;
                    debugLog('初始化时重置路径模式状态变量');
                    
                    // 确保虚拟鼠标元素可见
                    if (virtualMouse) {
                        virtualMouse.style.display = 'block';
                        virtualMouse.style.visibility = 'visible';
                        virtualMouse.style.opacity = '1';
                        
                        // 确保主光标可见
                        const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                        if (mainCursor) {
                            mainCursor.style.display = 'block';
                            mainCursor.style.visibility = 'visible';
                            mainCursor.style.opacity = '1';
                        }
                        
                        console.log('[反监控] 确保虚拟鼠标元素可见');
                    }
                    
                    if (config.activateOnLeave && !isRealMousePresent) {
                        console.log('[反监控] 真实鼠标不在页面上且配置允许，启动虚拟鼠标');
                        startVirtualMouse();
                    } else if (!config.activateOnLeave) {
                        console.log('[反监控] 配置为不依赖鼠标离开状态，直接启动虚拟鼠标');
                        startVirtualMouse();
                    } else {
                        debugLog('虚拟鼠标已启用但条件不满足，不启动');
                    }
                } else {
                    console.log('[反监控] 虚拟鼠标未启用');
                }
            }, 1000);
        } catch (e) {
            console.error('[反监控脚本] 初始化失败:', e);
        }
    }

    // 启动初始化
    init();

})();
