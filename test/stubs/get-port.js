// get-port v7 is ESM-only and jest's CommonJS runtime cannot require it.
// The production bundle resolves it fine; tests only need "give me a free port".
const net = require("net");

module.exports = function getPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
};
