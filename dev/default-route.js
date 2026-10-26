// The DEV Pi uses the new interface by default. Preserve the existing worker URL.
(() => {
  const target = new URL(location.href);
  if (!['/', '/index.html'].includes(target.pathname)
      || target.searchParams.get('worker') === '1'
      || target.searchParams.get('original') === '1') return;
  target.pathname = '/dev/index.html';
  target.searchParams.set('client', '1');
  target.searchParams.delete('worker');
  location.replace(target.href);
})();
