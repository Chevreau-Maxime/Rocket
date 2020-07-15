var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});


var ASTEROIDS = [];
var LOBBY = [];
var turnspeed = 0.02;
var acceleration = 0.05;
var slowdown = 0.95;
var turnslow = 0.9;


io.on('connection', function(socket){
  var key = Math.random(); //TODO : get key from cookies instead
  var index = lobby_add(key, socket.id) //TODO : if key matches, return existing index
  console.log("__Connect : " + JSON.stringify(LOBBY[index]));

  socket.on('name', function(msg){
    LOBBY[index].name = msg;
  });
  socket.on('input', function(msg){
    LOBBY[index].input = msg;
  });
  socket.on('disconnect', function(){
    console.log("__Disconnect : " + LOBBY[index].name);
    //LOBBY.splice(index, 1);
  });

});

//io.emit('chat message', msg);
//io.to(socketId).emit

http.listen(port, function(){
  console.log('listening on *:' + port);
});



////////////////////////////////
//INIT

game_init_asteroids(0, 0, 100, 75, 0.5, 5);












////////////////////////////////////////////////////////////////////////////////////////////////
//LOBBY

function lobby_add(_key, _socketID){
  var index = LOBBY.length;
  LOBBY[index] = {name:"?", key:_key, socketID:_socketID}
  game_init_ship(index);
  return index;
}





////////////////////////////////////////////////////////////////////////////////////////////////
//GAME
clearInterval(inter);
var inter = setInterval(game_step, 1000/30);
function game_step(){
  for (var i=0; i<LOBBY.length; i++){
    //ship update :
    //angular :
    if (LOBBY[i].input.left){ LOBBY[i].ship.da -= turnspeed; }
    if (LOBBY[i].input.right){ LOBBY[i].ship.da += turnspeed; }
    LOBBY[i].ship.da *= (Math.abs(LOBBY[i].ship.da) < 0.001) ? 0:turnslow;
    LOBBY[i].ship.a += LOBBY[i].ship.da;
    
    //velocity :
    if (LOBBY[i].input.up){ 
      LOBBY[i].ship.dx += Math.cos(LOBBY[i].ship.a)*acceleration;
      LOBBY[i].ship.dy += Math.sin(LOBBY[i].ship.a)*acceleration;
    }
    LOBBY[i].ship.x += LOBBY[i].ship.dx;
    LOBBY[i].ship.y += LOBBY[i].ship.dy;
    LOBBY[i].ship.dx *= (Math.abs(LOBBY[i].ship.dx) < 0.001) ? 0:slowdown;
    LOBBY[i].ship.dy *= (Math.abs(LOBBY[i].ship.dy) < 0.001) ? 0:slowdown;
    
    //console.log(JSON.stringify(LOBBY[i].ship));

    //send info
    game_send_info(i)
  }
}

function game_send_info(index){
  //the ship
  io.to(LOBBY[index].socketID).emit('myShip', LOBBY[index].ship);
  //asteroids
  var package = {asteroids:[]};
  for (var i=0; i<ASTEROIDS.length; i++){
    if (distance(ASTEROIDS[i], LOBBY[index].ship) < 200 ){
      package.asteroids[package.asteroids.length] = Object.create(ASTEROIDS[i]);
    }
  }
  //normalize coordinates for target ship
  for (var i=0; i<package.asteroids.length; i++){
    package.asteroids[i].x -= LOBBY[index].ship.x;
    package.asteroids[i].y -= LOBBY[index].ship.y;
    package.asteroids[i].r *= 1;
  }
  //console.log(JSON.stringify(package.asteroids));
  io.to(LOBBY[index].socketID).emit('around', package);
}

function game_init_ship(index){
  LOBBY[index].ship = {x:0, y:0, dx:0, dy:0, a:0, da:0};
  LOBBY[index].input = {left:0, up:0, right:0, down:0};
}

function game_init_asteroids(x=0, y=0, belt_radius=100, nb=75, min_radius=1, max_radius=5){
  ASTEROIDS = [];
  var rand_angle, rand_radius;
  for (var i=0; i<nb; i++){
    rand_angle = Math.random()*2*Math.PI;
    rand_radius = belt_radius * (1 + (0.9*Math.random()));
    ASTEROIDS[i] = {x:Math.cos(rand_angle)*rand_radius + x, y:Math.sin(rand_angle)*rand_radius + y, r: min_radius+(Math.random()*(max_radius-min_radius)) };
  }
  //console.log(JSON.stringify(ASTEROIDS));
}





/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//UTILITY


function distance(A, B){
  return Math.sqrt((A.x-B.x)*(A.x-B.x) + (A.y-B.y)*(A.y-B.y));
}
