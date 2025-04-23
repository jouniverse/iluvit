const express = require("express");
const router = express.Router();
const { formidable } = require("formidable");
const { v1: uuidv1 } = require("uuid");
const models = require("../models");
const bcrypt = require("bcrypt");
const upload = require("express-fileupload");
const fs = require("fs");
const path = require("path");

let uniqueFilename = "";

router.get("/add-product", (req, res) => {
  res.render("users/add-product", {
    className: "product-preview-image-invisible",
  });
});

router.post("/update-product", async (req, res) => {
  try {
    const productId = req.body.productId;
    const title = req.body.title;
    const description = req.body.description;
    const price = parseFloat(req.body.price);
    const currentImageURL = req.body.currentImageURL;

    // Use the new image if uploaded, otherwise keep the current one
    const imageURL = uniqueFilename || currentImageURL;

    const result = await models.Product.update(
      {
        title: title,
        description: description,
        price: price,
        imageURL: imageURL,
      },
      {
        where: {
          id: productId,
        },
      }
    );

    // Reset uniqueFilename after update
    uniqueFilename = "";

    res.redirect("/users/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res.render("users/edit", {
      message: "Error updating product",
      type: "danger",
    });
  }
});

router.post("/upload/edit/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    if (!req.files || !req.files.photo) {
      return res.redirect(
        `/users/edit/${productId}?message=No files uploaded&type=danger`
      );
    }

    const files = req.files.photo;
    const uploadPromises = [];

    // Handle single file or multiple files
    const filesArray = Array.isArray(files) ? files : [files];

    for (const file of filesArray) {
      const uniqueFilename = `${uuidv1()}${path.extname(file.name)}`;
      const uploadPath = path.join(__basedir, "uploads", uniqueFilename);

      // Move the file to the uploads directory
      await file.mv(uploadPath);

      // Create database record
      uploadPromises.push(
        models.ProductImage.create({
          productId: productId,
          imageURL: uniqueFilename,
        })
      );
    }

    await Promise.all(uploadPromises);

    res.redirect(
      `/users/edit/${productId}?message=Images uploaded successfully&type=success`
    );
  } catch (error) {
    console.error("Error uploading images:", error);
    res.redirect(
      `/users/edit/${req.params.id}?message=Error uploading images&type=danger`
    );
  }
});

router.get("/products/:productId", async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.productId, {
      include: [
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
    });

    if (!product) {
      return res.redirect(
        "/users/products?message=Product not found&type=danger"
      );
    }

    res.render("users/edit", {
      ...product.toJSON(),
      message: req.query.message,
      type: req.query.type,
    });
  } catch (error) {
    console.error("Error loading product:", error);
    res.redirect("/users/products?message=Error loading product&type=danger");
  }
});

router.post("/delete-product", async (req, res) => {
  let productId = parseInt(req.body.productId);

  let result = await models.Product.destroy({
    where: {
      id: productId,
    },
  });

  res.redirect("/users/products");
});

router.get("/products", async (req, res) => {
  try {
    const products = await models.Product.findAll({
      where: {
        userId: req.session.user.userId,
      },
      include: [
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const processedProducts = products.map((product) => {
      const productData = product.get({ plain: true });
      // Always provide an images array
      productData.images = productData.images || [];
      // For fallback, also provide imageURL for {{^images.length}}{{#imageURL}}...
      productData.imageURL =
        productData.images.length > 0
          ? productData.images[0].imageURL
          : productData.imageURL || null;
      return productData;
    });

    res.render("users/products", {
      products: processedProducts,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("users/products", {
      products: [],
      message: "Error loading products. Please try again.",
      type: "danger",
      isAuthenticated: true,
    });
  }
});

router.post("/add-product", async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const userId = req.session.user.userId;

    // Create the product
    const product = await models.Product.create({
      title,
      description,
      price: parseFloat(price),
      userId,
    });

    // Handle image uploads
    if (req.files && req.files.photo) {
      const files = req.files.photo;
      const uploadPromises = [];

      // Handle single file or multiple files
      const filesArray = Array.isArray(files) ? files : [files];

      for (const file of filesArray) {
        const uniqueFilename = `${uuidv1()}${path.extname(file.name)}`;
        const uploadPath = path.join(__basedir, "uploads", uniqueFilename);

        // Move the file to the uploads directory
        await file.mv(uploadPath);

        // Create database record
        uploadPromises.push(
          models.ProductImage.create({
            productId: product.id,
            imageURL: uniqueFilename,
          })
        );
      }

      await Promise.all(uploadPromises);
    }

    res.redirect("/users/products");
  } catch (error) {
    console.error("Error creating product:", error);
    res.render("users/add-product", {
      message: "Error creating product. Please try again.",
      type: "danger",
    });
  }
});

function uploadFile(req, callback) {
  const form = formidable({
    uploadDir: __basedir + "/uploads/",
    keepExtensions: true,
    filename: (name, ext, part) => {
      uniqueFilename = `${uuidv1()}${ext}`;
      return uniqueFilename;
    },
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      return;
    }
    callback(uniqueFilename);
  });
}

router.post("/upload", (req, res) => {
  uploadFile(req, (photoURL) => {
    photoURL = `/uploads/${photoURL}`;
    res.render("users/add-product", {
      imageURL: photoURL,
      className: "product-preview-image",
    });
  });
});

// User Settings Routes
router.get("/settings", async (req, res) => {
  const user = await models.User.findByPk(req.session.user.userId);
  res.render("users/settings", { user: user });
});

router.post("/update-username", async (req, res) => {
  try {
    const newUsername = req.body.username;
    const userId = req.session.user.userId;

    // Check if username already exists
    const existingUser = await models.User.findOne({
      where: { username: newUsername },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.render("users/settings", {
        user: { username: req.session.user.username },
        message: "Username already taken",
        type: "danger",
      });
    }

    await models.User.update(
      { username: newUsername },
      { where: { id: userId } }
    );

    // Update session
    req.session.user.username = newUsername;

    res.render("users/settings", {
      user: { username: newUsername },
      message: "Username updated successfully",
      type: "success",
    });
  } catch (error) {
    res.render("users/settings", {
      user: { username: req.session.user.username },
      message: "Error updating username",
      type: "danger",
    });
  }
});

router.post("/update-password", async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.userId;

    // Get user
    const user = await models.User.findByPk(userId);

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      return res.render("users/settings", {
        user: { username: req.session.user.username },
        message: "Current password is incorrect",
        type: "danger",
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.render("users/settings", {
        user: { username: req.session.user.username },
        message: "New passwords do not match",
        type: "danger",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await models.User.update(
      { password: hashedPassword },
      { where: { id: userId } }
    );

    res.render("users/settings", {
      user: { username: req.session.user.username },
      message: "Password updated successfully",
      type: "success",
    });
  } catch (error) {
    res.render("users/settings", {
      user: { username: req.session.user.username },
      message: "Error updating password",
      type: "danger",
    });
  }
});

router.post("/delete-account", async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.session.user.userId;

    console.log("Attempting to delete account for user ID:", userId);

    // Get user
    const user = await models.User.findByPk(userId);
    if (!user) {
      console.log("User not found with ID:", userId);
      return res.render("users/settings", {
        user: { username: req.session.user.username },
        message: "User not found",
        type: "danger",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log("Invalid password for user:", userId);
      return res.render("users/settings", {
        user: { username: req.session.user.username },
        message: "Incorrect password",
        type: "danger",
      });
    }

    // Delete user's products first (if any)
    console.log("Deleting user's products...");
    await models.Product.destroy({
      where: { userId: userId },
    });

    // Delete user's comments
    console.log("Deleting user's comments...");
    await models.Comment.destroy({
      where: { userId: userId },
    });

    // Delete user
    console.log("Deleting user...");
    await models.User.destroy({
      where: { id: userId },
    });

    console.log("Account deletion successful for user:", userId);

    // Destroy session
    req.session.destroy();

    res.redirect("/");
  } catch (error) {
    console.error("Error deleting account:", error);
    res.render("users/settings", {
      user: { username: req.session.user.username },
      message: "Error deleting account. Please try again.",
      type: "danger",
    });
  }
});

// Add logout route
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Add route for viewing all products
router.get("/all-products", async (req, res) => {
  try {
    const products = await models.Product.findAll({
      include: [
        {
          model: models.User,
          attributes: ["username"],
        },
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const processedProducts = products.map((product) => {
      const productData = product.get({ plain: true });
      let imageURL = null;
      if (productData.images && productData.images.length > 0) {
        imageURL = productData.images[0].imageURL;
      } else if (productData.imageURL) {
        imageURL = productData.imageURL;
      }
      return {
        ...productData,
        imageURL,
        isOutOfStock: productData.quantity === 0,
      };
    });

    res.render("users/all-products", {
      products: processedProducts,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Error in all-products route:", error);
    res.render("users/all-products", {
      products: [],
      message: "Error loading products. Please try again.",
      type: "danger",
      isAuthenticated: true,
    });
  }
});

router.get("/product-details/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await models.Product.findByPk(productId, {
      include: [
        {
          model: models.User,
          attributes: ["username"],
        },
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
    });

    if (!product) {
      return res.render("users/product-details", {
        message: "Product not found",
        type: "danger",
        isAuthenticated: true,
      });
    }

    const productData = product.get({ plain: true });
    productData.images = productData.images || [];
    productData.imageURL =
      productData.images.length > 0
        ? productData.images[0].imageURL
        : productData.imageURL || null;

    res.render("users/product-details", {
      product: productData,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.render("users/product-details", {
      message: "Error loading product details",
      type: "danger",
      isAuthenticated: true,
    });
  }
});

router.post("/add-comment", async (req, res) => {
  try {
    const { productId, title, description } = req.body;
    const userId = req.session.user.userId;

    const comment = await models.Comment.create({
      title: title,
      description: description,
      productId: productId,
      userId: userId,
    });

    res.redirect(`/users/product-details/${productId}`);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.redirect(
      `/users/product-details/${req.body.productId}?error=Failed to add comment`
    );
  }
});

// Handle image deletion
router.post("/delete-image/:id", async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await models.ProductImage.findByPk(imageId);

    if (!image) {
      return res.redirect(
        `/users/edit/${req.body.productId}?message=Image not found&type=danger`
      );
    }

    const productId = image.productId;
    await image.destroy();

    // Delete the file from the uploads directory
    const filePath = path.join(__dirname, "../public/uploads", image.imageURL);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.redirect(
      `/users/edit/${productId}?message=Image deleted successfully&type=success`
    );
  } catch (error) {
    console.error("Error deleting image:", error);
    res.redirect(
      `/users/edit/${req.body.productId}?message=Error deleting image&type=danger`
    );
  }
});

// Update the edit route to include images
router.get("/edit/:id", async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id, {
      include: [
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
    });

    if (!product) {
      return res.redirect(
        "/users/products?message=Product not found&type=danger"
      );
    }

    res.render("users/edit", {
      ...product.toJSON(),
      message: req.query.message,
      type: req.query.type,
    });
  } catch (error) {
    console.error("Error loading product for edit:", error);
    res.redirect("/users/products?message=Error loading product&type=danger");
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

// Shopping Cart Routes
router.get("/shopping-cart", async (req, res) => {
  try {
    const cartItems = await models.ShoppingCart.findAll({
      where: { userId: req.session.user.userId },
      include: [
        {
          model: models.Product,
          attributes: ["id", "title", "price"],
        },
      ],
    });

    // Process cart items to include product details
    const processedCartItems = cartItems.map((item) => ({
      id: item.id,
      title: item.Product.title,
      price: item.Product.price,
      quantity: item.quantity,
    }));

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.Product.price,
      0
    );

    // Update cart count in session
    req.session.cartCount = totalItems;

    // Get user details
    const user = await models.User.findByPk(req.session.user.userId);

    res.render("users/shopping-cart", {
      cartItems: processedCartItems,
      totalItems,
      totalPrice,
      user: user.toJSON(),
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Error loading shopping cart:", error);
    res.render("users/shopping-cart", {
      message: "Error loading shopping cart",
      type: "danger",
      isAuthenticated: true,
    });
  }
});

router.post("/add-to-cart", async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user.userId;

    // Check if product exists and has quantity
    const product = await models.Product.findByPk(productId);
    if (!product || product.quantity <= 0) {
      return res.redirect(
        "/users/all-products?message=Product not available&type=danger"
      );
    }

    // Prevent users from adding their own products
    if (product.userId === userId) {
      return res.redirect(
        "/users/all-products?message=You cannot add your own products to cart&type=danger"
      );
    }

    // Check if item already in cart
    let cartItem = await models.ShoppingCart.findOne({
      where: { userId, productId },
    });

    if (cartItem) {
      // Update quantity if item exists
      await cartItem.update({
        quantity: cartItem.quantity + 1,
      });
    } else {
      // Create new cart item
      await models.ShoppingCart.create({
        userId,
        productId,
        quantity: 1,
      });
    }

    // Update product quantity
    await product.update({
      quantity: product.quantity - 1,
    });

    // Update cart count in session
    const cartCount = await models.ShoppingCart.sum("quantity", {
      where: { userId },
    });
    req.session.cartCount = cartCount || 0;

    res.redirect("/users/shopping-cart");
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.redirect(
      "/users/all-products?message=Error adding to cart&type=danger"
    );
  }
});

router.post("/update-cart-quantity", async (req, res) => {
  try {
    const { cartItemId, quantity } = req.body;
    const cartItem = await models.ShoppingCart.findByPk(cartItemId, {
      include: [models.Product],
    });

    if (!cartItem) {
      return res.redirect(
        "/users/shopping-cart?message=Item not found&type=danger"
      );
    }

    const quantityDiff = quantity - cartItem.quantity;
    if (cartItem.Product.quantity < quantityDiff) {
      return res.redirect(
        "/users/shopping-cart?message=Not enough stock available&type=danger"
      );
    }

    await cartItem.update({ quantity });
    await cartItem.Product.update({
      quantity: cartItem.Product.quantity - quantityDiff,
    });

    res.redirect("/users/shopping-cart");
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.redirect(
      "/users/shopping-cart?message=Error updating quantity&type=danger"
    );
  }
});

router.post("/remove-from-cart", async (req, res) => {
  try {
    const { cartItemId } = req.body;
    const cartItem = await models.ShoppingCart.findByPk(cartItemId, {
      include: [models.Product],
    });

    if (!cartItem) {
      return res.redirect(
        "/users/shopping-cart?message=Item not found&type=danger"
      );
    }

    // Return quantity to product
    await cartItem.Product.update({
      quantity: cartItem.Product.quantity + cartItem.quantity,
    });

    await cartItem.destroy();
    res.redirect("/users/shopping-cart");
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.redirect(
      "/users/shopping-cart?message=Error removing item&type=danger"
    );
  }
});

// Update user details route
router.post("/update-details", async (req, res) => {
  try {
    const { name, email, address, phone } = req.body;
    await models.User.update(
      { name, email, address, phone },
      { where: { id: req.session.user.userId } }
    );
    res.redirect(
      "/users/settings?message=Details updated successfully&type=success"
    );
  } catch (error) {
    console.error("Error updating user details:", error);
    res.redirect("/users/settings?message=Error updating details&type=danger");
  }
});

module.exports = router;
