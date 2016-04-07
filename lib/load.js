var _ = require('lodash');
var buildQuery = require('./buildQuery');

module.exports = {
  collection(relations, options) {
    const load = sails.db.coreCollection.prototype.load;

    return load.call(this, loadRelations(relations), options);
  },
  model(relations, options) {
    const load = sails.db.Model.prototype.load;

    return load.call(this, loadRelations(relations), options);
  }
}

function loadRelations(relations) {
  const map = {};

  if (_.isString(relations)) map[relations] = relations;
  if (_.isPlainObject(relations)) _.assign(map, relations);
  if (_.isArray(relations)) _.forEach(relations, relation => {
    if (_.isString(relation)) map[relation] = relation;
    if (_.isPlainObject(relation)) _.assign(map, relation);
  });

  // Map our relations to their query builders
  return _.map(map, (params, relation) => {
    if (_.isString(params)) return params;
    if (_.isFunction(params)) return { [relation]: params };

    return { [relation]: (query) => {
      const defaults = sails.models[query._single.table].defaultWhere;
      const where = _.defaults({}, params || {}, defaults);

      buildQuery.applyQuery(query, { where }, true);
    }};
  });
}