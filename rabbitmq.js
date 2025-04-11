const amqp = require("amqplib/callback_api");

let channel;
const messageBuffer = new Map();

function connectRabbitMQ() {
  return new Promise((resolve, reject) => {
    amqp.connect("amqp://localhost", function (error0, connection) {
      if (error0) return reject(error0);
      connection.createChannel(function (error1, ch) {
        if (error1) return reject(error1);
        channel = ch;
        console.log("Connected to RabbitMQ");
        resolve();
      });
    });
  });
}

// setup consumer yang listen ke broker queue dengan nama roomName
function subscribeToRoom(roomName) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  // pastikan queue suadah ada, jika tidak ada otomatis buat
  // buat queue dengan variabel roomName dengan durable true agar pesan tidak hilang waktu restart
  channel.assertQueue(roomName, { durable: true });
  //client subscribe ke queue (hanya ditrigger sekali saja seperti inisialisasi untuk queue agar siap menerima message)
  channel.consume(
    roomName,
    function (msg) {
      const message = JSON.parse(msg.content.toString());
      // Ambil pesan dari queue dan simpan ke messageBuffer berdasarkan roomName
      if (!messageBuffer.has(roomName)) messageBuffer.set(roomName, []);
      messageBuffer.get(roomName).push(message);
      // ack pesan agar dihapus dari queue
      // channel.ack(msg);
    },
    { noAck: false }
  );
}

// fungsi publish message ke rabbitmq queue dengan nama roomName
function publishToRoom(roomName, message) {
  // cek apakah channel sudah terkoneksi
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  // pastikan queue suadah ada, jika tidak ada otomatis buat
  channel.assertQueue(roomName, { durable: true });
  // kirirm message ke queue dengan nama roomName
  channel.sendToQueue(roomName, Buffer.from(JSON.stringify(message)));
  // subskrep lagi
  if (!messageBuffer.has(roomName)) {
    console.log(`Auto subskrep ke ${roomName}`);
    subscribeToRoom(roomName);
  }
}

function getMessages(roomName) {
  const messages = messageBuffer.get(roomName) || [];
  // Kosongkan setelah ambil
  // messageBuffer.set(roomName, []);

  return messages;
}

module.exports = {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
};
