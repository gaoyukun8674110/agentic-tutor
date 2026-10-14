export function deriveSelectedMaterialIds(
  materialIds: number[],
  currentSelectedIds: number[],
): number[] {
  const availableMaterialIds = new Set(materialIds);

  if (!materialIds.length) {
    return currentSelectedIds.length ? [] : currentSelectedIds;
  }

  return currentSelectedIds.filter((id) => availableMaterialIds.has(id));
}
