/**
 * MCP Manager - 处理MCP服务器的检测、安装和管理
 */
class McpManager {
    constructor(terminalInterface) {
        this.terminalInterface = terminalInterface;
        this.isChecking = false;
        this.mcpPanel = null;
        this.mcpList = null;
        this.mcpSearchInput = null;
        this.checkingIndicator = null;
        this.globalAuthNotice = null; // 全局认证提示，不依赖MCP面板
        
        // 用户自定义MCP实时检测
        this.customMcps = new Set();
        this.customMcpCheckInterval = null;
        
        // localStorage认证状态管理
        this.AUTH_STORAGE_KEY = 'mcp-auth-states';
        this.PERMANENT_CLOSE_KEY = 'mcp-permanent-closed';
        
        // 已知的MCP服务器配置
        this.knownMcps = {
            'context7': {
                title: 'Context7',
                description: '智能上下文管理',
                icon: this.getDefaultIcon()
            },
            'atlassian': {
                title: 'Atlassian', 
                description: '项目管理工具集成',
                icon: this.getAtlassianIcon()
            },
            'notion': {
                title: 'Notion',
                description: '笔记和知识库',
                icon: this.getNotionIcon()
            },
            'playwright': {
                title: 'Playwright',
                description: '端到端测试框架',
                icon: this.getPlaywrightIcon()
            },
            'apple-docs': {
                title: 'Apple Docs',
                description: 'Apple开发文档集成',
                icon: this.getAppleDocsIcon()
            }
        };
        
        this.initializeElements();
        this.startCustomMcpRealTimeDetection();
        
        // 初始化时加载存储的认证状态
        this.initializeStoredAuthStates();
    }
    
    // localStorage认证状态管理方法
    saveAuthStateToStorage(unauthenticatedMcps) {
        try {
            const authStates = this.loadAuthStatesFromStorage();
            unauthenticatedMcps.forEach(mcp => {
                authStates[mcp] = {
                    timestamp: Date.now(),
                    mcp: mcp
                };
            });
            localStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(authStates));
            console.log('💾 保存认证状态到localStorage:', unauthenticatedMcps);
        } catch (error) {
            console.error('💥 保存认证状态失败:', error);
        }
    }
    
    loadAuthStatesFromStorage() {
        try {
            const stored = localStorage.getItem(this.AUTH_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('💥 加载认证状态失败:', error);
            return {};
        }
    }
    
    removeAuthStateFromStorage(resolvedMcps) {
        try {
            const authStates = this.loadAuthStatesFromStorage();
            resolvedMcps.forEach(mcp => {
                delete authStates[mcp];
            });
            localStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(authStates));
            console.log('🗑️ 从localStorage移除已解决的认证状态:', resolvedMcps);
        } catch (error) {
            console.error('💥 移除认证状态失败:', error);
        }
    }
    
    // 初始化时显示存储的认证状态
    initializeStoredAuthStates() {
        const authStates = this.loadAuthStatesFromStorage();
        const storedMcps = Object.keys(authStates);
        
        // 过滤掉已永久关闭的MCP
        const filteredMcps = storedMcps.filter(mcp => !this.isPermanentlyClosed(mcp));
        
        if (filteredMcps.length > 0) {
            console.log('📱 从localStorage加载认证状态:', filteredMcps);
            this.showAuthenticationNotice(filteredMcps);
        }
    }
    
    // 永久关闭管理方法
    markAsPermanentlyClosed(mcpName) {
        try {
            const closedMcps = this.getPermanentlyClosedMcps();
            closedMcps[mcpName] = {
                timestamp: Date.now(),
                mcp: mcpName
            };
            localStorage.setItem(this.PERMANENT_CLOSE_KEY, JSON.stringify(closedMcps));
            console.log('🔒 标记MCP为永久关闭:', mcpName);
        } catch (error) {
            console.error('💥 标记永久关闭失败:', error);
        }
    }
    
    isPermanentlyClosed(mcpName) {
        const closedMcps = this.getPermanentlyClosedMcps();
        return closedMcps.hasOwnProperty(mcpName);
    }
    
    getPermanentlyClosedMcps() {
        try {
            const stored = localStorage.getItem(this.PERMANENT_CLOSE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('💥 获取永久关闭列表失败:', error);
            return {};
        }
    }
    
    initializeElements() {
        this.mcpPanel = document.getElementById('mcp-panel');
        this.mcpList = document.getElementById('mcp-list');
        this.mcpSearchInput = document.getElementById('mcp-search-input');
        
        // 全页面MCP管理视图元素
        this.mcpFullpage = document.getElementById('mcp-fullpage');
        this.mcpListFullpage = document.getElementById('mcp-list-fullpage');
        this.mcpSearchInputFullpage = document.getElementById('mcp-search-input-fullpage');
        
        console.log('🔍 MCP元素初始化:', {
            mcpPanel: this.mcpPanel,
            mcpList: this.mcpList,
            mcpSearchInput: this.mcpSearchInput,
            mcpFullpage: this.mcpFullpage,
            mcpListFullpage: this.mcpListFullpage,
            mcpSearchInputFullpage: this.mcpSearchInputFullpage
        });
        
        if (!this.mcpPanel) {
            console.error('❌ 找不到MCP面板元素 #mcp-panel');
        }
        if (!this.mcpList) {
            console.error('❌ 找不到MCP列表元素 #mcp-list');
        }
        if (!this.mcpSearchInput) {
            console.error('❌ 找不到MCP搜索输入框 #mcp-search-input');
        }
        
        // 初始化搜索功能
        this.initializeSearch();
    }
    
    // 初始化搜索功能
    initializeSearch() {
        // 为面板和全页面视图都初始化搜索功能
        const searchInputs = [this.mcpSearchInput, this.mcpSearchInputFullpage].filter(input => input);
        
        searchInputs.forEach(searchInput => {
            if (!searchInput) return;
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                this.filterMcpItems(searchTerm);
            });
        });
    }
    
    // 过滤MCP项目（只匹配首字母）
    filterMcpItems(searchTerm) {
        const mcpLists = [this.mcpList, this.mcpListFullpage].filter(list => list);
        
        mcpLists.forEach(mcpList => {
            const mcpItems = mcpList.querySelectorAll('.mcp-item');
            
            mcpItems.forEach(item => {
                const title = item.querySelector('.mcp-item-title')?.textContent.toLowerCase() || '';
                
                // 只匹配首字母
                const firstLetter = title.charAt(0);
                const isVisible = !searchTerm || firstLetter === searchTerm;
                
                item.style.display = isVisible ? 'flex' : 'none';
            });
        });
    }
    
    // 全局认证检测（不需要MCP面板）
    async checkGlobalAuthenticationStatus() {
        if (this.isChecking) {
            console.log('🔍 MCP检测已在进行中，跳过重复检测');
            return;
        }
        
        console.log('🔍 开始全局认证状态检测...');
        this.isChecking = true;
        
        try {
            const response = await fetch('/api/mcp-status');
            const result = await response.json();
            
            console.log('🔍 全局认证检测响应:', result);
            
            if (result.success && result.unauthenticatedMcps && result.unauthenticatedMcps.length > 0) {
                console.log('🔒 发现未认证的MCP:', result.unauthenticatedMcps);
                this.saveAuthStateToStorage(result.unauthenticatedMcps);
                this.showAuthenticationNotice(result.unauthenticatedMcps);
            } else {
                this.hideAuthenticationNotice();
                // 清除localStorage中的认证状态
                const authStates = this.loadAuthStatesFromStorage();
                const storedMcps = Object.keys(authStates);
                if (storedMcps.length > 0) {
                    this.removeAuthStateFromStorage(storedMcps);
                }
                console.log('✅ 没有未认证的MCP或检测失败');
            }
            
        } catch (error) {
            console.error('💥 全局认证检测出错:', error);
        } finally {
            this.isChecking = false;
        }
    }
    
    // 启动时检测MCP状态
    async checkMcpStatus() {
        if (this.isChecking) {
            console.log('🔍 MCP检测已在进行中，跳过重复检测');
            return;
        }
        
        console.log('🔍 开始检测已安装的MCP服务器...');
        this.isChecking = true;
        this.showCheckingState();
        
        try {
            const response = await fetch('/api/mcp-status');
            const result = await response.json();
            
            console.log('🔍 MCP检测响应:', result);
            
            if (result.success) {
                console.log('✅ MCP状态检测成功:', result.installedMcps);
                console.log('📋 检测方法:', result.detectionMethod);
                console.log('📋 工作目录:', result.workingDirectory);
                console.log('📋 消息:', result.message);
                console.log('📋 CLI输出:', result.output);
                console.log('📋 CLI错误输出:', result.errorOutput);
                
                this.updateMcpStatuses(result.installedMcps, result.unauthenticatedMcps);
            } else {
                console.warn('⚠️ MCP状态检测失败:', result.error || result.message);
                console.log('📋 失败详情:', result);
                console.log('📋 工作目录:', result.workingDirectory);
                this.setDefaultStatuses();
            }
            
        } catch (error) {
            console.error('💥 MCP状态检测出错:', error);
            this.setDefaultStatuses();
        } finally {
            this.isChecking = false;
            this.hideCheckingState();
        }
    }
    
    // 显示检测状态
    showCheckingState() {
        if (!this.mcpList) return;
        
        // 禁用所有MCP项目的点击（面板和全页面视图）
        const mcpLists = [this.mcpList, this.mcpListFullpage].filter(list => list);
        mcpLists.forEach(mcpList => {
            const mcpItems = mcpList.querySelectorAll('.mcp-item');
            mcpItems.forEach(item => {
                item.style.pointerEvents = 'none';
                item.style.opacity = '0.6';
                const statusElement = item.querySelector('.mcp-item-status');
                if (statusElement) {
                    // 保存原始状态，以便后续恢复
                    const originalStatus = statusElement.getAttribute('data-status');
                    const originalText = statusElement.textContent;
                    statusElement.setAttribute('data-original-status', originalStatus);
                    statusElement.setAttribute('data-original-text', originalText);
                    
                    statusElement.setAttribute('data-status', 'checking');
                    statusElement.textContent = '检测中...';
                }
            });
        });
        
        // 添加检测指示器
        if (!this.checkingIndicator) {
            this.checkingIndicator = document.createElement('div');
            this.checkingIndicator.className = 'mcp-checking-indicator';
            this.checkingIndicator.innerHTML = `
                <div class="checking-spinner"></div>
                <span>正在检测已安装的MCP服务器...</span>
            `;
            this.mcpPanel.appendChild(this.checkingIndicator);
        }
    }
    
    // 隐藏检测状态
    hideCheckingState() {
        if (!this.mcpList) return;
        
        // 恢复所有MCP项目的点击（面板和全页面视图）
        const mcpLists = [this.mcpList, this.mcpListFullpage].filter(list => list);
        mcpLists.forEach(mcpList => {
            const mcpItems = mcpList.querySelectorAll('.mcp-item');
            mcpItems.forEach(item => {
                item.style.pointerEvents = '';
                item.style.opacity = '';
                
                const statusElement = item.querySelector('.mcp-item-status');
                if (statusElement && statusElement.getAttribute('data-status') === 'checking') {
                    // 只恢复那些仍然显示"检测中"的项目
                    const originalStatus = statusElement.getAttribute('data-original-status');
                    const originalText = statusElement.getAttribute('data-original-text');
                    
                    if (originalStatus && originalText) {
                        statusElement.setAttribute('data-status', originalStatus);
                        statusElement.textContent = originalText;
                    }
                    
                    // 清理临时属性
                    statusElement.removeAttribute('data-original-status');
                    statusElement.removeAttribute('data-original-text');
                }
            });
        });
        
        // 移除检测指示器
        if (this.checkingIndicator) {
            this.checkingIndicator.remove();
            this.checkingIndicator = null;
        }
    }
    
    // 更新MCP状态
    updateMcpStatuses(installedMcps, unauthenticatedMcps = []) {
        console.log('🔍 开始更新MCP状态:', installedMcps);
        console.log('🔍 未认证MCP列表:', unauthenticatedMcps);
        console.log('🔍 已知MCP列表:', Object.keys(this.knownMcps));
        
        // 处理认证状态和localStorage
        const authStates = this.loadAuthStatesFromStorage();
        const storedMcps = Object.keys(authStates);
        
        // 显示认证提示（如果有未认证的MCP）
        if (unauthenticatedMcps.length > 0) {
            this.saveAuthStateToStorage(unauthenticatedMcps);
            this.showAuthenticationNotice(unauthenticatedMcps);
        } else {
            this.hideAuthenticationNotice();
        }
        
        // 移除已解决的认证状态
        const resolvedMcps = storedMcps.filter(mcp => !unauthenticatedMcps.includes(mcp));
        if (resolvedMcps.length > 0) {
            this.removeAuthStateFromStorage(resolvedMcps);
        }
        
        // 更新已知MCP的状态
        Object.keys(this.knownMcps).forEach(mcpType => {
            if (installedMcps.includes(mcpType)) {
                console.log(`✅ 设置${mcpType}为已安装`);
                this.updateMcpStatus(mcpType, 'installed', 'installed');
            } else {
                console.log(`⏸️ 设置${mcpType}为待安装`);
                this.updateMcpStatus(mcpType, 'pending', 'install');
            }
        });
        
        // 处理未知的已安装MCP服务器
        console.log('🔍 检查已安装的MCP列表:', installedMcps);
        console.log('🔍 已知MCP对象键:', Object.keys(this.knownMcps));
        
        const unknownMcps = installedMcps.filter(mcp => {
            const isKnown = this.knownMcps.hasOwnProperty(mcp);
            console.log(`🔍 检查MCP "${mcp}": ${isKnown ? '已知' : '未知'}`);
            return !isKnown;
        });
        console.log('🔍 筛选出的未知MCP:', unknownMcps);
        
        if (unknownMcps.length > 0) {
            console.log('🔍 发现未知的已安装MCP服务器:', unknownMcps);
            this.addUnknownMcpServers(unknownMcps);
        } else {
            console.log('ℹ️ 没有发现未知的MCP服务器');
        }
    }
    
    // 设置默认状态
    setDefaultStatuses() {
        Object.keys(this.knownMcps).forEach(mcpType => {
            this.updateMcpStatus(mcpType, 'pending', 'install');
        });
    }
    
    // 更新单个MCP状态
    updateMcpStatus(mcpType, status, message) {
        // 更新面板中的MCP状态
        const mcpItem = document.querySelector(`#mcp-panel [data-mcp="${mcpType}"]`);
        if (mcpItem) {
            const statusElement = mcpItem.querySelector('.mcp-item-status');
            if (statusElement) {
                statusElement.setAttribute('data-status', status);
                statusElement.textContent = message;
            }
        }

        // 更新全页面视图中的MCP状态
        const mcpItemFullpage = document.querySelector(`#mcp-fullpage [data-mcp="${mcpType}"]`);
        if (mcpItemFullpage) {
            const statusElementFullpage = mcpItemFullpage.querySelector('.mcp-item-status');
            if (statusElementFullpage) {
                statusElementFullpage.setAttribute('data-status', status);
                statusElementFullpage.textContent = message;
            }
        }
        
        if (status === 'installed') {
            console.log(`✅ ${mcpType} MCP 已安装`);
        } else if (status === 'failed') {
            console.error(`❌ ${mcpType} MCP 安装失败: ${message}`);
        }
    }
    
    // 添加未知的MCP服务器到界面
    addUnknownMcpServers(unknownMcps) {
        if (!this.mcpList) {
            console.error('❌ MCP列表元素不存在，无法添加MCP服务器');
            return;
        }
        
        console.log('🔍 准备添加未知MCP服务器:', unknownMcps);
        
        unknownMcps.forEach(mcpName => {
            console.log(`🔍 处理MCP服务器: ${mcpName}`);
            // 检查是否已经存在
            const existingItem = document.querySelector(`[data-mcp="${mcpName}"]`);
            if (existingItem) {
                console.log(`➕ 更新已存在的MCP服务器: ${mcpName}`);
                this.updateMcpStatus(mcpName, 'installed', '已安装');
                return;
            }
            
            // 创建新的MCP项目
            const mcpItem = document.createElement('div');
            mcpItem.className = 'mcp-item';
            mcpItem.setAttribute('data-mcp', mcpName);
            
            // 为未知MCP生成更好的显示信息
            const config = this.knownMcps[mcpName] || this.generateConfigForUnknownMcp(mcpName);
            
            mcpItem.innerHTML = `
                <div class="mcp-item-content">
                    <div class="mcp-item-header">
                        <div class="mcp-item-title">${config.title}</div>
                    </div>
                    <div class="mcp-item-description">${config.description}</div>
                </div>
                <div class="mcp-item-status" data-status="installed">uninstall</div>
            `;
            
            // 添加到面板列表中（在custom项目之前）
            const customItem = this.mcpList.querySelector('[data-mcp="custom"]');
            if (customItem) {
                this.mcpList.insertBefore(mcpItem, customItem);
            } else {
                this.mcpList.appendChild(mcpItem);
            }

            // 如果全页面视图存在，也添加一个副本
            if (this.mcpListFullpage) {
                const mcpItemFullpage = mcpItem.cloneNode(true);
                const customItemFullpage = this.mcpListFullpage.querySelector('[data-mcp="custom"]');
                if (customItemFullpage) {
                    this.mcpListFullpage.insertBefore(mcpItemFullpage, customItemFullpage);
                } else {
                    this.mcpListFullpage.appendChild(mcpItemFullpage);
                }

                // 为全页面视图的副本也添加事件监听器
                mcpItemFullpage.addEventListener('click', (e) => {
                    if (e.target.classList.contains('mcp-item-status')) {
                        e.stopPropagation();
                        if (confirm(`确定要卸载 ${config.title} MCP 吗？`)) {
                            console.log(`🗑️ 请求卸载自定义MCP: ${mcpName}`);
                        }
                    }
                });
            }
            
            // 添加点击事件处理器（如果需要的话）
            mcpItem.addEventListener('click', (e) => {
                // 如果点击的是状态按钮，执行卸载操作
                if (e.target.classList.contains('mcp-item-status')) {
                    e.stopPropagation();
                    if (confirm(`确定要卸载 ${config.title} MCP 吗？`)) {
                        console.log(`🗑️ 请求卸载自定义MCP: ${mcpName}`);
                        // 这里可以添加卸载逻辑
                    }
                } else {
                    console.log(`🔍 点击了自定义MCP: ${mcpName}`);
                    // 显示MCP信息或其他操作
                }
            });
            
            console.log(`➕ 已添加未知MCP服务器到界面: ${mcpName} (${config.title})`);
        });
    }
    
    // 为未知MCP生成配置
    generateConfigForUnknownMcp(mcpName) {
        // 根据名称特征生成更好的显示信息
        const nameParts = mcpName.split(/[-_]/);
        const title = nameParts.map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        ).join(' ');
        
        let description = '自定义MCP服务器';
        let icon = this.getDefaultIcon();
        
        // 根据名称特征提供更具体的描述
        if (mcpName.includes('git')) {
            description = 'Git仓库管理工具';
            icon = this.getGitIcon();
        } else if (mcpName.includes('db') || mcpName.includes('database')) {
            description = '数据库管理工具';
            icon = this.getDatabaseIcon();
        } else if (mcpName.includes('api')) {
            description = 'API集成工具';
            icon = this.getApiIcon();
        } else if (mcpName.includes('file') || mcpName.includes('fs')) {
            description = '文件系统工具';
            icon = this.getFileIcon();
        }
        
        return { title, description, icon };
    }
    
    // 图标定义方法
    getDefaultIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
            <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/>
        </svg>`;
    }
    
    getAtlassianIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.5 12L12 2.5L16.5 12H7.5Z"/>
            <path d="M7.5 16L12 6.5L16.5 16H7.5Z"/>
        </svg>`;
    }
    
    getNotionIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16v16H4V4z"/>
            <path d="M8 8h8v2H8V8z"/>
            <path d="M8 12h8v2H8v-2z"/>
            <path d="M8 16h6v2H8v-2z"/>
        </svg>`;
    }
    
    getPlaywrightIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>`;
    }
    
    getAppleDocsIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>`;
    }
    
    getGitIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.62 11.58l-8.97-8.97c-.5-.5-1.32-.5-1.82 0L9.7 3.74l2.28 2.28c.53-.18 1.14-.06 1.56.36.43.43.54 1.07.34 1.61l2.19 2.19c.54-.2 1.18-.09 1.61.34.61.61.61 1.6 0 2.21-.61.61-1.6.61-2.21 0-.45-.45-.56-1.11-.33-1.67L12.9 8.31v5.52c.15.07.29.16.42.29.61.61.61 1.6 0 2.21-.61.61-1.6.61-2.21 0-.61-.61-.61-1.6 0-2.21.15-.15.33-.26.52-.32V8.28c-.19-.06-.37-.17-.52-.32-.46-.46-.56-1.13-.32-1.69L8.5 3.98l-5.73 5.73c-.5.5-.5 1.32 0 1.82l8.97 8.97c.5.5 1.32.5 1.82 0l8.97-8.97c.5-.5.5-1.32 0-1.82z"/>
        </svg>`;
    }
    
    getDatabaseIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4z"/>
            <path d="M12 5c3.31 0 6 1.34 6 3s-2.69 3-6 3-6-1.34-6-3 2.69-3 6-3"/>
            <path d="M4 12c0 1.66 2.69 3 6 3s6-1.34 6-3"/>
        </svg>`;
    }
    
    getApiIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5 2c-.28 0-.5.22-.5.5V4h-2V2.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5V4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-2V2.5c0-.28-.22-.5-.5-.5z"/>
            <path d="M9 9h6v2H9V9z"/>
            <path d="M9 13h6v2H9v-2z"/>
            <path d="M9 17h4v2H9v-2z"/>
        </svg>`;
    }
    
    getFileIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
            <path d="M14 8V2l6 6h-6z"/>
        </svg>`;
    }
    
    // 启动自定义MCP实时检测
    startCustomMcpRealTimeDetection() {
        // 每30秒检测一次MCP状态变化
        this.customMcpCheckInterval = setInterval(() => {
            this.checkForCustomMcpChanges();
        }, 30000);
        
        console.log('🔍 启动自定义MCP实时检测');
    }
    
    // 检测自定义MCP变化
    async checkForCustomMcpChanges() {
        if (this.isChecking) return;
        
        try {
            const response = await fetch('/api/mcp-status');
            const result = await response.json();
            
            if (result.success) {
                // 检测新的未知MCP
                const currentMcps = new Set(result.installedMcps);
                const knownMcpNames = Object.keys(this.knownMcps);
                
                // 找出未知的MCP
                const unknownMcps = result.installedMcps.filter(mcp => 
                    !knownMcpNames.includes(mcp) && !this.customMcps.has(mcp)
                );
                
                // 检测已消失的自定义MCP
                const disappearedMcps = Array.from(this.customMcps).filter(mcp => 
                    !currentMcps.has(mcp)
                );
                
                // 添加新发现的自定义MCP
                if (unknownMcps.length > 0) {
                    console.log('🔍 发现新的自定义MCP:', unknownMcps);
                    unknownMcps.forEach(mcp => this.customMcps.add(mcp));
                    this.addUnknownMcpServers(unknownMcps);
                }
                
                // 移除已消失的自定义MCP
                if (disappearedMcps.length > 0) {
                    console.log('🔍 检测到已移除的自定义MCP:', disappearedMcps);
                    disappearedMcps.forEach(mcp => {
                        this.customMcps.delete(mcp);
                        this.removeCustomMcpFromList(mcp);
                    });
                }
                
                // 更新现有MCP状态
                this.updateMcpStatuses(result.installedMcps, result.unauthenticatedMcps || []);
            }
        } catch (error) {
            console.error('💥 自定义MCP检测出错:', error);
        }
    }
    
    // 从列表中移除自定义MCP
    removeCustomMcpFromList(mcpName) {
        // 从面板中移除
        const mcpItem = document.querySelector(`#mcp-panel [data-mcp="${mcpName}"]`);
        if (mcpItem && !this.knownMcps.hasOwnProperty(mcpName)) {
            mcpItem.remove();
            console.log(`🗑️ 已从面板移除自定义MCP: ${mcpName}`);
        }

        // 从全页面视图中移除
        const mcpItemFullpage = document.querySelector(`#mcp-fullpage [data-mcp="${mcpName}"]`);
        if (mcpItemFullpage && !this.knownMcps.hasOwnProperty(mcpName)) {
            mcpItemFullpage.remove();
            console.log(`🗑️ 已从全页面视图移除自定义MCP: ${mcpName}`);
        }
    }
    
    
    // 停止实时检测
    stopCustomMcpRealTimeDetection() {
        if (this.customMcpCheckInterval) {
            clearInterval(this.customMcpCheckInterval);
            this.customMcpCheckInterval = null;
            console.log('🛑 停止自定义MCP实时检测');
        }
    }
    
    // 显示认证提示
    showAuthenticationNotice(unauthenticatedMcps) {
        // 过滤掉已永久关闭的MCP
        const mcpsToShow = unauthenticatedMcps.filter(mcp => !this.isPermanentlyClosed(mcp));
        
        if (mcpsToShow.length === 0) {
            console.log('🔒 所有MCP都已被永久关闭，不显示认证提示');
            return;
        }
        
        // 在对话模式下显示折叠的auth按钮
        const chatInterface = document.getElementById('chat-interface');
        const mcpFullpage = document.getElementById('mcp-fullpage');
        
        if (chatInterface && chatInterface.style.display !== 'none' && (!mcpFullpage || mcpFullpage.style.display === 'none')) {
            this.showCollapsedAuthButton(mcpsToShow);
            return;
        }
        
        // 在MCP管理页面显示置顶的认证提示或折叠按钮
        if (mcpFullpage && mcpFullpage.style.display === 'block') {
            this.showMcpAuthButton(mcpsToShow);
            return;
        }
        
        // 移除现有的认证提示
        this.hideAuthenticationNotice();
        
        // 获取输入容器，在其上方显示提示
        const inputContainer = document.querySelector('.input-container');
        if (!inputContainer) {
            console.warn('❌ 找不到输入容器，无法显示认证提示');
            return;
        }
        
        // 创建认证提示元素
        const authNotice = document.createElement('div');
        authNotice.className = 'auth-notice';
        authNotice.id = 'auth-notice';
        
        const mcpList = mcpsToShow.join('、');
        
        authNotice.innerHTML = `
            <div class="auth-notice-content">
                <span class="auth-notice-text">${mcpList} Needs authentication</span>
                <div class="auth-notice-buttons">
                    <button class="auth-notice-btn auth-notice-close" data-action="close">永久关闭</button>
                    <button class="auth-notice-btn auth-notice-auth" data-action="authenticate">现在认证</button>
                </div>
            </div>
        `;
        
        // 添加点击事件
        authNotice.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="authenticate"]')) {
                this.handleAuthenticateNow(mcpsToShow);
            } else if (e.target.matches('[data-action="close"]')) {
                this.handlePermanentClose(mcpsToShow);
            }
        });
        
        // 插入到输入容器之前
        inputContainer.parentNode.insertBefore(authNotice, inputContainer);
        
        // 保存为全局认证提示引用
        this.globalAuthNotice = authNotice;
        
        console.log('🔒 显示认证提示:', unauthenticatedMcps);
    }
    
    // 隐藏认证提示
    hideAuthenticationNotice() {
        const existingNotice = document.getElementById('auth-notice');
        if (existingNotice) {
            existingNotice.remove();
            console.log('🔒 隐藏认证提示');
        }
        
        // 清除全局引用
        if (this.globalAuthNotice) {
            this.globalAuthNotice = null;
        }
    }
    
    // 处理现在认证
    handleAuthenticateNow(unauthenticatedMcps) {
        this.showAuthenticationGuide(unauthenticatedMcps, () => {
            // 认证指引关闭后，标记这些MCP为永久关闭
            unauthenticatedMcps.forEach(mcp => {
                this.markAsPermanentlyClosed(mcp);
            });
            this.hideAuthenticationNotice();
        });
    }
    
    // 处理永久关闭
    handlePermanentClose(unauthenticatedMcps) {
        // 直接显示确认弹窗
        this.showConfirmationModal(
            'Permanent Close Confirmation',
            `Are you sure you want to permanently disable authentication notifications for: ${unauthenticatedMcps.join(', ')}?`,
            () => {
                // 确认后标记这些MCP为永久关闭
                unauthenticatedMcps.forEach(mcp => {
                    this.markAsPermanentlyClosed(mcp);
                });
                this.hideAuthenticationNotice();
                console.log('🔒 用户选择永久关闭认证提示:', unauthenticatedMcps);
            },
            () => {
                console.log('🔒 用户取消永久关闭');
            }
        );
    }
    

    // 显示折叠的auth按钮（对话模式）
    showCollapsedAuthButton(unauthenticatedMcps) {
        const authBtn = document.getElementById('auth-btn');
        
        if (authBtn) {
            authBtn.style.display = 'flex';
            
            // 绑定点击事件
            authBtn.onclick = () => {
                this.toggleAuthNoticeInHeader(unauthenticatedMcps, authBtn);
            };
        }
    }

    // 显示MCP页面的auth按钮
    showMcpAuthButton(unauthenticatedMcps) {
        // 在MCP管理页面显示置顶的认证提示框
        this.showMcpAuthNotice(unauthenticatedMcps);
    }

    // 切换认证提示的展开/折叠状态
    toggleAuthNotice(unauthenticatedMcps, button) {
        const existingNotice = document.getElementById('auth-notice');
        
        if (existingNotice) {
            // 如果已经展开，则折叠
            existingNotice.remove();
            button.classList.remove('expanded');
        } else {
            // 如果折叠，则展开
            this.showExpandedAuthNotice(unauthenticatedMcps, button);
            button.classList.add('expanded');
        }
    }

    // 显示展开的认证提示
    showExpandedAuthNotice(unauthenticatedMcps, button) {
        const mcpList = unauthenticatedMcps.join('、');
        
        const authNotice = document.createElement('div');
        authNotice.className = 'auth-notice';
        authNotice.id = 'auth-notice';
        authNotice.style.position = 'fixed';
        authNotice.style.top = '4rem';
        authNotice.style.right = '1rem';
        authNotice.style.width = '300px';
        authNotice.style.zIndex = '101';
        authNotice.style.margin = '0';
        
        authNotice.innerHTML = `
            <div class="auth-notice-content">
                <span class="auth-notice-text">${mcpList} Needs authentication</span>
                <div class="auth-notice-buttons">
                    <button class="auth-notice-btn auth-notice-close" data-action="close">永久关闭</button>
                    <button class="auth-notice-btn auth-notice-auth" data-action="authenticate">现在认证</button>
                </div>
            </div>
        `;
        
        // 添加点击事件
        authNotice.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="authenticate"]')) {
                this.handleAuthenticateNow(unauthenticatedMcps);
                authNotice.remove();
                button.classList.remove('expanded');
            } else if (e.target.matches('[data-action="close"]')) {
                this.handlePermanentClose(unauthenticatedMcps);
                authNotice.remove();
                button.classList.remove('expanded');
            }
        });
        
        document.body.appendChild(authNotice);
    }

    // 在header中切换认证提示
    toggleAuthNoticeInHeader(unauthenticatedMcps, button) {
        const existingNotice = document.querySelector('.auth-notice-expanded');
        
        if (existingNotice) {
            // 如果已经展开，则折叠
            existingNotice.remove();
            button.classList.remove('expanded');
        } else {
            // 如果折叠，则展开
            this.showAuthNoticeInHeader(unauthenticatedMcps, button);
            button.classList.add('expanded');
        }
    }

    // 在header下方显示认证提示
    showAuthNoticeInHeader(unauthenticatedMcps, button) {
        const mcpList = unauthenticatedMcps.join('、');
        const chatHeader = document.querySelector('.chat-header');
        
        if (!chatHeader) return;
        
        const authNotice = document.createElement('div');
        authNotice.className = 'auth-notice auth-notice-expanded';
        
        authNotice.innerHTML = `
            <div class="auth-notice-content">
                <span class="auth-notice-text">${mcpList} Needs authentication</span>
                <div class="auth-notice-buttons">
                    <button class="auth-notice-btn auth-notice-close" data-action="close">永久关闭</button>
                    <button class="auth-notice-btn auth-notice-auth" data-action="authenticate">现在认证</button>
                </div>
            </div>
        `;
        
        // 添加点击事件
        authNotice.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="authenticate"]')) {
                this.handleAuthenticateNow(unauthenticatedMcps);
                authNotice.remove();
                button.classList.remove('expanded');
            } else if (e.target.matches('[data-action="close"]')) {
                this.handlePermanentClose(unauthenticatedMcps);
                authNotice.remove();
                button.classList.remove('expanded');
            }
        });
        
        chatHeader.appendChild(authNotice);
    }

    // 在MCP管理页面显示置顶认证提示
    showMcpAuthNotice(unauthenticatedMcps) {
        const mcpFullpage = document.getElementById('mcp-fullpage');
        const mcpContent = document.querySelector('.mcp-fullpage-content');
        
        if (!mcpFullpage || !mcpContent) return;
        
        // 移除已存在的认证提示
        const existingNotice = mcpFullpage.querySelector('.auth-notice');
        if (existingNotice) existingNotice.remove();
        
        const mcpList = unauthenticatedMcps.join('、');
        
        const authNotice = document.createElement('div');
        authNotice.className = 'auth-notice';
        authNotice.style.margin = '0 2rem 1rem 2rem';
        
        authNotice.innerHTML = `
            <div class="auth-notice-content">
                <span class="auth-notice-text">${mcpList} Needs authentication</span>
                <div class="auth-notice-buttons">
                    <button class="auth-notice-btn auth-notice-close" data-action="close">永久关闭</button>
                    <button class="auth-notice-btn auth-notice-auth" data-action="authenticate">现在认证</button>
                </div>
            </div>
        `;
        
        // 添加点击事件
        authNotice.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="authenticate"]')) {
                this.handleAuthenticateNow(unauthenticatedMcps);
            } else if (e.target.matches('[data-action="close"]')) {
                this.handlePermanentClose(unauthenticatedMcps);
            }
        });
        
        // 插入到内容区域的顶部
        mcpContent.insertBefore(authNotice, mcpContent.firstChild);
    }

    // 隐藏所有认证相关元素
    hideAllAuthElements() {
        // 隐藏header中的按钮
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) authBtn.style.display = 'none';
        
        // 隐藏展开的提示
        const existingNotice = document.querySelector('.auth-notice-expanded');
        if (existingNotice) existingNotice.remove();
        
        // 隐藏MCP页面的认证提示
        const mcpFullpage = document.getElementById('mcp-fullpage');
        if (mcpFullpage) {
            const mcpAuthNotice = mcpFullpage.querySelector('.auth-notice');
            if (mcpAuthNotice) mcpAuthNotice.remove();
        }
        
        // 调用原有的隐藏方法
        this.hideAuthenticationNotice();
    }
    
    // 显示认证指引
    showAuthenticationGuide(unauthenticatedMcps, callback = null) {
        // 获取当前工作目录
        const currentDir = document.getElementById('current-dir-display')?.textContent || 'current directory';
        
        const guide = `
Authentication Guide:

1. Open terminal and use: cd ${currentDir}
2. Type: claude
3. Type: /mcp
4. Use arrow keys to select unauthenticated MCP (${unauthenticatedMcps.join(', ')})
5. Press Enter and follow the authentication guide
        `;
        
        this.showModal(
            'MCP Authentication Guide',
            `<pre class="auth-guide-text">${guide}</pre>`,
            () => {
                if (callback) callback();
            }
        );
        
        console.log('📋 显示认证指引:', unauthenticatedMcps);
    }
    
    // 通用模态框显示方法
    showModal(title, content, onClose = null) {
        // 移除现有模态框
        const existingModal = document.querySelector('.auth-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-backdrop"></div>
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h3>${title}</h3>
                    <button class="auth-modal-close">&times;</button>
                </div>
                <div class="auth-modal-body">
                    ${content}
                </div>
                <div class="auth-modal-footer">
                    <button class="auth-modal-btn auth-modal-btn-close">Close</button>
                </div>
            </div>
        `;
        
        // 添加关闭事件
        const closeModal = () => {
            modal.remove();
            if (onClose) onClose();
        };
        
        modal.querySelector('.auth-modal-close').addEventListener('click', closeModal);
        modal.querySelector('.auth-modal-btn-close').addEventListener('click', closeModal);
        modal.querySelector('.auth-modal-backdrop').addEventListener('click', closeModal);
        
        // 添加到页面
        document.body.appendChild(modal);
    }
    
    // 确认模态框
    showConfirmationModal(title, message, onConfirm, onCancel) {
        // 移除现有模态框
        const existingModal = document.querySelector('.auth-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 创建确认模态框
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-backdrop"></div>
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h3>${title}</h3>
                    <button class="auth-modal-close">&times;</button>
                </div>
                <div class="auth-modal-body">
                    <p>${message}</p>
                </div>
                <div class="auth-modal-footer">
                    <button class="auth-modal-btn auth-modal-btn-cancel">Cancel</button>
                    <button class="auth-modal-btn auth-modal-btn-confirm">Confirm</button>
                </div>
            </div>
        `;
        
        // 添加事件
        const closeModal = () => {
            modal.remove();
            if (onCancel) onCancel();
        };
        
        const confirmAction = () => {
            modal.remove();
            if (onConfirm) onConfirm();
        };
        
        modal.querySelector('.auth-modal-close').addEventListener('click', closeModal);
        modal.querySelector('.auth-modal-btn-cancel').addEventListener('click', closeModal);
        modal.querySelector('.auth-modal-btn-confirm').addEventListener('click', confirmAction);
        modal.querySelector('.auth-modal-backdrop').addEventListener('click', closeModal);
        
        // 添加到页面
        document.body.appendChild(modal);
    }
    
}

// 导出MCP管理器类
window.McpManager = McpManager;