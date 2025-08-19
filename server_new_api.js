// Claude CLI检测方法（作为Promise）
function detectMcpViaCli() {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const mcpListProcess = spawn('claude', ['mcp', 'list'], {
            cwd: process.cwd(),
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
            
            
            // Parse the output to extract installed MCP servers
            const installedMcps = [];
            if (code === 0 && output) {
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
                            
                            // Always add the detected server name
                            if (serverName && !installedMcps.includes(serverName)) {
                                installedMcps.push(serverName);
                            } else {
                            }
                        } else {
                        }
                    } else {
                    }
                }
                
            } else {
            }
            
            resolve({
                success: code === 0 || installedMcps.length > 0,
                servers: installedMcps,
                output: output,
                errorOutput: errorOutput,
                exitCode: code
            });
        });
        
        mcpListProcess.on('error', (error) => {
            clearTimeout(responseTimeout);
            
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
        }, 8000); // 8 seconds timeout
    });
}

// API endpoint to detect installed MCP servers using multiple methods
app.get('/api/mcp-status', async (req, res) => {
    try {
        // Ensure content-type is JSON
        res.setHeader('Content-Type', 'application/json');
        
        
        // 并行执行所有三种检测方法
        const [configData, runtimeData, cliData] = await Promise.allSettled([
            // 方法1: 直接读取配置文件
            Promise.resolve().then(() => {
                const configData = readMcpConfigFiles();
                const configMcpServers = extractMcpServersFromConfig(configData);
                return {
                    success: configMcpServers.length > 0,
                    servers: configMcpServers,
                    configData: configData
                };
            }),
            
            // 方法2: 运行时检测
            (async () => {
                return await detectMcpRuntime();
            })(),
            
            // 方法3: Claude CLI命令检测
            (async () => {
                return await detectMcpViaCli();
            })()
        ]);
        
        // 处理所有检测结果
        const configResult = configData.status === 'fulfilled' ? configData.value : { success: false, servers: [], error: configData.reason?.message };
        const runtimeResult = runtimeData.status === 'fulfilled' ? runtimeData.value : { success: false, error: runtimeData.reason?.message };
        const cliResult = cliData.status === 'fulfilled' ? cliData.value : { success: false, servers: [], error: cliData.reason?.message };
        
        // 整合所有方法的结果
        const allMcpServers = new Set();
        
        // 添加配置文件中的服务器
        if (configResult.servers) {
            configResult.servers.forEach(server => allMcpServers.add(server));
        }
        
        // 添加CLI命令检测到的服务器
        if (cliResult.servers) {
            cliResult.servers.forEach(server => allMcpServers.add(server));
        }
        
        const finalMcpServers = Array.from(allMcpServers);
        
        // 检查整体成功状态
        const overallSuccess = configResult.success || cliResult.success || runtimeResult.hasMcpSupport;
        
        
        res.json({
            success: overallSuccess,
            installedMcps: finalMcpServers,
            detectionMethods: {
                configFile: {
                    success: configResult.success,
                    servers: configResult.servers || [],
                    configData: configResult.configData,
                    error: configResult.error
                },
                cliCommand: {
                    success: cliResult.success,
                    servers: cliResult.servers || [],
                    output: cliResult.output,
                    errorOutput: cliResult.errorOutput,
                    exitCode: cliResult.exitCode,
                    error: cliResult.error
                },
                runtime: {
                    success: runtimeResult.hasMcpSupport || false,
                    data: runtimeResult,
                    error: runtimeResult.error
                }
            },
            message: overallSuccess ? 
                `通过多种方法检测到 ${finalMcpServers.length} 个MCP服务器` : 
                '所有检测方法均未发现MCP服务器'
        });
        
    } catch (error) {
        
        // 即使发生异常，也尝试至少执行配置文件检测
        try {
            const configData = readMcpConfigFiles();
            const configMcpServers = extractMcpServersFromConfig(configData);
            const configSuccess = configMcpServers.length > 0;
            
            res.status(configSuccess ? 200 : 500).json({
                success: configSuccess,
                installedMcps: configMcpServers,
                detectionMethods: {
                    configFile: {
                        success: configSuccess,
                        servers: configMcpServers,
                        configData: configData
                    },
                    cliCommand: {
                        success: false,
                        error: 'Exception occurred during CLI detection'
                    },
                    runtime: {
                        success: false,
                        error: 'Exception occurred during runtime detection'
                    }
                },
                error: error.message || 'Failed to check MCP status',
                details: error.toString(),
                message: configSuccess ? 
                    `仅通过配置文件检测到 ${configMcpServers.length} 个MCP服务器` : 
                    '所有检测方法均因异常失败'
            });
        } catch (fallbackError) {
            res.status(500).json({
                success: false,
                error: 'Complete MCP detection failure',
                installedMcps: [],
                details: `Primary error: ${error.toString()}, Fallback error: ${fallbackError.toString()}`
            });
        }
    }
});