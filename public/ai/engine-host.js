// The engine and its search thread stay off the page's UI thread.
let engine;
self.onmessage = (event) => {
  if (typeof event.data === 'string' && engine) engine.postMessage(event.data);
};
void (async () => {
  try {
    importScripts('./engine/stockfish.js');
    engine = await Stockfish({
      locateFile: (file) =>
        new URL('./engine/' + file, self.location.href).href,
      mainScriptUrlOrBlob: new URL('./engine/stockfish.js', self.location.href)
        .href,
    });
    engine.addMessageListener((line) =>
      self.postMessage({ type: 'line', line }),
    );
    self.postMessage({ type: 'loaded' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
})();
