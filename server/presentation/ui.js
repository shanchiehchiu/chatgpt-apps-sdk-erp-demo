export function makeUiView(presentation, data) {
  return {
    slot: presentation.slot,
    presentation,
    data,
  };
}
