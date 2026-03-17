import { useState, useEffect, useRef, useCallback } from 'react';
import {
  shouldTriggerReminder,
  getTimeSlotForReminder,
  createReminderState,
  snoozeReminder,
  skipReminder,
  isReminderSnoozed,
  isReminderSkipped,
} from '../utils/reminderUtils';
import type { ReminderState } from '../types';

const CHECK_INTERVAL_MS = 60_000; // 1 minute

export interface ActiveReminder {
  key: string;      // "YYYY-MM-DD_HH:MM-HH:MM"
  timeSlot: string; // "09:00-10:00"
  date: string;     // "YYYY-MM-DD"
}

export interface UseReminderResult {
  activeReminder: ActiveReminder | null;
  snooze: () => void;
  skip: () => void;
  dismiss: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') {
    return Promise.resolve('unsupported');
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}

function showBrowserNotification(timeSlot: string): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('⏰ 工时填写提醒', {
        body: `请填写过去一小时的工作内容：${timeSlot}`,
        icon: '⏰',
      });
    } catch {
      // Notification constructor may fail in some environments
    }
  }
}

/**
 * useReminder hook - manages the reminder lifecycle.
 * @param filledSlots - Set of slot keys ("YYYY-MM-DD_HH:MM-HH:MM") that already have work entries
 * @param enabled - whether the reminder service should be active (e.g., user is authenticated)
 */
export function useReminder(
  filledSlots: Set<string>,
  enabled: boolean,
): UseReminderResult {
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const stateRef = useRef<ReminderState>(createReminderState());

  // Request notification permission on mount when enabled
  useEffect(() => {
    if (!enabled) return;
    requestNotificationPermission().then(setNotificationPermission);
  }, [enabled]);

  // Check function
  const checkReminder = useCallback(() => {
    const now = new Date();
    if (!shouldTriggerReminder(now)) return;

    const timeSlot = getTimeSlotForReminder(now);
    if (!timeSlot) return;

    const dateStr = formatDate(now);
    const key = `${dateStr}_${timeSlot}`;

    // Skip if already filled
    if (filledSlots.has(key)) return;

    // Skip if snoozed or skipped
    const state = stateRef.current;
    if (isReminderSnoozed(state, key, now)) return;
    if (isReminderSkipped(state, key)) return;

    // Show reminder
    setActiveReminder({ key, timeSlot, date: dateStr });
    showBrowserNotification(timeSlot);
  }, [filledSlots]);

  // Set up interval
  useEffect(() => {
    if (!enabled) {
      setActiveReminder(null);
      return;
    }

    // Check immediately on mount
    checkReminder();

    const intervalId = setInterval(checkReminder, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, checkReminder]);

  const snoozeAction = useCallback(() => {
    if (activeReminder) {
      snoozeReminder(stateRef.current, activeReminder.key);
      setActiveReminder(null);
    }
  }, [activeReminder]);

  const skipAction = useCallback(() => {
    if (activeReminder) {
      skipReminder(stateRef.current, activeReminder.key);
      setActiveReminder(null);
    }
  }, [activeReminder]);

  const dismiss = useCallback(() => {
    setActiveReminder(null);
  }, []);

  return {
    activeReminder,
    snooze: snoozeAction,
    skip: skipAction,
    dismiss,
    notificationPermission,
  };
}
