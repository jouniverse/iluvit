const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const models = require("../models");

const SALT_ROUNDS = 10;

router.get("/logout", (req, res, next) => {
  if (req.session) {
    req.session.destroy((error) => {
      if (error) {
        next(error);
      } else {
        res.redirect("/login");
      }
    });
  }
});

router.get("/comments/:commentId", async (req, res) => {
  let commentId = req.params.commentId;
  let comment = await models.Comment.findOne({
    include: [
      {
        model: models.Product,
        as: "product",
      },
    ],
    where: {
      id: commentId,
    },
  });

  // console.log(comment);
  res.json(comment);
});

router.post("/add-comment", async (req, res) => {
  let productId = parseInt(req.body.productId);
  let title = req.body.title;
  let description = req.body.description;

  let comment = models.Comment.build({
    title: title,
    description: description,
    productId: productId,
  });

  let savedComment = await comment.save();

  if (savedComment) {
    res.redirect(`/products/${productId}`);
  } else {
    res.render("product-details", { message: "Error adding comment!" });
  }
});

router.get("/products/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await models.Product.findOne({
      include: [
        {
          model: models.Comment,
          as: "comments",
          include: [
            {
              model: models.User,
              attributes: ["username"],
            },
          ],
        },
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
      where: {
        id: productId,
      },
    });

    if (!product) {
      return res.redirect("/?message=Product not found&type=danger");
    }

    res.render("users/product-details", {
      product: product,
      isAuthenticated: req.session.user ? true : false,
    });
  } catch (error) {
    console.error("Error loading product:", error);
    res.redirect("/?message=Error loading product&type=danger");
  }
});

router.get("/", async (req, res) => {
  try {
    const products = await models.Product.findAll({
      include: [
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 40, // Limit to 40 products for better UX
    });

    const processedProducts = products.map((product) => {
      const productData = product.get({ plain: true });
      productData.images = productData.images || [];
      productData.imageURL =
        productData.images.length > 0
          ? productData.images[0].imageURL
          : productData.imageURL || null;
      return productData;
    });

    res.render("index", {
      products: processedProducts,
      isAuthenticated: req.session.user ? true : false,
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.render("index", {
      products: [],
      message: "Error loading products. Please try again.",
      type: "danger",
      isAuthenticated: req.session.user ? true : false,
    });
  }
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.get("/register", (req, res) => {
  res.render("register");
});

router.post("/register", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  let persistedUser = await models.User.findOne({
    where: {
      username: username,
    },
  });

  if (persistedUser == null) {
    bcrypt.hash(password, SALT_ROUNDS, async (error, hash) => {
      if (error) {
        res.render("/register", { message: "Error creating user!" });
      } else {
        let user = models.User.build({
          username: username,
          password: hash,
        });

        let savedUser = await user.save();
        if (savedUser != null) {
          res.redirect("/login");
        } else {
          res.render("/register", { message: "User already exists!" });
        }
      }
    });
  } else {
    res.render("/register", { message: "User already exists!" });
  }
});

router.post("/login", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  let user = await models.User.findOne({
    where: {
      username: username,
    },
  });

  if (user != null) {
    bcrypt.compare(password, user.password, (error, result) => {
      if (result) {
        // create a session
        if (req.session) {
          req.session.user = { userId: user.id };
          res.redirect("/users/products");
        }
      } else {
        res.render("login", { message: "Incorrect username or password" });
      }
    });
  } else {
    // if the user is null
    res.render("login", { message: "Incorrect username or password" });
  }
});

module.exports = router;
