var twitter = {};

twitter.toObject = function(userSourceAuths) {
  return {
    id: 'twitter',
    name: 'Twitter',
    enabled: false,
    logoGlyphPath: '/images/logos/twitter-glyph.svg'
  };
};

module.exports = twitter;