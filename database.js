const mysql = require("mysql2/promise");
const { dbConfig } = require("./config.js");

const globalpooldb = {
  db: null,
};
async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    await connection.query("CREATE DATABASE IF NOT EXISTS chat_app");
    await connection.end();

    const db = await mysql.createConnection(dbConfig);
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL, 
        no_hp VARCHAR(20) NOT NULL,
        umur INT NOT NULL,
        topic TEXT NOT NULL, 
        room_name VARCHAR(50),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.end();
    console.log("Database dan tabel berhasil diinisialisasi");
  } catch (error) {
    console.error("Inisialisasi database gagal:", error);
    throw error;
  }
}

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

async function initialPool() {
  console.log("instances");
  globalpooldb.db = await mysql.createConnection(dbConfig);
}
module.exports = {
  initializeDatabase,
  getConnection,
  globalpooldb,
  initialPool,
};
