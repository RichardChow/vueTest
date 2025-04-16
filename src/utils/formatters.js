/**
 * 格式化时间戳
 * @param {number} timestamp - 时间戳
 * @param {Object} options - 格式化选项
 * @param {string} options.format - 日期格式，默认为'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(timestamp, options = { format: 'YYYY-MM-DD HH:mm:ss' }) {
  const date = new Date(timestamp);
  const format = options.format;
  
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化网元设备名称
 * @param {string} name 设备原始名称
 * @returns {string} 格式化后的设备名称
 */
export function formatDeviceName(name) {
  if (!name) return '';
  
  // 移除"NE_"前缀
  if (name.startsWith('NE_')) {
    name = name.substring(3);
  }
  
  // 替换下划线为空格
  name = name.replace(/_/g, ' ');
  
  return name;
}

/**
 * 格式化温度
 * @param {number} temp 温度值
 * @returns {string} 格式化后的温度字符串
 */
export function formatTemperature(temp) {
  if (temp === undefined || temp === null) return '--';
  return `${parseFloat(temp).toFixed(1)}°C`;
}

/**
 * 格式化百分比
 * @param {number} value 百分比值
 * @returns {string} 格式化后的百分比字符串
 */
export function formatPercentage(value) {
  if (value === undefined || value === null) return '--';
  return `${Math.round(value)}%`;
}

/**
 * 为个位数补零
 * @param {number} num 需要补零的数字
 * @returns {string} 补零后的字符串
 */
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
} 