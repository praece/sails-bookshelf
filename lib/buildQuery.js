var _ = require('lodash');

module.exports = { buildQuery, applyQuery };

function buildQuery(params) {
  var Model = this;
  params = params || {};
  params.where = _.defaults(params.where || {}, this.defaultWhere);

  return this.query(function(qb) {
    applyQuery(qb, params, false, Model);
  });
}

function applyQuery(query, params, includeTable, Model) {
  var model = new Model();
  const whereQuery = params.flattenWhere ? query : query.clone();
  const bind = { model, query, joins: [], Model };
  const whereBind = _.assign({}, bind, { query: whereQuery, joins: [] });

  if (params.sort) buildSort.call(bind, params.sort);
  if (params.limit) query.limit(params.limit);
  if (params.offset) query.offset(params.offset);

  const where = _.map(params.where, buildWhere.bind(whereBind));
  _.forEach(where, applyClause.bind(whereBind));

  if (params.flattenWhere) return;

  whereQuery.select(`${model.tableName}.${model.idAttribute}`);
  query.whereIn(`${model.tableName}.${model.idAttribute}`, whereQuery);
};

function buildWhere(value, field)  {
  // Create a sub array for or/and requests
  if (field === 'and' || field === 'or') {
    return { group: field, where: _.map(value, buildWhere.bind(this)) }
  }

  // Handle multiple values for the same field
  if (_.isPlainObject(value) && _.keys(value).length > 1) {
    const where = _.map(value, (v, op) => buildWhere.call(this, { [op]: v }, field));
    return { group: 'and', where };
  }

  // Handle multiple values that contain an and / or
  if (_.isPlainObject(value) && (_.keys(value)[0] === 'or' || _.keys(value)[0] === 'and')) {
    const where = _.map(value[_.keys(value)[0]], (v, op) => buildWhere.call(this, { [op]: v }, field));
    return { group: _.keys(value)[0], where };
  }

  // Get nested values for special operators
  const clause = getNestedValue({ field, value, table: this.model.tableName, model: this.model })

  // Apply join if necessary
  if (_.includes(field, '.')) {
    const relations = _.split(field, '.');
    clause.model = applyJoin.call(this, _.initial(relations));
    clause.field = _.last(relations);
    clause.table = clause.model.tableName;
  }

  // Trigger building query event
  clause.model.trigger('buildingQuery', this.query, clause);

  return clause;
}

function getNestedValue(clause) {
  if (_.isPlainObject(clause.value)) {
    const op = _.keys(clause.value)[0];
    const not = op === '!' || op === 'not';

    clause.value = clause.value[op];
    clause.operator = not ? false : op;
    if (_.isArray(clause.value)) clause.operator = 'in';
    if (not) clause.not = true;

    getNestedValue(clause);
  }

  return clause;
}

function applyJoin(relations) {
  var name = _.head(relations);
  var modelName = this.model.tableName;

  if (!this.model[name]) {
    throw new Error(`${name} is not a relation on ${modelName}`);
  }

  var relation = this.model[name]().relatedData;
  var relationInstance = new relation.target();
  var has = _.includes(['hasOne', 'hasMany', 'morphOne', 'morphMany'], relation.type);
  var morph = _.includes(['morphTo', 'morphMany', 'morphOne'], relation.type);
  var manyToMany = _.includes(['belongsToMany'], relation.type);

  // Grab the matching parameters
  var table = relation.targetTableName;
  var parentTable = relation.parentTableName;
  var key = relation.targetIdAttribute;
  var foreignKey = morph ? relation.columnNames[1] : relation.foreignKey;

  if (manyToMany) {
    // Set up the join columns
    var joinTable = relation.joinTableName;
    var joinChildColumn = joinTable + '.' + foreignKey;
    var joinParentColumn = parentTable + '.' + relation.parentIdAttribute;

    this.query.leftJoin(joinTable, joinChildColumn, '=', joinParentColumn);

    // Set the parent table and key to match the join table
    parentTable = joinTable;
    foreignKey = relation.otherKey;
    key = relation.targetIdAttribute;
  };

  // Handle has versus belongsTo styles
  var childColumn = table + '.' + (has ? foreignKey : key);
  var parentColumn = parentTable + '.' + (has ? key : foreignKey);

  if (!_.includes(this.joins, table)) {
    this.joins.push(table);
    this.query.leftJoin(table, childColumn, '=', parentColumn);

    // Add the model logic for a polymorphic association
    if (morph) {
      var morphKey = relation.columnNames[0];
      var morphColumn = table + '.' + morphKey;
      this.query.where(morphColumn, '=', parentTable);
    }
  }

  relations = _.tail(relations);
  const bind = { query: this.query, model: relationInstance, joins: this.joins };

  // Handle nested relations
  if (!_.isEmpty(relations)) return applyJoin.call(bind, relations);

  return relationInstance;
}

function applyClause(clause, or) {
  const { query } = this;
  let { table, field, value, operator, not, group, where, model } = clause;
  let method = 'where';

  if (not) method = method + '-not';
  if (or === 'or') method = 'or-' + method;

  // In operator
  if (operator === 'in') {
    method = method + '-in';
    operator = false;
  }

  // Null checking
  if ((value === '' || value === null) && (!operator || operator === 'is')) {
    method = method + '-null';
    operator = false;
  }

  // Special cases for contains, starts with, ends with
  if (_.includes(['contains', 'startsWith', 'endsWith'], operator)) {
    if (operator === 'contains') value = '%' + value + '%';
    if (operator === 'startsWith') value = value + '%';
    if (operator === 'endsWith') value = ' %' + value;
    operator = 'ilike';
  }

  // Camel case the method name and bind it to the query builder
  clause.method = query[_.camelCase(method)].bind(query);

  if (group) {
    return clause.method(function() {
      _.forEach(where, clause => applyClause.call({ query: this, model }, clause, group));
    });
  }

  model.trigger('applyingQuery', query, clause);

  var allowedFields = _.keys(model.constructor.attributes)
    .concat(_.keys(model.relationships))
    .concat(['updatedAt', 'createdAt', model.idAttribute]);

  // If this field doesn't exist on the current instance return
  if (!_.includes(allowedFields, field)) return;

  // If there is no operator let where guess it based on the field or value
  if (!operator) return clause.method(table + '.' + field, value);

  // Special operators
  if (operator === 'is distinct from') return query.whereRaw('?? is distinct from ?', [table + '.' + field, value]);

  return clause.method(table + '.' + field, operator, value);
}

function buildSort(sort) {
  // Check if we have an array or just a single sort param
  if (_.isArray(sort)) {
    _.forEach(sort, column => {
      applySort.call(this, column);
    });
  } else {
    applySort.call(this, sort);
  }
}

function applySort(sort) {
  let table = this.model.tableName;
  let [field, direction] = sort.split(' ');

  if (_.includes(field, '.')) {
    const relations = _.split(field, '.');
    const model = applyJoin.call(this, _.initial(relations));
    field = _.last(relations);
    table = model.tableName;
  }

  this.query.orderBy(`${table}.${field}`, direction)
}
