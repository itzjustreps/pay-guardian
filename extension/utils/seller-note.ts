export type SellerNoteResult =
  | { status: 'missing' | 'empty' | 'ambiguous' }
  | { status: 'ready'; text: string };

export function readSellerNote(root: ParentNode = document): SellerNoteResult {
  //this reads the notes and retuens the status
  const notes = root.querySelectorAll('.notes-container > p:not(.label)');

  if (notes.length === 0) return { status: 'missing' };
  if (notes.length > 1) return { status: 'ambiguous' };

  const text = notes.item(0)?.textContent?.trim() ?? '';
  return text ? { status: 'ready', text } : { status: 'empty' };
}

// PayPal can render the note after the content script starts.
export function watchSellerNote(
  onResult: (result: SellerNoteResult) => void,
  timeoutMs = 10_000,
): () => void {
  const observer = new MutationObserver(check);

  function stop() {
    //clean up function when there is no result
    observer.disconnect();
    clearTimeout(timer);
  }

  function check() {
    const result = readSellerNote(); //the callback function onResult is called when we have a value for this variable
    // An empty element may still be waiting for its text to load.
    if (result.status === 'missing' || result.status === 'empty') return;
    stop();
    onResult(result);
  }

  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  const timer = setTimeout(() => {
    stop();
    onResult(readSellerNote());
  }, timeoutMs);
  check();

  return stop;
}
