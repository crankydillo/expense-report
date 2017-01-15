var _ = require("underscore"),
    moment = require("moment");

function zeroPad(val, length) {
  var tmp = '', 
      ctr = 0, 
      need = length - val.length;

  if (need <= 0) {
    return val;
  }

  for (ctr = 0; ctr < need; ctr++) {
    tmp += '0';
  }
  return tmp + val;
}

var months = function(trans) {
  var months = _.groupBy(trans, function(t) {
    var year = 1900 + t.transaction.post_date.getYear(),
      month = t.transaction.post_date.getMonth() + 1;
    return year + "-" + month;
  });

  return _.map(months, function(m, key) {
    return {
      month: key,
         transactions: m
    };
  });
};

var monthTrans = function(trans, accts) {
  var monthss = months(trans),
      numAccounts = accts.length,
      accountsMap = {},
      ctr;

  // Why can't I do this with _.reduce?
  for (ctr = 0; ctr < numAccounts; ctr++) {
    accountsMap[accts[ctr].guid] = accts[ctr];
  }

  var splits = _.map(monthss, function(m) {
    var monthSplits = _.reduce(m.transactions, function(memo, tran) { 
      var expenses = _.filter(tran.splits, function(split) {
        var acct = accountsMap[split.account_guid];
        return acct && acct.isExpense;
      });
      return memo.concat(expenses);
    }, []);
    var grouped = _.groupBy(monthSplits, function(s) { 
      return s.account_guid;
    });

    return {
      month: m.month,
      expenses: _.map(grouped, function(splits, key) {
        return {
          account: accountsMap[key].qualifiedName,
          splits: splits
        };
      })
    }
  });

  return splits;
};

var monthSums = function(trans, accts) {
  return _.map(monthTrans(trans, accts), function(month) {
      var expenses = _.map(month.expenses, function(exp) {
        return {
          account: exp.account,
          total: _.reduce(exp.splits, function(memo, split) {
            return memo + parseInt(split.value_num);
          }, 0)
        };
      }), sorted = _.sortBy(expenses, function(exp) {
          return exp.total;
      });

    return {
      month: month.month,
      expenses: sorted
    };
  });
};

var expensesByMonth = function(trans, accts) {
  var accountsMap = {},
      ctr;

  // Why can't I do this with _.reduce?
  for (ctr = 0; ctr < accts.length; ctr++) {
    accountsMap[accts[ctr].guid] = accts[ctr];
  }

  var splits = _.reduce(trans, function(memo, tran) {
    var expenses, qualifiedExpenses;

    expenses = _.filter(tran.splits, function(split) {
      return accountsMap[split.account_guid].isExpense;
    });
    
    qualifiedExpenses = _.map(expenses, function(exp) {
      return {
        name: accountsMap[exp.account_guid].qualifiedName,
        date: tran.transaction.post_date,
        amount: exp.value_num,
        memo: exp.memo
      };
    });

    return memo.concat(qualifiedExpenses);
  }, []);

  var expenseGroups = _.groupBy(splits, function(split) {
    return split.name;
  });

  var expenseGroupsByMonth = _.map(expenseGroups, function(expGroup, key) {
    var monthlyTotals = function() {
      var expSplits = _.groupBy(expGroup, function(s) {
        var year = 1900 + s.date.getYear(),
          month = s.date.getMonth() + 1;
        return year + "-" + zeroPad(month + "", 2);
      });
      return _.map(expSplits, function(splits, key) {
        return {
          month: key,
          total: _.reduce(splits, function(memo, split) {
            return memo + parseInt(split.amount);
          }, 0)
        };
      });
    }();
    
    return {
      name: key,
      monthlyTotals: monthlyTotals,
      total: function() {
        return _.reduce(monthlyTotals, function(memo, mt) {
          return memo + mt.total;
        }, 0);
      }()
    };
  });

  return expenseGroupsByMonth;
};

/**
 * expensesByMonth doesn't include months with no transactions.  For
 * convenience, this function will inject those.
 */
var fillEmptyMonths = function(since, until, expensesByMonth) {
  var clonedExps = _.clone(expensesByMonth),
      numMonths = until.diff(since, 'months'),
      clonedUntil = moment(until);
      desiredMonths = _.map(_.range(numMonths), function() {
        return moment(clonedUntil.subtract('months', 1));
      });

  _.each(clonedExps, function(exp) {
    _.each(_.range(numMonths), function(i) {
      var monthStr = desiredMonths[i].format('YYYY-MM'),
          expMonth = exp.monthlyTotals[i];

      //console.log(expMonth);
     
      if (!expMonth || monthStr !== expMonth.month) {
        exp.monthlyTotals.splice(i, 0, {
          month: monthStr,
          total: 0
        });
      }
    });
  });

 return clonedExps; 
}

module.exports = {
  monthSums: monthSums,
  monthTrans: monthTrans,
  months: months,
  expensesByMonth: expensesByMonth,
  fillEmptyMonths: fillEmptyMonths
};
