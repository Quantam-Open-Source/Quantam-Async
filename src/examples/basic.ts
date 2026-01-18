import { quantam } from '../index';

interface User {
  id: string;
  name: string;
}

interface UserWithOrders {
  user: User;
  orders: number[];
}

interface EnrichedUser extends UserWithOrders {
  enriched: boolean;
}

async function main(): Promise<void> {
  async function fetchUser(id: string): Promise<User> {
    return { id, name: 'Alice' };
  }

  async function fetchOrders(user: User): Promise<UserWithOrders> {
    return { user, orders: [1, 2, 3] };
  }

  async function enrichData(data: UserWithOrders): Promise<EnrichedUser> {
    return { ...data, enriched: true };
  }

  const flow = quantam()
    .step(fetchUser)
    .step(fetchOrders)
    .step(enrichData);

  const result = await flow.run('user-123' as any);
  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
