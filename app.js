var http = require('http');
var fs = require('fs');
var math = require('Math');
var player_list ={};
var laser_list = {};
var missiles = {};
var angle_unitaire = 2*(1.0/100.0)*math.PI;
var acceleration_unitaire = 2*2;

var SCREEN_WIDTH	=	1000;
var SCREEN_HEIGHT	=	1000;

//Données physiques
//m=8.0;		//Poids du vaisseau
//kfrott=0.15;	//Coeff de frottement de l'espace
//kmot=0.0;		//Norme du vecteur moteur
//angle=0.0;	//angle du vaisseau
//float dir[2]; 		//Vecteur direction unitaire
//float pos[2]; 		//Vecteur position
		
		

// Chargement du fichier index.html affiché au client
var server = http.createServer(function(req, res){
    fs.readFile('./index.html', 'utf-8', function(error, content){
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });
});

var io = require('socket.io').listen(server);

io.sockets.on('connection', function (joueur){

	console.log("Connexion d'un client");

	joueur.on('testDraw', function(player){
		io.emit('player_draw', {'pseudo':player.pseudo, 'pos':player.pos, 'angle':player.angle});
	});
	
    joueur.on('pseudo', function(pseudo){
		if(pseudo in player_list){
			joueur.emit('existing_pseudo');
			return;
		}
		
		joueur.pseudo = pseudo;
			
		//Chaque Socket correspond à un joeur, chaque joueur a une position, et des caractéristiques
		joueur.lifes = 5;
		joueur.isAlive 	= function(){	return joueur.lifes >  0;	};
		joueur.isDead	= function(){	return joueur.lifes <= 0;	};
		joueur.angle	= 0;
		joueur.pos 		= {'x':300, 'y':300};
		joueur.speed 	= {'x':0 , 'y':0 };
		joueur.acc		= 0;
		joueur.recovering = false;
		joueur.gun = 'normal';
		joueur.immune = false;
		joueur.pressed_buttons = {'up':false, 'down':false, 'left':false, 'right':false, 'shoot':false};
			
		// Quand un client se connecte, on lui envoie un message
		joueur.emit('message', 'Vous êtes bien connecté !');
		
		// On signale aux autres clients qu'il y a un nouveau venu
		joueur.broadcast.emit('message', joueur.pseudo + ' vient de se connecter !');
		
		player_list[joueur.pseudo] = joueur;
	});
	
    // Dès qu'on reçoit un "message", on le note dans la console et on l'envoie à tlm
    joueur.on('message', function (message){
		if(joueur.pseudo){
			var msg = joueur.pseudo + ' : ' + message
			console.log(msg);
			io.emit('message', msg);
		}
		else{
			joueur.emit('nopseudo');
		}
    });

	joueur.on('key_down', function(key){
		if(!joueur.pseudo){
			joueur.emit('nopseudo');
			return;
		}
		
		if(key == 'up'){
			joueur.pressed_buttons.up = true;
		}
		else if(key == 'down'){
			joueur.pressed_buttons.down = true;			
		}
		else if(key == 'left'){
			joueur.pressed_buttons.left = true;	
		}
		else if(key == 'right'){
			joueur.pressed_buttons.right = true;	
		}
		else if(key == 'shoot'){
			joueur.pressed_buttons.shoot = true;
			
			var laser = {};
			laser.pos = {};
			laser.speed = {};
			laser.angle = joueur.angle;
			laser.pos.x = joueur.pos.x;
			laser.pos.y = joueur.pos.y;
			
			var dirLaser = { 'x':math.cos(laser.angle), 'y':math.sin(laser.angle) };
			//var normeVtsLaser = (joueur.speed.x*dirLaser.x + joueur.speed.y*dirLaser.y);
			
			laser.speed.x = dirLaser.x;// * normeVtsLaser ;
			laser.speed.y = dirLaser.y;// * normeVtsLaser;
			laser.acc = 10;
			laser.id = joueur.pseudo + '-' + new Date().getTime();
			laser_list[laser.id]=laser;
			laser.lastUpdate = new Date().getTime();
				
			laser.update = function(){
				var m = 8.0;
				var kfrott=0.15;
				
				var newTime = new Date().getTime();
				var dt40 = (newTime - laser.lastUpdate)/40;	
				
				var dir = { 'x':-math.sin(laser.angle), 'y':math.cos(laser.angle) };
				
				var vectAcc = {										        //accelération=(somme des forces s'appliquant au vaisseau)/(masse du vaisseau)
					'x':((laser.acc*dir.x - kfrott*laser.speed.x)/m),		//avec forces: f=-kfrott*v, poussée=kmot*dir
					'y':((laser.acc*dir.y - kfrott*laser.speed.y)/m)
					};
					
				laser.speed.x 	= dt40*vectAcc.x + laser.speed.x;		//On en déduit la nouvelle vitesse
				laser.speed.y 	= dt40*vectAcc.y + laser.speed.y;
						
				laser.pos.x 	= dt40*laser.speed.x + laser.pos.x;		//Ainsi que la nouvelle position		
				laser.pos.y 	= dt40*laser.speed.y + laser.pos.y;
				
				laser.lastUpdate = newTime;

				if(laser.pos.x >= SCREEN_WIDTH || laser.pos.y >= SCREEN_HEIGHT || laser.pos.x < 0.0 || laser.pos.y < 0.0){
					return false;
				}
				return true;
			};
			
			io.emit('laser_shot', laser);
		}
	});
	
	joueur.on('key_up', function(key){
		if(!joueur.pseudo){
			joueur.emit('nopseudo');
			return;			
		}
		
		if(key == 'up'){
			joueur.pressed_buttons.up = false;
		}
		else if(key == 'down'){
			joueur.pressed_buttons.down = false;			
		}
		else if(key == 'left'){
			joueur.pressed_buttons.left = false;	
		}
		else if(key == 'right'){
			joueur.pressed_buttons.right = false;	
		}
		else if(key == 'shoot'){
			joueur.pressed_buttons.shoot = false;	
		}		
	});

	joueur.update = function(){
		//Données physiques
		var m=8.0;		//Poids du vaisseau
		var kfrott=0.15;	//Coeff de frottement de l'espace
		//kmot=0.0;		//Norme du vecteur moteur
		//angle=0.0;	//angle du vaisseau
		//float dir[2]; 		//Vecteur direction unitaire
		//float pos[2]; 		//Vecteur position
		
		pressed = "";
		if(joueur.pressed_buttons.up){
			joueur.acc = acceleration_unitaire;
			pressed = pressed + "up";
		}
		else
		{
			joueur.acc = 0;
		}
		if(joueur.pressed_buttons.down){
			joueur.acc = joueur.acc-acceleration_unitaire;
			pressed = pressed + ", down";
		}
		if(joueur.pressed_buttons.right){
			joueur.angle = joueur.angle + angle_unitaire;	//#ajouter modulo 2Pi pour éviter d'avoir des nombres trop grands
			pressed = pressed + ", right";
		}
		if(joueur.pressed_buttons.left){
			joueur.angle = joueur.angle - angle_unitaire;	//#ajouter modulo 2Pi pour éviter d'avoir des nombres trop grands
			pressed = pressed + ", left";
		}
		
		//console.log(pressed);
		
		//console.log("angle" + joueur.angle);
		var dir = { 'x':math.cos(joueur.angle), 'y':math.sin(joueur.angle) };
		//console.log("dir : " + dir.x + ',' + dir.y);
		
		var vectAcc = {										//accelération=(somme des forces s'appliquant au vaisseau)/(masse du vaisseau)
			'x':((joueur.acc*dir.x - kfrott*joueur.speed.x)/m),		//avec forces: f=-kfrott*v, poussée=kmot*dir
			'y':((joueur.acc*dir.y - kfrott*joueur.speed.y)/m)
			};
			
		//console.log("pos : " + joueur.pos.x + ',' + joueur.pos.y + "speed : " + joueur.speed.x + ',' + joueur.speed.y + " acc : " + vectAcc.x + ',' + vectAcc.y);
		
		joueur.speed.x 	= vectAcc.x + joueur.speed.x;		//On en déduit la nouvelle vitesse
		joueur.speed.y 	= vectAcc.y + joueur.speed.y;
		
		//console.log("newspeed : " + joueur.speed.x + ',' + joueur.speed.y);
				
				
		joueur.pos.x 	= joueur.pos.x + joueur.speed.x;		//Ainsi que la nouvelle position		
		joueur.pos.y 	= joueur.pos.y + joueur.speed.y;
		//console.log("newpos : " + joueur.pos.x + ',' + joueur.pos.y);

		
		
		//pos[0]=modulpos(pos[0],(float)SCREEN_WIDTH);	//Option Laby
		//pos[1]=modulpos(pos[1],(float)SCREEN_HEIGHT);

		joueur.pos.x=math.min(joueur.pos.x,SCREEN_WIDTH);		//Sans Option Laby
		joueur.pos.y=math.min(joueur.pos.y,SCREEN_HEIGHT);	//Ne passe pas dans les murs
		joueur.pos.x=math.max(joueur.pos.x,0.0);
		joueur.pos.y=math.max(joueur.pos.y,0.0);
		
		if(joueur.pos.x == SCREEN_WIDTH || joueur.pos.x == 0) joueur.speed.x=0;
		if(joueur.pos.y == SCREEN_HEIGHT || joueur.pos.y == 0) joueur.speed.y=0;
	};
});

var animate = function(){
	for(var id in player_list){
		var player = player_list[id];
		player.update();
		io.emit('player_pos', {'pseudo':player.pseudo, 'pos':player.pos, 'angle':player.angle});
	}
	
	for(var id in laser_list){
		var laser = laser_list[id];
		if(laser.update()){
			//io.emit('laser_shot', {'id':laser.id, 'pos':laser.pos, 'angle':laser.angle});
		}
		else{
			//io.emit('delete_laser', laser.id);
			delete(laser_list[laser.id]);
		}
	}
}

server.listen(process.argv[2], function(){
	setInterval(animate, 40);
});
