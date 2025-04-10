const mysql = require("mysql2/promise");
const { dbConfig } = require("./config.js");

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
        topic_keluhan TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
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

module.exports = { initializeDatabase, getConnection };
