// Fetches tournament settings once per page load and applies the parts
// that are common to every page: event title, and gating a page off if the
// organizers have disabled that section.
const Branding = (() => {
  let settingsPromise = null;

  function get() {
    if (!settingsPromise) settingsPromise = Api.get('/settings');
    return settingsPromise;
  }

  function applyTitle(settings) {
    document.querySelectorAll('[data-event-title]').forEach((el) => {
      el.textContent = settings.eventTitle;
    });
    if (document.title.includes(' -- ')) {
      const suffix = document.title.split(' -- ')[0];
      document.title = `${suffix} -- ${settings.eventTitle}`;
    } else {
      document.title = settings.eventTitle;
    }
  }

  // pageKey matches a key in settings.pages. If that page is disabled,
  // replaces #main content with a notice instead of the normal page body.
  async function init(pageKey) {
    let settings;
    try {
      settings = await get();
    } catch (err) {
      return null;
    }
    applyTitle(settings);
    if (pageKey && settings.pages && settings.pages[pageKey] === false) {
      const main = document.querySelector('main');
      if (main) {
        main.innerHTML = `
          <div class="card">
            <h2>Section unavailable</h2>
            <p class="muted">This section has been turned off by the tournament organizers. Check back later.</p>
            <a href="dashboard.html">Back to Menu</a>
          </div>`;
      }
      return null;
    }
    return settings;
  }

  function divisionLabel(settings, key) {
    return settings?.divisions?.[key]?.label || { men: "Men's", women: "Women's", kids: 'Kids' }[key] || key;
  }

  return { get, init, divisionLabel };
})();
