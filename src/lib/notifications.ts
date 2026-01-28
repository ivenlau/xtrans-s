/**
 * 通知工具：处理声音播放和桌面通知
 */

// 播放提示音
let audioContext: AudioContext | null = null;

export function playNotificationSound() {
  try {
    // 检查是否启用了声音
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

    if (!soundEnabled) {
      return;
    }

    // 创建 AudioContext（懒加载）
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // 创建振荡器生成提示音
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 设置音调和音量
    oscillator.frequency.value = 800; // 800Hz
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3; // 音量 30%

    // 播放 200ms 的提示音
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // Silently fail for sound playback errors
  }
}

// 检查通知权限
export async function checkNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// 显示桌面通知
export async function showDesktopNotification(
  title: string,
  body: string,
  icon?: string
) {
  try {
    // 检查是否启用了桌面通知
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';

    if (!notificationsEnabled) {
      return;
    }

    // 检查通知权限
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      return;
    }

    // 创建通知
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `xtrans-${Date.now()}`, // 防止重复
      requireInteraction: false, // 不需要用户交互
    });

    // 点击通知时聚焦窗口
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // 5秒后自动关闭
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    // Silently fail for notification errors
  }
}

// 显示通知（组合版：声音 + 桌面通知）
export async function showNotification(
  title: string,
  body: string,
  options?: {
    sound?: boolean;
    desktop?: boolean;
    icon?: string;
  }
) {
  const { sound = true, desktop = true, icon } = options || {};

  // 播放声音
  if (sound) {
    playNotificationSound();
  }

  // 显示桌面通知
  if (desktop) {
    await showDesktopNotification(title, body, icon);
  }
}
