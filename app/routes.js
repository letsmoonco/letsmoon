var formidable = require('formidable');
var fs = require('fs');
const collections  = require('../config/mongo.js')
var crypto = require("crypto"); 
var schedule = require('node-schedule');
var bittrexserver = require('node-bittrex-api');
var secrets = require('../config/secrets.js')

/*

Pushover Notifcations - Not in user

var Pushover = require('node-pushover');
var push = new Pushover({
    token: secrets.pushoverToken,
    user: secrets.pushoverUser
});
*/

var mailgun = require('mailgun-js')({apiKey: secrets.mailgun_api_key, domain: secrets.mailgun_domain});

const binanceserver = require('node-binance-api');
var moment = require('moment');


binanceserver.options({
  APIKEY: secrets.binanceApiKey,
  APISECRET: secrets.binanceApiSecret,
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: false // If you want to use sandbox mode where orders are simulated
});

bittrexserver.options({
  'apikey' : secrets.bittrexApiKey,
  'apisecret' : secrets.bittrexApiSecret,
  'verbose' : false,  
  'cleartext' : false
});

var bittrexMarkets = null;
var binanceMarkets = null;

var rule = new schedule.RecurrenceRule();
rule.minute = 0;

var marketSched = schedule.scheduleJob(rule, function(){
    updateMarkets();
});

// Do Now
updateMarkets();

function updateMarkets () {

    console.log ("Listing Markets:");

    bittrexserver.getmarketsummaries( function( data, err ) {
      if (err) {
        return console.error(err);
      }

      bittrexMarkets = data.result;
      
      //console.log(bittrexMarkets);

    });

    binanceMarkets = [];

    binanceserver.prices((error, ticker) => {
      //console.log("prices()", ticker);
      //console.log("Price of BTC: ", ticker.BTCUSDT);

      for (var p in ticker) {
          if( ticker.hasOwnProperty(p) ) {
            //result += p + " , " + obj[p] + "\n";
            //console.log(p);

            var tmpstr =  p;
            var binmarket = "";

            if (tmpstr.substring(tmpstr.length - 3) == "BTC") {
              binmarket = tmpstr.substring(tmpstr.length - 3) + "-" + tmpstr.substring(0, tmpstr.lastIndexOf("BTC"));
            }
            else if (tmpstr.substring(tmpstr.length - 3) == "ETH") {
          binmarket = tmpstr.substring(tmpstr.length - 3) + "-" + tmpstr.substring(0, tmpstr.lastIndexOf("ETH"));
            }
            else if (tmpstr.substring(tmpstr.length - 3) == "BNB") {
          binmarket = tmpstr.substring(tmpstr.length - 3) + "-" + tmpstr.substring(0, tmpstr.lastIndexOf("BNB"));
            }
            else if (tmpstr.substring(tmpstr.length - 4) == "USDT") {
          binmarket = tmpstr.substring(tmpstr.length - 4) + "-" + tmpstr.substring(0, tmpstr.lastIndexOf("USDT"));
            }

            //console.log(binmarket);
            //console.log(tmpstr.substring(tmpstr.length - 3));

            //console.log(tmpstr + " " + tmpstr.length); 

            var mark = {MarketName: binmarket};
            binanceMarkets.push(mark);


          } 
      }

      binanceMarkets.sort(GetSortOrder("MarketName"));
      //console.log(binanceMarkets);


    });

    
};


module.exports = function(app, passport) {

// normal routes ===============================================================

    app.locals.moment = require('moment');

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
        res.render('index.ejs',{ message: req.flash('aMessage') });
    });

    app.get('/forgotpassword', function(req, res) {
        res.render('forgot.ejs', {message: req.flash('forgotmessage')});
    });

    app.get('/resetmypassword/:pwdid', function(req, res) {
        //console.log(req.params.pwdid);

        collections.users.findOne({"local.resetcode": req.params.pwdid}, (erruser, user) => {
          console.log(user);
          if (user == null) {
            req.flash('newmsg', "Oops... Something went wrong.");
            res.render('newpassword.ejs', {message: req.flash('newmsg'), resetcode: req.params.pwdid});            
          }
          else {
           req.flash('newmsg', "Please enter a new password.");
           res.render('newpassword.ejs', {message: req.flash('newmsg'), resetcode: req.params.pwdid});             
          }

        });
    });

    app.post('/setnewpwd', (req, res) => {
            
      var bcrypt   = require('bcrypt-nodejs');  
      var newpasswordis = bcrypt.hashSync(req.body.newpwd, bcrypt.genSaltSync(8), null);

      collections.users.findOneAndUpdate({"local.resetcode": req.body.resetlink}, {
              $set: {
                "local.password" : newpasswordis,
                "local.resetcode": ""
              }                
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              //if (err) return console.log(err)
              if (result.value == null) {
                
                res.redirect('/resetmypassword/' + req.body.resetlink);               
              }
              else {
                req.flash('loginMessage', 'Password Reset. Please Login.');
                res.redirect('/');               
              }
      });

    }) 

    app.post('/resetpwd', (req, res) => {
      
      var resetcode = crypto.randomBytes(32).toString('hex');

      console.log("/resetmypassword/" + resetcode);

      collections.users.findOneAndUpdate({"local.email": req.body.resetemail}, {
              $set: {
                "local.resetcode" : resetcode
              }                
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              //if (err) return console.log(err)
              if (result.value == null) {
                console.log("Invalid User");  
                req.flash('forgotmessage', "Sorry, we don't know that account.");
                res.render('forgot.ejs', {message: req.flash('forgotmessage')});                  
              }
              else {
                console.log("Email Sent");  

                //SEND EMAIL
                
                var linkvar = 'https://yourdomain.io/resetmypassword/' + resetcode;

                var mymail = {
                  from: 'Your Domain <noreply@yourdomain.io>',
                  to: result.value.local.email,
                  subject: "Let's Moon - Password Reset",
                  text: 'You requested a password reset.  Please follow the link below to reset your password. \n\n ' + linkvar
                };
                 
                mailgun.messages().send(mymail, function (error, body) {
                  //console.log(body);
                });      
                                 
                req.flash('loginMessage', 'Email Sent - Please follow the link in the email.');
                res.redirect('/');               
              }
      });

    })    

    app.get('/createkeys', isLoggedIn, function(req, res) {

        /* if has keys already, redirect to dashboard */
        console.log(req.user.local.myPrivKey);

        if (req.user.local.myPrivKey != '' && req.user.local.myPrivKey != null) {
          res.redirect('/dashboard');
        }
        else {
          req.flash('keymsg', 'We need your Bittrex API keys to trade on your behalf.');
          res.render('mykeys.ejs', { message: req.flash('keymsg') });
        }
    });

    app.post('/feedback', isLoggedIn, (req, res) => {
      
      var mymail = {
        from: 'Your Domain <noreply@yourdomain.com>',
        to: 'youremail@yourdomain',
        subject: 'Feedback: ' + req.body.feedbackradio,
        text: "Feedback From: " + req.user.local.email + "\n\n" + req.body.feedbacktxt
      };
       
      mailgun.messages().send(mymail, function (error, body) {
        console.log(error + body);
      });      

      res.redirect(req.body.feedbackroute); 

    })

    app.post('/createmykeys', isLoggedIn, (req, res) => {
      

          var user = req.user;
              user.local.bittrex.apikey = req.body.bittrexapikey;
              user.local.bittrex.apisecret = req.body.bittrexapisecret;
              user.local.binance.apikey = req.body.binanceapikey;
              user.local.binance.apisecret = req.body.binanceapisecret;
              user.save(function(err) {
                //req.flash('mymsg', 'Keys Updated');
                res.redirect('/profile');
              });

    })

    app.post('/newtrade', isLoggedIn, function(req, res) {

      collections.trades.find({$and : [{exchange: req.body.newtradeexchange} ,{market: req.body.newtrademarket}, {deleted: false} , {myid: req.user.local.myid}]}).toArray(function(err2, results) {
        //console.log(results);
        if (results.length != 0) {
            // we have a result
            //console.log("Duplicate");
            //console.log(results);
            req.flash('mymsg', 'You Already have a ' + req.body.newtrademarket + ' trade open. Please edit that trade or delete it');
            res.redirect('/dashboard');

        } else {
          var itsnow = Date.now();
          var tid = crypto.randomBytes(32).toString('hex');
          var docrecord = {tid: tid,
                           exchange: req.body.newtradeexchange,
                           market: req.body.newtrademarket,
                           myid: req.user.local.myid,
                           orderid: "",
                           deleted: false,
                           timestamp: itsnow,
                           conditions: {
                                        active: false,
                                        state: "Mode 1",
                                        rules:  [
                                              {ruleuid: crypto.randomBytes(32).toString('hex'), ruleid: 1, type: "Price", price: 0.0000, priceop: ">=", action: "Sell", actionprice: 0.0000, qty: 0.0000, statecheck: "Mode 1", stateset: "Finish"}
                                            ]

                                      }
                         };

          if (req.body.newtradeexchange == "BINANCE") {
            var splitter = req.body.newtrademarket;
            splitter = splitter.split("-");
            docrecord.binancemarket = splitter[1] + splitter[0];
          }

          collections.trades.save(docrecord, function(err, result) {
            if (err) return console.log(err);
            res.redirect('/trade/' + tid);
          });
           
        }

      })

    });    

    app.post('/deleteit', isLoggedIn, (req, res) => {

      //console.log(req.body.tidtodelete);

      //console.log(req.body.tidtoreset);
      var logrecord = {message: "Trade Deleted", timestamp: Date.now()};

      collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidtodelete} , {myid: req.user.local.myid}]}, {
              $set: {
                deleted : true,
                orderid: "",
                timestamp: Date.now()
              },
              $push: {
                "conditions.log": logrecord
              }                
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              if (err) return console.log(err)

              if (result.orderid != "") {
                if (result.exchange == "BITTREX") {

                    var bittrexuser = require('node-bittrex-api');

                    bittrexuser.options({
                      'apikey' : req.user.local.bittrex.apikey,
                      'apisecret' : req.user.local.bittrex.apisecret,
                      'verbose' : false,  
                      'cleartext' : false
                    });
                    
                    bittrexuser.cancel({uuid: result.orderid}, function( data2, err2 ) {
                      if (err) {
                        console.log(err2);
                      }
                    });

                }
                else if (result.exchange == "BINANCE") {
                  
                  var binanceuser = require('node-binance-api');

                  binanceuser.options({
                    APIKEY: req.user.local.binance.apikey,
                    APISECRET: req.user.local.binance.apisecret,
                    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
                    test: false // If you want to use sandbox mode where orders are simulated
                  });

                  binanceuser.cancel(result.binancemarket, result.orderid, (error, response, symbol) => {
                    
                    if(!isEmptyObject(response)) {
                      console.log("Open Order Cancelled");
                    }                  

                  });                

                }
              }

              req.flash('mymsg', 'Trade Deleted');
              res.redirect('/dashboard');
              //Send E-Mail
            })        

    })  
 

    app.post('/starttrade', isLoggedIn, (req, res) => {

      var logrecord = {message: "Trading Started", timestamp: Date.now()};

      //console.log(req.body.tidtoreset);
      collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidtostart} , {myid: req.user.local.myid}]}, {
              $set: {
                "conditions.active" : true,
                timestamp: Date.now()
              },
              $push: {
                "conditions.log": logrecord
              }                
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              if (err) return console.log(err)
              req.flash('mymsg', 'Trading Started');
              res.redirect('/trade/' + req.body.tidtostart);
              //Send E-Mail
            })        

    })  

    app.post('/stoptrade', isLoggedIn, (req, res) => {

      //console.log(req.body.tidtoreset);
      var logrecord = {message: "Trading Stopped - Open Orders Cancelled", timestamp: Date.now()};

      collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidtostop} , {myid: req.user.local.myid}]}, {
              $set: {
                "conditions.active" : false,
                orderid: "",
                timestamp: Date.now()
              },
              $push: {
                "conditions.log": logrecord
              }                
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              if (err) return console.log(err)

              if (result.orderid != "") {
                if (result.exchange == "BITTREX") {

                    var bittrexuser = require('node-bittrex-api');

                    bittrexuser.options({
                      'apikey' : req.user.local.bittrex.apikey,
                      'apisecret' : req.user.local.bittrex.apisecret,
                      'verbose' : false,  
                      'cleartext' : false
                    });
                    
                    bittrexuser.cancel({uuid: result.orderid}, function( data2, err2 ) {
                      if (err) {
                        console.log(err2);
                      }
                    });

                }
                else if (result.exchange == "BINANCE") {
                  
                  var binanceuser = require('node-binance-api');

                  binanceuser.options({
                    APIKEY: req.user.local.binance.apikey,
                    APISECRET: req.user.local.binance.apisecret,
                    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
                    test: false // If you want to use sandbox mode where orders are simulated
                  });

                  binanceuser.cancel(result.binancemarket, result.orderid, (error, response, symbol) => {
                    
                    if(!isEmptyObject(response)) {
                      console.log("Open Order Cancelled");
                    }                  

                  });                

                }
              }

              req.flash('mymsg', 'Trading Stopped - Open Orders Cancelled');
              res.redirect('/trade/' + req.body.tidtostop);



              //Send E-Mail
            })        

    })  

    app.post('/resetmode', isLoggedIn, (req, res) => {

      //console.log(req.body.tidtoreset);
      var logrecord = {message: "Mode Reset Back to 1", timestamp: Date.now()};
 
      collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidtoreset} , {myid: req.user.local.myid}]}, {
              $set: {
                "conditions.state" : "Mode 1",
                timestamp: Date.now()
              },
              $push: {
                "conditions.log": logrecord
              }              
            }, {
              sort: {_id: -1},
              upsert: false
            }, (err, result) => {
              if (err) return console.log(err)
              req.flash('mymsg', 'Reset Back to Mode 1');
              res.redirect('/trade/' + req.body.tidtoreset);
              //Send E-Mail
            })        

    })  

    app.get('/trade/:tid', isLoggedIn, function(req, res) {
        //var tid = req.params.tid;
        collections.trades.find({$and : [{tid: req.params.tid} , {myid: req.user.local.myid}, {deleted: false}]}).toArray(function(err2, results) {
          //console.log(results);
          if (results.length != 0) {

              var ticker = results[0].market;
              ticker = ticker.split("-");
              var tvticker = ticker[1] + ticker[0];
              var balances = {base: 0, pair: 0};

              if (results[0].exchange == "BITTREX") {

                if ((req.user.local.bittrex.apikey == '' || req.user.local.bittrex.apikey == null) || (req.user.local.bittrex.apisecret == '' || req.user.local.bittrex.apisecret == null)) {
                  req.flash('mymsg', 'Your API Keys Appear to Be Invalid');
                  res.redirect('/profile');
                  return;
                }

              }
              else if (results[0].exchange == "BINANCE") {

                if ((req.user.local.binance.apikey == '' || req.user.local.binance.apikey == null) || (req.user.local.binance.apisecret == '' || req.user.local.binance.apisecret == null)) {
                  req.flash('mymsg', 'Your API Keys Appear to Be Invalid');
                  res.redirect('/profile');
                  return;
                }

              }

              if (results[0].exchange == "BITTREX") {
                
                var bittrexuser = require('node-bittrex-api');

                bittrexuser.options({
                  'apikey' : req.user.local.bittrex.apikey,
                  'apisecret' : req.user.local.bittrex.apisecret,
                  'verbose' : false,  
                  'cleartext' : false
                });

                bittrexuser.getbalances( function( data, errx ) {
                  //console.log(errx);
                  if (data === null) {
                    if (errx.message == "APIKEY_INVALID") {
                      req.flash('mymsg', 'Your API Keys Appear to Be Invalid');
                      res.redirect('/profile');
                    }
                  }
                  else {

                    for (var i2 in data.result) {
                      if (data.result[i2].Currency == ticker[0]) {
                        balances.base = data.result[i2].Balance;
                      }
                      if (data.result[i2].Currency == ticker[1]) {
                        balances.pair = data.result[i2].Balance;
                      }                  
                    }

                    res.render('trade.ejs', {user : req.user, balances: balances, data: results[0], tid: req.params.tid, ticker: tvticker, market: results[0].market, message: req.flash('mymsg')});

                  }
                });


              }
              else if (results[0].exchange == "BINANCE") {
                
                var binanceuser = require('node-binance-api');

                binanceuser.options({
                  APIKEY: req.user.local.binance.apikey,
                  APISECRET: req.user.local.binance.apisecret,
                  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
                  test: false // If you want to use sandbox mode where orders are simulated
                });

                var binancebalances = [];

                binanceuser.balance((error, balances) => {
                  if (error) {
                    //console.log("Error");
                    req.flash('mymsg', 'Your API Keys Appear to Be Invalid');
                    res.redirect('/profile');                    
                  }
                  else {
                    for (var p in balances) {
                        if( balances.hasOwnProperty(p) ) {
                          //result += p + " , " + obj[p] + "\n";
                          //console.log(p + ": " + balances[p].available);
                          var binbaltmp = {Currency: p, Balance: balances[p].available}
                          binancebalances.push (binbaltmp);
                        }
                    }

                    //console.log(binancebalances);
                    for (var i3 in binancebalances) {
                      if (binancebalances[i3].Currency == ticker[0]) {
                        balances.base = binancebalances[i3].Balance;
                      }
                      if (binancebalances[i3].Currency == ticker[1]) {
                        balances.pair = binancebalances[i3].Balance;
                      }                  
                    }

                    res.render('trade.ejs', {user : req.user, balances: balances, data: results[0], tid: req.params.tid, ticker: tvticker, market: results[0].market, message: req.flash('mymsg')});                    

                  }

                });



              }

          } else {

            req.flash('mymsg', 'Oops... Something went wrong.');
            res.redirect('/dashboard');
             
          }

        })        

    });    

    app.post('/saverules', isLoggedIn, (req, res) => {

/*
      console.log(req.body);
      console.log(req.body.whenmode.constructor);
      console.log(req.body.whenmode.length);
*/      
      var rules = [];

      if (req.body.whenmode.constructor === Array) {

        for (var i1 in req.body.whenmode) {
          var arule = { ruleuid: crypto.randomBytes(32).toString('hex'), 
                        ruleid: i1 + 1, 
                        type: req.body.ruletype[i1], 
                        price: parseFloat(req.body.pricecheck[i1]), 
                        priceop: req.body.priceop[i1], 
                        action: req.body.action[i1], 
                        actionprice: parseFloat(req.body.actprice[i1]), 
                        qty: parseFloat(req.body.qty[i1]), 
                        statecheck: req.body.whenmode[i1], 
                        stateset: req.body.setmode[i1]
                      };

          rules.push(arule);
        }

      }
      else {
          var arule = { ruleuid: crypto.randomBytes(32).toString('hex'), 
                        ruleid: 1, 
                        type: req.body.ruletype, 
                        price: parseFloat(req.body.pricecheck), 
                        priceop: req.body.priceop, 
                        action: req.body.action, 
                        actionprice: parseFloat(req.body.actprice), 
                        qty: parseFloat(req.body.qty), 
                        statecheck: req.body.whenmode, 
                        stateset: req.body.setmode
                      };

          rules.push(arule);
      }

      //Save to DB
      //console.log(rules);

      if (req.body.tidstart == "1") {
        var logrecord = {message: "Trading Started", timestamp: Date.now()};

        collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidrules} , {myid: req.user.local.myid}]}, {
                $set: {
                  "conditions.rules" : rules,
                  "conditions.active" : true,
                  timestamp: Date.now()
                },
                $push: {
                  "conditions.log": logrecord
                }              
              }, {
                sort: {_id: -1},
                upsert: false
              }, (err, result) => {
                if (err) return console.log(err)
                req.flash('mymsg', 'Saved Changes and Started Trading');
                res.redirect('/trade/' + req.body.tidrules);
              })                           
      }
      else {
        var logrecord = {message: "Saved Changes", timestamp: Date.now()};

        collections.trades.findOneAndUpdate({$and : [{tid: req.body.tidrules} , {myid: req.user.local.myid}]}, {
                $set: {
                  "conditions.rules" : rules,
                  timestamp: Date.now()
                },
                $push: {
                  "conditions.log": logrecord
                }              
              }, {
                sort: {_id: -1},
                upsert: false
              }, (err, result) => {
                if (err) return console.log(err)
                req.flash('mymsg', 'Saved Changes');
                res.redirect('/trade/' + req.body.tidrules);
              })  

      }

    })   



    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function(req, res) {

        //Check Keys Blank - Show Notice
        if ((req.user.local.bittrex.apikey == '' || req.user.local.bittrex.apikey == null) || (req.user.local.binance.apikey == '' || req.user.local.binance.apikey == null) || (req.user.local.bittrex.apisecret == '' || req.user.local.bittrex.apisecret == null) || (req.user.local.binance.apisecret == '' || req.user.local.binance.apisecret == null)) {        
          req.flash('mymsg', 'We need Binance or Bittrex API Keys + Secrets to trade on your behalf.');
        }

        res.render('profile.ejs', {
            user : req.user,
            message: req.flash('mymsg')
        });
    });

    app.get('/dashboard', isLoggedIn, function(req, res) {

        collections.trades.find({$and : [{myid: req.user.local.myid}, {deleted: false}]}).toArray(function(err, results) {
          //console.log(results)
          // send HTML file populated with quotes here

          res.render('dashboard.ejs', {user : req.user, trades: results, binanceMarkets: binanceMarkets, bittrexMarkets: bittrexMarkets, message: req.flash('mymsg')});

        })  


        //console.log(req.user);
    });
    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });


// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        /*
        app.get('/login', function(req, res) {
            res.render('login.ejs', { message: req.flash('loginMessage') });
        });
        */

        // process the login form
        app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/dashboard', // redirect to the secure profile section
            failureRedirect : '/', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

        // SIGNUP =================================
        // show the signup form
        /*
        app.get('/signup', function(req, res) {
            res.render('signup.ejs', { message: req.flash('signupMessage') });
        });
        */

        // process the signup form
        app.post('/signup', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/#s', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));



// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });

};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}


function GetSortOrder(prop) {  
    return function(a, b) {  
        if (a[prop] > b[prop]) {  
            return 1;  
        } else if (a[prop] < b[prop]) {  
            return -1;  
        }  
        return 0;  
    }  
}  

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

