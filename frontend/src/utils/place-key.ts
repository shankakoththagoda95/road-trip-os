// Places are remembered per typed name; case and spacing don't matter.
export function placeKey(text: string) {
  return text.trim().toLowerCase();
}
