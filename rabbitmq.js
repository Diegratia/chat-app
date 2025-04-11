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

function subscribeToRoom(roomName) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  channel.assertExchange(roomName, "direct", { durable: false });
  channel.assertQueue("", { exclusive: true }, function (error2, q) {
    if (error2) throw error2;
    channel.bindQueue(q.queue, roomName, roomName);
    channel.consume(
      q.queue,
      function (msg) {
        const message = JSON.parse(msg.content.toString());
        if (!messageBuffer.has(roomName)) messageBuffer.set(roomName, []);
        messageBuffer.get(roomName).push(message);
        channel.ack(msg);
      },
      { noAck: false }
    );
  });
}

function publishToRoom(roomName, message) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  channel.assertExchange(roomName, "direct", { durable: false });
  channel.publish(roomName, roomName, Buffer.from(JSON.stringify(message)));
}

function getMessages(roomName) {
  const messages = messageBuffer.get(roomName) || [];
  messageBuffer.set(roomName, []); // Kosongkan setelah ambil
  return messages;
}

module.exports = {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
};
