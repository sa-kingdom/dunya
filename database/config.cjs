/**
 * Sequelize configuration for CLI and migrations.
 * This file is required by .sequelizerc and specifies database connection settings
 * for development, test, and production environments.
 * It uses Bun.env when running in a Bun environment, with a fallback to process.env for Node.js compatibility.
 */

const env = typeof Bun !== 'undefined' ? Bun.env : process.env;

module.exports = {
  development: {
    username: env.SEQUELIZE_DB_USER,
    password: env.SEQUELIZE_DB_PASS,
    database: env.SEQUELIZE_DB_NAME,
    host: env.SEQUELIZE_DB_HOST,
    port: env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
  test: {
    username: env.SEQUELIZE_DB_USER,
    password: env.SEQUELIZE_DB_PASS,
    database: env.SEQUELIZE_DB_NAME,
    host: env.SEQUELIZE_DB_HOST,
    port: env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
  production: {
    username: env.SEQUELIZE_DB_USER,
    password: env.SEQUELIZE_DB_PASS,
    database: env.SEQUELIZE_DB_NAME,
    host: env.SEQUELIZE_DB_HOST,
    port: env.SEQUELIZE_DB_PORT,
    dialect: 'mysql',
  },
};


