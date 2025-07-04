"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("../src/state");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
describe('state', () => {
    const testFile = path_1.default.resolve(__dirname, '.mole_holes_test.json');
    const oldEnv = process.env.HOME;
    beforeAll(() => {
        process.env.HOME = __dirname; // mock HOME
    });
    afterAll(() => {
        process.env.HOME = oldEnv;
        if (fs_1.default.existsSync(testFile))
            fs_1.default.unlinkSync(testFile);
    });
    it('should save and load state', () => {
        const tunnels = [
            { name: 't1', targetHost: 'h', targetPort: 1, localPort: 2, pid: 123 },
        ];
        (0, state_1.saveState)(tunnels);
        const loaded = (0, state_1.loadState)();
        expect(loaded).toEqual(tunnels);
    });
});
