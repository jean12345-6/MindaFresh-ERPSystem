// Receipt printing sound (public/audio/receipt.mp3, trimmed to 3 seconds).
// window.playReceiptSound() starts it and returns the sound length in ms.
(function () {
  window.RECEIPT_SOUND_MS = 3000;
  window.playReceiptSound = function () {
    try {
      const a = new Audio("/audio/receipt.mp3");
      a.play().catch(() => { /* browser blocked autoplay */ });
    } catch { /* audio unsupported */ }
    return window.RECEIPT_SOUND_MS;
  };
})();
