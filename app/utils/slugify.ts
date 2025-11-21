export function slugify(value: string): string {
  const base = (value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[#♯]/g, '-sharp')
    .replace(/[♭]/g, '-flat')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'composer';
}
