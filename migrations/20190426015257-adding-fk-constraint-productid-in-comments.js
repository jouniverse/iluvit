"use strict";

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addConstraint("Comments", {
      fields: ["productId"],
      type: "foreign key",
      name: "postid-fk-in-comments",
      references: {
        table: "Products",
        field: "id",
      },
      onDelete: "cascade",
      onUpdate: "cascade",
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeConstraint("Comments", "postid-fk-in-comments");
  },
};
