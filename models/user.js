"use strict";
module.exports = (sequelize, DataTypes) => {
  var User = sequelize.define(
    "User",
    {
      username: DataTypes.STRING,
      password: DataTypes.STRING,
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      address: DataTypes.STRING,
      phone: DataTypes.STRING,
    },
    {}
  );
  User.associate = function (models) {
    models.User.hasMany(models.Product, { foreignKey: "userId" });
    models.User.hasMany(models.Comment, { foreignKey: "userId" });
    models.User.hasMany(models.ShoppingCart, { foreignKey: "userId" });
  };
  return User;
};
