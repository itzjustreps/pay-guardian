import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readSellerNote,
  watchSellerNote,
} from '../extension/utils/seller-note';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

function invoice(text: string) {
  document.body.innerHTML = `<div class="notes-container"><p class="label">Note from seller</p><p></p></div>`;
  document.querySelector('.notes-container > p:not(.label)')!.textContent =
    text;
}

describe('seller note extraction', () => {
  it('reads only the note, trims whitespace, and preserves line breaks', () => {
    invoice('  Call support\nImmediately  ');
    expect(readSellerNote()).toEqual({
      status: 'ready',
      text: 'Call support\nImmediately',
    });
  });

  it('distinguishes an absent note from an empty one', () => {
    expect(readSellerNote()).toEqual({ status: 'missing' });
    invoice(' \n ');
    expect(readSellerNote()).toEqual({ status: 'empty' });
  });

  it('rejects multiple matching notes instead of choosing arbitrarily', () => {
    invoice('First note');
    document.body.append(
      document.querySelector('.notes-container')!.cloneNode(true),
    );
    expect(readSellerNote()).toEqual({ status: 'ambiguous' });
  });

  it('waits for an initially empty note to receive its text', async () => {
    invoice('');
    const callback = vi.fn();
    const stop = watchSellerNote(callback);
    try {
      expect(callback).not.toHaveBeenCalled();
      document.querySelector('.notes-container > p:not(.label)')!.textContent =
        'Loaded';
      await Promise.resolve();
      expect(callback).toHaveBeenCalledExactlyOnceWith({
        status: 'ready',
        text: 'Loaded',
      });
    } finally {
      stop();
    }
  });

  it('reports a missing note after the timeout and stops observing', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    watchSellerNote(callback, 100);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledExactlyOnceWith({ status: 'missing' });
    invoice('Late note');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled when the content script is invalidated', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const stop = watchSellerNote(callback, 100);
    stop();
    invoice('Note');
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });
});
