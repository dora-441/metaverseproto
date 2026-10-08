// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sqlite3 = require('sqlite3').verbose();

app.use(express.static('public'));

// 1. データベースの初期化（ファイル名: database.db）
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('DB接続エラー:', err.message);
    } else {
        console.log('SQLite データベースに接続しました。');
    }
});

// テーブル作成（存在しない場合のみ自動生成）
db.run(`
  CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    socket_id TEXT,
    joined_at TEXT,
    left_at TEXT,
    duration_seconds INTEGER
  )
`);

// 接続中の全プレイヤー情報と入室時刻を保持
const players = {};

io.on('connection', (socket) => {
    const joinTime = new Date(); // 入室時刻
    console.log(`[入室] ID: ${socket.id} (${joinTime.toLocaleString('ja-JP')})`);

    // プレイヤー管理データに追加
    players[socket.id] = {
        x: 0,
        y: 0.5,
        z: 0,
        joinedAt: joinTime
    };

    // 接続したプレイヤー全員に現在のプレイヤー情報を送信
    io.emit('currentPlayers', players);

    // プレイヤーからの移動データを受信したら他全員へ共有
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movementData.x,
                z: movementData.z
            });
        }
    });

    // 2. 切断（退室）時に滞在時間を計算してDBへ保存
    socket.on('disconnect', () => {
        const leaveTime = new Date(); // 退室時刻
        const joinedAt = players[socket.id]?.joinedAt || leaveTime;

        // 滞在時間（秒数）を計算
        const durationSeconds = Math.floor((leaveTime - joinedAt) / 1000);

        console.log(`[退室] ID: ${socket.id} (滞在時間: ${durationSeconds}秒)`);

        // DBへのデータ挿入処理
        const stmt = db.prepare(`
      INSERT INTO session_logs (socket_id, joined_at, left_at, duration_seconds)
      VALUES (?, ?, ?, ?)
    `);

        stmt.run(
            socket.id,
            joinedAt.toISOString(),
            leaveTime.toISOString(),
            durationSeconds,
            (err) => {
                if (err) console.error('ログ保存失敗:', err.message);
                else console.log('滞在時間をDBに記録しました。');
            }
        );
        stmt.finalize();

        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// 3. Renderなどのクラウド環境に対応したポート設定
const PORT = process.env.PORT || 3000;

http.listen(PORT, '0.0.0.0', () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});