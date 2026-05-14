import { db } from "./database";

export async function listCategories() {
  return db().category.findMany({
    orderBy: { name: "asc" },
    include: {
      subcategories: {
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } }
      }
    }
  });
}

export async function upsertCategory(input: { id?: string; name: string }) {
  if (input.id) {
    return db().category.update({ where: { id: input.id }, data: { name: input.name } });
  }
  return db().category.create({ data: { name: input.name } });
}

export async function getCategoryDeleteInfo(id: string) {
  const category = await db().category.findUnique({
    where: { id },
    include: {
      subcategories: {
        select: {
          id: true,
          name: true,
          products: { select: { name: true, stockLevel: true } },
        }
      }
    }
  });
  if (!category) throw new Error("Category not found");

  const subcats = category.subcategories.map(s => ({
    id: s.id,
    name: s.name,
    productCount: s.products.length,
    totalStock: s.products.reduce((sum, p) => sum + p.stockLevel, 0),
    products: s.products.map(p => ({ name: p.name, stock: p.stockLevel }))
  }));

  return {
    id: category.id,
    name: category.name,
    subcategories: subcats,
    totalProducts: subcats.reduce((sum, s) => sum + s.productCount, 0),
    totalStock: subcats.reduce((sum, s) => sum + s.totalStock, 0)
  };
}

export async function deleteCategory(id: string) {
  const subcatIds = (await db().subcategory.findMany({ where: { categoryId: id }, select: { id: true } })).map(s => s.id);
  if (subcatIds.length > 0) {
    const productCount = await db().product.count({ where: { subcategoryId: { in: subcatIds } } });
    if (productCount > 0) {
      throw new Error(`Cannot delete category: ${productCount} product(s) are assigned to its subcategories.`);
    }
  }
  return db().category.delete({ where: { id } });
}

export async function upsertSubcategory(input: { id?: string; name: string; categoryId: string }) {
  if (input.id) {
    return db().subcategory.update({ where: { id: input.id }, data: { name: input.name, categoryId: input.categoryId } });
  }
  return db().subcategory.create({ data: { name: input.name, categoryId: input.categoryId } });
}

export async function deleteSubcategory(id: string) {
  const productCount = await db().product.count({ where: { subcategoryId: id } });
  if (productCount > 0) {
    throw new Error(`Cannot delete subcategory: ${productCount} product(s) are assigned to it.`);
  }
  return db().subcategory.delete({ where: { id } });
}
