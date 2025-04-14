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

  // Buat queue durable
  channel.assertQueue(queueName, { durable: true });
  // Consume pesan dari queue
  channel.consume(
    queueName,
    function (msg) {
      const message = JSON.parse(msg.content.toString());
      console.log(`Received in room_${roomId}:`, message);
      // Logging untuk notifikasi real-time
    },
    { noAck: true } // Auto-ack untuk logging
  );
}

function publishToRoom(roomId, message) {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  const queueName = `room_${roomId}`;
  // Pastikan queue ada
  channel.assertQueue(queueName, { durable: true });
  // Kirim langsung ke queue
  channel.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(message)),
    { persistent: true } // Pesan disimpan di queue durable
  );
}

function getMessages(roomId) {
  return new Promise((resolve) => {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    const queueName = `room_${roomId}`;
    const messages = [];

    // Pastikan queue ada
    channel.assertQueue(queueName, { durable: true }, function (error2, q) {
      if (error2) {
        console.error("Gagal akses queue:", error2);
        resolve(messages);
        return;
      }

      // Consume pesan dari queue, tanpa hapus
      channel.consume(
        queueName,
        function (msg) {
          if (msg !== null) {
            const message = JSON.parse(msg.content.toString());
            messages.push(message);
          }
        },
        { noAck: true }, // Pesan tetap di queue
        function () {
          // Tunggu sebentar, lalu kembalikan pesan
          setTimeout(() => {
            resolve(messages);
          }, 100); // Delay untuk kumpulkan pesan
        }
      );
    });
  });
}

function finishRoom(roomId) {
  return new Promise((resolve, reject) => {
    if (!channel) return reject(new Error("RabbitMQ channel not initialized"));
    const queueName = `room_${roomId}`;

    // Pastikan queue ada
    channel.assertQueue(queueName, { durable: true }, function (error2, q) {
      if (error2) {
        console.error("Gagal akses queue:", error2);
        return reject(error2);
      }

      // Consume semua pesan dan ack
      channel.consume(
        queueName,
        function (msg) {
          if (msg !== null) {
            channel.ack(msg); // Ack pesan
          }
        },
        { noAck: false }, // Manual ack
        function () {
          // Setelah consume, hapus queue
          channel.deleteQueue(queueName, function (error3) {
            if (error3) {
              console.error("Gagal hapus queue:", error3);
              return reject(error3);
            }
            console.log(`Queue ${queueName} dihapus`);
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
