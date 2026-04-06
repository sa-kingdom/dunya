require('dotenv').config();

module.exports = {
  development: {
    username: process.env.SEQUELIZE_DB_USER,
    password: process.env.SEQUELIZE_DB_PASS,
    database: process.env.SEQUELIZE_DB_NAME,
    host: process.env.SEQUELIZE_DB_HOST,
    port: process.env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
  test: {
    username: process.env.SEQUELIZE_DB_USER,
    password: process.env.SEQUELIZE_DB_PASS,
    database: process.env.SEQUELIZE_DB_NAME,
    host: process.env.SEQUELIZE_DB_HOST,
    port: process.env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
  production: {
    username: process.env.SEQUELIZE_DB_USER,
    password: process.env.SEQUELIZE_DB_PASS,
    database: process.env.SEQUELIZE_DB_NAME,
    host: process.env.SEQUELIZE_DB_HOST,
    port: process.env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
};
