// ==UserScript==
// @name         Anti-Surveillance Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Prevents web pages from monitoring user behavior. All blocking items are disabled by default. Supports advanced virtual mouse settings.
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

    // Debug level definitions
    const DEBUG_LEVELS = {
        ERROR: 0,    // Error messages only
        WARN: 1,     // Warning messages  
        INFO: 2,     // General information
        DEBUG: 3,    // Debug information
        VERBOSE: 4   // Verbose information
    };

    // Debug level mapping
    const DEBUG_LEVEL_NAMES = {
        'ERROR': DEBUG_LEVELS.ERROR,
        'WARN': DEBUG_LEVELS.WARN,
        'INFO': DEBUG_LEVELS.INFO,
        'DEBUG': DEBUG_LEVELS.DEBUG,
        'VERBOSE': DEBUG_LEVELS.VERBOSE
    };

    /**
     * Smart debug log manager
     * Provides hierarchical and categorized debug output control
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
         * Update debug configuration
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
         * Check if log should be output
         */
        shouldLog(level, category) {
            if (!this.enabled) return false;
            if (level > this.currentLevel) return false;
            if (category && !this.categories[category]) return false;
            return true;
        }

        /**
         * Format log prefix
         */
        formatPrefix(level, category) {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'];
            const levelName = levelNames[level] || 'UNKNOWN';
            const timestamp = this.timestamp ? `[${new Date().toISOString()}] ` : '';
            const categoryStr = category ? `[${category}] ` : '';
            return `${timestamp}[Anti-Surveillance][${levelName}]${categoryStr}`;
        }

        /**
         * Output log
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

        // Convenience methods
        error(category, ...args) { this.log(DEBUG_LEVELS.ERROR, category, ...args); }
        warn(category, ...args) { this.log(DEBUG_LEVELS.WARN, category, ...args); }
        info(category, ...args) { this.log(DEBUG_LEVELS.INFO, category, ...args); }
        debug(category, ...args) { this.log(DEBUG_LEVELS.DEBUG, category, ...args); }
        verbose(category, ...args) { this.log(DEBUG_LEVELS.VERBOSE, category, ...args); }
    }

    // Create global debug logger instance
    const debugLogger = new DebugLogger();

    // Debug mode toggle: Set to false for production, true for development debugging
    const DEBUG_MODE = false;

    // Unified logging helper function (maintain backward compatibility)
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log('[Anti-Surveillance]', ...args);
        }
    }

    /**
     * Update debug configuration
     * Read debug settings from user configuration and apply to debug logger
     */
    function updateDebugConfig() {
        try {
            const config = getCurrentSiteConfig().debugConfig || {};
            debugLogger.updateConfig(config);
        } catch (e) {
            console.error('[Anti-Surveillance] Failed to update debug config:', e);
        }
    }
    
    // Constants definition
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

    // Deep copy helper function
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        return JSON.parse(JSON.stringify(obj));
    }

    // Configuration encryption/decryption functions (simple encryption)
    function encryptConfig(config) {
        try {
            return btoa(encodeURIComponent(JSON.stringify(config)));
        } catch (e) {
            console.error('[Anti-Surveillance Script] Configuration encryption failed:', e);
            return JSON.stringify(config);
        }
    }

    function decryptConfig(encrypted) {
        try {
            return JSON.parse(decodeURIComponent(atob(encrypted)));
        } catch (e) {
            console.error('[Anti-Surveillance Script] Configuration decryption failed:', e);
            return null;
        }
    }

    // Check if element is in the blacklist
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
    
    // Namespace object, encapsulating global variables
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

    console.log('[Anti-Surveillance Script] Starting to load...');

    // Initialize debug configuration
    updateDebugConfig();

    // Initialize virtual mouse animation styles
    initVirtualMouseAnimations();

    /**
     * Default website configuration template - All blocking items are disabled by default
     * This is the base template for each website configuration, defining default values for all configurable items
     */
    const defaultSiteConfig = {
        enabled: false,                          // Whether to enable anti-surveillance blocking for this website
        showButton: true,                       // Whether to show the anti-surveillance button
        buttonConfig: {
            text: 'Anti-Surveillance',          // Button display text
            position: 'bottom-right',            // Button position: top-left, top-right, bottom-left, bottom-right, custom
            customX: '20px',                     // X coordinate for custom position
            customY: '20px',                     // Y coordinate for custom position
            backgroundColor: '#ff4444',          // Button background color
            textColor: 'white',                  // Button text color
            width: 'auto',                       // Button width
            height: 'auto',                      // Button height
            padding: '10px',                     // Button padding
            fontSize: '14px',                    // Button font size
            borderRadius: '4px',                 // Button border radius
            opacity: 1,                          // Button opacity
            zIndex: '999999'                     // Button z-index
        },
        pageVisibilityEvents: {
            visibilitychange: false,             // Whether to block visibilitychange events
            webkitvisibilitychange: false,       // Whether to block webkitvisibilitychange events (browser compatibility)
            overrideVisibilityState: false       // Whether to override visibilityState and hidden properties
        },
        connectivityEvents: {
            enabled: true,                       // Whether to enable online/offline status detection
            blockOnlineEvent: true,              // Whether to block online events
            blockOfflineEvent: true,             // Whether to block offline events
            overrideOnlineState: true            // Whether to override navigator.onLine property
        },
        focusEvents: {
            blur: false,                         // Whether to block blur events (page loses focus)
            focus: false                         // Whether to block focus events (page gains focus)
        },
        fullscreenEvents: {
            fullscreenchange: false,             // Whether to block standard fullscreen events
            webkitfullscreenchange: false,       // Whether to block WebKit browser fullscreen events
            mozfullscreenchange: false,          // Whether to block Firefox browser fullscreen events
            msfullscreenchange: false            // Whether to block IE/Edge browser fullscreen events
        },
        mouseEvents: {
            mousemove: false,                    // Whether to block mouse movement events
            mousewheel: false,                   // Whether to block mouse wheel events
            click: false,                        // Whether to block mouse click events
            hover: false,                        // Whether to block mouse hover events
            contextmenu: false,                  // Whether to block right-click menu events
            dblclick: false,                     // Whether to block double-click events
            mousedown: false,                    // Whether to block mouse down events
            mouseup: false                       // Whether to block mouse up events
        },
        keyboardEvents: {
            keydown: false,                      // Whether to block key down events
            keyup: false,                        // Whether to block key up events
            keypress: false,                     // Whether to block key press events
            input: false                         // Whether to block input events
        },
        windowEvents: {
            resize: false,                       // Whether to block window resize events
            scroll: false,                       // Whether to block page scroll events
            beforeunload: false,                 // Whether to block before unload events
            unload: false,                       // Whether to block unload events
            load: false,                         // Whether to block load events
            error: false,                        // Whether to block error events
            abort: false,                        // Whether to block abort events
            pageshow: false,                     // Whether to block pageshow events
            pagehide: false                      // Whether to block pagehide events
        },
        clipboardEvents: {
            copy: false,                         // Whether to block copy events
            cut: false,                          // Whether to block cut events
            paste: false,                        // Whether to block paste events
            beforecopy: false,                   // Whether to block before copy events
            beforecut: false,                    // Whether to block before cut events
            beforepaste: false                   // Whether to block before paste events
        },
        // New advanced blocking options
        navigationEvents: {
            enabled: false,                      // Whether to enable navigation event blocking
            popstate: false,                     // Whether to block history change events
            hashchange: false,                   // Whether to block URL hash change events
            pagehide: false,                     // Whether to block page hide events
            pageshow: false                      // Whether to block page show events
        },
        touchEvents: {
            enabled: false,                      // Whether to enable touch event blocking
            touchstart: false,                   // Whether to block touch start events
            touchmove: false,                    // Whether to block touch move events
            touchend: false,                     // Whether to block touch end events
            touchcancel: false                   // Whether to block touch cancel events
        },
        formEvents: {
            enabled: false,                      // Whether to enable form event blocking
            change: false,                       // Whether to block form element value change events
            input: false,                        // Whether to block input events
            submit: false                        // Whether to block form submission events
        },
        cookieSettings: {
            enabled: false,                      // Whether to enable cookie blocking
            blockAll: false,                     // Whether to block all cookie operations
            blockRules: []                       // Cookie blocking rules
        },
        storageSettings: {
            enabled: false,                      // Whether to enable storage blocking
            blockLocalStorage: false,            // Whether to block localStorage operations
            blockSessionStorage: false,          // Whether to block sessionStorage operations
            blockIndexedDB: false,               // Whether to block IndexedDB operations
            blockCache: false                     // Whether to block Cache API operations
        },
        deviceInfo: {
            enabled: false,                      // Whether to block device information access
            navigatorProperties: false,          // Whether to block navigator property access
            screenInfo: false,                   // Whether to block screen information access
            emulateDevice: false,                // Whether to emulate specific device information
            deviceType: 'desktop',               // Device type: desktop, mobile, tablet, custom
            customDevice: {
                userAgent: '',                   // Custom User-Agent
                platform: '',                    // Custom platform
                screenWidth: 0,                  // Custom screen width
                screenHeight: 0,                 // Custom screen height
                availWidth: 0,                   // Custom available width
                availHeight: 0                   // Custom available height
            }
        },
        virtualMouse: {
            enabled: false,                      // Whether to enable virtual mouse
            activateOnLeave: false,              // Whether to activate virtual mouse when real mouse leaves the page
            deactivateOnEnter: false,            // Whether to deactivate virtual mouse when real mouse enters the page
            showCursor: false,                   // Whether to show virtual mouse cursor
            showCursorAlways: false,             // Whether to always show virtual mouse cursor
            cursorColor: '#ff0000',              // Virtual mouse cursor color
            cursorSize: 10,                      // Virtual mouse cursor size
            cursorOpacity: 0.7,                  // Virtual mouse cursor opacity
            enhancedVisual: true,                // Whether to enable enhanced visual effects
            pathMode: 'random',                  // Movement path mode: random, smooth, pattern, hover
            moveSpeed: 5,                        // Movement speed
            moveInterval: 200,                    // Movement interval (milliseconds)
            hoverOnly: false,                    // Whether to use only preset hover points
            hoverInterval: 1000,                 // Movement interval in hover mode (milliseconds)
            activityArea: 'full',                // Activity area: full, content, custom
            customArea: {                        // Custom activity area coordinates
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0
            },
            fixedPosition: {                     // Fixed position settings
                enabled: false,                  // Whether to enable fixed position
                x: 0,                            // Fixed X coordinate
                y: 0                             // Fixed Y coordinate
            },
            animation: {                       // Animation effect configuration
                enabled: true,                 // Whether to enable animations
                breathing: true,               // Breathing scale animation
                pulse: false,                  // Pulse ripple effect (disabled by default)
                intensity: 'medium',           // Animation intensity: low/medium/high
                duration: 2000,                // Animation cycle (milliseconds)
                performanceMode: 'auto'        // Performance mode: auto/high/low
            },
            debugConfig: {                     // Debug output configuration
                enabled: false,                // Whether to enable debug output
                level: 'ERROR',                // Output level: ERROR/WARN/INFO/DEBUG/VERBOSE
                categories: {                  // Category control
                    virtualMouse: false,       // Virtual mouse related
                    eventBlocking: false,      // Event blocking related
                    deviceInfo: false,         // Device info related
                    config: false,             // Configuration related
                    animation: false           // Animation related
                },
                consoleOnly: true,             // Console output only
                timestamp: true                // Show timestamp
            }
        }
    };

    /**
     * Default global configuration
     * Contains configurations for all websites and default button configuration
     */
    const defaultGlobalConfig = {
        sites: {},                               // Configuration for all websites, key is website URL or hostname
        buttonConfig: {
            text: 'Anti-Surveillance',          // Button display text
            position: 'bottom-right',            // Button position: top-left, top-right, bottom-left, bottom-right, custom
            customX: '20px',                     // X coordinate for custom position
            customY: '20px',                     // Y coordinate for custom position
            backgroundColor: '#ff4444',          // Button background color
            textColor: 'white',                  // Button text color
            width: 'auto',                       // Button width
            height: 'auto',                      // Button height
            padding: '10px',                     // Button padding
            fontSize: '14px',                    // Button font size
            borderRadius: '4px',                 // Button border radius
            opacity: 1,                          // Button opacity
            zIndex: '999999'                     // Button z-index
        },
        currentSiteKey: '',                      // Currently active website configuration key
        showButtonByDefault: true               // Whether to show anti-surveillance button by default
    };

    // Get saved configuration or use default configuration
    // Add compatibility handling, use default configuration when running in normal environment
    let globalConfig;
    try {
        // Try to use GM_getValue to get configuration (Tampermonkey environment)
        if (typeof GM_getValue === 'function') {
            globalConfig = GM_getValue('antiMonitorGlobalConfig', defaultGlobalConfig);
        } else {
            // Use default configuration in normal environment
            console.log('[Anti-Surveillance Script] Tampermonkey environment not detected, using default configuration');
            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
        }
    } catch (e) {
        console.error('[Anti-Surveillance Script] Error getting configuration, using default configuration:', e);
        globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
    }
    
    /**
     * Ensure configuration structure integrity
     * This function checks if the global configuration contains all necessary configuration items, and restores from default configuration if missing
     */
    function ensureConfigIntegrity() {
        try {
            // Check top-level properties of global configuration
            for (const key in defaultGlobalConfig) {
                if (!(key in globalConfig)) {
                    globalConfig[key] = defaultGlobalConfig[key];
                    console.log(`[Anti-Surveillance Script] Fixed configuration item: ${key}`);
                }
            }
            
            // Check button configuration
            for (const key in defaultGlobalConfig.buttonConfig) {
                if (!(key in globalConfig.buttonConfig)) {
                    globalConfig.buttonConfig[key] = defaultGlobalConfig.buttonConfig[key];
                    console.log(`[Anti-Surveillance Script] Fixed button configuration item: ${key}`);
                }
            }
            
            // Check integrity of all website configurations
            for (const siteKey in globalConfig.sites) {
                const siteConfig = globalConfig.sites[siteKey];
                for (const key in defaultSiteConfig) {
                    if (!(key in siteConfig)) {
                        siteConfig[key] = defaultSiteConfig[key];
                        console.log(`[Anti-Surveillance Script] Fixed website configuration item ${siteKey}: ${key}`);
                    }
                    // Check nested object configurations (like virtualMouse, etc.)
                    if (typeof defaultSiteConfig[key] === 'object' && !Array.isArray(defaultSiteConfig[key])) {
                        // Ensure nested object exists
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
            
            // Save the repaired configuration
            if (typeof GM_setValue === 'function') {
                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                console.log('[Anti-Surveillance Script] Configuration saved');
            } else {
                // In normal environment, log but don't save configuration
                console.log('[Anti-Surveillance Script] Tampermonkey environment not detected, configuration will not be saved');
            }
        } catch (e) {
            console.error('[Anti-Surveillance Script] Configuration integrity check failed:', e);
            // Reset to default configuration when configuration is corrupted
            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
            if (typeof GM_setValue === 'function') {
                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                console.log('[Anti-Surveillance Script] Configuration reset and saved');
            } else {
                // In normal environment, log but don't save configuration
                console.log('[Anti-Surveillance Script] Tampermonkey environment not detected, configuration reset but will not be saved');
            }
        }
    }
    ensureConfigIntegrity(); // Execute configuration check immediately during initialization

    /**
     * Get current website configuration
     * Find corresponding website configuration based on currently visited URL
     * Prioritize exact matching to avoid configuration confusion
     * Support regular websites and local files
     * @returns {Object} Current website configuration object
     */
    function getCurrentSiteConfig() {
        try {
            // Re-get current website key each time to ensure accuracy
            let currentSiteKey = getCurrentSiteKey();
            console.log('[Anti-Surveillance Script] Getting current website key:', currentSiteKey);
            
            // Ensure globalConfig.sites exists
            const sitesConfig = (typeof globalConfig === 'object' && globalConfig !== null && 
                              typeof globalConfig.sites === 'object' && globalConfig.sites !== null) ? 
                              globalConfig.sites : {};
            
            // Prioritize exact matching of current website identifier
            if (currentSiteKey && sitesConfig[currentSiteKey]) {
                const siteConfig = sitesConfig[currentSiteKey];
                console.log('[Anti-Surveillance Script] Exact match found for website configuration:', currentSiteKey);
                return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
            }
            
            // If no exact match, try other matching methods (backward compatibility)
            const currentHost = window.location.hostname || ''; // Get current website hostname
            const currentUrl = window.location.href || ''; // Get current complete URL
            
            // Try to match exact URL patterns (only when no exact match)
            for (const siteKey in sitesConfig) {
                try {
                    // First try to use regex to match URL
                    if (typeof siteKey === 'string' && currentUrl && new RegExp(siteKey).test(currentUrl)) {
                        const siteConfig = sitesConfig[siteKey];
                        console.log('[Anti-Surveillance Script] Website configuration matched via regex:', siteKey);
                        return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
                    }
                } catch (e) {
                    // When regex matching fails, try inclusion matching
                    // Enhanced matching logic, supports local file paths
                    if (typeof siteKey === 'string' && (currentUrl.includes(siteKey) || currentSiteKey.includes(siteKey))) {
                        const siteConfig = sitesConfig[siteKey];
                        console.log('[Anti-Surveillance Script] Website configuration matched via inclusion:', siteKey);
                        return (typeof siteConfig === 'object' && siteConfig !== null) ? siteConfig : JSON.parse(JSON.stringify(defaultSiteConfig));
                    }
                }
            }
            
            // If no matching configuration found, return deep copy of default configuration, but don't auto-create website configuration
            console.log('[Anti-Surveillance Script] No matching website configuration found, using default configuration');
            return JSON.parse(JSON.stringify(defaultSiteConfig));
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to get current website configuration:', e);
            // Return deep copy of default configuration when error occurs
            return JSON.parse(JSON.stringify(defaultSiteConfig));
        }
    }

    /**
     * Save current site configuration
     * Save the current website configuration to the global configuration
     */
    function saveCurrentSiteConfig() {
        try {
            const currentSiteKey = globalConfig.currentSiteKey;
            if (!currentSiteKey) {
                console.warn('[Anti-Surveillance] No current site key, cannot save configuration');
                return;
            }
            
            // Get current website configuration
            const currentConfig = getCurrentSiteConfig();
            
            // Ensure current website configuration is added to globalConfig.sites
            if (!globalConfig.sites[currentSiteKey]) {
                globalConfig.sites[currentSiteKey] = currentConfig;
            } else {
                // Update existing website configuration
                globalConfig.sites[currentSiteKey] = currentConfig;
            }
            
            // Save to GM_setValue
            if (typeof GM_setValue === 'function') {
                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                console.log(`[Anti-Surveillance] Saved site configuration: ${currentSiteKey}`);
            } else {
                console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
            }
        } catch (e) {
            console.error('[Anti-Surveillance] Failed to save current site configuration:', e);
        }
    }

    /**
     * Get list of events to block for current website
     */
    function getEventsToBlock() {
        try {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.enabled) return [];
            
            const events = [];

            // Page visibility events
            if (siteConfig.pageVisibilityEvents.visibilitychange) {
                events.push('visibilitychange');
            }
            if (siteConfig.pageVisibilityEvents.webkitvisibilitychange) {
                events.push('webkitvisibilitychange');
            }

            // Focus events
            if (siteConfig.focusEvents.blur) {
                events.push('blur');
            }
            if (siteConfig.focusEvents.focus) {
                events.push('focus');
            }

            // Fullscreen events
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

            // Mouse events
            if (siteConfig.mouseEvents.mousemove) {
                events.push('mousemove');
            }
            if (siteConfig.mouseEvents.mousewheel) {
                events.push('mousewheel');
                events.push('DOMMouseScroll'); // DOMMouseScroll has similar functionality to mousewheel, block together
                events.push('wheel'); // Standard wheel event
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

            // Keyboard events
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

            // Window events
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

            // Clipboard events
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

            // New navigation event blocking
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

            // New touch event blocking
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

            // New form event blocking
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

            // Online/offline status event blocking - Always block to ensure only online status is reported
            events.push('online');
            events.push('offline');

            return events;
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to get event list:', e);
            return [];
        }
    }

    /**
     * Check if blocking functionality is enabled for current website
     */
    function isSiteEnabled() {
        try {
            return getCurrentSiteConfig().enabled;
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to check enabled status:', e);
            return true; // Enable by default when error occurs
        }
    }

    /**
     * Create unified navigator proxy
     * Handle all navigator properties that need to be intercepted
     */
    function createUnifiedNavigatorProxy() {
        try {
            const siteConfig = getCurrentSiteConfig();
            const deviceInfoConfig = siteConfig.deviceInfo || {};
            const connectivityConfig = siteConfig.connectivityEvents || {};
            
            // Check if navigator proxy needs to be created
            const needsDeviceInfoProxy = deviceInfoConfig.enabled && (deviceInfoConfig.navigatorProperties || deviceInfoConfig.emulateDevice);
            const needsConnectivityProxy = connectivityConfig.enabled && connectivityConfig.overrideOnlineState;
            
            if (!needsDeviceInfoProxy && !needsConnectivityProxy) return; // No proxy needed
            
            // Get device information (if needed)
            let currentDeviceInfo = null;
            let deviceType = 'desktop';
            
            if (needsDeviceInfoProxy) {
                // Get device emulation configuration
                const emulateDevice = deviceInfoConfig.emulateDevice || false;
                deviceType = deviceInfoConfig.deviceType || 'desktop';
                const customDevice = deviceInfoConfig.customDevice || {};
                
                // Set device information based on device type
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
                
                // Get device information to be used currently
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
                    // Use desktop device information by default
                    currentDeviceInfo = deviceInfo.desktop;
                }
            }
            
            // Create proxy for original navigator object
            const navigatorProxy = new Proxy(window.navigator, {
                get(target, prop) {
                    // Handle online/offline status interception - always return online status
                    if (prop === 'onLine') {
                        debugLog('Device is online');
                        return true; // Always return online status
                    }
                    
                    // Handle device information interception
                    if (needsDeviceInfoProxy) {
                        // For sensitive properties that may leak privacy, return generic values or simulated data
                        const sensitiveProps = [
                            'userAgent', 'appVersion', 'platform', 'language', 'languages',
                            'plugins', 'mimeTypes', 'hardwareConcurrency', 'deviceMemory'
                        ];
                        
                        if (sensitiveProps.includes(prop)) {
                            // Only output normal operation, do not output interception information
                            return currentDeviceInfo.userAgent;
                        }
                    }
                    
                    // Non-sensitive properties, return real values
                    return Reflect.get(target, prop);
                }
            });
            
            // Override original navigator object
            Object.defineProperty(window, 'navigator', {
                configurable: true,
                enumerable: true,
                get: function() { return navigatorProxy; }
            });
            
            console.log('[Anti-Surveillance] Created unified navigator proxy');
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to create navigator proxy:', e);
        }
    }
    
    /**
     * Check if specified event needs to be intercepted
     * @param {string} eventType - Event type
     * @param {EventTarget} target - Event target
     * @returns {boolean} Whether interception is needed
     */
    function shouldBlockEvent(eventType, target) {
        try {
            // Always intercept online and offline events, ensure only online status is reported
            if (eventType === 'online' || eventType === 'offline') {
                // Only output normal operation of online status
                console.log('[Anti-Surveillance] Device is online');
                return true;
            }
            
            const siteConfig = getCurrentSiteConfig();
            const eventsToBlock = getEventsToBlock();
            
            // Basic event interception check
            if (eventsToBlock.includes(eventType)) {
                return true;
            }
            
            // Advanced blocking rule check
            if (siteConfig.advancedBlocking && siteConfig.advancedBlocking.enabled && siteConfig.advancedBlocking.rules) {
                for (const rule of siteConfig.advancedBlocking.rules) {
                    if (!rule.enabled) continue;
                    
                    // Event type matching
                    if (rule.eventType && rule.eventType !== eventType) {
                        continue;
                    }
                    
                    // Regex matching for target
                    if (rule.targetRegex) {
                        try {
                            const regex = new RegExp(rule.targetRegex);
                            const targetString = target ? (target.tagName ? target.tagName.toLowerCase() : String(target)) : '';
                            if (regex.test(targetString)) {
                                return true;
                            }
                        } catch (e) {
                            console.error('[Anti-Surveillance] Regex matching failed:', e);
                        }
                    }
                    
                    // Element selector matching
                    if (rule.selector && target && target.matches) {
                        try {
                            if (target.matches(rule.selector)) {
                                return true;
                            }
                        } catch (e) {
                            console.error('[Anti-Surveillance] Selector matching failed:', e);
                        }
                    }
                    
                    // Attribute matching
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
            console.error('[Anti-Surveillance] Event blocking rule check failed:', e);
            return false;
        }
    }
    
    /**
     * Block event listeners
     * This is one of the core functions of the script, intercepting specified events by overriding the browser's native event listening mechanism
     */
    function blockEventListeners() {
        try {
            // If blocking functionality is not enabled for current website, return directly
            if (!isSiteEnabled()) return;

            // Save original addEventListener method for later calls
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            
            // Override addEventListener method to implement event blocking
            EventTarget.prototype.addEventListener = function(eventName, listener, options) {
                // Count total events
                blockStats.incrementTotal(eventName);
                
                // Check if blocking is needed
                if (shouldBlockEvent(eventName, this)) {
                    // Count blocked events
                    blockStats.incrementBlocked(eventName);
                    
                    // Log
                    blockLog.log(eventName, this, 'Block event listener', {
                        listenerType: typeof listener,
                        options: options || {}
                    });
                    
                    return; // Don't execute original event listener to achieve blocking purpose
                }
                
                // For events that are not blocked, execute original listener method
                return originalAddEventListener.call(this, eventName, listener, options);
            };

            // Intercept visibilityState and hidden properties (if this feature is enabled in configuration)
            const siteConfig = getCurrentSiteConfig();
            if (siteConfig.pageVisibilityEvents.overrideVisibilityState) {
                // Override document's visibilityState property to always return "visible"
                // Add configurable and enumerable options to ensure properties can be safely redefined
                try {
                    Object.defineProperty(document, 'visibilityState', {
                        configurable: true,
                        enumerable: true,
                        get: function() {
                            blockLog.log('visibilityState', document, 'Block property access');
                            blockStats.incrementTotal('visibilityState');
                            blockStats.incrementBlocked('visibilityState');
                            return 'visible'; // Make website think page is always visible
                        }
                    });
                } catch (e) {
                    blockLog.log('visibilityState', document, 'Property override failed', { error: e.message });
                    console.warn('[Anti-Surveillance Script] Unable to redefine visibilityState property:', e);
                }

                // Override document's hidden property to always return false
                // Add configurable and enumerable options to ensure properties can be safely redefined
                try {
                    Object.defineProperty(document, 'hidden', {
                        configurable: true,
                        enumerable: true,
                        get: function() {
                            blockLog.log('hidden', document, 'Block property access');
                            blockStats.incrementTotal('hidden');
                            blockStats.incrementBlocked('hidden');
                            return false; // Make website think page is not hidden
                        }
                    });
                } catch (e) {
                    blockLog.log('hidden', document, 'Property override failed', { error: e.message });
                    console.warn('[Anti-Surveillance Script] Unable to redefine hidden property:', e);
                }
            }
            
            // Enhanced event blocking: Intercept document.createEvent and new Event()
            const originalCreateEvent = document.createEvent;
            document.createEvent = function(eventType) {
                blockStats.incrementTotal('createEvent');
                
                const eventsToBlock = getEventsToBlock();
                if (eventsToBlock.some(blockedEvent => eventType.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                    blockStats.incrementBlocked('createEvent');
                    blockLog.log(eventType, document, 'Block createEvent');
                    // Return a mock event object that won't trigger actual behavior
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
            
            // Intercept Event constructor
            const originalEvent = window.Event;
            try {
                window.Event = function(type, eventInitDict) {
                    blockStats.incrementTotal('EventConstructor');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('EventConstructor');
                        blockLog.log(type, window, 'Block Event constructor');
                        // Return a mock event object
                        const mockEvent = originalEvent.call(this, 'mock-event', eventInitDict);
                        Object.defineProperty(mockEvent, 'type', {
                            get: function() { return type; },
                            configurable: true
                        });
                        return mockEvent;
                    }
                    return new originalEvent(type, eventInitDict);
                };
                
                // Maintain prototype chain
                window.Event.prototype = originalEvent.prototype;
            } catch (e) {
                blockLog.log('EventConstructor', window, 'Constructor override failed', { error: e.message });
                console.warn('[Anti-Surveillance Script] Unable to override Event constructor:', e);
            }
            
            // Intercept CustomEvent constructor
            const originalCustomEvent = window.CustomEvent;
            try {
                window.CustomEvent = function(type, eventInitDict) {
                    blockStats.incrementTotal('CustomEventConstructor');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('CustomEventConstructor');
                        blockLog.log(type, window, 'Block CustomEvent constructor');
                        // Return a mock event object
                        const mockEvent = originalCustomEvent.call(this, 'mock-event', eventInitDict);
                        Object.defineProperty(mockEvent, 'type', {
                            get: function() { return type; },
                            configurable: true
                        });
                        return mockEvent;
                    }
                    return new originalCustomEvent(type, eventInitDict);
                };
                
                // Maintain prototype chain
                window.CustomEvent.prototype = originalCustomEvent.prototype;
            } catch (e) {
                blockLog.log('CustomEventConstructor', window, 'Constructor override failed', { error: e.message });
                console.warn('[Anti-Surveillance Script] Unable to override CustomEvent constructor:', e);
            }
            
            // Intercept event dispatch
            const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
            EventTarget.prototype.dispatchEvent = function(event) {
                if (event) {
                    blockStats.incrementTotal('dispatchEvent');
                    
                    const eventsToBlock = getEventsToBlock();
                    if (eventsToBlock.some(blockedEvent => event.type.toLowerCase().includes(blockedEvent.toLowerCase()))) {
                        blockStats.incrementBlocked('dispatchEvent');
                        blockLog.log(event.type, this, 'Block event dispatch');
                        return true; // Return true to indicate event was handled, but actually did nothing
                    }
                }
                return originalDispatchEvent.call(this, event);
            };
            
            // Intercept window event listeners
            const originalWindowAddEventListener = window.addEventListener;
            window.addEventListener = function(eventName, listener, options) {
                blockStats.incrementTotal('windowEvent');
                
                if (shouldBlockEvent(eventName, window)) {
                    blockStats.incrementBlocked('windowEvent');
                    blockLog.log(eventName, window, 'Block window event listener');
                    return;
                }
                return originalWindowAddEventListener.call(this, eventName, listener, options);
            };
            
            // Intercept document event listeners
            const originalDocumentAddEventListener = document.addEventListener;
            document.addEventListener = function(eventName, listener, options) {
                blockStats.incrementTotal('documentEvent');
                
                if (shouldBlockEvent(eventName, document)) {
                    blockStats.incrementBlocked('documentEvent');
                    blockLog.log(eventName, document, 'Block document event listener');
                    return;
                }
                return originalDocumentAddEventListener.call(this, eventName, listener, options);
            };
            
            // Enhanced anti-bypass mechanism: Intercept removeEventListener to prevent restoration of blocked events
            const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
            EventTarget.prototype.removeEventListener = function(eventName, listener, options) {
                // Log but don't block removeEventListener calls
                blockLog.log(eventName, this, 'Call removeEventListener');
                return originalRemoveEventListener.call(this, eventName, listener, options);
            };
            
            // Enhanced anti-bypass mechanism: Intercept event property assignments (like onclick)
            const eventProperties = ['onclick', 'onload', 'onunload', 'onmousemove', 'onmouseover', 'onmouseout',
                                   'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress', 'onchange',
                                   'onsubmit', 'onfocus', 'onblur', 'onresize', 'onscroll', 'onerror', 'oncontextmenu'];
            
            for (const prop of eventProperties) {
                Object.defineProperty(EventTarget.prototype, prop, {
                    set: function(value) {
                        const eventType = prop.substring(2); // Remove "on" prefix
                        blockStats.incrementTotal('eventProperty');
                        
                        if (shouldBlockEvent(eventType, this)) {
                            blockStats.incrementBlocked('eventProperty');
                            blockLog.log(eventType, this, `Block event property assignment: ${prop}`);
                            // Don't execute assignment to prevent event binding
                            return;
                        }
                        // Execute assignment normally
                        this[`__${prop}`] = value;
                    },
                    get: function() {
                        return this[`__${prop}`];
                    },
                    configurable: true
                });
            }

            console.log('[Anti-Surveillance] Enhanced blocking functionality enabled');
        } catch (e) {
            blockLog.log('system', null, 'Blocking functionality initialization failed', { error: e.message }, 'error');
            console.error('[Anti-Surveillance Script] Event blocking functionality failed:', e);
        }
    }
    
    /**
     * Cookie and storage blocking functionality
     */
    function blockCookieAndStorage() {
        try {
            if (!isSiteEnabled()) return;
            
            debugLog('Enabling Cookie and storage blocking');
            
            // Intercept document.cookie
            const originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
            if (originalCookieDescriptor && originalCookieDescriptor.configurable) {
                Object.defineProperty(document, 'cookie', {
                    get: function() {
                        const cookies = originalCookieDescriptor.get.call(this);
                        blockLog.log('cookie', document, 'Read Cookie', { cookies });
                        blockStats.incrementTotal('cookie-read');
                        return cookies;
                    },
                    set: function(value) {
                        blockLog.log('cookie', document, 'Set Cookie', { cookie: value });
                        blockStats.incrementTotal('cookie-write');
                        
                        // Check if Cookie setting needs to be blocked
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.cookieSettings && siteConfig.cookieSettings.blockAll) {
                            blockStats.incrementBlocked('cookie-write');
                            return; // Block Cookie setting
                        }
                        
                        // Rule-based Cookie blocking
                        if (siteConfig.cookieSettings && siteConfig.cookieSettings.blockRules) {
                            const rules = siteConfig.cookieSettings.blockRules;
                            for (const rule of rules) {
                                if (rule.enabled) {
                                    // Regex matching
                                    if (rule.regex) {
                                        try {
                                            const regex = new RegExp(rule.regex);
                                            if (regex.test(value)) {
                                                blockStats.incrementBlocked('cookie-write');
                                                return; // Block matching Cookie
                                            }
                                        } catch (e) {
                                            console.error('[Anti-Surveillance] Cookie regex matching failed:', e);
                                        }
                                    }
                                    // Name matching
                                    if (rule.name && value.startsWith(rule.name + '=')) {
                                        blockStats.incrementBlocked('cookie-write');
                                        return; // Block matching Cookie
                                    }
                                }
                            }
                        }
                        
                        return originalCookieDescriptor.set.call(this, value);
                    },
                    configurable: true,
                    enumerable: true
                });
                
                blockLog.log('system', document, 'Successfully intercepted document.cookie');
            }
            
            // Intercept localStorage
            const originalLocalStorage = window.localStorage;
            if (originalLocalStorage) {
                window.localStorage = new Proxy(originalLocalStorage, {
                    get: function(target, prop) {
                        if (typeof target[prop] === 'function') {
                            return function(...args) {
                                blockLog.log('localStorage', window, `Call ${prop} method`, { args });
                                blockStats.incrementTotal(`localStorage-${prop}`);
                                
                                // Check if localStorage operation needs to be blocked
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
                
                blockLog.log('system', window, 'Successfully intercepted localStorage');
            }
            
            // Intercept sessionStorage
            const originalSessionStorage = window.sessionStorage;
            if (originalSessionStorage) {
                window.sessionStorage = new Proxy(originalSessionStorage, {
                    get: function(target, prop) {
                        if (typeof target[prop] === 'function') {
                            return function(...args) {
                                blockLog.log('sessionStorage', window, `Call ${prop} method`, { args });
                                blockStats.incrementTotal(`sessionStorage-${prop}`);
                                
                                // Check if sessionStorage operation needs to be blocked
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
                
                blockLog.log('system', window, 'Successfully intercepted sessionStorage');
            }
            
            // Intercept IndexedDB
            const originalIndexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
            if (originalIndexedDB) {
                window.indexedDB = {
                    open: function(name, version) {
                        blockLog.log('indexedDB', window, 'Open database', { name, version });
                        blockStats.incrementTotal('indexedDB-open');
                        
                        // Check if IndexedDB operation needs to be blocked
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.storageSettings && siteConfig.storageSettings.blockIndexedDB) {
                            blockStats.incrementBlocked('indexedDB-open');
                            // Return a mock IDBOpenDBRequest
                            return {
                                result: null,
                                onerror: null,
                                onsuccess: null,
                                onupgradeneeded: null,
                                readyState: 'done',
                                error: new Error('IndexedDB access blocked by anti-surveillance script')
                            };
                        }
                        
                        return originalIndexedDB.open.apply(this, arguments);
                    },
                    deleteDatabase: function(name) {
                        blockLog.log('indexedDB', window, 'Delete database', { name });
                        blockStats.incrementTotal('indexedDB-delete');
                        
                        // Check if IndexedDB operation needs to be blocked
                        const siteConfig = getCurrentSiteConfig();
                        if (siteConfig.storageSettings && siteConfig.storageSettings.blockIndexedDB) {
                            blockStats.incrementBlocked('indexedDB-delete');
                            // Return a mock IDBOpenDBRequest
                            return {
                                result: null,
                                onerror: null,
                                onsuccess: null,
                                readyState: 'done',
                                error: new Error('IndexedDB access blocked by anti-surveillance script')
                            };
                        }
                        
                        return originalIndexedDB.deleteDatabase.apply(this, arguments);
                    },
                    cmp: originalIndexedDB.cmp,
                    databases: function() {
                        blockLog.log('indexedDB', window, 'Get database list');
                        blockStats.incrementTotal('indexedDB-databases');
                        return originalIndexedDB.databases.apply(this, arguments);
                    }
                };
                
                blockLog.log('system', window, 'Successfully intercepted IndexedDB');
            }
        } catch (e) {
            console.error('[Anti-Surveillance] Cookie and storage blocking failed:', e);
        }
    }
    
    /**
     * Block device information access
     * Protect device information by overriding navigator and screen object properties
     */
    function blockDeviceInfoAccess() {
        try {
            // If blocking functionality is not enabled for current website, return directly
            if (!isSiteEnabled()) return;
            
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.deviceInfo || !siteConfig.deviceInfo.enabled) {
                return; // If device info blocking is not enabled, don't execute subsequent operations
            }
            
            // Get device emulation configuration
            const emulateDevice = siteConfig.deviceInfo.emulateDevice || false;
            const deviceType = siteConfig.deviceInfo.deviceType || 'desktop';
            const customDevice = siteConfig.deviceInfo.customDevice || {};
            
            // Set device information based on device type
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
            
            // Get current device information to use
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
                // Use desktop device information by default
                currentDeviceInfo = deviceInfo.desktop;
            }
            
            // Navigator property access is already handled by unified proxy function
            // No need to implement again here
            
            // Intercept screen information access
            if (siteConfig.deviceInfo.screenInfo || emulateDevice) {
                // Create proxy for original screen object
                const screenProxy = new Proxy(window.screen, {
                    get(target, prop) {
                        // For screen properties that might leak privacy, return generic values
                        const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
                        
                        if (screenProps.includes(prop)) {
                            console.log(`[Anti-Surveillance] Blocked screen.${prop} access`);
                            // Return simulated values
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
                        
                        // Non-screen size properties, return real values
                        return Reflect.get(target, prop);
                    }
                });
                
                // Override original screen object
                Object.defineProperty(window, 'screen', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return screenProxy; }
                });
            }
            
            if (emulateDevice) {
                console.log(`[Anti-Surveillance] Device information protection enabled, emulating as ${deviceType === 'custom' ? 'custom' : deviceType === 'mobile' ? 'mobile' : deviceType === 'tablet' ? 'tablet' : 'desktop'} device`);
            } else {
                console.log('[Anti-Surveillance] Device information protection enabled');
            }
        } catch (e) {
            console.error('[Anti-Surveillance Script] Device information protection failed:', e);
        }
    }

    /**
     * Virtual mouse related variable declarations
     */
    let virtualMouse = null;          // Virtual mouse DOM element reference
    let virtualMouseInterval = null;  // Virtual mouse movement timer
    let isRealMousePresent = true;    // Flag indicating if real mouse is on the page
    let hoverPoints = [];             // Hover points array (for hover-only mode)
    let currentHoverIndex = 0;        // Current hover point index
    let handleRealMouseEnter = null;  // Store mouse enter event handler reference for removal
    let handleRealMouseLeave = null;  // Store mouse leave event handler reference for removal
    
    // Virtual mouse blacklist - avoid triggering sensitive elements
    const VIRTUAL_MOUSE_BLACKLIST = [
        'form', 'button', 'input[type="submit"]', 'input[type="button"]',
        'a[href^="javascript:"]', '[onclick*="submit"]', '[onclick*="payment"]',
        '[onclick*="buy"]', '[onclick*="purchase"]', '[onclick*="delete"]',
        '.delete-btn', '.remove-btn', '.confirm-btn'
    ];
    
    /**
     * Check if element is in blacklist
     * @param {Element} element - Element to check
     * @returns {boolean} Whether in blacklist
     */
    function isElementBlacklisted(element) {
        if (!element) return false;
        
        for (const selector of VIRTUAL_MOUSE_BLACKLIST) {
            try {
                if (element.matches && element.matches(selector)) {
                    return true;
                }
                // Check parent elements
                let parent = element.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.matches && parent.matches(selector)) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
            } catch (e) {
                // Ignore selector errors
            }
        }
        return false;
    }
    
    /**
     * Create virtual mouse element
     * Generate a virtual mouse cursor displayed on the page and set its basic styles and behaviors
     */
    function createVirtualMouse() {
        try {
            // Check if in main window environment
            const isMainWindow = isInMainWindow();
            console.log('[Anti-Surveillance Script] Checking main window environment:', isMainWindow);
            
            // If virtual mouse element already exists, remove it first
            if (virtualMouse) {
                console.log('[Anti-Surveillance Script] Removing existing virtual mouse element');
                virtualMouse.remove();
            }
            
            // Only create virtual mouse DOM element in main window
            if (isMainWindow) {
                console.log('[Anti-Surveillance Script] Creating virtual mouse element in main window');
                // Create main container element for virtual mouse
                virtualMouse = document.createElement('div');
                virtualMouse.id = 'virtual-mouse';
                virtualMouse.style.position = 'fixed'; // Fixed positioning, not affected by page scrolling
                virtualMouse.style.pointerEvents = 'none'; // Do not interfere with real mouse operations
                virtualMouse.style.zIndex = '9999999'; // Ensure display above all elements
                virtualMouse.style.transform = 'translate(-50%, -50%)'; // Align cursor center point with coordinates
                virtualMouse.style.transition = 'none'; // Disable transition effects for smoother movement
                virtualMouse.style.display = 'block'; // Ensure display when created
                virtualMouse.style.visibility = 'visible'; // Ensure visibility
                virtualMouse.style.opacity = '1'; // Ensure opacity
                virtualMouse.style.width = '40px'; // Set initial width
                virtualMouse.style.height = '40px'; // Set initial height
                
                console.log('[Anti-Surveillance Script] Virtual mouse element styling complete');
                
                // Add mouse style elements (including main cursor, click indicator and animation effects)
                virtualMouse.innerHTML = `
                    <div class="virtual-mouse-main" style="display: block; position: absolute; top: 0; left: 0;"></div>
                    <div class="virtual-mouse-click"></div>
                    <div class="virtual-mouse-pulse-ring"></div>
                `;
                
                console.log('[Anti-Surveillance Script] Virtual mouse HTML content set complete');
                
                // Add virtual mouse element to the page
                document.body.appendChild(virtualMouse);
                console.log('[Anti-Surveillance Script] Virtual mouse element added to page');
                
                // Immediately update styles to ensure correct display
                updateVirtualMouseStyle();
                
                // Add debug information after element creation
                console.log('[Anti-Surveillance Script] Virtual mouse element creation complete:', {
                    id: virtualMouse.id,
                    position: virtualMouse.style.position,
                    display: virtualMouse.style.display,
                    zIndex: virtualMouse.style.zIndex
                });
            } else {
                // In iframe, create a non-visual virtual mouse object
                console.log('[Anti-Surveillance Script] Creating non-visible virtual mouse in iframe');
                virtualMouse = null; // Do not create DOM element
            }
            
            // Generate hover points array for hover-only mode
            console.log('[Anti-Surveillance Script] Generating hover points array for hover-only mode');
            generateHoverPoints();
            
            // Add debug information
            console.log('[Anti-Surveillance Script] Virtual mouse creation complete:', isMainWindow, 'virtualMouse:', virtualMouse);
        } catch (e) {
            console.error('[Anti-Surveillance Script] Virtual mouse creation failed:', e);
        }
    }
    
    /**
     * Generate hover points array (for hover-only mode)
     */
    function generateHoverPoints() {
        try {
            // Ensure hoverPoints is an array
            if (!Array.isArray(hoverPoints)) {
                hoverPoints = [];
            }
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Determine range based on activity area
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
            
            // Ensure range values are valid
            minX = Math.max(0, minX);
            maxX = Math.max(minX, maxX);
            minY = Math.max(0, minY);
            maxY = Math.max(minY, maxY);
            
            // Generate 5 hover points
            hoverPoints = [];
            for (let i = 0; i < 5; i++) {
                hoverPoints.push({
                    x: minX + Math.random() * (maxX - minX),
                    y: minY + Math.random() * (maxY - minY)
                });
            }
            
            // If fixed position is enabled, add fixed point as hover point
            if (config.fixedPosition && config.fixedPosition.enabled) {
                hoverPoints.push({
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                });
            }
            
            // Ensure currentHoverIndex is a valid number
            if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex) || 
                currentHoverIndex < 0 || currentHoverIndex >= hoverPoints.length) {
                currentHoverIndex = 0;
            }
        } catch (e) {
            console.error('[Anti-Surveillance Script] Generate hover points failed:', e);
            // Create a default hover points array when error occurs, use random position instead of screen center
            hoverPoints = [{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight
            }];
            currentHoverIndex = 0;
        }
    }
    
    /**
     * Update virtual mouse style
     */
    function updateVirtualMouseStyle() {
        try {
            if (!virtualMouse) return;
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
            const clickIndicator = virtualMouse.querySelector('.virtual-mouse-click');
            const pulseRing = virtualMouse.querySelector('.virtual-mouse-pulse-ring');
            
            // Disable container transition effects to ensure real-time position updates
            // Virtual mouse movement should be controlled by JavaScript, not CSS transitions
            virtualMouse.style.transition = 'none';
            
            console.log('[Anti-Surveillance] Disabled virtual mouse container transition effects for real-time updates');
            
            // Main cursor style - use user-set cursor size
            const cursorSize = config.cursorSize || 40; // Directly use user-set value, no longer limit range
            mainCursor.style.width = `${cursorSize}px`;
            mainCursor.style.height = `${cursorSize}px`;
            mainCursor.style.borderRadius = '50%';
            mainCursor.style.backgroundColor = config.cursorColor || '#ff0000';
            mainCursor.style.opacity = Math.max(0.8, Math.min(1, config.cursorOpacity || 0.9));
            mainCursor.style.transition = 'none'; // Disable main cursor transition effect to avoid jitter
            mainCursor.style.display = 'block'; // Ensure main cursor is displayed
            mainCursor.style.position = 'absolute'; // Ensure correct positioning
            mainCursor.style.top = '0'; // Ensure correct position
            mainCursor.style.left = '0'; // Ensure correct position
            
            // Enhanced visual effects
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
            
            // Ensure virtual mouse is visible - force display
            const isEnabled = getCurrentSiteConfig().virtualMouse?.enabled || false;
            const isMainWindow = isInMainWindow();
            
            console.log('[Anti-Surveillance] Virtual mouse display status check:', {
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
                console.log('[Anti-Surveillance] Virtual mouse hidden, reason:', {
                    isEnabled: isEnabled,
                    isMainWindow: isMainWindow,
                    virtualMouseExists: !!virtualMouse,
                    inDocument: virtualMouse ? document.body.contains(virtualMouse) : false
                });
            }
            
            // Ensure z-index is high enough
            virtualMouse.style.zIndex = '9999999';
            
            // Ensure container styles are correct
            virtualMouse.style.position = 'fixed';
            virtualMouse.style.pointerEvents = 'none';
            virtualMouse.style.transform = 'translate(-50%, -50%)';
            
            // Apply animation effects
            applyVirtualMouseAnimations(virtualMouse, mainCursor, pulseRing, config);
            
            console.log(`[Anti-Surveillance] Virtual mouse style updated - Display: ${isEnabled}, Size: ${cursorSize}px, Main cursor display: ${mainCursor.style.display}`);
        } catch (e) {
            console.error('[Anti-Surveillance Script] Update virtual mouse style failed:', e);
        }
    }
    
n    /**
     * Apply virtual mouse animation effects
     * Dynamically add or remove animation classes based on configuration
     */
    function applyVirtualMouseAnimations(virtualMouse, mainCursor, pulseRing, config) {
        try {
            // Get animation configuration
            const animationConfig = config.animation || {};
            const isEnabled = animationConfig.enabled !== false;
            const breathingEnabled = animationConfig.breathing !== false;
            const pulseEnabled = animationConfig.pulse !== false;
            const intensity = animationConfig.intensity || 'medium';
            const performanceMode = animationConfig.performanceMode || 'auto';
            
            // Clear all animation classes
            virtualMouse.classList.remove('virtual-mouse-breathing', 'virtual-mouse-pulse', 
                                       'virtual-mouse-appear', 'virtual-mouse-disappear',
                                       'virtual-mouse-low-intensity', 'virtual-mouse-high-intensity',
                                       'virtual-mouse-performance-low', 'virtual-mouse-performance-high');
            
            if (mainCursor) {
                mainCursor.classList.remove('virtual-mouse-breathing', 'virtual-mouse-pulse');
            }
            
            if (pulseRing) {
                pulseRing.classList.remove('virtual-mouse-pulse');
            }
            
            if (!isEnabled) {
                console.log('[Anti-Surveillance] Virtual mouse animations disabled');
                return;
            }
            
            // Detect performance mode
            const detectedPerformanceMode = detectPerformanceMode(performanceMode);
            
            // Apply intensity level
            if (intensity === 'low') {
                virtualMouse.classList.add('virtual-mouse-low-intensity');
            } else if (intensity === 'high') {
                virtualMouse.classList.add('virtual-mouse-high-intensity');
            }
            
            // Apply performance mode
            if (detectedPerformanceMode === 'low') {
                virtualMouse.classList.add('virtual-mouse-performance-low');
            } else if (detectedPerformanceMode === 'high') {
                virtualMouse.classList.add('virtual-mouse-performance-high');
            }
            
            // Apply breathing animation
            if (breathingEnabled && mainCursor && detectedPerformanceMode !== 'minimal') {
                mainCursor.classList.add('virtual-mouse-breathing');
                
                // Set animation duration
                const duration = (animationConfig.duration || 2000) / 1000;
                mainCursor.style.animationDuration = `${duration}s`;
            }
            
            // Apply pulse animation
            if (pulseEnabled && pulseRing && detectedPerformanceMode !== 'low' && detectedPerformanceMode !== 'minimal') {
                // Set pulse ring style
                const cursorSize = config.cursorSize || 40;
                pulseRing.style.position = 'absolute';
                pulseRing.style.width = `${cursorSize}px`;
                pulseRing.style.height = `${cursorSize}px`;
                pulseRing.style.borderRadius = '50%';
                pulseRing.style.border = `2px solid ${config.cursorColor || '#ff0000'}`;
                pulseRing.style.top = '0';
                pulseRing.style.left = '0';
                pulseRing.style.pointerEvents = 'none';
                pulseRing.style.transform = 'translate(-50%, -50%)';
                
                pulseRing.classList.add('virtual-mouse-pulse');
                
                // Set animation duration
                const duration = (animationConfig.duration || 2000) / 1000;
                pulseRing.style.animationDuration = `${duration}s`;
            }
            
            console.log('[Anti-Surveillance] Virtual mouse animations applied:', {
                enabled: isEnabled,
                breathing: breathingEnabled,
                pulse: pulseEnabled,
                intensity: intensity,
                performanceMode: detectedPerformanceMode,
                duration: animationConfig.duration || 2000
            });
            
        } catch (e) {
            console.error('[Anti-Surveillance] Failed to apply virtual mouse animations:', e);
        }
    }
    
    /**
     * Detect performance mode
     * Automatically adjust animation complexity based on device performance and user settings
     */
    function detectPerformanceMode(userMode) {
        if (userMode === 'high') return 'high';
        if (userMode === 'low') return 'low';
        
        // Auto detection mode
        try {
            // Check hardware concurrency
            const concurrency = navigator.hardwareConcurrency || 4;
            
            // Check device memory
            const memory = navigator.deviceMemory || 4;
            
            // Check if mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Check if reduced motion preference is enabled
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
            console.warn('[Anti-Surveillance] Performance detection failed, using default mode:', e);
            return 'medium';
        }
    }
    
    /**
     * Show click effect
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
            console.error('[Anti-Surveillance Script] Show click effect failed:', e);
        }
    }
    
    // Create a dedicated state object to store various state variables of the virtual mouse
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
     * Get the next position of the virtual mouse
     * Calculate the next coordinates of the virtual mouse based on the configured path mode and activity area
     * @param {number} currentX - Current X coordinate
     * @param {number} currentY - Current Y coordinate
     * @returns {Object} Object containing new X and Y coordinates
     */
    function getNextVirtualMousePosition(currentX, currentY) {
        try {
            // Check and initialize virtual mouse state variables to ensure movement continuity
            if (virtualMouseState.smoothAngle === null) {
                debugLog('Initializing virtual mouse state variables');
                virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
                virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
                virtualMouseState.clickModeShouldClick = false;
                virtualMouseState.smoothAngle = Math.random() * Math.PI * 2;
                virtualMouseState.patternX = currentX;
                virtualMouseState.hoverTime = 0;
                virtualMouseState.hoverTargetX = currentX;
                virtualMouseState.hoverTargetY = currentY;
                virtualMouseState.lastSpeed = 0; // New: last movement speed
            }
            
            const config = getCurrentSiteConfig().virtualMouse || {};
            const viewportWidth = window.innerWidth; // Viewport width
            const viewportHeight = window.innerHeight; // Viewport height
            
            // Add debug information
            console.log('[Anti-Surveillance] Current config:', config);
            console.log('[Anti-Surveillance] Current position:', {currentX, currentY});
            
            // If fixed position is enabled, directly return the configured fixed position
            if (config.fixedPosition && config.fixedPosition.enabled) {
                const fixedPos = {
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                };
                console.log('[Anti-Surveillance] Fixed position mode, returning fixed position:', fixedPos);
                return fixedPos;
            }
            
            // If hover-only mode, return the next preset hover point
            if (config.hoverOnly && Array.isArray(hoverPoints) && hoverPoints.length > 0) {
                // Ensure currentHoverIndex is a valid number
                if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex)) {
                    currentHoverIndex = 0;
                }
                
                currentHoverIndex = (currentHoverIndex + 1) % hoverPoints.length; // Cycle through hover points
                
                // Ensure hover point is a valid object
                const hoverPoint = hoverPoints[currentHoverIndex];
                if (hoverPoint && typeof hoverPoint === 'object' && 
                    typeof hoverPoint.x === 'number' && !isNaN(hoverPoint.x) &&
                    typeof hoverPoint.y === 'number' && !isNaN(hoverPoint.y)) {
                    console.log('[Anti-Surveillance] Hover-only mode, returning hover point:', hoverPoint);
                    return hoverPoint;
                } else {
                    console.error('[Anti-Surveillance] Invalid hover point, using random position');
                    // Since minX and minY are defined later, use viewport size as default values here
                    const defaultMinX = 0;
                    const defaultMaxX = window.innerWidth;
                    const defaultMinY = 0;
                    const defaultMaxY = window.innerHeight;
                    const randomPos = {
                        x: defaultMinX + Math.random() * (defaultMaxX - defaultMinX),
                        y: defaultMinY + Math.random() * (defaultMaxY - defaultMinY)
                    };
                    debugLog('Invalid hover point, using random position:', randomPos);
                    return randomPos;
                }
            }
            
            // Determine movement range based on configured activity area
            let minX, maxX, minY, maxY;
            
            if (config.activityArea === 'custom') {
                // Custom area mode
                minX = (config.customArea && config.customArea.x1) || 0;
                maxX = (config.customArea && config.customArea.x2) || window.innerWidth;
                minY = (config.customArea && config.customArea.y1) || 0;
                maxY = (config.customArea && config.customArea.y2) || window.innerHeight;
            } else if (config.activityArea === 'content') {
                // Content area mode, try to get main content area
                const contentArea = document.querySelector('main, #content, .content') || document.body;
                const rect = contentArea.getBoundingClientRect();
                minX = rect.left;
                maxX = rect.right;
                minY = rect.top;
                maxY = rect.bottom;
            } else {
                // Full screen mode
                minX = 0;
                maxX = viewportWidth;
                minY = 0;
                maxY = viewportHeight;
            }
            
            // Ensure current position is within valid range
            currentX = Math.max(minX, Math.min(maxX, currentX));
            currentY = Math.max(minY, Math.min(maxY, currentY));
            
            // Add debug information
            console.log('[Anti-Surveillance] Activity area:', {minX, maxX, minY, maxY});
            
            let newX = currentX;
            let newY = currentY;
            const speedFactor = config.moveSpeed / 5; // Speed factor for adjusting movement speed
            
            // Calculate new position based on different path modes
            switch (config.pathMode) {
                case 'random':
                    // Random mode: move randomly in any direction, increase randomness to solve mouse position without random changes
                    // Use static variables to track last movement direction, avoid too frequent back-and-forth movement
                    if (virtualMouseState.randomAngle === null) {
                        virtualMouseState.randomAngle = Math.random() * Math.PI * 2; // Initialize random angle
                    }
                    
                    // 80% probability to maintain roughly the same direction, 20% probability to change direction
                    if (Math.random() < 0.2) {
                        // Increase randomness and naturalness of direction changes
                        virtualMouseState.randomAngle += (Math.random() - 0.5) * Math.PI * 0.8; 
                    }
                    
                    // Random distance, increase movement distance to make cursor movement more obvious
                    // Add speed variation to make movement more natural
                    const baseSpeed = config.moveSpeed || 5;
                    const randomSpeed = baseSpeed * (0.5 + Math.random() * 1.5); // Speed varies between 0.5-2 times base speed
                    const randomDistance = (20 + Math.random() * 60) * (randomSpeed / 5); 
                    
                    newX += Math.cos(virtualMouseState.randomAngle) * randomDistance;
                    newY += Math.sin(virtualMouseState.randomAngle) * randomDistance;
                    
                    // Add random micro jitter to simulate hand instability
                    const jitterAmount = config.jitterAmount || 2;
                    if (config.jitterEnabled !== false) {
                        newX += (Math.random() - 0.5) * jitterAmount;
                        newY += (Math.random() - 0.5) * jitterAmount;
                    }
                    
                    console.log('[Anti-Surveillance] Random mode, new position:', {newX, newY, randomDistance, angle: virtualMouseState.randomAngle, randomSpeed});
                    break;
                    
                case 'click':
                    // Click mode: random movement with increased click frequency
                    if (virtualMouseState.clickAngle === null) {
                        virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
                    }
                    
                    if (Math.random() < 0.15) { // Reduce direction change probability
                        virtualMouseState.clickAngle += (Math.random() - 0.5) * Math.PI * 0.5; // Reduce direction change magnitude
                    }
                    
                    // Add speed variation
                    const clickBaseSpeed = config.moveSpeed || 5;
                    const clickSpeed = clickBaseSpeed * (0.3 + Math.random() * 1.2);
                    const clickDistance = (10 + Math.random() * 15) * (clickSpeed / 5); // Reduce distance variation range
                    newX += Math.cos(virtualMouseState.clickAngle) * clickDistance;
                    newY += Math.sin(virtualMouseState.clickAngle) * clickDistance;
                    
                    // Set click probability flag, add natural click frequency variation
                    virtualMouseState.clickModeShouldClick = Math.random() < (0.05 + Math.random() * 0.1); // 5-15% probability click
                    
                    // Add random micro jitter
                    if (config.jitterEnabled !== false) {
                        const clickJitter = config.jitterAmount || 1.5;
                        newX += (Math.random() - 0.5) * clickJitter;
                        newY += (Math.random() - 0.5) * clickJitter;
                    }
                    
                    debugLog('Click mode, new position:', {newX, newY, clickDistance, angle: virtualMouseState.clickAngle, clickSpeed});
                    break;
                    
                case 'smooth':
                    // Smooth mode: mostly move in current direction, occasionally change direction
                    // Use static variables to maintain movement direction
                    if (virtualMouseState.smoothAngle === null) {
                        virtualMouseState.smoothAngle = Math.random() * Math.PI * 2; // Initialize random angle
                    }
                    
                    if (Math.random() < 0.05) { // 5% probability to change direction, smoother
                        // Add more natural direction changes, considering current speed
                        const speedInfluence = virtualMouseState.lastSpeed / 10; // Faster speed = smaller direction change
                        virtualMouseState.smoothAngle += (Math.random() - 0.5) * Math.PI * (0.25 - speedInfluence * 0.1); 
                    }
                    
                    // Move along current direction, increase movement distance to make changes more obvious
                    // Add acceleration and deceleration
                    const smoothBaseSpeed = config.moveSpeed || 5;
                    let smoothSpeed = smoothBaseSpeed;
                    
                    // Simulate human movement habits: slow start, fast middle, slow approaching target
                    const distanceToEdge = Math.min(
                        newX - minX, maxX - newX, 
                        newY - minY, maxY - newY
                    );
                    
                    if (distanceToEdge < 100) {
                        // Decelerate when approaching boundary
                        smoothSpeed = smoothBaseSpeed * (distanceToEdge / 100);
                    } else {
                        // Speed variation during normal movement
                        smoothSpeed = smoothBaseSpeed * (0.7 + Math.random() * 0.8);
                    }
                    
                    const smoothDistance = 25 * (smoothSpeed / 5);
                    newX += Math.cos(virtualMouseState.smoothAngle) * smoothDistance;
                    newY += Math.sin(virtualMouseState.smoothAngle) * smoothDistance;
                    
                    // Save current speed
                    virtualMouseState.lastSpeed = smoothSpeed;
                    
                    // Add micro jitter
                    if (config.jitterEnabled !== false) {
                        const smoothJitter = config.jitterAmount || 1;
                        newX += (Math.random() - 0.5) * smoothJitter;
                        newY += (Math.random() - 0.5) * smoothJitter;
                    }
                    
                    console.log('[Anti-Surveillance] Smooth mode, new position:', {newX, newY, angle: virtualMouseState.smoothAngle, smoothSpeed});
                    break;
                    
                case 'pattern':
                    // Pattern mode: mainly move right, occasionally line break
                    // Use static variables to track current line position
                    if (virtualMouseState.patternX === null) {
                        virtualMouseState.patternX = currentX;
                    }
                    
                    // Smart path planning: consider element layout, avoid passing through possible interactive elements
                    const elements = document.querySelectorAll('button, a, input, textarea, select, [onclick]');
                    let avoidElements = false;
                    for (const elem of elements) {
                        const rect = elem.getBoundingClientRect();
                        // Check if there are interactive elements near current position
                        if (Math.abs(newX - rect.left) < 50 && Math.abs(newY - rect.top) < 50) {
                            avoidElements = true;
                            break;
                        }
                    }
                    
                    if (avoidElements || Math.random() < 0.03 || virtualMouseState.patternX > maxX * 0.8) { // 3% probability line break or approaching right boundary or need to avoid elements
                        newY += 25 * speedFactor; // Move down (line break)
                        // Random starting position, add naturalness
                        newX = minX + Math.random() * (maxX - minX) * 0.6 + (maxX - minX) * 0.2;
                        virtualMouseState.patternX = newX; // Reset line position
                        debugLog('Pattern mode line break, new position:', {newX, newY, avoidElements});
                    } else {
                        // Add speed variation
                        const patternSpeed = (config.moveSpeed || 5) * (0.6 + Math.random() * 0.8);
                        newX += 12 * (patternSpeed / 5); // Move right
                        virtualMouseState.patternX = newX; // Update line position
                        console.log('[Anti-Surveillance] Pattern mode move right, new position:', {newX, newY, patternSpeed});
                    }
                    break;
                    
                case 'hover':
                    // Hover mode: mostly stay at current position, occasionally move to new position
                    // Use static variables to track hover time and target position
                    if (virtualMouseState.hoverTime === null) {
                        virtualMouseState.hoverTime = 0;
                    }
                    
                    if (virtualMouseState.hoverTargetX === null || virtualMouseState.hoverTargetY === null) {
                        // Initialize target position
                        virtualMouseState.hoverTargetX = currentX;
                        virtualMouseState.hoverTargetY = currentY;
                    }
                    
                    virtualMouseState.hoverTime++;
                    
                    // 1% probability to move to new position or already reached target position
                    if (Math.random() < 0.01 || (Math.abs(currentX - virtualMouseState.hoverTargetX) < 1 && Math.abs(currentY - virtualMouseState.hoverTargetY) < 1)) {
                        // Smart target position selection, considering page elements
                        let newTargetX, newTargetY;
                        
                        // 30% probability to select interactive elements on page as target
                        if (Math.random() < 0.3) {
                            const interactiveElements = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
                            if (interactiveElements.length > 0) {
                                const randomElement = interactiveElements[Math.floor(Math.random() * interactiveElements.length)];
                                const rect = randomElement.getBoundingClientRect();
                                newTargetX = rect.left + rect.width / 2;
                                newTargetY = rect.top + rect.height / 2;
                            } else {
                                // No interactive elements, randomly select position
                                newTargetX = minX + Math.random() * (maxX - minX);
                                newTargetY = minY + Math.random() * (maxY - minY);
                            }
                        } else {
                            // Randomly select position
                            newTargetX = minX + Math.random() * (maxX - minX);
                            newTargetY = minY + Math.random() * (maxY - minY);
                        }
                        
                        virtualMouseState.hoverTargetX = newTargetX;
                        virtualMouseState.hoverTargetY = newTargetY;
                        virtualMouseState.hoverTime = 0;
                        debugLog('Hover mode set new target:', {x: virtualMouseState.hoverTargetX, y: virtualMouseState.hoverTargetY});
                    }
                    
                    // Move towards target position, add natural acceleration and deceleration
                    const dx = virtualMouseState.hoverTargetX - currentX;
                    const dy = virtualMouseState.hoverTargetY - currentY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 1) {
                        // Simulate human deceleration when approaching target
                        const hoverSpeed = Math.min(
                            8, // Maximum speed
                            Math.max(1, distance * 0.05) // Farther distance = faster speed, minimum 1
                        ) * (config.moveSpeed || 5) / 5;
                        
                        const moveDistance = Math.min(distance, hoverSpeed);
                        newX = currentX + (dx / distance) * moveDistance;
                        newY = currentY + (dy / distance) * moveDistance;
                        
                        // Add micro jitter
                        if (config.jitterEnabled !== false) {
                            const hoverJitter = (config.jitterAmount || 1) * 0.5;
                            newX += (Math.random() - 0.5) * hoverJitter;
                            newY += (Math.random() - 0.5) * hoverJitter;
                        }
                        
                        debugLog('Hover mode moving:', {newX, newY, dx, dy, distance, hoverSpeed});
                    }
                    break;
                    
                default:
                    console.log('[Anti-Surveillance] Unknown path mode, using default random mode');
                    // Default random mode
                    if (virtualMouseState.randomAngle === null) {
                        virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
                    }
                    
                    if (Math.random() < 0.2) {
                        virtualMouseState.randomAngle += (Math.random() - 0.5) * Math.PI * 0.5;
                    }
                    
                    const defaultDistance = (30 + Math.random() * 50) * speedFactor;
                    newX += Math.cos(virtualMouseState.randomAngle) * defaultDistance;
                    newY += Math.sin(virtualMouseState.randomAngle) * defaultDistance;
                    console.log('[Anti-Surveillance] Default random mode, new position:', {newX, newY, defaultDistance, angle: virtualMouseState.randomAngle});
            }
            
            // Ensure new position does not exceed boundaries
            newX = Math.max(minX + 5, Math.min(maxX - 5, newX)); // Leave 5 pixel margin, avoid sticking to edges
            newY = Math.max(minY + 5, Math.min(maxY - 5, newY));
            
            // Add final position debug information
            console.log('[Anti-Surveillance] Final position:', {newX, newY});
            
            return { x: newX, y: newY };
        } catch (e) {
            console.error('[Anti-Surveillance Script] Calculate virtual mouse position failed:', e);
            return { x: currentX, y: currentY }; // Keep current position when error occurs
        }
    }
    
    // Add smooth movement related state variables
    let smoothMoveState = {
        targetX: null,
        targetY: null,
        currentDisplayX: null,
        currentDisplayY: null,
        moveProgress: 0,
        moveSpeed: 0.8, // Significantly increase movement speed
        jitterEnabled: true, // Whether to enable random jitter
        jitterAmount: 2, // Jitter amplitude
        // New Bezier curve movement parameters
        bezierPoints: [], // Bezier curve control points
        bezierProgress: 0, // Bezier curve progress
        isBezierMoving: false, // Whether currently performing Bezier curve movement
        // New real mouse behavior parameters
        acceleration: 0.1, // Acceleration
        deceleration: 0.15, // Deceleration
        maxSpeed: 15, // Maximum speed
        currentSpeed: 0, // Current speed
        targetSpeed: 0, // Target speed
        velocityX: 0, // X direction velocity
        velocityY: 0, // Y direction velocity
        // New human behavior parameters
        pauseProbability: 0.05, // Pause probability
        pauseDuration: 0, // Pause duration
        isPausing: false, // Whether currently pausing
        microMovements: true, // Whether to enable micro movements
        microMovementIntensity: 1.5 // Micro movement intensity
    };
    
    /**
     * Generate Bezier curve points
     * Use Bezier curves to generate more natural mouse movement paths
     * @param {number} startX - Starting point X coordinate
     * @param {number} startY - Starting point Y coordinate
     * @param {number} endX - End point X coordinate
     * @param {number} endY - End point Y coordinate
     * @param {number} curvature - Curvature parameter, controls curve bending degree
     * @returns {Array} Bezier curve points array
     */
    function generateBezierPath(startX, startY, endX, endY, curvature = 0.5) {
        try {
            // Calculate control points
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            // Calculate direction vector perpendicular to the connection line
            const dx = endX - startX;
            const dy = endY - startY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len;
            const perpY = dx / len;
            
            // Calculate control point offset, add randomness to make curve more natural
            const offset = len * curvature * (0.5 + Math.random() * 0.5);
            const controlX1 = midX + perpX * offset * (Math.random() > 0.5 ? 1 : -1);
            const controlY1 = midY + perpY * offset * (Math.random() > 0.5 ? 1 : -1);
            
            // Add second control point to make curve more complex
            const controlX2 = midX + perpX * offset * 0.5 * (Math.random() > 0.5 ? 1 : -1);
            const controlY2 = midY + perpY * offset * 0.5 * (Math.random() > 0.5 ? 1 : -1);
            
            // Generate Bezier curve points
            const points = [];
            const steps = 20 + Math.floor(Math.random() * 10); // 20-30 points
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                // Cubic Bezier curve formula
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
            console.error('[Anti-Surveillance Script] Generate bezier path failed:', e);
            // Return straight path when error occurs
            return [
                { x: startX, y: startY },
                { x: endX, y: endY }
            ];
        }
    }
    
    /**
     * Calculate point on Bezier curve
     * @param {number} t - Progress value, between 0-1
     * @param {Array} points - Control points array
     * @returns {Object} Object containing x and y coordinates
     */
    function getBezierPoint(t, points) {
        try {
            if (points.length < 2) return { x: 0, y: 0 };
            
            // If only two points, use linear interpolation
            if (points.length === 2) {
                return {
                    x: points[0].x + (points[1].x - points[0].x) * t,
                    y: points[0].y + (points[1].y - points[0].y) * t
                };
            }
            
            // Multi-point Bezier curve calculation (De Casteljau's algorithm)
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
            console.error('[Anti-Surveillance Script] Calculate bezier point failed:', e);
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * Update mouse speed and acceleration
     * Simulate real mouse acceleration and deceleration process
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {number} currentX - Current X coordinate
     * @param {number} currentY - Current Y coordinate
     * @returns {Object} Object containing new speed and position
     */
    function updateMouseVelocity(targetX, targetY, currentX, currentY) {
        try {
            // Calculate direction and distance to target
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If distance is very small, start decelerating
            if (distance < 50) {
                smoothMoveState.targetSpeed = Math.max(1, smoothMoveState.maxSpeed * (distance / 50));
            } else {
                // Otherwise accelerate to maximum speed
                smoothMoveState.targetSpeed = smoothMoveState.maxSpeed;
            }
            
            // Update current speed (with acceleration)
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
            
            // Calculate velocity vector
            let velocityX = 0;
            let velocityY = 0;
            
            if (distance > 0.1) {
                velocityX = (dx / distance) * smoothMoveState.currentSpeed;
                velocityY = (dy / distance) * smoothMoveState.currentSpeed;
            }
            
            // Apply micro movements (simulate slight hand jitter)
            if (smoothMoveState.microMovements && Math.random() < 0.3) {
                velocityX += (Math.random() - 0.5) * smoothMoveState.microMovementIntensity;
                velocityY += (Math.random() - 0.5) * smoothMoveState.microMovementIntensity;
            }
            
            // Calculate new position
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
            console.error('[Anti-Surveillance Script] Update mouse speed failed:', e);
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
     * Check if movement should be paused
     * Simulate natural pauses when humans use mouse
     * @returns {boolean} Whether should pause
     */
    function shouldPause() {
        try {
            // If already pausing, check if should continue
            if (smoothMoveState.isPausing) {
                smoothMoveState.pauseDuration--;
                if (smoothMoveState.pauseDuration <= 0) {
                    smoothMoveState.isPausing = false;
                    return false;
                }
                return true;
            }
            
            // Check if should start pausing
            if (Math.random() < smoothMoveState.pauseProbability) {
                smoothMoveState.isPausing = true;
                smoothMoveState.pauseDuration = 5 + Math.floor(Math.random() * 10); // Pause for 5-15 frames
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('[Anti-Surveillance Script] Check pause status failed:', e);
            return false;
        }
    }

    // Global variable for storing current position of virtual mouse
    let currentPos = null;
    
    // Interception logging system
    const blockLog = {
        entries: [],
        maxEntries: 1000,
        
        log(eventType, target, action, details = {}, context = {}) {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.logging || !siteConfig.logging.enabled) return;
            
            // Only output normal operation when device or service is online
            if (action.includes('offline') || eventType.includes('offline')) {
                // Replace with online status output
                console.log('[Anti-Surveillance] Device is online');
                return;
            }
            
            const logLevel = siteConfig.logging.level || 'info';
            
            // Enhanced target information
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
            
            // Console output
            if (entry.level === 'debug' || entry.level === 'info') {
                console.log(`[Anti-Surveillance] ${action} - ${eventType}`, entry);
            } else if (entry.level === 'warn') {
                console.warn(`[Anti-Surveillance] ${action} - ${eventType}`, entry);
            } else if (entry.level === 'error') {
                console.error(`[Anti-Surveillance] ${action} - ${eventType}`, entry);
            }
        },
        
        getEntries() {
            return [...this.entries];
        },
        
        clear() {
            this.entries = [];
        }
    };
    
    // Interception success rate statistics system
    const blockStats = {
        totalEvents: 0,
        blockedEvents: 0,
        eventTypeStats: {},
        
        incrementTotal(eventType) {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig.stats || !siteConfig.stats.enabled) return;
            
            // Only count online status related events
            if (eventType === 'online' || eventType === 'offline') {
                // Uniformly count as online status events
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
            
            // Only count online status related events
            if (eventType === 'online' || eventType === 'offline') {
                // Uniformly count as online status events
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
     * Initialize virtual mouse position and start timed movement updates
     */
    function startVirtualMouse(customConfig) {
        try {
            // First declare currentPos variable to avoid undefined errors
            currentPos = {
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight
            };
            
            // Get current site configuration
            const siteConfigResult = getCurrentSiteConfig() || {};
            // Ensure virtualMouse configuration exists
            const siteConfig = siteConfigResult.virtualMouse || {};
            // Get global configuration (if exists)
            const globalConfig = window.virtualMouseConfig || {};
            // Ensure defaultSiteConfig.virtualMouse exists
            const defaultVirtualMouseConfig = (typeof defaultSiteConfig === 'object' && defaultSiteConfig !== null && defaultSiteConfig.virtualMouse) ? defaultSiteConfig.virtualMouse : {};
            // Merge configurations
            const config = {
                moveInterval: 50, // Reduce default movement interval to make movement smoother
                movementSmoothness: 0.3, // Increase default smoothness to make effect more obvious
                jitterEnabled: true, // Enable jitter by default
                jitterAmount: 2, // Default jitter amplitude
                ...defaultVirtualMouseConfig,
                ...siteConfig,
                ...globalConfig,
                ...(customConfig || {})
            };
            
            // Update smooth movement state
            smoothMoveState.moveSpeed = config.moveSpeed || 0.3; // Use moveSpeed instead of movementSmoothness
            smoothMoveState.jitterEnabled = config.jitterEnabled !== false; // Enable jitter by default
            smoothMoveState.jitterAmount = config.jitterAmount || 2;
            
            console.log('[Anti-Surveillance] Attempting to start virtual mouse, merged config:', config);
            debugLog('Smooth movement configuration:', {
                moveSpeed: smoothMoveState.moveSpeed,
                jitterEnabled: smoothMoveState.jitterEnabled,
                jitterAmount: smoothMoveState.jitterAmount
            });
            
            // If virtual mouse is not enabled, do not execute
            if (!config.enabled) {
                console.log('[Anti-Surveillance] Virtual mouse not enabled, not starting');
                return;
            }
            
            // If already running, do not start again
            if (virtualMouseInterval) {
                console.log('[Anti-Surveillance] Virtual mouse already running, not starting again');
                return;
            }
            
            debugLog('Starting virtual mouse, path mode:', config.pathMode);
            
            // Ensure virtual mouse element is created
            if (!virtualMouse) {
                console.log('[Anti-Surveillance] Creating virtual mouse element');
                createVirtualMouse();
            }
            
            // Generate hover points
            debugLog('Generating hover points');
            generateHoverPoints();
            
            // Ensure hoverPoints is a valid array
            if (!Array.isArray(hoverPoints)) {
                hoverPoints = [];
                console.log('[Anti-Surveillance] hoverPoints reset to empty array');
            }
            
            // Ensure currentHoverIndex is valid
            if (typeof currentHoverIndex !== 'number' || isNaN(currentHoverIndex) || currentHoverIndex < 0) {
                currentHoverIndex = 0;
                console.log('[Anti-Surveillance] currentHoverIndex reset to 0');
            }
            
            // Initialize position
            // More safely check fixedPosition configuration
            const hasValidFixedPosition = config && config.fixedPosition && typeof config.fixedPosition === 'object' && config.fixedPosition.enabled;
            
            if (hasValidFixedPosition) {
                // If fixed position is enabled, use configured fixed coordinates
                currentPos = {
                    x: (config.fixedPosition.x || 0),
                    y: (config.fixedPosition.y || 0)
                };
                console.log('[Anti-Surveillance] Using fixed position:', currentPos);
            } else {
                // Otherwise randomly generate an initial position on screen
                currentPos = {
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight
                };
                debugLog('Using random initial position:', currentPos);
            }
            
            // Ensure currentPos is a valid object
            if (!currentPos || typeof currentPos !== 'object') {
                currentPos = {
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight
                };
                console.log('[Anti-Surveillance] Reset to random position:', currentPos);
            }
            
            // Ensure currentPos has valid x and y properties
            if (typeof currentPos.x !== 'number' || isNaN(currentPos.x)) {
                currentPos.x = Math.random() * window.innerWidth;
            }
            if (typeof currentPos.y !== 'number' || isNaN(currentPos.y)) {
                currentPos.y = Math.random() * window.innerHeight;
            }
            
            // Reset path mode state variables
            debugLog('Reset path mode state variables');
            virtualMouseState.randomAngle = Math.random() * Math.PI * 2;
            virtualMouseState.clickAngle = Math.random() * Math.PI * 2;
            virtualMouseState.clickModeShouldClick = false;
            virtualMouseState.smoothAngle = Math.random() * Math.PI * 2;
            virtualMouseState.patternX = currentPos.x;
            virtualMouseState.hoverTime = 0;
            virtualMouseState.hoverTargetX = currentPos.x;
            virtualMouseState.hoverTargetY = currentPos.y;
            
            // Reset smooth movement state
            console.log('[Anti-Surveillance] Reset smooth movement state');
            smoothMoveState.targetX = currentPos.x;
            smoothMoveState.targetY = currentPos.y;
            smoothMoveState.currentDisplayX = currentPos.x;
            smoothMoveState.currentDisplayY = currentPos.y;
            smoothMoveState.moveProgress = 0;
            
            console.log('[Anti-Surveillance] Reset path mode state variables and smooth movement state');
            console.log('[Anti-Surveillance] Initialize coordinates:', {
                targetX: smoothMoveState.targetX,
                targetY: smoothMoveState.targetY,
                currentDisplayX: smoothMoveState.currentDisplayX,
                currentDisplayY: smoothMoveState.currentDisplayY
            });
            
            // Initialize Bezier curve and physics model parameters
            smoothMoveState.bezierPoints = [];
            smoothMoveState.bezierProgress = 0;
            smoothMoveState.isBezierMoving = false;
            
            // Initialize velocity and acceleration parameters
            smoothMoveState.currentSpeed = 1;
            smoothMoveState.targetSpeed = smoothMoveState.maxSpeed || 5;
            smoothMoveState.acceleration = smoothMoveState.acceleration || 0.2;
            smoothMoveState.deceleration = smoothMoveState.deceleration || 0.3;
            
            // Initialize human behavior parameters
            smoothMoveState.isPausing = false;
            smoothMoveState.pauseDuration = 0;
            smoothMoveState.pauseProbability = smoothMoveState.pauseProbability || 0.02;
            smoothMoveState.microMovements = smoothMoveState.microMovements !== false;
            smoothMoveState.microMovementIntensity = smoothMoveState.microMovementIntensity || 0.5;
            
            // Internal function for updating position
            function updateVirtualMouse() {
                // Get current configuration
                const config = getCurrentSiteConfig().virtualMouse || {};
                
                // Ensure currentPos is a valid object
                if (!currentPos || typeof currentPos !== 'object') {
                    // Use random position instead of screen center position
                    currentPos = {
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight
                    };
                    console.log('[Anti-Surveillance] Reset currentPos to random position:', currentPos);
                }
                
                // Ensure currentPos has valid x and y properties
                if (typeof currentPos.x !== 'number' || isNaN(currentPos.x)) {
                    currentPos.x = Math.random() * window.innerWidth;
                }
                if (typeof currentPos.y !== 'number' || isNaN(currentPos.y)) {
                    currentPos.y = Math.random() * window.innerHeight;
                }
                
                // Record current position
                debugLog('Position before update:', currentPos);
                
                // Calculate new position
                let newPos = null;
                try {
                    newPos = getNextVirtualMousePosition(currentPos.x, currentPos.y);
                    
                    // Record new position
                    debugLog('Calculated new position:', newPos);
                    
                    // Ensure new position is valid
                    if (!newPos || typeof newPos !== 'object' || 
                        typeof newPos.x !== 'number' || isNaN(newPos.x) ||
                        typeof newPos.y !== 'number' || isNaN(newPos.y)) {
                        console.error('[Anti-Surveillance] Calculated new position is invalid, using current position');
                        newPos = null;
                    }
                } catch (e) {
                    console.error('[Anti-Surveillance] Calculate new position failed, using current position:', e);
                    newPos = null;
                }
                
                // If smooth movement is completed and there's a new position, update target position
                if (smoothMoveState.moveProgress >= 1 && newPos) {
                    // Update smooth movement target position
                    smoothMoveState.targetX = newPos.x;
                    smoothMoveState.targetY = newPos.y;
                    smoothMoveState.moveProgress = 0; // Reset movement progress
                    
                    // Generate new Bezier path
                    const curvature = 0.2 + Math.random() * 0.6; // Random curvature
                    smoothMoveState.bezierPoints = generateBezierPath(
                        smoothMoveState.currentDisplayX, 
                        smoothMoveState.currentDisplayY, 
                        smoothMoveState.targetX, 
                        smoothMoveState.targetY, 
                        curvature
                    );
                    smoothMoveState.bezierProgress = 0;
                    smoothMoveState.isBezierMoving = true;
                    
                    console.log('[Anti-Surveillance] Smooth movement complete, updating target position and generating new bezier path:', newPos);
                } else if (newPos && (smoothMoveState.targetX !== newPos.x || smoothMoveState.targetY !== newPos.y)) {
                    // If there's a new position and target position is different, update target position
                    smoothMoveState.targetX = newPos.x;
                    smoothMoveState.targetY = newPos.y;
                    smoothMoveState.moveProgress = 0; // Reset movement progress
                    
                    // Generate new Bezier path
                    const curvature = 0.2 + Math.random() * 0.6; // Random curvature
                    smoothMoveState.bezierPoints = generateBezierPath(
                        smoothMoveState.currentDisplayX, 
                        smoothMoveState.currentDisplayY, 
                        smoothMoveState.targetX, 
                        smoothMoveState.targetY, 
                        curvature
                    );
                    smoothMoveState.bezierProgress = 0;
                    smoothMoveState.isBezierMoving = true;
                    
                    debugLog('Update target position and generate new Bezier path:', newPos);
                }
                
                // Record updated position
                console.log('[Anti-Surveillance] Current position:', currentPos, 'Target position:', {x: smoothMoveState.targetX, y: smoothMoveState.targetY});
                
                // Smooth movement calculation
            smoothMoveState.moveProgress += smoothMoveState.moveSpeed;
            if (smoothMoveState.moveProgress > 1) {
                smoothMoveState.moveProgress = 1;
            }
            
            debugLog('Movement progress:', smoothMoveState.moveProgress, 'moveSpeed:', smoothMoveState.moveSpeed);
                
                // Use Bezier curves and physics models for more realistic movement
                let displayX, displayY;
                
                // Initialize display position, ensure valid coordinate values
                if (smoothMoveState.currentDisplayX === null || smoothMoveState.currentDisplayX === undefined ||
                    smoothMoveState.currentDisplayY === null || smoothMoveState.currentDisplayY === undefined) {
                    // Use current position instead of screen center position
                    smoothMoveState.currentDisplayX = currentPos.x || Math.random() * window.innerWidth;
                    smoothMoveState.currentDisplayY = currentPos.y || Math.random() * window.innerHeight;
                    console.log('[Anti-Surveillance] Initialize display position:', {
                        currentDisplayX: smoothMoveState.currentDisplayX,
                        currentDisplayY: smoothMoveState.currentDisplayY,
                        currentPos: currentPos
                    });
                }
                
                // Check if movement should be paused
                if (shouldPause()) {
                    // Maintain current position when paused
                    displayX = smoothMoveState.currentDisplayX;
                    displayY = smoothMoveState.currentDisplayY;
                } else {
                    // If currently in Bezier movement, use Bezier path
                    if (smoothMoveState.isBezierMoving && smoothMoveState.bezierPoints.length > 0) {
                        // Update Bezier progress
                        smoothMoveState.bezierProgress += 0.02 + Math.random() * 0.03; // Progress step of 0.02-0.05
                        
                        if (smoothMoveState.bezierProgress >= 1) {
                            // Bezier movement complete
                            smoothMoveState.bezierProgress = 1;
                            smoothMoveState.isBezierMoving = false;
                        }
                        
                        // Get point on Bezier curve
                        const bezierPoint = getBezierPoint(smoothMoveState.bezierProgress, smoothMoveState.bezierPoints);
                        
                        // Update position using physics model
                        const velocityResult = updateMouseVelocity(
                            bezierPoint.x, 
                            bezierPoint.y, 
                            smoothMoveState.currentDisplayX, 
                            smoothMoveState.currentDisplayY
                        );
                        
                        // Update current display position
                        displayX = velocityResult.x;
                        displayY = velocityResult.y;
                    } else {
                        // Update position using physics model
                        const velocityResult = updateMouseVelocity(
                            smoothMoveState.targetX, 
                            smoothMoveState.targetY, 
                            smoothMoveState.currentDisplayX, 
                            smoothMoveState.currentDisplayY
                        );
                        
                        // Update current display position
                        displayX = velocityResult.x;
                        displayY = velocityResult.y;
                    }
                    
                    // Check if approaching target
                    const distance = Math.sqrt(
                        Math.pow(smoothMoveState.targetX - displayX, 2) + 
                        Math.pow(smoothMoveState.targetY - displayY, 2)
                    );
                    
                    // If very close to target, update current display position and current position
                    if (distance < 5) {
                        smoothMoveState.currentDisplayX = smoothMoveState.targetX;
                        smoothMoveState.currentDisplayY = smoothMoveState.targetY;
                        // Update current position to target position
                        currentPos = {
                            x: smoothMoveState.targetX,
                            y: smoothMoveState.targetY
                        };
                        console.log('[Anti-Surveillance] Smooth movement complete, updating current position:', currentPos);
                    } else {
                        // Otherwise update current display position
                        smoothMoveState.currentDisplayX = displayX;
                        smoothMoveState.currentDisplayY = displayY;
                    }
                }
                
                // Check if in main window and virtual mouse exists
                if (virtualMouse && window === window.top && document.body.contains(virtualMouse)) {
                    // Boundary check, ensure coordinates are within screen range
                    const boundedX = Math.max(0, Math.min(window.innerWidth, displayX));
                    const boundedY = Math.max(0, Math.min(window.innerHeight, displayY));
                    
                    // Only update DOM element position in main window
                    // Since transform: translate(-50%, -50%) is used, directly set left and top
                    virtualMouse.style.left = `${boundedX}px`;
                    virtualMouse.style.top = `${boundedY}px`;
                    
                    // Ensure virtual mouse is visible
                    virtualMouse.style.display = 'block';
                    virtualMouse.style.visibility = 'visible';
                    virtualMouse.style.opacity = '1';
                    
                    console.log('[Anti-Surveillance] Update virtual mouse position:', {
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
                    
                    // Ensure virtual mouse is visible
                    virtualMouse.style.display = 'block';
                    
                    // Ensure main cursor is visible
                    const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                    if (mainCursor) {
                        mainCursor.style.display = 'block';
                        // Ensure main cursor styles are correctly applied
                        const cursorSize = config.cursorSize || 40;
                        mainCursor.style.width = `${cursorSize}px`;
                        mainCursor.style.height = `${cursorSize}px`;
                        mainCursor.style.borderRadius = '50%';
                        mainCursor.style.backgroundColor = config.cursorColor || '#ff0000';
                        mainCursor.style.opacity = Math.max(0.8, Math.min(1, config.cursorOpacity || 0.9));
                        
                        console.log('[Anti-Surveillance] Main cursor status:', {
                            display: mainCursor.style.display,
                            width: mainCursor.style.width,
                            height: mainCursor.style.height,
                            backgroundColor: mainCursor.style.backgroundColor,
                            opacity: mainCursor.style.opacity
                        });
                    }
                    
                    // Trigger mouse move events to allow page elements to properly respond to virtual mouse
                    simulateMouseMove(displayX, displayY);
                    
                    // In click mode, show more obvious click effects based on probability
                    if (config.pathMode === 'click' && Math.random() < 0.1) {
                        showClickEffect();
                    } else {
                        // Occasionally show click effects in other modes
                        if (Math.random() < 0.01) {
                            showClickEffect();
                        }
                    }
                } else {
                    // In iframe, still trigger mouse move events
                    simulateMouseMove(displayX, displayY);
                    
                    // In iframe, don't actually trigger clicks, only show effects in click mode
                    if (config.pathMode === 'click' && Math.random() < 0.1) {
                        debugLog('Simulate click mode effects in iframe');
                    }
                }
            }
            
            // Easing function: quadratic ease-in-out
            function easeInOutQuad(t) {
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            }
            
            // Determine movement interval - hover mode uses longer intervals
            const interval = (config.hoverOnly || false) ? (config.hoverInterval || 2000) : (config.moveInterval || 1000); // Reduce interval to 1000ms
            console.log('[Anti-Surveillance] Set movement interval:', interval, 'ms');
            
            // Start timer for periodic position updates
            virtualMouseInterval = setInterval(updateVirtualMouse, interval);
            console.log('[Anti-Surveillance] Timer set, ID:', virtualMouseInterval);
            updateVirtualMouse(); // Execute immediately to avoid initial delay
            
            // Ensure virtual mouse styles are correctly set
            if (virtualMouse) {
                updateVirtualMouseStyle();
                
                // Ensure virtual mouse is visible
                virtualMouse.style.display = 'block';
                virtualMouse.style.visibility = 'visible';
                virtualMouse.style.opacity = '1';
                
                // Ensure main cursor is visible
                const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                if (mainCursor) {
                    mainCursor.style.display = 'block';
                    mainCursor.style.visibility = 'visible';
                    mainCursor.style.opacity = '1';
                }
                
                // Set initial position, ensure coordinates are valid
                // Use current position instead of screen center position
                const initialX = smoothMoveState.currentDisplayX || currentPos?.x || Math.random() * window.innerWidth;
                const initialY = smoothMoveState.currentDisplayY || currentPos?.y || Math.random() * window.innerHeight;
                
                virtualMouse.style.left = `${initialX}px`;
                virtualMouse.style.top = `${initialY}px`;
                
                console.log('[Anti-Surveillance] Set virtual mouse initial position:', {
                    initialX: initialX,
                    initialY: initialY,
                    currentDisplayX: smoothMoveState.currentDisplayX,
                    currentDisplayY: smoothMoveState.currentDisplayY
                });
                
                debugLog('Virtual mouse element status:', {
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
            
            debugLog('Virtual mouse started');
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to start virtual mouse:', e);
        }
    }
    
    /**
     * Stop virtual mouse
     * Clear timer and hide virtual mouse cursor based on configuration
     */
    function stopVirtualMouse() {
        try {
            console.log('[Anti-Surveillance] Preparing to stop virtual mouse, current status:', {
                virtualMouseInterval: !!virtualMouseInterval,
                virtualMouse: !!virtualMouse
            });
            
            // Clear timer
            if (virtualMouseInterval) {
                console.log('[Anti-Surveillance] Clear timer:', virtualMouseInterval);
                clearInterval(virtualMouseInterval);
                virtualMouseInterval = null;
            }
            
            // Reset path mode state variables
            console.log('[Anti-Surveillance] Reset path mode state variables');
            virtualMouseState.randomAngle = null;
            virtualMouseState.clickAngle = null;
            virtualMouseState.clickModeShouldClick = false;
            virtualMouseState.smoothAngle = null;
            virtualMouseState.patternX = null;
            virtualMouseState.hoverTime = null;
            virtualMouseState.hoverTargetX = null;
            virtualMouseState.hoverTargetY = null;
            
            // Reset smooth movement state
            console.log('[Anti-Surveillance] Reset smooth movement state');
            smoothMoveState.targetX = null;
            smoothMoveState.targetY = null;
            smoothMoveState.currentDisplayX = null;
            smoothMoveState.currentDisplayY = null;
            smoothMoveState.moveProgress = 0;
            
            // Reset current position variables
            console.log('[Anti-Surveillance] Reset current position variables');
            currentPos = null;
            
            console.log('[Anti-Surveillance] Reset path mode state variables and smooth movement state');
            
            // If not always showing cursor, hide virtual mouse
            const config = getCurrentSiteConfig().virtualMouse || {};
            if (virtualMouse && !(config.showCursorAlways || false)) {
                virtualMouse.style.display = 'none';
                console.log('[Anti-Surveillance] Hide virtual mouse element');
            }
            
            debugLog('Virtual mouse stopped');
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to stop virtual mouse:', e);
        }
    }
    
    /**
     * Simulate mouse click
     */
    function simulateMouseClick(x, y) {
        try {
            // Create click event, remove view property to avoid compatibility issues in some environments
            const clickEvent = new MouseEvent('click', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            // Find element at position and trigger click
            const element = document.elementFromPoint(x, y);
            if (element) {
                // Check if element is in blacklist
                if (isElementBlacklisted(element)) {
                    debugLog('Skip blacklisted element click:', element);
                    return;
                }
                element.dispatchEvent(clickEvent);
                debugLog('Simulate mouse click');
            }
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to simulate mouse click:', e);
        }
    }
    
    /**
     * Simulate mouse movement
     */
    function simulateMouseMove(x, y) {
        try {
            // Create mouse move event
            const mouseMoveEvent = new MouseEvent('mousemove', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true
            });
            
            // Find element at position and trigger mouse move event
            const element = document.elementFromPoint(x, y);
            if (element) {
                element.dispatchEvent(mouseMoveEvent);
            }
            
            // Also trigger mouseover and mouseenter events to ensure video controls display correctly
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
            
            // Continuously trigger mouse move events to solve scrollbar auto-hiding after first display
            // Find all possible scrollbar elements
            const scrollbars = document.querySelectorAll('::-webkit-scrollbar, ::-webkit-scrollbar-track, ::-webkit-scrollbar-thumb');
            scrollbars.forEach(scrollbar => {
                // Send mouse move events to scrollbar elements
                scrollbar.dispatchEvent(mouseMoveEvent);
                scrollbar.dispatchEvent(mouseOverEvent);
                scrollbar.dispatchEvent(mouseEnterEvent);
            });
            
            // Special handling for video elements to ensure controls remain visible
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                // Check if video has controls
                if (video.controls) {
                    // Send mouse move events to video element
                    video.dispatchEvent(mouseMoveEvent);
                    video.dispatchEvent(mouseOverEvent);
                    video.dispatchEvent(mouseEnterEvent);
                    
                    // Find video controls container
                    const controls = video.querySelector('.controls, .video-controls, [class*="control"]');
                    if (controls) {
                        controls.dispatchEvent(mouseMoveEvent);
                        controls.dispatchEvent(mouseOverEvent);
                        controls.dispatchEvent(mouseEnterEvent);
                    }
                }
            });
            
            console.log('[Anti-Surveillance] Simulate mouse movement');
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to simulate mouse movement:', e);
        }
    }
    
    /**
     * Set up real mouse detection
     */
    function setupRealMouseDetection() {
        try {
            const siteConfig = getCurrentSiteConfig();
            const config = siteConfig.virtualMouse;
            // First check if website has anti-monitoring enabled, then check if virtual mouse is enabled
            if (!siteConfig.enabled || !config.enabled) return;

            // Define event handler functions and save references
            handleRealMouseEnter = function() {
                isRealMousePresent = true;
                debugLog('Real mouse entered page');
                // Re-fetch configuration to avoid closure variable access issues
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
                console.log('[Anti-Surveillance] Real mouse left page');
                try {
                    // Re-fetch configuration to avoid closure variable access issues
                    const siteConfigResult = getCurrentSiteConfig() || {};
                    const config = (siteConfigResult && typeof siteConfigResult === 'object' && siteConfigResult.virtualMouse) ? siteConfigResult.virtualMouse : {};
                    if ((config.activateOnLeave || false) && !virtualMouseInterval) {
                        startVirtualMouse();
                    }
                    if (virtualMouse) {
                        virtualMouse.style.display = 'block';
                    }
                } catch (e) {
                    console.error('[Anti-Surveillance Script] Failed to handle real mouse leave event:', e);
                }
            };

            // Add event listeners
            document.addEventListener('mouseenter', handleRealMouseEnter);
            document.addEventListener('mouseleave', handleRealMouseLeave);

            debugLog('Real mouse detection set up');
        } catch (e) {
            console.error('[Anti-Surveillance Script] Failed to setup mouse detection:', e);
        }
    }

    /**
     * Apply button styles
     */
    function applyButtonStyles(button) {
        try {
            // Get current website button configuration
            const siteConfig = getCurrentSiteConfig();
            const style = siteConfig.buttonConfig || {
                text: 'Anti-Surveillance',
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
            
            // Update button text
            button.textContent = style.text;
            
            // Reset all position-related styles
            button.style.top = 'auto';
            button.style.bottom = 'auto';
            button.style.left = 'auto';
            button.style.right = 'auto';
            
            // Set positioning based on position
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
            
            // Apply other styles
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
            console.error('[Anti-Surveillance Script] Failed to apply button styles:', e);
        }
    }

    /**
     * Create complete configuration interface
     */
    function createConfigUI() {
        try {
            // Check if in main window environment
            if (!isInMainWindow()) {
                console.log('[Anti-Surveillance Script] Not creating configuration interface in iframe/object/embed');
                return;
            }
            
            // Check if configuration panel already exists
            if (document.getElementById('anti-monitor-config')) {
                console.log('[Anti-Surveillance Script] Configuration panel already exists');
                return;
            }

            console.log('[Anti-Surveillance Script] Starting to create complete configuration interface...');
            
            // Create configuration panel
            const panel = document.createElement('div');
            panel.id = 'anti-monitor-config';
            panel.className = 'anti-monitor-panel';
            
            // Get current website configuration
            const currentSiteConfig = getCurrentSiteConfig();
            // Ensure currentSiteKey is correctly set
            if (!globalConfig.currentSiteKey || !globalConfig.sites[globalConfig.currentSiteKey]) {
                globalConfig.currentSiteKey = getCurrentSiteKey();
                console.log('[Anti-Surveillance Script] Updated currentSiteKey to:', globalConfig.currentSiteKey);
            }
            const currentSiteKey = globalConfig.currentSiteKey;
            
            // Generate website list HTML
            let sitesListHtml = '<option value="">-- Select Website --</option>';
            for (const siteKey in globalConfig.sites) {
                const selected = siteKey === currentSiteKey ? 'selected' : '';
                sitesListHtml += `<option value="${escapeHtml(siteKey)}" ${selected}>${escapeHtml(siteKey)}</option>`;
            }
            
            // Panel content
            panel.innerHTML = `
                <div class="anti-monitor-header">
                    <h3>Anti-Surveillance Advanced Configuration</h3>
                    <button class="anti-monitor-close">×</button>
                </div>
                <div class="anti-monitor-content">
                    <!-- Website Configuration Management -->
                    <div class="config-section">
                        <h4>Website Configuration Management</h4>
                        <div class="config-item">
                            <label for="site-selector">Select Website Configuration:</label>
                            <select id="site-selector">
                                ${sitesListHtml}
                            </select>
                            <p class="config-hint">Each website can have independent configuration. Settings will be loaded after switching</p>
                            
                            <button id="add-new-site" style="margin-top: 5px;">Add Current Website</button>
                            <button id="delete-site" style="margin-top: 5px; margin-left: 5px;">Delete Selected Website</button>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="site-enabled">
                                Enable blocking functionality for current website
                            </label>
                            <p class="config-hint">Master switch: When disabled, all anti-surveillance features for current website will be ineffective</p>
                        </div>
                    </div>

                    <!-- Page Visibility Monitoring Blocking -->
                    <div class="config-section">
                        <h4>Page Visibility Monitoring Blocking</h4>
                        <p class="config-hint">Prevent websites from detecting whether you are currently viewing the page (e.g., when switching tabs)</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-visibilitychange">
                                Block visibilitychange events (page visibility changes)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-webkit">
                                Block webkitvisibilitychange events (browser compatibility)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="page-visibility-override">
                                Force return page visible status
                            </label>
                        </div>
                    </div>

                    <!-- Focus Event Blocking -->
                    <div class="config-section">
                        <h4>Focus Event Blocking</h4>
                        <p class="config-hint">Prevent websites from detecting whether you have moved your attention to other windows</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="focus-event-blur">
                                Block blur events (page loses focus)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="focus-event-focus">
                                Block focus events (page gains focus)
                            </label>
                        </div>
                    </div>

                    <!-- Fullscreen Event Blocking -->
                    <div class="config-section">
                        <h4>Fullscreen Event Blocking</h4>
                        <p class="config-hint">Prevent websites from detecting whether you have entered or exited fullscreen mode</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="fullscreen-change">
                                Block fullscreen state change events
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="fullscreen-browser-specific">
                                Block browser-specific fullscreen events (webkit/moz/ms)
                            </label>
                        </div>
                    </div>

                    <!-- Mouse Event Blocking -->
                    <div class="config-section">
                        <h4>Mouse Event Blocking</h4>
                        <p class="config-hint">Control website detection of mouse operations</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-movement-mousemove">
                                Block mousemove events (mouse movement tracking)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-movement-wheel">
                                Block mouse wheel events (mousewheel and DOMMouseScroll)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-click-events">
                                Block all click-related events (mousedown, mouseup, etc.)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="mouse-hover-events">
                                Block all hover-related events (mouseover, mouseout, etc.)
                            </label>
                        </div>
                    </div>

                    <!-- Advanced Event Blocking -->
                    <div class="config-section">
                        <h4>Advanced Event Blocking</h4>
                        <p class="config-hint">More types of event blocking options</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="keyboard-events">
                                Block keyboard events (keydown, keyup, keypress)
                            </label>
                            <p class="config-hint">May affect normal website interaction, such as text input</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="window-events">
                                Block window events (resize, scroll, beforeunload)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="clipboard-events">
                                Block clipboard events (copy, cut, paste)
                            </label>
                            <p class="config-hint">Copy and paste functionality will be unavailable after blocking</p>
                        </div>
                    </div>

                    <!-- Navigation Event Interception -->
                    <div class="config-section">
                        <h4>Navigation Event Interception</h4>
                        <p class="config-hint">Prevent websites from detecting internal page navigation and URL changes</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events-popstate">
                                Intercept popstate events (browser back/forward buttons)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events-hashchange">
                                Intercept hashchange events (URL anchor changes)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="navigation-events">
                                Intercept all navigation events
                            </label>
                            <p class="config-hint">Including popstate, hashchange and other events</p>
                        </div>
                    </div>

                    <!-- Touch Event Interception -->
                    <div class="config-section">
                        <h4>Touch Event Interception</h4>
                        <p class="config-hint">Prevent websites from detecting touch screen operations (mainly affects mobile devices)</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchstart">
                                Intercept touchstart events (touch start)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchmove">
                                Intercept touchmove events (touch movement)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events-touchend">
                                Intercept touchend events (touch end)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="touch-events">
                                Intercept all touch events
                            </label>
                            <p class="config-hint">Including touchstart, touchmove, touchend and other events</p>
                        </div>
                    </div>

                    <!-- Form Event Interception -->
                    <div class="config-section">
                        <h4>Form Event Interception</h4>
                        <p class="config-hint">Prevent websites from tracking form filling and input behavior</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-change">
                                Intercept change events (input value changes)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-input">
                                Intercept input events (real-time input)
                            </label>
                            <p class="config-hint">May affect form auto-fill and real-time validation</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events-submit">
                                Intercept submit events (form submission)
                            </label>
                            <p class="config-hint">Interception may affect normal form submission</p>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="form-events">
                                Intercept all form events
                            </label>
                            <p class="config-hint">Including change, input, submit and other events</p>
                        </div>
                    </div>

                    <!-- Online/Offline Status Detection -->
                    <div class="config-section">
                        <h4>Online/Offline Status Detection</h4>
                        <p class="config-hint">Control websites' ability to detect your network connection status</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-events-enabled">
                                Enable online/offline status control
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-event-online">
                                Intercept online events (network connection restored)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-event-offline">
                                Intercept offline events (network connection lost)
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="connectivity-override-online">
                                Always show as online status
                            </label>
                            <p class="config-hint">Override navigator.onLine property to make websites think you're always online</p>
                        </div>
                    </div>

                    <!-- Device Information Protection -->
                    <div class="config-section">
                        <h4>Device Information Protection</h4>
                        <p class="config-hint">Protect your device information from being accessed by websites</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-enabled">
                                Enable device information protection
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-navigator-properties">
                                Hide real browser identity and environment information
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="device-info-screen-info">
                                Hide real screen size and resolution
                            </label>
                        </div>
                        
                        <!-- Virtual Device Information Settings -->
                        <div class="config-subsection">
                            <h5>Virtual Device Information</h5>
                            <p class="config-hint">Simulate operations as other types of devices (such as mobile)</p>
                            
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="device-emulate-enabled">
                                    Enable device emulation
                                </label>
                            </div>
                            
                            <div class="config-item">
                                <label for="device-type">Device Type:</label>
                                <select id="device-type">
                                    <option value="desktop">Desktop (default)</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="tablet">Tablet</option>
                                    <option value="custom">Custom Device</option>
                                </select>
                            </div>
                            
                            <!-- Custom Device Information (hidden by default) -->
                            <div id="custom-device-config" style="display: none;">
                                <div class="config-item">
                                    <label for="custom-user-agent">Custom User-Agent:</label>
                                    <input type="text" id="custom-user-agent" placeholder="Enter custom User-Agent" style="width: 100%; margin-top: 5px;">
                                </div>
                                <div class="config-item">
                                    <label for="custom-platform">Custom Platform:</label>
                                    <input type="text" id="custom-platform" placeholder="e.g.: Win32, Android, iPad" style="width: 100%; margin-top: 5px;">
                                </div>
                                <div class="config-item">
                                    <label>Screen Size:</label>
                                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                                        <div>
                                            <label for="custom-screen-width">Width:</label>
                                            <input type="number" id="custom-screen-width" placeholder="Width" min="1">
                                        </div>
                                        <div>
                                            <label for="custom-screen-height">Height:</label>
                                            <input type="number" id="custom-screen-height" placeholder="Height" min="1">
                                        </div>
                                    </div>
                                </div>
                                <div class="config-item">
                                    <label>Available Area Size:</label>
                                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                                        <div>
                                            <label for="custom-avail-width">Width:</label>
                                            <input type="number" id="custom-avail-width" placeholder="Width" min="1">
                                        </div>
                                        <div>
                                            <label for="custom-avail-height">Height:</label>
                                            <input type="number" id="custom-avail-height" placeholder="Height" min="1">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Virtual Mouse Advanced Settings -->
                    <div class="config-section">
                        <h4>Virtual Mouse Advanced Settings</h4>
                        <p class="config-hint">Automatically simulate mouse activity when your real mouse leaves the page</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-enabled">
                                Enable automatic virtual mouse function
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-activate-on-leave">
                                Activate virtual mouse when real mouse leaves
                            </label>
                        </div>
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="virtual-mouse-deactivate-on-enter">
                                Deactivate virtual mouse when real mouse enters
                            </label>
                        </div>
                        
                        <!-- Cursor Style Settings -->
                        <div class="config-subsection">
                            <h5>Cursor Style</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-show-cursor">
                                    Show virtual mouse cursor
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-color">Cursor Color:</label>
                                <input type="color" id="virtual-mouse-color">
                                <input type="text" id="virtual-mouse-color-text" placeholder="e.g.: black">
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-size">Cursor Size (pixels):</label>
                                <input type="number" id="virtual-mouse-size" min="5" max="200" step="1">
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-opacity">Cursor Opacity (0.1-1.0):</label>
                                <input type="range" id="virtual-mouse-opacity" min="0.1" max="1.0" step="0.1">
                                <span id="virtual-mouse-opacity-value"></span>
                            </div>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-enhanced">
                                    Enable enhanced visual effects
                                </label>
                                <p class="config-hint">Make virtual mouse more visible with click animations</p>
                            </div>
                        </div>
                        
                        <!-- Movement Settings -->
                        <div class="config-subsection">
                            <h5>Movement Settings</h5>
                            <div class="config-item">
                                <label for="virtual-mouse-path">Movement Path Mode:</label>
                                <select id="virtual-mouse-path">
                                    <option value="random">Random Movement</option>
                                    <option value="smooth">Smooth Curve</option>
                                    <option value="pattern">Reading Simulation</option>
                                    <option value="hover">Hover Mode</option>
                                    <option value="click">Click Mode</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-speed">Movement Speed (1-10):</label>
                                <input type="range" id="virtual-mouse-speed" min="1" max="10" step="1">
                                <span id="virtual-mouse-speed-value"></span>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-interval">Movement Interval (milliseconds):</label>
                                <input type="number" id="virtual-mouse-interval" min="100" max="1000" step="50">
                            </div>
                        </div>
                        
                        <!-- Hover Only Function -->
                        <div class="config-subsection">
                            <h5>Hover Function</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-hover-only">
                                    Hover only without movement (switch between multiple points)
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="virtual-mouse-hover-interval">Hover Switch Interval (milliseconds):</label>
                                <input type="number" id="virtual-mouse-hover-interval" min="1000" max="10000" step="500">
                            </div>
                        </div>
                        
                        <!-- Activity Area Settings -->
                        <div class="config-subsection">
                            <h5>Activity Area Settings</h5>
                            <div class="config-item">
                                <label for="virtual-mouse-area">Activity Area:</label>
                                <select id="virtual-mouse-area">
                                    <option value="full">Entire Page</option>
                                    <option value="content">Main Content Area</option>
                                    <option value="custom">Custom Area</option>
                                </select>
                            </div>
                            
                            <!-- Custom Area Settings -->
                            <div id="custom-area-settings" class="config-subgroup">
                                <p class="config-hint">Set rectangular area coordinates for virtual mouse activity</p>
                                <div class="config-item">
                                    <label for="custom-area-x1">Top-left X Coordinate:</label>
                                    <input type="number" id="custom-area-x1" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-y1">Top-left Y Coordinate:</label>
                                    <input type="number" id="custom-area-y1" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-x2">Bottom-right X Coordinate:</label>
                                    <input type="number" id="custom-area-x2" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="custom-area-y2">Bottom-right Y Coordinate:</label>
                                    <input type="number" id="custom-area-y2" min="0">
                                </div>
                                <button id="set-custom-area-from-view" style="margin-top: 5px;">
                                    Set from Current View
                                </button>
                            </div>
                        </div>
                        
                        <!-- Fixed Position Settings -->
                        <div class="config-subsection">
                            <h5>Fixed Position Settings</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="virtual-mouse-fixed-position">
                                    Enable fixed position function
                                </label>
                            </div>
                            <div id="fixed-position-settings" class="config-subgroup">
                                <div class="config-item">
                                    <label for="fixed-position-x">Fixed X Coordinate:</label>
                                    <input type="number" id="fixed-position-x" min="0">
                                </div>
                                <div class="config-item">
                                    <label for="fixed-position-y">Fixed Y Coordinate:</label>
                                    <input type="number" id="fixed-position-y" min="0">
                                </div>
                                <button id="set-fixed-position-from-cursor" style="margin-top: 5px;">
                                    Use Current Mouse Position
                                </button>
                            </div>
                        </div>
                        
                        <div class="config-item">
                            <button id="test-virtual-mouse">Test Virtual Mouse</button>
                            <button id="test-virtual-mouse-click" style="margin-left: 5px;">Test Click Effect</button>
                        </div>
                    </div>

                    <!-- Anti-Surveillance Button Configuration -->
                    <div class="config-section">
                        <h4>Anti-Surveillance Button Configuration</h4>
                        <p class="config-hint">Customize button appearance, position and name</p>
                        
                        <div class="config-item">
                            <label for="button-text">Button Display Text:</label>
                            <input type="text" id="button-text" placeholder="Enter button name">
                            <p class="config-hint">Can modify the text displayed on the button</p>
                        </div>
                        <div class="config-item">
                            <label for="button-position">Button Position:</label>
                            <select id="button-position">
                                <option value="top-left">Top-left Corner</option>
                                <option value="top-right">Top-right Corner</option>
                                <option value="bottom-left">Bottom-left Corner</option>
                                <option value="bottom-right">Bottom-right Corner</option>
                                <option value="custom">Custom Position</option>
                            </select>
                        </div>
                        <div class="config-item" id="custom-position-container">
                            <label for="button-custom-x">X Coordinate (e.g.: 20px):</label>
                            <input type="text" id="button-custom-x" placeholder="Horizontal position">
                            
                            <label for="button-custom-y" style="margin-top: 5px;">Y Coordinate (e.g.: 20px):</label>
                            <input type="text" id="button-custom-y" placeholder="Vertical position">
                        </div>
                        <div class="config-item">
                            <label for="button-bg-color">Background Color:</label>
                            <input type="color" id="button-bg-color">
                            <input type="text" id="button-bg-color-text" placeholder="e.g.: #ff4444">
                        </div>
                        <div class="config-item">
                            <label for="button-text-color">Text Color:</label>
                            <input type="color" id="button-text-color">
                            <input type="text" id="button-text-color-text" placeholder="e.g.: #ffffff">
                        </div>
                        <div class="config-item">
                            <label for="button-width">Width (e.g.: 80px or auto):</label>
                            <input type="text" id="button-width" placeholder="Width value">
                        </div>
                        <div class="config-item">
                            <label for="button-height">Height (e.g.: 30px or auto):</label>
                            <input type="text" id="button-height" placeholder="Height value">
                        </div>
                        <div class="config-item">
                            <label for="button-padding">Padding (e.g.: 8px 12px):</label>
                            <input type="text" id="button-padding" placeholder="Padding value">
                        </div>
                        <div class="config-item">
                            <label for="button-font-size">Font Size (e.g.: 14px):</label>
                            <input type="text" id="button-font-size" placeholder="Font size">
                        </div>
                        <div class="config-item">
                            <label for="button-border-radius">Border Radius (e.g.: 4px):</label>
                            <input type="text" id="button-border-radius" placeholder="Border radius value">
                        </div>
                        <div class="config-item">
                            <label for="button-opacity">Opacity (0.1-1.0):</label>
                            <input type="number" id="button-opacity" min="0.1" max="1.0" step="0.1">
                        </div>
                        <div class="config-item">
                            <label for="button-z-index">Z-Index (higher values appear on top):</label>
                            <input type="number" id="button-z-index" min="1">
                        </div>
                    </div>

                    <!-- Advanced Interception Rules Configuration -->
                    <div class="config-section">
                        <h4>Advanced Interception Rules Configuration</h4>
                        <p class="config-hint">Configure more fine-grained interception rules, supporting regex and element selectors</p>
                        
                        <div class="config-item">
                            <label>
                                <input type="checkbox" id="advanced-blocking-enabled">
                                Enable advanced interception rules
                            </label>
                        </div>
                        <div class="config-item">
                            <button id="add-rule">Add Interception Rule</button>
                            <button id="clear-rules">Clear All Rules</button>
                        </div>
                        <div id="rules-container" style="margin-top: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                            <!-- Rules will be dynamically added here -->
                        </div>
                    </div>
                    
                    <!-- Logging and Statistics Configuration -->
                    <div class="config-section">
                        <h4>Logging and Statistics Configuration</h4>
                        <p class="config-hint">Configure interception logging and statistics functions</p>
                        
                        <!-- Logging Configuration -->
                        <div class="config-subsection">
                            <h5>Logging Configuration</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="logging-enabled">
                                    Enable interception logging
                                </label>
                            </div>
                            <div class="config-item">
                                <label for="log-level">Log Level:</label>
                                <select id="log-level">
                                    <option value="debug">Debug</option>
                                    <option value="info" selected>Info</option>
                                    <option value="warn">Warning</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <button id="view-logs">View Logs</button>
                                <button id="clear-logs">Clear Logs</button>
                            </div>
                        </div>
                        
                        <!-- Statistics Configuration -->
                        <div class="config-subsection">
                            <h5>Statistics Configuration</h5>
                            <div class="config-item">
                                <label>
                                    <input type="checkbox" id="stats-enabled">
                                    Enable interception statistics
                                </label>
                            </div>
                            <div class="config-item">
                                <button id="view-stats">View Statistics</button>
                                <button id="reset-stats">Reset Statistics</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Configuration Action Buttons -->
                    <div class="config-actions">
                        <button id="save-config">Save Configuration</button>
                        <button id="reset-current-config">Reset Current Site Configuration</button>
                        <button id="reset-all-config">Reset All Configuration</button>
                    </div>
                </div>
            `;

                    // Add to page (add panel first regardless of whether button is shown)
            document.body.appendChild(panel);
            console.log('[Anti-Surveillance Script] Complete configuration panel added to page');

            // Hide configuration panel by default (remove visible class instead of setting display)
            panel.classList.remove('visible');

            // Check if anti-surveillance button should be displayed
            // Only show button when monitoring is enabled and configured to show button
            const hasSiteConfig = globalConfig.sites[globalConfig.currentSiteKey] !== undefined;
            const isMonitoringEnabled = currentSiteConfig.enabled === true;
            const shouldShowButton = hasSiteConfig && isMonitoringEnabled && (currentSiteConfig.showButton !== undefined ?
                                    currentSiteConfig.showButton :
                                    globalConfig.showButtonByDefault);

            // Create trigger button variable (increase scope to entire function)
            let trigger;
            
            // Only create and add button when site has configuration and is configured to show button
            if (shouldShowButton) {
                // Create trigger button
                trigger = document.createElement('button');
                trigger.id = 'anti-monitor-trigger';
                document.body.appendChild(trigger);
                console.log('[Anti-Surveillance Script] Trigger button added to page');

                // Apply button styles and text
                if (trigger) {
                    applyButtonStyles(trigger);
                }
            } else {
                console.log('[Anti-Surveillance Script] Current page not configured or not configured to show button, not displaying button');
            }

            // Load current site configuration to UI
            document.getElementById('site-enabled').checked = currentSiteConfig.enabled;
            
            // Page visibility events
            document.getElementById('page-visibility-visibilitychange').checked = currentSiteConfig.pageVisibilityEvents.visibilitychange;
            document.getElementById('page-visibility-webkit').checked = currentSiteConfig.pageVisibilityEvents.webkitvisibilitychange;
            document.getElementById('page-visibility-override').checked = currentSiteConfig.pageVisibilityEvents.overrideVisibilityState;
            
            // Focus events
            document.getElementById('focus-event-blur').checked = currentSiteConfig.focusEvents.blur;
            document.getElementById('focus-event-focus').checked = currentSiteConfig.focusEvents.focus;
            
            // Fullscreen events
            document.getElementById('fullscreen-change').checked = currentSiteConfig.fullscreenEvents.fullscreenchange;
            document.getElementById('fullscreen-browser-specific').checked = 
                currentSiteConfig.fullscreenEvents.webkitfullscreenchange && 
                currentSiteConfig.fullscreenEvents.mozfullscreenchange && 
                currentSiteConfig.fullscreenEvents.msfullscreenchange;
            
            // Mouse events
            document.getElementById('mouse-movement-mousemove').checked = currentSiteConfig.mouseEvents.mousemove;
            document.getElementById('mouse-movement-wheel').checked = currentSiteConfig.mouseEvents.mousewheel;
            
            // Mouse click and hover events master switch
            const areAllClickEventsChecked = currentSiteConfig.mouseEvents.click;
            document.getElementById('mouse-click-events').checked = areAllClickEventsChecked;
            
            const areAllHoverEventsChecked = currentSiteConfig.mouseEvents.hover;
            document.getElementById('mouse-hover-events').checked = areAllHoverEventsChecked;
            
            // Advanced event interception
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
            
            // Navigation event interception configuration
            document.getElementById('navigation-events-popstate').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.popstate;
            document.getElementById('navigation-events-hashchange').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.hashchange;
            document.getElementById('navigation-events').checked = currentSiteConfig.navigationEvents && currentSiteConfig.navigationEvents.popstate && currentSiteConfig.navigationEvents.hashchange;
            
            // Touch event interception configuration
            document.getElementById('touch-events-touchstart').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchstart;
            document.getElementById('touch-events-touchmove').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchmove;
            document.getElementById('touch-events-touchend').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchend;
            document.getElementById('touch-events').checked = currentSiteConfig.touchEvents && currentSiteConfig.touchEvents.touchstart && currentSiteConfig.touchEvents.touchmove && currentSiteConfig.touchEvents.touchend;
            
            // Form event interception configuration
            document.getElementById('form-events-change').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.change;
            document.getElementById('form-events-input').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.input;
            document.getElementById('form-events-submit').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.submit;
            document.getElementById('form-events').checked = currentSiteConfig.formEvents && currentSiteConfig.formEvents.change && currentSiteConfig.formEvents.input && currentSiteConfig.formEvents.submit;
            
            // Online/offline status detection configuration - Always set to online status
            document.getElementById('connectivity-events-enabled').checked = true;
            document.getElementById('connectivity-event-online').checked = true;
            document.getElementById('connectivity-event-offline').checked = true;
            document.getElementById('connectivity-override-online').checked = true;
            
            // Device information protection configuration
            document.getElementById('device-info-enabled').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.enabled;
            document.getElementById('device-info-navigator-properties').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.navigatorProperties;
            document.getElementById('device-info-screen-info').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.screenInfo;
            
            // Virtual device information configuration
            document.getElementById('device-emulate-enabled').checked = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.emulateDevice;
            document.getElementById('device-type').value = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.deviceType || 'desktop';
            
            // Custom device configuration
            const customDevice = currentSiteConfig.deviceInfo && currentSiteConfig.deviceInfo.customDevice || {};
            document.getElementById('custom-user-agent').value = customDevice.userAgent || '';
            document.getElementById('custom-platform').value = customDevice.platform || '';
            document.getElementById('custom-screen-width').value = customDevice.screenWidth || '';
            document.getElementById('custom-screen-height').value = customDevice.screenHeight || '';
            document.getElementById('custom-avail-width').value = customDevice.availWidth || '';
            document.getElementById('custom-avail-height').value = customDevice.availHeight || '';
            
            // Show/hide custom device configuration area based on device type
            document.getElementById('device-type').addEventListener('change', function() {
                document.getElementById('custom-device-config').style.display = this.value === 'custom' ? 'block' : 'none';
            });
            
            // Initially show/hide custom device configuration area
            document.getElementById('custom-device-config').style.display = document.getElementById('device-type').value === 'custom' ? 'block' : 'none';
            
            // Virtual mouse configuration
            const vmConfig = currentSiteConfig.virtualMouse;
            console.log('[Anti-surveillance] Loading virtual mouse configuration:', vmConfig);
            
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
            
            // Ensure path mode has valid value
            const pathMode = vmConfig.pathMode || 'random';
            document.getElementById('virtual-mouse-path').value = pathMode;
            debugLog('Setting path mode:', pathMode);
            
            document.getElementById('virtual-mouse-speed').value = vmConfig.moveSpeed;
            document.getElementById('virtual-mouse-speed-value').textContent = vmConfig.moveSpeed;
            document.getElementById('virtual-mouse-interval').value = vmConfig.moveInterval;
            document.getElementById('virtual-mouse-hover-only').checked = vmConfig.hoverOnly;
            document.getElementById('virtual-mouse-hover-interval').value = vmConfig.hoverInterval;
            document.getElementById('virtual-mouse-area').value = vmConfig.activityArea;
            
            // Custom area settings
            document.getElementById('custom-area-x1').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.x1) || 0;
            document.getElementById('custom-area-y1').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.y1) || 0;
            document.getElementById('custom-area-x2').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.x2) || 0;
            document.getElementById('custom-area-y2').value = (currentSiteConfig.virtualMouse.customArea && currentSiteConfig.virtualMouse.customArea.y2) || 0;
            
            // Fixed position settings
            document.getElementById('virtual-mouse-fixed-position').checked = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.enabled) || false;
            document.getElementById('fixed-position-x').value = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.x) || 0;
            document.getElementById('fixed-position-y').value = (currentSiteConfig.virtualMouse.fixedPosition && currentSiteConfig.virtualMouse.fixedPosition.y) || 0;
            
            // Button configuration
            const siteButtonConfig = currentSiteConfig.buttonConfig || {
                text: 'Anti-Surveillance',
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

            // Control custom area settings visibility
            function toggleCustomAreaSettings() {
                const container = document.getElementById('custom-area-settings');
                const area = document.getElementById('virtual-mouse-area').value;
                container.style.display = area === 'custom' ? 'block' : 'none';
            }
            toggleCustomAreaSettings();
            document.getElementById('virtual-mouse-area').addEventListener('change', toggleCustomAreaSettings);

            // Control fixed position settings visibility
            function toggleFixedPositionSettings() {
                const container = document.getElementById('fixed-position-settings');
                const enabled = document.getElementById('virtual-mouse-fixed-position').checked;
                container.style.display = enabled ? 'block' : 'none';
            }
            toggleFixedPositionSettings();
            document.getElementById('virtual-mouse-fixed-position').addEventListener('change', toggleFixedPositionSettings);

            // Control custom position input visibility
            function toggleCustomPosition() {
                const container = document.getElementById('custom-position-container');
                const position = document.getElementById('button-position').value;
                container.style.display = position === 'custom' ? 'block' : 'none';
            }
            toggleCustomPosition();
            document.getElementById('button-position').addEventListener('change', toggleCustomPosition);

            // Color picker linkage with text input
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
            
            // Virtual mouse color picker linkage with text input
            document.getElementById('virtual-mouse-color').addEventListener('input', function() {
                document.getElementById('virtual-mouse-color-text').value = this.value;
            });
            document.getElementById('virtual-mouse-color-text').addEventListener('input', function() {
                document.getElementById('virtual-mouse-color').value = this.value;
            });

            // Virtual mouse speed slider display
            document.getElementById('virtual-mouse-speed').addEventListener('input', function() {
                document.getElementById('virtual-mouse-speed-value').textContent = this.value;
            });
            
            // Virtual mouse opacity slider display
            document.getElementById('virtual-mouse-opacity').addEventListener('input', function() {
                document.getElementById('virtual-mouse-opacity-value').textContent = this.value;
            });
            
            // Apply immediately when path mode changes
            document.getElementById('virtual-mouse-path').addEventListener('change', function() {
                console.log('[Anti-Surveillance] Path mode changed to:', this.value);
                // If virtual mouse is running, stop and restart to apply new path mode
                if (window.virtualMouseInterval) {
                    stopVirtualMouse();
                    // Reset virtual mouse state
                    virtualMouseState.randomAngle = null;
                    virtualMouseState.clickAngle = null;
                    virtualMouseState.clickModeShouldClick = false;
                    virtualMouseState.smoothAngle = null;
                    virtualMouseState.patternX = null;
                    virtualMouseState.hoverTime = null;
                    // Restart virtual mouse
                    startVirtualMouse();
                }
            });

            // Event listener: open/close configuration panel
            if (trigger) {
                trigger.addEventListener('click', () => {
                    panel.classList.toggle('visible');
                    console.log('[Anti-Surveillance Script] Configuration panel display state toggled');
                });
            }

            // Close configuration panel
            document.querySelector('.anti-monitor-close').addEventListener('click', () => {
                panel.classList.remove('visible');
            });

            // Website selector change: switch between different website configurations
            document.getElementById('site-selector').addEventListener('change', function() {
                // Before switching website configuration, save current website configuration first
                const currentSiteKey = globalConfig.currentSiteKey;
                const currentSiteConfig = getCurrentSiteConfig();
                
                // Ensure current configuration is saved
                if (currentSiteKey && currentSiteConfig) {
                    globalConfig.sites[currentSiteKey] = currentSiteConfig;
                    console.log(`[Anti-Surveillance] Save current website configuration: ${currentSiteKey}`);
                }
                
                // Switch to new website configuration
                const selectedKey = unescapeHtml(this.value);
                if (selectedKey && selectedKey in globalConfig.sites) {
                    globalConfig.currentSiteKey = selectedKey;
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
                    }
                    // Remove page refresh, change to reload configuration and update UI
                    reloadConfigPanel();
                }
            });
            
            // Add current website to configuration list
            document.getElementById('add-new-site').addEventListener('click', () => {
                // Get current website identifier, supports local files
                let newSiteKey;
                if (window.location.protocol === 'file:') {
                    // For local files, use normalized path as configuration key
                    newSiteKey = 'file://' + window.location.pathname.replace(/\\/g, '/');
                } else {
                    // For regular websites, use hostname
                    newSiteKey = window.location.hostname;
                }
                
                if (!(newSiteKey in globalConfig.sites)) {
                    // Create new website configuration, enable button display by default
                    const newSiteConfig = JSON.parse(JSON.stringify(defaultSiteConfig));
                    newSiteConfig.showButton = true;
                    // Ensure newly added website configuration can display button, even if enabled is false
                    globalConfig.sites[newSiteKey] = newSiteConfig;
                    globalConfig.currentSiteKey = newSiteKey;
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[Anti-surveillance Script] Non-Tampermonkey environment, configuration not saved');
                    }
                    reloadConfigPanel();
                } else {
                    alert('This website is already in the configuration list');
                }
            });
            
            // Delete selected website configuration
            document.getElementById('delete-site').addEventListener('click', () => {
                const selectedKey = unescapeHtml(document.getElementById('site-selector').value);
                if (selectedKey && selectedKey in globalConfig.sites) {
                    if (confirm(`Are you sure you want to delete the configuration for ${selectedKey}?`)) {
                        delete globalConfig.sites[selectedKey];
                        // If deleting current website, switch to first website or create new one
                        if (selectedKey === globalConfig.currentSiteKey) {
                            const siteKeys = Object.keys(globalConfig.sites);
                            globalConfig.currentSiteKey = siteKeys.length > 0 ? siteKeys[0] : '';
                        }
                        if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', globalConfig);
                        } else {
                            console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
                        }
                        reloadConfigPanel();
                    }
                } else {
                    alert('Please select a website first');
                }
            });

            // Fullscreen event browser-specific option linkage
            document.getElementById('fullscreen-browser-specific').addEventListener('change', function() {
                const checked = this.checked;
                document.getElementById('fullscreen-change').checked = checked;
            });

            // Mouse event blocking master switch linkage
            document.getElementById('mouse-click-events').addEventListener('change', function() {
                const checked = this.checked;
                // Don't auto-check click event as it affects normal usage
                document.getElementById('mouse-movement-mousemove').checked = checked;
            });
            
            document.getElementById('mouse-hover-events').addEventListener('change', function() {
                const checked = this.checked;
            });

            // Advanced event blocking master switch linkage
            document.getElementById('keyboard-events').addEventListener('change', function() {
                const checked = this.checked;
            });
            
            document.getElementById('window-events').addEventListener('change', function() {
                const checked = this.checked;
            });
            
            document.getElementById('clipboard-events').addEventListener('change', function() {
                const checked = this.checked;
            });

            // Virtual mouse: set custom area from current view
            document.getElementById('set-custom-area-from-view').addEventListener('click', function() {
                document.getElementById('custom-area-x1').value = 0;
                document.getElementById('custom-area-y1').value = 0;
                document.getElementById('custom-area-x2').value = window.innerWidth;
                document.getElementById('custom-area-y2').value = window.innerHeight;
            });
            
            // Virtual mouse: use current mouse position as fixed point
            document.getElementById('set-fixed-position-from-cursor').addEventListener('click', function() {
                // Create temporary mouse move listener to get current position
                const tempGetCurrentCursorPosition = function(e) {
                    document.getElementById('fixed-position-x').value = Math.round(e.clientX);
                    document.getElementById('fixed-position-y').value = Math.round(e.clientY);
                    document.removeEventListener('mousemove', tempGetCurrentCursorPosition);
                    alert('Set to current mouse position');
                };
                document.addEventListener('mousemove', tempGetCurrentCursorPosition);
                alert('Please move mouse to target position');
            });

            // Test virtual mouse
            document.getElementById('test-virtual-mouse').addEventListener('click', function() {
                const currentState = virtualMouseInterval !== null;
                if (currentState) {
                    stopVirtualMouse();
                    this.textContent = 'Test Virtual Mouse';
                } else {
                    startVirtualMouse();
                    this.textContent = 'Stop Test';
                }
            });
            
            // Test virtual mouse click effect
            document.getElementById('test-virtual-mouse-click').addEventListener('click', function() {
                if (!virtualMouse) {
                    createVirtualMouse();
                }
                showClickEffect();
            });

            // Save configuration
            document.getElementById('save-config').addEventListener('click', () => {
                try {
                    const currentSiteKey = globalConfig.currentSiteKey;
                    if (!currentSiteKey) return;
                    
                    // Save current website configuration
                    const siteConfig = globalConfig.sites[currentSiteKey];
                    
                    siteConfig.enabled = document.getElementById('site-enabled').checked;
                    
                    // Page visibility event settings
                    siteConfig.pageVisibilityEvents = {
                        visibilitychange: document.getElementById('page-visibility-visibilitychange').checked,
                        webkitvisibilitychange: document.getElementById('page-visibility-webkit').checked,
                        overrideVisibilityState: document.getElementById('page-visibility-override').checked
                    };
                    
                    // Focus event settings
                    siteConfig.focusEvents = {
                        blur: document.getElementById('focus-event-blur').checked,
                        focus: document.getElementById('focus-event-focus').checked
                    };
                    
                    // Fullscreen event settings
                    const fullscreenBrowserSpecific = document.getElementById('fullscreen-browser-specific').checked;
                    siteConfig.fullscreenEvents = {
                        fullscreenchange: document.getElementById('fullscreen-change').checked,
                        webkitfullscreenchange: fullscreenBrowserSpecific,
                        mozfullscreenchange: fullscreenBrowserSpecific,
                        msfullscreenchange: fullscreenBrowserSpecific
                    };
                    
                    // Mouse event settings
                    siteConfig.mouseEvents = {
                        mousemove: document.getElementById('mouse-movement-mousemove').checked,
                        mousewheel: document.getElementById('mouse-movement-wheel').checked,
                        click: document.getElementById('mouse-click-events').checked,
                        hover: document.getElementById('mouse-hover-events').checked
                    };
                    
                    // Keyboard event settings
                    const keyboardEventsChecked = document.getElementById('keyboard-events').checked;
                    siteConfig.keyboardEvents = {
                        keydown: keyboardEventsChecked,
                        keyup: keyboardEventsChecked,
                        keypress: keyboardEventsChecked
                    };
                    
                    // Window event settings
                    const windowEventsChecked = document.getElementById('window-events').checked;
                    siteConfig.windowEvents = {
                        resize: windowEventsChecked,
                        scroll: windowEventsChecked,
                        beforeunload: windowEventsChecked
                    };
                    
                    // Clipboard event settings
                    const clipboardEventsChecked = document.getElementById('clipboard-events').checked;
                    siteConfig.clipboardEvents = {
                        copy: clipboardEventsChecked,
                        cut: clipboardEventsChecked,
                        paste: clipboardEventsChecked
                    };
                    
                    // Navigation event settings
                    const navigationEventsAllChecked = document.getElementById('navigation-events').checked;
                    siteConfig.navigationEvents = {
                        popstate: navigationEventsAllChecked || document.getElementById('navigation-events-popstate').checked,
                        hashchange: navigationEventsAllChecked || document.getElementById('navigation-events-hashchange').checked
                    };
                    
                    // Touch event settings
                    const touchEventsAllChecked = document.getElementById('touch-events').checked;
                    siteConfig.touchEvents = {
                        touchstart: touchEventsAllChecked || document.getElementById('touch-events-touchstart').checked,
                        touchmove: touchEventsAllChecked || document.getElementById('touch-events-touchmove').checked,
                        touchend: touchEventsAllChecked || document.getElementById('touch-events-touchend').checked
                    };
                    
                    // Form event settings
                    const formEventsAllChecked = document.getElementById('form-events').checked;
                    siteConfig.formEvents = {
                        change: formEventsAllChecked || document.getElementById('form-events-change').checked,
                        input: formEventsAllChecked || document.getElementById('form-events-input').checked,
                        submit: formEventsAllChecked || document.getElementById('form-events-submit').checked
                    };
                    
                    // Online/offline status detection settings - always set to online status
                    siteConfig.connectivityEvents = {
                        enabled: true,
                        blockOnlineEvent: true,
                        blockOfflineEvent: true,
                        overrideOnlineState: true
                    };
                    
                    // Device information protection settings
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
                    
                    // Virtual mouse settings
                    const pathMode = document.getElementById('virtual-mouse-path').value;
                    debugLog('Saving path mode:', pathMode);
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
                    
                    // Save website-specific button display settings
                    siteConfig.showButton = true;
                    
                    // Ensure current website configuration is added to globalConfig.sites
                    // Use currentSiteKey instead of getCurrentSiteKey() to ensure saving to correct website configuration
                    const siteKeyToSave = globalConfig.currentSiteKey;
                    if (!globalConfig.sites[siteKeyToSave]) {
                        globalConfig.sites[siteKeyToSave] = siteConfig;
                        globalConfig.currentSiteKey = siteKeyToSave;
                    } else {
                        // Update existing website configuration
                        globalConfig.sites[siteKeyToSave] = siteConfig;
                    }
                    
                    // Save button configuration to current website configuration
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
                        text: document.getElementById('button-text').value || 'Anti-Surveillance'
                    };
                    
                    // Save advanced blocking rules configuration
                    siteConfig.advancedBlocking = {
                        enabled: document.getElementById('advanced-blocking-enabled').checked,
                        rules: [] // Rules will be saved through separate function
                    };
                    
                    // Save logging configuration
                    siteConfig.logging = {
                        enabled: document.getElementById('logging-enabled').checked,
                        level: document.getElementById('log-level').value,
                        maxLogEntries: 1000
                    };
                    
                    // Save statistics configuration
                    siteConfig.stats = {
                        enabled: document.getElementById('stats-enabled').checked,
                        trackSuccessRate: true,
                        trackEventTypes: true
                    };
                    
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
                    }
                    alert('Configuration saved!');
                    
                    // Apply button styles and text immediately (fix: display anti-monitor button after confirming options on new website without configuration)
                    let trigger = document.getElementById('anti-monitor-trigger');
                    if (trigger) {
                        applyButtonStyles(trigger);
                    } else if (siteConfig.enabled) {
                        // If button doesn't exist but anti-monitoring is enabled, create button
                        console.log('[Anti-Surveillance Script] Creating new trigger button');
                        trigger = document.createElement('button');
                        trigger.id = 'anti-monitor-trigger';
                        document.body.appendChild(trigger);
                        applyButtonStyles(trigger);
                        
                        // Add click event
                        trigger.addEventListener('click', () => {
                            const panel = document.getElementById('anti-monitor-config');
                            panel.classList.toggle('visible');
                        });
                    }
                    updateVirtualMouseStyle();
                    
                    // Reapply blocking
                    blockEventListeners();
                } catch (e) {
                    console.error('[Anti-Surveillance Script] Failed to save configuration:', e);
                    alert('Failed to save configuration, please check console error messages');
                }
            });

            // Reset current website configuration
            document.getElementById('reset-current-config').addEventListener('click', () => {
                const currentSiteKey = globalConfig.currentSiteKey;
                if (currentSiteKey && confirm(`Are you sure you want to reset the configuration for ${currentSiteKey}?`)) {
                    globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
                    }
                    reloadConfigPanel();
                }
            });

            // Reset all configurations
            document.getElementById('reset-all-config').addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all configurations? This will delete all custom website settings!')) {
                    if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', defaultGlobalConfig);
                        } else {
                            console.log('[Anti-Surveillance Script] Non-Tampermonkey environment, configuration not saved');
                        }
                    reloadConfigPanel();
                }
            });
            
            // Advanced blocking rules configuration
            document.getElementById('add-rule').addEventListener('click', () => {
                const container = document.getElementById('rules-container');
                const ruleId = `rule-${Date.now()}`;
                const ruleHTML = `
                    <div class="rule-item" id="${ruleId}" style="margin: 10px 0; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <label style="flex: 0 0 60px;">
                                <input type="checkbox" class="rule-enabled" checked>
                                Enable
                            </label>
                            <div style="flex: 1;">
                                <label>Event Type:</label>
                                <input type="text" class="rule-event-type" placeholder="e.g.: click, mousemove" style="width: 150px; margin-right: 10px;">
                                <label>Element Selector:</label>
                                <input type="text" class="rule-selector" placeholder="e.g.: .tracking-element" style="width: 200px; margin-right: 10px;">
                                <label>Target Regex:</label>
                                <input type="text" class="rule-target-regex" placeholder="e.g.: tracking-.*" style="width: 150px;">
                            </div>
                            <button class="remove-rule" data-rule-id="${ruleId}">Delete</button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', ruleHTML);
                
                // Add delete rule event
                document.querySelector(`.remove-rule[data-rule-id="${ruleId}"]`).addEventListener('click', function() {
                    const ruleItem = document.getElementById(this.dataset.ruleId);
                    if (ruleItem) {
                        ruleItem.remove();
                    }
                });
            });
            
            document.getElementById('clear-rules').addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all advanced blocking rules?')) {
                    document.getElementById('rules-container').innerHTML = '';
                }
            });
            
            // Logging and statistics configuration
            document.getElementById('view-logs').addEventListener('click', () => {
                const logs = blockLog.getEntries();
                const logStr = logs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString();
                    return `${time} - ${log.action}: ${log.eventType} (${log.target})`;
                }).join('\n');
                
                if (logStr) {
                    alert(`Blocking Logs (Total: ${logs.length} entries):\n\n${logStr}`);
                } else {
                    alert('No blocking logs available');
                }
            });
            
            document.getElementById('clear-logs').addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all blocking logs?')) {
                    blockLog.clear();
                    alert('Logs have been cleared');
                }
            });
            
            document.getElementById('view-stats').addEventListener('click', () => {
                const stats = blockStats.getStats();
                let statsStr = `Blocking Statistics:\n\n`;
                statsStr += `Total Events: ${stats.totalEvents}\n`;
                statsStr += `Blocked Events: ${stats.blockedEvents}\n`;
                statsStr += `Blocking Success Rate: ${stats.successRate}\n\n`;
                statsStr += `Statistics by Event Type:\n`;
                
                for (const eventType in stats.eventTypeStats) {
                    const eventStats = stats.eventTypeStats[eventType];
                    const successRate = eventStats.total > 0 ? 
                        ((eventStats.blocked / eventStats.total) * 100).toFixed(2) : '0.00';
                    statsStr += `${eventType}: ${eventStats.blocked}/${eventStats.total} (${successRate}%)\n`;
                }
                
                alert(statsStr);
            });
            
            document.getElementById('reset-stats').addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all blocking statistics?')) {
                    blockStats.reset();
                    alert('Statistics have been reset');
                }
            });
            
            // Initialize configuration panel
            function initConfigPanel() {
                const currentSiteConfig = getCurrentSiteConfig();
                
                // Initialize advanced blocking rules
                if (currentSiteConfig.advancedBlocking) {
                    document.getElementById('advanced-blocking-enabled').checked = currentSiteConfig.advancedBlocking.enabled;
                }
                
                // Initialize logging configuration
                if (currentSiteConfig.logging) {
                    document.getElementById('logging-enabled').checked = currentSiteConfig.logging.enabled;
                    document.getElementById('log-level').value = currentSiteConfig.logging.level || 'info';
                }
                
                // Initialize statistics configuration
                if (currentSiteConfig.stats) {
                    document.getElementById('stats-enabled').checked = currentSiteConfig.stats.enabled;
                }
            }
            
            // Call initialization function
            initConfigPanel();

        } catch (e) {
            console.error('[Anti-surveillance Script] Failed to create configuration interface:', e);
            // Show a simplified fallback button
            showFallbackButton();
        }
    }

    /**
     * Reload configuration panel
     * When switching website configurations, reload configuration and update UI without refreshing the entire page
     * Save and restore user-selected website configuration
     */
    function reloadConfigPanel() {
        try {
            console.log('[Anti-surveillance Script] Reloading configuration panel');
            
            // Get current configuration panel
            const panel = document.getElementById('anti-monitor-config');
            if (!panel) {
                console.error('[Anti-surveillance Script] Configuration panel does not exist');
                return;
            }
            
            // Save current panel display state
            const wasVisible = panel.classList.contains('visible');
            
            // Save currently selected website configuration key
            const selectedSiteKey = globalConfig.currentSiteKey;
            
            // Before reloading configuration panel, save current website configuration first
            const currentSiteConfig = getCurrentSiteConfig();
            if (selectedSiteKey && currentSiteConfig) {
                globalConfig.sites[selectedSiteKey] = currentSiteConfig;
                console.log(`[Anti-surveillance] Saving website configuration before reload: ${selectedSiteKey}`);
                
                // Save to storage
                if (typeof GM_setValue === 'function') {
                    GM_setValue('antiMonitorGlobalConfig', globalConfig);
                }
            }
            
            // Remove old configuration panel
            panel.remove();
            
            // Create new configuration panel
            createConfigUI();
            
            // Restore panel display state
            const newPanel = document.getElementById('anti-monitor-config');
            if (newPanel && wasVisible) {
                newPanel.classList.add('visible');
            }
            
            // Restore previously selected website configuration
            if (selectedSiteKey) {
                globalConfig.currentSiteKey = selectedSiteKey;
                // Update dropdown selection state
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
            console.error('[Anti-surveillance Script] Failed to reload configuration panel:', e);
        }
    }

    /**
     * Show fallback button (when main configuration interface creation fails)
     */
    function showFallbackButton() {
        try {
            // Check if in main window environment
            if (!isInMainWindow()) {
                console.log('[Anti-surveillance Script] In iframe/object/embed, not creating fallback button');
                return;
            }
            
            console.log('[Anti-surveillance Script] Showing fallback button');
            const fallbackBtn = document.createElement('button');
            fallbackBtn.id = 'anti-monitor-fallback';
            
            // Get current website button configuration
            const siteConfig = getCurrentSiteConfig();
            const btnConfig = siteConfig.buttonConfig || {
                text: 'Anti-surveillance Config',
                backgroundColor: '#ff4444',
                textColor: 'white',
                padding: '10px',
                borderRadius: '4px',
                zIndex: '999999'
            };
            
            fallbackBtn.textContent = btnConfig.text || 'Anti-surveillance Config';
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
                alert('Anti-surveillance script is running, but configuration interface failed to load.\nPlease try refreshing the page or check console error messages.');
            });
            
            document.body.appendChild(fallbackBtn);
        } catch (e) {
            console.error('[Anti-surveillance Script] Failed to create fallback button:', e);
        }
    }

    /**
     * Helper function: HTML escape
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
     * Helper function: HTML unescape
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
     * Helper function: Color name to hexadecimal conversion
     */
    function hexToRgb(color) {
        // If already hexadecimal color, return directly
        if (color.startsWith('#')) return color;
        
        // Simple color name to hexadecimal mapping
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
     * Initialize virtual mouse animation styles
     * Add breathing scale and pulse ripple effects
     */
    function initVirtualMouseAnimations() {
        try {
            const animationCSS = `
                /* Virtual mouse breathing scale animation */
                @keyframes virtualMouseBreathing {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                
                /* Virtual mouse pulse ripple animation */
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
                
                /* Virtual mouse appear animation */
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
                
                /* Virtual mouse disappear animation */
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
                
                /* Breathing animation class */
                .virtual-mouse-breathing {
                    animation: virtualMouseBreathing 2s ease-in-out infinite;
                    will-change: transform;
                }
                
                /* Pulse animation class */
                .virtual-mouse-pulse {
                    animation: virtualMousePulse 2s ease-out infinite;
                    will-change: transform, opacity;
                }
                
                /* Appear animation class */
                .virtual-mouse-appear {
                    animation: virtualMouseAppear 0.3s ease-out forwards;
                }
                
                /* Disappear animation class */
                .virtual-mouse-disappear {
                    animation: virtualMouseDisappear 0.2s ease-in forwards;
                }
                
                /* Low intensity animation */
                .virtual-mouse-low-intensity .virtual-mouse-breathing {
                    animation-duration: 3s;
                }
                
                .virtual-mouse-low-intensity .virtual-mouse-pulse {
                    animation-duration: 3s;
                }
                
                /* High intensity animation */
                .virtual-mouse-high-intensity .virtual-mouse-breathing {
                    animation-duration: 1.5s;
                }
                
                .virtual-mouse-high-intensity .virtual-mouse-pulse {
                    animation-duration: 1.5s;
                }
                
                /* Performance optimization: reduce animation complexity */
                .virtual-mouse-performance-low .virtual-mouse-pulse {
                    display: none;
                }
                
                .virtual-mouse-performance-low .virtual-mouse-breathing {
                    animation-duration: 4s;
                }
                
                /* Responsive animation adjustments */
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
            console.log('[Anti-Surveillance] Virtual mouse animation styles initialized');
        } catch (e) {
            console.error('[Anti-Surveillance] Failed to initialize virtual mouse animation styles:', e);
        }
    }

    /**
     * Add basic styles
     * Add compatibility handling, use native DOM operations in normal environment
     */
    function addStyle(css) {
        if (typeof GM_addStyle === 'function') {
            // Use native API in Tampermonkey environment
            GM_addStyle(css);
        } else {
            // Use DOM operations in normal environment
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            console.log('[Anti-surveillance Script] Adding styles in normal environment');
        }
    }
    
    // Use compatible style addition function
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
     * Clean up all event listeners and timers
     * Called when page unloads or script needs to stop, preventing memory leaks
     */
    function cleanup() {
        try {
            // Stop virtual mouse timer
            if (virtualMouseInterval) {
                clearInterval(virtualMouseInterval);
                virtualMouseInterval = null;
            }

            // Remove virtual mouse element
            if (virtualMouse && virtualMouse.parentNode) {
                virtualMouse.parentNode.removeChild(virtualMouse);
                virtualMouse = null;
            }

            // Remove all added event listeners
            // Ensure event listeners are only removed when functions exist
            if (typeof handleRealMouseEnter === 'function') {
                document.removeEventListener('mouseenter', handleRealMouseEnter);
            }
            if (typeof handleRealMouseLeave === 'function') {
                document.removeEventListener('mouseleave', handleRealMouseLeave);
            }
            
            console.log('[Anti-surveillance Script] All resources have been cleaned up');
        } catch (e) {
            console.error('[Anti-surveillance Script] Error while cleaning up resources:', e);
        }
    }

    /**
     * Check if in main window environment (not in iframe/object/embed)
     */
    function isInMainWindow() {
        try {
            // Check if in main window (not iframe)
            if (window !== window.top) {
                return false;
            }
            
            // Check if in object or embed element
            // By checking frameElement property (if exists and type is 'object' or 'embed', then not in main window)
            if (window.frameElement && 
                (window.frameElement.tagName.toLowerCase() === 'object' || 
                 window.frameElement.tagName.toLowerCase() === 'embed')) {
                return false;
            }
            
            return true;
        } catch (e) {
            // Error accessing window.top or window.frameElement, possibly in restricted environment
            console.error('[Anti-surveillance Script] Environment detection error:', e);
            return false;
        }
    }
    
    /**
     * Get unique identifier for current website
     * Supports regular websites and local files
     * @returns {string} Current website identifier
     */
    function getCurrentSiteKey() {
        try {
            // For local files, use normalized path as configuration key
            if (window.location.protocol === 'file:') {
                return 'file://' + window.location.pathname.replace(/\\/g, '/');
            } else {
                // For regular websites, use hostname
                return window.location.hostname;
            }
        } catch (e) {
            console.error('[Anti-surveillance Script] Failed to get current website identifier:', e);
            return '';
        }
    }

    /**
     * Create Tampermonkey script manager menu
     * Add menu items to control whether anti-surveillance script is enabled for current page
     */
    function createUserScriptMenu() {
        try {
            // Detect if in Tampermonkey environment
            const isInGreaseMonkey = typeof GM_registerMenuCommand === 'function' && typeof GM_setValue === 'function';
            
            if (!isInGreaseMonkey) {
                console.log('[Anti-surveillance Script] Non-Tampermonkey environment, skipping menu creation');
                return;
            }
            
            console.log('[Anti-surveillance Script] Creating Tampermonkey script menu');
            
            // Get current website configuration
            const currentConfig = getCurrentSiteConfig();
            
            // Register menu item: Enable/disable anti-surveillance for current page
            GM_registerMenuCommand(
                `${currentConfig.enabled ? 'Disable' : 'Enable'} Anti-surveillance on Current Page`,
                function() {
                    // Ensure configuration is created for current website (if it doesn't exist)
                    const currentSiteKey = globalConfig.currentSiteKey || getCurrentSiteKey();
                    if (!globalConfig.sites[currentSiteKey]) {
                        globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                        globalConfig.currentSiteKey = currentSiteKey;
                    }
                    
                    // Toggle enabled state for current website
                    const newEnabledState = !globalConfig.sites[currentSiteKey].enabled;
                    globalConfig.sites[currentSiteKey].enabled = newEnabledState;
                    
                    // Show button by default when enabled
                    if (newEnabledState) {
                        globalConfig.sites[currentSiteKey].showButton = true;
                    }
                    
                    // Save configuration
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('antiMonitorGlobalConfig', globalConfig);
                    } else {
                        console.log('[Anti-surveillance Script] Non-Tampermonkey environment, configuration not saved');
                    }
                    
                    // Enable or disable blocking functionality based on state
                    if (newEnabledState) {
                        blockEventListeners();
                        blockDeviceInfoAccess();
                        
                        // Check and create button (if needed)
                        const trigger = document.getElementById('anti-monitor-trigger');
                        if (!trigger) {
                            // If button doesn't exist, create button
                            const newTrigger = document.createElement('button');
                            newTrigger.id = 'anti-monitor-trigger';
                            document.body.appendChild(newTrigger);
                            applyButtonStyles(newTrigger);
                            
                            // Add click event
                            newTrigger.addEventListener('click', () => {
                                const panel = document.getElementById('anti-monitor-config');
                                if (panel) {
                                    panel.classList.toggle('visible');
                                } else {
                                    // If panel doesn't exist, create configuration interface
                                    createConfigUI();
                                }
                            });
                        }
                    } else {
                        // Refresh page to clear blocking effects when disabled
                        location.reload();
                        return;
                    }
                    
                    // Notify user that status has changed
                    const status = newEnabledState ? 'enabled' : 'disabled';
                    alert(`Anti-surveillance on current page ${status}`);
                    
                    console.log(`[Anti-surveillance Script] Anti-surveillance on current page ${status}`);
                }
            );
            
            // Register menu item: Show/hide anti-surveillance button
            // Show this menu item as long as current website has configuration
            const hasSiteConfig = globalConfig.sites[globalConfig.currentSiteKey] !== undefined;
            if (hasSiteConfig) {
                const shouldShowButton = currentConfig.showButton !== undefined ? 
                                        currentConfig.showButton : 
                                        globalConfig.showButtonByDefault;
                
                GM_registerMenuCommand(
                    `${shouldShowButton ? 'Hide' : 'Show'} Anti-surveillance Button`,
                    function() {
                        // Ensure configuration is created for current website (if it doesn't exist)
                        const currentSiteKey = globalConfig.currentSiteKey || getCurrentSiteKey();
                        if (!globalConfig.sites[currentSiteKey]) {
                            globalConfig.sites[currentSiteKey] = JSON.parse(JSON.stringify(defaultSiteConfig));
                            globalConfig.currentSiteKey = currentSiteKey;
                        }
                        
                        // Toggle button display state
                        globalConfig.sites[currentSiteKey].showButton = !shouldShowButton;
                        if (typeof GM_setValue === 'function') {
                            GM_setValue('antiMonitorGlobalConfig', globalConfig);
                        } else {
                            console.log('[Anti-surveillance Script] Non-Tampermonkey environment, configuration not saved');
                        }
                        
                        // Notify user and refresh page to apply changes
                        alert(`Anti-surveillance button ${!shouldShowButton ? 'shown' : 'hidden'}, page will refresh to apply changes`);
                        location.reload();
                        
                        console.log(`[Anti-surveillance Script] Anti-surveillance button ${!shouldShowButton ? 'shown' : 'hidden'}`);
                    }
                );
            }
            
            // Register menu item: Show configuration panel
            GM_registerMenuCommand(
                'Show Anti-surveillance Configuration Panel',
                function() {
                    try {
                        // Check if configuration panel already exists
                        const panel = document.getElementById('anti-monitor-config');
                        const trigger = document.getElementById('anti-monitor-trigger');
                        
                        if (panel && panel.classList.contains('visible')) {
                            // If panel is already shown, hide it
                            panel.classList.remove('visible');
                        } else {
                            // If panel doesn't exist or is hidden, show it
                            if (trigger) {
                                trigger.click();
                            } else {
                                // If trigger button also doesn't exist, recreate configuration interface
                                createConfigUI();
                                // Show panel after creation
                                const newPanel = document.getElementById('anti-monitor-config');
                                if (newPanel) {
                                    newPanel.classList.add('visible');
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Anti-surveillance Script] Failed to show configuration panel:', e);
                        alert('Failed to show configuration panel, please try refreshing the page or check console error messages.');
                    }
                }
            );
            
            // Register menu item: Reset configuration
            GM_registerMenuCommand(
                'Reset Anti-surveillance Configuration',
                function() {
                    try {
                        // Show confirmation dialog to prevent accidental operation
                        const confirmed = confirm('Are you sure you want to reset all anti-surveillance configurations? This operation cannot be undone.');
                        
                        if (confirmed) {
                            // Reset global configuration to default values
                            globalConfig = JSON.parse(JSON.stringify(defaultGlobalConfig));
                            
                            // Save reset configuration
                            if (typeof GM_setValue === 'function') {
                                GM_setValue('antiMonitorGlobalConfig', globalConfig);
                            } else {
                                console.log('[Anti-surveillance Script] Non-Tampermonkey environment, configuration not saved');
                            }
                            
                            // Notify user and refresh page to apply changes
                            alert('Anti-surveillance configuration has been reset, page will refresh to apply changes');
                            location.reload();
                            
                            console.log('[Anti-surveillance Script] Anti-surveillance configuration has been reset');
                        }
                    } catch (e) {
                        console.error('[Anti-surveillance Script] Failed to reset configuration:', e);
                        alert('Failed to reset configuration, please check console error messages.');
                    }
                }
            );
            
        } catch (e) {
            console.error('[Anti-surveillance Script] Failed to create Tampermonkey script menu:', e);
        }
    }

    // Expose virtual mouse related functions to global scope for test page calls
    // Use unsafeWindow instead of window because Tampermonkey scripts run in sandbox environment
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.startVirtualMouse = startVirtualMouse;
        unsafeWindow.stopVirtualMouse = stopVirtualMouse;
        unsafeWindow.getNextVirtualMousePosition = getNextVirtualMousePosition;
        console.log('[Anti-surveillance Script] Virtual mouse functions have been exposed to global scope');
    } else {
        console.warn('[Anti-surveillance Script] unsafeWindow is not available, cannot expose functions to global scope');
    }

    /**
     * Initialization function
     * Entry point of the script, responsible for initializing all functional modules
     */
    function init() {

        try {
            // Re-get current website key each time to avoid using cached values
            globalConfig.currentSiteKey = getCurrentSiteKey();
            console.log('[Anti-surveillance Script] Current website key:', globalConfig.currentSiteKey);
            
            // Create Tampermonkey script menu
            createUserScriptMenu();
            
            // Check if in main window environment
            const isMainWindow = isInMainWindow();
            
            // Check if DOM is ready
            if (document.readyState === 'loading') {
                // DOM not yet loaded, wait for loading to complete before initialization
                console.log('[Anti-surveillance Script] Waiting for DOM to load...');
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('[Anti-surveillance Script] DOM loaded, initializing anti-surveillance features');
                    
                    // Enable core anti-surveillance features in all environments
                if (getCurrentSiteConfig().enabled) {
                    blockEventListeners(); // Enable event interception
                    createUnifiedNavigatorProxy(); // Create unified navigator proxy
                    blockDeviceInfoAccess(); // Enable device information protection (except navigator parts)
                }
                    createVirtualMouse(); // Ensure virtual mouse is created
                    setupRealMouseDetection(); // Setup real mouse detection
                    
                    // Only create UI elements in main window
                    if (isMainWindow) {
                        console.log('[Anti-Surveillance Script] Creating configuration interface in main window');
                        createConfigUI(); // Create configuration interface
                    }
                });
            } else {
                // DOM is ready, initialize directly
                console.log('[Anti-Surveillance Script] DOM is ready, initializing anti-surveillance features');
                
                // Enable core anti-surveillance features in all environments
                if (getCurrentSiteConfig().enabled) {
                    blockEventListeners(); // Enable event interception
                    blockCookieAndStorage(); // Enable cookie and storage interception
                    createUnifiedNavigatorProxy(); // Create unified navigator proxy
                    blockDeviceInfoAccess(); // Enable device information protection (except navigator parts)
                }
                createVirtualMouse(); // Ensure virtual mouse is created
                setupRealMouseDetection(); // Set up real mouse detection
                
                // Check if virtual mouse needs to be started
                const vmConfig = getCurrentSiteConfig().virtualMouse;
                console.log('[Anti-Surveillance] Checking virtual mouse initialization, config:', vmConfig);
                
                if (vmConfig.enabled) {
                    if (!vmConfig.activateOnLeave) {
                        console.log('[Anti-Surveillance] Configured to not depend on mouse leave state, starting virtual mouse directly');
                        startVirtualMouse();
                    } else if (!isRealMousePresent) {
                        debugLog('Real mouse is not on page and configuration allows, starting virtual mouse');
                        startVirtualMouse();
                    } else {
                        debugLog('Virtual mouse is enabled but conditions are not met, waiting for mouse to leave');
                    }
                } else {
                    console.log('[Anti-Surveillance] Virtual mouse is not enabled');
                }
                
                // Create UI elements only in main window
                if (isMainWindow) {
                    console.log('[Anti-Surveillance Script] In main window, creating configuration interface');
                    createConfigUI(); // Create configuration interface
                }
            }
            
            // Add window unload event listener to ensure all resources are cleaned up when page closes
            window.addEventListener('unload', cleanup);
            
            // Check initial state, start virtual mouse if mouse is not on page and configuration allows
            setTimeout(() => {
                const siteConfig = getCurrentSiteConfig();
                const config = siteConfig ? siteConfig.virtualMouse : {};
                console.log('[Anti-Surveillance] Checking virtual mouse initial state, config:', config);
                
                if (config.enabled) {
                    // Reset path mode state variables
                    virtualMouseState.smoothAngle = null;
                    virtualMouseState.patternX = null;
                    virtualMouseState.hoverTime = null;
                    virtualMouseState.hoverTargetX = null;
                    virtualMouseState.hoverTargetY = null;
                    virtualMouseState.randomAngle = null;
                    virtualMouseState.clickAngle = null;
                    virtualMouseState.clickModeShouldClick = false;
                    debugLog('Reset path mode state variables during initialization');
                    
                    // Ensure virtual mouse element is visible
                    if (virtualMouse) {
                        virtualMouse.style.display = 'block';
                        virtualMouse.style.visibility = 'visible';
                        virtualMouse.style.opacity = '1';
                        
                        // Ensure main cursor is visible
                        const mainCursor = virtualMouse.querySelector('.virtual-mouse-main');
                        if (mainCursor) {
                            mainCursor.style.display = 'block';
                            mainCursor.style.visibility = 'visible';
                            mainCursor.style.opacity = '1';
                        }
                        
                        console.log('[Anti-Surveillance] Ensure virtual mouse element is visible');
                    }
                    
                    if (config.activateOnLeave && !isRealMousePresent) {
                        console.log('[Anti-Surveillance] Real mouse is not on page and configuration allows, starting virtual mouse');
                        startVirtualMouse();
                    } else if (!config.activateOnLeave) {
                        console.log('[Anti-Surveillance] Configured to not depend on mouse leave state, starting virtual mouse directly');
                        startVirtualMouse();
                    } else {
                        debugLog('Virtual mouse is enabled but conditions are not met, not starting');
                    }
                } else {
                    console.log('[Anti-Surveillance Script] Virtual mouse is not enabled');
                }
            }, 1000);
        } catch (e) {
                console.error('[Anti-Surveillance Script] Initialization failed:', e);
        }
    }

    // Start initialization
    init();

})();
