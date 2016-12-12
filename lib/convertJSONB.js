var _ = require('lodash');

module.exports = function validation(model) {
  const relationships = _.keys(model.relationships);

  _.forEach(model.attributes, (attribute, key) => {
    // Never convert a relationship to jsonb
    if (_.includes(relationships, key)) return;

    // After removing relationships if there are any fields left that have an array as their value stringify them
    if (_.isArray(attribute)) model.set(key, JSON.stringify(model.get(key)));
  });
};
