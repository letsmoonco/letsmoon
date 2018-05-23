const collections  = require('./config/mongo.js')
var crypto = require("crypto"); 
var schedule = require('node-schedule');
var bittrexserver = require('node-bittrex-api');
const binanceserver = require('node-binance-api');

var secrets = require('./config/secrets.js')


runrules;

setInterval(runrules, 30000);


function runrules () {

    collections.trades.find({$and : [{"conditions.active": true}, {deleted: false}]}).toArray(function(errtrade, trade) {
      //console.log(results);
      if (errtrade) return console.log(errtrade)

      if (trade.length != 0) {
          console.log(trade.length + " Trades to Check");
          for (var j in trade) {
    		
    		collections.users.findOne({"local.myid": trade[j].myid}, (erruser, user) => {
            	
				var bittrexuser = require('node-bittrex-api');
				var binanceuser = require('node-binance-api');

            	if (erruser) return console.log(erruser)

            	if (trade[j].exchange == "BITTREX") {

	                if ((user.local.bittrex.apikey == '' || user.local.bittrex.apikey == null) || (user.local.bittrex.apisecret == '' || user.local.bittrex.apisecret == null)) {
						logit (trade[j], "API ERROR", null);
						logit (trade[j], "Trading Finished", null);
						disact (trade[j]);
	                }
	                else {
				        bittrexuser.options({
				          'apikey' : user.local.bittrex.apikey,
				          'apisecret' : user.local.bittrex.apisecret,
				          'verbose' : false,  
				          'cleartext' : false
				        });

				        bittrexuser.getbalances( function( data, errbal ) {
				          //console.log(errx);
				          if (data === null) {
				            if (errbal.message == "APIKEY_INVALID") {
								logit (trade[j], "API ERROR", null);
								logit (trade[j], "Trading Finished", null);
								disact (trade[j]);
						
				            }
				          }
				          else {

							bittrex.getticker( { market : trade[j].market }, function( price, errtick ) {
								if (errtick) return console.log(errtick)

								parserule (trade[j], user, price.result.Last);
							});

				          }

				        });
	                }
            	}
            	else if (trade[j].exchange == "BINANCE") {

		            if ((user.local.binance.apikey == '' || user.local.binance.apikey == null) || (user.local.binance.apisecret == '' || user.local.binance.apisecret == null)) {
						logit (trade[j], "API ERROR", null);
						logit (trade[j], "Trading Finished", null);
						disact (trade[j]);   
		            }
					else {
						binanceuser.options({
						  APIKEY: user.local.binance.apikey,
						  APISECRET: user.local.binance.apisecret,
						  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
						  test: false // If you want to use sandbox mode where orders are simulated
						});            		

		                binanceuser.balance(function(error, balances) {
		                  if (error) {
							logit (trade[j], "API ERROR", null);
							logit (trade[j], "Trading Finished", null);
							disact (trade[j]);              
		                  }
		                  else {
	                  		var aprice = 0;
							binanceuser.prices(function(error123, ticker) {
							  //console.log(ticker);
							  //console.log("Price of BTC: ", ticker.BTCUSDT);

								for (var p in ticker) {
								    if( ticker.hasOwnProperty(p) ) {
								      //result += p + " , " + obj[p] + "\n";
								      //console.log(p);

								      if (p == trade[j].binancemarket) {
								      	aprice = ticker[p];
								      }

								    } 
								}

								parserule (trade[j], user, aprice);

							});

		              	  }
		              	});
					}

            	}

            //res.redirect('/dashboard');
            //Send E-Mail
          	});      

          }

      } else {

		console.log("No Trades");
         
      }

    })  	   

};

function parserule (trade, user, theprice) {

    var vlupdate = false;

	if (trade.conditions.active) {

		var newstate = trade.conditions.state;

		for (var i in trade.conditions.rules) {

			if (trade.conditions.rules[i].statecheck == trade.conditions.state)	{

				if (trade.conditions.rules[i].type == "Price") {
					
					if (trade.conditions.rules[i].priceop == ">=") {
					
						if (theprice >= trade.conditions.rules[i].price) {
							trade.conditions.state = trade.conditions.rules[i].stateset;
							newstate = trade.conditions.state;

							takeaction(trade, i, user);
						};

					}
					else if (trade.conditions.rules[i].priceop == "<=") {
					
						if (theprice <= trade.conditions.rules[i].price) {
							trade.conditions.state = trade.conditions.rules[i].stateset;
							newstate = trade.conditions.state;

							takeaction(trade, i, user);					
						};
					

					};


				};			

			};

		}

		if (trade.conditions.state != newstate) {
			trade.conditions.state = newstate;
			logit (trade, "State Updated: " + newstate, null);
			vlupdate = true;
		}


		if (trade.conditions.state == "Finish") {
			trade.conditions.active = false;
			logit (trade, "Trading Finished", null);
			vlupdate = true;
		}

	};

	if (vlupdate) {
		// DB Updates
		collections.trades.findOneAndUpdate({tid: trade.tid}, {
		      $set: {
		        "conditions.state" : trade.conditions.state,
		        "conditions.active" : trade.conditions.active
		      }
		    }, {
		      sort: {_id: -1},
		      upsert: false
		    }, (err, result) => {
		      if (err) return console.log(err)
		    })    		
	}

};	

function takeaction (thetrade, idx, user) {

	var bittrexorder = require('node-bittrex-api');
	var binanceorder = require('node-binance-api');
	
	if (thetrade.exchange == "BITTREX") {
	    bittrexorder.options({
	      'apikey' : user.local.bittrex.apikey,
	      'apisecret' : user.local.bittrex.apisecret,
	      'verbose' : false,  
	      'cleartext' : false
	    });
	}
	else if (thetrade.exchange == "BINANCE") {
		binanceorder.options({
		  APIKEY: user.local.binance.apikey,
		  APISECRET: user.local.binance.apisecret,
		  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
		  test: false // If you want to use sandbox mode where orders are simulated
		});    		
	}

	if (thetrade.conditions.rules[idx].action == "None") {
		logit (thetrade, "No Action Taken", idx);
	}
	else if (thetrade.conditions.rules[idx].action == "Buy") {
		if (thetrade.exchange == "BITTREX") {
			
			if (thetrade.orderid != "") {
				
				bittrexorder.cancel({uuid: thetrade.orderid}, function( data, err ) {
				  if (err) {
				    console.log(err);
				  }

				  if (data.success) {
				  	logit (thetrade, "Previous Order Cancelled" , idx);

					bittrexorder.buylimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
					  if (errbuy) {
					    console.log(errbuy);
					  }

					  if (databuy.success == false) {
				  		logit (thetrade, "Placing Buy Order Failed - Reason: " + databuy.message, idx);
					  } 
					  else { 
						
						logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);
						
						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : databuy.result.uuid
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});

				  }
				  else {
					bittrexorder.buylimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
					  if (errbuy) {
					    console.log(errbuy);
					  }

					  if (databuy.success == false) {
				  		logit (thetrade, "Placing Buy Order Failed - Reason: " + databuy.message, idx);
					  } 
					  else { 
						
						logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);
						
						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : databuy.result.uuid
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});				  	
				  }

				});

			}
			else {

				bittrexorder.buylimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
				  if (errbuy) {
				    console.log(errbuy);
				  }

				  if (databuy.success == false) {
			  		logit (thetrade, "Placing Buy Order Failed - Reason: " + databuy.message, idx);
				  } 
				  else { 
					
					logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);

					collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
					      $set: {
					        "orderid" : databuy.result.uuid
					      }
					    }, {
					      sort: {_id: -1},
					      upsert: false
					    }, (dberr, dbresult) => {
					      if (dberr) return console.log(dberr)
					    })   

				  }

				});

			}

		}
		else if (thetrade.exchange == "BINANCE") {

			if (thetrade.orderid != "") {
				
				binanceorder.cancel(thetrade.binancemarket, thetrade.orderid, function (error, response, symbol) {
				  //console.log(response);

				  if(!isEmptyObject(response)) {

				  	logit (thetrade, "Previous Order Cancelled" , idx);

					binanceorder.buy(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
					  if (buyerror) {
					  	logit (thetrade, "Placing Buy Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
					  }
					  else {
						logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);

						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : buyresponse.orderId
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});				  	

				  }
				  else {
					binanceorder.buy(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
					  if (buyerror) {
					  	logit (thetrade, "Placing Buy Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
					  }
					  else {
						logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);

						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : buyresponse.orderId
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});
				  }

				});

			}
			else {

				binanceorder.buy(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
				  if (buyerror) {
				  	logit (thetrade, "Placing Buy Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
				  }
				  else {
					logit (thetrade, "Buy Order Placed " + thetrade.conditions.rules[idx].qty, idx);

					collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
					      $set: {
					        "orderid" : buyresponse.orderId
					      }
					    }, {
					      sort: {_id: -1},
					      upsert: false
					    }, (dberr, dbresult) => {
					      if (dberr) return console.log(dberr)
					    })   

				  }

				});

			}
		};
	}		
	else if (thetrade.conditions.rules[idx].action == "Sell") {
		if (thetrade.exchange == "BITTREX") {
			
			if (thetrade.orderid != "") {
				
				bittrexorder.cancel({uuid: thetrade.orderid}, function( data, err ) {
				  if (err) {
				    console.log(err);
				  }
				  
				  if (data.success) {
				  	logit (thetrade, "Previous Order Cancelled" , idx);

					bittrexorder.selllimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
					  if (errbuy) {
					    console.log(errbuy);
					  }

					  if (databuy.success == false) {
				  		logit (thetrade, "Placing Sell Order Failed - Reason: " + databuy.message, idx);
					  } 
					  else { 
						
						logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);
						
						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : databuy.result.uuid
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});

				  }
				  else {

					bittrexorder.selllimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
					  if (errbuy) {
					    console.log(errbuy);
					  }

					  if (databuy.success == false) {
				  		logit (thetrade, "Placing Sell Order Failed - Reason: " + databuy.message, idx);
					  } 
					  else { 
						
						logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);
						
						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : databuy.result.uuid
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});

				  }

				});

			}
			else {

				bittrexorder.selllimit({market: thetrade.market, quantity: thetrade.conditions.rules[idx].qty , rate: thetrade.conditions.rules[idx].actionprice}, function( databuy, errbuy ) {
				  if (errbuy) {
				    console.log(errbuy);
				  }

				  if (databuy.success == false) {
			  		logit (thetrade, "Placing Sell Order Failed - Reason: " + databuy.message, idx);
				  } 
				  else { 
					
					logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);

					collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
					      $set: {
					        "orderid" : databuy.result.uuid
					      }
					    }, {
					      sort: {_id: -1},
					      upsert: false
					    }, (dberr, dbresult) => {
					      if (dberr) return console.log(dberr)
					    })   

				  }

				});

			}

		}
		else if (thetrade.exchange == "BINANCE") {

			if (thetrade.orderid != "") {
				
				binanceorder.cancel(thetrade.binancemarket, thetrade.orderid, function(error, response, symbol) {
				  //console.log(response);

				  if(!isEmptyObject(response)) {

				  	logit (thetrade, "Previous Order Cancelled" , idx);

					binanceorder.sell(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
					  if (buyerror) {
					  	logit (thetrade, "Placing Sell Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
					  }
					  else {
						logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);

						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : buyresponse.orderId
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});				  	

				  }
				  else {
					binanceorder.sell(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
					  if (buyerror) {
					  	logit (thetrade, "Placing Sell Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
					  }
					  else {
						logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);

						collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
						      $set: {
						        "orderid" : buyresponse.orderId
						      }
						    }, {
						      sort: {_id: -1},
						      upsert: false
						    }, (dberr, dbresult) => {
						      if (dberr) return console.log(dberr)
						    })   

					  }

					});
				  }

				});

			}
			else {

				binanceorder.sell(thetrade.binancemarket, thetrade.conditions.rules[idx].qty, thetrade.conditions.rules[idx].actionprice, {type:'LIMIT'}, function (buyerror, buyresponse) {
				  if (buyerror) {
				  	logit (thetrade, "Placing Sell Order Failed - Reason: " + "Maybe Insufficient Funds", idx);
				  }
				  else {
					logit (thetrade, "Sell Order Placed " + thetrade.conditions.rules[idx].qty, idx);

					collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
					      $set: {
					        "orderid" : buyresponse.orderId
					      }
					    }, {
					      sort: {_id: -1},
					      upsert: false
					    }, (dberr, dbresult) => {
					      if (dberr) return console.log(dberr)
					    })   

				  }

				});

			}
		};
	}

};


function logit (thetrade, message, idx) {
	
	if (idx != null) {
		var logrecord = {message: message, timestamp: Date.now(), ruleid: thetrade.conditions.rules[idx].ruleid, ruleuid: thetrade.conditions.rules[idx].ruleuid};
		//push log + ruleuid
	}
	else {
		//push log
		var logrecord = {message: message, timestamp: Date.now()};
	}

    collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
            $push: {
              "conditions.log": logrecord
            }
          }, {
            sort: {_id: -1},
            upsert: false
          }, (err, result) => {
            if (err) return console.log(err)
            //res.redirect('/dashboard');
            //Send E-Mail
          })          

};


function disact (thetrade) {

	collections.trades.findOneAndUpdate({tid: thetrade.tid}, {
	      $set: {
	        "conditions.active" : false
	      }
	    }, {
	      sort: {_id: -1},
	      upsert: false
	    }, (err, result) => {
	      if (err) return console.log(err)
	    })    		

};

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}
