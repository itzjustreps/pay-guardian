// Common email formats; intentionally not a complete email-address parser.
const EMAIL =
  /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi;

// Match phone-like digit sequences without crossing line breaks or letters.
// This is a heuristic, not proof that a number belongs to a phone.
const PHONE =
  /(?<![\p{L}\p{N}_])\+?\(?\d(?:[\d() \t.-]*\d)?(?![\p{L}\p{N}_])/gu;

export function redactSellerNote(note: string): string {
  return redactSellerNoteWithContacts(note).text;
}

export type RedactedSellerNote = {
  text: string;
  hasPhoneNumber: boolean;
  hasEmailAddress: boolean;
};

// Flags describe the same heuristic matches used for redaction, not verified contacts.
export function redactSellerNoteWithContacts(note: string): RedactedSellerNote {
  const emails = new Map<string, string>();
  const phones = new Map<string, string>();

  function placeholder(
    contacts: Map<string, string>,
    key: string,
    type: 'EMAIL' | 'PHONE',
  ): string {
    let value = contacts.get(key); //checks the map if the key exists
    if (!value) {
      value = `[${type}_${contacts.size + 1}]`;
      contacts.set(key, value); //adds it to the map if it doesnt
    }
    return value;
  }

  // Replace emails first so digits inside an email are not treated as a phone.
  const withoutEmails = note.replace(EMAIL, (email) =>
    placeholder(emails, email, 'EMAIL'),
  );

  const text = withoutEmails.replace(PHONE, (phone) => {
    const digits = phone.replace(/\D/g, '');
    // Preserve short amounts and deadlines. Long non-phone numbers can still
    // match, and disguised contacts can be missed: this is partial redaction.
    if (digits.length < 7 || digits.length > 15) return phone;
    return placeholder(phones, digits, 'PHONE');
  });
  return {
    text,
    hasPhoneNumber: phones.size > 0,
    hasEmailAddress: emails.size > 0,
  };
}
