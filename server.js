const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const chokidar = require('chokidar');
const ClaudeHistoryScanner = require('./public/claude-history-scanner');

const app = express();
const port = 8080;

// 全局工作目录追踪
let currentWorkingDirectory = process.cwd();

// 创建聊天历史扫描器实例
const chatHistoryScanner = new ClaudeHistoryScanner();

// 获取当前工作目录的函数
function getCurrentWorkingDirectory() {
    return currentWorkingDirectory;
}

// 设置工作目录的函数
function setCurrentWorkingDirectory(dir) {
    currentWorkingDirectory = dir;
    process.chdir(dir);
}

// CLAUDE.md file handling functions
function handleClaudeMdRead(ws, filePath) {
    try {
        // 确保目录存在
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 如果文件不存在，创建空文件
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '', 'utf8');
        }
        
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        
        const response = {
            type: 'claude_md_response',
            data: {
                action: 'read',
                success: true,
                content: content
            }
        };
        
        ws.send(JSON.stringify(response));
    } catch (error) {
        console.error('❌ Error reading CLAUDE.md file:', error);
        ws.send(JSON.stringify({
            type: 'claude_md_response',
            data: {
                action: 'read',
                success: false,
                error: error.message
            }
        }));
    }
}

function handleClaudeMdWrite(ws, filePath, content) {
    try {
        // 确保目录存在
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 写入文件内容
        fs.writeFileSync(filePath, content, 'utf8');
        
        ws.send(JSON.stringify({
            type: 'claude_md_response',
            data: {
                action: 'write',
                success: true
            }
        }));
    } catch (error) {
        console.error('Error writing CLAUDE.md file:', error);
        ws.send(JSON.stringify({
            type: 'claude_md_response',
            data: {
                action: 'write',
                success: false,
                error: error.message
            }
        }));
    }
}

// Middleware for parsing JSON
app.use(express.json());

// Serve static files from public directory with no-cache headers
app.use(express.static('public', {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve static files from assests directory
app.use('/assests', express.static('assests', {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// API endpoint to set working directory
app.post('/api/set-working-directory', (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        const { path: folderPath } = req.body;
        
        if (!folderPath) {
            return res.status(400).json({ success: false, error: 'Path is required' });
        }
        
        const fs = require('fs');
        
        // Check if directory exists
        if (!fs.existsSync(folderPath)) {
            return res.status(404).json({ success: false, error: 'Directory does not exist' });
        }
        
        // Check if it's actually a directory
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ success: false, error: 'Path is not a directory' });
        }
        
        // Change working directory using our tracking function
        const absolutePath = path.resolve(folderPath);
        setCurrentWorkingDirectory(absolutePath);
        
        
        res.json({ 
            success: true, 
            path: absolutePath,
            message: 'Working directory changed successfully'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to change working directory'
        });
    }
});

// API endpoint to get current working directory
app.get('/api/current-directory', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        const currentDir = getCurrentWorkingDirectory();
        
        res.json({
            success: true,
            currentDirectory: currentDir,
            message: 'Current working directory retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get current directory'
        });
    }
});

// API endpoint to list files in directory
app.post('/api/list-files', (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        const { path: dirPath } = req.body;
        
        if (!dirPath) {
            return res.status(400).json({ success: false, error: 'Path is required' });
        }
        
        const fs = require('fs');
        
        // Check if directory exists
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ success: false, error: 'Directory does not exist' });
        }
        
        // Check if it's actually a directory
        const stats = fs.statSync(dirPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ success: false, error: 'Path is not a directory' });
        }
        
        // Read directory contents
        const items = fs.readdirSync(dirPath);
        
        // Get file information
        const files = items.map(item => {
            const fullPath = path.join(dirPath, item);
            const itemStats = fs.statSync(fullPath);
            
            return {
                name: item,
                path: fullPath,
                isDirectory: itemStats.isDirectory(),
                size: itemStats.size,
                modified: itemStats.mtime
            };
        });
        
        // Sort: directories first, then files, both alphabetically
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        
        res.json({ 
            success: true, 
            files: files,
            count: files.length
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to list files'
        });
    }
});

// API endpoint to execute MCP installation
app.post('/api/execute-mcp-install', (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        const { mcpType } = req.body;
        
        // MCP配置映射 - 使用完整的命令
        const mcpConfigs = {
            context7: {
                command: 'claude mcp add --transport http context7 https://mcp.context7.com/mcp'
            },
            atlassian: {
                command: 'claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse'
            },
            notion: {
                command: 'claude mcp add --transport http notion https://mcp.notion.com/mcp'
            },
            playwright: {
                command: 'claude mcp add -s user playwright npx @playwright/mcp@latest'
            }
        };
        
        // 默认使用context7如果没有指定类型
        const targetMcp = mcpType || 'context7';
        const config = mcpConfigs[targetMcp];
        
        if (!config) {
            return res.status(400).json({
                success: false,
                error: `Unsupported MCP type: ${targetMcp}`
            });
        }
        
        
        // 解析完整命令
        const commandParts = config.command.split(' ');
        const command = commandParts[0]; // 'claude'
        const args = commandParts.slice(1); // 其余参数
        
        
        const mcpProcess = spawn(command, args, {
            cwd: getCurrentWorkingDirectory(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { 
                ...process.env,
                PATH: process.env.PATH
            }
        });
        
        let output = '';
        let errorOutput = '';
        let responseTimeout;
        
        mcpProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
        });
        
        mcpProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });
        
        mcpProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            
            // 判断安装是否成功 - 更宽松的成功检测
            const isSuccess = code === 0 || 
                            output.toLowerCase().includes('successfully') || 
                            output.toLowerCase().includes('added') ||
                            output.toLowerCase().includes('installed') ||
                            (code === 0 && errorOutput.includes('already configured'));
            
            if (isSuccess) {
                res.json({
                    success: true,
                    output: output,
                    errorOutput: errorOutput,
                    exitCode: code,
                    mcpType: targetMcp,
                    message: `${targetMcp} MCP installation completed successfully`
                });
            } else {
                res.json({
                    success: false,
                    error: `Installation failed with exit code ${code}`,
                    output: output,
                    errorOutput: errorOutput,
                    exitCode: code,
                    mcpType: targetMcp
                });
            }
        });
        
        mcpProcess.on('error', (error) => {
            clearTimeout(responseTimeout);
            console.error('💥 Process spawn error:', error);
            
            // 检查是否是claude命令不存在的错误
            if (error.code === 'ENOENT') {
                res.status(500).json({
                    success: false,
                    error: 'Claude CLI not found. Please install Claude CLI first.',
                    details: 'Run: npm install -g @anthropic-ai/claude-cli',
                    mcpType: targetMcp
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: `Failed to start installation process: ${error.message}`,
                    details: error.toString(),
                    mcpType: targetMcp
                });
            }
        });
        
        // 设置超时处理
        responseTimeout = setTimeout(() => {
            if (!mcpProcess.killed) {
                mcpProcess.kill('SIGTERM');
                
                // 给一些时间让进程优雅关闭
                setTimeout(() => {
                    if (!mcpProcess.killed) {
                        mcpProcess.kill('SIGKILL');
                    }
                }, 2000);
                
                res.json({
                    success: false,
                    error: `Installation process timed out after 45 seconds`,
                    output: output,
                    errorOutput: errorOutput,
                    mcpType: targetMcp
                });
            }
        }, 45000); // 增加到45秒，给更多时间下载和安装
        
    } catch (error) {
        console.error('💥 API endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute MCP installation',
            details: error.toString()
        });
    }
});

// API endpoint to execute MCP removal
app.post('/api/execute-mcp-remove', (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        const { mcpType } = req.body;
        
        if (!mcpType) {
            return res.status(400).json({
                success: false,
                error: 'MCP type is required'
            });
        }
        
        
        // Use 'claude mcp remove' command
        const command = 'claude';
        const args = ['mcp', 'remove', mcpType];
        
        
        const mcpProcess = spawn(command, args, {
            cwd: getCurrentWorkingDirectory(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { 
                ...process.env,
                PATH: process.env.PATH
            }
        });
        
        let output = '';
        let errorOutput = '';
        let responseTimeout;
        
        mcpProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
        });
        
        mcpProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });
        
        mcpProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            
            // 判断删除是否成功
            const isSuccess = code === 0 || 
                output.toLowerCase().includes('removed') || 
                output.toLowerCase().includes('deleted') ||
                output.toLowerCase().includes('success');
            
            if (isSuccess) {
                res.json({
                    success: true,
                    output: output,
                    errorOutput: errorOutput,
                    message: `${mcpType} MCP removed successfully`,
                    exitCode: code,
                    mcpType: mcpType
                });
            } else {
                res.json({
                    success: false,
                    error: errorOutput || output || `Failed to remove ${mcpType} MCP`,
                    output: output,
                    errorOutput: errorOutput,
                    exitCode: code,
                    mcpType: mcpType
                });
            }
        });
        
        mcpProcess.on('error', (error) => {
            clearTimeout(responseTimeout);
            console.error('💥 Removal process spawn error:', error);
            
            // 检查是否是claude命令不存在的错误
            if (error.code === 'ENOENT') {
                res.json({
                    success: false,
                    error: 'Claude CLI not found. Please install Claude CLI first.',
                    details: 'Run: npm install -g @anthropic-ai/claude-cli',
                    mcpType: mcpType
                });
            } else {
                res.json({
                    success: false,
                    error: `Failed to start removal process: ${error.message}`,
                    details: error.toString(),
                    mcpType: mcpType
                });
            }
        });
        
        // 设置超时处理
        responseTimeout = setTimeout(() => {
            if (!mcpProcess.killed) {
                mcpProcess.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!mcpProcess.killed) {
                        mcpProcess.kill('SIGKILL');
                    }
                }, 2000);
                
                res.json({
                    success: false,
                    error: `Removal process timed out after 30 seconds`,
                    output: output,
                    errorOutput: errorOutput,
                    mcpType: mcpType
                });
            }
        }, 30000); // 30秒超时
        
    } catch (error) {
        console.error('💥 MCP removal API endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute MCP removal',
            details: error.toString()
        });
    }
});

// 直接读取配置文件检测MCP的函数
function readMcpConfigFiles() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    let configData = {};
    const homeDir = os.homedir();
    
    // 检查可能的配置文件位置
    const configPaths = [
        path.join(homeDir, '.claude.json'),
        path.join(homeDir, '.claude', 'settings.json')
    ];
    
    for (const configPath of configPaths) {
        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(content);
                
                // 合并配置数据
                configData = { ...configData, ...config };
            }
        } catch (error) {
            console.error('📋 读取配置文件失败:', configPath, error.message);
        }
    }
    
    return configData;
}

// 从配置数据中提取MCP服务器
function extractMcpServersFromConfig(configData) {
    const mcpServers = [];
    const currentDir = getCurrentWorkingDirectory();
    
    try {
        // 检查全局MCP服务器
        if (configData.mcpServers && typeof configData.mcpServers === 'object') {
            Object.keys(configData.mcpServers).forEach(serverName => {
                mcpServers.push(serverName.toLowerCase());
            });
        }
        
        // 检查项目特定的MCP服务器
        if (configData.projects && typeof configData.projects === 'object') {
            // 检查当前项目目录
            const currentProject = configData.projects[currentDir];
            if (currentProject && currentProject.mcpServers) {
                Object.keys(currentProject.mcpServers).forEach(serverName => {
                    const serverKey = serverName.toLowerCase();
                    if (!mcpServers.includes(serverKey)) {
                        mcpServers.push(serverKey);
                    }
                });
            }
            
            // 也检查其他项目的MCP服务器（可选）
            Object.keys(configData.projects).forEach(projectPath => {
                const project = configData.projects[projectPath];
                if (project && project.mcpServers) {
                    Object.keys(project.mcpServers).forEach(serverName => {
                        const serverKey = serverName.toLowerCase();
                        if (!mcpServers.includes(serverKey)) {
                            mcpServers.push(serverKey);
                        }
                    });
                }
            });
        }
        
    } catch (error) {
        console.error('📋 解析配置数据失败:', error.message);
    }
    
    return mcpServers;
}

// 运行时检测方法 - 检查Claude CLI的配置
function detectMcpRuntime() {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        
        // 执行 claude --help 查看是否有mcp相关选项
        const claudeProcess = spawn('claude', ['--help'], {
            cwd: getCurrentWorkingDirectory(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        claudeProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        claudeProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        claudeProcess.on('close', (code) => {
            const hasMcpSupport = output.includes('mcp') || output.includes('--mcp-config');
            resolve({
                hasMcpSupport,
                output,
                errorOutput,
                exitCode: code
            });
        });
        
        claudeProcess.on('error', (error) => {
            console.error('📋 Claude CLI检测失败:', error.message);
            resolve({
                hasMcpSupport: false,
                error: error.message
            });
        });
        
        // 5秒超时
        setTimeout(() => {
            if (!claudeProcess.killed) {
                claudeProcess.kill();
                resolve({
                    hasMcpSupport: false,
                    error: 'Timeout'
                });
            }
        }, 5000);
    });
}

// Claude CLI检测方法（作为Promise）
function detectMcpViaCli() {
    return new Promise((resolve) => {
        console.log('🔧 开始执行MCP检测CLI命令');
        const { spawn } = require('child_process');
        const mcpListProcess = spawn('claude', ['mcp', 'list'], {
            cwd: getCurrentWorkingDirectory(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { 
                ...process.env,
                PATH: process.env.PATH
            }
        });
        
        let output = '';
        let errorOutput = '';
        let responseTimeout;
        
        mcpListProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
        });
        
        mcpListProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });
        
        mcpListProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            console.log(`🔧 MCP检测CLI命令完成，退出码: ${code}`);
            
            // Parse the output to extract installed MCP servers and their authentication status
            const installedMcps = [];
            const unauthenticatedMcps = [];
            const mcpLines = [];
            
            if (code === 0 && output) {
                // MCP检测成功，不显示详细日志
                
                // Parse the output lines to find MCP servers
                const lines = output.split('\n').filter(line => line.trim());
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmedLine = line.trim();
                    
                    if (trimmedLine && !trimmedLine.includes('No MCP servers') && trimmedLine.includes(':')) {
                        
                        // Extract server name from format: "server-name: url/command - status"
                        const match = trimmedLine.match(/^([^:]+):/);
                        if (match) {
                            const serverName = match[1].trim().toLowerCase();
                            
                            // Check if the line contains authentication status - more comprehensive check
                            const needsAuth = trimmedLine.toLowerCase().includes('needs authentication') || 
                                             trimmedLine.toLowerCase().includes('authentication required') ||
                                             trimmedLine.toLowerCase().includes('not authenticated') ||
                                             trimmedLine.includes('⚠ Needs authentication') ||
                                             trimmedLine.includes('⚠️ Needs authentication') ||
                                             /⚠\s*Needs authentication/i.test(trimmedLine) ||
                                             /⚠️\s*Needs authentication/i.test(trimmedLine) ||
                                             /⚠.*needs authentication/i.test(trimmedLine) ||
                                             (trimmedLine.includes('⚠') && trimmedLine.toLowerCase().includes('needs authentication')) ||
                                             /- ⚠ Needs authentication/i.test(trimmedLine);
                            
                            mcpLines.push({
                                line: trimmedLine,
                                serverName: serverName,
                                needsAuth: needsAuth,
                                containsWarning: trimmedLine.includes('⚠'),
                                containsNeedsAuth: trimmedLine.toLowerCase().includes('needs authentication')
                            });
                            
                            // Always add the detected server name
                            if (serverName && !installedMcps.includes(serverName)) {
                                installedMcps.push(serverName);
                                
                                // Track unauthenticated servers
                                if (needsAuth) {
                                    unauthenticatedMcps.push(serverName);
                                }
                            } else {
                            }
                        } else {
                        }
                    } else {
                    }
                }
                
                // 显示检测到的MCP服务器
                if (installedMcps.length > 0) {
                    console.log(`🔧 检测到 ${installedMcps.length} 个MCP服务器: ${installedMcps.join(', ')}`);
                    if (unauthenticatedMcps.length > 0) {
                        console.log(`⚠️ 需要认证的MCP服务器: ${unauthenticatedMcps.join(', ')}`);
                    }
                }
                
            } else {
                // MCP检测失败，不显示详细日志
            }
            
            resolve({
                success: code === 0 || installedMcps.length > 0,
                servers: installedMcps,
                unauthenticatedServers: unauthenticatedMcps,
                output: output,
                errorOutput: errorOutput,
                exitCode: code
            });
        });
        
        mcpListProcess.on('error', (error) => {
            clearTimeout(responseTimeout);
            console.error('💥 MCP list process error:', error);
            
            const errorMessage = error.code === 'ENOENT' ? 
                'Claude CLI not found' : 
                `Failed to check MCP status: ${error.message}`;
                
            resolve({
                success: false,
                servers: [],
                error: errorMessage,
                details: error.toString()
            });
        });
        
        // Set timeout handler
        responseTimeout = setTimeout(() => {
            if (!mcpListProcess.killed) {
                mcpListProcess.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!mcpListProcess.killed) {
                        mcpListProcess.kill('SIGKILL');
                    }
                }, 2000);
                
                resolve({
                    success: false,
                    servers: [],
                    error: 'MCP status check timed out',
                    output: output,
                    errorOutput: errorOutput
                });
            }
        }, 5000); // 5 seconds timeout - 提高检测速度
    });
}

// API endpoint to detect installed MCP servers using Claude CLI
app.get('/api/mcp-status', async (req, res) => {
    try {
        console.log('🔍 收到MCP状态检测请求');
        // 处理MCP状态请求
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        
        // 只使用Claude CLI命令检测方法
        const cliResult = await detectMcpViaCli();
        
        
        res.json({
            success: cliResult.success,
            installedMcps: cliResult.servers || [],
            unauthenticatedMcps: cliResult.unauthenticatedServers || [],
            detectionMethod: 'cli',
            output: cliResult.output,
            errorOutput: cliResult.errorOutput,
            exitCode: cliResult.exitCode,
            error: cliResult.error,
            workingDirectory: getCurrentWorkingDirectory(),
            message: cliResult.success ? 
                `检测到 ${(cliResult.servers || []).length} 个MCP服务器` : 
                '未发现MCP服务器或检测失败'
        });
        
    } catch (error) {
        console.error('💥 MCP status API endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'MCP detection failed',
            installedMcps: [],
            workingDirectory: getCurrentWorkingDirectory(),
            details: error.toString()
        });
    }
});

// API endpoint to execute custom MCP commands
app.post('/api/execute-custom-mcp', (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        const { command } = req.body;
        
        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid command provided'
            });
        }
        
        // Parse the command
        const commandParts = command.trim().split(/\s+/);
        const execCommand = commandParts[0];
        const args = commandParts.slice(1);
        
        
        const customProcess = spawn(execCommand, args, {
            cwd: getCurrentWorkingDirectory(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { 
                ...process.env,
                PATH: process.env.PATH
            },
            shell: true // Enable shell execution for more complex commands
        });
        
        let output = '';
        let errorOutput = '';
        let responseTimeout;
        
        customProcess.stdout.on('data', (data) => {
            const dataStr = data.toString();
            output += dataStr;
        });
        
        customProcess.stderr.on('data', (data) => {
            const dataStr = data.toString();
            errorOutput += dataStr;
        });
        
        customProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            
            
            const success = code === 0;
            
            res.json({
                success: success,
                output: output,
                errorOutput: errorOutput,
                exitCode: code,
                command: command
            });
        });
        
        customProcess.on('error', (error) => {
            clearTimeout(responseTimeout);
            console.error('💥 Custom command process error:', error);
            
            if (!res.headersSent) {
                res.json({
                    success: false,
                    error: `Failed to execute command: ${error.message}`,
                    details: error.toString(),
                    command: command
                });
            }
        });
        
        // Set timeout handler (5 minutes for custom commands)
        responseTimeout = setTimeout(() => {
            if (!customProcess.killed) {
                customProcess.kill('SIGTERM');
                
                // Give some time for graceful shutdown
                setTimeout(() => {
                    if (!customProcess.killed) {
                        customProcess.kill('SIGKILL');
                    }
                }, 2000);
                
                res.json({
                    success: false,
                    error: `Command execution timed out after 5 minutes`,
                    output: output,
                    errorOutput: errorOutput,
                    command: command
                });
            }
        }, 300000); // 5 minutes timeout
        
    } catch (error) {
        console.error('💥 Custom MCP API endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute custom MCP command',
            details: error.toString()
        });
    }
});


app.post('/api/get-user-home-path', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const userHomeDir = os.homedir();
        const claudeFilePath = path.join(userHomeDir, '.claude', 'CLAUDE.md');
        
        res.json({ 
            success: true, 
            userHomeDir: userHomeDir,
            claudeFilePath: claudeFilePath
        });
    } catch (error) {
        console.error('Error getting user home path:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/get-current-working-directory', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const workingDirectory = getCurrentWorkingDirectory();
        
        res.json({ 
            success: true, 
            workingDirectory: workingDirectory
        });
    } catch (error) {
        console.error('Error getting current working directory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 测试文件监听的API端点
app.post('/api/test-file-watch', (req, res) => {
    console.log('📁 手动测试文件监听...');
    
    // 手动发送文件变化通知
    let notifiedClients = 0;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'chat-history-changed',
                filePath: '/test/manual-trigger.jsonl',
                timestamp: Date.now()
            }));
            notifiedClients++;
        }
    });
    
    console.log(`📡 手动通知了 ${notifiedClients} 个客户端`);
    res.json({ success: true, notifiedClients });
});

// Create server
const server = app.listen(port, () => {
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// 文件监听功能 - 监听Claude对话文件变化
const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
if (fs.existsSync(claudeProjectsDir)) {
    // 更宽松的监听配置
    const watcher = chokidar.watch(claudeProjectsDir, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: false, // 先不忽略初始扫描，看看有什么文件
        depth: 3, // 增加监听深度
        usePolling: true, // 使用轮询模式
        interval: 500, // 更频繁的轮询
        binaryInterval: 500,
        atomic: false, // 不等待写入完成
        awaitWriteFinish: false // 不等待写入完成
    });
    
    watcher.on('change', (filePath) => {
        console.log(`📁 文件变化检测: ${filePath}`);
        if (filePath.endsWith('.jsonl')) {
            console.log(`📁 对话文件已更新: ${filePath}`);
            
            // 通知所有连接的WebSocket客户端
            let notifiedClients = 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'chat-history-changed',
                        filePath: filePath,
                        timestamp: Date.now()
                    }));
                    notifiedClients++;
                }
            });
            console.log(`📡 已通知 ${notifiedClients} 个客户端`);
        }
    });
    
    watcher.on('add', (filePath) => {
        console.log(`📁 新文件检测: ${filePath}`);
        if (filePath.endsWith('.jsonl')) {
            console.log(`📁 新对话文件创建: ${filePath}`);
            
            // 通知所有连接的WebSocket客户端
            let notifiedClients = 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'chat-history-changed',
                        filePath: filePath,
                        timestamp: Date.now()
                    }));
                    notifiedClients++;
                }
            });
            console.log(`📡 已通知 ${notifiedClients} 个客户端`);
        }
    });
    
    // 添加通用监听事件来调试
    watcher.on('all', (eventName, filePath) => {
        console.log(`📁 监听事件: ${eventName} -> ${filePath}`);
    });
    
    watcher.on('ready', () => {
        console.log(`📁 文件监听器已就绪`);
    });
    
    watcher.on('error', (error) => {
        console.error(`❌ 文件监听错误:`, error);
    });
    
    console.log(`📁 已启用文件监听: ${claudeProjectsDir}`);
    
    // 列出目录内容进行调试
    try {
        const dirs = fs.readdirSync(claudeProjectsDir);
        console.log(`📁 监听目录内容 (${dirs.length} 项):`, dirs.slice(0, 5));
        if (dirs.length > 5) console.log(`📁 还有 ${dirs.length - 5} 个目录...`);
        
        // 显示一些具体的.jsonl文件路径用于调试
        for (const dir of dirs.slice(0, 3)) {
            const dirPath = path.join(claudeProjectsDir, dir);
            try {
                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
                if (files.length > 0) {
                    console.log(`📁 ${dir} 目录中的.jsonl文件:`, files.slice(0, 2));
                }
            } catch (err) {
                // 忽略非目录项
            }
        }
    } catch (error) {
        console.error(`❌ 无法读取监听目录:`, error);
    }
    
    // 备选方案：定期检查文件修改时间（每10秒）
    const fileModTimes = new Map();
    
    const checkFileChanges = () => {
        try {
            const dirs = fs.readdirSync(claudeProjectsDir);
            for (const dir of dirs) {
                const dirPath = path.join(claudeProjectsDir, dir);
                try {
                    const files = fs.readdirSync(dirPath);
                    for (const file of files) {
                        if (file.endsWith('.jsonl')) {
                            const filePath = path.join(dirPath, file);
                            const stats = fs.statSync(filePath);
                            const currentMTime = stats.mtime.getTime();
                            const lastMTime = fileModTimes.get(filePath);
                            
                            if (lastMTime && currentMTime > lastMTime) {
                                
                                // 通知客户端
                                let notifiedClients = 0;
                                wss.clients.forEach(client => {
                                    if (client.readyState === WebSocket.OPEN) {
                                        client.send(JSON.stringify({
                                            type: 'chat-history-changed',
                                            filePath: filePath,
                                            timestamp: Date.now()
                                        }));
                                        notifiedClients++;
                                    }
                                });
                                console.log(`📡 已通知 ${notifiedClients} 个客户端`);
                            }
                            
                            fileModTimes.set(filePath, currentMTime);
                        }
                    }
                } catch (err) {
                    // 忽略读取错误
                }
            }
        } catch (error) {
            // 忽略整体错误
        }
    };
    
    // 初始化文件修改时间
    checkFileChanges();
    
    // 每10秒检查一次文件变化
    setInterval(checkFileChanges, 10000);
    console.log(`⏰ 已启用定期文件检查 (10秒间隔)`);
} else {
    console.log(`📁 Claude项目目录不存在: ${claudeProjectsDir}`);
}

// 持久化Claude会话管理
let persistentSessions = new Map(); // sessionId -> { process, ws }


// 生成UUID格式的会话ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}







// 为客户端创建或获取持久化Claude会话
function getOrCreatePersistentSession(ws, sessionId = null) {
    // 如果有现有会话ID，尝试恢复
    if (sessionId && persistentSessions.has(sessionId)) {
        const session = persistentSessions.get(sessionId);
        // 更新WebSocket连接
        session.ws = ws;
        return { sessionId, isNew: false };
    }
    
    // 如果提供了sessionId（历史会话），使用该ID创建新会话来恢复历史对话
    const newSessionId = sessionId || generateUUID();
    
    const session = {
        sessionId: newSessionId,
        realSessionId: sessionId, // 历史会话ID，用于--resume参数
        ws: ws,
        process: null,
        isActive: !!sessionId // 如果是历史会话，标记为active以使用--resume
    };
    
    persistentSessions.set(newSessionId, session);
    return { sessionId: newSessionId, isNew: true };
}

// 向持久化会话发送命令
function sendCommandToPersistentSession(sessionId, command, ws) {
    const session = persistentSessions.get(sessionId);
    if (!session) {
        return;
    }
    
    // 更新WebSocket连接
    session.ws = ws;
    
    
    // 构建Claude CLI参数
    const args = [
        '--print', command,
        '--output-format', 'stream-json',
        '--verbose',
        '--model', 'sonnet'
    ];
    
    // 如果这不是第一个命令，添加resume参数（使用真实的Claude session ID）
    if (session.isActive && session.realSessionId) {
        args.push('--resume', session.realSessionId);
    }
    
    // 添加权限模式处理 - 使用bypassPermissions模式，跳过所有权限提示
    args.push('--permission-mode', 'bypassPermissions');
    
    
    const claudeProcess = spawn('claude', args, {
        cwd: getCurrentWorkingDirectory(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
    });
    
    session.process = claudeProcess;
    
    // 处理Claude标准输出（流式JSON响应）
    claudeProcess.stdout.on('data', (data) => {
        const rawOutput = data.toString();
        
        // 输出原始响应以便调试
        
        const lines = rawOutput.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            try {
                const response = JSON.parse(line);
                
                // 输出解析后的JSON结构（服务器端完整日志）
                console.log('📥 Claude JSON Response:', JSON.stringify(response, null, 2));
                
                // 捕获会话ID（用于后续resume）
                if (response.session_id && !session.isActive) {
                    // 更新为Claude CLI返回的真实session ID
                    session.realSessionId = response.session_id;
                    session.isActive = true;
                    
                    // 通知客户端会话已创建
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'session-created',
                            sessionId: response.session_id,
                            internalSessionId: sessionId
                        }));
                    }
                }
                
                // 创建过滤后的响应副本，移除result部分但保留其他字段
                const filteredResponse = { ...response };
                if (filteredResponse.result) {
                    delete filteredResponse.result;
                }
                
                
                if (ws.readyState === WebSocket.OPEN) {
                    const responseData = {
                        type: 'claude-response',
                        data: filteredResponse  // 发送过滤后的数据
                    };
                    
                    const responseString = JSON.stringify(responseData);
                    
                    // Send response directly without chunking
                    ws.send(responseString);
                } else {
                }
            } catch (parseError) {
                // 如果不是JSON，检查是否包含文件创建相关内容
                if (line.includes('File created') || line.includes('file created') || 
                    line.includes('<div class="point">') || line.includes('html')) {
                    // 跳过用户内容，不发送到客户端
                    return; // 直接跳过，不发送任何内容
                } else {
                    // 跳过所有非结构化的文本输出，只保留JSON格式的响应
                    return;
                }
            }
        }
    });
    
    // 处理标准错误
    claudeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'claude-error',
                error: error
            }));
        }
    });
    
    // 处理进程完成
    claudeProcess.on('close', (code) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'claude-complete',
                exitCode: code,
                sessionId: sessionId
            }));
        }
        
        // 进程结束但会话仍然保持（可以resume）
        session.process = null;
    });
    
    // 处理进程错误
    claudeProcess.on('error', (error) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'claude-error',
                error: error.message
            }));
        }
        session.process = null;
    });
    
    // 关闭stdin（因为使用--print模式）
    claudeProcess.stdin.end();
    
    return claudeProcess;
}

// API endpoints for rules management
app.get('/api/load-user-rules', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const userRulesPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
        
        // Create directory if it doesn't exist
        const dir = path.dirname(userRulesPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create file if it doesn't exist
        if (!fs.existsSync(userRulesPath)) {
            fs.writeFileSync(userRulesPath, '', 'utf8');
        }
        
        const content = fs.readFileSync(userRulesPath, 'utf8');
        const rules = content.split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.trim().substring(1).trim())
            .filter(rule => rule.length > 0);
        
        res.json({ success: true, rules });
    } catch (error) {
        console.error('Error loading user rules:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/load-project-rules', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const projectRulesPath = path.join(getCurrentWorkingDirectory(), 'CLAUDE.md');
        
        // Create file if it doesn't exist
        if (!fs.existsSync(projectRulesPath)) {
            fs.writeFileSync(projectRulesPath, '', 'utf8');
        }
        
        const content = fs.readFileSync(projectRulesPath, 'utf8');
        
        // 只解析Project Notes部分的内容
        const lines = content.split('\n');
        let inProjectNotes = false;
        let rules = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 检查是否进入Project Notes部分
            if (trimmedLine === '## Project Notes') {
                inProjectNotes = true;
                continue;
            }
            
            // 检查是否离开Project Notes部分（遇到其他##标题）
            if (trimmedLine.startsWith('## ') && trimmedLine !== '## Project Notes') {
                inProjectNotes = false;
                continue;
            }
            
            // 如果在Project Notes部分且是规则行，则添加
            if (inProjectNotes && trimmedLine.startsWith('-')) {
                const rule = trimmedLine.substring(1).trim();
                if (rule.length > 0) {
                    rules.push(rule);
                }
            }
        }
        
        res.json({ success: true, rules });
    } catch (error) {
        console.error('Error loading project rules:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/add-user-rule', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const { rule } = req.body;
        if (!rule || !rule.trim()) {
            return res.json({ success: false, error: 'Rule cannot be empty' });
        }
        
        const userRulesPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
        
        // Create directory if it doesn't exist
        const dir = path.dirname(userRulesPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create file if it doesn't exist
        if (!fs.existsSync(userRulesPath)) {
            fs.writeFileSync(userRulesPath, '', 'utf8');
        }
        
        const content = fs.readFileSync(userRulesPath, 'utf8');
        const newContent = content.trim() + (content.trim() ? '\n' : '') + `- ${rule.trim()}\n`;
        fs.writeFileSync(userRulesPath, newContent, 'utf8');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding user rule:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/add-project-rule', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const { rule } = req.body;
        if (!rule || !rule.trim()) {
            return res.json({ success: false, error: 'Rule cannot be empty' });
        }
        
        const projectRulesPath = path.join(getCurrentWorkingDirectory(), 'CLAUDE.md');
        
        // Create file if it doesn't exist
        if (!fs.existsSync(projectRulesPath)) {
            fs.writeFileSync(projectRulesPath, '', 'utf8');
        }
        
        let content = fs.readFileSync(projectRulesPath, 'utf8');
        
        // 查找或创建Project Notes部分
        if (!content.includes('## Project Notes')) {
            // 如果没有Project Notes部分，创建一个
            content = content.trim() + (content.trim() ? '\n\n' : '') + '## Project Notes\n';
        }
        
        const lines = content.split('\n');
        let newLines = [];
        let inProjectNotes = false;
        let projectNotesEnd = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            newLines.push(line);
            
            if (trimmedLine === '## Project Notes') {
                inProjectNotes = true;
                continue;
            }
            
            if (inProjectNotes && trimmedLine.startsWith('## ') && trimmedLine !== '## Project Notes') {
                // 找到Project Notes部分的结束位置
                projectNotesEnd = i;
                break;
            }
        }
        
        // 在Project Notes部分末尾添加新规则
        if (projectNotesEnd === -1) {
            // Project Notes是最后一部分
            newLines.push(`- ${rule.trim()}`);
        } else {
            // 在Project Notes部分末尾插入新规则
            newLines.splice(projectNotesEnd, 0, `- ${rule.trim()}`);
        }
        
        const newContent = newLines.join('\n') + '\n';
        fs.writeFileSync(projectRulesPath, newContent, 'utf8');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding project rule:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/delete-user-rule', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const { index } = req.body;
        if (typeof index !== 'number' || index < 0) {
            return res.json({ success: false, error: 'Invalid rule index' });
        }
        
        const userRulesPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
        
        if (!fs.existsSync(userRulesPath)) {
            return res.json({ success: false, error: 'Rules file not found' });
        }
        
        const content = fs.readFileSync(userRulesPath, 'utf8');
        const lines = content.split('\n');
        const ruleLines = lines.filter(line => line.trim().startsWith('-'));
        
        if (index >= ruleLines.length) {
            return res.json({ success: false, error: 'Rule index out of range' });
        }
        
        // Remove the specific rule line
        const ruleToRemove = ruleLines[index];
        const ruleIndex = lines.indexOf(ruleToRemove);
        lines.splice(ruleIndex, 1);
        
        const newContent = lines.join('\n');
        fs.writeFileSync(userRulesPath, newContent, 'utf8');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user rule:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/delete-project-rule', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        
        const { index } = req.body;
        if (typeof index !== 'number' || index < 0) {
            return res.json({ success: false, error: 'Invalid rule index' });
        }
        
        const projectRulesPath = path.join(getCurrentWorkingDirectory(), 'CLAUDE.md');
        
        if (!fs.existsSync(projectRulesPath)) {
            return res.json({ success: false, error: 'Rules file not found' });
        }
        
        const content = fs.readFileSync(projectRulesPath, 'utf8');
        const lines = content.split('\n');
        const ruleLines = lines.filter(line => line.trim().startsWith('-'));
        
        if (index >= ruleLines.length) {
            return res.json({ success: false, error: 'Rule index out of range' });
        }
        
        // Remove the specific rule line
        const ruleToRemove = ruleLines[index];
        const ruleIndex = lines.indexOf(ruleToRemove);
        lines.splice(ruleIndex, 1);
        
        const newContent = lines.join('\n');
        fs.writeFileSync(projectRulesPath, newContent, 'utf8');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project rule:', error);
        res.json({ success: false, error: error.message });
    }
});


// Test API endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API is working' });
});

// Token statistics API
app.get('/api/scan-tokens', (req, res) => {
    try {
        const projectsPath = path.join(os.homedir(), '.claude', 'projects');
        
        if (!fs.existsSync(projectsPath)) {
            return res.json({ success: false, error: 'Projects directory not found' });
        }
        
        // console.log(`📂 扫描路径: ${projectsPath}`);
        
        // 递归获取所有 .jsonl 文件
        function getAllJsonlFiles(dir) {
            let jsonlFiles = [];
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // 递归扫描子文件夹
                    jsonlFiles = jsonlFiles.concat(getAllJsonlFiles(fullPath));
                } else if (item.endsWith('.jsonl')) {
                    jsonlFiles.push(fullPath);
                }
            }
            
            return jsonlFiles;
        }
        
        const files = getAllJsonlFiles(projectsPath);
        
        // 添加调试信息
        // console.log(`📁 扫描路径: ${projectsPath}`);
        // console.log(`📄 找到文件数量: ${files.length}`);
        // if (files.length > 0) {
        //     console.log(`📝 文件示例: ${files.slice(0, 3).map(f => f.replace(projectsPath, '...')).join(', ')}`);
        //     if (files.length > 3) {
        //         console.log(`   ... 还有 ${files.length - 3} 个文件`);
        //     }
        // }
        
        // 分析每日使用情况
        const sharedProcessedHashes = new Set();
        const dailyUsage = analyzeDailyUsage(files, sharedProcessedHashes);
        
        res.json({ 
            success: true, 
            files: files,
            dailyUsage: dailyUsage
        });
    } catch (error) {
        console.error('Error scanning token files:', error);
        res.json({ success: false, error: error.message });
    }
});

// Helper function to get earliest timestamp from a file (optimized)
const getEarliestTimestamp = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let earliestTimestamp = null;
        
        // 只检查前3行来最大化性能
        const linesToCheck = Math.min(lines.length, 3);
        for (let i = 0; i < linesToCheck; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const jsonData = JSON.parse(line);
                if (jsonData.timestamp) {
                    return jsonData.timestamp; // 立即返回第一个找到的时间戳
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        return earliestTimestamp;
    } catch (e) {
        return null;
    }
};

// Process multiple files in parallel with batching for efficiency
app.post('/api/process-token-files-parallel', (req, res) => {
    try {
        const { filePaths, batchSize = 100 } = req.body;
        console.log(`🚀 开始并行处理 ${filePaths?.length || 0} 个文件，批大小: ${batchSize}`);
        
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            console.log('❌ 文件路径数组为空或无效');
            return res.json({ success: false, error: 'File paths array is required' });
        }
        
        // 全局去重：跨所有文件的去重状态
        const globalProcessedHashes = new Set();
        
        // 按文件的最早时间戳排序，确保处理顺序的一致性（参考claudia-main设计）
        const sortedFilePaths = [...filePaths].sort((a, b) => {
            const timestampA = getEarliestTimestamp(a);
            const timestampB = getEarliestTimestamp(b);
            
            if (!timestampA && !timestampB) return 0;
            if (!timestampA) return 1;
            if (!timestampB) return -1;
            return timestampA.localeCompare(timestampB);
        });
        
        // 移除初始化日志以提升速度
        
        // Function to process a single file with global deduplication
        const processFile = async (filePath, fileIndex) => {
            try {
                if (!fs.existsSync(filePath)) {
                    return { 
                        success: false, 
                        fileName: path.basename(filePath),
                        error: 'File not found' 
                    };
                }
                
                const stats = fs.statSync(filePath);
                const fileSize = stats.size;
                
                // Skip very large files (>100MB) to prevent memory issues
                if (fileSize > 100 * 1024 * 1024) {
                    return {
                        success: false,
                        fileName: path.basename(filePath),
                        error: 'File too large (>100MB)'
                    };
                }
                
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                let totalOutputTokens = 0;
                let totalInputTokens = 0;
                let totalCacheCreationTokens = 0;
                let totalCacheReadTokens = 0;
                let validLines = 0;
                let duplicateCount = 0;
                let totalLinesProcessed = lines.length;
                
                // 局部hash集合，用于单文件内的统计（不用于去重，仅用于统计）
                const processedHashes = new Set();
                
                // 不显示单个文件处理进度，只在最后汇总
                
                for (const line of lines) {
                    try {
                        // 尝试解析JSON来提取去重标识符
                        const jsonData = JSON.parse(line);
                        
                        // 改进的去重策略：主要使用message.id + request_id组合（参考claudia-main）
                        let primaryHash = null;
                        
                        // 策略1：最强的去重 - message.id + request_id 组合
                        if (jsonData.message && jsonData.message.id && jsonData.request_id) {
                            primaryHash = `msg_req:${jsonData.message.id}:${jsonData.request_id}`;
                        }
                        // 策略2：message.id 作为备用
                        else if (jsonData.message && jsonData.message.id) {
                            primaryHash = `msg:${jsonData.message.id}`;
                        }
                        // 策略3：request_id 作为备用
                        else if (jsonData.request_id) {
                            primaryHash = `req:${jsonData.request_id}`;
                        }
                        
                        // 检查是否已在全局范围内处理过此记录
                        if (primaryHash && globalProcessedHashes.has(primaryHash)) {
                            duplicateCount++;
                            continue; // 跳过重复记录
                        }
                        
                        // 如果有主哈希，将其添加到全局集合和局部统计集合
                        if (primaryHash) {
                            globalProcessedHashes.add(primaryHash);
                            processedHashes.add(primaryHash); // 用于统计
                        }
                        
                        // 验证是否有意义的token使用记录（完全参考claudia-main逻辑）
                        if (jsonData.message && jsonData.message.usage) {
                            const usage = jsonData.message.usage;
                            // 使用与claudia-main完全一致的逻辑：unwrap_or(0)
                            const inputTokens = (usage.input_tokens || 0);
                            const outputTokens = (usage.output_tokens || 0);
                            const cacheCreationTokens = (usage.cache_creation_input_tokens || 0);
                            const cacheReadTokens = (usage.cache_read_input_tokens || 0);
                            
                            if (inputTokens == 0 && outputTokens == 0 && cacheCreationTokens == 0 && cacheReadTokens == 0) {
                                continue; // 跳过没有意义的token记录（完全参考claudia-main逻辑）
                            }
                        } else {
                            // 如果没有 usage 数据，也跳过
                            continue;
                        }
                        
                        // 准确的token提取逻辑（完全参考claudia-main的unwrap_or(0)逻辑）
                        if (jsonData.message && jsonData.message.usage) {
                            const usage = jsonData.message.usage;
                            
                            // 使用与claudia-main完全一致的提取逻辑
                            const inputTokens = (usage.input_tokens || 0);
                            const outputTokens = (usage.output_tokens || 0);
                            const cacheCreationTokens = (usage.cache_creation_input_tokens || 0);
                            const cacheReadTokens = (usage.cache_read_input_tokens || 0);
                            
                            // 累加所有token数量（与claudia-main逻辑一致）
                            totalInputTokens += inputTokens;
                            totalOutputTokens += outputTokens;
                            totalCacheCreationTokens += cacheCreationTokens;
                            totalCacheReadTokens += cacheReadTokens;
                            
                            validLines++;
                        }
                        
                    } catch (parseError) {
                        // 如果JSON解析失败，回退到正则表达式方法（无法进行强查重）
                        let hasValidTokens = false;
                        const regexTokenCounts = { output: 0, input: 0, cache_creation: 0, cache_read: 0 };
                        
                        // 基于整行内容的简单查重（正则表达式模式）
                        const lineHash = crypto.createHash('md5').update(line.trim()).digest('hex').substring(0, 12);
                        const regexHash = `regex:${lineHash}`;
                        
                        if (processedHashes.has(regexHash)) {
                            duplicateCount++;
                            continue;
                        }
                        processedHashes.add(regexHash);
                        
                        // 提取 output_tokens
                        const outputMatch = line.match(/"output_tokens":\s*(\d+)/);
                        if (outputMatch) {
                            const tokens = parseInt(outputMatch[1]);
                            if (!isNaN(tokens) && tokens > 0) {
                                regexTokenCounts.output = tokens;
                                totalOutputTokens += tokens;
                                hasValidTokens = true;
                            }
                        }
                        
                        // 提取 input_tokens (确保不是cache相关的)
                        const inputMatch = line.match(/"input_tokens":\s*(\d+)/);
                        if (inputMatch && !line.includes('cache_read_input_tokens') && !line.includes('cache_creation_input_tokens')) {
                            const tokens = parseInt(inputMatch[1]);
                            if (!isNaN(tokens) && tokens > 0) {
                                regexTokenCounts.input = tokens;
                                totalInputTokens += tokens;
                                hasValidTokens = true;
                            }
                        }
                        
                        // 提取 cache_creation_input_tokens
                        const cacheCreationMatch = line.match(/"cache_creation_input_tokens":\s*(\d+)/);
                        if (cacheCreationMatch) {
                            const tokens = parseInt(cacheCreationMatch[1]);
                            if (!isNaN(tokens) && tokens > 0) {
                                regexTokenCounts.cache_creation = tokens;
                                totalCacheCreationTokens += tokens;
                                hasValidTokens = true;
                            }
                        }
                        
                        // 提取 cache_read_input_tokens
                        const cacheReadMatch = line.match(/"cache_read_input_tokens":\s*(\d+)/);
                        if (cacheReadMatch) {
                            const tokens = parseInt(cacheReadMatch[1]);
                            if (!isNaN(tokens) && tokens > 0) {
                                regexTokenCounts.cache_read = tokens;
                                totalCacheReadTokens += tokens;
                                hasValidTokens = true;
                            }
                        }
                        
                        // 如果有任何有效的token数据，计入有效行数
                        if (hasValidTokens) {
                            validLines++;
                        }
                    }
                }
                
                // 计算总hash数量用于调试
                const totalHashesProcessed = processedHashes.size;
                const duplicateRate = totalLinesProcessed > 0 ? (duplicateCount / totalLinesProcessed * 100).toFixed(2) : 0;
                
                // 不显示单个文件统计
                
                return { 
                    success: true, 
                    outputTokens: totalOutputTokens,
                    inputTokens: totalInputTokens,
                    cacheCreationTokens: totalCacheCreationTokens,
                    cacheReadTokens: totalCacheReadTokens,
                    fileName: path.basename(filePath),
                    filePath: filePath,
                    fileSize: fileSize,
                    validLines: validLines,
                    duplicatesSkipped: duplicateCount,
                    totalLinesProcessed: totalLinesProcessed,
                    duplicateRate: parseFloat(duplicateRate),
                    totalHashesUsed: totalHashesProcessed,
                    processingStats: {
                        totalLines: totalLinesProcessed,
                        validLines: validLines,
                        duplicates: duplicateCount,
                        duplicatePercentage: parseFloat(duplicateRate),
                        uniqueHashes: totalHashesProcessed
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    fileName: path.basename(filePath),
                    error: error.message
                };
            }
        };
        
        // Function to process files in batches
        const processBatch = async (batch, startIndex) => {
            const promises = batch.map((filePath, batchIndex) => 
                processFile(filePath, startIndex + batchIndex)
            );
            return Promise.all(promises);
        };
        
        // Split sorted files into batches
        const batches = [];
        for (let i = 0; i < sortedFilePaths.length; i += batchSize) {
            batches.push({
                files: sortedFilePaths.slice(i, i + batchSize),
                startIndex: i
            });
        }
        
        // Process all batches in parallel for maximum speed
        const processBatches = async () => {
            // Process all batches simultaneously
            const batchPromises = batches.map(batchInfo => 
                processBatch(batchInfo.files, batchInfo.startIndex)
            );
            
            const batchResults = await Promise.all(batchPromises);
            const allResults = batchResults.flat();
            
            // console.log(`✅ 并行处理完成: ${sortedFilePaths.length} 个文件, 全局去重: ${globalProcessedHashes.size}`);
            
            return allResults;
        };
        
        processBatches().then(results => {
            const globalStats = {
                totalFilesProcessed: sortedFilePaths.length,
                globalHashesUsed: globalProcessedHashes.size,
                totalDuplicatesSkipped: results.reduce((sum, r) => sum + (r.duplicatesSkipped || 0), 0),
                filesOrderedByTimestamp: true,
                deduplicationStrategy: 'global_cross_file'
            };
            
            console.log(`✅ 并行处理完成: ${sortedFilePaths.length} 个文件, ${batches.length} 个批次`);
            
            res.json({ 
                success: true, 
                results: results,
                totalFiles: sortedFilePaths.length,
                batchSize: batchSize,
                batchesProcessed: batches.length,
                globalStats: globalStats
            });
        }).catch(error => {
            console.error('❌ 并行处理失败:', error);
            res.json({ success: false, error: error.message });
        });
        
    } catch (error) {
        console.error('Error processing token files in parallel:', error);
        res.json({ success: false, error: error.message });
    }
});

// Keep the single file processing endpoint for backward compatibility
app.post('/api/process-token-file', (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!fs.existsSync(filePath)) {
            return res.json({ success: false, error: 'File not found' });
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        let totalOutputTokens = 0;
        let totalInputTokens = 0;
        let totalCacheCreationTokens = 0;
        let totalCacheReadTokens = 0;
        let validLines = 0;
        let duplicateCount = 0;
        let totalLinesProcessed = lines.length;
        
        // 改进的去重机制：使用简化策略（与并行处理保持一致）
        const processedHashes = new Set();
        // 不显示单文件处理日志
        
        for (const line of lines) {
            try {
                // 尝试解析JSON来提取去重标识符
                const jsonData = JSON.parse(line);
                
                // 简化的去重策略：主要使用message.id + request_id组合（参考claudia-main）
                let primaryHash = null;
                
                // 策略1：最强的去重 - message.id + request_id 组合
                if (jsonData.message && jsonData.message.id && jsonData.request_id) {
                    primaryHash = `msg_req:${jsonData.message.id}:${jsonData.request_id}`;
                }
                // 策略2：message.id 作为备用
                else if (jsonData.message && jsonData.message.id) {
                    primaryHash = `msg:${jsonData.message.id}`;
                }
                // 策略3：request_id 作为备用
                else if (jsonData.request_id) {
                    primaryHash = `req:${jsonData.request_id}`;
                }
                
                // 检查是否已处理过此记录
                if (primaryHash && processedHashes.has(primaryHash)) {
                    duplicateCount++;
                    continue; // 跳过重复记录
                }
                
                // 如果有主哈希，将其添加到集合
                if (primaryHash) {
                    processedHashes.add(primaryHash);
                }
                
                // 验证是否有意义的token使用记录（完全参考claudia-main逻辑）
                if (jsonData.message && jsonData.message.usage) {
                    const usage = jsonData.message.usage;
                    // 使用与claudia-main完全一致的逻辑：unwrap_or(0)
                    const inputTokens = (usage.input_tokens || 0);
                    const outputTokens = (usage.output_tokens || 0);
                    const cacheCreationTokens = (usage.cache_creation_input_tokens || 0);
                    const cacheReadTokens = (usage.cache_read_input_tokens || 0);
                    
                    if (inputTokens == 0 && outputTokens == 0 && cacheCreationTokens == 0 && cacheReadTokens == 0) {
                        continue; // 跳过没有意义的token记录（完全参考claudia-main逻辑）
                    }
                } else {
                    // 如果没有 usage 数据，也跳过
                    continue;
                }
                
                // 准确的token提取逻辑（完全参考claudia-main的unwrap_or(0)逻辑）
                if (jsonData.message && jsonData.message.usage) {
                    const usage = jsonData.message.usage;
                    
                    // 使用与claudia-main完全一致的提取逻辑
                    const inputTokens = (usage.input_tokens || 0);
                    const outputTokens = (usage.output_tokens || 0);
                    const cacheCreationTokens = (usage.cache_creation_input_tokens || 0);
                    const cacheReadTokens = (usage.cache_read_input_tokens || 0);
                    
                    // 累加所有token数量（与claudia-main逻辑一致）
                    totalInputTokens += inputTokens;
                    totalOutputTokens += outputTokens;
                    totalCacheCreationTokens += cacheCreationTokens;
                    totalCacheReadTokens += cacheReadTokens;
                    
                    validLines++;
                }
                
            } catch (parseError) {
                // 如果JSON解析失败，回退到正则表达式方法（但无法去重）
                let hasValidTokens = false;
                
                const outputMatch = line.match(/"output_tokens":(\d+)/);
                if (outputMatch) {
                    const tokens = parseInt(outputMatch[1]);
                    totalOutputTokens += tokens;
                    hasValidTokens = true;
                }
                
                // 提取 input_tokens (正则表达式方式)
                const inputMatch = line.match(/"input_tokens":(\d+)/);
                if (inputMatch && !line.includes('cache_read_input_tokens') && !line.includes('cache_creation_input_tokens')) {
                    const tokens = parseInt(inputMatch[1]);
                    totalInputTokens += tokens;
                    hasValidTokens = true;
                }
                
                // 提取 cache_creation_input_tokens (正则表达式方式)
                const cacheCreationMatch = line.match(/"cache_creation_input_tokens":(\d+)/);
                if (cacheCreationMatch) {
                    const tokens = parseInt(cacheCreationMatch[1]);
                    totalCacheCreationTokens += tokens;
                    hasValidTokens = true;
                }
                
                // 提取 cache_read_input_tokens (正则表达式方式)
                const cacheReadMatch = line.match(/"cache_read_input_tokens":(\d+)/);
                if (cacheReadMatch) {
                    const tokens = parseInt(cacheReadMatch[1]);
                    totalCacheReadTokens += tokens;
                    hasValidTokens = true;
                }
                
                // 如果有任何有效的token数据，计入有效行数
                if (hasValidTokens) {
                    validLines++;
                }
            }
        }
        
        // 添加详细统计信息（与并行处理函数保持一致）
        const totalHashesProcessed = processedHashes.size;
        const duplicateRate = totalLinesProcessed > 0 ? (duplicateCount / totalLinesProcessed * 100).toFixed(2) : 0;
        
        // 只返回数据，不显示日志
        
        res.json({ 
            success: true, 
            outputTokens: totalOutputTokens,
            inputTokens: totalInputTokens,
            cacheCreationTokens: totalCacheCreationTokens,
            cacheReadTokens: totalCacheReadTokens,
            fileName: path.basename(filePath),
            validLines: validLines,
            duplicatesSkipped: duplicateCount,
            totalLinesProcessed: totalLinesProcessed,
            duplicateRate: parseFloat(duplicateRate),
            totalHashesUsed: totalHashesProcessed,
            processingStats: {
                totalLines: totalLinesProcessed,
                validLines: validLines,
                duplicates: duplicateCount,
                duplicatePercentage: parseFloat(duplicateRate),
                uniqueHashes: totalHashesProcessed
            }
        });
    } catch (error) {
        console.error('Error processing token file:', error);
        res.json({ success: false, error: error.message });
    }
});

// 分析每日token使用情况
function analyzeDailyUsage(files, sharedProcessedHashes = null) {
    const dailyStats = {};
    const processedHashes = sharedProcessedHashes || new Set();
    let totalRecords = 0;
    let duplicateRecords = 0;
    
    for (const filePath of files) {
        try {
            if (!fs.existsSync(filePath)) continue;
            
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const jsonData = JSON.parse(line);
                    totalRecords++;
                    
                    // 检查是否有timestamp
                    if (!jsonData.timestamp) continue;
                    
                    // 检查是否有有效的token使用数据
                    if (!jsonData.message || !jsonData.message.usage) continue;
                    
                    const usage = jsonData.message.usage;
                    const inputTokens = (usage.input_tokens || 0);
                    const outputTokens = (usage.output_tokens || 0);
                    const cacheCreationTokens = (usage.cache_creation_input_tokens || 0);
                    const cacheReadTokens = (usage.cache_read_input_tokens || 0);
                    
                    // 跳过没有意义的token记录
                    if (inputTokens == 0 && outputTokens == 0 && cacheCreationTokens == 0 && cacheReadTokens == 0) {
                        continue;
                    }
                    
                    // 使用与并行处理相同的去重策略：message.id + request_id 组合
                    let primaryHash = null;
                    
                    // 策略1：最强的去重 - message.id + request_id 组合
                    if (jsonData.message && jsonData.message.id && jsonData.request_id) {
                        primaryHash = `msg_req:${jsonData.message.id}:${jsonData.request_id}`;
                    } 
                    // 策略2：次选 - 仅使用message.id
                    else if (jsonData.message && jsonData.message.id) {
                        primaryHash = `msg:${jsonData.message.id}`;
                    }
                    // 策略3：备选 - timestamp + usage 哈希
                    else if (jsonData.timestamp) {
                        const dataForHash = {
                            timestamp: jsonData.timestamp,
                            usage: usage
                        };
                        primaryHash = crypto.createHash('sha256').update(JSON.stringify(dataForHash)).digest('hex');
                    }
                    
                    // 检查是否已处理过此记录
                    if (primaryHash && processedHashes.has(primaryHash)) {
                        duplicateRecords++;
                        continue;
                    }
                    
                    // 添加到已处理集合
                    if (primaryHash) {
                        processedHashes.add(primaryHash);
                    }
                    
                    // 提取日期（YYYY-MM-DD格式）
                    // timestamp格式: 2025-08-12T04:55:50.971Z
                    // 使用本地时区而不是UTC来确保日期正确
                    const dateObj = new Date(jsonData.timestamp);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const date = `${year}-${month}-${day}`;
                    
                    if (!dailyStats[date]) {
                        dailyStats[date] = {
                            input: 0,
                            output: 0,
                            cache: 0,
                            total: 0
                        };
                    }
                    
                    dailyStats[date].input += inputTokens;
                    dailyStats[date].output += outputTokens;
                    dailyStats[date].cache += cacheCreationTokens + cacheReadTokens;
                    dailyStats[date].total += inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
                    
                } catch (parseError) {
                    // 忽略无法解析的行
                    continue;
                }
            }
        } catch (fileError) {
            console.error(`Error reading file ${filePath}:`, fileError);
            continue;
        }
    }
    
    // 添加调试信息
    const totalDays = Object.keys(dailyStats).length;
    const dateRange = Object.keys(dailyStats).sort();
    
    // console.log(`📈 每日统计分析结果:`);
    // console.log(`📊 总记录数: ${totalRecords}`);
    // console.log(`🔄 重复记录: ${duplicateRecords}`);
    // console.log(`✅有记录: ${totalRecords - duplicateRecords}`);
    // console.log(`📅 统计天数: ${totalDays}`);
    // if (dateRange.length > 0) {
    //     console.log(`📆 日期范围: ${dateRange[0]} 到 ${dateRange[dateRange.length - 1]}`);
    // }
    
    return dailyStats;
}


wss.on('connection', (ws) => {
    
    let clientSessionId = null;

    // WebSocket消息处理器
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            
            if (msg.type === 'input') {
                const command = msg.data.trim();
                
                if (command) {
                    // 如果还没有会话，创建一个新的持久化会话
                    if (!clientSessionId) {
                        const sessionInfo = getOrCreatePersistentSession(ws);
                        clientSessionId = sessionInfo.sessionId;
                    }
                    
                    // 向持久化会话发送命令
                    sendCommandToPersistentSession(clientSessionId, command, ws);
                }
            } else if (msg.type === 'resume_session') {
                // 客户端请求恢复特定会话
                const requestedSessionId = msg.sessionId;
                if (requestedSessionId) {
                    clientSessionId = requestedSessionId;
                    // 总是创建或获取会话，即使它在内存中不存在
                    const sessionInfo = getOrCreatePersistentSession(ws, requestedSessionId);
                    
                    ws.send(JSON.stringify({
                        type: 'session-resumed',
                        sessionId: clientSessionId
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'claude-error',
                        error: '请求的会话ID无效'
                    }));
                }
            } else if (msg.type === 'get_status') {
                // 发送当前状态到客户端
                ws.send(JSON.stringify({
                    type: 'status',
                    mode: 'claude',
                    sessionActive: true,
                    sessionId: clientSessionId,
                    message: 'Claude CLI持久化会话准备就绪'
                }));
            } else if (msg.type === 'claude_md_read') {
                // 读取CLAUDE.md文件
                handleClaudeMdRead(ws, msg.filePath);
            } else if (msg.type === 'claude_md_write') {
                // 写入CLAUDE.md文件
                handleClaudeMdWrite(ws, msg.filePath, msg.content);
            } else if (msg.type === 'list_sessions') {
                // 返回所有可用的会话ID
                const availableSessions = Array.from(persistentSessions.keys());
                ws.send(JSON.stringify({
                    type: 'sessions_list',
                    sessions: availableSessions,
                    currentSession: clientSessionId
                }));
            } else if (msg.type === 'stop_generation') {
                // 处理停止生成请求
                if (clientSessionId) {
                    const session = persistentSessions.get(clientSessionId);
                    if (session && session.process && !session.process.killed) {
                        console.log('🛑 收到停止生成请求，终止当前命令');
                        
                        // 发送Ctrl+C信号来停止当前命令
                        try {
                            session.process.kill('SIGINT');
                        } catch (error) {
                            console.error('停止命令失败:', error);
                            // 如果SIGINT失败，尝试SIGTERM
                            try {
                                session.process.kill('SIGTERM');
                            } catch (termError) {
                                console.error('强制终止命令失败:', termError);
                            }
                        }
                        
                        // 发送停止确认消息
                        ws.send(JSON.stringify({
                            type: 'generation_stopped',
                            message: '生成已停止'
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error processing WebSocket message:', error);
            console.error('❌ Raw message:', message.toString());
        }
    });

    // 处理WebSocket关闭
    ws.on('close', () => {
        // 注意：不终止Claude会话，保持持久化
        if (clientSessionId) {
            const session = persistentSessions.get(clientSessionId);
            if (session && session.process && !session.process.killed) {
                // 可以选择保持进程运行或终止当前命令
            }
        }
    });

    // 不发送初始欢迎消息，保持界面简洁
    
    // 发送初始状态（不包含消息文字）
    ws.send(JSON.stringify({
        type: 'status',
        mode: 'claude',
        sessionActive: true
    }));
});

// 聊天历史API端点

// 获取聊天历史
app.get('/api/chat-history', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        const history = chatHistoryScanner.getChatHistory();
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
app.get('/api/chat-projects', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        const projects = chatHistoryScanner.scanProjects();
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
app.get('/api/chat-session/:sessionId', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        const { sessionId } = req.params;
        const projects = chatHistoryScanner.scanProjects();
        
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

// 获取完整的会话内容
app.get('/api/chat-session/:sessionId/messages', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        const { sessionId } = req.params;
        
        // 找到会话文件
        const projects = chatHistoryScanner.scanProjects();
        let sessionFilePath = null;
        
        for (const project of projects) {
            const session = project.sessions.find(s => s.sessionId === sessionId);
            if (session) {
                sessionFilePath = path.join(chatHistoryScanner.projectsDir, project.id, `${sessionId}.jsonl`);
                break;
            }
        }
        
        if (!sessionFilePath || !fs.existsSync(sessionFilePath)) {
            return res.status(404).json({
                success: false,
                error: 'Session file not found'
            });
        }
        
        // 读取并解析JSONL文件
        const content = fs.readFileSync(sessionFilePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const messages = [];
        
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'user' || entry.type === 'assistant') {
                    messages.push(entry);
                }
            } catch (parseError) {
                // 跳过无法解析的行
                continue;
            }
        }
        
        res.json({
            success: true,
            data: {
                sessionId: sessionId,
                messages: messages,
                totalMessages: messages.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching session messages:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 删除聊天记录
app.post('/api/delete-chat', (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) {
            return res.status(400).json({
                success: false,
                error: '缺少chatId参数'
            });
        }
        
        // 查找并删除对应的聊天文件
        const projects = chatHistoryScanner.scanProjects();
        let sessionFilePath = null;
        
        for (const project of projects) {
            const session = project.sessions.find(s => s.sessionId === chatId);
            if (session) {
                sessionFilePath = path.join(chatHistoryScanner.projectsDir, project.id, `${chatId}.jsonl`);
                break;
            }
        }
        
        if (sessionFilePath && fs.existsSync(sessionFilePath)) {
            fs.unlinkSync(sessionFilePath);
            console.log(`已删除聊天文件: ${sessionFilePath}`);
        } else {
            console.log(`聊天文件不存在或未找到: ${sessionFilePath || chatId}`);
        }
        
        res.json({
            success: true,
            message: '聊天记录已删除'
        });
        
    } catch (error) {
        console.error('删除聊天记录失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 处理服务器关闭
process.on('SIGINT', () => {
    
    server.close(() => {
        process.exit(0);
    });
});