// Rilo Content Script - Context Menu & Link Detection
document.addEventListener('contextmenu', (e) => {
  const target = e.target;
  let linkUrl = '';

  if (target.tagName === 'A' && target.href) {
    linkUrl = target.href;
  } else {
    const parentLink = target.closest('a');
    if (parentLink && parentLink.href) {
      linkUrl = parentLink.href;
    }
  }

  if (linkUrl) {
    window.riloLastContextUrl = linkUrl;
  }
}, true);
