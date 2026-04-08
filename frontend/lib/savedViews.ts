export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string | boolean | null>;
}

const getStorageKey = (page: string) => `bwt_saved_views_${page}`;

export function getSavedViews(page: string): SavedView[] {
  if (typeof window === 'undefined') return [];
  const key = getStorageKey(page);
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data) as SavedView[];
  } catch (e) {
    console.error('Failed to parse saved views', e);
    return [];
  }
}

export function saveView(page: string, name: string, filters: Record<string, any>): SavedView {
  const views = getSavedViews(page);
  const newView: SavedView = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    name,
    filters
  };
  views.push(newView);
  if (typeof window !== 'undefined') {
    localStorage.setItem(getStorageKey(page), JSON.stringify(views));
  }
  return newView;
}

export function deleteView(page: string, id: string): void {
  const views = getSavedViews(page);
  const newViews = views.filter(v => v.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(getStorageKey(page), JSON.stringify(newViews));
  }
}
