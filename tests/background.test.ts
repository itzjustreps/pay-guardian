import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendNote } from '../extension/utils/send-note';
import { handleNoteMessage } from '../extension/utils/handle-note-message';
import type { NoteReply } from '../extension/utils/note-message';

vi.mock('../extension/utils/send-note', () => ({ sendNote: vi.fn() }));

type Sender = {
  id?: string;
  url?: string;
  tab?: { id: number };
  frameId?: number;
};
function listener(
  message: unknown,
  sender: Sender,
  reply: (result: NoteReply) => void,
) {
  return handleNoteMessage(message, sender, 'our-extension', reply);
}
const message = {
  type: 'SEND_NOTE',
  payload: { version: 1, sellerNote: 'Call [PHONE_1]' },
};
const sender: Sender = {
  id: 'our-extension',
  url: 'https://www.sandbox.paypal.com/invoice/p/#example',
  tab: { id: 1 },
  frameId: 0,
};
const assessment = {
  status: 'analysed' as const,
  summary: 'No strong urgency signal detected.',
  findings: [],
};

beforeEach(() => {
  vi.mocked(sendNote).mockReset();
});

describe('background request handling', () => {
  it('sends only the payload and keeps the response channel open until completion', async () => {
    vi.mocked(sendNote).mockResolvedValue(assessment);
    const reply = vi.fn();
    expect(listener(message, sender, reply)).toBe(true);
    await Promise.resolve();
    expect(sendNote).toHaveBeenCalledExactlyOnceWith(message.payload);
    expect(reply).toHaveBeenCalledExactlyOnceWith({ ok: true, assessment });
  });

  it.each([
    { ...sender, id: 'another-extension' },
    { ...sender, url: 'https://attacker.example/invoice/p/' },
    { ...sender, tab: undefined },
    { ...sender, frameId: 1 },
  ])(
    'rejects an unauthorised sender %# without fetching',
    (untrustedSender) => {
      const reply = vi.fn();
      listener(message, untrustedSender, reply);
      expect(sendNote).not.toHaveBeenCalled();
      expect(reply).toHaveBeenCalledWith({ ok: false });
    },
  );

  it('ignores invalid or unrelated messages', () => {
    const reply = vi.fn();
    listener(
      {
        type: 'SEND_NOTE',
        payload: { ...message.payload, rawNote: 'private' },
      },
      sender,
      reply,
    );
    expect(sendNote).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('reports failures without forwarding error details or note text', async () => {
    vi.mocked(sendNote).mockRejectedValue(new Error('Private response data'));
    const reply = vi.fn();
    listener(message, sender, reply);
    await Promise.resolve();
    expect(reply).toHaveBeenCalledExactlyOnceWith({ ok: false });
  });
});
