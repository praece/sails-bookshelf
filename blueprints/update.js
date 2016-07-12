var _ = require('lodash');

/**
 * Update One Record
 *
 * An API call to update a model instance with the specified `id`,
 * treating the other unbound parameters as attributes.
 *
 * @param {Integer|String} id  - the unique id of the particular record you'd like to update  (Note: this param should be specified even if primary key is not `id`!!)
 * @param *                    - values to set on the record
 *
 */
module.exports = function updateOneRecord (req, res) {
  // Load the model
  const Model = sails.models[req.options.model];
  
  // Load any files and parse the body if necessary
  const files = req._fileparser && req._fileparser.upstreams;
  const options = { currentUser: req.user };
  const params = files ? JSON.parse(req.params.all().body) : req.params.all();
  const model = Model.forge({id: req.param('id')});

  // Map our files
  if (files) {
    options.files = _.compact(_.map(files, file => {
      const path = file.fieldName;
      const fields = _.keys(model.relationships);
      if (_.includes(fields, path)) return req.file(path);
    }));
  }

  // Grab and update the instance
  model.fetch()
    .call('set', params)
    .call('saveGraph', null, options)
    .call('refresh')
    .call('toJSON')
    .then(res.ok)
    .catch(function(err) {
      sails.log.error(err);
      res.serverError(err);
    });
};
