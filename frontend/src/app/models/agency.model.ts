export interface CFRReference {
  title: number;
  chapter?: string;
  subtitle?: string;
}

export interface Agency {
  name: string;
  short_name?: string;
  display_name: string;
  sortable_name: string;
  slug: string;
  children: Agency[];  // Required array, might be empty
  cfr_references: CFRReference[];  // Required array, might be empty
}
