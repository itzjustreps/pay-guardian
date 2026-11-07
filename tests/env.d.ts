// The root TypeScript project checks extension helpers imported by tests.
// WXT supplies its own environment types when checking the extension separately.
interface ImportMetaEnv {
  readonly WXT_API_BASE_URL?: string;
}
