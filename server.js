// server.js

// init project
var express = require("express"),
  app = express(),
  http = require("http"),
  server = http.createServer(app),
  io = require("socket.io").listen(server),
  path = require("path");

server.listen(process.env.PORT);

app.use(express.static("public"));

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/index.html");
});

let users = {};

io.sockets.on("connection", function(socket) {
  socket.on("update", function(msg) {
    if ("face" in msg && "text" in msg && "loc" in msg) {
      if (
        (msg.face.length == 3 || msg.face.length == 7) &&
        msg.text.length < 200
      ) {
        msg.id = socket.id;
        msg.time = Date.now();
        users[socket.id] = msg;
        for (let user in users) {
          if (user == socket.id) {
            continue;
          }
          let loc = users[user].loc;
          if (Math.abs(msg.loc[0] - loc[0]) > 1000) {
            continue;
          }
          if (Math.abs(msg.loc[1] - loc[1]) > 1000) {
            continue;
          }
          if (user in io.sockets.connected) {
            io.sockets.connected[user].emit("update", msg);
          } else {
            delete users[user];
          }
        }
      }
    }
  });
});
