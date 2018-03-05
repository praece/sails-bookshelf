var _ = require('lodash');
var Promise = require('bluebird');


/**
 * Update Multiple Records
 *
 * An API call to update model instances
 *
 * @param * - an array of records
 *
 */
module.exports = function updateOneRecord (req, res) {
  // Load the model
  const Model = sails.models[req.options.model];
  const data = _.toArray(req.params.all());

  return Promise.map(data, params => {
    const options = { currentUser: req.user };

    return new Model({ id: params.id })
      .fetch()
      .call('set', params)
      .call('saveGraph', null, options)
      .call('refresh')
      .call('toJSON')
  })
    .then(res.ok)
    .catch(function(err) {
      sails.log.error(err);
      res.serverError(err);
    });
};
