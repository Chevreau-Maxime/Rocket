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
  console.log("__Connect (Temporary) : \nLobby list : ");
  //lobby_print();


  /*socket.on('name', function(msg){
    LOBBY[index].name = msg;
  });
*/
  socket.on('authentificate', function(msg){
    //delete temporary
    LOBBY.splice(index, 1);
    key = msg.key;
    if (!lobby_key_available(key)){ //existing account
      index = lobby_login(key, socket.id);
      console.log("__LOGIN : ");
    } else { //new account
      index = lobby_add(key, socket.id);
      console.log("__CREATION : ");
    }
    LOBBY[index].name = msg.name;
    lobby_print_player(index);
  });

  socket.on('input', function(msg){
    LOBBY[index].input = msg;
  });

  socket.on('disconnect', function(){
    console.log("__DISCONNECT : ");
    LOBBY[index].status = false;
    lobby_print_player(index);
    lobby_print();
  });
});

//io.emit('chat message', msg);
//io.to(socketId).emit

http.listen(port, function(){
  console.log('listening on *:' + port);
});



////////////////////////////////
//INIT

game_init_asteroids();
game_asteroids_add_belt(0, 0, 150, 200, 5, 10);
game_asteroids_add_belt(0, 0, 50, 100, 1, 3);
game_asteroids_check_collision();











////////////////////////////////////////////////////////////////////////////////////////////////
//LOBBY

function lobby_add(_key, _socketID){
  var index = LOBBY.length;
  LOBBY[index] = {name:"?", key:_key, socketID:_socketID, status:true};
  game_init_ship(index);
  return index;
}

function lobby_login(_key, _socketID){
  var index = lobby_key_index(_key);
  LOBBY[index].socketID = _socketID;
  LOBBY[index].status = true;
  return index;
}

function lobby_key_available(_key){
  for (var i=0; i<LOBBY.length; i++){
    if (LOBBY[i].key == _key){
      return false;
    }
  }
  return true;
}

function lobby_key_index(_key){
  for (var i=0; i<LOBBY.length; i++){
    if (LOBBY[i].key == _key){
      return i;
    }
  }
  return null;
}

function lobby_print(){
  console.log("-----------")
  for (var i=0; i<LOBBY.length; i++){
    lobby_print_player(i);
  }
  console.log("-----------")
}

function lobby_print_player(index){
  var name = LOBBY[index].name;
  var key = LOBBY[index].key;
  var socket = LOBBY[index].socketID;
  var status = LOBBY[index].status;

  console.log("\""+name+"\" ("+key+") --- " + (status ? "online":"offline"))
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
  if(LOBBY[index].status == false) return;
  //the ship
  game_send_info_ship(index);
  //asteroids
  var package = {asteroids:[], ships:[]};
  game_send_info_asteroids(index, package);
  game_send_info_ships(index, package);
  io.to(LOBBY[index].socketID).emit('around', package);
}

function game_send_info_ship(index){
  io.to(LOBBY[index].socketID).emit('myShip', LOBBY[index].ship);
}

function game_send_info_asteroids(index, package){
  for (var i=0; i<ASTEROIDS.length; i++){
    if (distance(ASTEROIDS[i], LOBBY[index].ship) < 100 ){
      package.asteroids[package.asteroids.length] = Object.create(ASTEROIDS[i]);
    }
  }
  //normalize coordinates for target ship
  for (var i=0; i<package.asteroids.length; i++){
    package.asteroids[i].x -= LOBBY[index].ship.x;
    package.asteroids[i].y -= LOBBY[index].ship.y;
    package.asteroids[i].r *= 1;
  }
}

function game_send_info_ships(index, package){
  for (var i=0; i<LOBBY.length; i++){
    if (distance(LOBBY[i].ship, LOBBY[index].ship) < 100 ){
      package.ships[package.ships.length] = Object.create(LOBBY[i].ship);
      package.ships[package.ships.length-1].name = LOBBY[i].name;
    }
  }
  //normalize coordinates for target ship
  for (var i=0; i<package.ships.length; i++){
    package.ships[i].x -= LOBBY[index].ship.x;
    package.ships[i].y -= LOBBY[index].ship.y;
    package.ships[i].a = package.ships[i].a;
    package.ships[i].name = package.ships[i].name;
  }
}




function game_init_ship(index){
  LOBBY[index].ship = {x:0, y:0, dx:0, dy:0, a:0, da:0};
  LOBBY[index].input = {left:0, up:0, right:0, down:0};
}

function game_init_asteroids(){
  ASTEROIDS = [];
}

function game_asteroids_add_belt(x=0, y=0, belt_radius=100, nb=75, min_radius=1, max_radius=5){
  var start_i = ASTEROIDS.length;
  var rand_angle, rand_radius;
  for (var i=0; i<nb; i++){
    rand_angle = Math.random()*2*Math.PI;
    rand_radius = belt_radius * (1 + (0.5*Math.random()));
    ASTEROIDS[start_i + i] = {x:Math.cos(rand_angle)*rand_radius + x, y:Math.sin(rand_angle)*rand_radius + y, r: min_radius+(Math.random()*(max_radius-min_radius)) };
  }
}

function game_asteroids_check_collision(){
  for (var i=0; i<ASTEROIDS.length; i++){
    for (var j=i+1; j<ASTEROIDS.length; j++){
      if (distance(ASTEROIDS[i], ASTEROIDS[j]) < (ASTEROIDS[i].r + ASTEROIDS[j].r)){
        //then delete one
        ASTEROIDS.splice(j, 1);
        j -= 1;
      }
    }
  }
}





/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//UTILITY


function distance(A, B){
  return Math.sqrt((A.x-B.x)*(A.x-B.x) + (A.y-B.y)*(A.y-B.y));
}
