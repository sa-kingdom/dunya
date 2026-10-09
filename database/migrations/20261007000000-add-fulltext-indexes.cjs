'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Prefer the ngram parser for CJK tokenization; fall back to the
    // default parser when the engine does not provide ngram (e.g. MariaDB).
    try {
      await queryInterface.sequelize.query(
        'CREATE FULLTEXT INDEX posts_content_fulltext ON posts (content) WITH PARSER ngram'
      );
    } catch (e) {
      console.warn(
        'ngram parser is unavailable, falling back to the default FULLTEXT parser for posts:',
        e.message
      );
      await queryInterface.sequelize.query(
        'CREATE FULLTEXT INDEX posts_content_fulltext ON posts (content)'
      );
    }
    try {
      await queryInterface.sequelize.query(
        'CREATE FULLTEXT INDEX discussions_name_fulltext ON discussions (name) WITH PARSER ngram'
      );
    } catch (e) {
      console.warn(
        'ngram parser is unavailable, falling back to the default FULLTEXT parser for discussions:',
        e.message
      );
      await queryInterface.sequelize.query(
        'CREATE FULLTEXT INDEX discussions_name_fulltext ON discussions (name)'
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE posts DROP INDEX posts_content_fulltext'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE discussions DROP INDEX discussions_name_fulltext'
    );
  }
};
