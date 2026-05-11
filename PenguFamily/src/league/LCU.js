/**
 * Thin wrapper around Pengu Loader's context.socket.
 *
 * - HTTP: just use fetch() directly (Pengu Loader proxies all LCU endpoints).
 * - WS:  use LCU.observe() which delegates to context.socket.observe().
 *
 * socket.observe() returns { disconnect() } per the Pengu Loader API.
 * We store the socket ref so modules don't need to pass it around.
 */
export const LCU = {
  _socket: null,

  bind(socket) {
    this._socket = socket;
  },

  /**
   * Observe an LCU WebSocket endpoint.
   * Returns { disconnect() } — call it to unsubscribe.
   */
  observe(uri, listener) {
    if (!this._socket) {
      console.warn('[LCU] observe called before bind — skipping', uri);
      return { disconnect() {} };
    }
    return this._socket.observe(uri, listener);
  },

  /**
   * Disconnect a specific listener from an endpoint.
   */
  disconnect(uri, listener) {
    this._socket?.disconnect(uri, listener);
  },
};
