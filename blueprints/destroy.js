/**
 * Destroy one record
 *
 * An API call to destroy a model instance with the specified `id`
 *
 * @param {Integer|String} id  - the unique id of the particular record you'd like to update  (Note: this param should be specified even if primary key is not `id`!!)
 * @param *                    - values to set on the record
 *
 */
module.exports = function destroyOneRecord (req, res) {
  // Load the model
  var Model = sails.models[req.options.model];

  // Grab and destroy the instance
  Model.forge({id: req.param('id')})
    .destroy()
    .call('toJSON')
    .then(function() {
      res.ok();
    })
    .catch(function(err) {
      sails.log.error(err);
      res.serverError(err);
    });
};
