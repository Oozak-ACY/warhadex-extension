import warhammerCom from './adapters/warhammer-com.js';
import elementGames from './adapters/element-games.js';
import waylandGames from './adapters/wayland-games.js';
import philibert from './adapters/philibert.js';

export const adapters = [warhammerCom, elementGames, waylandGames, philibert];

export function findAdapter(url) {
  try {
    return adapters.find((adapter) => adapter.match(url)) ?? null;
  } catch {
    return null;
  }
}
