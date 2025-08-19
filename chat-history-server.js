const express = require('express');
const path = require('path');
const ClaudeHistoryScanner = require('./claude-history-scanner');

const app = express();
const port = 3001;

// 创建扫描器实例
const scanner = new ClaudeHistoryScanner();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API路由

// 获取聊天历史
app.get('/api/chat-history', (req, res) => {
    try {
        const history = scanner.getChatHistory();
        res.json({
            success: true,
            data: history,
            total: history.length
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// 获取项目详情
app.get('/api/projects', (req, res) => {
    try {
        const projects = scanner.scanProjects();
        res.json({
            success: true,
            data: projects,
            total: projects.length
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取特定会话的详细信息
app.get('/api/session/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const projects = scanner.scanProjects();
        
        let foundSession = null;
        let foundProject = null;

        for (const project of projects) {
            const session = project.sessions.find(s => s.sessionId === sessionId);
            if (session) {
                foundSession = session;
                foundProject = project;
                break;
            }
        }

        if (!foundSession) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            data: {
                session: foundSession,
                project: {
                    id: foundProject.id,
                    title: foundProject.title,
                    realPath: foundProject.realPath
                }
            }
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat-history.html'));
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        scanner: {
            claudeDir: scanner.claudeDir,
            projectsDir: scanner.projectsDir
        }
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found'
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Chat History Server running at http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log('  GET /                    - Chat history UI');
    console.log('  GET /api/chat-history    - Get all chat history');
    console.log('  GET /api/search?q=query  - Search chats');
    console.log('  GET /api/projects        - Get all projects');
    console.log('  GET /api/session/:id     - Get session details');
    console.log('  GET /health              - Health check');
    
    // 测试扫描功能
    console.log('\nTesting scanner...');
    try {
        const history = scanner.getChatHistory();
        console.log(`Found ${history.length} chat sessions`);
        
        if (history.length > 0) {
            console.log('Latest chats:');
            history.slice(0, 3).forEach((chat, index) => {
                console.log(`  ${index + 1}. ${chat.title} (${chat.lastMessage})`);
            });
        }
    } catch (error) {
        console.log('Scanner test failed:', error.message);
    }
});

module.exports = app;