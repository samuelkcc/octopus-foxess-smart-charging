// The DEV Pi has one client interface. Preserve the internal worker URL.
(() => {
  const target = new URL(location.href);
  if (!['/', '/index.html', '/dev/index.html'].includes(target.pathname)
      || target.searchParams.get('worker') === '1') return;
  target.pathname = '/app/index.html';
  target.searchParams.set('client', '1');
  target.searchParams.delete('worker');
  target.searchParams.delete('original');
  location.replace(target.href);
})();
