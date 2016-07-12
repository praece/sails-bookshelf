var _ = require('lodash');

/**
 * Create Record
 *
 * post /:modelIdentity
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 * @param {*} * - other params will be used as `values` in the create
 */
module.exports = function createRecord (req, res) {
  // Load the model
  const Model = sails.models[req.options.model];
  
  // Load any files and parse the body if necessary
  const files = req._fileparser && req._fileparser.upstreams;
  const options = { currentUser: req.user };
  const params = files ? JSON.parse(req.params.all().body) : req.params.all();
  const model = Model.forge(_.defaults(params, req.options.values));

  // Map our files
  if (files) {
    options.files = _.compact(_.map(files, file => {
      const path = file.fieldName;
      const fields = _.keys(model.relationships);
      if (_.includes(fields, path)) return req.file(path);
    }));
  }

  // Create and save the new instance
  model.saveGraph(null, options)
    .call('refresh')
    .call('toJSON')
    .then(res.created)
    .catch(function(err) {
      sails.log.error(err);
      res.serverError(err);
    });
};