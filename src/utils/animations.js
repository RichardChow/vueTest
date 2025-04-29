/**
 * 缓动函数 - Cubic：缓入缓出
 * @param {number} t - 动画进度，范围0-1
 * @returns {number} 缓动后的值
 */
export const easeInOutCubic = (t) => {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * 缓动函数 - Cubic：缓出
 * @param {number} t - 动画进度，范围0-1
 * @returns {number} 缓动后的值
 */
export const easeOutCubic = (t) => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * 缓动函数 - Cubic：缓入
 * @param {number} t - 动画进度，范围0-1
 * @returns {number} 缓动后的值
 */
export const easeInCubic = (t) => {
  return t * t * t;
};

/**
 * 缓动函数 - Quad：缓入缓出
 * @param {number} t - 动画进度，范围0-1
 * @returns {number} 缓动后的值
 */
export const easeInOutQuad = (t) => {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

/**
 * 通用动画函数
 * @param {Object} options - 动画选项
 * @param {number} options.duration - 动画持续时间（毫秒）
 * @param {Function} options.onUpdate - 每帧更新回调，接收参数：progress（0-1进度）, elapsedTime（已过时间）
 * @param {Function} [options.onComplete] - 动画完成时的回调
 * @param {Function} [options.easing] - 缓动函数，默认为easeInOutCubic
 * @returns {Object} 包含stop方法的动画控制器
 */
export function animate({ duration, onUpdate, onComplete, easing = easeInOutCubic }) {
  const startTime = Date.now();
  let frameId = null;
  let isStopped = false;

  const tick = () => {
    if (isStopped) return;

    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);

    // 执行更新回调
    onUpdate(easedProgress, elapsed);

    // 如果动画未完成，继续下一帧
    if (progress < 1) {
      frameId = requestAnimationFrame(tick);
    } else {
      // 动画完成
      if (onComplete && typeof onComplete === 'function') {
        onComplete();
      }
    }
  };

  // 开始动画
  frameId = requestAnimationFrame(tick);

  // 返回控制器
  return {
    stop() {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      isStopped = true;
    }
  };
}

/**
 * 创建延迟执行的Promise
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} 延迟指定时间后resolve的Promise
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 序列执行多个动画
 * @param {Array<Function>} animations - 动画函数数组，每个函数返回Promise
 * @returns {Promise} 所有动画执行完成后resolve的Promise
 */
export async function sequence(animations) {
  for (const anim of animations) {
    await anim();
  }
} 