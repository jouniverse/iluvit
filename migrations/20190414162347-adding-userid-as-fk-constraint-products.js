"use strict";

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addConstraint("Products", {
      fields: ["userId"],
      type: "foreign key",
      name: "userid-fk-in-products",
      references: {
        table: "Users",
        field: "id",
      },
      onDelete: "cascade",
      onUpdate: "cascade",
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeConstraint("Products", "userid-fk-in-products");
  },
};
