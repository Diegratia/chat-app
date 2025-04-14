const amqp = require("amqplib/callback_api");

let displayedMessages = new Set();
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

//subskrep dan konsum tapi nack, kalau dipostman perlu getmessage
function subscribeToRoom(roomId) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  const queueName = `room_${roomId}`;
  channel.assertQueue(queueName, { durable: true });
  channel.consume(
    queueName,
    function (msg) {
      if (msg !== null) {
        try {
          const message = JSON.parse(msg.content.toString());
          const msgKey = `${message.sender_type}:${message.message}:${message.sender_id}`;
          if (!displayedMessages.has(msgKey)) {
            console.log(`${message.sender_type}: ${message.message}`);
            displayedMessages.add(msgKey);
          }
          channel.nack(msg, false, true); // Kembalikan pesan ke queue
        } catch (e) {
          console.error("[subscribeToRoom] Gagal parse pesan:", e);
          channel.nack(msg, false, false);
        }
      }
    },
    { noAck: false }
  );
}

function publishToRoom(roomId, message) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  const queueName = `room_${roomId}`;
  //queue durable
  channel.assertQueue(queueName, { durable: true });
  // kirim langsung ke queue
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
}
// function getMessages(roomId) {
//   return new Promise((resolve, reject) => {
//     if (!channel) return reject(new Error("RabbitMQ channel not initialized"));
//     const queueName = `room_${roomId}`;
//     const messages = [];
//     const toNack = [];
//     let consumerTag = null;

//     channel.assertQueue(queueName, { durable: true }, function (error2, q) {
//       if (error2) {
//         console.error("[getMessages] Gagal akses queue:", error2);
//         return resolve(messages);
//       }

//       const messageCount = q.messageCount;
//       if (messageCount === 0) {
//         return resolve(messages);
//       }

//       channel.consume(
//         queueName,
//         function (msg) {
//           if (msg !== null) {
//             try {
//               const message = JSON.parse(msg.content.toString());
//               messages.push(message);
//               toNack.push(msg);
//               if (messages.length >= messageCount) {
//                 channel.cancel(consumerTag, () => {
//                   toNack.forEach((m) => channel.nack(m, false, true));
//                   resolve(messages);
//                 });
//               }
//             } catch (e) {
//               console.error("[getMessages] Gagal parse pesan:", e);
//               channel.nack(msg, false, true);
//             }
//           }
//         },
//         { noAck: false },
//         function (err, ok) {
//           if (err) {
//             console.error("[getMessages] Gagal consume:", err);
//             return reject(err);
//           }
//           consumerTag = ok.consumerTag;
//         }
//       );
//     });
//   });
// }

function finishRoom(roomId) {
  return new Promise((resolve, reject) => {
    if (!channel) return reject(new Error("RabbitMQ channel not initialized"));
    const queueName = `room_${roomId}`;

    channel.assertQueue(queueName, { durable: true }, function (error2, q) {
      if (error2) {
        console.error("Gagal akses queue:", error2);
        return reject(error2);
      }

      channel.consume(
        queueName,
        function (msg) {
          if (msg !== null) {
            channel.ack(msg);
          }
        },
        { noAck: false },
        function () {
          channel.deleteQueue(queueName, function (error3) {
            if (error3) {
              console.error("Gagal hapus queue:", error3);
              return reject(error3);
            }
            console.log(`Queue ${queueName} dihapus`);
            displayedMessages.clear(); // Bersihkan filter
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
  // getMessages,
  finishRoom,
};

// const amqp = require("amqplib/callback_api");

// let channel;
// const messageBuffer = new Map();

// function connectRabbitMQ() {
//   return new Promise((resolve, reject) => {
//     amqp.connect("amqp://localhost", function (error0, connection) {
//       if (error0) return reject(error0);
//       connection.createChannel(function (error1, ch) {
//         if (error1) return reject(error1);
//         channel = ch;
//         // console.log(ch);
//         console.log("Connected to RabbitMQ");
//         resolve();
//       });
//     });
//   });
// }

// // setup consumer yang listen ke broker queue dengan nama roomName
// function subscribeToRoom(roomName) {
//   if (!channel) throw new Error("RabbitMQ channel not initialized");
//   // pastikan queue suadah ada, jika tidak ada otomatis buat
//   // buat queue dengan variabel roomName dengan durable true agar pesan tidak hilang waktu restart
//   channel.assertQueue(roomName, { durable: true });
//   //client subscribe ke queue (hanya ditrigger sekali saja seperti inisialisasi untuk queue agar siap menerima message)
//   channel.consume(
//     roomName,
//     function (msg) {
//       const message = JSON.parse(msg.content.toString());
//       console.log(message);

//       // Ambil pesan dari queue dan simpan ke messageBuffer berdasarkan roomName
//       if (!messageBuffer.has(roomName)) messageBuffer.set(roomName, []);
//       messageBuffer.get(roomName).push(message);
//       // ack pesan agar dihapus dari queue
//       // channel.ack(msg);
//     },
//     { noAck: false }
//   );
// }

// // fungsi publish message ke rabbitmq queue dengan nama roomName
// function publishToRoom(roomName, message) {
//   // cek apakah channel sudah terkoneksi
//   if (!channel) throw new Error("RabbitMQ channel not initialized");
//   // pastikan queue suadah ada, jika tidak ada otomatis buat
//   channel.assertQueue(roomName, { durable: true });
//   // kirirm message ke queue dengan nama roomName
//   channel.sendToQueue(roomName, Buffer.from(JSON.stringify(message)));
//   // subskrep lagi
//   if (!messageBuffer.has(roomName)) {
//     // console.log(`Auto subskrep ke ${roomName}`);
//     // subscribeToRoom(roomName);
//   }
// }

// function getMessages(roomName) {
//   const messages = messageBuffer.get(roomName) || [];
//   // Kosongkan setelah ambil
//   // messageBuffer.set(roomName, []);

//   return messages;
// }

// module.exports = {
//   connectRabbitMQ,
//   subscribeToRoom,
//   publishToRoom,
//   getMessages,
// };
