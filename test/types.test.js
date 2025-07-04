"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
describe('MoleHole type', () => {
    it('should allow correct structure', () => {
        const m = {
            name: 'test',
            targetHost: 'h',
            targetPort: 22,
            localPort: 10022,
            pid: 1234,
        };
        expect(m.name).toBe('test');
    });
});
