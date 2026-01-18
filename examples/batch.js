"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const flow = (0, src_1.quantam)().step(async (n) => n + 1);
    const inputs = Array.from({ length: 1000 }, (_, i) => i);
    const results = await flow.runMany(inputs, { concurrency: 64 });
    console.log({
        length: results.length,
        first: results[0],
        last: results[results.length - 1],
    });
}
main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=batch.js.map