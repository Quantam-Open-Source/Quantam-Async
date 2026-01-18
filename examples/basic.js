"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    async function fetchUser(id) {
        return { id, name: 'Alice' };
    }
    async function fetchOrders(user) {
        return { user, orders: [1, 2, 3] };
    }
    async function enrichData(data) {
        return { ...data, enriched: true };
    }
    const flow = (0, src_1.quantam)()
        .step(fetchUser)
        .step(fetchOrders)
        .step(enrichData);
    const result = await flow.run('user-123');
    console.log(result);
}
main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=basic.js.map