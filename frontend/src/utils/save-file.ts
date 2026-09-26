/**
 * Native: not supported yet (needs expo-file-system + expo-sharing).
 * TODO: implement in the mobile pass.
 */
export function saveFile(_blob: Blob, _filename: string) {
  throw new Error('Downloading files is only available in the web app for now.');
}
