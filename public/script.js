class TerminalInterface {
    constructor() {
        this.ws = null;
        this.currentOutput = null;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.currentMode = 'claude';
        this.sessionActive = false;
        this.sessionId = null;
        
        // Token使用统计
        this.totalTokens = 0;
        this.currentResponse = {
            isProcessing: false,
            requestParts: [],
            inputContent: '',
            outputTokens: 0
        };
        
        // Advanced timing system
        this.thinkingTimer = null;
        this.thinkingStartTime = null;
        this.responseHistory = []; // 存储最近5次响应时间
        this.maxHistorySize = 5;
        this.currentEstimatedTime = 0;
        this.currentRemainingTime = 0;
        
        
        // JSON buffer for incomplete messages
        this.jsonBuffer = '';
        
        // Message processing counter
        this.processedMessageCount = 0;
        
        // MCP管理器
        this.mcpManager = null;
        
        // Add global error handler
        this.initializeGlobalErrorHandling();
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadResponseHistory(); // Load historical data
        this.connect();
        
        // 初始化MCP管理器
        this.initializeMcpManager();
        
        // Initialize with file tree view
        this.initializeDefaultView();
        
        // 获取当前工作目录（仅用于内部管理）
        this.getCurrentWorkingDirectory();
        
        // 清理终端模式相关的localStorage设置
        localStorage.removeItem('interfaceMode');
        
        // 监听页面可见性变化，当页面重新可见时检测MCP状态
        this.setupVisibilityChangeListener();
    }

    initializeGlobalErrorHandling() {
        // Catch unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.displayErrorMessage(
                '页面运行时发生错误，可能影响正常使用。', 
                `错误文件: ${event.filename || '未知'}\n行号: ${event.lineno || '未知'}\n错误信息: ${event.error?.message || event.message}`, 
                'parsing'
            );
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.displayErrorMessage(
                '异步操作失败，请检查网络连接后重试。', 
                `错误原因: ${event.reason?.message || event.reason}`, 
                'network'
            );
            event.preventDefault(); // Prevent the default browser behavior
        });

        // Monitor WebSocket health with improved logic
        setInterval(() => {
            if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
                this.reconnectIfNeeded();
            }
        }, 30000);
    }

    initializeElements() {
        this.chatContainer = document.getElementById('chat-container');
        this.commandInput = document.getElementById('command-input');
        this.sendButton = document.getElementById('send-button');
        this.stopButton = document.getElementById('stop-button');
        this.themeToggle = document.getElementById('theme-toggle');
        // Navigation elements
        this.addBtn = document.getElementById('add-btn');
        this.mcpBtn = document.getElementById('mcp-btn');
        this.chatInterface = document.getElementById('chat-interface');
        
        // MCP panel elements
        this.mcpPanel = document.getElementById('mcp-panel');
        this.mcpList = document.getElementById('mcp-list');
        this.mcpFullpage = document.getElementById('mcp-fullpage');
        this.mcpListFullpage = document.getElementById('mcp-list-fullpage');
        this.backToChatBtn = document.getElementById('back-to-chat-btn');
        
        // Sidebar elements
        this.sidebar = document.getElementById('sidebar');
        this.sidebarContent = document.getElementById('sidebar-content');
        this.sidebarClose = document.getElementById('sidebar-close');
        
        // New input elements
        this.imageUploadButton = document.getElementById('image-upload-button');
        this.deepThinkButton = document.getElementById('deep-think-button');
        this.fileInput = document.getElementById('file-input');
        this.imagePreviewContainer = document.getElementById('image-preview-container');
        this.imagePreviewTag = document.getElementById('image-preview-tag');
        
        // State variables
        this.currentImageFile = null;
        this.isDeepThinking = false;
        
        // Terminal state
        this.terminal = null;
        this.fitAddon = null;

        
        // Claude Thinking相关变量
        this.thinkingMessage = null; // 存储思考状态的消息元素
        
        // Initialize theme - sync with themeManager if available
        if (window.themeManager) {
            this.isDarkMode = window.themeManager.isDarkMode;
        } else {
            this.isDarkMode = localStorage.getItem('theme') === 'dark';
        }
        if (this.isDarkMode) {
            document.body.classList.add('dark');
        }
        
        // Initialize greeting
        this.updateGreeting();
        
        // Working directory elements
        this.changeDirBtn = document.getElementById('change-dir-btn');
        this.currentDirDisplay = document.getElementById('current-dir-display');
        this.changeDirModal = document.getElementById('change-dir-modal');
        this.changeDirClose = document.getElementById('change-dir-close');
        this.changeDirCancel = document.getElementById('change-dir-cancel');
        this.currentDirPath = document.getElementById('current-dir-path');
        this.newDirPath = document.getElementById('new-dir-path');
        this.changeDirConfirm = document.getElementById('change-dir-confirm');
        
        // 初始化时获取当前工作目录
        this.getCurrentWorkingDirectory();
        
        // 监听主题变化事件
        document.addEventListener('themeChange', (e) => {
            this.isDarkMode = e.detail.isDarkMode;
            this.updateTerminalTheme();
        });
        
        // 移除测试代码
    }
    
    initializeMcpManager() {
        // 初始化MCP管理器
        if (window.McpManager) {
            this.mcpManager = new window.McpManager(this);
            
            // 页面加载时立即检测MCP状态
            setTimeout(() => {
                if (this.mcpManager) {
                    console.log('🔍 页面加载完成，开始检测MCP状态');
                    this.mcpManager.checkGlobalAuthenticationStatus();
                    this.mcpManager.checkMcpStatus();
                }
            }, 1000); // 延迟1秒确保所有元素都已加载
        }
    }

    initializeDefaultView() {
        // Initialize without file tree
        console.log('🔍 初始化默认视图完成');
    }

    setupVisibilityChangeListener() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面重新可见时，延迟检测MCP状态
                setTimeout(() => {
                    if (this.mcpManager) {
                        console.log('🔍 页面重新可见，检测MCP状态');
                        this.mcpManager.checkGlobalAuthenticationStatus();
                        this.mcpManager.checkMcpStatus();
                    }
                }, 500);
            }
        });
    }

    ensureMcpDetection() {
        // 确保MCP检测能够执行，即使管理器还未完全初始化
        if (this.mcpManager) {
            console.log('🔍 立即检测MCP状态');
            this.mcpManager.checkMcpStatus();
        } else {
            console.log('🔍 MCP管理器未初始化，等待初始化后检测');
            // 如果管理器还未初始化，等待一段时间后重试
            setTimeout(() => {
                if (this.mcpManager) {
                    console.log('🔍 延迟检测MCP状态');
                    this.mcpManager.checkMcpStatus();
                } else {
                    console.error('❌ MCP管理器初始化失败');
                }
            }, 2000);
        }
    }

    setupEventListeners() {
        // Auto-resize textarea
        this.commandInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Send command on Enter, new line on Shift+Enter
        this.commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendCommand();
            } else if (e.key === 'ArrowUp' && e.altKey) {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        // Send command on button click
        this.sendButton.addEventListener('click', () => {
            this.sendCommand();
        });

        // Stop button functionality
        this.stopButton.addEventListener('click', () => {
            this.stopResponse();
        });

        // Theme toggle
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });


        // Add button - create new conversation
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => {
                this.startNewConversation();
            });
        }

        // MCP button - show MCP fullpage view
        if (this.mcpBtn) {
            this.mcpBtn.addEventListener('click', () => {
                this.showMcpFullpage();
                // 每次点击MCP按钮时重新检测MCP状态
                this.ensureMcpDetection();
            });
        }

        // Back to Chat button
        if (this.backToChatBtn) {
            this.backToChatBtn.addEventListener('click', () => {
                this.hideMcpFullpage();
            });
        }

        // MCP item click handlers for both panel and fullpage
        [this.mcpList, this.mcpListFullpage].forEach(list => {
            if (list) {
                // Left click - install/add MCP
                list.addEventListener('click', (e) => {
                    const mcpItem = e.target.closest('.mcp-item');
                    if (mcpItem && e.button === 0) { // Left click only
                        const mcpType = mcpItem.getAttribute('data-mcp');
                        const status = mcpItem.querySelector('.mcp-item-status')?.getAttribute('data-status');
                        
                        if (mcpType === 'custom') {
                            this.showCustomMcpModal();
                        } else if (status === 'installed') {
                            // If already installed, show delete confirmation
                            this.showMcpDeleteModal(mcpType, mcpItem);
                        } else {
                            this.installMcp(mcpType);
                        }
                    }
                });

                // Right click - show delete option for installed MCPs
                list.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const mcpItem = e.target.closest('.mcp-item');
                    if (mcpItem) {
                        const mcpType = mcpItem.getAttribute('data-mcp');
                        const status = mcpItem.querySelector('.mcp-item-status')?.getAttribute('data-status');
                        
                        if (mcpType !== 'custom' && status === 'installed') {
                            this.showMcpDeleteModal(mcpType, mcpItem);
                        }
                    }
                });
            }
        });

        // Custom MCP button functionality
        const customMcpBtn = document.getElementById('custom-mcp-btn');
        const customMcpModal = document.getElementById('custom-mcp-modal');
        const customMcpClose = document.getElementById('custom-mcp-close');
        const customMcpCancel = document.getElementById('custom-mcp-cancel');
        const customMcpExecute = document.getElementById('custom-mcp-execute');
        const customMcpCommand = document.getElementById('custom-mcp-command');

        if (customMcpBtn) {
            customMcpBtn.addEventListener('click', () => {
                this.showCustomMcpModal();
            });
        }

        if (customMcpClose) {
            customMcpClose.addEventListener('click', () => {
                this.hideCustomMcpModal();
            });
        }

        if (customMcpCancel) {
            customMcpCancel.addEventListener('click', () => {
                this.hideCustomMcpModal();
            });
        }

        if (customMcpExecute) {
            customMcpExecute.addEventListener('click', () => {
                const command = customMcpCommand.value.trim();
                if (command) {
                    this.executeCustomMcpCommand(command);
                }
            });
        }

        if (customMcpCommand) {
            customMcpCommand.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const command = customMcpCommand.value.trim();
                    if (command) {
                        this.executeCustomMcpCommand(command);
                    }
                }
            });
        }
        
        // Working directory change events
        if (this.changeDirBtn) {
            this.changeDirBtn.addEventListener('click', () => {
                this.showChangeDirModal();
            });
        }
        if (this.changeDirClose) {
            this.changeDirClose.addEventListener('click', () => {
                this.hideChangeDirModal();
            });
        }
        if (this.changeDirCancel) {
            this.changeDirCancel.addEventListener('click', () => {
                this.hideChangeDirModal();
            });
        }
        if (this.changeDirConfirm) {
            this.changeDirConfirm.addEventListener('click', () => {
                this.changeWorkingDirectory();
            });
        }

        // Close modal when clicking outside
        if (customMcpModal) {
            customMcpModal.addEventListener('click', (e) => {
                if (e.target === customMcpModal) {
                    this.hideCustomMcpModal();
                }
            });
        }



        // Sidebar close
        if (this.sidebarClose) {
            this.sidebarClose.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Auto-scroll to bottom when new content is added
        const observer = new MutationObserver(() => {
            this.scrollToBottom();
        });
        observer.observe(this.chatContainer, { childList: true, subtree: true });

        // Initialize user settings
        this.initializeUserSettings();
        
        
        // Initialize todo panel event listeners
        this.setupTodoEventListeners();
        
        // Image upload button
        this.imageUploadButton.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });
        
        // Deep think button
        this.deepThinkButton.addEventListener('click', () => {
            this.toggleDeepThinking();
        });
        
        // MCP Panel directory change button
        const mcpChangeDirBtn = document.getElementById('mcp-change-directory-btn');
        if (mcpChangeDirBtn) {
            mcpChangeDirBtn.addEventListener('click', () => {
                this.showChangeDirModal();
            });
        }

        // MCP Delete Modal event listeners
        const mcpDeleteModal = document.getElementById('mcp-delete-modal');
        const mcpDeleteClose = document.getElementById('mcp-delete-close');
        const mcpDeleteCancel = document.getElementById('mcp-delete-cancel');
        const mcpDeleteConfirm = document.getElementById('mcp-delete-confirm');

        if (mcpDeleteClose) {
            mcpDeleteClose.addEventListener('click', () => {
                this.hideMcpDeleteModal();
            });
        }

        if (mcpDeleteCancel) {
            mcpDeleteCancel.addEventListener('click', () => {
                this.hideMcpDeleteModal();
            });
        }

        if (mcpDeleteConfirm) {
            mcpDeleteConfirm.addEventListener('click', () => {
                this.confirmMcpDeletion();
            });
        }

        // Close modal when clicking outside
        if (mcpDeleteModal) {
            mcpDeleteModal.addEventListener('click', (e) => {
                if (e.target === mcpDeleteModal) {
                    this.hideMcpDeleteModal();
                }
            });
        }

    }

    autoResizeTextarea() {
        const textarea = this.commandInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.commandInput.disabled = false;
            this.sendButton.disabled = false;
            
            // Reset reconnection attempts on successful connection
            this.reconnectAttempts = 0;
            
            // Clear any error overlays
            const errorOverlays = document.querySelectorAll('.error-overlay');
            errorOverlays.forEach(overlay => overlay.remove());
        };

        this.ws.onmessage = (event) => {
            console.log('📥 Received WebSocket data, size:', event.data.length, 'bytes');
            try {
                // Try to parse the message
                const message = JSON.parse(event.data);
                console.log('✅ Successfully parsed WebSocket message');
                this.handleMessage(message);
            } catch (error) {
                console.log('❌ Failed to parse WebSocket message:', error.message);
                
                // Log the problematic data for debugging
                console.log('📋 Problematic data that failed JSON parsing:');
                console.log('📋 Data length:', event.data.length);
                console.log('📋 Data preview:', event.data.substring(0, 500));
                console.log('📋 Data ending:', event.data.substring(Math.max(0, event.data.length - 200)));
                
                // Don't try to recover partial JSON as it causes more problems
                console.log('⚠️ Skipping malformed JSON message to prevent partial content display');
            }
        };

        this.ws.onclose = (event) => {
            this.sessionActive = false;
            this.commandInput.disabled = true;
            this.sendButton.disabled = true;
            this.hideAiThinking();
            
            // Show connection status
            if (event.code !== 1000) { // Not a normal closure
                this.displayErrorMessage(
                    '网络连接已断开，系统将自动尝试重连。', 
                    `错误代码: ${event.code}\n错误原因: ${event.reason || '未知'}`, 
                    'network'
                );
            }
            
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            this.hideAiThinking();
            
            this.displayErrorMessage(
                'WebSocket连接发生错误，这可能是网络问题或服务器问题。', 
                `错误信息: ${error.message || '连接错误'}`, 
                'network'
            );
        };
    }

    reconnectIfNeeded() {
        if (!this.reconnectTimer && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        const reconnectDelay = Math.min(3000 * Math.pow(2, this.reconnectAttempts || 0), 30000);
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, reconnectDelay);
    }

    handleMessage(message) {
        this.processedMessageCount++;
        console.log(`📨 ===== WEBSOCKET MESSAGE #${this.processedMessageCount} RECEIVED =====`);
        console.log(JSON.stringify(message, null, 2));
        console.log('📨 ===== END WEBSOCKET MESSAGE =====');
        
        switch (message.type) {
            case 'claude-response':
                // 在控制台记录过滤后的内容
                console.log('🔍 ===== FILTERED RESPONSE (Client Console) =====');
                console.log('Message data received by client (result already filtered by server):');
                console.log(JSON.stringify(message.data, null, 2));
                console.log('🔍 ===== END FILTERED RESPONSE =====');
                
                this.displayFormattedResponse(message.data);
                break;
            case 'claude-output':
                this.appendOutput(message.data);
                break;
            case 'claude-error':
                this.appendError(message.error);
                break;
            case 'claude-complete':
                if (message.sessionId) {
                }
                this.finalizeResponse();
                break;
            case 'session-created':
                this.sessionId = message.sessionId;
                break;
            case 'session-resumed':
                this.sessionId = message.sessionId;
                break;
            case 'status':
                this.handleStatusUpdate(message);
                break;
            default:
        }
    }


    displayFormattedResponse(data) {
        // Don't display anything if type is user or user_content
        if (data.type === 'user' || data.type === 'user_content') {
            console.log('🔍 Skipping display for user message:', data.type);
            return;
        }
        this.parseRawResponse(data);
    }

    parseRawResponse(data) {
        console.log('🔍 PARSING RAW RESPONSE:', data.type);
        
        if (data.type === 'assistant') {
            this.extractAssistantText(data);
        } else if (data.type === 'result') {
            this.extractResultText(data);
        } else if (data.type === 'user' || data.type === 'users' || data.type === 'user_content') {
            this.extractUsersText(data);
        }
    }

    extractAssistantText(data) {
        console.log('🔍 EXTRACTING ASSISTANT TEXT');
        console.log('📋 ===== FULL DATA STRUCTURE =====');
        console.log(JSON.stringify(data, null, 2));
        console.log('📋 ===== END DATA STRUCTURE =====');
        
        let textContent = '';
        let filePaths = [];
        let toolIndicators = [];
        
        // Generate unique message ID
        const messageId = data.message?.id || Date.now().toString();
        
        // Handle nested message structure (new format)
        if (data.message && data.message.content && Array.isArray(data.message.content)) {
            console.log('📋 Processing content array with', data.message.content.length, 'items');
            
            // Check if any item is thinking content or MCP tool - if so, use displayMixedContent
            const hasThinking = data.message.content.some(item => item.type === 'thinking');
            const hasCommands = data.message.content.some(item => item.type === 'tool_use' && item.input && item.input.command);
            const hasMcpTools = data.message.content.some(item => item.type === 'tool_use' && item.name && item.name.toLowerCase().includes('mcp'));
            
            console.log('🔍 Content analysis:', {
                hasThinking,
                hasCommands,
                hasMcpTools,
                items: data.message.content.map(item => ({ 
                    type: item.type, 
                    name: item.name, 
                    hasCommand: !!(item.input && item.input.command),
                    isMcp: !!(item.name && item.name.toLowerCase().includes('mcp'))
                }))
            });
            
            if (hasThinking || hasCommands || hasMcpTools) {
                console.log('🤔 Found thinking content, commands, or MCP tools, using displayMixedContent');
                this.displayMixedContent(data.message.content);
                return;
            }
            
            data.message.content.forEach((item, index) => {
                console.log(`📄 Item ${index}:`, item.type, item.name || 'no-name');
                
                if (item.type === 'text' && item.text) {
                    console.log('✅ Adding text content, length:', item.text.length);
                    textContent += item.text;
                } else if (item.type === 'tool_use' && item.input) {
                    console.log('🔧 Processing tool_use:', item.name);
                    console.log('📋 Tool input keys:', Object.keys(item.input));
                    console.log('📁 Has file_path:', !!item.input.file_path);
                    console.log('📄 Has content:', !!item.input.content);
                    console.log('💻 Has command:', !!item.input.command);
                    console.log('🔧 ===== TOOL USE ITEM STRUCTURE =====');
                    console.log(JSON.stringify(item, null, 2));
                    console.log('🔧 ===== END TOOL USE STRUCTURE =====');
                    
                    
                    // Log file button creation decision
                    const shouldCreateButton = (item.name === 'Write' || item.name === 'Edit' || item.name === 'MultiEdit') && 
                                             (item.input.file_path || item.input.notebook_path);
                    console.log('🎯 Should create file button:', shouldCreateButton);
                    if (shouldCreateButton) {
                        console.log('✅ Will create file button because:', {
                            toolName: item.name,
                            hasFilePath: !!item.input.file_path,
                            hasNotebookPath: !!item.input.notebook_path,
                            filePath: item.input.file_path || item.input.notebook_path
                        });
                    } else {
                        console.log('❌ Will NOT create file button because:', {
                            toolName: item.name,
                            isCorrectTool: ['Write', 'Edit', 'MultiEdit'].includes(item.name),
                            hasFilePath: !!item.input.file_path,
                            hasNotebookPath: !!item.input.notebook_path
                        });
                    }
                    
                    // Handle TodoWrite operations - display as todolist
                    if (item.name === 'TodoWrite' && item.input.todos) {
                        console.log('📝 TodoWrite detected, displaying todos');
                        this.displayTodoItems(item.input.todos);
                        return; // Skip adding to textContent
                    }
                    
                    // Create tool indicators for Read and WebSearch
                    const toolIndicator = this.createToolIndicator(item.name, item.input);
                    if (toolIndicator) {
                        console.log(`🔍 Creating tool indicator for ${item.name}`);
                        toolIndicators.push(toolIndicator);
                    }
                    
                    
                    // Display command content directly on page if present
                    if (item.input.command) {
                        console.log('🔧 Command detected, adding to text content');
                        // Don't add to textContent, will be handled separately as command block
                    }
                    
                    // Create file path buttons for Write and Edit operations
                    if ((item.name === 'Write' || item.name === 'Edit' || item.name === 'MultiEdit') && 
                        (item.input.file_path || item.input.notebook_path)) {
                        const pathKey = item.input.file_path ? 'file_path' : 'notebook_path';
                        const fullPath = item.input[pathKey];
                        const fileName = fullPath.split('/').pop();
                        
                        console.log('✅ MATCH: Creating file path button for operation:', fileName);
                        console.log('📁 Full path:', fullPath);
                        console.log('📄 Content length:', item.input.content ? item.input.content.length : 0);
                        
                        // Check if this file path already exists to prevent duplicates
                        const existingPath = filePaths.find(fp => fp.fullPath === fullPath && fp.toolName === item.name);
                        if (!existingPath) {
                            filePaths.push({
                                fileName: fileName,
                                fullPath: fullPath,
                                command: item.input.command || null,
                                toolName: item.name,
                                content: item.input.content || null,
                                input: item.input
                            });
                        } else {
                            console.log('⚠️ Duplicate file path detected, skipping:', fullPath, item.name);
                        }
                    } else {
                        console.log('❌ NO MATCH for file button:');
                        console.log('   Tool name:', item.name, 'Is Write/Edit/MultiEdit?', ['Write', 'Edit', 'MultiEdit'].includes(item.name));
                        console.log('   Has file_path?', !!item.input.file_path, 'Has notebook_path?', !!item.input.notebook_path);
                        if (item.input.file_path || item.input.notebook_path) {
                            console.log('ℹ️ File path found but not Write/Edit operation, skipping button creation for:', item.name);
                        }
                    }
                }
            });
        }
        // Handle direct content array (old format)
        else if (data.content && Array.isArray(data.content)) {
            console.log('📋 Processing direct content array (old format)');
            
            // Check if any item is thinking content - if so, use displayMixedContent
            const hasThinking = data.content.some(item => item.type === 'thinking');
            if (hasThinking) {
                console.log('🤔 Found thinking content in old format, using displayMixedContent');
                this.displayMixedContent(data.content);
                return;
            }
            
            data.content.forEach((item, index) => {
                console.log(`📄 Old format item ${index}:`, item.type, item.name || 'no-name');
                
                if (item.type === 'text' && item.text) {
                    textContent += item.text;
                } else if (item.type === 'tool_use' && item.input) {
                    // Handle TodoWrite operations - display as todolist
                    if (item.name === 'TodoWrite' && item.input.todos) {
                        console.log('📝 TodoWrite detected (old format), displaying todos');
                        this.displayTodoItems(item.input.todos);
                        return; // Skip adding to textContent
                    }
                    
                    
                    // Display command content directly on page if present
                    if (item.input.command) {
                        console.log('🔧 Command detected (old format), adding to text content');
                        // Don't add to textContent, will be handled separately as command block
                    }
                    
                    // Create file path buttons for Write and Edit operations
                    if ((item.name === 'Write' || item.name === 'Edit' || item.name === 'MultiEdit') && 
                        (item.input.file_path || item.input.notebook_path)) {
                        const pathKey = item.input.file_path ? 'file_path' : 'notebook_path';
                        const fullPath = item.input[pathKey];
                        
                        console.log('📁 Creating file path button for operation (old format):', fullPath.split('/').pop());
                        
                        // Check if this file path already exists to prevent duplicates
                        const existingPath = filePaths.find(fp => fp.fullPath === fullPath && fp.toolName === item.name);
                        if (!existingPath) {
                            filePaths.push({
                                fileName: fullPath.split('/').pop(),
                                fullPath: fullPath,
                                command: item.input.command || null,
                                toolName: item.name,
                                content: item.input.content || null,
                                input: item.input
                            });
                        } else {
                            console.log('⚠️ Duplicate file path detected (old format), skipping:', fullPath, item.name);
                        }
                    } else if (item.input.file_path || item.input.notebook_path) {
                        console.log('ℹ️ File path found but not supported operation (old format), skipping button creation for:', item.name);
                    }
                }
            });
        }
        
        // Display pure text without any background or styling (only if there is text)
        if (textContent.trim()) {
            console.log('✅ Displaying text content, length:', textContent.trim().length);
            this.displayPlainText(textContent.trim(), messageId);
        } else {
            console.log('⚠️ No text content to display');
        }
        
        // Display tool indicators
        toolIndicators.forEach((indicator, index) => {
            console.log(`🔍 Displaying tool indicator ${index}`);
            if (this.currentConversation) {
                this.currentConversation.appendChild(indicator);
            } else {
                this.chatContainer.appendChild(indicator);
            }
        });
        
        // Display command blocks for any commands found
        const commandsToDisplay = [];
        if (Array.isArray(data.content)) {
            data.content.forEach(item => {
                if (item.type === 'tool_use' && item.input && item.input.command) {
                    commandsToDisplay.push({
                        command: item.input.command,
                        toolName: item.name,
                        description: item.input.description || ''
                    });
                }
            });
        }
        commandsToDisplay.forEach(command => {
            const commandBlock = this.createCommandBlock(command);
            if (this.currentConversation) {
                this.currentConversation.appendChild(commandBlock);
            } else {
                this.chatContainer.appendChild(commandBlock);
            }
        });
        
        // Always create file path buttons if there are file operations
        console.log('📁 Creating file path buttons, count:', filePaths.length);
        filePaths.forEach((fileInfo, index) => {
            console.log(`📄 File button ${index}:`, fileInfo.fileName, 'Tool:', fileInfo.toolName);
            this.createFilePathButton(fileInfo.fileName, fileInfo.fullPath, fileInfo.content || textContent, fileInfo.command, fileInfo.toolName, fileInfo.input);
        });
        
        if (filePaths.length === 0 && !textContent.trim()) {
            console.log('⚠️ No content or file buttons to display for this assistant message');
        }
    }

    extractResultText(data) {
        console.log('🔍 EXTRACTING RESULT TEXT');
        console.log('🔍 Result data structure:', JSON.stringify(data, null, 2));
        
        let resultContent = null;
        
        // Try different possible result data structures
        if (data.result) {
            resultContent = data.result;
            console.log('✅ Found result in data.result');
        } else if (data.content) {
            resultContent = data.content;
            console.log('✅ Found result in data.content');
        } else if (data.message) {
            if (data.message.content) {
                resultContent = data.message.content;
                console.log('✅ Found result in data.message.content');
            } else if (typeof data.message === 'string') {
                resultContent = data.message;
                console.log('✅ Found result in data.message (string)');
            }
        } else if (data.text) {
            resultContent = data.text;
            console.log('✅ Found result in data.text');
        }
        
        if (resultContent) {
            // Handle if result content is an array or object
            if (Array.isArray(resultContent)) {
                console.log('📋 Result is array, processing items');
                let textContent = '';
                resultContent.forEach(item => {
                    if (typeof item === 'string') {
                        textContent += item + '\n';
                    } else if (item.type === 'text' && item.text) {
                        textContent += item.text + '\n';
                    } else if (item.content) {
                        textContent += item.content + '\n';
                    }
                });
                if (textContent.trim()) {
                    console.log('📄 Displaying array result text, length:', textContent.length);
                    this.displayPlainText(textContent.trim());
                } else {
                    console.log('⚠️ No text content found in result array');
                }
            } else if (typeof resultContent === 'string') {
                console.log('📄 Displaying string result text, length:', resultContent.length);
                this.displayPlainText(resultContent);
            } else {
                console.log('📄 Result is object, converting to string');
                this.displayPlainText(JSON.stringify(resultContent, null, 2));
            }
        } else {
            console.log('⚠️ No result content found in any expected location');
            console.log('🔍 Available data keys:', Object.keys(data));
        }
    }

    extractUsersText(data) {
        console.log('🔍 EXTRACTING USERS TEXT, type:', data.type);
        
        // Check if this is a tool result message
        if (data.type === 'user' && data.message && data.message.content && Array.isArray(data.message.content)) {
            // Look for tool_result with tool_use_id (or tooluseid)
            for (const item of data.message.content) {
                if (item.type === 'tool_result' || item.type === 'toolresult') {
                    const toolUseId = item.tool_use_id || item.tooluseid;
                    if (toolUseId && item.content) {
                        console.log('🔧 Found tool_result with tool_use_id:', toolUseId);
                        // Process tool result but filter out text content
                        if (Array.isArray(item.content)) {
                            const filteredContent = item.content.filter(subItem => {
                                if (subItem.type === 'text') {
                                    console.log('🔍 Filtering: removing text content from tool_result');
                                    return false; // Don't display text content
                                }
                                return true;
                            });
                            if (filteredContent.length > 0) {
                                this.displayToolResult(toolUseId, filteredContent);
                            } else {
                                console.log('✅ All content filtered out - nothing to display');
                            }
                        } else {
                            // If content is not an array, skip it since it might be text
                            console.log('🔍 Filtering: skipping non-array tool result content');
                        }
                        return; // Always return here to prevent further processing
                    }
                }
            }
        }
        
        let content = '';
        
        // Handle different user content structures
        if (data.content && data.content.content) {
            console.log('📄 Processing content.content');
            // Check if this is users type and content.content has type parameter
            if (data.type === 'users' && data.content.content.hasOwnProperty && data.content.content.hasOwnProperty('type')) {
                console.log('🔍 Filtering: users message with type parameter in content.content, skipping text display');
                return; // Skip displaying text content
            }
            content = data.content.content;
        } else if (data.content && typeof data.content === 'string') {
            console.log('📄 Processing content string');
            content = data.content;
        } else if (data.message && data.message.content) {
            if (Array.isArray(data.message.content)) {
                console.log('📋 Processing message.content array');
                console.log('🔍 Data type:', data.type);
                console.log('🔍 Content items:', data.message.content.map(item => ({ type: item.type, hasContent: !!item.content })));
                
                // For user messages, filter out text content from tool_result items that have type parameter
                if (data.type === 'user' || data.type === 'users') {
                    console.log('🔍 Processing user message for filtering in displayMixedContent path');
                    const filteredContent = data.message.content.map(item => {
                        // Handle both tool_result and toolresult types
                        if ((item.type === 'tool_result' || item.type === 'toolresult') && Array.isArray(item.content)) {
                            console.log('🔧 Processing tool_result in mixed content:', item.type);
                            // Filter out text items from the content array
                            const filteredSubContent = item.content.filter(subItem => {
                                if (subItem.type === 'text') {
                                    console.log('🔍 Filtering: removing text content from tool_result in user message');
                                    return false; // Filter out text items
                                }
                                return true;
                            });
                            
                            console.log('📊 Original content items:', item.content.length, 'Filtered:', filteredSubContent.length);
                            
                            // Return modified tool_result with filtered content
                            return {
                                ...item,
                                content: filteredSubContent
                            };
                        }
                        // Also filter out direct text items at top level
                        if (item.type === 'text') {
                            console.log('🔍 Filtering: removing direct text content from user message');
                            return null; // Mark for removal
                        }
                        return item;
                    }).filter(item => item !== null); // Remove null items
                    
                    console.log('📊 Final filtered content items:', filteredContent.length);
                    this.displayMixedContent(filteredContent);
                    return;
                }
                
                // 处理混合内容（text + thinking）
                this.displayMixedContent(data.message.content);
                return; // 早期返回，避免后续的常规处理
            } else if (typeof data.message.content === 'string') {
                console.log('📄 Processing message.content string');
                content = data.message.content;
            }
        }
        
        if (content && typeof content === 'string') {
            // Different handling based on message type
            if (data.type === 'user_content') {
                // user_content should show all content (contains file content)
                console.log('✅ Processing user_content, displaying all content');
                this.displayPlainText(content);
            } else {
                // user/users types: Only display if content contains "File created successfully"
                console.log('🔍 Checking for "File created successfully" in:', content.substring(0, 100) + '...');
                if (content.includes('File created successfully')) {
                    console.log('✅ Found "File created successfully", displaying content');
                    this.displayPlainText(content);
                } else {
                    console.log('❌ No "File created successfully" found, skipping display');
                }
            }
        } else {
            console.log('⚠️ No valid content found in users data');
        }
    }

    displayToolResult(toolUseId, content) {
        console.log('🔧 Displaying tool result for tool_use_id:', toolUseId);
        console.log('📄 Result content:', content);
        
        // Find the command block with matching data-tool-id
        const commandBlocks = document.querySelectorAll('.command-block-container[data-tool-id]');
        let targetCommandBlock = null;
        
        for (const block of commandBlocks) {
            if (block.getAttribute('data-tool-id') === toolUseId) {
                targetCommandBlock = block;
                break;
            }
        }
        
        if (targetCommandBlock) {
            console.log('✅ Found matching command block');
            
            // Check if result already exists
            const existingResult = targetCommandBlock.querySelector('.tool-result-content');
            if (existingResult) {
                console.log('⚠️ Tool result already exists, updating content');
                existingResult.textContent = content;
                return;
            }
            
            // Create result display element
            const resultDiv = document.createElement('div');
            resultDiv.className = 'tool-result-content';
            resultDiv.textContent = content;
            
            // Append to command block
            targetCommandBlock.appendChild(resultDiv);
            
            console.log('✅ Tool result added to command block');
        } else {
            console.log('❌ Could not find matching command block for tool_use_id:', toolUseId);
        }
    }

    displayPlainText(text, messageId = null) {
        if (!text || text.trim() === '') {
            return;
        }
        
        console.log('📝 DISPLAY PLAIN TEXT - START');
        console.log('📄 Text length:', text.length);
        console.log('📋 Text preview:', text.substring(0, 100) + '...');
        console.log('🔍 Call stack:', new Error().stack.split('\n').slice(1, 4).join('\n'));
        
        // Check if this text should be filtered (looks like tool_result content)
        const shouldFilter = text.includes('SOURCE: https://github') ||
                           text.includes('LANGUAGE:') ||
                           text.includes('TITLE:') ||
                           text.includes('DESCRIPTION:') ||
                           text.includes('CODE:') ||
                           text.includes('Available Libraries') ||
                           text.includes('Each result includes:') ||
                           text.includes('a Router for navigation') ||
                           /^={5,}/.test(text) ||
                           /^-{5,}/.test(text);
        
        if (shouldFilter) {
            console.log('🔍 Text content should be filtered - skipping display');
            return;
        }
        
        // Only check for todo content, not file content
        // File blocks should only be created from actual tool_use with file_path
        if (this.isTodoListContent(text)) {
            console.log('✅ Redirecting to parseTodoContent');  
            this.parseTodoContent(text);
            return;
        }
        
        console.log('📄 Processing as plain text');
        
        // Display text directly without chunking
        this.displayTextChunk(text, messageId);
        console.log('📝 DISPLAY PLAIN TEXT - END');
    }

    displayTextChunk(text, messageId = null) {
        // Always create a new text element for each message
        const textElement = document.createElement('div');
        textElement.style.cssText = `
            margin: 1rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            color: var(--text-primary);
            word-wrap: break-word;
        `;
        
        try {
            // Parse Markdown for better formatting
            textElement.innerHTML = this.parseMarkdown(text);
        } catch (error) {
            // Fallback to plain text
            textElement.textContent = text;
        }
        
        // Add message identifier if provided
        if (messageId) {
            textElement.setAttribute('data-message-id', messageId);
        }
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(textElement);
            console.log('✅ Text element added to current conversation');
        } else {
            this.chatContainer.appendChild(textElement);
            console.log('✅ Text element added to chat container');
        }
        
        // Verify the text element is actually in the DOM
        const textInDOM = document.contains(textElement);
        console.log('🔍 Text element is in DOM:', textInDOM);
        console.log('📄 Text element content preview:', textElement.textContent.substring(0, 50) + '...');
        this.scrollToBottom();
    }

    createFilePathButton(fileName, fullPath, content, command, toolName, input = null) {
        console.log('🔧 CREATING FILE PATH BUTTON');
        console.log('📁 File name:', fileName);
        console.log('🔧 Tool name:', toolName);
        console.log('📄 Content length:', content ? content.length : 0);
        console.log('💻 Command:', command);
        
        // Check if this has old_string to determine if it should be clickable
        const hasOldString = input && input.old_string;
        console.log('✏️ Has old_string (clickable):', !hasOldString);
        
        const fileButton = document.createElement('div');
        fileButton.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 12px 16px;
            background-color: #f5f1e8;
            border: 1px solid #e0d5c7;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Claude', Georgia, serif;
            font-size: 14px;
            font-weight: 500;
            color: #5d4e37;
            transition: all 0.2s ease;
            margin: 8px 0;
        `;
        
        // Create icon and filename container
        const leftContent = document.createElement('div');
        leftContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        // No additional filtering needed since we already control what gets here
        
        // Create icon (pen for edit operations with old_string, + for others)
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 24px;
            height: 24px;
            background-color: #d97757;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
        `;
        
        if (toolName === 'Edit' || toolName === 'MultiEdit' || (input && input.old_string)) {
            // Use pen SVG for Edit, MultiEdit or any operation with old_string
            icon.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
            `;
        } else {
            icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
            </svg>`;
        }
        
        // Create filename
        const filename = document.createElement('span');
        filename.textContent = fileName;
        filename.style.cssText = 'font-weight: 500; color: #5d4e37;';
        
        leftContent.appendChild(icon);
        leftContent.appendChild(filename);
        
        fileButton.appendChild(leftContent);
        
        // Add arrow for clickable buttons (when no old_string)
        if (!hasOldString) {
            const arrow = document.createElement('div');
            arrow.style.cssText = `
                color: #8b7355;
                font-size: 16px;
                font-weight: bold;
            `;
            arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>`;
            fileButton.appendChild(arrow);
        }
        
        // Dark mode support
        if (document.body.classList.contains('dark')) {
            fileButton.style.backgroundColor = '#3c342a';
            fileButton.style.borderColor = '#4a4037';
            fileButton.style.color = '#e8dcc6';
            filename.style.color = '#e8dcc6';
            if (!hasOldString) {
                const arrow = fileButton.querySelector('div:last-child');
                if (arrow && arrow.querySelector('svg')) {
                    arrow.style.color = '#ccc';
                }
            }
        }
        
        // Only add hover effects and click handler if not disabled (no old_string)
        if (!hasOldString) {
            fileButton.addEventListener('mouseenter', () => {
                fileButton.style.transform = 'translateY(-1px)';
                const arrow = fileButton.querySelector('div:last-child');
                if (arrow && arrow.querySelector('svg')) {
                    arrow.style.color = document.body.classList.contains('dark') ? '#fff' : '#5d4e37';
                }
            });
            
            fileButton.addEventListener('mouseleave', () => {
                fileButton.style.transform = 'translateY(0)';
                const arrow = fileButton.querySelector('div:last-child');
                if (arrow && arrow.querySelector('svg')) {
                    arrow.style.color = document.body.classList.contains('dark') ? '#ccc' : '#8b7355';
                }
            });
            
            fileButton.addEventListener('click', () => {
                this.openSidebar(content, command || toolName, fullPath, toolName);
            });
        }
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(fileButton);
            console.log('✅ File button added to current conversation');
            console.log('📍 Current conversation element:', this.currentConversation);
        } else {
            this.chatContainer.appendChild(fileButton);
            console.log('✅ File button added to chat container');
            console.log('📍 Chat container element:', this.chatContainer);
        }
        
        // Verify the button is actually in the DOM
        const buttonInDOM = document.contains(fileButton);
        console.log('🔍 Button is in DOM:', buttonInDOM);
        console.log('🔧 FILE PATH BUTTON CREATED SUCCESSFULLY');
        this.scrollToBottom();
    }



    openSidebar(content, command, filePath, toolName) {
        console.log('📂 OPENING SIDEBAR');
        console.log('📄 Content length:', content ? content.length : 0);
        console.log('🔧 Command:', command);
        console.log('📁 File path:', filePath);
        
        // Hide header controls except theme toggle
        const changeDirBtn = document.getElementById('change-dir-btn');
        const authBtn = document.getElementById('auth-btn');
        const modelSelector = document.querySelector('.model-selector');
        
        if (changeDirBtn) changeDirBtn.style.display = 'none';
        if (authBtn) authBtn.style.display = 'none';
        if (modelSelector) modelSelector.style.display = 'none';
        
        // Show sidebar
        this.sidebar.classList.add('open');
        
        // Clear previous content
        this.sidebarContent.innerHTML = '';
        
        // Display file content if available (with syntax highlighting)
        if (content && content.trim()) {
            console.log('✅ Displaying file content');
            const contentSection = document.createElement('div');
            contentSection.className = 'sidebar-section';
            contentSection.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            `;
            
            // Get file extension for syntax highlighting
            const extension = filePath ? filePath.split('.').pop().toLowerCase() : 'txt';
            
            const contentDisplay = document.createElement('div');
            contentDisplay.style.cssText = `
                flex: 1;
                overflow-y: auto;
                font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
                padding: 1rem;
                background-color: var(--code-bg);
                white-space: pre-wrap;
                word-wrap: break-word;
                border-radius: 8px;
                border: 1px solid var(--border-color);
            `;
            
            // Apply syntax highlighting
            const highlightedContent = this.applySyntaxHighlighting(content, extension);
            contentDisplay.innerHTML = highlightedContent;
            contentSection.appendChild(contentDisplay);
            
            this.sidebarContent.appendChild(contentSection);
        }
        
        // Command is displayed on the main page, not in sidebar
        
        // Adjust main container
        document.querySelector('.main-content').classList.add('sidebar-open');
        console.log('📂 Sidebar opened successfully');
    }

    closeSidebar() {
        // Restore header controls
        const changeDirBtn = document.getElementById('change-dir-btn');
        const authBtn = document.getElementById('auth-btn');
        const modelSelector = document.querySelector('.model-selector');
        
        if (changeDirBtn) changeDirBtn.style.display = '';
        if (modelSelector) modelSelector.style.display = '';
        // Note: authBtn might have its own display logic, so we keep it as is
        
        this.sidebar.classList.remove('open');
        document.querySelector('.main-content').classList.remove('sidebar-open');
        
    }

    applySyntaxHighlighting(content) {
        // Return plain text with Claude font
        return `<div style="font-family: 'Claude', Georgia, serif; line-height: 1.6;">${this.escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
    }

    parseAndDisplayContent(text) {
        console.log('🔍 PARSE AND DISPLAY CONTENT - START');
        console.log('📄 Text length:', text.length);
        console.log('📋 Text preview:', text.substring(0, 200) + '...');
        
        // Skip empty or whitespace-only content
        if (!text || text.trim() === '') {
            console.log('⚠️ Empty content, skipping');
            return;
        }
        
        // Filter out content after "name": "Read"
        if (text.includes('"name": "Read"')) {
            console.log('🔧 Filtering out Read tool content');
            const readIndex = text.indexOf('"name": "Read"');
            const filteredText = text.substring(0, readIndex).trim();
            if (filteredText) {
                this.displayCleanText(filteredText);
            }
            return;
        }
        
        // Check if this is todo content
        if (this.isTodoListContent(text)) {
            console.log('✅ Content identified as todo content, parsing...');
            this.parseTodoContent(text);
            return;
        }
        
        // Display as regular content
        console.log('📄 Displaying as regular clean text');
        this.displayCleanText(text.trim());
        console.log('🔍 PARSE AND DISPLAY CONTENT - END');
    }
    
    // Enhanced file content detection
    looksLikeFileContent(text) {
        console.log('🔍 Checking if content looks like file content...');
        
        // Method 1: Contains numbered lines (strongest indicator)
        const hasNumberedLines = /^\s*\d+→/.test(text);
        if (hasNumberedLines) {
            console.log('✅ Found numbered lines (→ format)');
            return true;
        }
        
        // Method 2: Contains file operation indicators
        const fileIndicators = [
            /Here's the result of running.*?cat -n.*?file/i,
            /result of running.*?cat -n.*?file/i,
            /The file.*?has been.*?(created|updated|modified)/i,
            /Applied \d+ edits? to/i,
            /file_path.*?:/,
            /Writing to file/i,
            /File content:/i,
            /Edit.*?file/i,
            /Write.*?file/i
        ];
        
        for (let i = 0; i < fileIndicators.length; i++) {
            if (fileIndicators[i].test(text)) {
                console.log(`✅ Found file indicator ${i}:`, fileIndicators[i].source);
                return true;
            }
        }
        
        // Method 3: Contains code block patterns
        const codePatterns = [
            /```[\w]*\n[\s\S]*?\n```/,
            /<output>[\s\S]*?<\/output>/,
            /<[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z][^>]*>/,  // HTML tags with content
            /\\\"[^\\]*\\\"/,                             // Escaped quotes (common in JSON strings)
            /<div[^>]*class=\\\"[^\\]*\\\"/,              // Escaped HTML class attributes
            /\\n\s*<[a-zA-Z]/,                           // HTML tags with escaped newlines
        ];
        
        for (let i = 0; i < codePatterns.length; i++) {
            if (codePatterns[i].test(text)) {
                console.log(`✅ Found code pattern ${i}:`, codePatterns[i].source);
                return true;
            }
        }
        
        // Method 4: Contains significant amount of structured code
        const lines = text.split('\n');
        let codeLines = 0;
        let totalLines = lines.length;
        
        for (const line of lines) {
            // Check for typical code patterns
            if (line.match(/^\s*[\{\}\[\];,]|^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[\(\{=:]|^\s*\/\/|^\s*\/\*|^\s*\*|^\s*#|^\s*function|^\s*class|^\s*def |^\s*import |^\s*const |^\s*let |^\s*var /)) {
                codeLines++;
            }
        }
        
        const codeRatio = codeLines / totalLines;
        if (codeRatio > 0.3 && totalLines > 10) {
            console.log(`✅ High code ratio: ${(codeRatio * 100).toFixed(1)}% (${codeLines}/${totalLines})`);
            return true;
        }
        
        console.log('❌ Does not look like file content');
        console.log(`📊 Code ratio: ${(codeRatio * 100).toFixed(1)}% (${codeLines}/${totalLines} lines)`);
        return false;
    }

    // Helper method to detect todo list content more accurately
    isTodoListContent(text) {
        // Method 1: Look for JSON array with exact todo structure
        const strictTodoPattern = /\[\s*\{\s*"id"\s*:\s*"[^"]*"\s*,\s*"content"\s*:\s*"[^"]*"\s*,\s*"status"\s*:\s*"[^"]*"/;
        if (strictTodoPattern.test(text)) {
            return true;
        }
        
        // Method 2: Look for any JSON array containing id/content/status combo
        const looseTodoPattern = /\[\s*\{[\s\S]*?"id"[\s\S]*?"content"[\s\S]*?"status"[\s\S]*?\}/;
        if (looseTodoPattern.test(text) && !text.includes('"type"') && !text.includes('"tool_use"')) {
            return true;
        }
        
        // Method 3: TodoWrite operations
        if (text.includes('TodoWrite') || text.includes('Todos have been modified')) {
            return true;
        }
        
        // Method 4: Todo circles
        if (text.includes('○') || text.includes('●')) {
            return true;
        }
        
        return false;
    }

    displayCleanText(text) {
        // No filtering, display all text
        
        const textWrapper = document.createElement('div');
        textWrapper.className = 'clean-text-content';
        textWrapper.style.cssText = `
            margin: 0.75rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            letter-spacing: 0.02em;
            color: #2f1b14;
            word-wrap: break-word;
        `;
        
        if (document.body.classList.contains('dark')) {
            textWrapper.style.color = '#e5e5e5';
        }
        
        // Parse Markdown and set as HTML
        textWrapper.innerHTML = this.parseMarkdown(text);
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(textWrapper);
        } else {
            this.chatContainer.appendChild(textWrapper);
        }
        
        this.scrollToBottom();
    }

    parseFileContent(text) {
        console.log('🔍 PARSING FILE CONTENT - START');
        console.log('📄 Text length:', text.length);
        console.log('📋 Text preview:', text.substring(0, 300) + '...');
        
        let filename = 'file';
        
        const patterns = [
            /file_path['"]\s*:\s*['"]([^'"]+)['"]/, 
            /<parameter name="file_path">([^<]+)<\/parameter>/,
            /Read[^:]*:\s*([^\s\n]+)/,
            /Reading file:\s*([^\s\n]+)/,
            /cat -n.*?on.*?file[:\s]*([^\s\n]+)/,
            /result of running.*?cat -n.*?file[:\s]*([^\n]*)/,
            /File:\s*([^\s\n]+)/,
            /Path:\s*([^\s\n]+)/,
            /Editing file:\s*([^\s\n]+)/,
            /Writing to:\s*([^\s\n]+)/,
            /notebook_path['"]\s*:\s*['"]([^'"]+)['"]/, 
            /Creating file:\s*([^\s\n]+)/,
            /Modified file:\s*([^\s\n]+)/,
            // Enhanced patterns for better recognition
            /Write.*?:\s*([^\s\n]+)/,
            /Edit.*?:\s*([^\s\n]+)/,
            /MultiEdit.*?:\s*([^\s\n]+)/,
            /Applied.*?edits?.*?to.*?([^\s\n:]+)/,
            /The.*?file.*?([^\s\n]+\.[a-z]{2,4})/i
        ];
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = text.match(pattern);
            if (match && match[1] && match[1].trim()) {
                const cleanPath = match[1].trim();
                filename = cleanPath.includes('/') ? cleanPath.split('/').pop() : cleanPath;
                console.log(`✅ Filename found with pattern ${i}:`, filename);
                break;
            }
        }
        
        if (filename === 'file') {
            console.log('⚠️ No filename found in patterns, trying extension match...');
            const extensionMatch = text.match(/([a-zA-Z0-9_-]+\.[a-zA-Z]{2,6})/);
            if (extensionMatch) {
                filename = extensionMatch[1];
                console.log('📄 Found filename from extension:', filename);
            } else {
                console.log('❌ No extension match found');
            }
        }
        
        let fileContent = '';
        console.log('🔍 SEARCHING FOR FILE CONTENT...');
        
        // Priority method: Lines with number→ format (most accurate)
        const numberedLines = text.split('\n').filter(line => /^\s*\d+→/.test(line));
        console.log('📊 Found numbered lines:', numberedLines.length);
        
        if (numberedLines.length > 0) {
            fileContent = numberedLines.map(line => line.replace(/^\s*\d+→/, '')).join('\n');
            console.log('✅ Extracted content from numbered lines, length:', fileContent.length);
        } else {
            console.log('⚠️ No numbered lines found, trying content patterns...');
            
            // Enhanced content extraction patterns
            const contentPatterns = [
                /Here's the result of running.*?cat -n.*?file[:\s]*\n([\s\S]*?)(?:\n\n|$)/,
                /result of running.*?cat -n.*?file[:\s]*\n([\s\S]*?)(?:\n\n|$)/,
                /<output>\s*([\s\S]*?)\s*<\/output>/,
                /```(?:\w+)?\s*\n([\s\S]*?)\n```/,
                /The file.*?(?:created|updated|modified)[\s\S]*?\n([\s\S]*?)(?:\n\n|$)/,
                /File content:\s*\n([\s\S]*?)(?:\n\n|$)/,
                /Content:\s*\n([\s\S]*?)(?:\n\n|$)/,
                /Writing to file:\s*\n([\s\S]*?)(?:\n\n|$)/,
                /new_string['"]\s*:\s*['"]([^'"]*?)['"]/, 
                /content['"]\s*:\s*['"]([^'"]*?)['"]/ 
            ];
            
            for (let i = 0; i < contentPatterns.length; i++) {
                const pattern = contentPatterns[i];
                const match = text.match(pattern);
                if (match && match[1] && match[1].trim()) {
                    fileContent = match[1].trim();
                    console.log(`✅ Found content with pattern ${i}, length:`, fileContent.length);
                    
                    // Remove common prefixes/suffixes
                    const originalLength = fileContent.length;
                    fileContent = fileContent.replace(/^\s*Applied \d+ edits?[\s\S]*?:/m, '').trim();
                    if (originalLength !== fileContent.length) {
                        console.log('🔧 Cleaned content, new length:', fileContent.length);
                    }
                    
                    if (fileContent) {
                        console.log('📄 Final content preview:', fileContent.substring(0, 100) + '...');
                        break;
                    }
                }
            }
            
            if (!fileContent) {
                console.log('❌ No content found with patterns, will use raw text');
            }
        }
        
        if (fileContent) {
            console.log('🎯 DISPLAYING FILE CONTENT BOX');
            console.log('📁 Filename:', filename);
            console.log('📄 Content length:', fileContent.length);
            // Use unified file button creation logic
            this.createFilePathButton(filename, '', fileContent, null, 'Unknown', null);
        } else {
            console.log('⚠️ No specific file content found, using raw text');
            console.log('📄 Raw text length:', text.length);
            // Use unified file button creation logic  
            this.createFilePathButton(filename, '', text, null, 'Unknown', null);
        }
        
        console.log('🔍 PARSING FILE CONTENT - END');
    }

    parseTodoContent(text) {
        let todos = [];
        
        // Strategy 1: Direct JSON array parsing (most reliable)
        const jsonArrayMatches = text.match(/\[\s*\{[\s\S]*?\}\s*\]/g);
        if (jsonArrayMatches) {
            for (const match of jsonArrayMatches) {
                try {
                    const parsed = JSON.parse(match);
                    // Verify it's a todo array (has id, content, status)
                    if (Array.isArray(parsed) && parsed.length > 0 && 
                        parsed[0].id && parsed[0].content && parsed[0].status) {
                        todos = parsed;
                        break;
                    }
                } catch (e) {
                }
            }
        }
        
        // Strategy 2: Extract from TodoWrite context if direct parsing failed
        if (todos.length === 0) {
            const todolistPattern = /"todolist"\s*:\s*(\[[\s\S]*?\])/;
            const todolistMatch = text.match(todolistPattern);
            if (todolistMatch) {
                try {
                    todos = JSON.parse(todolistMatch[1]);
                } catch (e) {
                }
            }
        }
        
        // Strategy 2: Look for direct JSON objects in the text (legacy format)
        if (todos.length === 0 && text.includes('"id"') && text.includes('"content"') && text.includes('"status"')) {
            
            // Extract all individual JSON objects
            const jsonPattern = /\{\s*"id"\s*:\s*"[^"]*"\s*,\s*"content"\s*:\s*"[^"]*"\s*,\s*"status"\s*:\s*"[^"]*"\s*(?:,\s*"priority"\s*:\s*"[^"]*")?\s*\}/g;
            const matches = text.match(jsonPattern);
            
            if (matches) {
                todos = matches.map(match => {
                    try {
                        const todo = JSON.parse(match);
                        return {
                            id: todo.id,
                            content: todo.content,
                            status: todo.status,
                            priority: todo.priority
                        };
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
            } else {
            }
        }
        
        // Strategy 3: Look for circle format (○ or ●)
        if (todos.length === 0) {
            const todoLines = text.split('\n').filter(line => line.match(/^[○●]\s/));
            
            todos = todoLines.map(line => {
                const isCompleted = line.startsWith('●');
                const content = line.replace(/^[○●]\s/, '');
                return {
                    status: isCompleted ? 'completed' : 'pending',
                    content: content
                };
            });
        }
        
        // Display results
        if (todos.length > 0) {
            this.displayTodoItems(todos);
        } else {
        }
    }


    applySyntaxHighlighting(code, extension) {
        // Escape HTML characters first
        const escapedCode = this.escapeHtml(code);
        
        // Check if we're in dark mode for color adjustments
        const isDark = document.body.classList.contains('dark');
        
        // Basic syntax highlighting for common file types
        let highlighted = escapedCode;
        
        if (extension === 'py' || extension === 'python') {
            // Python syntax highlighting - adjusted for dark/light mode
            const keywordColor = isDark ? '#6cb6ff' : '#0066cc';
            const builtinColor = isDark ? '#d19ad1' : '#9933cc';
            const commentColor = isDark ? '#999' : '#666';
            const stringColor = isDark ? '#7dc383' : '#009900';
            
            highlighted = highlighted
                .replace(/\b(def|class|import|from|if|else|elif|for|while|try|except|finally|with|as|return|yield|break|continue|pass|and|or|not|in|is|True|False|None)\b/g, `<span style="color: ${keywordColor}; font-weight: bold;">$1</span>`)
                .replace(/\b(print|len|str|int|float|bool|list|dict|tuple|set)\b/g, `<span style="color: ${builtinColor};">$1</span>`)
                .replace(/(#.*$)/gm, `<span style="color: ${commentColor}; font-style: italic;">$1</span>`)
                .replace(/(".*?"|'.*?')/g, `<span style="color: ${stringColor};">$1</span>`);
        } else if (extension === 'js' || extension === 'javascript') {
            // JavaScript syntax highlighting
            const keywordColor = isDark ? '#6cb6ff' : '#0066cc';
            const builtinColor = isDark ? '#d19ad1' : '#9933cc';
            const commentColor = isDark ? '#999' : '#666';
            const stringColor = isDark ? '#7dc383' : '#009900';
            
            highlighted = highlighted
                .replace(/\b(function|var|let|const|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|new|this|typeof|instanceof|true|false|null|undefined)\b/g, `<span style="color: ${keywordColor}; font-weight: bold;">$1</span>`)
                .replace(/\b(console|document|window|Math|Array|Object|String|Number|Boolean|Date|RegExp)\b/g, `<span style="color: ${builtinColor};">$1</span>`)
                .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, `<span style="color: ${commentColor}; font-style: italic;">$1</span>`)
                .replace(/(".*?"|'.*?'|`.*?`)/g, `<span style="color: ${stringColor};">$1</span>`);
        } else if (extension === 'html' || extension === 'htm') {
            // HTML syntax highlighting
            const tagColor = isDark ? '#6cb6ff' : '#0066cc';
            const commentColor = isDark ? '#999' : '#666';
            
            highlighted = highlighted
                .replace(/(&lt;\/?\w+[^&gt;]*&gt;)/g, `<span style="color: ${tagColor};">$1</span>`)
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, `<span style="color: ${commentColor}; font-style: italic;">$1</span>`);
        } else if (extension === 'css') {
            // CSS syntax highlighting
            const propertyColor = isDark ? '#d19ad1' : '#9933cc';
            const commentColor = isDark ? '#999' : '#666';
            const bracketColor = isDark ? '#6cb6ff' : '#0066cc';
            
            highlighted = highlighted
                .replace(/([a-zA-Z-]+)(\s*:\s*)/g, `<span style="color: ${propertyColor};">$1</span>$2`)
                .replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color: ${commentColor}; font-style: italic;">$1</span>`)
                .replace(/(\{|\})/g, `<span style="color: ${bracketColor}; font-weight: bold;">$1</span>`);
        }
        
        return highlighted;
    }

    applyJsonSyntaxHighlighting(jsonString) {
        // Enhanced JSON syntax highlighting with better colors and key-value parsing
        const isDark = true; // Always use dark theme for JSON
        
        // Enhanced color scheme (VS Code Dark+ theme)
        const keyColor = '#9cdcfe';           // Light blue for keys
        const stringColor = '#ce9178';        // Orange for string values
        const numberColor = '#b5cea8';        // Light green for numbers
        const booleanColor = '#569cd6';       // Blue for booleans
        const nullColor = '#569cd6';          // Blue for null
        const punctuationColor = '#d4d4d4';   // Light gray for punctuation
        
        // First escape HTML to prevent issues
        let highlighted = this.escapeHtml(jsonString);
        
        // Use a simpler approach with sequential replacement and unique markers
        
        // Step 1: Replace keys with unique markers
        const keyMarker = '___KEY___';
        const keyMatches = [];
        highlighted = highlighted.replace(/&quot;([^&]+)&quot;(\s*):/g, (match, key, spaces) => {
            keyMatches.push({ key, spaces });
            return `${keyMarker}${keyMatches.length - 1}${keyMarker}`;
        });
        
        // Step 2: Replace string values with markers
        const stringMarker = '___STRING___';
        const stringMatches = [];
        highlighted = highlighted.replace(/&quot;([^&]*)&quot;/g, (match, content) => {
            stringMatches.push(content);
            return `${stringMarker}${stringMatches.length - 1}${stringMarker}`;
        });
        
        // Step 3: Replace numbers
        highlighted = highlighted.replace(/(-?\d+\.?\d*([eE][+-]?\d+)?)/g, (match) => {
            return `<span style="color: ${numberColor};">${match}</span>`;
        });
        
        // Step 4: Replace booleans
        highlighted = highlighted.replace(/\b(true|false)\b/g, (match) => {
            return `<span style="color: ${booleanColor};">${match}</span>`;
        });
        
        // Step 5: Replace null
        highlighted = highlighted.replace(/\bnull\b/g, (match) => {
            return `<span style="color: ${nullColor};">${match}</span>`;
        });
        
        // Step 6: Replace punctuation
        highlighted = highlighted.replace(/([{}[\],])/g, (match) => {
            return `<span style="color: ${punctuationColor};">${match}</span>`;
        });
        
        // Step 7: Restore string values
        for (let i = 0; i < stringMatches.length; i++) {
            const marker = `${stringMarker}${i}${stringMarker}`;
            const replacement = `<span style="color: ${stringColor};">&quot;${stringMatches[i]}&quot;</span>`;
            highlighted = highlighted.replace(marker, replacement);
        }
        
        // Step 8: Restore keys with colons
        for (let i = 0; i < keyMatches.length; i++) {
            const marker = `${keyMarker}${i}${keyMarker}`;
            const { key, spaces } = keyMatches[i];
            const replacement = `<span style="color: ${keyColor};">&quot;${key}&quot;</span>${spaces}<span style="color: ${punctuationColor};">:</span>`;
            highlighted = highlighted.replace(marker, replacement);
        }
        
        return highlighted;
    }

    displayTodosJson(todos) {
        
        // Display todos in original JSON format with syntax highlighting
        this.displayRawJSON(todos);
    }

    displayResultInput(data) {
        
        // Extract and display only the input field as text
        if (data.input && typeof data.input === 'string') {
            this.displayCleanText(data.input);
        } else if (data.result && typeof data.result === 'string') {
            // Some result types might have result field instead of input
            this.displayCleanText(data.result);
        }
    }

    displayAssistantContent(data) {
        
        // Check if data has input field
        if (data.input) {
            // Filter out content that contains "path"
            const inputStr = JSON.stringify(data.input).toLowerCase();
            if (inputStr.includes('path')) {
                return;
            }
            
            // Check for content (text format) or edit (highlight format)
            if (data.input.content && typeof data.input.content === 'string') {
                // Display content as text
                this.displayCleanText(data.input.content);
            } else if (data.input.old_string && data.input.new_string) {
                // Display edit with highlight format
                this.displayEditHighlight(data.input);
            } else if (data.input.edit) {
                // Handle other edit formats
                this.displayRawJSON(data.input);
            } else {
                // Display entire input as JSON if structure is unclear
                this.displayRawJSON(data.input);
            }
        } else if (data.message && data.message.content) {
            // Handle assistant message format
            const content = data.message.content;
            if (Array.isArray(content)) {
                content.forEach(item => {
                    if (item.type === 'text' && item.text) {
                        this.displayCleanText(item.text);
                    } else if (item.type === 'tool_use' && item.input) {
                        // Check if this is an Edit operation with old_string and new_string
                        if (item.name === 'Edit' && item.input.old_string && item.input.new_string) {
                            this.displayEditHighlight(item.input);
                        } else {
                            // Check if this is an MCP tool (name contains 'mcp')
                            const isMcpTool = item.name && item.name.toLowerCase().includes('mcp');
                            if (isMcpTool) {
                                console.log('🔧 Creating MCP tool block for:', item.name);
                                this.displayCodeBlock(item);
                            } else {
                                // Filter out other tool_use content that contains "path" (file operations)
                                const toolStr = JSON.stringify(item.input).toLowerCase();
                                if (!toolStr.includes('path')) {
                                    console.log('🔧 Creating non-MCP tool block for:', item.name);
                                    this.displayCodeBlock(item);
                                }
                            }
                        }
                    } else if (item.content) {
                        // Handle nested content arrays
                        if (Array.isArray(item.content)) {
                            item.content.forEach(subItem => {
                                if (subItem.file_path && subItem.content) {
                                    // This looks like file content, display it
                                    this.displayCleanText(subItem.content);
                                } else if (typeof subItem === 'string') {
                                    // Direct string content
                                    this.displayCleanText(subItem);
                                }
                            });
                        } else if (typeof item.content === 'string') {
                            // Direct string content
                            this.displayCleanText(item.content);
                        } else if (item.content.file_path && item.content.content) {
                            // Object with file_path and content
                            this.displayCleanText(item.content.content);
                        }
                    }
                });
            }
        }
    }

    displayCodeBlock(toolItem) {
        
        // Extract filename from file_path or use tool name
        let filename = 'code';
        if (toolItem.input && toolItem.input.file_path) {
            const pathParts = toolItem.input.file_path.split('/');
            filename = pathParts[pathParts.length - 1];
        } else if (toolItem.name) {
            filename = toolItem.name.toLowerCase();
        }
        
        // Get file extension for syntax highlighting
        const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : 'txt';
        
        // Get code content
        let codeText = '';
        if (toolItem.input && toolItem.input.content) {
            codeText = toolItem.input.content;
        } else {
            codeText = JSON.stringify(toolItem.input, null, 2);
        }
        
        // Create full-width code block (MCP tool block)
        const codeButton = document.createElement('div');
        codeButton.className = 'full-width-code-button mcp-tool-block';
        codeButton.style.cssText = `
            width: 100%;
            background-color: #f5f1eb;
            border: none;
            border-radius: 10px;
            padding: 1rem;
            margin: 0.5rem 0;
            font-family: 'Merriweather', serif;
            font-size: 0.9rem;
            color: #2f1b14;
            cursor: default;
            display: block;
            text-align: left;
            font-weight: 500;
        `;
        
        // Apply theme-appropriate styles
        const isDark = document.body.classList.contains('dark');
        if (isDark) {
            codeButton.style.backgroundColor = '#3c342a';
            codeButton.style.color = '#e8dcc6';
        }
        
        // Set block text (just filename, no icons)
        codeButton.textContent = filename;
        codeButton.style.fontWeight = 'bold';
        
        // Add to conversation
        if (this.currentConversation) {
            this.currentConversation.appendChild(codeButton);
        } else {
            this.chatContainer.appendChild(codeButton);
        }
        
        this.scrollToBottom();
    }

    displayEditHighlight(editData) {
        
        // Create container for edit display
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-highlight-container';
        editContainer.style.cssText = `
            margin: 0.5rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            border-radius: 10px;
            overflow: hidden;
        `;
        
        // Display old_string with red highlight
        if (editData.old_string) {
            const oldDiv = document.createElement('div');
            oldDiv.className = 'edit-old-string';
            oldDiv.style.cssText = `
                background-color: #ff6464;
                color: white;
                padding: 1rem;
                margin-bottom: 0.5rem;
                border-radius: 10px;
                white-space: pre-wrap;
                word-wrap: break-word;
                box-shadow: 0 2px 4px rgba(255, 100, 100, 0.3);
            `;
            
            // Add a label
            const oldLabel = document.createElement('div');
            oldLabel.textContent = 'Old:';
            oldLabel.style.cssText = `
                font-weight: bold;
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
                opacity: 0.9;
            `;
            
            const oldContent = document.createElement('div');
            oldContent.textContent = editData.old_string;
            
            oldDiv.appendChild(oldLabel);
            oldDiv.appendChild(oldContent);
            editContainer.appendChild(oldDiv);
        }
        
        // Display new_string with green highlight
        if (editData.new_string) {
            const newDiv = document.createElement('div');
            newDiv.className = 'edit-new-string';
            newDiv.style.cssText = `
                background-color: #64ff64;
                color: white;
                padding: 1rem;
                border-radius: 10px;
                white-space: pre-wrap;
                word-wrap: break-word;
                box-shadow: 0 2px 4px rgba(100, 255, 100, 0.3);
            `;
            
            // Add a label
            const newLabel = document.createElement('div');
            newLabel.textContent = 'New:';
            newLabel.style.cssText = `
                font-weight: bold;
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
                opacity: 0.9;
            `;
            
            const newContent = document.createElement('div');
            newContent.textContent = editData.new_string;
            
            newDiv.appendChild(newLabel);
            newDiv.appendChild(newContent);
            editContainer.appendChild(newDiv);
        }
        
        // Add to conversation
        if (this.currentConversation) {
            this.currentConversation.appendChild(editContainer);
        } else {
            this.chatContainer.appendChild(editContainer);
        }
        
        this.scrollToBottom();
    }

    displayUserWithFilter(data) {
        
        // Check for "File created" in various structures
        let shouldDisplay = false;
        let displayText = '';
        
        // Check in main data structure
        const dataStr = JSON.stringify(data).toLowerCase();
        if (dataStr.includes('file created')) {
            shouldDisplay = true;
            
            // Try to extract the specific "File created" message
            if (data.message && data.message.content && Array.isArray(data.message.content)) {
                for (const item of data.message.content) {
                    if (item.type === 'tool_result' && item.content) {
                        const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
                        if (content.toLowerCase().includes('file created')) {
                            displayText = content;
                            break;
                        }
                    }
                }
            }
            
            // Fallback: extract any "File created" text from the entire structure
            if (!displayText) {
                const matches = dataStr.match(/file created[^"'}]*/gi);
                if (matches && matches.length > 0) {
                    displayText = matches[0];
                }
            }
            
            // Final fallback
            if (!displayText) {
                displayText = 'File created successfully';
            }
        }
        
        if (shouldDisplay) {
            this.displayCleanText(displayText);
        } else {
            // Filter out - don't display anything
        }
    }


    handleToolResults(data) {
        
        try {
            // If it's a single tool_use item
            if (data.type === 'tool_use' && data.input) {
                // Use unified file button creation logic
                if ((data.name === 'Write' || data.name === 'Edit' || data.name === 'MultiEdit') && 
                    (data.input.file_path || data.input.notebook_path)) {
                    const pathKey = data.input.file_path ? 'file_path' : 'notebook_path';
                    const fullPath = data.input[pathKey];
                    const fileName = fullPath.split('/').pop();
                    this.createFilePathButton(fileName, fullPath, data.input.content || '', data.input.command, data.name, data.input);
                }
                return;
            }
            
            // If it has content array, process each item
            if (data.content && Array.isArray(data.content)) {
                data.content.forEach((item, index) => {
                    try {
                        if (item.type === 'tool_use' && item.input) {
                            // Use unified file button creation logic
                            if ((item.name === 'Write' || item.name === 'Edit' || item.name === 'MultiEdit') && 
                                (item.input.file_path || item.input.notebook_path)) {
                                const pathKey = item.input.file_path ? 'file_path' : 'notebook_path';
                                const fullPath = item.input[pathKey];
                                const fileName = fullPath.split('/').pop();
                                this.createFilePathButton(fileName, fullPath, item.input.content || '', item.input.command, item.name, item.input);
                            }
                        } else {
                        }
                    } catch (itemError) {
                        // Continue processing other items
                    }
                });
            } else {
            }
        } catch (error) {
        }
    }

    displayResultContent(result) {
        // Clean up result content to remove XML-like tags and technical formatting
        let cleanResult = result;
        
        // Remove XML tags like <name>, <output>, etc.
        cleanResult = cleanResult.replace(/<name>.*?<\/name>/gs, '');
        cleanResult = cleanResult.replace(/<output>/g, '');
        cleanResult = cleanResult.replace(/<\/output>/g, '');
        
        // Remove system reminders
        cleanResult = cleanResult.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gs, '');
        
        // Clean up extra whitespace
        cleanResult = cleanResult.trim();
        
        if (!cleanResult) {
            return; // Skip empty results
        }
        
        const resultElement = document.createElement('div');
        resultElement.className = 'result-text';
        resultElement.style.cssText = `
            margin: 0.5rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            color: #2f1b14;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        
        if (document.body.classList.contains('dark')) {
            resultElement.style.color = '#e5e5e5';
        }
        
        resultElement.textContent = cleanResult;
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(resultElement);
        } else {
            this.chatContainer.appendChild(resultElement);
        }
        
        this.scrollToBottom();
    }

    displayFileContent(content) {
        // Extract filename from file_path if available
        let filename = 'file';
        if (content.file_path) {
            const pathParts = content.file_path.split('/');
            filename = pathParts[pathParts.length - 1];
        }
        
        const fileWrapper = document.createElement('div');
        fileWrapper.className = 'file-content-wrapper';
        
        const fileElement = document.createElement('div');
        fileElement.className = 'file-content typewriter-container';
        fileElement.style.cssText = `
            background-color: #f8f6f3;
            border: 1px solid #e7e2dd;
            border-radius: 10px;
            padding: 1rem;
            margin: 0.5rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            color: #2f1b14;
            white-space: pre-wrap;
            word-wrap: break-word;
            position: relative;
        `;
        
        // Filename header removed as requested
        
        if (document.body.classList.contains('dark')) {
            fileElement.style.backgroundColor = '#1a1a1a';
            fileElement.style.borderColor = '#404040';
            fileElement.style.color = '#e5e5e5';
        }
        fileWrapper.appendChild(fileElement);
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(fileWrapper);
        } else {
            this.chatContainer.appendChild(fileWrapper);
        }
        
        this.startTypewriterEffect(fileElement, content.content || content);
    }

    displayCodeDiff(filePath, oldString, newString) {
        
        // Extract filename from file path
        let filename = 'file';
        if (filePath) {
            const pathParts = filePath.split('/');
            filename = pathParts[pathParts.length - 1];
        }
        
        // Create diff container
        const diffContainer = document.createElement('div');
        diffContainer.className = 'code-diff-container';
        diffContainer.style.cssText = `
            background-color: #1e1e1e;
            border: 1px solid #3c3c3c;
            border-radius: 10px;
            margin: 0.25rem 0;
            padding: 0;
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        // Always use dark theme for code (like VS Code)
        const isDark = true; // Always dark for code display
        
        // Filename header removed as requested
        
        // Create old code section (VS Code style deletion)
        const oldCodeSection = document.createElement('div');
        oldCodeSection.style.cssText = `
            background-color: #1e1e1e;
            margin: 0;
            position: relative;
        `;
        
        const oldCode = document.createElement('pre');
        oldCode.style.cssText = `
            margin: 0;
            padding: 12px 16px;
            white-space: pre;
            overflow-x: auto;
            color: #cccccc;
            background: transparent;
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            position: relative;
        `;
        
        // Add line numbers and deletion indicators
        const lines = oldString.split('\n');
        let numberedContent = '';
        lines.forEach((line, index) => {
            const lineNum = (index + 1).toString().padStart(3, ' ');
            const escapedLine = this.escapeHtml(line);
            if (line.trim() === '') {
                // Empty line - no background highlight
                numberedContent += `<span style="color: #6e7681; margin-right: 16px; user-select: none;">-${lineNum}</span>${escapedLine}\n`;
            } else {
                // Only highlight the actual text content, not the full line width - highlighter style
                numberedContent += `<span style="color: #6e7681; margin-right: 16px; user-select: none;">-${lineNum}</span><span style="background-color: #ff6464; color: white; display: inline; position: relative; z-index: 1; padding: 1px 2px; border-radius: 2px;">${escapedLine}</span>\n`;
            }
        });
        oldCode.innerHTML = numberedContent;
        
        oldCodeSection.appendChild(oldCode);
        
        // Create new code section (VS Code style addition)
        const newCodeSection = document.createElement('div');
        newCodeSection.style.cssText = `
            background-color: #1e1e1e;
            margin: 0;
            position: relative;
        `;
        
        const newCode = document.createElement('pre');
        newCode.style.cssText = `
            margin: 0;
            padding: 12px 16px;
            white-space: pre;
            overflow-x: auto;
            color: #cccccc;
            background: transparent;
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            position: relative;
        `;
        
        // Add line numbers and addition indicators
        const newLines = newString.split('\n');
        let newNumberedContent = '';
        newLines.forEach((line, index) => {
            const lineNum = (index + 1).toString().padStart(3, ' ');
            const escapedLine = this.escapeHtml(line);
            if (line.trim() === '') {
                // Empty line - no background highlight
                newNumberedContent += `<span style="color: #6e7681; margin-right: 16px; user-select: none;">+${lineNum}</span>${escapedLine}\n`;
            } else {
                // Only highlight the actual text content, not the full line width - highlighter style
                newNumberedContent += `<span style="color: #6e7681; margin-right: 16px; user-select: none;">+${lineNum}</span><span style="background-color: #64ff64; color: white; display: inline; position: relative; z-index: 1; padding: 1px 2px; border-radius: 2px;">${escapedLine}</span>\n`;
            }
        });
        newCode.innerHTML = newNumberedContent;
        
        newCodeSection.appendChild(newCode);
        
        diffContainer.appendChild(oldCodeSection);
        diffContainer.appendChild(newCodeSection);
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(diffContainer);
        } else {
            this.chatContainer.appendChild(diffContainer);
        }
        
        this.scrollToBottom();
    }

    displayWebSearchResult(input) {
        
        // Create a text display with globe icon
        const searchResultDiv = document.createElement('div');
        searchResultDiv.className = 'websearch-result';
        searchResultDiv.style.cssText = `
            margin: 0.75rem 0;
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            letter-spacing: 0.02em;
            color: #2f1b14;
            word-wrap: break-word;
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
        `;
        
        // Dark mode styles
        const isDark = document.body.classList.contains('dark');
        if (isDark) {
            searchResultDiv.style.color = '#e5e5e5';
        }
        
        // Add globe SVG icon
        const globeIcon = document.createElement('span');
        globeIcon.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
        `;
        globeIcon.style.cssText = `
            flex-shrink: 0;
            margin-top: 0.1rem;
            color: ${isDark ? '#e5e5e5' : '#2f1b14'};
        `;
        
        // Add content
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            flex: 1;
        `;
        
        // Display query and URL if available
        let displayText = '';
        if (input.query) {
            displayText += `Search: "${input.query}"`;
        }
        if (input.url) {
            displayText += `\nURL: ${input.url}`;
        }
        if (input.prompt) {
            displayText += `\nPrompt: ${input.prompt}`;
        }
        
        // If no specific content, show generic message
        if (!displayText) {
            displayText = 'Web search performed';
        }
        
        contentDiv.textContent = displayText;
        
        searchResultDiv.appendChild(globeIcon);
        searchResultDiv.appendChild(contentDiv);
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(searchResultDiv);
        } else {
            this.chatContainer.appendChild(searchResultDiv);
        }
        
        this.scrollToBottom();
    }

    displayTodoItems(todos) {
        // Display todos with proper status formatting
        if (!Array.isArray(todos) || todos.length === 0) {
            this.hideTodoPanel();
            return;
        }
        
        // Check if all todos are completed
        const allCompleted = todos.every(todo => todo.status === 'completed');
        if (allCompleted) {
            this.hideTodoPanel();
            return;
        }
        
        this.updateTodoPanel(todos);
    }

    updateTodoPanel(todos) {
        const todoPanel = document.getElementById('todo-panel');
        const todoList = document.getElementById('todo-list');
        const todoCount = document.getElementById('todo-count');
        
        if (!todoPanel || !todoList) return;
        
        // Show the todo panel
        todoPanel.style.display = 'block';
        
        // Clear existing todos
        todoList.innerHTML = '';
        
        // Update count
        todoCount.textContent = todos.length;
        
        // Add all todos to the list
        todos.forEach(todo => {
            const todoItem = document.createElement('div');
            todoItem.className = `todo-item ${todo.status}`;
            
            const circle = todo.status === 'completed' ? '●' : (todo.status === 'in_progress' ? '◐' : '○');
            const textStyle = todo.status === 'in_progress' ? 'font-weight: 600;' : '';
            
            todoItem.innerHTML = `
                <span class="todo-circle">${circle}</span>
                <span class="todo-text" style="${textStyle}">${todo.content}</span>
            `;
            todoList.appendChild(todoItem);
        });
        
        // Smooth animation
        requestAnimationFrame(() => {
            todoPanel.classList.add('visible');
        });
    }

    hideTodoPanel() {
        const todoPanel = document.getElementById('todo-panel');
        if (todoPanel) {
            todoPanel.style.display = 'none';
        }
    }

    setupTodoEventListeners() {
        // Todo panel event listeners if needed in the future
    }



    formatJsonStructure(data) {
        // Check if this is a Claude response with specific structure
        if (typeof data === 'object' && data !== null) {
            // Handle common Claude response patterns
            if (data.type && data.result !== undefined) {
                return this.formatClaudeResult(data);
            }
            if (data.type === 'assistant' && data.message) {
                return this.formatAssistantMessage(data);
            }
        }
        
        // Default: format as regular JSON
        return JSON.stringify(data, null, 2);
    }
    
    formatClaudeResult(data) {
        // Format like your example with key-value pairs
        let output = '';
        const indent = '  ';
        
        // Add opening brace
        output += '{\n';
        
        // Process each key-value pair
        const keys = Object.keys(data);
        keys.forEach((key, index) => {
            const value = data[key];
            const isLast = index === keys.length - 1;
            
            output += indent + `${key}: `;
            
            if (typeof value === 'string') {
                output += `'${value}'`;
            } else if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    output += JSON.stringify(value, null, 2).replace(/\n/g, '\n' + indent);
                } else {
                    // Format nested objects with proper indentation
                    const nestedJson = JSON.stringify(value, null, 2);
                    output += nestedJson.replace(/\n/g, '\n' + indent);
                }
            } else {
                output += value;
            }
            
            if (!isLast) output += ',';
            output += '\n';
        });
        
        output += '}';
        return output;
    }
    
    formatAssistantMessage(data) {
        // Handle assistant messages with better formatting
        return JSON.stringify(data, null, 2);
    }

    displayRawJSON(data) {
        
        // Use simple JSON formatting
        const jsonString = JSON.stringify(data, null, 2);
        
        // Create a simple pre element for JSON display
        const jsonElement = document.createElement('pre');
        jsonElement.className = 'json-content';
        
        // Use simple styling with proper fonts
        const isDark = document.body.classList.contains('dark');
        jsonElement.style.cssText = `
            background-color: ${isDark ? '#1a1a1a' : '#ffffff'};
            border: 1px solid ${isDark ? '#333333' : '#dddddd'};
            border-radius: 4px;
            padding: 12px;
            margin: 2px 0;
            font-family: 'Consolas', 'Monaco', 'Menlo', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            color: ${isDark ? '#ffffff' : '#000000'};
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-x: auto;
        `;
        
        // Display plain JSON text
        jsonElement.textContent = jsonString;
        
        // Add directly to current conversation
        if (this.currentConversation) {
            this.currentConversation.appendChild(jsonElement);
        } else {
            this.chatContainer.appendChild(jsonElement);
        }
        
        this.scrollToBottom();
    }

    finalizeResponse() {
        // Record actual response time for learning
        if (this.thinkingStartTime) {
            const actualTime = (Date.now() - this.thinkingStartTime) / 1000;
            this.recordResponseTime(actualTime);
        }
        
        // 将thinking内容转换为折叠状态
        const messagesWithThinking = document.querySelectorAll('[data-has-thinking="true"]');
        messagesWithThinking.forEach(messageElement => {
            setTimeout(() => {
                this.collapseThinkingContent(messageElement);
                messageElement.removeAttribute('data-has-thinking');
            }, 500); // 延迟500ms让用户看到完整内容
        });
        
        this.hideAiThinking();
        this.scrollToBottom();
    }

    handleStatusUpdate(message) {
        this.currentMode = message.mode;
        this.sessionActive = message.sessionActive !== false;
        
        if (message.sessionId) {
            this.sessionId = message.sessionId;
        }
        
        this.updateInputPlaceholder();
        
        if (message.mode === 'claude' && this.sessionActive) {
        }
    }

    // Legacy method - now unused, kept for reference
    handleClaudeResponse(data) {
        // This method is now bypassed in favor of displaying raw JSON
    }

    // Legacy methods - now unused
    appendToResponseArea(text) {
    }

    handleCompleteResult(data) {
    }

    isRequestRelevantData(data) {
        return data.type === 'message_start' || 
               data.type === 'content_block_start' ||
               data.type === 'content_block_delta' ||
               data.type === 'tool_use' ||
               data.usage ||
               data.request;
    }

    // Legacy method - now unused
    handleResponseComplete() {
    }

    updateTotalTokens(tokens) {
        this.totalTokens += tokens;
    }

    appendError(error) {
        this.createAssistantMessage(`Error: ${error}`, true);
        this.hideAiThinking();
        this.scrollToBottom();
    }

    updateInputPlaceholder() {
        if (!this.commandInput) return;
        
        const language = localStorage.getItem('userLanguage') || 'English';
        const isConnected = this.sessionActive;
        
        // Get language-specific placeholder text
        let placeholder;
        if (language === 'Chinese' || language === 'Chinese(simplified)') {
            placeholder = isConnected ? '请输入您的问题...' : '连接中...';
        } else if (language === 'Chinese(traditional)') {
            placeholder = isConnected ? '請輸入您的問題...' : '連接中...';
        } else {
            placeholder = isConnected ? 'How can I help you today?' : 'Connecting...';
        }
        
        this.commandInput.placeholder = placeholder;
        this.commandInput.disabled = !this.sessionActive;
    }

    toggleTheme() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
            this.isDarkMode = window.themeManager.isDarkMode;
            // 更新终端主题
            this.updateTerminalTheme();
        }
    }
    
    handleThemeToggle() {
        this.toggleTheme();
    }
    
    
    
    
    
    
    
    updateExistingElementsTheme() {
        // Update all file buttons
        const fileButtons = document.querySelectorAll('.file-button');
        fileButtons.forEach(button => {
            if (this.isDarkMode) {
                button.style.backgroundColor = '#1a1a1a';
                button.style.borderColor = '#404040';
                button.style.color = '#aaa';
            } else {
                button.style.backgroundColor = '#f8f6f3';
                button.style.borderColor = '#e7e2dd';
                button.style.color = '#666';
            }
        });
        
        // Update diff containers - always keep dark theme for code
        const diffContainers = document.querySelectorAll('.code-diff-container');
        diffContainers.forEach(container => {
            // Always use dark theme for code display (VS Code style)
            container.style.backgroundColor = '#1e1e1e';
            container.style.borderColor = '#3c3c3c';
        });
        
        // Update todo list containers
        const todoContainers = document.querySelectorAll('.todo-list-container');
        todoContainers.forEach(container => {
            if (this.isDarkMode) {
                container.style.backgroundColor = '#1a1a1a';
                container.style.borderColor = '#404040';
                
                // Update title colors
                const titleHeader = container.querySelector('.todo-title-header');
                if (titleHeader) {
                    titleHeader.style.color = '#aaa';
                }
                
                // Update todo item text colors
                const todoItems = container.querySelectorAll('.todo-item-inline span');
                todoItems.forEach(span => {
                    span.style.color = '#e5e5e5';
                });
            } else {
                container.style.backgroundColor = '#f8f6f3';
                container.style.borderColor = '#e7e2dd';
                
                // Update title colors
                const titleHeader = container.querySelector('.todo-title-header');
                if (titleHeader) {
                    titleHeader.style.color = '#666';
                }
                
                // Update todo item text colors
                const todoItems = container.querySelectorAll('.todo-item-inline span');
                todoItems.forEach(span => {
                    span.style.color = '#2f1b14';
                });
            }
        });
        
        // Update websearch results
        const webSearchResults = document.querySelectorAll('.websearch-result');
        webSearchResults.forEach(result => {
            if (this.isDarkMode) {
                result.style.color = '#e5e5e5';
                // Update SVG icon color
                const svg = result.querySelector('svg');
                if (svg) {
                    svg.parentElement.style.color = '#e5e5e5';
                }
            } else {
                result.style.color = '#2f1b14';
                // Update SVG icon color
                const svg = result.querySelector('svg');
                if (svg) {
                    svg.parentElement.style.color = '#2f1b14';
                }
            }
        });
        
        // Update sidebar content if open
        if (this.sidebarContent) {
            const contentDiv = this.sidebarContent.querySelector('div');
            if (contentDiv) {
                if (this.isDarkMode) {
                    contentDiv.style.color = '#e5e5e5';
                    contentDiv.style.backgroundColor = '#1a1a1a';
                    contentDiv.style.borderColor = '#404040';
                } else {
                    contentDiv.style.color = '#2f1b14';
                    contentDiv.style.backgroundColor = '#fafafa';
                    contentDiv.style.borderColor = '#e7e2dd';
                }
            }
        }
    }

    switchToPage(page) {
        // Hide all panel views
        this.panelViews.forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });

        // Show selected page
        const targetView = document.getElementById(`${page}-view`);
        if (targetView) {
            targetView.classList.add('active');
            targetView.style.display = 'flex';
        }
    }


    showChatInterface() {
        // Show chat interface and hide MCP panel
        if (this.chatInterface) {
            this.chatInterface.style.display = 'flex';
        }
        // Hide MCP panel if it's visible
        if (this.mcpPanel) {
            this.mcpPanel.style.display = 'none';
            this.mcpPanel.classList.remove('visible');
        }
        // Focus on input
        if (this.commandInput) {
            this.commandInput.focus();
        }
    }

    showToolsPage() {
        // Hide chat interface and show tools page
        if (this.chatInterface) {
            this.chatInterface.style.display = 'none';
        }
        if (this.toolsPage) {
            this.toolsPage.style.display = 'flex';
        }
    }





    startNewConversation() {
        // Clear the chat container
        this.chatContainer.innerHTML = '';
        
        // Clear current input
        this.commandInput.value = '';
        
        // Reset any ongoing processes
        this.currentResponse.isProcessing = false;
        
        // Reset conversation and response area references
        this.currentConversation = null;
        this.currentResponseArea = null;
        
        // Hide thinking display
        const thinkingDisplay = document.getElementById('claude-thinking-display');
        if (thinkingDisplay) {
            thinkingDisplay.style.display = 'none';
        }
        
        // 检查MCP认证状态
        if (this.mcpManager) {
            this.mcpManager.checkGlobalAuthenticationStatus();
        }
        
        // 显示新对话开始消息
        this.addMessage('system', 'New conversation started');
        
        // Focus on input
        this.commandInput.focus();
    }









    

    getTimeOfDay(language = null) {
        const currentLanguage = language || localStorage.getItem('userLanguage') || 'en-US';
        const hour = new Date().getHours();
        
        const greetings = {
            'zh-CN': {
                morning: '早上好',
                afternoon: '下午好',
                evening: '晚上好'
            },
            'zh-TW': {
                morning: '早安',
                afternoon: '午安', 
                evening: '晚安'
            },
            'en-US': {
                morning: 'Morning',
                afternoon: 'Afternoon',
                evening: 'Evening'
            }
        };
        
        const langGreetings = greetings[currentLanguage] || greetings['en-US'];
        
        if (hour < 12) return langGreetings.morning;
        if (hour < 18) return langGreetings.afternoon;
        return langGreetings.evening;
    }











    updateGreeting() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        const username = 'mike';
        
        let greeting;
        
        // Special cases for Monday morning and Friday afternoon+
        if (day === 1 && hour >= 6 && hour < 12) {
            greeting = `New week starting, ${username}`;
        } else if (day === 5 && hour >= 12) {
            greeting = `Happy weekend, ${username}`;
        } else {
            // Regular time-based greetings
            if (hour >= 22 || hour < 3) {
                greeting = `Go Sleeping! ${username}`;
            } else if (hour >= 19) {
                greeting = `Good night, ${username}`;
            } else if (hour >= 17) {
                greeting = `Evening, ${username}`;
            } else if (hour >= 12) {
                greeting = `Good Day, ${username}`;
            } else {
                greeting = `Good Morning, ${username}`;
            }
        }
        
        const greetingElement = document.getElementById('greeting-text');
        if (greetingElement) {
            greetingElement.textContent = greeting;
        }
    }

    async sendCommand() {
        let command = this.commandInput.value.trim();
        if (!this.validateCommand(command)) return;
        if (!this.isWebSocketReady()) {
            this.displayErrorMessage('连接未就绪', '请等待WebSocket连接建立', 'network');
            return;
        }

        // 处理图片上传，修改显示的消息内容
        let displayMessage = this.commandInput.value.trim();
        if (this.currentImageFile) {
            // 发送给服务器的command包含提示词，但显示的消息不包含
            command = `查看图片 ${this.currentImageFile.name}\n${command}`;
            // displayMessage保持原样，不添加"查看图片"前缀
        }

        this.commandHistory.push(this.commandInput.value.trim()); // 保存原始命令到历史
        this.historyIndex = -1;

        this.createUserMessage(displayMessage); // 显示包含图片信息的用户消息
        this.showAiThinking();

        // 构建消息对象
        const messageData = {
            type: 'input',
            data: command
        };

        // 处理图片上传
        if (this.currentImageFile) {
            try {
                const imageBase64 = await this.fileToBase64(this.currentImageFile);
                messageData.image = {
                    name: this.currentImagePath || this.currentImageFile.name,
                    type: this.currentImageFile.type,
                    data: imageBase64
                };
            } catch (error) {
                console.error('图片处理失败:', error);
                this.displayErrorMessage('图片处理失败', '无法读取图片文件，请重试', 'parsing');
                return;
            }
        }

        // Handle deep thinking
        if (this.isDeepThinking) {
            messageData.deepThink = true;
        }

        this.ws.send(JSON.stringify(messageData));

        // 清理状态
        this.commandInput.value = '';
        this.autoResizeTextarea();
        this.updateInputPlaceholder();
        
        // 清理图片预览
        if (this.currentImageFile) {
            this.removeImagePreview();
        }
        
        // Reset deep thinking state
        if (this.isDeepThinking) {
            this.isDeepThinking = false;
            this.deepThinkButton.classList.remove('active');
        }

        // Auto-save chat after user message
        setTimeout(() => this.saveCurrentChat(), 1000);
    }

    saveCurrentChat() {
        try {
            // Only save if we have a chat container
            if (!this.chatContainer) {
                return;
            }

            // Get all messages from the current chat
            const messages = [];
            const messageElements = this.chatContainer.querySelectorAll('[data-message-id]');
            
            messageElements.forEach(element => {
                try {
                    const messageId = element.getAttribute('data-message-id');
                    const content = element.textContent || element.innerText;
                    if (content && content.trim() && messageId) {
                        messages.push({
                            id: messageId,
                            content: content.trim(),
                            timestamp: Date.now()
                        });
                    }
                } catch (elemError) {
                }
            });

            // Only save if we have messages
            if (messages.length === 0) {
                return;
            }

            // Save to localStorage with timestamp
            const chatData = {
                messages: messages,
                timestamp: Date.now(),
                sessionId: this.sessionId || 'unknown'
            };

            try {
                localStorage.setItem('claude-current-chat', JSON.stringify(chatData));
            } catch (storageError) {
                // Try to save with reduced data if quota exceeded
                const minimalData = {
                    messages: messages.slice(-10), // Keep only last 10 messages
                    timestamp: Date.now(),
                    sessionId: this.sessionId || 'unknown'
                };
                localStorage.setItem('claude-current-chat', JSON.stringify(minimalData));
            }
        } catch (error) {
            // Don't show error overlay for save failures as they're not critical
        }
    }

    showAiThinking() {
        // 显示停止按钮，隐藏发送按钮
        if (this.sendButton && this.stopButton) {
            this.sendButton.style.display = 'none';
            this.stopButton.style.display = 'flex';
        }
        this.createThinkingMessage();
        // Start timer after creating thinking message
        this.startThinkingTimer();
    }

    createThinkingMessage() {
        // Remove existing thinking message if any
        if (this.thinkingMessage) {
            this.thinkingMessage.remove();
        }

        // Create thinking message element
        this.thinkingMessage = document.createElement('div');
        this.thinkingMessage.className = 'message assistant thinking';
        
        this.thinkingMessage.innerHTML = `
            <div class="message-content">
                <div class="thinking-indicator">
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="thinking-text">Claude is thinking...</span>
                </div>
            </div>
        `;
        
        // Add thinking message to current conversation
        if (this.currentConversation) {
            this.currentConversation.appendChild(this.thinkingMessage);
        } else {
            this.chatContainer.appendChild(this.thinkingMessage);
        }
        this.scrollToBottom();
    }

    hideAiThinking() {
        // 隐藏停止按钮，显示发送按钮
        if (this.sendButton && this.stopButton) {
            this.sendButton.style.display = 'flex';
            this.stopButton.style.display = 'none';
        }
        
        // Remove thinking message from chat
        if (this.thinkingMessage) {
            this.thinkingMessage.remove();
            this.thinkingMessage = null;
        }
        
        this.hideClaudeThinking();
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        if (direction === -1) {
            if (this.historyIndex === -1) {
                this.historyIndex = this.commandHistory.length - 1;
            } else if (this.historyIndex > 0) {
                this.historyIndex--;
            }
        } else if (direction === 1) {
            if (this.historyIndex !== -1) {
                this.historyIndex++;
                if (this.historyIndex >= this.commandHistory.length) {
                    this.historyIndex = -1;
                }
            }
        }

        if (this.historyIndex === -1) {
            this.commandInput.value = '';
        } else {
            this.commandInput.value = this.commandHistory[this.historyIndex];
        }
        this.autoResizeTextarea();
    }

    showClaudeThinking() {
        // Always show Claude Thinking when processing
        if (this.claudeThinkingDisplay) {
            this.claudeThinkingDisplay.style.display = 'flex';
        } else {
        }
    }

    hideClaudeThinking() {
        if (this.claudeThinkingDisplay) {
            this.claudeThinkingDisplay.style.display = 'none';
        }
        this.stopThinkingTimer();
    }

    // Advanced timing prediction methods
    calculateAverageResponseTime() {
        if (this.responseHistory.length === 0) {
            return 8; // Default 8 seconds if no history
        }
        
        const sum = this.responseHistory.reduce((acc, time) => acc + time, 0);
        return sum / this.responseHistory.length;
    }

    calculateInputLengthAdjustment(inputText) {
        // Every 50 characters adds 0.5 seconds
        const extraTime = Math.floor(inputText.length / 50) * 0.5;
        return extraTime;
    }

    calculateComplexityFactor(inputText) {
        let complexityMultiplier = 1.0;
        
        // Code blocks detection
        const codeBlockCount = (inputText.match(/```/g) || []).length / 2;
        complexityMultiplier += codeBlockCount * 0.3;
        
        // Links detection
        const linkCount = (inputText.match(/https?:\/\/[^\s]+/g) || []).length;
        complexityMultiplier += linkCount * 0.2;
        
        // File paths detection
        const filePathCount = (inputText.match(/\/[^\s]*\.[a-zA-Z]+/g) || []).length;
        complexityMultiplier += filePathCount * 0.15;
        
        // Question marks (complexity indicator)
        const questionCount = (inputText.match(/\?/g) || []).length;
        complexityMultiplier += questionCount * 0.1;
        
        // Programming keywords detection
        const programmingKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while'];
        const keywordCount = programmingKeywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            return count + (inputText.match(regex) || []).length;
        }, 0);
        complexityMultiplier += keywordCount * 0.05;
        
        return Math.min(complexityMultiplier, 2.5); // Cap at 2.5x
    }

    predictResponseTime(inputText) {
        const avgTime = this.calculateAverageResponseTime();
        const lengthAdjustment = this.calculateInputLengthAdjustment(inputText);
        const complexityFactor = this.calculateComplexityFactor(inputText);
        
        // Base calculation: (average time + length adjustment) * complexity factor
        let predictedTime = (avgTime + lengthAdjustment) * complexityFactor;
        
        // Ensure minimum 3 seconds, maximum 60 seconds
        predictedTime = Math.max(3, Math.min(predictedTime, 60));
        
        return Math.round(predictedTime);
    }

    recordResponseTime(actualTime) {
        this.responseHistory.push(actualTime);
        
        // Keep only the most recent responses
        if (this.responseHistory.length > this.maxHistorySize) {
            this.responseHistory.shift();
        }
        
        // Save to localStorage for persistence
        localStorage.setItem('claude-response-history', JSON.stringify(this.responseHistory));
    }

    validateCommand(command) {
        if (!command) return false;
        if (command.length > 10000) {
            this.displayErrorMessage('命令过长', '请缩短命令长度', 'validation');
            return false;
        }
        return true;
    }

    isWebSocketReady() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }


    createProgressMessage() {
        const progressDiv = document.createElement('div');
        progressDiv.className = 'message ai-message progress-message';
        progressDiv.innerHTML = `
            <div class="message-content">
                <div class="progress-indicator">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span class="progress-text">正在初始化...</span>
                </div>
            </div>
        `;
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(progressDiv);
        } else {
            this.chatContainer.appendChild(progressDiv);
        }
        
        this.scrollToBottom();
        return progressDiv;
    }

    updateProgressMessage(progressDiv, text, isComplete = false) {
        const textSpan = progressDiv.querySelector('.progress-text');
        const spinner = progressDiv.querySelector('.spinning');
        
        if (textSpan) {
            textSpan.textContent = text;
        }
        
        if (isComplete && spinner) {
            spinner.style.display = 'none';
        }
    }

    createCodeBlock(title, content, language = 'text') {
        const codeBlockDiv = document.createElement('div');
        codeBlockDiv.className = 'message ai-message code-block-message';
        codeBlockDiv.innerHTML = `
            <div class="message-content">
                <div class="code-block-title">${this.escapeHtml(title)}</div>
                <div class="code-block-container">
                    <pre><code class="language-${language}">${this.escapeHtml(content)}</code></pre>
                </div>
            </div>
        `;
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(codeBlockDiv);
        } else {
            this.chatContainer.appendChild(codeBlockDiv);
        }
        
        this.scrollToBottom();
        return codeBlockDiv;
    }

    createAiMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="ai-message-text">${this.escapeHtml(content)}</div>
            </div>
        `;
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(messageDiv);
        } else {
            this.chatContainer.appendChild(messageDiv);
        }
        
        this.scrollToBottom();
        return messageDiv;
    }

    loadResponseHistory() {
        try {
            const saved = localStorage.getItem('claude-response-history');
            if (saved) {
                this.responseHistory = JSON.parse(saved);
            }
        } catch (error) {
            this.responseHistory = [];
        }
    }

    startThinkingTimer() {
        this.thinkingStartTime = Date.now();
        
        // Use advanced prediction algorithm
        const inputText = this.commandHistory[this.commandHistory.length - 1] || '';
        this.currentEstimatedTime = this.predictResponseTime(inputText);
        this.currentRemainingTime = this.currentEstimatedTime;
        
        
        this.updateThinkingTime(this.currentRemainingTime);
        
        this.thinkingTimer = setInterval(() => {
            this.currentRemainingTime--;
            if (this.currentRemainingTime <= 0) {
                this.currentRemainingTime = 0;
                this.updateThinkingTime(this.currentRemainingTime);
                return; // Don't stop timer, let it show 0s
            }
            this.updateThinkingTime(this.currentRemainingTime);
        }, 1000);
    }

    stopThinkingTimer() {
        if (this.thinkingTimer) {
            clearInterval(this.thinkingTimer);
            this.thinkingTimer = null;
        }
    }

    updateThinkingTime(seconds) {
        // Time display removed - method kept for compatibility
    }

    detectTodoList(content) {
        // Check if content contains todo list pattern
        const todoPattern = /"id":\s*"\d+",\s*"content":/;
        return todoPattern.test(content);
    }

    handleTodoListCompletion() {
        // When todo list is detected, calculate timing based on project count
        if (this.thinkingStartTime) {
            const actualTime = (Date.now() - this.thinkingStartTime) / 1000;
            const todoCount = this.countTodoItems();
            
            // Calculate new timing: actual time × project count + 5 seconds
            this.initialThinkingTime = Math.max(Math.ceil(actualTime * todoCount) + 5, 5);
        }
    }

    countTodoItems(content = '') {
        // Count todo items in the content
        const matches = content.match(/"id":\s*"\d+"/g);
        return matches ? matches.length : 3; // Default to 3 if can't count
    }

    createUserMessage(content) {
        // Create conversation container that holds both user question and response
        const conversationDiv = document.createElement('div');
        conversationDiv.className = 'conversation-container';
        
        // Create user question area with same styling as response
        const questionArea = document.createElement('div');
        questionArea.className = 'question-area';
        
        const questionLength = content.length;
        // Calculate width based on content length - more responsive calculation
        const baseWidth = 250; // Base minimum width in pixels
        const charWidth = 8; // Approximate width per character in pixels
        const maxWidthPercent = 85; // Maximum width as percentage of container
        
        // Calculate width: base + (characters * char width)
        const calculatedWidthPx = baseWidth + (questionLength * charWidth);
        
        // Convert to percentage but cap at maximum
        const containerWidth = this.chatContainer.clientWidth || window.innerWidth * 0.8;
        let widthPercentage = Math.min((calculatedWidthPx / containerWidth) * 100, maxWidthPercent);
        
        // Ensure minimum width
        const minWidthPercent = 30;
        widthPercentage = Math.max(widthPercentage, minWidthPercent);
        
        questionArea.innerHTML = `
            <div class="question-content" style="width: ${widthPercentage}%;">
                <div class="question-text">${this.escapeHtml(content)}</div>
            </div>
        `;
        
        conversationDiv.appendChild(questionArea);
        
        // Insert user message at the top (after any existing messages)
        const firstChild = this.chatContainer.firstChild;
        if (firstChild) {
            this.chatContainer.insertBefore(conversationDiv, firstChild);
        } else {
            this.chatContainer.appendChild(conversationDiv);
        }
        
        // Store reference for current conversation
        this.currentConversation = conversationDiv;
    }

    createResponseArea() {
        // Don't remove existing response area - let it accumulate content
        // Only create new response area if one doesn't exist
        if (!this.currentResponseArea) {
            this.currentResponseArea = document.createElement('div');
            this.currentResponseArea.className = 'response-area';
            
            this.currentResponseArea.innerHTML = `
                <div class="response-content">
                    <div class="response-text"></div>
                </div>
            `;
        }
        
        // Add to current conversation instead of chat container
        if (this.currentConversation) {
            this.currentConversation.appendChild(this.currentResponseArea);
        } else {
            this.chatContainer.appendChild(this.currentResponseArea);
        }
        this.scrollToBottom();
    }

    createAssistantMessage(content, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        if (isError) {
            const processedContent = `<p style="color: #dc2626;">${this.escapeHtml(content)}</p>`;
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${processedContent}
                </div>
            `;
            this.chatContainer.appendChild(messageDiv);
        } else {
            // Create container for typewriter effect
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content typewriter-container';
            messageDiv.appendChild(messageContent);
            this.chatContainer.appendChild(messageDiv);
            
            // Start typewriter effect
            this.startTypewriterEffect(messageContent, content);
        }
    }

    formatContent(content) {
        // Convert markdown-like formatting to HTML
        let formatted = this.escapeHtml(content);
        
        // Handle code blocks
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // Handle inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Handle line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if no block elements
        if (!formatted.includes('<pre>') && !formatted.includes('<br>')) {
            formatted = `<p>${formatted}</p>`;
        } else if (formatted.includes('<br>')) {
            // Split by double line breaks for paragraphs
            const paragraphs = formatted.split('<br><br>');
            formatted = paragraphs.map(p => p.trim() ? `<p>${p}</p>` : '').join('');
        }
        
        return formatted;
    }

    containsSignificantCode(text) {
        console.log('🔍 Checking if content contains significant code...');
        
        // Check for CSS patterns
        const cssPatterns = [
            /\{\s*[\w-]+\s*:\s*[^}]+;\s*\}/,  // CSS property blocks
            /\.[\w-]+\s*\{[^}]+\}/,           // CSS class definitions
            /#[\w-]+\s*\{[^}]+\}/,            // CSS ID definitions
            /@[\w-]+\s*\{[^}]+\}/,            // CSS at-rules
            /background:\s*[^;]+;/,           // Background properties
            /transition:\s*[^;]+;/,           // Transition properties
        ];
        
        // Check for JavaScript patterns  
        const jsPatterns = [
            /function\s+\w+\s*\([^)]*\)\s*\{/, // Function definitions
            /const\s+\w+\s*=\s*[^;]+;/,       // Const declarations
            /let\s+\w+\s*=\s*[^;]+;/,         // Let declarations
            /if\s*\([^)]+\)\s*\{/,            // If statements
            /for\s*\([^)]+\)\s*\{/,           // For loops
        ];
        
        // Check for HTML patterns
        const htmlPatterns = [
            /<[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z][^>]*>/,  // HTML tags with content
            /<[a-zA-Z][^>]*\/>/,                          // Self-closing tags
            /class="[^"]*"/,                              // Class attributes
            /id="[^"]*"/,                                 // ID attributes
        ];
        
        const allPatterns = [...cssPatterns, ...jsPatterns, ...htmlPatterns];
        
        let matchCount = 0;
        for (let i = 0; i < allPatterns.length; i++) {
            if (allPatterns[i].test(text)) {
                matchCount++;
                console.log(`✅ Found code pattern ${i}:`, allPatterns[i].source);
            }
        }
        
        // Consider it significant code if multiple patterns match or if text is long with code-like structure
        const hasMultipleMatches = matchCount >= 2;
        const isLongAndStructured = text.length > 500 && /[{}();]/.test(text);
        
        const result = hasMultipleMatches || isLongAndStructured;
        console.log(`🔍 Code analysis: ${matchCount} patterns matched, length: ${text.length}, result: ${result}`);
        
        return result;
    }

    appendOutput(data) {
        console.log('📤 APPEND OUTPUT called with data:', data);
        console.log('📄 Data length:', data.length);
        console.log('📋 Data preview:', data.substring(0, 200) + '...');
        
        // Check if this looks like fragmented text content that should be filtered
        const fragmentPatterns = [
            /library ID:/,
            /Description:/,
            /Available Libraries/,
            /Code Snippets:/,
            /Each result includes:/,
            /- Name:/,
            /- Description:/,
            /TITLE:/,
            /SOURCE:/,
            /LANGUAGE:/,
            /```/,
            /^}\s*;/m,
            /return\s*\(/,
            /\)\s*=>/,
            /^-{5,}/m,
            /^={5,}/m,
            /processedData\.map/,
            /onClick.*=>/,
            /^[A-Z][A-Z\s]*:$/m
        ];
        
        const isTextFragment = fragmentPatterns.some(pattern => pattern.test(data));
        const isCodeFragment = /^[}\)\];,]/.test(data.trim()) || // starts with closing brackets/punctuation
                              data.includes('});') ||
                              data.includes('return (') ||
                              (data.includes('```') && !data.trim().startsWith('{'));
        
        if ((isTextFragment || isCodeFragment) && !data.trim().startsWith('{')) {
            console.log('🔍 Detected text/code fragment that should be filtered - skipping display');
            return;
        }
        
        // Handle JSON buffering for incomplete messages
        if (data.trim().startsWith('{') || this.jsonBuffer) {
            this.jsonBuffer += data;
            console.log('🔄 Added to JSON buffer, total length:', this.jsonBuffer.length);
            
            // Try to parse the buffered JSON
            try {
                const parsedData = JSON.parse(this.jsonBuffer);
                console.log('✅ Successfully parsed buffered JSON');
                console.log('🔍 Parsed data type:', parsedData.type);
                
                // Clear buffer on successful parse
                this.jsonBuffer = '';
                
                // If it's a user message, check if it should be filtered out completely
                if (parsedData.type === 'user' || parsedData.type === 'users' || parsedData.type === 'user_content') {
                    console.log('📋 Detected user message - skipping display (filtering all user messages with type parameter)');
                    return; // Skip all user messages
                }
                
                // For other message types, use normal processing
                this.parseRawResponse(parsedData);
                return;
            } catch (error) {
                console.log('🔄 JSON still incomplete, waiting for more data:', error.message);
                
                // If buffer gets too long, it's probably not valid JSON - clear it
                if (this.jsonBuffer.length > 100000) {
                    console.log('⚠️ JSON buffer too long, clearing');
                    this.jsonBuffer = '';
                }
                return; // Wait for more data
            }
        }
        
        // Try direct parsing for complete JSON
        try {
            const parsedData = JSON.parse(data);
            console.log('✅ Successfully parsed JSON directly');
            console.log('🔍 Parsed data type:', parsedData.type);
            
            // If it's a user message, check if it should be filtered out completely
            if (parsedData.type === 'user' || parsedData.type === 'users' || parsedData.type === 'user_content') {
                console.log('📋 Detected user message - skipping display (filtering all user messages with type parameter)');
                return; // Skip all user messages
            }
            
            // For other message types, use normal processing
            this.parseRawResponse(parsedData);
            return;
        } catch (error) {
            console.log('❌ JSON parsing failed:', error.message);
            console.log('🔍 Skipping display of unparseable content');
            return; // 直接跳过，不显示任何解析失败的内容
        }
        
        // 如果代码执行到这里，说明没有进入JSON处理逻辑，也跳过
        console.log('🔍 Skipping non-JSON content display');
        return;
    }


    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    parseMarkdown(text) {
        try {
            // Input validation
            if (!text || typeof text !== 'string') {
                return '';
            }
            
            // Escape HTML first to prevent XSS
            let html = this.escapeHtml(text);
        
        // Parse code blocks first (triple backticks) - VS Code style
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre style="background-color: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 10px; padding: 16px; margin: 0.5rem 0; overflow-x: auto; font-family: 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 14px; line-height: 1.5; color: #cccccc; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);"><code>${code}</code></pre>`;
        });
        
        // Parse inline code (single backticks) - VS Code style
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            return `<code style="background-color: #2d2d30; color: #cccccc; border: 1px solid #3c3c3c; border-radius: 10px; padding: 2px 6px; font-family: 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 13px;">${code}</code>`;
        });
        
        // Parse headers
        html = html.replace(/^### (.*$)/gm, '<h3 style="font-size: 1.25rem; font-weight: bold; margin: 1rem 0 0.5rem 0;">$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2 style="font-size: 1.5rem; font-weight: bold; margin: 1.25rem 0 0.75rem 0;">$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1 style="font-size: 1.75rem; font-weight: bold; margin: 1.5rem 0 1rem 0;">$1</h1>');
        
        // Parse bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Parse italic text
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Parse strikethrough text
        html = html.replace(/~~(.*?)~~/g, '<del style="text-decoration: line-through;">$1</del>');
        
        // Parse links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #0066cc; text-decoration: underline;">$1</a>');
        
        // Parse blockquotes
        html = html.replace(/^>\s*(.*)$/gm, '<blockquote style="border-left: 4px solid #d97757; margin: 1rem 0; padding: 0.5rem 0 0.5rem 1rem; background-color: rgba(217, 119, 87, 0.1); font-style: italic;">$1</blockquote>');
        
        // Parse horizontal rules
        html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 2px solid #e7e2dd; margin: 1.5rem 0;">');
        
        // Parse task lists (checkboxes)
        html = html.replace(/^[\s]*[-*+]\s+\[\s*\]\s+(.*)$/gm, '<li style="margin: 0.25rem 0; list-style: none;"><input type="checkbox" disabled style="margin-right: 0.5rem;"> $1</li>');
        html = html.replace(/^[\s]*[-*+]\s+\[x\]\s+(.*)$/gm, '<li style="margin: 0.25rem 0; list-style: none;"><input type="checkbox" checked disabled style="margin-right: 0.5rem;"> $1</li>');
        
        // Parse unordered lists
        html = html.replace(/^[\s]*[-*+]\s+(.*)$/gm, '<li style="margin: 0.25rem 0;">$1</li>');
        html = html.replace(/(<li[^>]*>.*<\/li>)/s, '<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">$1</ul>');
        
        // Parse ordered lists
        html = html.replace(/^[\s]*\d+\.\s+(.*)$/gm, '<li style="margin: 0.25rem 0;">$1</li>');
        html = html.replace(/(<li[^>]*>.*<\/li>)/s, '<ol style="margin: 0.5rem 0; padding-left: 1.5rem;">$1</ol>');
        
        // Parse simple tables (basic support)
        html = this.parseMarkdownTables(html);
        
        // Parse line breaks (convert \n to <br> but preserve paragraph structure)
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if no block elements present
        if (!html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>') && 
            !html.includes('<pre>') && !html.includes('<ul>') && !html.includes('<ol>') &&
            !html.includes('<blockquote>') && !html.includes('<table>') && !html.includes('<hr>')) {
            html = `<p>${html}</p>`;
        }
        
        return html;
        
    } catch (error) {
        // Fallback to escaped HTML
        return this.escapeHtml(text) || '';
    }
}

    parseMarkdownTables(html) {
        // Simple table parsing for | column | column | format
        const lines = html.split('<br>');
        const tableLines = [];
        let inTable = false;
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if line looks like a table row (contains |)
            if (line.includes('|') && line.split('|').length >= 3) {
                if (!inTable) {
                    inTable = true;
                    tableLines.length = 0;
                }
                tableLines.push(line);
            } else {
                // End of table or not a table line
                if (inTable && tableLines.length > 0) {
                    // Convert collected table lines to HTML table
                    const tableHtml = this.convertToHtmlTable(tableLines);
                    result.push(tableHtml);
                    tableLines.length = 0;
                    inTable = false;
                }
                if (line.trim() !== '') {
                    result.push(line);
                }
            }
        }
        
        // Handle case where table is at the end
        if (inTable && tableLines.length > 0) {
            const tableHtml = this.convertToHtmlTable(tableLines);
            result.push(tableHtml);
        }
        
        return result.join('<br>');
    }

    convertToHtmlTable(tableLines) {
        if (tableLines.length === 0) return '';
        
        let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 1rem 0; border: 1px solid #e7e2dd;">';
        
        for (let i = 0; i < tableLines.length; i++) {
            const line = tableLines[i];
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
            
            // Skip separator lines (like |---|---|)
            if (cells.every(cell => /^-+$/.test(cell))) {
                continue;
            }
            
            const isHeader = i === 0;
            const tag = isHeader ? 'th' : 'td';
            const style = isHeader 
                ? 'padding: 0.75rem; border: 1px solid #e7e2dd; background-color: #f8f6f3; font-weight: bold; text-align: left;'
                : 'padding: 0.75rem; border: 1px solid #e7e2dd;';
            
            tableHtml += '<tr>';
            cells.forEach(cell => {
                tableHtml += `<${tag} style="${style}">${cell}</${tag}>`;
            });
            tableHtml += '</tr>';
        }
        
        tableHtml += '</table>';
        return tableHtml;
    }

    displayPartialContent(partialData) {
        // Try to extract readable text from partial JSON
        const textMatches = partialData.match(/"text":\s*"([^"]+)"/g);
        if (textMatches) {
            let recoveredText = '';
            textMatches.forEach(match => {
                const text = match.replace(/"text":\s*"([^"]+)"/, '$1');
                if (text && text.length > 10) { // Only display meaningful text
                    recoveredText += text + '\n';
                }
            });
            
            if (recoveredText) {
                this.displayPlainText(recoveredText);
                this.displayErrorMessage(
                    '数据传输不完整，已尽力恢复部分内容。', 
                    `恢复的内容长度: ${recoveredText.length} 字符`, 
                    'transmission'
                );
            }
        }
    }

    displayErrorMessage(message, details = null, type = 'network') {
        this.showErrorOverlay(message, details, type);
    }

    showErrorOverlay(message, details = null, type = 'network') {
        // Remove any existing error overlay
        const existingOverlay = document.querySelector('.error-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create error overlay
        const overlay = document.createElement('div');
        overlay.className = 'error-overlay';

        // Determine error type and icon
        let title, icon;
        switch (type) {
            case 'network':
                title = '网络连接错误';
                icon = '⚠';
                break;
            case 'transmission':
                title = '数据传输错误';
                icon = '⚡';
                break;
            case 'parsing':
                title = '数据解析错误';
                icon = '⚠';
                break;
            default:
                title = '系统错误';
                icon = '!';
        }

        overlay.innerHTML = `
            <div class="error-overlay-header">
                <div class="error-overlay-title">
                    <div class="error-overlay-icon">${icon}</div>
                    ${title}
                </div>
                <button class="error-overlay-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="error-overlay-content">
                ${message}
            </div>
            ${details ? `<div class="error-overlay-details">${this.escapeHtml(details)}</div>` : ''}
            <div class="error-overlay-actions">
                <button class="error-overlay-btn error-overlay-btn-secondary" onclick="this.parentElement.parentElement.remove()">
                    关闭
                </button>
                <button class="error-overlay-btn error-overlay-btn-primary" onclick="location.reload()">
                    刷新页面
                </button>
            </div>
        `;

        // Add to body
        document.body.appendChild(overlay);

        // Auto-hide after 10 seconds for network errors
        if (type === 'network') {
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 10000);
        }
    }

    startTypewriterEffect(container, content) {
        // Clean the content for display
        const cleanContent = this.escapeHtml(content);
        
        // Create typewriter text element
        const textElement = document.createElement('div');
        textElement.className = 'typewriter-text';
        container.appendChild(textElement);
        
        let currentIndex = 0;
        const typeSpeed = 15; // Faster typing speed - reduced from 50ms to 15ms
        
        const typeNextCharacter = () => {
            if (currentIndex < cleanContent.length) {
                const char = cleanContent[currentIndex];
                
                // Create text node for the character
                const charSpan = document.createElement('span');
                charSpan.textContent = char;
                textElement.appendChild(charSpan);
                
                currentIndex++;
                setTimeout(typeNextCharacter, typeSpeed);
            } else {
                // Scroll to bottom when typing is complete
                this.scrollToBottom();
            }
        };
        
        // Start typing immediately
        typeNextCharacter();
    }

    // Sidebar functionality
    openSidebarWithFile(filename, content, extension) {
        
        // Update sidebar header
        const sidebarHeader = this.sidebar.querySelector('h3');
        if (sidebarHeader) {
            sidebarHeader.textContent = filename;
        }
        
        // Clear previous content
        this.sidebarContent.innerHTML = '';
        
        // Create file content display
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            font-family: 'Claude', Georgia, serif;
            font-size: 1rem;
            line-height: 1.6;
            color: #2f1b14;
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #fafafa;
            border: 1px solid #e7e2dd;
            border-radius: 10px;
            padding: 1rem;
        `;
        
        // Apply dark mode styles if needed
        if (document.body.classList.contains('dark')) {
            contentDiv.style.color = '#e5e5e5';
            contentDiv.style.backgroundColor = '#1a1a1a';
            contentDiv.style.borderColor = '#404040';
        }
        
        // Handle empty or undefined content
        if (!content || content.trim() === '') {
            contentDiv.textContent = 'No content available';
        } else {
            // Apply syntax highlighting
            const highlightedContent = this.applySyntaxHighlighting(content, extension);
            contentDiv.innerHTML = highlightedContent;
        }
        
        this.sidebarContent.appendChild(contentDiv);
        
        // Hide header controls except theme toggle
        const changeDirBtn = document.getElementById('change-dir-btn');
        const authBtn = document.getElementById('auth-btn');
        const modelSelector = document.querySelector('.model-selector');
        
        if (changeDirBtn) changeDirBtn.style.display = 'none';
        if (authBtn) authBtn.style.display = 'none';
        if (modelSelector) modelSelector.style.display = 'none';
        
        // Open sidebar and adjust main content for half-and-half layout
        this.sidebar.classList.add('open');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('sidebar-open');
            // Set main content to 50% width when sidebar is open
            mainContent.style.width = '50%';
        }
        
        // Set sidebar to 50% width
        this.sidebar.style.width = '50%';
        
    }

    openSidebarWithCode(filename, content, extension) {
        
        // Update sidebar header
        const sidebarHeader = this.sidebar.querySelector('h3');
        if (sidebarHeader) {
            sidebarHeader.textContent = filename;
        }
        
        // Clear previous content
        this.sidebarContent.innerHTML = '';
        
        // Create code content display with VS Code style
        const codeDiv = document.createElement('div');
        codeDiv.style.cssText = `
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            color: #d4d4d4;
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #1e1e1e;
            border: 1px solid #3c3c3c;
            border-radius: 10px;
            padding: 1rem;
            overflow-x: auto;
            max-height: calc(100vh - 200px);
            overflow-y: auto;
        `;
        
        // Handle empty or undefined content
        if (!content || content.trim() === '') {
            codeDiv.textContent = 'No content available';
        } else {
            // Apply syntax highlighting
            const highlightedContent = this.applySyntaxHighlighting(content, extension);
            codeDiv.innerHTML = highlightedContent;
        }
        
        this.sidebarContent.appendChild(codeDiv);
        
        // Hide header controls except theme toggle
        const changeDirBtn = document.getElementById('change-dir-btn');
        const authBtn = document.getElementById('auth-btn');
        const modelSelector = document.querySelector('.model-selector');
        
        if (changeDirBtn) changeDirBtn.style.display = 'none';
        if (authBtn) authBtn.style.display = 'none';
        if (modelSelector) modelSelector.style.display = 'none';
        
        // Open sidebar and adjust main content for half-and-half layout
        this.sidebar.classList.add('open');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('sidebar-open');
            // Set main content to 50% width when sidebar is open
            mainContent.style.width = '50%';
        }
        
        // Set sidebar to 50% width
        this.sidebar.style.width = '50%';
        
    }
    
    closeSidebar() {
        // Restore header controls
        const changeDirBtn = document.getElementById('change-dir-btn');
        const authBtn = document.getElementById('auth-btn');
        const modelSelector = document.querySelector('.model-selector');
        
        if (changeDirBtn) changeDirBtn.style.display = '';
        if (modelSelector) modelSelector.style.display = '';
        // Note: authBtn might have its own display logic, so we keep it as is
        
        this.sidebar.classList.remove('open');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.remove('sidebar-open');
            // Reset main content to full width
            mainContent.style.width = '';
        }
        
        // Reset sidebar width
        this.sidebar.style.width = '';
    }

    initializeUserSettings() {
        // Initialize theme from themeManager
        if (window.themeManager) {
            const themeInfo = window.themeManager.getCurrentTheme();
            this.isDarkMode = themeInfo.isDarkMode;
        }
        
        // Initialize user name and avatar
        const savedName = localStorage.getItem('userName') || 'mike';
        this.updateUserInfo(savedName);
        
        // Initialize greeting
        this.updateGreeting();
    }
    
    updateUserInfo(name) {
        // Update user avatar initials
        const avatar = document.getElementById('user-avatar');
        if (avatar && name) {
            const initials = name.split(' ').map(word => word.charAt(0).toUpperCase()).join('').slice(0, 2);
            avatar.textContent = initials;
        }
        
        // Update greeting
        const greeting = document.getElementById('greeting-text');
        const timeOfDay = this.getTimeOfDay();
        if (greeting && name) {
            greeting.textContent = `${timeOfDay}, ${name}`;
        }
        
        localStorage.setItem('userName', name);
    }
    
    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return '早上好';
        if (hour < 18) return '下午好';
        return '晚上好';
    }

    displayMixedContent(contentArray) {
        console.log('🤔 displayMixedContent called with:', contentArray.length, 'items');
        contentArray.forEach((item, index) => {
            console.log(`🤔 Item ${index}:`, item.type, item.name || 'no-name');
        });

        // 创建消息容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        let filePaths = [];
        
        // 处理每个内容项
        contentArray.forEach((item, index) => {
            if (item.type === 'text' && item.text) {
                console.log('✅ Processing text content in mixed mode');
                // 立即创建文本元素并插入，保持顺序
                const textElement = document.createElement('div');
                textElement.innerHTML = this.formatText(item.text);
                messageContent.appendChild(textElement);
            } else if (item.type === 'thinking' && item.thinking) {
                console.log('🤔 Processing thinking content');
                // 创建thinking内容，初始状态为完整显示
                const thinkingContent = document.createElement('div');
                thinkingContent.className = 'thinking-content';
                thinkingContent.textContent = item.thinking;
                thinkingContent.setAttribute('data-thinking-full', 'true'); // 标记为thinking内容
                messageContent.appendChild(thinkingContent);
                
                // 立即折叠这个thinking块（延迟很短让用户看到内容）
                setTimeout(() => {
                    this.collapseThinkingBlock(thinkingContent);
                }, 200);
            } else if (item.type === 'tool_use' && item.input) {
                console.log('🔧 Processing tool_use in mixed mode:', item.name);
                
                // Handle TodoWrite operations - display as todolist
                if (item.name === 'TodoWrite' && item.input.todos) {
                    console.log('📝 TodoWrite detected in mixed mode, displaying todos');
                    this.displayTodoItems(item.input.todos);
                    return; // Skip adding to textContent
                }
                
                
                // Create tool indicators for Read and WebSearch
                const toolIndicator = this.createToolIndicator(item.name, item.input);
                if (toolIndicator) {
                    console.log(`🔍 Creating tool indicator for ${item.name} in mixed mode`);
                    messageContent.appendChild(toolIndicator);
                }
                
                // Create file path buttons for Write and Edit operations
                if ((item.name === 'Write' || item.name === 'Edit' || item.name === 'MultiEdit') && 
                    (item.input.file_path || item.input.notebook_path)) {
                    const pathKey = item.input.file_path ? 'file_path' : 'notebook_path';
                    const fullPath = item.input[pathKey];
                    const fileName = fullPath.split('/').pop();
                    
                    console.log('✅ MATCH: Creating file path button in mixed mode:', fileName);
                    
                    // Check if this file path already exists to prevent duplicates
                    const existingPath = filePaths.find(fp => fp.fullPath === fullPath && fp.toolName === item.name);
                    if (!existingPath) {
                        filePaths.push({
                            fileName: fileName,
                            fullPath: fullPath,
                            command: item.input.command || null,
                            toolName: item.name,
                            content: item.input.content || null,
                            input: item.input
                        });
                    }
                }
                
                // Display command content as styled command block if present
                if (item.input.command) {
                    const commandInfo = {
                        command: item.input.command,
                        toolName: item.name,
                        description: item.input.description || '',
                        toolUseId: item.id // Pass the tool_use id
                    };
                    const commandBlock = this.createCommandBlock(commandInfo);
                    messageContent.appendChild(commandBlock);
                }
                
                // Check if this is an MCP tool that should be displayed as a code block
                const isMcpTool = item.name && item.name.toLowerCase().includes('mcp');
                if (isMcpTool && !item.input.command && !(item.input.file_path || item.input.notebook_path)) {
                    console.log('🔧 Creating MCP tool block in mixed mode for:', item.name);
                    this.displayCodeBlock(item);
                }
            } else if (item.type === 'tool_result' || item.type === 'toolresult') {
                console.log('🔧 Processing tool_result in mixed mode, filtering out text content');
                // For tool_result items, we intentionally don't display the text content
                // This handles the case where tool_result contains text that should be filtered
                // The filtering was already done before calling displayMixedContent
            }
        });
        
        messageDiv.appendChild(messageContent);
        
        if (this.currentConversation) {
            this.currentConversation.appendChild(messageDiv);
        } else {
            this.chatContainer.appendChild(messageDiv);
        }
        
        // Create file path buttons if there are file operations
        filePaths.forEach((fileInfo, index) => {
            console.log(`📄 File button ${index} in mixed mode:`, fileInfo.fileName, 'Tool:', fileInfo.toolName);
            this.createFilePathButton(fileInfo.fileName, fileInfo.fullPath, fileInfo.content || '', fileInfo.command, fileInfo.toolName, fileInfo.input);
        });
        
        // 标记这个消息容器，以便响应完成后处理thinking折叠
        messageDiv.setAttribute('data-has-thinking', 'true');
        
        this.scrollToBottom();
    }
    
    // 显示thinking内容（不折叠）
    collapseThinkingContent(messageElement) {
        const thinkingElements = messageElement.querySelectorAll('[data-thinking-full]');
        
        thinkingElements.forEach(thinkingContent => {
            // 直接显示thinking内容，不创建折叠功能
            thinkingContent.style.display = 'block';
            thinkingContent.removeAttribute('data-thinking-full');
        });
    }
    
    // 显示单个thinking块（不折叠）
    collapseThinkingBlock(thinkingContent) {
        if (!thinkingContent || !thinkingContent.hasAttribute('data-thinking-full')) {
            return; // 已经处理过或不存在
        }
        
        // 直接显示thinking内容，不创建折叠功能
        thinkingContent.style.display = 'block';
        thinkingContent.removeAttribute('data-thinking-full');
    }

    getClaudeIconSVG() {
        return `<svg width="20" height="20" viewBox="0 0 123 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M46.2032 59.5747L56.4346 53.5065L56.6032 52.975L56.4346 52.679H55.9286L54.214 52.5687L48.3676 52.4032L43.3081 52.1825L38.3892 51.9067L37.1524 51.6309L36 50.0035L36.1124 49.2036L37.1524 48.4589L38.6422 48.5968L41.9308 48.845L46.8779 49.2036L50.4476 49.4243L55.76 50.0035H56.6032L56.7157 49.6449L56.4346 49.4243L56.2097 49.2036L51.0941 45.5351L45.5567 41.6735L42.6616 39.4393L41.1157 38.3084L40.3286 37.2603L39.9914 34.9433L41.3968 33.2884L43.3081 33.4263L43.7859 33.5642L45.7254 35.1364L49.8573 38.5291L55.2541 42.7216L56.0411 43.4112L56.358 43.185L56.4065 43.025L56.0411 42.3907L53.1179 36.7913L49.9978 31.0817L48.5924 28.7096L48.227 27.3029C48.0855 26.7126 48.0021 26.2242 48.0021 25.6204L49.6043 23.3034L50.5038 23L52.6681 23.3034L53.5676 24.1309L54.9168 27.3857L57.0811 32.4885L60.454 39.4393L61.4379 41.508L61.9719 43.4112L62.1686 43.9905H62.5059V43.6594L62.787 39.7427L63.293 34.9433L63.7989 28.7648L63.9676 27.0271L64.7827 24.9308L66.413 23.7999L67.6779 24.4343L68.7178 26.0065L68.5773 27.0271L67.9589 31.2748L66.7503 37.9223L65.9633 42.3907H66.413L66.947 41.8114L69.0832 38.8325L72.653 34.0883L74.227 32.2126L76.0822 30.1439L77.2627 29.1509H79.5113L81.1416 31.7437L80.4108 34.4192L78.106 37.5085L76.1946 40.1289L73.4541 44.0124L71.7535 47.1349L71.906 47.3925L72.3157 47.3555L78.4994 45.9488L81.8443 45.3144L85.8357 44.5973L87.6346 45.4799L87.8313 46.3902L87.1286 48.2382L82.8562 49.3415L77.853 50.4173L70.4025 52.2723L70.32 52.3425L70.4174 52.4953L73.7773 52.8169L75.2108 52.8997H78.7243L85.2735 53.4237L86.9881 54.6098L88 56.0717L87.8313 57.2026L85.1892 58.6093L81.6476 57.7267L73.3557 55.6304L70.5167 54.8856H70.1233V55.1339L72.4843 57.5588L76.8411 61.7262L82.266 67.0772L82.547 68.4012L81.8443 69.4493L81.1135 69.339L76.3352 65.5326L74.48 63.8224L70.32 60.0988H70.0389V60.4849L70.9946 61.9744L76.0822 70.0561L76.3352 72.5386L75.9697 73.3385L74.6486 73.835L73.2151 73.5592L70.2076 69.1183L67.1438 64.1535L64.6703 59.685L64.3715 59.8845L62.8995 76.5105L62.2248 77.3655L60.6508 78L59.3297 76.9518L58.627 75.2417L59.3297 71.849L60.173 67.4358L60.8476 63.9328L61.466 59.5747L61.8436 58.1188L61.8103 58.0214L61.5085 58.075L58.4021 62.5812L53.68 69.339L49.9416 73.5592L49.0422 73.9453L47.4962 73.0902L47.6367 71.5732L48.5081 70.2216L53.68 63.2708L56.8 58.9403L58.8108 56.4545L58.7913 56.095L58.6802 56.085L44.9384 65.5602L42.493 65.8912L41.4249 64.843L41.5654 63.1329L42.0713 62.5812L46.2032 59.5747Z" fill="#D97757"/>
        </svg>`;
    }

    getTerminalIconSVG() {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4Z" stroke="currentColor" stroke-width="2"/>
            <path d="M7 8L10 11L7 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
    }

    getEyeIconSVG() {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
        </svg>`;
    }

    getGlobeIconSVG() {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="m2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="2"/>
        </svg>`;
    }

    createToolIndicator(toolName, toolInput) {
        if (toolName === 'Read' && toolInput.file_path) {
            return this.createToolIndicatorElement(this.getEyeIconSVG(), `reading: ${toolInput.file_path}`);
        } else if (toolName === 'WebSearch' && toolInput.query) {
            return this.createToolIndicatorElement(this.getGlobeIconSVG(), `searching: ${toolInput.query}`);
        }
        return null;
    }

    createToolIndicatorElement(iconSvg, text) {
        const indicator = document.createElement('div');
        indicator.className = 'tool-indicator';
        indicator.innerHTML = `
            <span class="tool-indicator-icon">${iconSvg}</span>
            <span class="tool-indicator-text">${text}</span>
        `;
        return indicator;
    }
    
    // 检查是否为rm命令
    isRmCommand(command) {
        const trimmed = command.trim();
        return trimmed.startsWith('rm ') || trimmed.includes(' rm ');
    }
    
    // 创建rm命令的文件块显示
    createRmFileBlock(command, container) {
        const files = this.extractFilesFromRmCommand(command);
        
        files.forEach(filePath => {
            const fileName = filePath.split('/').pop() || filePath;
            const fileBlock = this.createFileBlock(fileName, true);
            container.appendChild(fileBlock);
        });
        
        return container;
    }
    
    // 从rm命令中提取文件路径
    extractFilesFromRmCommand(command) {
        // Remove rm command and flags, extract file paths
        const parts = command.split(' ').filter(part => {
            const trimmed = part.trim();
            return trimmed && !trimmed.startsWith('-') && trimmed !== 'rm';
        });
        return parts;
    }
    
    // 创建文件块（用于rm命令显示）
    createFileBlock(fileName, isDelete = false) {
        const fileBlock = document.createElement('div');
        fileBlock.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: ${isDelete ? '20px 24px' : '8px 12px'};
            background-color: ${isDelete ? '#fff2f0' : '#f5f1e8'};
            border: 1px solid ${isDelete ? '#ffccc7' : '#e0d5c7'};
            border-radius: ${isDelete ? '12px' : '6px'};
            font-family: 'Claude', Georgia, serif;
            font-size: ${isDelete ? '18px' : '13px'};
            color: ${isDelete ? '#cf1322' : '#5d4e37'};
            margin: ${isDelete ? '12px 0' : '4px 0'};
            min-height: ${isDelete ? '56px' : 'auto'};
        `;
        
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: ${isDelete ? '20px' : '16px'};
            height: ${isDelete ? '20px' : '16px'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isDelete ? '#ff4d4f' : '#d97757'};
        `;
        
        icon.innerHTML = isDelete ? 
            `<svg width="${isDelete ? '16' : '12'}" height="${isDelete ? '16' : '12'}" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>` :
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>`;
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = fileName;
        fileNameSpan.style.cssText = `font-weight: 500; color: ${isDelete ? '#cf1322' : '#5d4e37'}; font-size: ${isDelete ? '16px' : 'inherit'};`;
        
        if (document.body.classList.contains('dark')) {
            fileBlock.style.backgroundColor = isDelete ? '#2a1215' : '#3c342a';
            fileBlock.style.borderColor = isDelete ? '#58181c' : '#4a4037';
            fileBlock.style.color = isDelete ? '#ff7875' : '#e8dcc6';
            fileNameSpan.style.color = isDelete ? '#ff7875' : '#e8dcc6';
        }
        
        fileBlock.appendChild(icon);
        fileBlock.appendChild(fileNameSpan);
        
        return fileBlock;
    }

    // 停止AI响应
    stopResponse() {
        console.log('🛑 Stopping AI response');
        
        // 关闭WebSocket连接来停止响应
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        
        // 隐藏停止按钮
        this.hideStopButton();
        
        // 显示停止消息
        this.addMessage('system', 'Response stopped by user');
        
        // 重新连接WebSocket
        setTimeout(() => {
            this.connectWebSocket();
        }, 1000);
    }

    // 显示停止按钮
    showStopButton() {
        if (this.stopButton) {
            this.stopButton.style.display = 'flex';
        }
    }

    // 隐藏停止按钮
    hideStopButton() {
        if (this.stopButton) {
            this.stopButton.style.display = 'none';
        }
    }

    // 创建命令代码块元素
    createCommandBlock(commandInfo) {
        const commandContainer = document.createElement('div');
        const command = typeof commandInfo === 'string' ? commandInfo : commandInfo.command;
        const toolUseId = typeof commandInfo === 'object' ? commandInfo.toolUseId : '';
        
        if (toolUseId) {
            commandContainer.setAttribute('data-tool-id', toolUseId);
        }
        
        // Check if this is an rm command - display as file block instead
        if (this.isRmCommand(command)) {
            return this.createRmFileBlock(command, commandContainer);
        }
        
        // Regular terminal command block
        commandContainer.className = 'command-block-container';
        const commandContent = document.createElement('pre');
        commandContent.className = 'command-block-content';
        commandContent.innerHTML = `${this.getTerminalIconSVG()} ${command.trim()}`;
        commandContainer.appendChild(commandContent);
        
        return commandContainer;
    }

    // 处理图片上传
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        // 检查文件大小 (5MB限制)
        if (file.size > 5 * 1024 * 1024) {
            alert('图片文件不能超过5MB');
            return;
        }

        this.currentImageFile = file;
        // 获取文件的完整路径信息
        this.currentImagePath = file.webkitRelativePath || file.name;
        this.showImagePreview(file.name);
        
        // 清空文件输入，允许重复选择同一文件
        event.target.value = '';
    }

    // 显示图片预览标签
    showImagePreview(fileName) {
        this.imagePreviewTag.innerHTML = `
            ${fileName}
            <button class="image-preview-close" onclick="terminalInterface.removeImagePreview()">×</button>
        `;
        this.imagePreviewContainer.style.display = 'block';
    }

    // 移除图片预览
    removeImagePreview() {
        this.currentImageFile = null;
        this.currentImagePath = null;
        this.imagePreviewContainer.style.display = 'none';
        this.imagePreviewTag.innerHTML = '';
    }

    // Toggle deep thinking state
    toggleDeepThinking() {
        this.isDeepThinking = !this.isDeepThinking;
        
        if (this.isDeepThinking) {
            this.deepThinkButton.classList.add('active');
        } else {
            this.deepThinkButton.classList.remove('active');
        }
    }

    // showChatInterface已在其他地方定义，删除重复定义

    // 将文件转换为base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // 移除data:image/jpeg;base64,前缀，只保留base64数据
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Shell Terminal Methods
    switchToShell() {
        if (this.chatInterface) {
            this.chatInterface.style.display = 'none';
        }
        // Note: shellInterface is not defined in this implementation
        console.log('Shell interface not implemented yet');
        
        // Initialize terminal if not already done
        if (!this.terminal) {
            this.initializeTerminal();
        }
        
        // Fit terminal to container
        setTimeout(() => {
            if (this.terminal && this.fitAddon) {
                this.fitAddon.fit();
            }
        }, 100);
        
    }
    
    initializeTerminal() {
        if (!window.Terminal || !window.FitAddon) {
            console.error('xterm.js libraries not loaded');
            return;
        }
        
        // Create terminal instance with current theme
        this.terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            allowProposedApi: true,
            allowTransparency: false,
            convertEol: true,
            scrollback: 10000,
            theme: this.getTerminalTheme()
        });
        
        // Create fit addon
        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        
        // Mount to DOM
        this.terminal.open(this.terminalContainer);
        this.fitAddon.fit();
        
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.terminal && this.fitAddon) {
                setTimeout(() => {
                    this.fitAddon.fit();
                }, 100);
            }
        });
        
        console.log('Terminal initialized');
    }
    

    getTerminalTheme() {
        const isDark = document.body.classList.contains('dark');
        
        if (isDark) {
            // 黑暗模式主题
            return {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#d4d4d4',
                black: '#1e1e1e',
                red: '#f44747',
                green: '#4ec9b0',
                yellow: '#ffcc02',
                blue: '#3794ff',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                brightBlack: '#666666',
                brightRed: '#f44747',
                brightGreen: '#4ec9b0',
                brightYellow: '#ffcc02',
                brightBlue: '#3794ff',
                brightMagenta: '#bc3fbc',
                brightCyan: '#11a8cd',
                brightWhite: '#e5e5e5'
            };
        } else {
            // 明亮模式主题
            return {
                background: '#ffffff',
                foreground: '#333333',
                cursor: '#333333',
                black: '#000000',
                red: '#d73a49',
                green: '#28a745',
                yellow: '#ffc107',
                blue: '#007bff',
                magenta: '#6f42c1',
                cyan: '#17a2b8',
                white: '#f8f9fa',
                brightBlack: '#6c757d',
                brightRed: '#dc3545',
                brightGreen: '#28a745',
                brightYellow: '#ffc107',
                brightBlue: '#007bff',
                brightMagenta: '#6f42c1',
                brightCyan: '#17a2b8',
                brightWhite: '#ffffff'
            };
        }
    }

    updateTerminalTheme() {
        if (this.terminal) {
            this.terminal.options.theme = this.getTerminalTheme();
            this.terminal.refresh(0, this.terminal.rows - 1);
        }
    }

    // MCP Panel Methods
    toggleMcpPanel() {
        const todoPanel = document.getElementById('todo-panel');
        
        if (this.mcpPanel.style.display === 'block') {
            // Hide MCP panel
            this.mcpPanel.style.display = 'none';
            this.mcpPanel.classList.remove('visible');
        } else {
            // Hide todo panel if open
            if (todoPanel) {
                todoPanel.style.display = 'none';
                todoPanel.classList.remove('visible');
            }
            
            // Show MCP panel
            this.mcpPanel.style.display = 'block';
            setTimeout(() => {
                this.mcpPanel.classList.add('visible');
                // 每次显示MCP面板时重新检测状态
                if (this.mcpManager) {
                    this.mcpManager.checkMcpStatus();
                }
            }, 10);
        }
    }

    showMcpFullpage() {
        // Hide other panels
        const todoPanel = document.getElementById('todo-panel');
        if (todoPanel) {
            todoPanel.style.display = 'none';
            todoPanel.classList.remove('visible');
        }
        if (this.mcpPanel) {
            this.mcpPanel.style.display = 'none';
            this.mcpPanel.classList.remove('visible');
        }
        
        // 隐藏对话模式的auth按钮
        const authCollapsed = document.getElementById('auth-collapsed');
        if (authCollapsed) authCollapsed.style.display = 'none';

        // Show fullpage MCP view
        if (this.mcpFullpage) {
            this.mcpFullpage.style.display = 'block';
            // Check MCP status when showing fullpage view
            if (this.mcpManager) {
                this.mcpManager.checkMcpStatus();
                // Sync MCP data from panel to fullpage after detection completes
                setTimeout(() => {
                    this.syncMcpData();
                }, 1500); // 等待检测完成
            } else {
                this.syncMcpData();
            }
        }
    }

    hideMcpFullpage() {
        if (this.mcpFullpage) {
            this.mcpFullpage.style.display = 'none';
        }
        
        // 隐藏MCP页面相关的认证元素
        if (this.mcpManager) {
            const mcpAuthCollapsed = document.getElementById('mcp-auth-collapsed');
            if (mcpAuthCollapsed) mcpAuthCollapsed.style.display = 'none';
            
            // 隐藏任何展开的认证提示
            const existingNotice = document.querySelector('.auth-notice-expanded');
            if (existingNotice) existingNotice.remove();
            
            // 检查是否需要在对话模式下显示auth按钮
            setTimeout(() => {
                if (this.mcpManager) {
                    // 检查localStorage中的认证状态
                    const authStates = this.mcpManager.loadAuthStatesFromStorage();
                    const storedMcps = Object.keys(authStates);
                    const filteredMcps = storedMcps.filter(mcp => !this.mcpManager.isPermanentlyClosed(mcp));
                    
                    if (filteredMcps.length > 0) {
                        this.mcpManager.showCollapsedAuthButton(filteredMcps);
                    } else {
                        // 隐藏auth按钮如果没有需要认证的MCP
                        const authBtn = document.getElementById('auth-btn');
                        if (authBtn) authBtn.style.display = 'none';
                    }
                }
            }, 100);
        }
    }

    syncMcpData() {
        // Sync MCP items from the panel list to the fullpage list
        if (this.mcpList && this.mcpListFullpage) {
            // 清空全页面列表
            this.mcpListFullpage.innerHTML = '';
            
            // 复制所有非custom项目
            const panelItems = this.mcpList.querySelectorAll('.mcp-item:not([data-mcp="custom"])');
            panelItems.forEach(item => {
                this.mcpListFullpage.appendChild(item.cloneNode(true));
            });
            
            // 确保custom项目始终在最后
            const customItem = this.mcpList.querySelector('[data-mcp="custom"]');
            if (customItem) {
                this.mcpListFullpage.appendChild(customItem.cloneNode(true));
            }
        }
    }

    installMcp(mcpType) {
        const mcpItem = document.querySelector(`[data-mcp="${mcpType}"]`);
        if (!mcpItem) return;

        const statusElement = mcpItem.querySelector('.mcp-item-status');
        if (!statusElement) return;

        // Update status to installing
        statusElement.setAttribute('data-status', 'installing');
        statusElement.textContent = 'installing';

        // MCP类型的显示名称
        const mcpNames = {
            'context7': 'Context7',
            'atlassian': 'Atlassian',
            'notion': 'Notion', 
            'figma': 'Figma',
            'playwright': 'Playwright'
        };

        const mcpDisplayName = mcpNames[mcpType] || mcpType;
        
        // Execute the installation command without UI display
        this.executeMcpCommandSilent(mcpType, mcpDisplayName);
    }

    async executeMcpCommandSilent(mcpType, mcpDisplayName) {
        try {
            // 获取当前目录
            const currentDir = '/Users/mike/claudecode-gui-最终';
            
            // 发送请求到后端执行MCP安装（不显示进度）
            const response = await fetch('/api/execute-mcp-install', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mcpType: mcpType,
                    workingDirectory: currentDir
                })
            });
            
            const result = await response.json();
            console.log(`${mcpDisplayName} MCP安装结果:`, result);
            
            if (result.success) {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(mcpType, 'installed', 'installed');
                }
            } else {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(mcpType, 'failed', 'failed');
                }
            }
            
        } catch (error) {
            console.error(`安装${mcpDisplayName}失败:`, error);
            if (this.mcpManager) {
                this.mcpManager.updateMcpStatus(mcpType, 'failed', 'failed');
            }
        }
    }

    async executeMcpCommand(mcpType, mcpDisplayName) {
        // 在聊天界面中显示开始安装的消息
        this.createUserMessage(`安装 ${mcpDisplayName} MCP...`);
        
        // 创建进度消息容器
        const progressMessage = this.createProgressMessage();
        this.showAiThinking();

        try {
            // 获取当前目录
            const currentDir = '/Users/mike/claudecode-gui-最终';
            
            this.updateProgressMessage(progressMessage, '正在准备安装环境...');
            
            // 发送请求到后端执行MCP安装
            const response = await fetch('/api/execute-mcp-install', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentDir: currentDir,
                    mcpType: mcpType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.hideAiThinking();
            
            if (result.success) {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(mcpType, 'installed', '安装成功');
                }
                
                // 直接替换进度消息为绿色半透明成功状态框
                this.showStatusBoxInMessage(progressMessage, 'successfully!', 'success');
                
            } else {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(mcpType, 'failed', '安装失败');
                }
                
                // 直接替换进度消息为红色半透明错误状态框
                let errorReason = 'error';
                if (result.error) {
                    if (result.error.includes('already exists') || result.error.includes('already configured')) {
                        errorReason = 'mcp exists';
                    } else {
                        errorReason = 'error';
                    }
                }
                this.showStatusBoxInMessage(progressMessage, errorReason, 'error');
            }
            
        } catch (error) {
            console.error(`安装${mcpDisplayName}失败:`, error);
            this.hideAiThinking();
            this.updateProgressMessage(progressMessage, '❌ 网络错误', true);
            if (this.mcpManager) {
                this.mcpManager.updateMcpStatus(mcpType, 'failed', '网络错误');
            }
            this.displayErrorMessage('安装失败', `网络请求失败: ${error.message}`, 'network');
        }
    }

    updateMcpStatus(mcpType, status, message) {
        const mcpItem = document.querySelector(`[data-mcp="${mcpType}"]`);
        if (!mcpItem) return;

        const statusElement = mcpItem.querySelector('.mcp-item-status');
        if (!statusElement) return;

        statusElement.setAttribute('data-status', status);
        statusElement.textContent = message;

        // Show notification or toast if needed
        if (status === 'installed') {
            console.log(`✅ ${mcpType} MCP installed successfully`);
        } else if (status === 'failed') {
            console.error(`❌ ${mcpType} MCP installation failed: ${message}`);
        }
    }

    showCustomMcpModal() {
        const modal = document.getElementById('custom-mcp-modal');
        const input = document.getElementById('custom-mcp-command');
        
        if (modal) {
            modal.style.display = 'flex';
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    hideCustomMcpModal() {
        const modal = document.getElementById('custom-mcp-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async executeCustomMcpCommand(command) {
        const executeBtn = document.getElementById('custom-mcp-execute');
        const originalText = executeBtn ? executeBtn.textContent : '';
        let progressMessage = null;
        
        try {
            // Disable button and show loading state
            if (executeBtn) {
                executeBtn.disabled = true;
                executeBtn.textContent = '执行中...';
            }

            // Hide modal
            this.hideCustomMcpModal();

            // Execute the command
            const response = await fetch('/api/execute-custom-mcp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command }),
                timeout: 300000 // 5 minutes timeout
            });

            const result = await response.json();

            // Auto-add to MCP options (with result status)
            this.addCustomMcpToOptions(command, result);

        } catch (error) {
            console.error('执行自定义 MCP 命令失败:', error);
            
            // Still create a placeholder MCP with failed status
            this.addCustomMcpToOptions(command, { success: false, error: error.message });
        } finally {
            // Re-enable button
            if (executeBtn) {
                executeBtn.disabled = false;
                executeBtn.textContent = originalText;
            }
        }
    }

    addCustomMcpToOptions(command, result) {
        const mcpList = this.mcpList;
        if (!mcpList) return;

        // Generate a unique ID for this custom MCP
        const mcpId = 'custom_' + Date.now();
        const commandName = this.extractMcpDisplayName(command);
        
        // Create new MCP item element
        const mcpItem = document.createElement('div');
        mcpItem.className = 'mcp-item';
        mcpItem.setAttribute('data-mcp', mcpId);
        
        const status = result.success ? 'installed' : 'failed';
        const statusText = result.success ? 'installed' : 'failed';
        
        mcpItem.innerHTML = `
            <div class="mcp-item-content">
                <div class="mcp-item-header">
                    <div class="mcp-item-title">${commandName}</div>
                </div>
                <div class="mcp-item-description">Custom MCP command</div>
            </div>
            <div class="mcp-item-status" data-status="${status}">${statusText}</div>
        `;
        
        // Add click handler for re-execution
        mcpItem.addEventListener('click', () => {
            // Show confirmation dialog
            if (confirm(`重新执行命令: ${command}?`)) {
                this.executeCustomMcpCommand(command);
            }
        });
        
        // Add to the list
        mcpList.appendChild(mcpItem);
        
        console.log(`✅ Custom MCP "${commandName}" added to options`);
    }

    extractMcpDisplayName(command) {
        // Extract MCP name for display purposes only
        const parts = command.trim().split(/\s+/);
        
        // Handle Claude MCP commands: claude mcp add [name] -- [command]
        if (parts[0] === 'claude' && parts[1] === 'mcp' && parts[2] === 'add') {
            // Find the MCP name (after 'add' and before '--' or end)
            for (let i = 3; i < parts.length; i++) {
                if (parts[i] === '--') {
                    break;
                }
                if (!parts[i].startsWith('-')) {
                    return parts[i];
                }
            }
        }
        
        // Fallback: use first 30 characters of command
        return command.length > 30 ? command.substring(0, 30) + '...' : command;
    }

    // 在消息中显示状态框（替代进度消息）
    showStatusBoxInMessage(progressMessage, message, type) {
        if (!progressMessage) return;
        
        // 清空原有内容
        progressMessage.innerHTML = '';
        
        // 创建状态框
        const statusBox = document.createElement('div');
        statusBox.className = `inline-status-box inline-status-box-${type}`;
        statusBox.textContent = message;

        // 添加到消息中
        progressMessage.appendChild(statusBox);
        
        // 移除进度消息的其他类，添加状态框容器类
        progressMessage.className = 'status-message-container';
    }


    // Working directory management methods
    async getCurrentWorkingDirectory() {
        try {
            const response = await fetch('/api/current-directory');
            const result = await response.json();
            
            if (result.success) {
                this.updateCurrentDirDisplay(result.currentDirectory);
                console.log('当前工作目录:', result.currentDirectory);
            } else {
                console.error('获取工作目录失败:', result.error);
            }
        } catch (error) {
            console.error('获取工作目录出错:', error);
        }
    }

    updateCurrentDirDisplay(path) {
        if (this.currentDirDisplay) {
            // 只显示目录名，不显示完整路径
            const dirName = path.split('/').pop() || path;
            this.currentDirDisplay.textContent = dirName;
            this.currentDirDisplay.title = path; // 悬停时显示完整路径
        }
        
        if (this.currentDirPath) {
            this.currentDirPath.textContent = path;
        }
        
        // 同时更新MCP面板中的工作目录显示
        const mcpWorkingDirPath = document.getElementById('mcp-working-directory-path');
        if (mcpWorkingDirPath) {
            mcpWorkingDirPath.textContent = path;
        }
    }

    showChangeDirModal() {
        if (this.changeDirModal) {
            this.changeDirModal.style.display = 'flex';
            // 获取最新的工作目录信息
            this.getCurrentWorkingDirectory();
            // 清空输入框
            if (this.newDirPath) {
                this.newDirPath.value = '';
                this.newDirPath.focus();
            }
        }
    }

    hideChangeDirModal() {
        if (this.changeDirModal) {
            this.changeDirModal.style.display = 'none';
        }
    }

    async changeWorkingDirectory() {
        const newPath = this.newDirPath?.value.trim();
        if (!newPath) {
            alert('请输入有效的目录路径');
            return;
        }

        const confirmBtn = this.changeDirConfirm;
        const originalText = confirmBtn ? confirmBtn.textContent : '';
        
        try {
            if (confirmBtn) {
                confirmBtn.textContent = '更改中...';
                confirmBtn.disabled = true;
            }

            const response = await fetch('/api/set-working-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: newPath })
            });

            const result = await response.json();

            if (result.success) {
                this.updateCurrentDirDisplay(result.path);
                this.hideChangeDirModal();
                
                // 重新检测MCP状态（因为工作目录可能影响MCP检测）
                if (this.mcpManager) {
                    setTimeout(() => {
                        this.mcpManager.checkMcpStatus();
                    }, 500);
                }
                
                console.log('工作目录已更改为:', result.path);
            } else {
                alert(`更改工作目录失败: ${result.error}`);
            }
        } catch (error) {
            console.error('更改工作目录出错:', error);
            alert('更改工作目录时发生错误，请检查网络连接');
        } finally {
            if (confirmBtn) {
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        }
    }

    // MCP Deletion Methods
    showMcpDeleteModal(mcpType, mcpItem) {
        const modal = document.getElementById('mcp-delete-modal');
        const nameElement = document.getElementById('mcp-delete-name');
        
        if (modal && nameElement) {
            // Get MCP display name
            const titleElement = mcpItem.querySelector('.mcp-item-title');
            const displayName = titleElement ? titleElement.textContent : mcpType;
            
            nameElement.textContent = displayName;
            
            // Store the MCP type and item for later use
            this.currentMcpForDeletion = {
                type: mcpType,
                item: mcpItem,
                displayName: displayName
            };
            
            modal.style.display = 'flex';
        }
    }

    hideMcpDeleteModal() {
        const modal = document.getElementById('mcp-delete-modal');
        if (modal) {
            modal.style.display = 'none';
            this.currentMcpForDeletion = null;
        }
    }

    async confirmMcpDeletion() {
        if (!this.currentMcpForDeletion) return;
        
        const { type, item, displayName } = this.currentMcpForDeletion;
        const confirmBtn = document.getElementById('mcp-delete-confirm');
        const originalText = confirmBtn ? confirmBtn.textContent : 'Remove MCP';
        
        try {
            // Hide modal first
            this.hideMcpDeleteModal();
            
            // Update button state
            if (confirmBtn) {
                confirmBtn.textContent = 'Removing...';
                confirmBtn.disabled = true;
            }
            
            // Silent removal - no progress message
            
            // Call deletion API
            const response = await fetch('/api/execute-mcp-remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mcpType: type })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(type, 'pending', 'install');
                }
            } else {
                if (this.mcpManager) {
                    this.mcpManager.updateMcpStatus(type, 'failed', 'failed');
                }
            }
            
        } catch (error) {
            console.error(`删除${displayName}失败:`, error);
            
            // Create error progress message if one doesn't exist  
            let errorMessage = 'network error';
            if (error.message) {
                if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'server not running';
                } else if (error.message.includes('NetworkError')) {
                    errorMessage = 'connection failed';
                } else {
                    errorMessage = 'network error';
                }
            }
            
            const progressMessage = this.createProgressMessage(`Failed to remove ${displayName}`);
            this.showStatusBoxInMessage(progressMessage, errorMessage, 'error');
            
            if (this.mcpManager) {
                this.mcpManager.updateMcpStatus(type, 'failed', '网络错误');
            }
        } finally {
            if (confirmBtn) {
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        }
    }


}

// Initialize the terminal interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.terminalInterface = new TerminalInterface();
});