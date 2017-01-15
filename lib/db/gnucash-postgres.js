var pg = require("pg"),
    _ = require("underscore"),
    moment = require("moment");

var DB = function(server, user, pass) {
    var connString = "postgres://" + user + ":" + pass + "@" + server + "/gnucash";

    return {
        query: function(queryStr, fn) {
            pg.connect(connString, function(err, client, done) {
                if(err) {
                    return console.error("could not connect", err);
                }
                client.query(queryStr, function(err, result) {
                    done();

                    if(err) {
                        return console.error("error running query", err);
                    }
                    var processed = fn(result.rows);
                    return processed;
                });
            });
        }, disconnect: function() {
            pg.end();
        }
    };
};

function isExpense(acct) {
    if (!acct) {
        return false;
    }
    if (acct.name.toLowerCase() === "expenses") {
        return true;
    }
    return isExpense(acct.parent);
} 

var AccountsDAO = function(db) {
    return {
        use: function(fn) {
            var queryStr = "SELECT guid, parent_guid, name from accounts";
            db.query(queryStr, function(accts) {
                var toAcct,
                    l,
                    map = {};

                _.each(accts, function(a) { map[a.guid] = a; });

                toAcct = function(acct) {
                  if (acct.parent_guid) {
                    acct.parent = toAcct(map[acct.parent_guid]);
                  }
                  acct.isExpense = isExpense(acct);
                  acct.qualifiedName = acct.name;
                  if (acct.parent) {
                    acct.qualifiedName = acct.parent.qualifiedName + ":" + acct.name;
                  } else {
                    acct.qualifiedName = acct.name;
                  }
                  return acct;
                };

                l = _.map(accts, function(a) { return toAcct(a); });
                fn(l);
            });
        },

        tree: function(cb) {
          this.use(function(accounts) {
            var groups = _.groupBy(accounts, function(a) { return a.parent_guid; });
            var roots = _.filter(accounts, function(a) { return !a.parent_guid;});

            function tree(roots) {
              return _.map(roots, function(r) {
                var shallowClone = _.clone(r);
                shallowClone.children = tree(groups[r.guid]);
                return shallowClone;
              });
            }
            cb(tree(roots));
          });
        }
    };
};

var dateFmt = function(d) {
    var monthStr,
        month = d.month() + 1;

    if (month < 10) {
        monthStr = "0" + month;
    } else {
        monthStr = month + "";
    }

    return d.year() + "-" + monthStr + "-01";
}

var TransactionsDAO = function(db) {
    return {
        use: function(since, until, likeDescription, fn) {
            var trans, transQuery, whereClause,
                transIds = [];

            whereClause = "where post_date >= '" + dateFmt(since) + "' " +
                "and post_date < '" + dateFmt(until) + "' ";

            if (typeof likeDescription == "function") {
              fn = likeDescription;
            } else {
              whereClause = whereClause + "and description ilike '%" + likeDescription + "%' ";
            }

            transQuery = "SELECT guid, post_date, description " +
                "from transactions " + whereClause +
                "order by post_date desc";

            console.log(transQuery);

            db.query(transQuery, function(tranRecs) {
                if (tranRecs.length === 0) {
                    fn([]);
                    return;
                }
                var splitsQuery = function(tranIds) {
                    var quotedIds = _.map(tranIds, function(id) { 
                        return "'" + id + "'"; 
                    });
                    return "select tx_guid, account_guid, memo, value_num from splits where tx_guid in (" +
                        quotedIds.join(",") + ")";
                };

                transIds = _.map(tranRecs, function(t) { return t.guid; });

                db.query(splitsQuery(transIds), function(splits) {
                    var splitsMap = _.groupBy(splits, function(s) {
                        return s.tx_guid;
                    });
                    trans = _.map(tranRecs, function(t) {
                        return {
                            transaction: t,
                            splits: _.map(splitsMap[t.guid], function(tranSplit) {
                              tranSplit.date = t.post_date;
                              tranSplit.description = t.description;
                              return tranSplit;
                            })
                        };
                    });
                    fn(trans);
                });
            });
        }
    };
};

var BudgetDAO = function(db) {
    return {
        list: function(cb) {
          var budgetQuery = "SELECT * from budgets b, recurrences r where b.guid = r.obj_guid ";

          db.query(budgetQuery, function(budgets) {
            _.each(budgets, function(budget) {
              var start = moment(budget.recurrence_period_start),
                  end = start.clone().add(budget.num_periods, 'months');
              budget.start = start;
              budget.end = end;
            });

            if (budgets.length === 0) {
              return cb([]);
            }
            cb(budgets);
          });
        },

        get: function(guid, cb) {
          // TODO inj attack:(
          var amountsQuery = "SELECT * from budget_amounts where budget_guid = '" + guid + "'";

          db.query(amountsQuery, function(amounts) {
            if (amounts.length === 0) {
              return cb([]);
            }
            cb(amounts);
          });
        }

    };
};

module.exports = {
    DB: DB,
    AccountsDAO: AccountsDAO,
    TransactionsDAO: TransactionsDAO,
    BudgetDAO: BudgetDAO
};
