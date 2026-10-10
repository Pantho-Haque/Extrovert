/**
 * Time insights (FR-X14), feed guard (FR-X15), away detection for the recap (FR-X06) and
 * auto-lock (FR-W11), all from a one-second tick.
 */
import { powerMonitor } from 'electron';
import { serviceDef } from '../core/services/catalog';
import { addSeconds, dayKey, feedGuardDue, IDLE_SECONDS, shouldCount } from '../core/usage/usage';
import type { Extrovert } from './app';

export class UsageTracker {
  private playing = new Set<string>();
  private continuous = 0;
  private screenLocked = false;
  private awaySince: number | null = null;
  private guardSnoozedUntil = new Map<string, number>();
  private ticks = 0;

  constructor(private readonly app: Extrovert) {
    powerMonitor.on('lock-screen', () => {
      this.screenLocked = true;
      this.awaySince ??= Date.now();
    });
    powerMonitor.on('unlock-screen', () => (this.screenLocked = false));
    powerMonitor.on('suspend', () => (this.awaySince ??= Date.now()));
    setInterval(() => this.tick(), 1000);
  }

  setPlaying(instanceId: string, playing: boolean): void {
    if (playing) this.playing.add(instanceId);
    else this.playing.delete(instanceId);
  }

  onSwitch(): void {
    this.continuous = 0;
  }

  /** Feed guard answer: "continue" asks again in 10 minutes; "break" leaves the feed for 15. */
  answerFeedGuard(choice: 'continue' | 'break'): void {
    const fg = this.app.store.runtime.feedGuard;
    if (!fg) return;
    this.guardSnoozedUntil.set(fg.instanceId, Date.now() + (choice === 'continue' ? 10 : 15) * 60_000);
    this.continuous = 0;
    this.app.store.runtime.feedGuard = null;
    if (choice === 'break') {
      const ws = this.app.store.workspace(fg.workspaceId);
      const chat = ws?.instances.find((i) => i.enabled && serviceDef(i.type).kind === 'chat');
      if (ws && chat) this.app.selectInstance(ws.id, chat.id);
      this.app.toast('Break started. Your feed will be right where you left it.');
    }
    this.app.store.emit();
  }

  private tick(): void {
    const { store } = this.app;
    const now = Date.now();
    const idle = powerMonitor.getSystemIdleTime();
    const ws = store.activeWorkspace;
    const inst = this.app.activeInstance(ws);

    // Away and back: show what arrived meanwhile.
    const awayAfter = store.settings.awayRecap.afterMin * 60;
    if (!this.awaySince && idle >= awayAfter) this.awaySince = now - idle * 1000;
    if (this.awaySince && idle < 5 && !this.screenLocked) {
      if (now - this.awaySince >= awayAfter * 1000) this.app.notifier.recap(this.awaySince);
      this.awaySince = null;
    }

    // Auto-lock and blur-on-idle.
    const lock = store.settings.appLock;
    if (!store.runtime.locked && ((lock.enabled && lock.pinHash && idle >= lock.afterIdleMin * 60) || (store.settings.blurOnIdle && idle >= 300))) void this.app.lock();

    if (!ws || !inst || !store.settings.usageTracking) return;
    const counting = shouldCount({
      windowFocused: this.app.win.isFocused(),
      instanceOnScreen: store.statuses[inst.id]?.state === 'live' && !store.runtime.locked,
      idleSeconds: idle,
      mediaPlaying: this.playing.has(inst.id),
      screenLocked: this.screenLocked,
    });
    if (counting) {
      store.usage = addSeconds(store.usage, dayKey(new Date()), inst.id, 1);
      this.continuous++;
    } else if (idle >= IDLE_SECONDS) {
      this.continuous = 0;
    }
    if (++this.ticks % 30 === 0) store.save('usage');
    else if (counting && this.ticks % 5 === 0) store.emit();

    // Feed guard check-in.
    const fg = store.settings.feedGuard;
    if (counting && !store.runtime.feedGuard && !store.runtime.overlay) {
      const today = store.usage[dayKey(new Date())] ?? {};
      const todaySeconds = ws.instances.filter((i) => i.type === inst.type).reduce((n, i) => n + (today[i.id] ?? 0), 0);
      if (feedGuardDue({
        enabled: fg.enabled, type: inst.type, isFeed: serviceDef(inst.type).kind === 'feed', todaySeconds, budgets: fg.budgets,
        continuousSeconds: this.continuous, nudgeAfterMin: fg.nudgeAfterMin, snoozedUntil: this.guardSnoozedUntil.get(inst.id) ?? 0, now,
      })) {
        const budgetMin = fg.budgets[inst.type];
        store.runtime.feedGuard = { workspaceId: ws.id, instanceId: inst.id, todayMin: Math.round(todaySeconds / 60), ...(budgetMin !== undefined ? { budgetMin } : {}) };
        store.emit();
      }
    }
  }
}
