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
  var Model = sails.models[req.options.model];

  // Grab and update the instance
  sails.db.transaction(function(t) {
    return Model.forge({id: req.param('id')})
      .save(req.params.all(), {transacting: t})
      .then(function(created) {
        res.created(created.toJSON());
      })
      .catch(function(err) {
        sails.log.error(err);
        res.serverError(err);
      });
  })
  .catch(function(err) {
    sails.log.error(err);
  });
};
