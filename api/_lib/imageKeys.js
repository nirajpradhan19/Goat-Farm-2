// The fixed set of images the admin panel is allowed to replace, and where
// the bundled default for each one lives. Keeping this as a whitelist means
// an upload request can never write to an arbitrary Blob path.

const IMAGE_KEYS = {
  favicon: 'assets/svg/favicon.svg',
  logo: 'assets/img/logo-goathub.png',
  'logo-seal': 'assets/svg/logo-goathub.svg',
  'hero-goat': 'assets/svg/hero-goat.svg',
  'about-goats': 'assets/svg/about-goats.svg',
  'goat-standing-icon': 'assets/svg/goat-standing-icon.svg',
  'goat-standing-card': 'assets/svg/goat-standing-card.svg',
  'gallery-1': 'assets/svg/gallery-1.svg',
  'gallery-2': 'assets/svg/gallery-2.svg',
  'gallery-3': 'assets/svg/gallery-3.svg',
  'gallery-4': 'assets/svg/gallery-4.svg',
  'gallery-5': 'assets/svg/gallery-5.svg',
  'gallery-6': 'assets/svg/gallery-6.svg',
  'blog-1': 'assets/svg/blog-1.svg',
  'blog-2': 'assets/svg/blog-2.svg',
  'blog-3': 'assets/svg/blog-3.svg',
  'team-1': 'assets/svg/team-1.svg',
  'team-2': 'assets/svg/team-2.svg',
  'team-3': 'assets/svg/team-3.svg',
  map: 'assets/svg/map.svg',
};

function isValidKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(IMAGE_KEYS, key);
}

module.exports = { IMAGE_KEYS, isValidKey };
