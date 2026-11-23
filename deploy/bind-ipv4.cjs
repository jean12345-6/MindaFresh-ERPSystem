// Preloaded into each module (node --require).
// On the shared host, processes cannot connect to each other over loopback TCP, but unix sockets work.
// So when the gateway sets MF_SOCKET, app.listen(port, ...) listens on that unix socket instead of a TCP port.
// Without MF_SOCKET the app listens on 127.0.0.1 only.
const net = require("net");
const orig = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const first = args[0];
  if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    const cb = args.find((a) => typeof a === "function");
    if (process.env.MF_SOCKET) return orig.call(this, process.env.MF_SOCKET, cb);
    if (typeof args[1] !== "string") args.splice(1, 0, "127.0.0.1");
  }
  return orig.apply(this, args);
};
