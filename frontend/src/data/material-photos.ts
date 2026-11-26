// Registro de fotografías de materiales con créditos de autor.
import type { MaterialId } from "@/lib/api/types";

export const materialPhotos: Record<MaterialId, { src: string; credit: string } | null> = {
  plastic: null,
  paper: null,
  cardboard: null,
  metal: null,
  glass: null,
  organic: null,
};
