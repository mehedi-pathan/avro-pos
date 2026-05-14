import { db } from "./database";

export async function listSuppliers() {
  return db().supplier.findMany({ orderBy: { name: "asc" } });
}

export async function upsertSupplier(input: {
  actorId?: string;
  id?: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}) {
  const data = {
    name: input.name,
    contactPerson: input.contactPerson || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    notes: input.notes || null
  };
  if (input.id) {
    return db().supplier.update({ where: { id: input.id }, data });
  }
  return db().supplier.create({ data });
}

export async function deleteSupplier(id: string) {
  return db().supplier.delete({ where: { id } });
}
