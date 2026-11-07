import { handleNoteMessage } from '../utils/handle-note-message';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) =>
      handleNoteMessage(message, sender, browser.runtime.id, sendResponse),
  );
});
//here we receive messages and make backend requests
