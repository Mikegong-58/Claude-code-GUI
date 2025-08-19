class SettingsManager {
    constructor(terminalInterface) {
        this.terminalInterface = terminalInterface;
        this.userRulesPath = null;
        this.projectRulesPath = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.settingsFullpage = document.getElementById('settings-fullpage');
        this.settingsBackBtn = document.getElementById('settings-back-btn');
        this.userRulesList = document.getElementById('user-rules-list');
        this.projectRulesList = document.getElementById('project-rules-list');
        this.userRuleInput = document.getElementById('user-rule-input');
        this.projectRuleInput = document.getElementById('project-rule-input');
        this.addUserRuleBtn = document.getElementById('add-user-rule-btn');
        this.addProjectRuleBtn = document.getElementById('add-project-rule-btn');
        
    }

    setupEventListeners() {
        // Settings back button
        if (this.settingsBackBtn) {
            this.settingsBackBtn.addEventListener('click', () => {
                this.hideSettings();
            });
        }

        // Add user rule button
        if (this.addUserRuleBtn) {
            this.addUserRuleBtn.addEventListener('click', () => {
                this.addUserRule();
            });
        }

        // Add project rule button
        if (this.addProjectRuleBtn) {
            this.addProjectRuleBtn.addEventListener('click', () => {
                this.addProjectRule();
            });
        }

        // Enter key handlers for rule inputs
        if (this.userRuleInput) {
            this.userRuleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addUserRule();
                }
            });
        }

        if (this.projectRuleInput) {
            this.projectRuleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addProjectRule();
                }
            });
        }
    }

    showSettings() {
        // Update navigation button states
        if (this.terminalInterface.updateNavButtonStates) {
            this.terminalInterface.updateNavButtonStates('settings');
        }
        
        // Hide other elements
        if (this.terminalInterface.chatInterface) {
            this.terminalInterface.chatInterface.style.display = 'none';
        }
        if (this.terminalInterface.mcpFullpage) {
            this.terminalInterface.mcpFullpage.style.display = 'none';
        }
        if (this.terminalInterface.tokenStatisticsFullpage) {
            this.terminalInterface.tokenStatisticsFullpage.style.display = 'none';
        }
        
        // Hide MCP panels if visible
        if (this.terminalInterface.mcpPanel) {
            this.terminalInterface.mcpPanel.style.display = 'none';
            this.terminalInterface.mcpPanel.classList.remove('visible');
        }
        const todoPanel = document.getElementById('todo-panel');
        if (todoPanel) {
            todoPanel.style.display = 'none';
            todoPanel.classList.remove('visible');
        }
        
        // Hide input container
        const inputContainer = document.querySelector('.input-container');
        if (inputContainer) {
            inputContainer.style.display = 'none';
        }
        
        // Show settings page with force styles
        if (this.settingsFullpage) {
            // Remove from current parent and add directly to body to bypass overflow issues
            this.settingsFullpage.remove();
            document.body.appendChild(this.settingsFullpage);
            
            // Force display styles to override any CSS issues
            this.settingsFullpage.style.cssText = `
                display: block !important;
                position: fixed !important;
                top: 0 !important;
                left: 61px !important;
                right: 0 !important;
                bottom: 0 !important;
                width: calc(100vw - 61px) !important;
                height: 100vh !important;
                background-color: #fdfcfa !important;
                z-index: 99 !important;
                overflow-y: auto !important;
                pointer-events: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                transform: none !important;
                clip: none !important;
                clip-path: none !important;
            `;
        }
        
        // Update navigation button states
        if (this.terminalInterface.updateNavButtonStates) {
            this.terminalInterface.updateNavButtonStates('settings');
        }
        
        
        // Load current rules
        this.loadUserRules();
        this.loadProjectRules();
    }

    hideSettings() {
        if (this.settingsFullpage) {
            this.settingsFullpage.style.display = 'none';
        }
        
        // Show chat interface
        if (this.terminalInterface.chatInterface) {
            this.terminalInterface.chatInterface.style.display = 'flex';
        }
        
        // Show input container
        const inputContainer = document.querySelector('.input-container');
        if (inputContainer) {
            inputContainer.style.display = 'block';
        }
        
        // Reset textarea size
        if (this.terminalInterface.commandInput) {
            this.terminalInterface.autoResizeTextarea();
        }
        
        // Update navigation button states
        this.terminalInterface.updateNavButtonStates('chat');
    }

    async loadUserRules() {
        try {
            const response = await fetch('/api/load-user-rules');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.displayRules(data.rules, this.userRulesList, 'user');
            } else {
                this.displayRules([], this.userRulesList, 'user');
            }
        } catch (error) {
            this.displayRules([], this.userRulesList, 'user');
        }
    }

    async loadProjectRules() {
        try {
            const response = await fetch('/api/load-project-rules');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.displayRules(data.rules, this.projectRulesList, 'project');
            } else {
                this.displayRules([], this.projectRulesList, 'project');
            }
        } catch (error) {
            this.displayRules([], this.projectRulesList, 'project');
        }
    }

    displayRules(rules, container, type) {
        if (!container) {
            return;
        }
        
        container.innerHTML = '';
        
        if (rules.length === 0) {
            container.innerHTML = '<div class="no-rules">No rules found</div>';
            return;
        }
        
        rules.forEach((rule, index) => {
            const ruleElement = document.createElement('div');
            ruleElement.className = 'rule-item';
            ruleElement.innerHTML = `
                <span class="rule-content">${this.escapeHtml(rule)}</span>
                <button class="rule-delete-btn" onclick="window.settingsManager.deleteRule('${type}', ${index})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m18 6-12 12M6 6l12 12"/>
                    </svg>
                </button>
            `;
            container.appendChild(ruleElement);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async addUserRule() {
        if (!this.userRuleInput) return;
        
        const rule = this.userRuleInput.value.trim();
        if (!rule) return;
        
        try {
            const response = await fetch('/api/add-user-rule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rule })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.userRuleInput.value = '';
                this.loadUserRules();
            } else {
                alert('Failed to add rule: ' + data.error);
            }
        } catch (error) {
            alert('Error adding rule: ' + error.message);
        }
    }

    async addProjectRule() {
        if (!this.projectRuleInput) return;
        
        const rule = this.projectRuleInput.value.trim();
        if (!rule) return;
        
        try {
            const response = await fetch('/api/add-project-rule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rule })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.projectRuleInput.value = '';
                this.loadProjectRules();
            } else {
                alert('Failed to add rule: ' + data.error);
            }
        } catch (error) {
            alert('Error adding rule: ' + error.message);
        }
    }

    async deleteRule(type, index) {
        try {
            const endpoint = type === 'user' ? '/api/delete-user-rule' : '/api/delete-project-rule';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ index })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (type === 'user') {
                    this.loadUserRules();
                } else {
                    this.loadProjectRules();
                }
            } else {
                alert(`Failed to delete rule: ${data.error}`);
            }
        } catch (error) {
            alert(`Error deleting rule: ${error.message}`);
        }
    }
}

// Initialize settings manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for terminalInterface to be initialized
    setTimeout(() => {
        if (window.terminalInterface) {
            window.settingsManager = new SettingsManager(window.terminalInterface);
            
            // Add test function to window for debugging
            window.testSettings = () => {
                const settingsPage = document.getElementById('settings-fullpage');
                
                if (settingsPage) {
                    // Force very visible styles
                    settingsPage.style.display = 'block';
                    settingsPage.style.position = 'fixed';
                    settingsPage.style.top = '0';
                    settingsPage.style.left = '0';
                    settingsPage.style.width = '100vw';
                    settingsPage.style.height = '100vh';
                    settingsPage.style.backgroundColor = 'red';
                    settingsPage.style.zIndex = '99999';
                    settingsPage.style.opacity = '1';
                    settingsPage.style.visibility = 'visible';
                    
                    // Add some visible content
                    settingsPage.innerHTML = '<div style="color: white; font-size: 50px; padding: 50px;">SETTINGS PAGE TEST - IF YOU SEE THIS, CSS WORKS!</div>';
                }
            };
            
            // Alternative test function that creates a completely new element
            window.testSimple = () => {
                const testDiv = document.createElement('div');
                testDiv.style.position = 'fixed';
                testDiv.style.top = '0';
                testDiv.style.left = '0';
                testDiv.style.width = '100vw';
                testDiv.style.height = '100vh';
                testDiv.style.backgroundColor = 'blue';
                testDiv.style.color = 'white';
                testDiv.style.fontSize = '50px';
                testDiv.style.zIndex = '99999';
                testDiv.style.display = 'flex';
                testDiv.style.alignItems = 'center';
                testDiv.style.justifyContent = 'center';
                testDiv.innerHTML = 'SIMPLE TEST - IF YOU SEE THIS, JS WORKS!';
                testDiv.onclick = () => document.body.removeChild(testDiv);
                document.body.appendChild(testDiv);
            };
            
            // Debug DOM function
            window.debugDOM = () => {
                const settingsPage = document.getElementById('settings-fullpage');
                const settingsPageByClass = document.querySelector('.settings-fullpage');
                const allDivs = document.querySelectorAll('div[id*="settings"]');
                
                // Check if there are multiple elements with same ID
                const allElements = document.querySelectorAll('*');
                const settingsElements = [];
                allElements.forEach(el => {
                    if (el.id === 'settings-fullpage' || (el.className && el.className.includes && el.className.includes('settings-fullpage'))) {
                        settingsElements.push(el);
                    }
                });
                
                return settingsPage;
            };
            
            // Simple test
            window.simpleTest = () => {
                const element = document.getElementById('settings-fullpage');
                if (element) {
                    // Force show with !important styles
                    element.style.cssText = `
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        background: yellow !important;
                        z-index: 999999 !important;
                        pointer-events: auto !important;
                        transform: none !important;
                        clip: none !important;
                        clip-path: none !important;
                        overflow: visible !important;
                    `;
                    element.innerHTML = '<h1 style="color: black !important; padding: 50px !important; font-size: 50px !important;">SETTINGS ELEMENT FOUND!</h1>';
                    
                    return true;
                } else {
                    return false;
                }
            };
            
            // Test to check computed styles and parent hierarchy
            window.checkStyles = () => {
                const element = document.getElementById('settings-fullpage');
                if (element) {
                    const computed = window.getComputedStyle(element);
                    
                    return computed;
                }
                return null;
            };
            
            // Force show by moving to body
            window.forceShow = () => {
                const element = document.getElementById('settings-fullpage');
                if (element) {
                    // Remove from current parent and add to body
                    element.remove();
                    document.body.appendChild(element);
                    
                    // Force styles
                    element.style.cssText = `
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        background: red !important;
                        z-index: 999999 !important;
                        pointer-events: auto !important;
                        transform: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    `;
                    
                    element.innerHTML = '<div style="color: white !important; font-size: 50px !important; padding: 50px !important; text-align: center !important;">MOVED TO BODY!</div>';
                    
                    return true;
                }
                return false;
            };
        } else {
            // Retry after more time
            setTimeout(() => {
                if (window.terminalInterface) {
                    window.settingsManager = new SettingsManager(window.terminalInterface);
                }
            }, 500);
        }
    }, 100);
});