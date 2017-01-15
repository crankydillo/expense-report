var Sequelize = require('sequelize'),
    sequelize = new Sequelize('database', 'username', 'password', {
      host: 'localhost',
      dialect: 'sqlite',

      pool: {
        max: 5,
        min: 0,
        idle: 100
      },

      storage: 'finances.gnucash'
    }),
    Transaction = sequelize.define('transaction', {
      description: Sequelize.TEXT
    });

Transaction.findAll().complete(function(err, trans) {
  if (err) {
    console.log(err);
  } else {
    console.log(trans);
  }
})
