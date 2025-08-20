#!/usr/bin/env node

var amqp = require("amqplib/callback_api");

amqp.connect("amqp://localhost", function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }

    var queue = "hello";

    channel.assertQueue(queue, {
      durable: false,
    });

    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

    channel.consume(
      queue,
      function (msg) {
        console.log(" [x] Received %s", msg.content.toString());
      },
      {
        noAck: true,
      }
    );
  });
});

const amqp = require("amqplib/callback_api");

let channel;

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

function subscribeToRoom(roomId) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  const queueName = `room_${roomId}`;
  channel.assertQueue(queueName, { durable: true });
  console.log(`[subscribeToRoom] Initialized queue ${queueName}`);
  // Tidak consume, hanya buat queue
}

function publishToRoom(roomId, message) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  const queueName = `room_${roomId}`;
  channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  console.log(`[publishToRoom] Sent to ${queueName}:`, message);
}

function getMessages(roomId) {
  return new Promise((resolve) => {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    const queueName = `room_${roomId}`;
    const messages = [];
    channel.assertQueue(queueName, { durable: true }, function (error2, q) {
      if (error2) {
        console.error("[getMessages] Gagal akses queue:", error2);
        resolve(messages);
        return;
      }
      channel.consume(
        queueName,
        function (msg) {
          if (msg !== null) {
            try {
              const message = JSON.parse(msg.content.toString());
              messages.push(message);
              console.log(`[getMessages] Read from ${queueName}:`, message);
            } catch (e) {
              console.error("[getMessages] Gagal parse pesan:", e);
            }
          }
        },
        { noAck: true },
        function (err) {
          if (err) {
            console.error("[getMessages] Gagal consume:", err);
          }
          console.log(
            `[getMessages] Finished reading ${queueName}, messages:`,
            messages
          );
          setTimeout(() => {
            resolve(messages);
          }, 100);
        }
      );
    });
  });
}

function finishRoom(roomId) {
  return new Promise((resolve, reject) => {
    if (!channel) return reject(new Error("RabbitMQ channel not initialized"));
    const queueName = `room_${roomId}`;
    channel.assertQueue(queueName, { durable: true }, function (error2, q) {
      if (error2) {
        console.error("[finishRoom] Gagal akses queue:", error2);
        return reject(error2);
      }
      channel.consume(
        queueName,
        function (msg) {
          if (msg !== null) {
            console.log(`[finishRoom] Acked message in ${queueName}`);
            channel.ack(msg);
          }
        },
        { noAck: false },
        function (err) {
          if (err) {
            console.error("[finishRoom] Gagal consume:", err);
            return reject(err);
          }
          channel.deleteQueue(queueName, function (error3) {
            if (error3) {
              console.error("[finishRoom] Gagal hapus queue:", error3);
              return reject(error3);
            }
            console.log(`[finishRoom] Queue ${queueName} dihapus`);
            resolve();
          });
        }
      );
    });
  });
}

module.exports = {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
  finishRoom,
};
