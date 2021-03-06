var _ = require('lodash');
var buildQuery = require('./buildQuery');

module.exports = {
  collection(relations, options) {
    const load = sails.db.coreCollection.prototype.load;

    return load.call(this, loadRelations(relations, this), options);
  },
  model(relations, options) {
    const load = sails.db.Model.prototype.load;

    return load.call(this, loadRelations(relations, this), options);
  }
}

function loadRelations(relations, model) {
  const map = {};

  if (_.isString(relations)) map[relations] = relations;
  if (_.isPlainObject(relations)) _.assign(map, relations);
  if (_.isArray(relations)) _.forEach(relations, relation => {
    if (_.isString(relation)) map[relation] = relation;
    if (_.isPlainObject(relation)) _.assign(map, relation);
  });

  _.forEach(map, (params, relation) => {
    const split = _.split(relation, '.');

    // No need to expand single level loads
    if (split.length === 1) return;

    _.forEach(_.initial(split), (item, index) => {
      const key = _(split).take(index + 1).join('.');

      if (!map[key]) map[key] = key;
    });
  });

  // Map our relations to their query builders
  return _.map(map, (params, relation) => {
    if (_.isFunction(params)) return { [relation]: params };

    const relatedData = getRelation(relation, model);

    if (!params || _.isString(params)) params = {};

    return { [relation]: (query) => {
      const table = query._single.table;
      const Model = sails.models[table];

      // Include our defaults for many relations
      const defaults = !_.includes(relatedData.type, 'Many') ? {} : Model.defaultWhere;
      const where = _.defaults({}, params || {}, defaults);

      buildQuery.applyQuery(query, { where }, true, Model);

      // The way bookshelf loads through relations causes thousands of rows to be
      // returned if you load through any model with more than just a few rows
      // the query is fast, but the javascript parsing of the crazy number of rows
      // is slow, so we use distinct here to push more of the cost to postgres instead
      // of js. 10x increase in response time for requests that use through.
      if (relatedData.type === 'belongsTo' && relatedData.throughTarget) {
        query.distinct([`${table}.*`]);
      }
    }};
  });
}

function getRelation(relation, model) {
  if (model instanceof sails.db.Collection) model = new model.model();

  const split = _.split(relation, '.');
  const relationName = _.head(split);
  const deep = _.tail(split);
  let relatedData = {};

  try {
    relatedData = model[relationName]().relatedData;
  } catch (error) {
    return relatedData;
  }

  if (deep.length) return getRelation(_.join(deep, '.'), new relatedData.target());

  return relatedData;
}
