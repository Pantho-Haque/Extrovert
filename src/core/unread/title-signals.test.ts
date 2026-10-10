import { describe, expect, it } from 'vitest';
import { nextUnread, titleSignal } from './title-signals';

describe('titleSignal', () => {
  it('reads the sender from a flashing message title', () => {
    expect(titleSignal('Rahim Ahmed sent you a message')).toEqual({ kind: 'message', sender: 'Rahim Ahmed', text: 'Rahim Ahmed sent you a message' });
    expect(titleSignal('Sara messaged you | Facebook')).toMatchObject({ kind: 'message', sender: 'Sara' });
    expect(titleSignal('New message from Tanvir')).toMatchObject({ sender: 'Tanvir' });
  });

  it('recognises an incoming call', () => {
    expect(titleSignal('Rahim is calling you')).toEqual({ kind: 'call', sender: 'Rahim', text: 'Rahim is calling you' });
    expect(titleSignal('Incoming video call')).toMatchObject({ kind: 'call', sender: null });
  });

  it('ignores ordinary titles', () => {
    expect(titleSignal('(3) Messenger | Facebook')).toBeNull();
    expect(titleSignal('Messenger | Facebook')).toBeNull();
    expect(titleSignal('Inbox (4) - me@gmail.com - Gmail')).toBeNull();
  });
});

describe('nextUnread', () => {
  it('keeps the count through a flash and asks to confirm the drop', () => {
    expect(nextUnread(2, 0)).toEqual({ unread: 2, confirmLater: true });
  });

  it('takes any count the title does show', () => {
    expect(nextUnread(2, 3)).toEqual({ unread: 3, confirmLater: false });
    expect(nextUnread(0, 0)).toEqual({ unread: 0, confirmLater: false });
  });
});
