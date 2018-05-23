// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 3311;

var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var mongodb = require('./config/mongo.js');

var fs = require('fs');

//Uncomment below for SSL and the Listen at the bottom of this file
//You will need to self sign your own ssl certs
/*
var https = require('https');

var key = fs.readFileSync('ssl/selfsigned.key');
var cert = fs.readFileSync( 'ssl/selfsigned.crt' );

var ssloptions = {
  key: key,
  cert: cert
};
*/

// configuration ===============================================================

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

app.use("/public",express.static(__dirname + "/public"));

app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));

// required for passport
app.use(session({
    secret: 'insertyoursecretherethisisnotthelivewebsitesecret', // session secret
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================

//Comment out app.listen and uncomment https.createServer for SSL
app.listen(port);
//https.createServer(ssloptions, app).listen(port);


console.log('The magic happens on port ' + port);
