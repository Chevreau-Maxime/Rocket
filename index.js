var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});


var ASTEROIDS = [];
var LOBBY = [];
var tick_count;
var turnspeed = 0.02;
var acceleration = 0.05;
var slowdown = 0.95;
var turnslow = 0.9;


io.on('connection', function(socket){
  var key = Math.random();
  var index = lobby_add(key, socket.id);
  console.log("__Connect (Temporary)");

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
game_asteroids_add_belt(0, 0, 600, 200, 10, 20);
game_asteroids_add_belt(0, 0, 350, 100, 10, 20);
game_asteroids_add_belt(0, 0, 150, 100, 5, 10);
game_asteroids_add_belt(0, 0, 50, 20, 1, 3);
game_asteroids_add_belt(0, 0, 0.00001, 1, 30, 30);

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

////////////////////////////////////////////////////////////////////////////////////////////////
//GAME
clearInterval(inter);
var inter = setInterval(game_step, 1000/30);
function game_step(){

  //physics : 
  game_update_asteroids();

  //for each player : 
  for (var i=0; i<LOBBY.length; i++){
    //ship update :
    game_step_update_ship(i)
    game_step_update_collisions(i);
    //send info
    game_send_info(i)
  }
  if (tick_count%300) game_step_slow();
  tick_count++;
}

function game_step_slow(){

}


function game_step_update_collisions(index){
  for (var i=0; i<ASTEROIDS.length; i++){
    if (distance(ASTEROIDS[i], LOBBY[index].ship) < ASTEROIDS[i].r + 0.5){
      //collision
      var impact_strength = 1;
      var diff_x = LOBBY[index].ship.x - ASTEROIDS[i].x;
      var diff_y = LOBBY[index].ship.y - ASTEROIDS[i].y;
      var angle = Math.acos(diff_y / Math.sqrt( (diff_x*diff_x)+(diff_y*diff_y) ));
      //if it works.....
      angle -= Math.PI/2;
      if (diff_x<0){
        angle = Math.PI - angle;
        if (diff_y>0) angle -= Math.PI*2;
      }
      angle *= -1;
      //.........................
      LOBBY[index].ship.dx += impact_strength * Math.cos(angle);
      LOBBY[index].ship.dy += impact_strength * Math.sin(angle);
    }
  }
}

function game_step_update_ship(index){
  //angular :
  if (LOBBY[index].input.left){ LOBBY[index].ship.da -= turnspeed; }
  if (LOBBY[index].input.right){ LOBBY[index].ship.da += turnspeed; }
  LOBBY[index].ship.da *= (Math.abs(LOBBY[index].ship.da) < 0.001) ? 0:turnslow;
  LOBBY[index].ship.a += LOBBY[index].ship.da;
  if (Math.abs(LOBBY[index].ship.a) > Math.PI){
    LOBBY[index].ship.a -= (LOBBY[index].ship.a/Math.abs(LOBBY[index].ship.a)) * Math.PI * 2;
  }
  
  //velocity :
  if (LOBBY[index].input.up){ 
    LOBBY[index].ship.dx += Math.cos(LOBBY[index].ship.a)*acceleration;
    LOBBY[index].ship.dy += Math.sin(LOBBY[index].ship.a)*acceleration;
  }
  LOBBY[index].ship.x += LOBBY[index].ship.dx;
  LOBBY[index].ship.y += LOBBY[index].ship.dy;
  LOBBY[index].ship.dx *= (Math.abs(LOBBY[index].ship.dx) < 0.001) ? 0:slowdown;
  LOBBY[index].ship.dy *= (Math.abs(LOBBY[index].ship.dy) < 0.001) ? 0:slowdown;
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
    if ((distance(LOBBY[i].ship, LOBBY[index].ship) < 100) & LOBBY[i].status){
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
  
  var r = 65 + Math.random()*5;
  var angle = Math.random()*2*Math.PI;
  LOBBY[index].ship = {x:r*Math.cos(angle), y:r*Math.sin(angle), dx:0, dy:0, a:0, da:0};
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
    rand_radius = belt_radius * (1 + (0.25*Math.random()));
    ASTEROIDS[start_i + i] = 
                             {x:Math.cos(rand_angle)*rand_radius + x, 
                              y:Math.sin(rand_angle)*rand_radius + y,
                              r: min_radius+(Math.random()*(max_radius-min_radius)),
                              orbit_angle:rand_angle,
                              orbit_radius:rand_radius,
                              orbit_tick_duration: 180 * (belt_radius/500) * 30};
    
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

function game_update_asteroids(){
  for (var i=0; i<ASTEROIDS.length; i++){
    ASTEROIDS[i].orbit_angle += Math.PI / ASTEROIDS[i].orbit_tick_duration;
    ASTEROIDS[i].x = Math.cos(ASTEROIDS[i].orbit_angle) * ASTEROIDS[i].orbit_radius;
    ASTEROIDS[i].y = Math.sin(ASTEROIDS[i].orbit_angle) * ASTEROIDS[i].orbit_radius;
  }
}





/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//UTILITY


function distance(A, B){
  return Math.sqrt((A.x-B.x)*(A.x-B.x) + (A.y-B.y)*(A.y-B.y));
}
