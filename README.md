# letsmoon

Let's Moon is an open source cryptocurrency trading engine which allows you to configure complex buy/sell target rules on the popular exchanges Bittrex and Binance (more exchanges coming soon).

 - Checkout the application and roadmap at: https://letsmoon.co
 - Join the telegram at: https://t.me/letsmoonco

You can use the live site or download your own local copy.  The 'secrets' and API keys for the live website are left "NONE" in the github repo for obvious reasons.

Please checkout our roadmap and submit a pull request if you want to contribute.

## pre-requisites (instructions for Ubuntu only).

 - MongoDB
 - NodeJS
 - Git

## installation

```sh
$ git clone https://github.com/letsmoonco/letsmoon
$ cd letsmoon
$ npm install
```

### optional

Fix known package vulnerabilities
```sh
$ npm audit
$ follow instructions
```

## process management

PM2 is the preffered process manager.

```sh
$ sudo npm install -g pm2
```

Set PM2 to run at startup
```sh
$ pm2 startup
$ follow instructions
```

### start processes

```sh
$ pm2 start server.js
$ pm2 start tradeengine.js
$ pm2 save
```

## ssl

The live website sits behind an nginx server which handles the ssl.  If you want to use ssl on your own local copy you can self-sign a certificate and add an ssl directory in the root of the project.  There are lines of code to uncomment in server.js to enable SSL.

### self-sign ssl

In the project root:

```sh
$ mkdir ssl
$ openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./ssl/selfsigned.key -out ./ssl/selfsigned.crt
```

## project overview

```sh
./app/routes.js - most of the end-point logic sits here
./views/* - all the html
./config/secrets.js - api keys here
./public/* - client files (icons, js, css, images)
./server.js - main web server initialisation
./tradeengine.js - trading engine
```


