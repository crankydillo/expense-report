#!/usr/bin/env node

var dbUser = process.argv[2],
    dbPass = process.argv[3],
    path = require("path"),
    express = require("express"),
    moment = require("moment"),
    _ = require("underscore"),
    async = require("async"),
    db = require("./lib/db/gnucash-postgres"),
    transactions = require("./lib/transaction"),
    app = express(),
    gnucashDB = db.DB("localhost", dbUser, dbPass),
    accountsDAO = db.AccountsDAO(gnucashDB),
    transactionsDAO = db.TransactionsDAO(gnucashDB),
    budgetDAO = db.BudgetDAO(gnucashDB);

function out(req, res, obj) {
    var body;
    if (req.query.pp) {
        body = JSON.stringify(obj, null, 4);
    } else {
        body = JSON.stringify(obj);
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
}

app.configure(function() {
    app.use(express.static(__dirname + "/public"));
});

app.get("/budgets", function(req, res) {
  budgetDAO.list(function(budgets) {
    out(req, res, budgets);
  });
});

app.get("/budgets/:id", function(req, res) {
  budgetDAO.get(req.params.id, function(budgets) {
    out(req, res, budgets);
  });
  /*
  accountsDAO.tree(function(tree) {
    out(req, res, tree[0]);
  });
 */
});

app.get("/t", function(req, res) {
  accountsDAO.tree(function(t) { out(req, res, t[0]); });
});
 
app.get("/budgets/:id/report", function(req, res) {
  async.parallel([
    function(cb) {
      budgetDAO.get(req.params.id, function(budget) {
        cb(null, budget);
      });
    },
    function(cb) {
      accountsDAO.tree(function(t) { cb(null, t[0]); });
    }
  ], 
  function(err, results) {
    var budget = results[0],
        accounts = results[1];

    function addBudget(acct) {
      var budgetedVal = _.find(budget, function(ba) { 
        return ba.account_guid == acct.guid;
      });
      if (budgetedVal) {
        acct.budgeted_value = budgetedVal;
        acct.budgeted_value.amount = 
          parseFloat(budgetedVal.amount_num) / parseFloat(budgetedVal.amount_denom);
      } else {
        acct.budgeted_value = {};
        acct.budgeted_value.amount = 0.0;
      }
      _.each(acct.children, _.partial(addBudget));
      acct.total_budgeted_amount = acct.budgeted_value.amount + 
        _.reduce(acct.children, function(sum, c) { 
            return sum + c.budgeted_value.amount;
          }, 0);
    }

    addBudget(accounts);
    out(req, res, accounts);
  });

  function getValue(acct) {
    if (!acct.budgeted_value) {
      return 0;
    }

  }
});

app.get("/trans", function(req, res){
  var su = sinceUntil(req.query),
  since = su.since,
  until = su.until;

  transactionsDAO.use(since, until, function(trans) {
    var months = transactions.months(trans);
    out(req, res, months);
  });
});

var sinceUntil = function(queryParams) {
  function dt(dateStr) {
    return moment(dateStr, "YYYY-MM");
  }

  var since, until, months;

  if (!queryParams.until) {
    // gotta be a better way..
    until = moment(moment().format('YYYY-MM'), 'YYYY-MM').add('months', 1); 
  } else {
    until = dt(queryParams.until);
  }

  if (!queryParams.since) {
    if (!queryParams.months) {
      months = 6;
    } else {
      months = queryParams.months;
    }
    since = moment(until);
    since.add('months', -1 * months);
  } else {
    since = dt(queryParams.since);
  }

  return {
      since: since,
      until: until
  };
}

app.get("/res/monthly-totals", function(req, res){
  var useTransFn,
      su = sinceUntil(req.query),
      since = su.since,
      until = su.until;

  useTransFn = function(trans) {
    accountsDAO.use(function(accts) {
      var months = transactions.fillEmptyMonths(since, until,
              transactions.expensesByMonth(trans, accts)),
          sortedMonths = _.sortBy(months, function(m) {
            return -1 * m.total;
          }),
          allMonths = [].concat.apply([], 
              _.map(sortedMonths, function(m) { return m.monthlyTotals; })),
          grouped = _.groupBy(allMonths, function(m) { return m.month; });
          summed = _.map(grouped, function(ms, k) {
            return {
              month: k,
              total: _.reduce(ms, function(memo, m) { 
                return memo + m.total; 
              }, 0)
            };
          }); 
          summary = {
            summaries: summed,
            totalSpent: _.reduce(summed, function(memo, monthSum) {
              return memo + monthSum.total;
            }, 0),
            acctSums: sortedMonths
          };
      out(req, res, summary);
    });
  };

  if (req.query.q) {
    transactionsDAO.use(since, until, req.query.q, useTransFn);
  } else {
    transactionsDAO.use(since, until, useTransFn);
  }
});

app.get('/res/expenses/:expName/:month', function(req, res) {
  var useTransFn,
      month = moment(req.params.month, "YYYY-MM"),
      nextMonth = moment(month).add('months', 1);

  useTransFn = function(trans) {
    accountsDAO.use(function(accts) {
      // TODO handle case where expense isn't found.
      var acct = _.find(accts, function(a) { return a.qualifiedName === req.params.expName; }),
          months = transactions.monthTrans(trans, [acct]),
          splits = {
            msg: 'hi!',
            splits: function() {
              if (months && months.length > 0) {
                if (months[0].expenses && months[0].expenses.length > 0) {
                  return months[0].expenses[0].splits;
                }
                return [];
              }
              return [];
            }()
          }
      // assert that we only have 1 month and 1 expense?
      out(req, res, splits);
    });
  };

  if (req.query.q) {
   transactionsDAO.use(month, nextMonth, req.query.q, useTransFn);
  } else {
    transactionsDAO.use(month, nextMonth, useTransFn);
  }
});

app.get("/res/monthly-trans", function(req, res){
  var su = sinceUntil(req.query),
  since = su.since,
  until = su.until;

  transactionsDAO.use(since, until, function(trans) {
    accountsDAO.use(function(accts) {
      var months = transactions.monthTrans(trans, accts);
      out(req, res, months);
    });
  });
});

app.get("/accounts", function(req, res){
  accountsDAO.use(function(accts) {
    var names = _.map(accts, function(a) { return a.name; });
    out(req, res, names);
  });
});

app.get("/accounts/:id", function(req, res) {
  accountsDAO.use(function(accts) {
    var acct = _.find(accts, function(a) {
      return a.name === req.params.id;
    });
    out(req, res, acct);
  });
});

app.listen(3000);
console.log("Listening on port 3000");

process.on('exit', function () {
  console.log('Disconnecting DB.');
  gnucashDB.disconnect();
});
