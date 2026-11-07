import { isSandboxInvoice, noteMessageSchema } from './note-message';
import { sendNote } from './send-note';

type NoteSender = {
  id?: string;
  url?: string;
  tab?: { id?: number };
  frameId?: number;
};

// Separate from WXT's entrypoint so the message boundary can be tested directly.
export function handleNoteMessage(
  message: unknown,
  sender: NoteSender,
  extensionId: string,
  sendResponse: (reply: { ok: boolean }) => void,
): true | undefined {
  const validation = noteMessageSchema.safeParse(message);
  if (!validation.success) return;

  if (
    sender.id !== extensionId ||
    sender.tab?.id === undefined ||
    sender.frameId !== 0 ||
    !isSandboxInvoice(sender.url)
  ) {
    sendResponse({ ok: false });
    return;
  }

  void sendNote(validation.data.payload).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  );
  // Keep Chrome's message channel open until the asynchronous request finishes.
  return true;
}

//the purpose of this checks is to verify that the message from the content script is passed from where it should
