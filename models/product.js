"use strict";
module.exports = (sequelize, DataTypes) => {
  var Product = sequelize.define(
    "Product",
    {
      title: DataTypes.STRING,
      description: DataTypes.STRING,
      price: DataTypes.DOUBLE,
      imageURL: DataTypes.STRING,
      userId: DataTypes.INTEGER,
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
    },
    {}
  );
  Product.associate = function (models) {
    models.Product.belongsTo(models.User, { foreignKey: "userId" });
    models.Product.hasMany(models.Comment, {
      as: "comments",
      foreignKey: "productId",
    });
    models.Product.hasMany(models.ProductImage, {
      as: "images",
      foreignKey: "productId",
    });
    models.Product.hasMany(models.ShoppingCart, {
      foreignKey: "productId",
    });
  };
  return Product;
};
