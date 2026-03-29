import React, { useEffect, useState } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { Notification } from '../utils/notificationManager';
import { notificationManager } from '../utils/notificationManager';

interface NotificationPanelProps {
  isOpen?: boolean;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen: defaultIsOpen = false }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => notificationManager.getAll());
  const [isOpen, setIsOpen] = useState(defaultIsOpen);

  useEffect(() => {
    try {
      const unsubscribe = notificationManager.subscribe((updatedNotifications) => {
        try {
          setNotifications(updatedNotifications || []);
        } catch (error) {
          console.error('Error updating notifications', error);
        }
      });
      
      return () => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            console.error('Error unsubscribing', error);
          }
        }
      };
    } catch (error) {
      console.error('Error initializing notifications', error);
    }
  }, []);

  const unreadCount = notifications && Array.isArray(notifications) 
    ? notifications.filter(n => n && !n.read).length 
    : 0;

  const handleMarkAsRead = (id: string) => {
    notificationManager.markAsRead(id);
  };

  const handleRemove = (id: string) => {
    notificationManager.remove(id);
  };

  const handleMarkAllAsRead = () => {
    notificationManager.markAllAsRead();
  };

  const handleClear = () => {
    notificationManager.clear();
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'alert':
        return <AlertCircle size={16} />;
      case 'success':
        return <CheckCircle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'alert':
        return 'var(--danger)';
      case 'success':
        return 'var(--success)';
      case 'warning':
        return 'var(--warning)';
      default:
        return 'var(--primary)';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-main)',
          padding: '0.5rem'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: 'var(--danger)',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: '700',
              boxShadow: '0 0 8px var(--danger-glow)'
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '360px',
            maxHeight: '500px',
            background: 'rgba(255, 255, 255, 0.96)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 18px 40px rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>
              Notifications {unreadCount > 0 && <span style={{ color: 'var(--danger)' }}>({unreadCount})</span>}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Notifications List */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {!notifications || notifications.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map(notif => {
                try {
                  if (!notif || !notif.id) return null;
                  const timestamp = notif.timestamp 
                    ? (typeof notif.timestamp === 'string' 
                      ? new Date(notif.timestamp).toLocaleTimeString() 
                      : notif.timestamp.toLocaleTimeString?.()
                    )
                    : 'Just now';
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkAsRead(notif.id)}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
                        background: notif.read ? 'transparent' : 'rgba(6, 182, 212, 0.05)',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)')}
                      onMouseOut={e => (e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(6, 182, 212, 0.05)')}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ color: getTypeColor(notif.type), flexShrink: 0, marginTop: '0.125rem' }}>
                          {getTypeIcon(notif.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{notif.title || 'Notification'}</span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleRemove(notif.id);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', lineHeight: '1.3' }}>
                            {notif.message || ''}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {timestamp}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } catch (error) {
                  console.error('Error rendering notification', error);
                  return null;
                }
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: '0.75rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem'
              }}
            >
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}
              >
                Mark All as Read
              </button>
              <button
                onClick={handleClear}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
