export interface PaginationConfig {
  ITEMS_PER_PAGE: number;
}

export const LIVE_SEARCH_DEBOUNCE_MS = 300;

export const PAGINATION_DEFAULTS: PaginationConfig = {
  ITEMS_PER_PAGE: 10
};
