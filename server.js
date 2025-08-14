const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
const port = 8080;

// 全局工作目录追踪
let currentWorkingDirectory = process.cwd();

// 获取当前工作目录的函数
function getCurrentWorkingDirectory() {
    return currentWorkingDirectory;
}

// 设置工作目录的函数
function setCurrentWorkingDirectory(dir) {
    currentWorkingDirectory = dir;
    process.chdir(dir);
    console.log('📂 工作目录已更改为:', dir);
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
        
        console.log(`📦 Starting ${targetMcp} MCP installation...`);
        console.log('📂 Working directory:', getCurrentWorkingDirectory());
        
        // 解析完整命令
        const commandParts = config.command.split(' ');
        const command = commandParts[0]; // 'claude'
        const args = commandParts.slice(1); // 其余参数
        
        console.log('📝 Executing command:', config.command);
        
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
            console.log('📤 stdout:', chunk);
        });
        
        mcpProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.log('📤 stderr:', chunk);
        });
        
        mcpProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            console.log('✅ Process finished with code:', code);
            console.log('📋 Final output:', output);
            console.log('❌ Final error output:', errorOutput);
            
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
                console.log('⏰ Process timeout, killing...');
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
        
        console.log(`🗑️ Starting ${mcpType} MCP removal...`);
        console.log('📂 Working directory:', getCurrentWorkingDirectory());
        
        // Use 'claude mcp remove' command
        const command = 'claude';
        const args = ['mcp', 'remove', mcpType];
        
        console.log('📝 Executing command:', `${command} ${args.join(' ')}`);
        
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
            console.log('📤 stdout:', chunk);
        });
        
        mcpProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.log('📤 stderr:', chunk);
        });
        
        mcpProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            console.log('✅ Removal process finished with code:', code);
            console.log('📋 Final output:', output);
            console.log('❌ Final error output:', errorOutput);
            
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
                console.log('⏰ Removal process timeout, killing...');
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
                console.log('📋 找到配置文件:', configPath);
                const content = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(content);
                
                // 合并配置数据
                configData = { ...configData, ...config };
                console.log('📋 成功读取配置文件');
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
                console.log('📋 发现全局MCP服务器:', serverName);
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
                        console.log('📋 发现项目特定MCP服务器:', serverName);
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
                            console.log('📋 发现其他项目MCP服务器:', serverName, '在', projectPath);
                        }
                    });
                }
            });
        }
        
        console.log('📋 配置文件中找到的MCP服务器:', mcpServers);
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
            console.log('📋 Claude CLI MCP支持检测:', hasMcpSupport);
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
            console.log('📤 MCP list stdout:', chunk);
        });
        
        mcpListProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.log('📤 MCP list stderr:', chunk);
        });
        
        mcpListProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            
            console.log('✅ MCP list process finished with code:', code);
            console.log('📋 MCP list output:', output);
            console.log('📋 MCP list error output:', errorOutput);
            
            // Parse the output to extract installed MCP servers and their authentication status
            const installedMcps = [];
            const unauthenticatedMcps = [];
            
            if (code === 0 && output) {
                // Parse the output lines to find MCP servers
                const lines = output.split('\n').filter(line => line.trim());
                console.log('📋 解析的行数:', lines.length);
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmedLine = line.trim();
                    console.log(`📋 第${i+1}行:`, JSON.stringify(trimmedLine));
                    
                    if (trimmedLine && !trimmedLine.includes('No MCP servers') && trimmedLine.includes(':')) {
                        console.log('📋 发现包含冒号的行:', trimmedLine);
                        
                        // Extract server name from format: "server-name: url/command - status"
                        const match = trimmedLine.match(/^([^:]+):/);
                        if (match) {
                            const serverName = match[1].trim().toLowerCase();
                            console.log('📋 提取的服务器名称:', serverName);
                            
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
                            
                            console.log('📋 认证状态检查:', {
                                line: trimmedLine,
                                serverName: serverName,
                                needsAuth: needsAuth,
                                containsWarning: trimmedLine.includes('⚠'),
                                containsNeedsAuth: trimmedLine.toLowerCase().includes('needs authentication')
                            });
                            
                            // Always add the detected server name
                            if (serverName && !installedMcps.includes(serverName)) {
                                installedMcps.push(serverName);
                                console.log('📋 添加服务器到列表:', serverName);
                                
                                // Track unauthenticated servers
                                if (needsAuth) {
                                    unauthenticatedMcps.push(serverName);
                                    console.log('📋 发现需要认证的服务器:', serverName);
                                }
                            } else {
                                console.log('📋 跳过服务器（空名称或重复）:', serverName);
                            }
                        } else {
                            console.log('📋 正则匹配失败:', trimmedLine);
                        }
                    } else {
                        console.log('📋 跳过行（不符合条件）:', trimmedLine);
                    }
                }
                
                console.log('📋 最终检测到的MCP服务器列表:', installedMcps);
                console.log('📋 需要认证的MCP服务器列表:', unauthenticatedMcps);
            } else {
                console.log('📋 无法解析输出，退出码:', code);
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
                console.log('⏰ MCP list process timeout, killing...');
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
        }, 8000); // 8 seconds timeout
    });
}

// API endpoint to detect installed MCP servers using Claude CLI
app.get('/api/mcp-status', async (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        console.log('🔍 使用Claude CLI检测MCP服务器...');
        console.log('📂 当前工作目录:', getCurrentWorkingDirectory());
        
        // 只使用Claude CLI命令检测方法
        const cliResult = await detectMcpViaCli();
        
        console.log('🔍 CLI检测结果:', cliResult.success ? '成功' : '失败', cliResult.servers || []);
        
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
        
        console.log(`🔧 Starting custom MCP command execution: ${command}`);
        console.log('📂 Working directory:', getCurrentWorkingDirectory());
        
        // Parse the command
        const commandParts = command.trim().split(/\s+/);
        const execCommand = commandParts[0];
        const args = commandParts.slice(1);
        
        console.log('📝 Executing custom command:', command);
        
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
            console.log('📤 Custom command stdout:', dataStr.trim());
        });
        
        customProcess.stderr.on('data', (data) => {
            const dataStr = data.toString();
            errorOutput += dataStr;
            console.log('📤 Custom command stderr:', dataStr.trim());
        });
        
        customProcess.on('close', (code) => {
            clearTimeout(responseTimeout);
            
            console.log(`🏁 Custom command process closed with code: ${code}`);
            console.log('📊 Total output length:', output.length);
            console.log('📊 Total error length:', errorOutput.length);
            
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
                console.log('⏰ Custom command timeout, killing...');
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

// Create server
const server = app.listen(port, () => {
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

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
    
    // 创建新的持久化会话（使用UUID格式）
    const newSessionId = generateUUID();
    
    const session = {
        sessionId: newSessionId,
        realSessionId: null, // Claude CLI返回的真实session ID
        ws: ws,
        process: null,
        isActive: false
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
        console.log('📋 ===== CLAUDE RAW RESPONSE =====');
        console.log(rawOutput);
        console.log('📋 ===== END RAW RESPONSE =====');
        
        const lines = rawOutput.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            try {
                const response = JSON.parse(line);
                
                // 输出解析后的JSON结构（服务器端完整日志）
                console.log('🔍 ===== PARSED JSON RESPONSE (Server Full Log) =====');
                console.log(JSON.stringify(response, null, 2));
                console.log('🔍 ===== END PARSED JSON =====');
                
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
                
                console.log('🔍 ===== FILTERED RESPONSE (Sent to Client) =====');
                console.log(JSON.stringify(filteredResponse, null, 2));
                console.log('🔍 ===== END FILTERED RESPONSE =====');
                
                if (ws.readyState === WebSocket.OPEN) {
                    const responseData = {
                        type: 'claude-response',
                        data: filteredResponse  // 发送过滤后的数据
                    };
                    
                    const responseString = JSON.stringify(responseData);
                    console.log('📤 Sending to client, size:', responseString.length, 'bytes');
                    console.log('📤 Response data type:', filteredResponse.type);
                    
                    // Send response directly without chunking
                    console.log('📤 Sending direct message, size:', responseString.length);
                    ws.send(responseString);
                } else {
                    console.log('⚠️ WebSocket not open, cannot send response');
                }
            } catch (parseError) {
                // 如果不是JSON，检查是否包含文件创建相关内容
                if (line.includes('File created') || line.includes('file created') || 
                    line.includes('<div class="point">') || line.includes('html')) {
                    // 跳过用户内容，不发送到客户端
                    console.log('🔍 Skipping user content display:', line.substring(0, 100) + '...');
                    return; // 直接跳过，不发送任何内容
                } else {
                    // 跳过所有非结构化的文本输出，只保留JSON格式的响应
                    console.log('🔍 Skipping non-structured text output:', line.substring(0, 100) + '...');
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
                if (requestedSessionId && persistentSessions.has(requestedSessionId)) {
                    clientSessionId = requestedSessionId;
                    const sessionInfo = getOrCreatePersistentSession(ws, requestedSessionId);
                    
                    ws.send(JSON.stringify({
                        type: 'session-resumed',
                        sessionId: clientSessionId
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'claude-error',
                        error: '请求的会话不存在'
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
            }
        } catch (error) {
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

// 处理服务器关闭
process.on('SIGINT', () => {
    
    server.close(() => {
        process.exit(0);
    });
});