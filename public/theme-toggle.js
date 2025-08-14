class ThemeManager {
    constructor() {
        this.isDarkMode = localStorage.getItem('theme') === 'dark';
        this.init();
    }

    init() {
        // 应用保存的主题
        if (this.isDarkMode) {
            document.body.classList.add('dark');
        }

        // 监听系统主题变化
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(this.handleSystemThemeChange.bind(this));
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark', this.isDarkMode);
        localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
        
        // 更新所有现有的文件按钮样式
        this.updateFileButtonStyles();
        
        // 触发主题变化事件
        this.dispatchThemeChangeEvent();
    }

    setTheme(theme) {
        switch(theme) {
            case 'light':
                this.isDarkMode = false;
                document.body.classList.remove('dark');
                localStorage.setItem('theme', 'light');
                break;
            case 'dark':
                this.isDarkMode = true;
                document.body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                break;
            case 'system':
                this.followSystemTheme();
                localStorage.setItem('theme', 'system');
                break;
        }
        
        this.updateFileButtonStyles();
        this.dispatchThemeChangeEvent();
    }

    followSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.isDarkMode = true;
            document.body.classList.add('dark');
        } else {
            this.isDarkMode = false;
            document.body.classList.remove('dark');
        }
    }

    handleSystemThemeChange(e) {
        if (localStorage.getItem('theme') === 'system') {
            this.isDarkMode = e.matches;
            document.body.classList.toggle('dark', this.isDarkMode);
            this.updateFileButtonStyles();
            this.dispatchThemeChangeEvent();
        }
    }

    updateFileButtonStyles() {
        // 更新文件路径按钮的样式
        document.querySelectorAll('.file-path-button').forEach(btn => {
            // 主题变化时自动应用正确的样式，CSS变量会处理这个
        });
    }

    dispatchThemeChangeEvent() {
        // 派发自定义事件供其他组件监听
        const event = new CustomEvent('themeChange', {
            detail: {
                isDarkMode: this.isDarkMode,
                theme: localStorage.getItem('theme')
            }
        });
        document.dispatchEvent(event);
    }

    getCurrentTheme() {
        return {
            isDarkMode: this.isDarkMode,
            theme: localStorage.getItem('theme') || 'light'
        };
    }
}

// 导出实例供全局使用
window.themeManager = new ThemeManager();