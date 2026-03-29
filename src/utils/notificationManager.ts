export interface Notification {
  id: string;
  type: 'alert' | 'success' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

class NotificationManager {
  private notifications: Notification[] = [];
  private listeners: Set<(notifications: Notification[]) => void> = new Set();

  subscribe(callback: (notifications: Notification[]) => void): (() => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotif: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };
    this.notifications.unshift(newNotif);
    this.notify();

    // Auto-remove info notifications after 5s
    if (notification.type === 'info') {
      setTimeout(() => this.remove(newNotif.id), 5000);
    }

    return newNotif;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notify();
  }

  markAsRead(id: string) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.notify();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => (n.read = true));
    this.notify();
  }

  getAll() {
    return this.notifications;
  }

  getUnread() {
    return this.notifications.filter(n => !n.read);
  }

  clear() {
    this.notifications = [];
    this.notify();
  }
}

export const notificationManager = new NotificationManager();
