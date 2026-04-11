type SurfaceLocale = 'ko' | 'en';

const SURFACE_LABELS_KO: Record<string, string> = {
  environment: '환경',
  harvest: '수확',
  nutrient: '양액',
  nutrient_correction: '양액 보정',
  pesticide: '병해충',
  physiology: '생육',
  work: '작업',
  protection: '보호',
};

const SURFACE_LABELS_EN: Record<string, string> = {
  nutrient_correction: 'Nutrient correction',
};

function normalizeSurfaceName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function localizeSmartGrowSurfaceName(name: string, locale: SurfaceLocale): string {
  const normalized = normalizeSurfaceName(name);
  if (locale === 'ko') {
    return SURFACE_LABELS_KO[normalized] ?? name;
  }
  return SURFACE_LABELS_EN[normalized] ?? name;
}

export function localizeSmartGrowSurfaceNames(names: string[], locale: SurfaceLocale): string[] {
  return names.map((name) => localizeSmartGrowSurfaceName(name, locale));
}
