var configDB = require('./database.js');
var mongoose = require('mongoose');

let collections = {};

mongoose.connect(configDB.url, {useMongoClient: true}, function(err, database) {
  
	if (err) return console.log(err)
    let db = database;
  	collections.users = db.collection('users');
  	collections.trades = db.collection('trades');
})


module.exports = collections;
