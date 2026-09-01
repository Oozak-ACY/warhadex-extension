export function observeUrlChanges(win, callback, delayMs = 400) {
  const { history } = win;
  let last = win.location.href;
  let timer;

  const check = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      if (win.location.href === last) return;
      last = win.location.href;
      callback(last);
    }, delayMs);
  };

  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function (...args) {
    pushState.apply(this, args);
    check();
  };
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    check();
  };

  win.addEventListener('popstate', check);

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    win.removeEventListener('popstate', check);
    win.clearTimeout(timer);
  };
}
