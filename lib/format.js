var _ = require('lodash');

module.exports = function format(attributes) {
  const format = sails.db.Model.prototype.format;

  // Stringify json arrays before putting them in the database
  _.forEach(attributes, (attribute, key) => {
    if (_.isArray(attribute)) attributes[key] = JSON.stringify(attribute);
  });

  return format.call(this, attributes);
};
