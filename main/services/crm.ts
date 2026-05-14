import { db } from "./database";
import { auditLog } from "./audit";

export async function listCustomers() {
  return db().customer.findMany({ orderBy: { name: "asc" } });
}

export async function upsertCustomer(input: {
  actorId?: string;
  id?: string;
  name: string;
  phone: string;
  email?: string | null;
}) {
  const data = {
    name: input.name,
    phone: input.phone,
    email: input.email || null
  };

  const customer = input.id
    ? await db().customer.update({ where: { id: input.id }, data })
    : await db().customer.create({ data });

  await auditLog({
    actorId: input.actorId,
    action: input.id ? "CUSTOMER_UPDATED" : "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    description: `${input.id ? "Updated" : "Created"} customer ${customer.name}.`
  });

  return customer;
}
