var _ = require('lodash');
var Promise = require('bluebird');
var omitOptions = ['query', 'previousAttributes', 'method', 'graphData', 'changed', 'files', 'autoCommit', 'nested'];

module.exports = {
  setup,
  save
};

function setup(model, options) {
  const graphing = _.map(model.relationships, function(relationship, key) {
    const data = model.attributes[key];

    // If the relation is an array grab it so we can save the nested relations
    if (_.isArray(data) || _.isPlainObject(data)) {
      const graphData = _.clone(data);
      model.unset(key);
      
      return {
        data: graphData,
        relation: model.related(key),
        key
      };
    }
  });

  options.graphData = _.compact(graphing);

  if (_.isEmpty(options.graphData)) return;

  return Promise.resolve()
    .then(() => {
      // If we aren't already running a transaction start one here so
      // nested save can be unwound on a deep failure
      return new Promise(resolve => {
        if (!options.nested && !options.transacting) {
          sails.db.transaction(resolve)
            // We handle propagating the original reason for errors elsewhere so here we can
            // just noop so bluebird doesn't complain about an uncaught rejection
            .catch(_.noop);
        } else {
          resolve();
        }
      })
      .then(t => {
        if (t) {
          options.transacting = t;
          options.autoCommit = true;
        }
      });
    })
    .then(function() {
      return model.triggerThen('savingnested', model, options.graphData, options);
    })
    .then(function() {
      const toRelations = _.filter(options.graphData, graph => {
        return _.includes(['belongsTo', 'morphTo'], graph.relation.relatedData.type)
      });

      return Promise.map(toRelations, graph => {
        return graph.relation.set(graph.data).save(null, getOptions(model, options))
          .then(saved => {
            model.set(graph.key, saved.id);
          });
      });
    });
}

function save(model, options) {
  if (_.isEmpty(options.graphData)) return;

  const manyRelations = _.filter(options.graphData, graph => {
    return _.includes(['morphMany', 'hasMany', 'belongsToMany'], graph.relation.relatedData.type)
  });

  return Promise.resolve()
    .then(() => {
      return Promise.map(manyRelations, graph => {
        const relation = model[graph.key]();
        const type = graph.relation.relatedData.type;

        if (type === 'belongsToMany') {
          return relation.fetch({ transacting: _.get(options, 'transacting') })
            .then(fetched => {
              const current = fetched.toJSON();
              const add = _.reject(graph.data, '_detach');
              const detach = _(graph.data).filter('_detach').map('id').value();
              const attach = _(add).differenceBy(current, 'id').map('id').value();

              return Promise.all([
                detach.length ? relation.detach(detach, getOptions(model, options)) : null,
                attach.length ? relation.attach(attach, getOptions(model, options)) : null
              ]);
            })
        }

        return Promise.map(graph.data, graphItem => {
          if (graphItem._delete) {
            if (!graphItem.id) return;

            return new relation.model({ id: graphItem.id }).destroy(getOptions(model, options));
          }

          return relation.create(graphItem, getOptions(model, options))
            .then(saved => {
              graph.relation.add(saved);
            });
        })
      });
    })
    .tap(() => {
      if (options.autoCommit) return options.transacting.commit();
    })
    .then(function(output) {
      return model.triggerThen('savednested', model, options.graphData, options);
    })
    .catch(function(err) {
      if (options.autoCommit) return options.transacting.rollback().throw(err);
      throw err;
    });
}

function getOptions(model, options) {
  const nested = _.defaults({ [model.tableName]: { method: options.method, data: model.toJSON() } }, options.nested);
  return _.defaults({ nested }, _.omit(options, omitOptions));
}
