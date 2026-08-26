export type AppView = 'workspace' | 'logs' | 'settings';

export function shouldShowServerTree(view: AppView): boolean {
  return view === 'workspace';
}
