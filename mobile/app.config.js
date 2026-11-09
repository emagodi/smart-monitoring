// Adds Firebase (needed for Android push) only when google-services.json is present, so builds work before it is added.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(firebase) ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
