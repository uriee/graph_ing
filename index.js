var redis = require("redis"),
    client = redis.createClient();

    client.on("error", function (err) {
    console.log("error event - " + client.host + ":" + client.port + " - " + err);
});
var Q = require("q");
var express = require('express');
var app = express();
var http = require('http').Server(app);
app.use(express.static(__dirname + '/scripts'));
//app.use('/bower_components',  express.static(__dirname + '/bower_components'));
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendfile('demo.html');
});

var Smembers = function(key){
  var d = Q.defer();
  client.smembers(key,function(err,ret){
    if(err) {console.log("Err Smembers",key,err); d.reject(err);}
    else d.resolve(ret);
  });
  return d.promise;
};

var Sadd = function(key,val){
  var d = Q.defer();
  client.sadd(key,val,function(err,ret){
    if(err) {console.log("Err Sadd",key,val,err); d.reject(err);}
    else d.resolve(ret);
  });
  return d.promise;
};


io.on('connection', function(socket){
 console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });  
  socket.on('addTerm', function (data) {
    console.log(data,JSON.parse(data));
    inp = JSON.parse(data);
    insertTerm(inp.user,inp.term,function(err,ret){
      if(!err)  io.emit('addTerm', JSON.stringify(data));
    });
  }); 
  socket.on('fetch',function(key){
    console.log("fetch",key);
    Smembers('userR:'+key).then(function(data){
      out = {}
      out.terms = data;
      out.user = key;
      io.emit('fetch', JSON.stringify(out));
    });
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

addTerms = function(user,term,cb) {
  console.log("in incT :",user,term);
  client.smembers('userTerms:'+user,function(err,ret){
    if(err) cb(1,0);
    console.log("in incT smembers:",ret);  
    ret.forEach(function(T){
      if(T != term) {
         client.sadd('termR:'+term, T,function(err,ret){
            if(err) cb(1,0);
            client.sadd('termR:'+T,term,function(err,ret){
              if(err) cb(1,0);            
            }); 
         });
      }
    })
    cb(0,1);
  });
}; 

addUsers = function(user,term,cb) {
  console.log("in incU :",user,term);
  client.smembers('userTerms:'+user, function(err,ret){
    if (err) cb(1,0);  
    console.log("in incU smembers:",err,ret);
    ret.forEach(function(U) {
      if(U != user) {
        console.log("in incU : fi",U);
        client.sadd('userR:'+user, U,function(err,ret){
          if(err) cb(1,0);
          client.sadd('userR:'+U, user,function(err,ret){
            if(err) cb(1,0);
          });
        });
      }
    });
  });
}
         
 

insertTerm = function(user,term,cb){
  console.log("in IT",user,term);
  client.sadd("termUsers:"+term, user,function(err,ret){
    if(err) cb(1,0);
    client.sadd("userTerms:"+user, term,function(err,ret){
      if(err) cb(1,0);
      client.incr('term:'+term,function(err,ret){
        console.log(err,ret);
        if(err) cb(1,0);
        addTerms(user,term,function(err,ret){
          if(err) cb(1,0);
          addUsers(user,term,function(err,ret){
            console.log("incUsers called back");
            if(err) cb(1,0);
            cb(0,1)
          });
        });
      });  
    });  
  });
}
