var _       = require('lodash');
var buildQuery = require('./buildQuery');

module.exports = function populate(relations, options) {
  // Normalize an array of relations to a relation keyed object
  if (_.isArray(relations)) {
    relations = _.mapValues(_.keyBy(relations), () => null);
  }

  // Map our relations to their query builders
  var related = _.map(relations, (where, relation) => {
    where = _.defaults(where || {}, getDefaultWhere(this, relation));

    return { [relation]: (query) => buildQuery.applyQuery(query, { where }) };
  });

  return this.load(related, options);
};

function getDefaultWhere(model, relation) {
  var relations = relation.split('.');

  _.forEach(relations, (key) => {
    // If this is a collection get an instance of the underlying Model.
    if (model instanceof sails.Collection) model = new model.model();
    model = model[key]();
  });

  return model.relatedData.target.defaultWhere;
}