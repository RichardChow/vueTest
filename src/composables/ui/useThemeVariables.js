import { ref, watch } from 'vue';

/**
 * 主题相关的CSS变量管理
 * @param {Object} options 主题选项
 * @param {string} options.initialTheme 初始主题
 * @param {Object} options.themes 主题配置
 * @returns {Object} 主题相关状态和方法
 */
export function useThemeVariables(options = {}) {
  const defaultThemes = {
    dark: {
      '--bg-color': '#0a1222',
      '--text-color': '#ffffff',
      '--primary-color': '#66ccff',
      '--secondary-color': '#0066cc',
      '--accent-color': '#00ff66',
      '--warning-color': '#ffaa00',
      '--error-color': '#ff3366',
      '--panel-bg': 'rgba(15, 25, 40, 0.8)',
      '--panel-border': 'rgba(102, 204, 255, 0.3)',
      '--section-border': 'rgba(102, 204, 255, 0.3)'
    },
    light: {
      '--bg-color': '#f0f8ff',
      '--text-color': '#333333',
      '--primary-color': '#0077cc',
      '--secondary-color': '#3399ff',
      '--accent-color': '#00cc66',
      '--warning-color': '#e67700',
      '--error-color': '#cc0033',
      '--panel-bg': 'rgba(240, 248, 255, 0.9)',
      '--panel-border': 'rgba(0, 119, 204, 0.3)',
      '--section-border': 'rgba(0, 119, 204, 0.3)'
    }
  };
  
  // 合并配置的主题和默认主题
  const themes = options.themes || defaultThemes;
  
  // 当前主题名称
  const currentTheme = ref(options.initialTheme || 'dark');
  
  // 应用主题到根元素
  const applyTheme = (themeName) => {
    const theme = themes[themeName];
    if (!theme) return;
    
    Object.entries(theme).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });
  };
  
  // 切换主题
  const setTheme = (themeName) => {
    if (themes[themeName]) {
      currentTheme.value = themeName;
      applyTheme(themeName);
    }
  };
  
  // 获取当前主题的变量
  const getThemeVariable = (variableName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName);
  };
  
  // 监听主题变化
  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme);
  }, { immediate: true });
  
  return {
    currentTheme,
    setTheme,
    getThemeVariable,
    availableThemes: Object.keys(themes)
  };
} 