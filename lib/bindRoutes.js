var _ = require('lodash');

module.exports = function bindRoutes() {
  sails.modules.loadModels(function(err, models) {
    sails.models = sails.models || {};

    _.forEach(models, function(model) {
      global[model.globalId] = model;
      sails.models[model.identity] = model;

      if (!model.noRest && sails.middleware.controllers[model.identity]) {
        bindRoute('get /api/' + model.identity, 'find', model.identity);
        bindRoute('post /api/' + model.identity, 'create', model.identity);
        bindRoute('get /api/' + model.identity + '/count', 'count', model.identity);
        bindRoute('get /api/' + model.identity + '/:id', 'findOne', model.identity);
        bindRoute('put /api/' + model.identity, 'updatemany', model.identity);
        bindRoute('put /api/' + model.identity + '/:id', 'update', model.identity);
        bindRoute('delete /api/' + model.identity + '/:id', 'destroy', model.identity);
      }
    });
  });
}

function bindRoute(path, action, model) {
  var options = _.assign({model: model, action: action, controller: model}, sails.config.blueprints);
  var actions = sails.middleware.controllers[model][action.toLowerCase()];
  sails.router.bind(path, actions, null, options);
}