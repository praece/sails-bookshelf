var _       = require('lodash');
var buildQuery = require('./buildQuery');

module.exports = function populate(relations, options) {
  // Normalize an array of relations to a relation keyed object
  if (_.isArray(relations)) {
    relations = _.mapValues(_.keyBy(relations), () => null);
  }

  // Map our relations to their query builders
  var related = _.map(relations, (params, relation) => {
    return { [relation]: (query) => {
      const defaults = sails.models[query._single.table].defaultWhere;
      const where = _.defaults({}, params || {}, defaults);

      buildQuery.applyQuery(query, { where }, true);
    }};
  });

  return this.load(related, options);
};