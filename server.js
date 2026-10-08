// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 参加している全プレイヤーの位置情報を保持
const players = {};

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 新規プレイヤーの初期位置を設定
    players[socket.id] = { x: 0, y: 0.5, z: 0 };

    // 全員に現在のプレイヤー一覧を送る
    io.emit('currentPlayers', players);

    // プレイヤーから移動データを受け取ったら全員に共有
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: movementData.x, z: movementData.z });
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

//Renderが割り当てるポート番号（process.env.PORT）を使うように変更
const PORT = process.env.PORT || 3000;

http.listen(PORT, '0.0.0.0', () => {
   console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
