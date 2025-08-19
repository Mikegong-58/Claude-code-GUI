const fs = require('fs');
const path = require('path');
const os = require('os');

class ClaudeHistoryScanner {
    constructor() {
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.projectsDir = path.join(this.claudeDir, 'projects');
    }

    // 扫描所有项目目录
    scanProjects() {
        try {
            if (!fs.existsSync(this.projectsDir)) {
                console.log('Claude projects directory not found');
                return [];
            }

            const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            const projects = [];
            
            for (const projectId of projectDirs) {
                const projectPath = path.join(this.projectsDir, projectId);
                const project = this.analyzeProject(projectId, projectPath);
                if (project) {
                    projects.push(project);
                }
            }

            // 按最后消息时间排序（最新的在前）
            projects.sort((a, b) => {
                const timeA = new Date(a.lastMessageTime).getTime();
                const timeB = new Date(b.lastMessageTime).getTime();
                return timeB - timeA; // 降序：最新的在前
            });
            
            return projects;
        } catch (error) {
            console.error('Error scanning projects:', error);
            return [];
        }
    }

    // 分析单个项目
    analyzeProject(projectId, projectPath) {
        try {
            const jsonlFiles = fs.readdirSync(projectPath)
                .filter(file => file.endsWith('.jsonl'))
                .map(file => ({
                    sessionId: path.basename(file, '.jsonl'),
                    filePath: path.join(projectPath, file),
                    stats: fs.statSync(path.join(projectPath, file))
                }));

            if (jsonlFiles.length === 0) {
                return null;
            }

            // 获取项目的真实路径（从第一个JSONL文件中读取）
            const realProjectPath = this.extractProjectPathFromSession(jsonlFiles[0].filePath);
            
            // 分析所有会话
            const sessions = jsonlFiles.map(file => this.analyzeSession(file)).filter(Boolean);
            
            if (sessions.length === 0) {
                return null;
            }

            // 找到最新的会话
            const latestSession = sessions.reduce((latest, current) => 
                new Date(current.lastMessageTime) > new Date(latest.lastMessageTime) ? current : latest
            );

            return {
                id: projectId,
                realPath: realProjectPath || this.decodeProjectPath(projectId),
                sessions: sessions,
                sessionCount: sessions.length,
                title: latestSession.title || path.basename(realProjectPath || projectId),
                lastMessageTime: latestSession.lastMessageTime,
                firstMessage: latestSession.firstMessage
            };
        } catch (error) {
            console.error(`Error analyzing project ${projectId}:`, error);
            return null;
        }
    }

    // 从会话文件中提取项目路径
    extractProjectPathFromSession(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const firstLine = content.split('\n')[0];
            if (firstLine) {
                const json = JSON.parse(firstLine);
                return json.cwd || null;
            }
        } catch (error) {
            // 忽略解析错误
        }
        return null;
    }

    // 解码项目路径（备用方法）
    decodeProjectPath(encoded) {
        return encoded.replace(/-/g, '/');
    }

    // 分析单个会话
    analyzeSession(fileInfo) {
        try {
            const content = fs.readFileSync(fileInfo.filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                return null;
            }

            let firstUserMessage = null;
            let firstUserMessageTime = null;
            let lastMessageTime = fileInfo.stats.mtime;
            let title = null;

            // 遍历所有行找到第一条用户消息
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    
                    // 更新最后消息时间
                    if (entry.timestamp) {
                        const messageTime = new Date(entry.timestamp);
                        if (!isNaN(messageTime.getTime()) && messageTime > lastMessageTime) {
                            lastMessageTime = messageTime;
                        }
                    }

                    // 查找第一条有效的用户消息
                    if (!firstUserMessage && entry.type === 'user' && entry.message) {
                        const content = this.extractMessageContent(entry.message);
                        if (this.isValidUserMessage(content)) {
                            firstUserMessage = content;
                            firstUserMessageTime = entry.timestamp;
                            // 用第一条消息生成标题
                            title = this.generateTitle(content);
                        }
                    }
                } catch (parseError) {
                    // 忽略无法解析的行
                    continue;
                }
            }

            return {
                sessionId: fileInfo.sessionId,
                title: title || 'Untitled',
                firstMessage: firstUserMessage,
                firstMessageTime: firstUserMessageTime,
                lastMessageTime: lastMessageTime,
                messageCount: lines.length,
                createdAt: fileInfo.stats.birthtime || fileInfo.stats.mtime
            };
        } catch (error) {
            console.error(`Error analyzing session ${fileInfo.sessionId}:`, error);
            return null;
        }
    }

    // 提取消息内容
    extractMessageContent(message) {
        if (typeof message === 'string') {
            return message;
        }
        
        if (message && message.role === 'user') {
            if (typeof message.content === 'string') {
                return message.content;
            }
            
            if (Array.isArray(message.content)) {
                // 处理包含文本的content数组
                for (const item of message.content) {
                    if (item.type === 'text' && item.text) {
                        return item.text;
                    }
                }
            }
        }
        
        return null;
    }

    // 检查是否为有效的用户消息
    isValidUserMessage(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // 跳过系统生成的消息
        if (content.includes('Caveat: The messages below were generated by the user while running local commands')) {
            return false;
        }

        // 跳过命令输出
        if (content.startsWith('<command-name>') || content.startsWith('<local-command-stdout>')) {
            return false;
        }

        // 跳过MCP相关的消息（检查是否是MCP调用）
        if (content.includes('"type":"user"') && content.includes('mcp')) {
            return false;
        }

        return true;
    }


    // 生成聊天标题
    generateTitle(content) {
        if (!content) return 'Untitled';
        
        // 清理内容
        const cleaned = content
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // 截取前50个字符作为标题
        if (cleaned.length <= 50) {
            return cleaned;
        }
        
        return cleaned.substring(0, 47) + '...';
    }


    // 获取格式化的聊天历史列表
    getChatHistory() {
        const projects = this.scanProjects();
        const chatHistory = [];

        for (const project of projects) {
            for (const session of project.sessions) {
                chatHistory.push({
                    id: session.sessionId,
                    title: session.title,
                    lastMessage: this.formatTimeAgo(session.lastMessageTime),
                    date: session.lastMessageTime,
                    projectPath: project.realPath,
                    projectId: project.id,
                    firstMessage: session.firstMessage,
                    messageCount: session.messageCount
                });
            }
        }

        return chatHistory.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return timeB - timeA; // 降序：最新的在前
        });
    }

    // 格式化时间显示
    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return `${minutes} minutes ago`;
            }
            return `${hours} hours ago`;
        } else if (days === 1) {
            return '1 day ago';
        } else {
            return `${days} days ago`;
        }
    }
}

module.exports = ClaudeHistoryScanner;

// 如果直接运行此文件，执行测试
if (require.main === module) {
    const scanner = new ClaudeHistoryScanner();
    console.log('Scanning Claude chat history...');
    
    const history = scanner.getChatHistory();
    console.log(`Found ${history.length} chat sessions:`);
    
    history.slice(0, 10).forEach((chat, index) => {
        console.log(`${index + 1}. ${chat.title}`);
        console.log(`   Last message: ${chat.lastMessage}`);
        console.log(`   Project: ${path.basename(chat.projectPath || chat.projectId)}`);
        console.log('');
    });
}