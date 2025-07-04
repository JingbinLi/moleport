"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kill_1 = require("../src/kill");
describe('killTunnel', () => {
    it('should kill by name', () => {
        const tunnels = [
            { name: 'a', targetHost: 'h', targetPort: 1, localPort: 2, pid: 1 },
            { name: 'b', targetHost: 'h', targetPort: 1, localPort: 3, pid: 2 },
        ];
        const { killed, remaining } = (0, kill_1.killTunnel)(tunnels, 'a', false);
        expect(killed.length).toBe(1);
        expect(killed[0].name).toBe('a');
        expect(remaining.length).toBe(1);
        expect(remaining[0].name).toBe('b');
    });
    it('should kill all', () => {
        const tunnels = [
            { name: 'a', targetHost: 'h', targetPort: 1, localPort: 2, pid: 1 },
            { name: 'b', targetHost: 'h', targetPort: 1, localPort: 3, pid: 2 },
        ];
        const { killed, remaining } = (0, kill_1.killTunnel)(tunnels, undefined, true);
        expect(killed.length).toBe(2);
        expect(remaining.length).toBe(0);
    });
});
