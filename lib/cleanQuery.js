module.exports = function setAmount(collection, columns, options) {
  const table = options.query._single.table;

  // If a column does not have a table assume it references the base table for the query.
  // This prevents errors when manipulating queries on the fetching event.
  _.forEach(options.query._statements, (statement) => {
    // Knex or bookshelf uses 1 = 0 to quick fail queries, so don't break those.
    const isColumn = _.isString(statement.column);
    const noTable = !_.includes(statement.column, '.');

    if (noTable && isColumn) statement.column = `${table}.${statement.column}`;
  });
};
