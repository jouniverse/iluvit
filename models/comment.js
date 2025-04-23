"use strict";
module.exports = (sequelize, DataTypes) => {
  var Comment = sequelize.define(
    "Comment",
    {
      title: DataTypes.STRING,
      description: DataTypes.STRING,
      productId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
    },
    {}
  );
  Comment.associate = function (models) {
    models.Comment.belongsTo(models.Product, {
      as: "product",
      foreignKey: "productId",
    });
    models.Comment.belongsTo(models.User, { foreignKey: "userId" });
  };
  return Comment;
};
