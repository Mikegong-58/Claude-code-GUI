// 聊天历史管理类
class ChatHistoryManager {
    constructor() {
        this.allChats = [];
        this.filteredChats = [];
        this.scanner = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initDeleteModal();
        // 延迟加载聊天历史，等待字体和页面完全加载
        await this.waitForPageAndFontsLoad();
        await this.loadChatHistory();
    }

    async waitForPageAndFontsLoad() {
        // 等待DOM完全加载
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                window.addEventListener('load', resolve);
            });
        }

        // 等待字体加载
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        // 额外等待一点时间确保所有资源加载完成
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    setupEventListeners() {
        // 聊天历史按钮点击
        const chatHistoryBtn = document.getElementById('chat-history-btn');
        if (chatHistoryBtn) {
            chatHistoryBtn.addEventListener('click', () => {
                this.showChatHistory();
            });
        }

        // 返回聊天按钮
        const backBtn = document.getElementById('chat-history-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.hideChatHistory();
            });
        }


    }

    async loadChatHistory() {
        try {
            const history = await this.fetchChatHistory();
            this.allChats = history;
            this.filteredChats = [...this.allChats];
            this.renderChats();
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.showError('Failed to load chat history: ' + error.message);
        }
    }

    async createClaudeScanner() {
        // 在浏览器环境中，所有扫描功能都由后端API提供
        // 这里返回一个简单的对象，实际不会被使用
        return null;
    }

    async fetchChatHistory() {
        try {
            console.log('Fetching chat history from API...');
            const response = await fetch('/api/chat-history');
            console.log('API response status:', response.status);
            
            const result = await response.json();
            console.log('API result:', result);
            
            if (result.success) {
                console.log(`Successfully loaded ${result.data.length} chat sessions`);
                return result.data;
            } else {
                console.error('API returned error:', result.error);
                this.showError(`API Error: ${result.error}`);
                return this.getMockData();
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
            this.showError(`Network Error: ${error.message}`);
            return this.getMockData();
        }
    }

    getMockData() {
        return [
            {
                id: '1',
                title: 'Greeting Exchange',
                lastMessage: '9 days ago',
                projectPath: '/Users/mike/projects/greeting'
            },
            {
                id: '2', 
                title: 'Birthday Wishes for Women',
                lastMessage: '13 days ago',
                projectPath: '/Users/mike/projects/birthday'
            },
            {
                id: '3',
                title: 'Singapore 6-Day Travel Itinerary', 
                lastMessage: '17 days ago',
                projectPath: '/Users/mike/projects/travel'
            },
            {
                id: '4',
                title: 'Python Desktop File Creator',
                lastMessage: '20 days ago',
                projectPath: '/Users/mike/projects/python-scripts'
            },
            {
                id: '5',
                title: 'Untitled',
                lastMessage: '25 days ago',
                projectPath: '/Users/mike/projects/chat-system'
            }
        ];
    }


    renderChats() {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;
        
        if (this.filteredChats.length === 0) {
            chatList.innerHTML = `
                <div class="empty-state">
                    <h3>No chats found</h3>
                    <p>Try adjusting your search terms or start a new chat.</p>
                </div>
            `;
            return;
        }

        // 按日期分组
        const groupedChats = this.groupChatsByDate(this.filteredChats);
        
        chatList.innerHTML = Object.entries(groupedChats).map(([dateGroup, chats]) => `
            <div class="date-group">
                <div class="date-group-header">${dateGroup}</div>
                <div class="date-group-chats">
                    ${chats.map(chat => `
                        <div class="chat-item">
                            <div class="chat-item-content" data-chat-id="${chat.id}">
                                <div class="chat-title">${this.escapeHtml(chat.title)}</div>
                                <div class="chat-meta">Last message ${chat.lastMessage}</div>
                            </div>
                            <button class="chat-item-delete" data-chat-id="${chat.id}" data-chat-title="${this.escapeHtml(chat.title)}" title="删除对话">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        // 添加事件委托
        this.setupChatItemEvents();
    }
    
    setupChatItemEvents() {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;
        
        // 移除之前的事件监听器
        chatList.removeEventListener('click', this.handleChatItemClick);
        
        // 添加事件委托
        this.handleChatItemClick = (e) => {
            const chatContent = e.target.closest('.chat-item-content');
            const deleteButton = e.target.closest('.chat-item-delete');
            
            if (deleteButton) {
                e.stopPropagation();
                e.preventDefault();
                const chatId = deleteButton.getAttribute('data-chat-id');
                // 直接删除，无需确认弹窗
                this.deleteChat(chatId);
                return false;
            } else if (chatContent) {
                const chatId = chatContent.getAttribute('data-chat-id');
                this.openChat(chatId);
            }
        };
        
        chatList.addEventListener('click', this.handleChatItemClick);
    }

    groupChatsByDate(chats) {
        const groups = {};
        
        chats.forEach(chat => {
            const chatDate = new Date(chat.date);
            const month = chatDate.getMonth() + 1; // 月份从0开始，所以+1
            const day = chatDate.getDate();
            const groupKey = `${month}月${day}日`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(chat);
        });
        
        // 排序每个组内的聊天记录（按时间倒序）
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.date) - new Date(a.date));
        });
        
        return groups;
    }

    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }


    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const chatList = document.getElementById('chat-list');
        if (chatList) {
            chatList.innerHTML = `
                <div class="error">
                    <h3>Error</h3>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    showChatHistory() {
        const chatHistoryPage = document.getElementById('chat-history-fullpage');
        const mainContent = document.querySelector('.main-content');
        
        if (chatHistoryPage && mainContent) {
            chatHistoryPage.style.display = 'flex';
            mainContent.style.display = 'none';
            
            // 只在数据为空时才重新加载
            if (this.allChats.length === 0) {
                this.loadChatHistory();
            }
        }
    }

    hideChatHistory() {
        const chatHistoryPage = document.getElementById('chat-history-fullpage');
        const mainContent = document.querySelector('.main-content');
        
        if (chatHistoryPage && mainContent) {
            chatHistoryPage.style.display = 'none';
            mainContent.style.display = 'flex';
        }
    }

    startNewChat() {
        // 清除当前显示的对话ID
        window.currentDisplayedChatId = null;
        
        // 隐藏聊天历史页面并开始新对话
        this.hideChatHistory();
        
        // 清空当前聊天内容
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            // 清除除了thinking display之外的所有消息
            const thinkingDisplay = chatContainer.querySelector('.claude-thinking-display');
            chatContainer.innerHTML = '';
            if (thinkingDisplay) {
                chatContainer.appendChild(thinkingDisplay);
            }
        }
        
        // 清空输入框
        const commandInput = document.getElementById('command-input');
        if (commandInput) {
            commandInput.value = '';
            commandInput.focus();
        }

        console.log('Started new chat');
    }

    // 重新打开当前对话（用于实时更新）
    async reopenCurrentChat(chatId) {
        console.log(`Reopening current chat: ${chatId}`);
        
        try {
            // 获取会话的完整消息
            const response = await fetch(`/api/chat-session/${chatId}/messages`);
            const result = await response.json();
            
            if (result.success) {
                console.log(`Reloaded ${result.data.messages.length} messages for chat ${chatId}`);
                
                // 清空当前聊天容器
                this.clearCurrentChat();
                
                // 渲染历史消息
                this.renderChatMessages(result.data.messages);
                
                console.log('Current chat content updated successfully');
            } else {
                throw new Error(result.error || '无法重新加载对话');
            }
        } catch (error) {
            console.error('Error reopening current chat:', error);
            throw error;
        }
    }

    async openChat(chatId) {
        console.log(`Opening chat: ${chatId}`);
        
        try {
            // 设置当前显示的对话ID
            window.currentDisplayedChatId = chatId;
            
            // 隐藏聊天历史页面
            this.hideChatHistory();
            
            // 显示加载状态
            this.showLoadingState();
            
            // 获取会话的完整消息
            const response = await fetch(`/api/chat-session/${chatId}/messages`);
            const result = await response.json();
            
            if (result.success) {
                console.log(`Loaded ${result.data.messages.length} messages for chat ${chatId}`);
                
                // 清空当前聊天容器
                this.clearCurrentChat();
                
                // 渲染历史消息
                this.renderChatMessages(result.data.messages);
                
                // 滚动到顶部
                this.scrollToTop();
                
            } else {
                console.error('Failed to load chat messages:', result.error);
                this.showCustomAlert(`Failed to load chat: ${result.error}`);
            }
            
        } catch (error) {
            console.error('Error opening chat:', error);
            this.showCustomAlert(`Error opening chat: ${error.message}`);
        }
    }
    
    showLoadingState() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.innerHTML = `
                <div class="loading-chat">
                    <div class="loading-spinner"></div>
                    <p>Loading chat history...</p>
                </div>
            `;
        }
    }
    
    clearCurrentChat() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            // 保留thinking display，清除其他内容
            const thinkingDisplay = chatContainer.querySelector('.claude-thinking-display');
            chatContainer.innerHTML = '';
            if (thinkingDisplay) {
                chatContainer.appendChild(thinkingDisplay);
            }
        }
        
        // 同时清理可能的其他状态
        if (window.claudeChat) {
            // 重置Claude Chat的内部状态
            window.claudeChat.currentConversation = null;
            window.claudeChat.currentResponseArea = null;
        }
        
        // 隐藏todo面板（如果有的话）
        const todoPanel = document.getElementById('todo-panel');
        if (todoPanel) {
            todoPanel.style.display = 'none';
        }
    }
    
    renderChatMessages(messages) {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;
        
        // 使用script.js中的消息处理逻辑
        if (window.messageHandler) {
            for (const message of messages) {
                window.messageHandler.processHistoricalMessage(message);
            }
        }
    }
    
    
    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        }
    }

    scrollToTop() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            setTimeout(() => {
                chatContainer.scrollTop = 0;
            }, 100);
        }
    }
    
    showDeleteConfirmation(chatId, chatTitle) {
        // 检查是否应该显示警告
        const dontShowWarning = localStorage.getItem('dontShowDeleteWarning') === 'true';
        
        if (dontShowWarning) {
            // 直接删除，不显示警告
            this.deleteChat(chatId);
            return;
        }
        
        // 显示删除确认对话框
        const modal = document.getElementById('chat-delete-modal');
        if (modal) {
            this.currentDeleteChatId = chatId;
            this.currentDeleteChatTitle = chatTitle;
            
            // 重置复选框状态
            const checkbox = document.getElementById('dont-show-delete-warning');
            if (checkbox) {
                checkbox.checked = false;
            }
            
            // 确保弹窗立即显示
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            
            // 强制重绘
            modal.offsetHeight;
        }
    }

    async deleteChat(chatId) {
        try {
            // 发送删除请求到服务器
            const response = await fetch('/api/delete-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ chatId: chatId })
            });

            const result = await response.json();
            
            if (result.success) {
                // 从本地数组中移除聊天记录
                this.allChats = this.allChats.filter(chat => chat.id !== chatId);
                this.filteredChats = this.filteredChats.filter(chat => chat.id !== chatId);
                
                // 重新渲染
                this.renderChats();
                
                // 如果当前显示的就是被删除的聊天，清空显示
                if (window.currentDisplayedChatId === chatId) {
                    this.startNewChat();
                }
                
                // 已删除，无需提示
            } else {
                this.showCustomAlert('删除失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('删除聊天失败:', error);
            this.showCustomAlert('删除失败: 网络错误');
        }
    }

    initDeleteModal() {
        // 关闭按钮
        const closeBtn = document.getElementById('chat-delete-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideDeleteModal();
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('chat-delete-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideDeleteModal();
            });
        }

        // 确认删除按钮
        const confirmBtn = document.getElementById('chat-delete-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmDelete();
            });
        }

        // 点击外部关闭
        const modal = document.getElementById('chat-delete-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideDeleteModal();
                }
            });
        }
    }

    hideDeleteModal() {
        const modal = document.getElementById('chat-delete-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentDeleteChatId = null;
        this.currentDeleteChatTitle = null;
    }

    confirmDelete() {
        // 检查是否选择了"不再显示警告"
        const checkbox = document.getElementById('dont-show-delete-warning');
        if (checkbox && checkbox.checked) {
            localStorage.setItem('dontShowDeleteWarning', 'true');
        }

        // 执行删除
        if (this.currentDeleteChatId) {
            this.deleteChat(this.currentDeleteChatId);
        }

        // 隐藏模态框
        this.hideDeleteModal();
    }

    showCustomAlert(message) {
        // 创建自定义弹窗
        const alertOverlay = document.createElement('div');
        alertOverlay.className = 'custom-alert-overlay';
        alertOverlay.innerHTML = `
            <div class="custom-alert">
                <div class="custom-alert-content">
                    <p>${this.escapeHtml(message)}</p>
                    <button class="custom-alert-btn" onclick="this.closest('.custom-alert-overlay').remove()">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(alertOverlay);
        
        // 自动关闭
        setTimeout(() => {
            if (alertOverlay.parentNode) {
                alertOverlay.remove();
            }
        }, 5000);
    }
}

// 全局函数，供HTML调用
function selectChats() {
    if (window.chatHistoryManager) {
        window.chatHistoryManager.showCustomAlert('Select multiple chats functionality...');
    }
}

// 初始化聊天历史管理器
let chatHistoryManager;

document.addEventListener('DOMContentLoaded', () => {
    chatHistoryManager = new ChatHistoryManager();
    window.chatHistoryManager = chatHistoryManager; // 暴露到全局
});

// 导出给Node.js环境使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatHistoryManager;
}