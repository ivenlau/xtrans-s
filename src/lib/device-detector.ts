/**
 * 检测设备类型并返回合适的默认设备名称
 */
export function getDefaultDeviceName(): string {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  // 检测是否为移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);

  // iOS 设备
  if (/iPad/i.test(userAgent)) {
    return '我的iPad';
  }
  if (/iPhone/i.test(userAgent)) {
    return '我的iPhone';
  }
  if (/iPod/i.test(userAgent)) {
    return '我的iPod';
  }

  // Android 设备
  if (/Android/i.test(userAgent)) {
    // 尝试获取具体品牌
    const brandMatch = userAgent.match(/Android.*?\b(Samsung|Huawei|Xiaomi|Redmi|OPPO|vivo|OnePlus|Realme|Motorola|LG|Sony|Nokia|Lenovo|ASUS|HTC|ZTE|Coolpad|Meizu|Smartisan)\b/i);
    if (brandMatch) {
      const brand = brandMatch[1];
      const brandNames: { [key: string]: string } = {
        'Samsung': '三星',
        'Huawei': '华为',
        'Xiaomi': '小米',
        'Redmi': '红米',
        'OPPO': 'OPPO',
        'vivo': 'vivo',
        'OnePlus': '一加',
        'Realme': 'realme',
        'Motorola': '摩托罗拉',
        'LG': 'LG',
        'Sony': '索尼',
        'Nokia': '诺基亚',
        'Lenovo': '联想',
        'ASUS': '华硕',
        'HTC': 'HTC',
        'ZTE': '中兴',
        'Coolpad': '酷派',
        'Meizu': '魅族',
        'Smartisan': '锤子'
      };
      return isTablet ? `我的${brandNames[brand] || brand}平板` : `我的${brandNames[brand] || brand}手机`;
    }

    // 通用 Android 设备
    if (isTablet) {
      return '我的安卓平板';
    }
    return '我的安卓手机';
  }

  // Windows 设备
  if (/Windows/i.test(userAgent)) {
    // 检测是否为触摸设备（可能是 Windows 平板）
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return '我的Windows平板';
    }
    return '我的电脑';
  }

  // Mac 设备
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    // 检测是否有触摸屏（可能是 iPadOS 桌面模式）
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return '我的iPad';
    }
    return '我的Mac';
  }

  // Linux 设备
  if (/Linux/i.test(userAgent) && !/Android/i.test(userAgent)) {
    return '我的电脑';
  }

  // 通用移动设备
  if (isMobile) {
    return '我的手机';
  }

  // 通用平板设备
  if (isTablet) {
    return '我的平板';
  }

  // 根据平台信息判断
  if (platform) {
    if (platform.startsWith('Win')) {
      return '我的电脑';
    }
    if (platform.startsWith('Mac')) {
      return '我的Mac';
    }
    if (platform.startsWith('Linux')) {
      return '我的电脑';
    }
    if (platform.includes('iPhone') || platform.includes('iPad')) {
      return platform.includes('iPad') ? '我的iPad' : '我的iPhone';
    }
  }

  // 默认名称
  return '我的设备';
}

/**
 * 获取设备类型，用于图标显示等
 */
export function getDeviceType(): 'desktop' | 'laptop' | 'tablet' | 'mobile' {
  const userAgent = navigator.userAgent;

  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent)) {
    return 'tablet';
  }
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    return 'mobile';
  }
  if (/Windows|Macintosh|Linux/i.test(userAgent)) {
    // 检测是否为笔记本（通过触摸屏判断）
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return 'tablet';
    }
    return 'desktop';
  }

  return 'desktop';
}
