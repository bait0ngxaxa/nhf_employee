export interface PaginationConfig {
  ITEMS_PER_PAGE: number;
}

export const PAGINATION_DEFAULTS: PaginationConfig = {
  ITEMS_PER_PAGE: 10
};

export const CSV_REQUIRED_FIELDS: string[] = [
  'firstName',
  'lastName',
  'email',
  'position',
  'departmentId'
];

export const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'สถานะทั้งหมด' },
  { value: 'ACTIVE', label: 'ทำงานอยู่' },
  { value: 'INACTIVE', label: 'ไม่ทำงาน' },
  { value: 'SUSPENDED', label: 'ถูกระงับ' }
];
